import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_KEY_DEVICE_ID = 'PRIVATE_DEVICE_ID';
const SECURE_KEY_LOCKED    = 'PRIVATE_DEVICE_ID_LOCKED';

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(SECURE_KEY_DEVICE_ID);
  if (existing) return existing;

  let nativeHardwareId = 'unknown-device';
  try {
    if (Platform.OS === 'android') {
      nativeHardwareId = Application.getAndroidId() ?? 'android-unknown';
    } else if (Platform.OS === 'ios') {
      nativeHardwareId = (await Application.getIosIdForVendorAsync()) ?? 'ios-unknown';
    }
  } catch {}

  const raw = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nativeHardwareId + '_' + Date.now().toString() + '_' + Math.random().toString()
  );
  const deviceId = raw.slice(0, 32).toUpperCase();

  await SecureStore.setItemAsync(SECURE_KEY_DEVICE_ID, deviceId);
  await SecureStore.setItemAsync(SECURE_KEY_LOCKED, 'true');

  console.log('[DeviceId] ID generat și blocat:', deviceId);
  return deviceId;
}

export async function isDeviceIdLocked(): Promise<boolean> {
  const locked = await SecureStore.getItemAsync(SECURE_KEY_LOCKED);
  return locked === 'true';
}

export async function getDeviceIdIfExists(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_KEY_DEVICE_ID);
}
