import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';

// ─── UUID-uri din ESP32 (ArduinoBLE) ─────────────────────────────────────────
const ESP32_DEVICE_NAME  = 'ESP32_BLE';
const ESP32_SERVICE_UUID = '0000180a-0000-1000-8000-00805f9b34fb';
const ESP32_RX_CHAR_UUID = '00002a19-0000-1000-8000-00805f9b34fb';
const ESP32_TX_CHAR_UUID = '00002a1a-0000-1000-8000-00805f9b34fb';

// ─── IP-ul PC-ului portarului pe rețeaua locală ───────────────────────────────
const BACKEND_URL = 'http://192.168.1.100:8080';

const manager = new BleManager();
let connectedDevice: any | null = null;

export async function isBluetoothReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const sub = manager.onStateChange((state) => {
      sub.remove();
      resolve(state === 'PoweredOn');
    }, true);
  });
}

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
  return Object.values(granted).every(
    (v) => v === PermissionsAndroid.RESULTS.GRANTED
  );
}

export async function enableBluetooth(): Promise<boolean> {
  const hasPermissions = await requestBlePermissions();
  if (!hasPermissions) {
    Alert.alert(
      'Permisiuni necesare',
      'Acordați permisiunile Bluetooth pentru a continua.',
      [{ text: 'Deschide Setări', onPress: () => Linking.openSettings() }]
    );
    return false;
  }

  const alreadyReady = await isBluetoothReady();
  if (alreadyReady) return true;

  if (Platform.OS === 'android') {
    return new Promise((resolve) => {
      Alert.alert(
        'Bluetooth dezactivat',
        'Activează Bluetooth pentru a acționa bariera.',
        [
          {
            text: 'Deschide Setări',
            onPress: async () => {
              await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
              const sub = manager.onStateChange((state) => {
                if (state === 'PoweredOn') { sub.remove(); resolve(true); }
              }, true);
              setTimeout(() => { sub.remove(); resolve(false); }, 30000);
            },
          },
          { text: 'Anulează', style: 'cancel', onPress: () => resolve(false) },
        ]
      );
    });
  }

  return false;
}

export async function disableBluetooth(): Promise<void> {
  await disconnectDevice();
}

async function disconnectDevice(): Promise<void> {
  if (connectedDevice) {
    try { await connectedDevice.cancelConnection(); } catch {}
    connectedDevice = null;
  }
}

export type BleTransmitResult =
  | { success: true; deviceName: string }
  | { success: false; error: string };

export async function transmitSecurityCode(
  bluetoothSecurityCode: string
): Promise<BleTransmitResult> {
  const ready = await isBluetoothReady();
  if (!ready) return { success: false, error: 'Bluetooth nu este activ.' };

  const hasPermissions = await requestBlePermissions();
  if (!hasPermissions) return { success: false, error: 'Permisiuni BLE lipsă.' };

  try {
    console.log('[BLE] Scanare după ESP32_BLE...');

    // 1. Scanare după ESP32 — 3 secunde
    const device = await new Promise<any | null>((resolve) => {
      let found: any | null = null;
      const timeout = setTimeout(() => {
        manager.stopDeviceScan();
        resolve(found);
      }, 3000); // ← redus la 3s ca să nu aștepte prea mult

      manager.startDeviceScan(
        null,
        { allowDuplicates: false },
        (error, dev) => {
          if (error) {
            clearTimeout(timeout);
            manager.stopDeviceScan();
            resolve(null);
            return;
          }
          console.log('[BLE] Găsit dispozitiv:', dev?.name, dev?.localName);
          if (
            dev?.name === ESP32_DEVICE_NAME ||
            dev?.localName === ESP32_DEVICE_NAME
          ) {
            clearTimeout(timeout);
            manager.stopDeviceScan();
            found = dev;
            resolve(found);
          }
        }
      );
    });

    // 2. ESP32 negăsit → flux pietoni via WiFi
    if (!device) {
      console.log('[WiFi] ESP32 negăsit — trimit via WiFi la portar');
      return await sendViaWifi(bluetoothSecurityCode);
    }

    console.log(`[BLE] Găsit: ${device.name} (${device.id})`);

    // 3. Conectare ESP32
    connectedDevice = await device.connect({
      timeout: 15000,
      requestMTU: 256,
    });

    await new Promise((res) => setTimeout(res, 800));
    await connectedDevice.discoverAllServicesAndCharacteristics();
    console.log('[BLE] Servicii descoperite');

    const services = await connectedDevice.services();
    console.log('[BLE] Servicii disponibile:', services.map((s: { uuid: string }) => s.uuid));

    const serviceExists = services.some((s: { uuid: string }) =>
      s.uuid.toLowerCase().includes('180a')
    );

    if (!serviceExists) {
      await disconnectDevice();
      return {
        success: false,
        error: 'Service-ul ESP32 nu a fost găsit. Verifică codul ArduinoBLE.',
      };
    }

    const encoded = btoa(bluetoothSecurityCode);
    await connectedDevice.writeCharacteristicWithResponseForService(
      ESP32_SERVICE_UUID,
      ESP32_RX_CHAR_UUID,
      encoded
    );

    console.log(`[BLE] Cod transmis pe RX: ${bluetoothSecurityCode}`);

    try {
      const response = await connectedDevice.readCharacteristicForService(
        ESP32_SERVICE_UUID,
        ESP32_TX_CHAR_UUID
      );
      if (response?.value) {
        const decoded = atob(response.value);
        console.log('[BLE] Răspuns ESP32:', decoded);
      }
    } catch {
    }

    await disconnectDevice();
    return { success: true, deviceName: ESP32_DEVICE_NAME };

  } catch (e: any) {
    console.error('[BLE] Eroare:', e.message);
    await disconnectDevice();
    return { success: false, error: e.message ?? 'Eroare la transmisie BLE.' };
  }
}

// ─── FLUX PIETONI — WiFi → Spring Boot ─────────────────────────────
async function sendViaWifi(
  bluetoothSecurityCode: string
): Promise<BleTransmitResult> {
  try {
    console.log(`[WiFi] Trimit la ${BACKEND_URL}/api/gate/authorize`);

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${BACKEND_URL}/api/gate/authorize`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        bluetoothSecurityCode,
        direction:    'ENTRY',
        accessMethod: 'bluetooth_pc',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: `Server error: ${res.status}` };
    }

    const data = await res.json();
    console.log('[WiFi] Răspuns backend:', data);

    if (data.status === 'GRANTED') {
      return { success: true, deviceName: 'PC Portar' };
    }

    return { success: false, error: data.message ?? 'Acces refuzat.' };

  } catch (e: any) {
    if (e.name === 'AbortError') {
      return {
        success: false,
        error:   'Timeout — portarul nu răspunde.\nVerificați conexiunea WiFi.',
      };
    }
    return {
      success: false,
      error:   'Nu s-a putut contacta portarul.\nVerificați că sunteți pe același WiFi.',
    };
  }
}

export function destroyBleManager(): void {
  disconnectDevice();
  manager.destroy();
}