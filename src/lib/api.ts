import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const DEVICE_ID_KEY = 'PRIVATE_DEVICE_ID';

// ─── IP-ul PC-ului portarului ─────────────────────────────────────────────────
const BACKEND_URL = 'http://192.168.1.100:8080'; // ← emulator Android

export type ProfileResult = {
  employeeId:     string;
  numeComplet:    string;
  badgeNumber:    string;
  cnp:            string;
  divisie:        string;
  orarPermis:     string;
  acordatDe:      string;
  acordatDeBadge: string | null;
  valabilPana:    string | null;
  isAccessActive: boolean;
  carPlate:       string | null;
  bluetoothCode:  string;
  photoUrl:       string | null;
};

export type RaportEntry = {
  id:            string;
  eventType:     'Intrare' | 'Iesire';
  accessMethod:  string;
  isAuthorized:  boolean;
  outOfSchedule: boolean;
  eventAt:       string;
  synced:        boolean;
};

export type QueuedEvent = {
  localId:       string;
  employeeId:    string;
  eventType:     'Intrare' | 'Iesire';
  accessMethod:  'bluetooth_esp32' | 'bluetooth_pc';
  eventAt:       string;
  outOfSchedule: boolean;
  isAuthorized:  boolean;
};

const CACHE = {
  profile: 'CACHE_PROFILE_V2',
  raport:  'CACHE_RAPORT_V2',
  queue:   'OFFLINE_QUEUE_V2',
};

// ─── Helper fetch cu timeout ──────────────────────────────────────────────────
async function fetchBackend(path: string): Promise<any> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method:  'GET',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return await res.json();

  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error('Timeout — calculatorul de la poartă nu răspunde.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── getProfile — via Spring Boot ────────────────────────────────────────────
export async function getProfile(): Promise<ProfileResult> {
  const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId) throw new Error('Device ID negăsit. Reconectați-vă.');

  // Verificare smartphone — rămâne în Supabase (autentificare locală)
  const { data: phone, error: phoneErr } = await supabase
    .from('smartphones')
    .select('employee_id, is_active')
    .eq('puk_code', deviceId)
    .single();

  if (phoneErr || !phone) throw new Error('Dispozitiv neînregistrat.');
  if (!phone.is_active) throw new Error('Dispozitiv neaprobat. Contactați administratorul.');

  // Datele angajatului vin din Spring Boot
  const data = await fetchBackend(`/api/mobile/profile/${phone.employee_id}`);

  const profile: ProfileResult = {
    employeeId:     data.employeeId,
    numeComplet:    data.numeComplet,
    badgeNumber:    data.badgeNumber,
    cnp:            data.cnp,
    divisie:        data.divisie ?? 'Necunoscut',
    orarPermis:     data.orarPermis ?? 'Nespecificat',
    acordatDe:      'Administrator',
    acordatDeBadge: data.acordatDeBadge ?? null,
    valabilPana:    data.valabilPana ?? null,
    isAccessActive: data.isAccessActive,
    carPlate:       data.carPlate ?? null,
    bluetoothCode:  data.bluetoothCode,
    photoUrl:       data.photoUrl ?? null,
  };

  await AsyncStorage.setItem(CACHE.profile, JSON.stringify(profile));
  return profile;
}

export async function getCachedProfile(): Promise<ProfileResult | null> {
  const raw = await AsyncStorage.getItem(CACHE.profile);
  return raw ? JSON.parse(raw) : null;
}

// ─── getRaport — via Spring Boot ─────────────────────────────────────────────
export async function getRaport(): Promise<RaportEntry[]> {
  const cached = await getCachedProfile();
  if (!cached?.employeeId) throw new Error('Profil negăsit. Reîncărcați aplicația.');

  // Raportul vine din Spring Boot
  const data = await fetchBackend(`/api/mobile/report/${cached.employeeId}`);

  const entries: RaportEntry[] = (data ?? []).map((log: any) => ({
    id:            log.id,
    eventType:     log.eventType as 'Intrare' | 'Iesire',
    accessMethod:  log.accessMethod,
    isAuthorized:  log.isAuthorized,
    outOfSchedule: log.outOfSchedule,
    eventAt:       log.eventAt,
    synced:        log.synced,
  }));

  await AsyncStorage.setItem(CACHE.raport, JSON.stringify(entries));
  return entries;
}

export async function getCachedRaport(): Promise<RaportEntry[] | null> {
  const raw = await AsyncStorage.getItem(CACHE.raport);
  return raw ? JSON.parse(raw) : null;
}

// ─── Queue ────────────────────────────────────────────────────────────────────
export async function enqueueEvent(event: QueuedEvent): Promise<void> {
  const raw = await AsyncStorage.getItem(CACHE.queue);
  const queue: QueuedEvent[] = raw ? JSON.parse(raw) : [];
  queue.push(event);
  await AsyncStorage.setItem(CACHE.queue, JSON.stringify(queue));
}

export async function getQueue(): Promise<QueuedEvent[]> {
  const raw = await AsyncStorage.getItem(CACHE.queue);
  return raw ? JSON.parse(raw) : [];
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(CACHE.queue);
}

export async function flushQueue(): Promise<number> {
  const queue = await getQueue();
  if (queue.length === 0) return 0;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const validQueue = queue.filter((ev) => uuidRegex.test(ev.employeeId));

  if (validQueue.length === 0) {
    await clearQueue();
    return 0;
  }

  // flushQueue trimite la Spring Boot
  const rows = validQueue.map((ev) => ({
    employee_id:     ev.employeeId,
    event_type:      ev.eventType === 'Intrare' ? 'entry' : 'exit',
    access_method:   ev.accessMethod,
    is_authorized:   ev.isAuthorized,
    out_of_schedule: ev.outOfSchedule,
    event_at:        ev.eventAt,
    synced_to_cloud: true,
  }));

  const { error } = await supabase.from('access_logs').insert(rows);
  if (error) throw new Error(error.message);

  await clearQueue();
  return validQueue.length;
}