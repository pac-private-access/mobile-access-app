import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProfileResult, RaportEntry } from './api';

const KEYS = {
  profile:     'LOCAL_PROFILE_V2',
  raport:      'LOCAL_RAPORT_V2',
  accessQueue: 'OFFLINE_ACCESS_QUEUE_V2',
} as const;

export type QueuedAccessEvent = {
  localId:       string;
  employeeId:    string;
  eventType:     'Intrare' | 'Iesire';
  accessMethod:  'bluetooth_esp32' | 'bluetooth_pc';
  eventAt:       string;
  outOfSchedule: boolean;
  isAuthorized:  boolean;
};

// ─── Profil ───────────────────────────────────────────────────────────────────
export async function saveProfileCache(profile: ProfileResult): Promise<void> {
  await AsyncStorage.setItem(KEYS.profile, JSON.stringify({ data: profile, savedAt: new Date().toISOString() }));
}

export async function getProfileCache(): Promise<{ data: ProfileResult; savedAt: string } | null> {
  const raw = await AsyncStorage.getItem(KEYS.profile);
  return raw ? JSON.parse(raw) : null;
}

export async function clearProfileCache(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.profile);
}

// ─── Raport ───────────────────────────────────────────────────────────────────
export async function saveRaportCache(entries: RaportEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.raport, JSON.stringify({ data: entries, savedAt: new Date().toISOString() }));
}

export async function getRaportCache(): Promise<{ data: RaportEntry[]; savedAt: string } | null> {
  const raw = await AsyncStorage.getItem(KEYS.raport);
  return raw ? JSON.parse(raw) : null;
}

// ─── Coadă offline ────────────────────────────────────────────────────────────
export async function enqueueAccessEvent(event: QueuedAccessEvent): Promise<void> {
  const raw = await AsyncStorage.getItem(KEYS.accessQueue);
  const queue: QueuedAccessEvent[] = raw ? JSON.parse(raw) : [];
  queue.push(event);
  await AsyncStorage.setItem(KEYS.accessQueue, JSON.stringify(queue));
  console.log(`[LocalStore] Event în coadă. Total: ${queue.length}`);
}

export async function getAccessQueue(): Promise<QueuedAccessEvent[]> {
  const raw = await AsyncStorage.getItem(KEYS.accessQueue);
  return raw ? JSON.parse(raw) : [];
}

export async function clearAccessQueue(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.accessQueue);
}

export async function getQueueCount(): Promise<number> {
  const queue = await getAccessQueue();
  return queue.length;
}

export async function clearAllLocalData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
