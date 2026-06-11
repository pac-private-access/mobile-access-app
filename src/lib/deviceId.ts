/**
 * deviceId.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generează și păstrează un ID unic de dispozitiv care NU poate fi schimbat
 * după prima instalare.
 *
 * Strategia:
 *   - La prima rulare: combinăm ID-ul nativ al hardware-ului cu un hash random
 *   - Îl salvăm în SecureStore (nu AsyncStorage — SecureStore supraviețuiește
 *     ștergerilor de date ale aplicației pe iOS, e în Keychain)
 *   - Orice apel ulterior returnează același ID din SecureStore
 *
 * Relație cu schema DB:
 *   Acest ID nu e același cu bluetooth_security_code din employees.
 *   bluetooth_security_code e setat de admin în DB și transmis prin BLE.
 *   deviceId e legătura internă telefon → employees via smartphones.puk_code.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURE_KEY_DEVICE_ID = 'PRIVATE_DEVICE_ID';
const SECURE_KEY_LOCKED    = 'PRIVATE_DEVICE_ID_LOCKED';

/**
 * Returnează ID-ul unic al dispozitivului.
 * La prima rulare îl generează și îl blochează permanent în SecureStore.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  // Dacă există deja → returnăm direct, fără a permite modificare
  const existing = await SecureStore.getItemAsync(SECURE_KEY_DEVICE_ID);
  if (existing) return existing;

  // ── Prima rulare: construim ID-ul ─────────────────────────────────────────
  let nativeHardwareId = 'unknown-device';

  try {
    if (Platform.OS === 'android') {
      nativeHardwareId = Application.getAndroidId() ?? 'android-unknown';
    } else if (Platform.OS === 'ios') {
      nativeHardwareId = (await Application.getIosIdForVendorAsync()) ?? 'ios-unknown';
    }
  } catch {
    // Dacă nu avem permisiune, continuăm cu fallback random
  }

  // SHA-256(hardwareId + timestamp random) → primele 32 chars uppercase
  const raw = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nativeHardwareId + '_' + Date.now().toString() + '_' + Math.random().toString()
  );
  const deviceId = raw.slice(0, 32).toUpperCase();

  // Salvăm permanent în SecureStore
  await SecureStore.setItemAsync(SECURE_KEY_DEVICE_ID, deviceId);
  await SecureStore.setItemAsync(SECURE_KEY_LOCKED, 'true');

  console.log('[DeviceId] ID generat și blocat:', deviceId);
  return deviceId;
}

/**
 * Verifică dacă ID-ul a fost deja generat și blocat.
 * Util pentru ecranul de onboarding (să știm dacă e prima instalare).
 */
export async function isDeviceIdLocked(): Promise<boolean> {
  const locked = await SecureStore.getItemAsync(SECURE_KEY_LOCKED);
  return locked === 'true';
}

/**
 * Returnează ID-ul dacă există, fără a-l crea.
 * Returnează null dacă aplicația nu a fost niciodată activată.
 */
export async function getDeviceIdIfExists(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_KEY_DEVICE_ID);
}