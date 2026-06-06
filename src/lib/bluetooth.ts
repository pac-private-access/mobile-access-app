import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';

const ESP32_DEVICE_NAME  = 'PAC-ESP32';
const ESP32_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const ESP32_CHAR_UUID    = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

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
  // Cere permisiuni mai întâi
  const hasPermissions = await requestBlePermissions();
  if (!hasPermissions) {
    Alert.alert(
      'Permisiuni necesare',
      'Acordați permisiunile Bluetooth pentru a continua.',
      [{ text: 'Deschide Setări', onPress: () => Linking.openSettings() }]
    );
    return false;
  }

  // Verifică dacă e deja activ
  const alreadyReady = await isBluetoothReady();
  if (alreadyReady) return true;

  if (Platform.OS === 'android') {
    // Pe Android SDK 31+ nu poți activa programatic
    // Cel mai bun UX — dialog care întreabă userul
    return new Promise((resolve) => {
      Alert.alert(
        'Bluetooth dezactivat',
        'Activează Bluetooth pentru a acționa bariera.',
        [
          {
            text: 'Deschide Setări',
            onPress: async () => {
              await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
              // Ascultă când revine în app
              const sub = manager.onStateChange((state) => {
                if (state === 'PoweredOn') {
                  sub.remove();
                  resolve(true);
                }
              }, true);
              // Timeout 30 secunde
              setTimeout(() => { sub.remove(); resolve(false); }, 30000);
            },
          },
          {
            text: 'Anulează',
            style: 'cancel',
            onPress: () => resolve(false),
          },
        ]
      );
    });
  }

  if (Platform.OS === 'ios') {
    Alert.alert(
      'Activare Bluetooth',
      'Activează Bluetooth din Centrul de Control, apoi revino în aplicație.'
    );
    return false;
  }

  return false;
}

export async function disableBluetooth(): Promise<void> {
  // Nu mai putem dezactiva programatic pe Android SDK 31+
  // Doar deconectăm device-ul curent
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
  if (!ready) {
    return { success: false, error: 'Bluetooth nu este activ.' };
  }

  // Cere permisiuni înainte de scan
  const hasPermissions = await requestBlePermissions();
  if (!hasPermissions) {
    return { success: false, error: 'Permisiuni Bluetooth lipsă.' };
  }

  try {
    console.log('[BLE] Scanare după ESP32...');

    const device = await new Promise<any | null>((resolve) => {
      let found: any | null = null;
      const timeout = setTimeout(() => {
        manager.stopDeviceScan();
        resolve(found);
      }, 8000);

      manager.startDeviceScan(null, { allowDuplicates: false }, (error, dev) => {
        if (error) {
          clearTimeout(timeout);
          manager.stopDeviceScan();
          resolve(null);
          return;
        }
        if (dev?.name === ESP32_DEVICE_NAME || dev?.localName === ESP32_DEVICE_NAME) {
          clearTimeout(timeout);
          manager.stopDeviceScan();
          found = dev;
          resolve(found);
        }
      });
    });

    if (!device) {
      return { success: false, error: 'ESP32 nu a fost găsit. Apropiați-vă de poartă.' };
    }

    console.log(`[BLE] Găsit: ${device.name}`);

    connectedDevice = await device.connect({ timeout: 10000 });
    await connectedDevice.discoverAllServicesAndCharacteristics();

    const encoded = btoa(unescape(encodeURIComponent(bluetoothSecurityCode)));
    await connectedDevice.writeCharacteristicWithResponseForService(
      ESP32_SERVICE_UUID,
      ESP32_CHAR_UUID,
      encoded
    );

    console.log(`[BLE] Cod transmis: ${bluetoothSecurityCode}`);
    await disconnectDevice();

    return { success: true, deviceName: device.name ?? 'ESP32' };

  } catch (e: any) {
    await disconnectDevice();
    return { success: false, error: e.message ?? 'Eroare la transmisie BLE.' };
  }
}

export function destroyBleManager(): void {
  disconnectDevice();
  manager.destroy();
}