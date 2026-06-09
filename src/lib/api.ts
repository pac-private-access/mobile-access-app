import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  accessLogs,
  employees,
  type Schedule
} from './mockDb';
import { supabase } from './supabase';

const USE_MOCK = false;

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

const fakeDelay = () =>
  new Promise((res) => setTimeout(res, 400 + Math.random() * 400));

function buildOrarString(empSchedules: Schedule[]): string {
  if (empSchedules.length === 0) return 'Nespecificat';
  const dayNames: Record<number, string> = {
    1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Joi', 5: 'Vin', 6: 'Sam', 7: 'Dum',
  };
  const days = empSchedules.map((s) => dayNames[s.day_of_week]).join(', ');
  const { time_from, time_to } = empSchedules[0];
  return `${days}, ${time_from}-${time_to}`;
}

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

  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('*, divisions(name), schedules(*)')
    .eq('id', phone.employee_id)
    .single();

  if (empErr || !emp) throw new Error('Angajat negăsit.');

  const profile: ProfileResult = {
    employeeId:     emp.id,
    numeComplet:    `${emp.first_name} ${emp.last_name}`,
    badgeNumber:    emp.badge_number,
    cnp:            emp.cnp,
    divisie:        emp.divisions?.name ?? 'Necunoscut',
    orarPermis:     buildOrarString(emp.schedules ?? []),
    acordatDe:      'Administrator',
    acordatDeBadge: emp.access_granted_by_badge,
    valabilPana:    null,
    isAccessActive: emp.is_access_active,
    carPlate:       emp.car_plate,
    bluetoothCode:  emp.bluetooth_security_code,
    photoUrl:       emp.photo_url ?? null,
  };

  await AsyncStorage.setItem(CACHE.profile, JSON.stringify(profile));
  return profile;
}

export async function getCachedProfile(): Promise<ProfileResult | null> {
  const raw = await AsyncStorage.getItem(CACHE.profile);
  return raw ? JSON.parse(raw) : null;
}

export async function getRaport(): Promise<RaportEntry[]> {
  if (USE_MOCK) {
    await fakeDelay();
    const employee = employees[0];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return accessLogs
      .filter((log) => {
        const logDate = new Date(log.event_at);
        return log.employee_id === employee.id && logDate >= startOfMonth;
      })
      .sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime())
      .map((log) => ({
        id:            log.id,
        eventType:     log.event_type as 'Intrare' | 'Iesire',
        accessMethod:  log.access_method,
        isAuthorized:  log.is_authorized,
        outOfSchedule: log.out_of_schedule,
        eventAt:       log.event_at,
        synced:        log.synced_to_cloud,
      }));
  } else {
    const cached = await getCachedProfile();
    if (!cached?.employeeId) throw new Error('Profil negasit. Reincarcare aplicatie necesara.');
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('access_logs')
      .select('*')
      .eq('employee_id', cached.employeeId)
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
}

export async function getCachedRaport(): Promise<RaportEntry[] | null> {
  const raw = await AsyncStorage.getItem(CACHE.raport);
  return raw ? JSON.parse(raw) : null;
}
