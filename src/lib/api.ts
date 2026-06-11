import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const DEVICE_ID_KEY = 'PRIVATE_DEVICE_ID';

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

const BACKEND_URL = 'https://pac-management.onrender.com';

// ─── Helper orar ──────────────────────────────────────────────────────────────
const DAY_NAMES: Record<number, string> = {
  0: 'Dum', 1: 'Lun', 2: 'Mar',
  3: 'Mie', 4: 'Joi', 5: 'Vin', 6: 'Sâm',
};

function buildOrarString(schedules: any[]): string {
  if (!schedules || schedules.length === 0) return 'Nespecificat';

  const groups: Record<string, string[]> = {};
  for (const s of schedules) {
    const from = s.time_from?.slice(0, 5) ?? '?';
    const to   = s.time_to?.slice(0, 5)   ?? '?';
    const key  = `${from}-${to}`;
    const day  = s.day_of_week !== null && s.day_of_week !== undefined
      ? DAY_NAMES[s.day_of_week] ?? `Z${s.day_of_week}`
      : 'Zilnic';
    if (!groups[key]) groups[key] = [];
    groups[key].push(day);
  }

  return Object.entries(groups)
    .map(([interval, days]) => `${days.join(', ')} ${interval}`)
    .join(' | ');
}

// ─── fetchBackend
async function fetchBackend(path: string, employeeId?: string): Promise<any> {

  // /api/mobile/profile/:id
  if (path.includes('/api/mobile/profile/')) {
    const id = path.split('/').pop();

    const { data: emp, error } = await supabase
      .from('employees')
      .select(`
        *,
        divisions(name),
        schedules(
          day_of_week,
          time_from,
          time_to,
          valid_from,
          valid_to
        )
      `)
      .eq('id', id)
      .single();

    if (error || !emp) throw new Error('Angajat negăsit.');

    const validTo = emp.schedules?.find((s: any) => s.valid_to)?.valid_to ?? null;

    return {
      employeeId:     emp.id,
      numeComplet:    `${emp.first_name} ${emp.last_name}`,
      badgeNumber:    emp.badge_number,
      cnp:            emp.cnp,
      divisie:        emp.divisions?.name ?? 'Necunoscut',
      orarPermis:     buildOrarString(emp.schedules ?? []),
      acordatDeBadge: emp.access_granted_by_badge ?? null,
      valabilPana:    validTo,
      isAccessActive: emp.is_access_active,
      carPlate:       emp.car_plate ?? null,
      bluetoothCode:  emp.bluetooth_security_code,
      photoUrl:       emp.photo_url ?? null,
    };
  }

  // /api/mobile/report/:id
  if (path.includes('/api/mobile/report/')) {
    const id = path.split('/').pop();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('access_logs')
      .select('*')
      .eq('employee_id', id)
      .gte('event_at', startOfMonth.toISOString())
      .order('event_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((log: any) => ({
      id:            log.id,
      eventType:     log.event_type === 'entry' ? 'Intrare' : 'Iesire',
      accessMethod:  log.access_method,
      isAuthorized:  log.is_authorized,
      outOfSchedule: log.out_of_schedule,
      eventAt:       log.event_at,
      synced:        log.synced_to_cloud,
    }));
  }

  throw new Error(`Path necunoscut: ${path}`);
}

// ─── getProfile ───────────────────────────────────────────────────────────────
export async function getProfile(): Promise<ProfileResult> {
  const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId) throw new Error('Device ID negăsit. Reconectați-vă.');

  const { data: phone, error: phoneErr } = await supabase
    .from('smartphones')
    .select('employee_id, is_active')
    .eq('puk_code', deviceId)
    .single();

  if (phoneErr || !phone) throw new Error('Dispozitiv neînregistrat.');
  if (!phone.is_active) throw new Error('Dispozitiv neaprobat. Contactați administratorul.');

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

// ─── getRaport ────────────────────────────────────────────────────────────────
export async function getRaport(): Promise<RaportEntry[]> {
  const cached = await getCachedProfile();
  if (!cached?.employeeId) throw new Error('Profil negăsit. Reîncărcați aplicația.');

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