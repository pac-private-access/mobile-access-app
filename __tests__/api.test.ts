// __tests__/api.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
    enqueueEvent,
    flushQueue,
    getCachedProfile,
    getCachedRaport,
    getProfile,
    getRaport,
    type ProfileResult,
    type RaportEntry,
} from '../src/lib/api';
import { supabase } from '../src/lib/supabase';

// ─── Mock-uri ──────────────────────────────────────────────────────────────
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem:    jest.fn(),
  setItem:    jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

// ─── Date mock ────────────────────────────────────────────────────────────
const mockEmployee = {
  id:                      '672898fd-19d9-4364-ae64-f1542cfadaa4',
  first_name:              'Mihai',
  last_name:               'Popescu',
  badge_number:            'EMP-001',
  cnp:                     '1900315350042',
  is_access_active:        true,
  car_plate:               null,
  bluetooth_security_code: 'BT-A1B2C3D4E5F6A1B2',
  photo_url:               null,
  access_granted_by_badge: null,
  divisions:               { name: 'IT' },
  schedules: [
    { day_of_week: 1, time_from: '08:00', time_to: '17:00', valid_from: null, valid_to: null },
    { day_of_week: 2, time_from: '08:00', time_to: '17:00', valid_from: null, valid_to: null },
  ],
};

const mockProfile: ProfileResult = {
  employeeId:     '672898fd-19d9-4364-ae64-f1542cfadaa4',
  numeComplet:    'Mihai Popescu',
  badgeNumber:    'EMP-001',
  cnp:            '1900315350042',
  divisie:        'IT',
  orarPermis:     'Lun, Mar 08:00-17:00',
  acordatDe:      'Administrator',
  acordatDeBadge: null,
  valabilPana:    null,
  isAccessActive: true,
  carPlate:       null,
  bluetoothCode:  'BT-A1B2C3D4E5F6A1B2',
  photoUrl:       null,
};

const mockLogs = [
  {
    id:              'log-001',
    event_type:      'entry',
    access_method:   'bluetooth_pc',
    is_authorized:   true,
    out_of_schedule: false,
    event_at:        '2026-06-10T08:00:00Z',
    synced_to_cloud: true,
    employee_id:     '672898fd-19d9-4364-ae64-f1542cfadaa4',
  },
  {
    id:              'log-002',
    event_type:      'exit',
    access_method:   'bluetooth_pc',
    is_authorized:   true,
    out_of_schedule: false,
    event_at:        '2026-06-10T17:00:00Z',
    synced_to_cloud: true,
    employee_id:     '672898fd-19d9-4364-ae64-f1542cfadaa4',
  },
];

// ─── Helper mock Supabase chain ────────────────────────────────────────────
function mockSupabaseChain(returnValue: any) {
  const chain = {
    select:  jest.fn().mockReturnThis(),
    eq:      jest.fn().mockReturnThis(),
    single:  jest.fn().mockResolvedValue(returnValue),
    gte:     jest.fn().mockReturnThis(),
    order:   jest.fn().mockResolvedValue(returnValue),
    insert:  jest.fn().mockResolvedValue(returnValue),
    update:  jest.fn().mockReturnThis(),
  };
  (supabase.from as jest.Mock).mockReturnValue(chain);
  return chain;
}

// ══════════════════════════════════════════════════════════════════════════════
//  TESTE getProfile
// ══════════════════════════════════════════════════════════════════════════════
describe('getProfile', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returnează profil când dispozitivul e aprobat', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('DEVICE123');

    const chain = {
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      single: jest.fn()
        .mockResolvedValueOnce({ data: { employee_id: mockEmployee.id, is_active: true }, error: null })
        .mockResolvedValueOnce({ data: mockEmployee, error: null }),
      gte:    jest.fn().mockReturnThis(),
      order:  jest.fn().mockReturnThis(),
    };
    (supabase.from as jest.Mock).mockReturnValue(chain);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    const result = await getProfile();

    expect(result.numeComplet).toBe('Mihai Popescu');
    expect(result.badgeNumber).toBe('EMP-001');
    expect(result.isAccessActive).toBe(true);
    expect(result.divisie).toBe('IT');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'CACHE_PROFILE_V2',
      expect.any(String)
    );
  });

  test('aruncă eroare când device ID lipsește', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    await expect(getProfile()).rejects.toThrow('Device ID negăsit');
  });

  test('aruncă eroare când dispozitivul nu e aprobat', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('DEVICE123');

    const chain = {
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data:  { employee_id: mockEmployee.id, is_active: false },
        error: null,
      }),
    };
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(getProfile()).rejects.toThrow('Dispozitiv neaprobat');
  });

  test('aruncă eroare când dispozitivul nu e înregistrat', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('DEVICE123');

    const chain = {
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    };
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(getProfile()).rejects.toThrow('Dispozitiv neînregistrat');
  });

  test('construiește orarul corect din schedules', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('DEVICE123');

    const chain = {
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      single: jest.fn()
        .mockResolvedValueOnce({ data: { employee_id: mockEmployee.id, is_active: true }, error: null })
        .mockResolvedValueOnce({ data: mockEmployee, error: null }),
    };
    (supabase.from as jest.Mock).mockReturnValue(chain);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    const result = await getProfile();

    expect(result.orarPermis).toContain('08:00-17:00');
    expect(result.orarPermis).toContain('Lun');
    expect(result.orarPermis).toContain('Mar');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  TESTE getCachedProfile
// ══════════════════════════════════════════════════════════════════════════════
describe('getCachedProfile', () => {

  test('returnează profilul din cache când există', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(mockProfile)
    );

    const result = await getCachedProfile();

    expect(result).toEqual(mockProfile);
    expect(result?.numeComplet).toBe('Mihai Popescu');
  });

  test('returnează null când cache-ul e gol', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const result = await getCachedProfile();

    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  TESTE getRaport
// ══════════════════════════════════════════════════════════════════════════════
describe('getRaport', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(mockProfile)
    );
  });

  test('returnează raportul formatat corect', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      gte:    jest.fn().mockReturnThis(),
      order:  jest.fn().mockResolvedValue({ data: mockLogs, error: null }),
    };
    (supabase.from as jest.Mock).mockReturnValue(chain);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    const result = await getRaport();

    expect(result).toHaveLength(2);
    expect(result[0].eventType).toBe('Intrare');
    expect(result[1].eventType).toBe('Iesire');
    expect(result[0].isAuthorized).toBe(true);
    expect(result[0].synced).toBe(true);
  });

  test('salvează raportul în cache după fetch', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      gte:    jest.fn().mockReturnThis(),
      order:  jest.fn().mockResolvedValue({ data: mockLogs, error: null }),
    };
    (supabase.from as jest.Mock).mockReturnValue(chain);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    await getRaport();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'CACHE_RAPORT_V2',
      expect.any(String)
    );
  });

  test('aruncă eroare când profilul lipsește din cache', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    await expect(getRaport()).rejects.toThrow('Profil negăsit');
  });

  test('aruncă eroare la eroare Supabase', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      gte:    jest.fn().mockReturnThis(),
      order:  jest.fn().mockResolvedValue({
        data:  null,
        error: { message: 'DB connection failed' },
      }),
    };
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(getRaport()).rejects.toThrow('DB connection failed');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  TESTE getCachedRaport
// ═══════════════════════════════════════════════════════════════════════npm═══════
describe('getCachedRaport', () => {

  const mockRaportEntries: RaportEntry[] = [
    {
      id:            'log-001',
      eventType:     'Intrare',
      accessMethod:  'bluetooth_pc',
      isAuthorized:  true,
      outOfSchedule: false,
      eventAt:       '2026-06-10T08:00:00Z',
      synced:        true,
    },
  ];

  test('returnează raportul din cache când există', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(mockRaportEntries)
    );

    const result = await getCachedRaport();

    expect(result).toEqual(mockRaportEntries);
    expect(result?.[0].eventType).toBe('Intrare');
  });

  test('returnează null când cache-ul e gol', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const result = await getCachedRaport();

    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  TESTE enqueueEvent + flushQueue
// ══════════════════════════════════════════════════════════════════════════════
describe('enqueueEvent', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('adaugă evenimentul în coadă', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    await enqueueEvent({
      localId:       'local-001',
      employeeId:    '672898fd-19d9-4364-ae64-f1542cfadaa4',
      eventType:     'Intrare',
      accessMethod:  'bluetooth_pc',
      eventAt:       '2026-06-10T08:00:00Z',
      outOfSchedule: false,
      isAuthorized:  true,
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'OFFLINE_QUEUE_V2',
      expect.stringContaining('local-001')
    );
  });

  test('adaugă la coada existentă', async () => {
    const existingQueue = JSON.stringify([{
      localId:    'existing-001',
      employeeId: '672898fd-19d9-4364-ae64-f1542cfadaa4',
      eventType:  'Intrare',
    }]);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(existingQueue);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    await enqueueEvent({
      localId:       'new-002',
      employeeId:    '672898fd-19d9-4364-ae64-f1542cfadaa4',
      eventType:     'Iesire',
      accessMethod:  'bluetooth_pc',
      eventAt:       '2026-06-10T17:00:00Z',
      outOfSchedule: false,
      isAuthorized:  true,
    });

    const savedData = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    const parsed = JSON.parse(savedData);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].localId).toBe('new-002');
  });
});

describe('flushQueue', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returnează 0 când coada e goală', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const result = await flushQueue();

    expect(result).toBe(0);
  });

  test('inserează evenimentele în Supabase și golește coada', async () => {
    const queue = JSON.stringify([{
      localId:       'local-001',
      employeeId:    '672898fd-19d9-4364-ae64-f1542cfadaa4',
      eventType:     'Intrare',
      accessMethod:  'bluetooth_pc',
      eventAt:       '2026-06-10T08:00:00Z',
      outOfSchedule: false,
      isAuthorized:  true,
    }]);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(queue);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    const chain = {
      insert: jest.fn().mockResolvedValue({ error: null }),
    };
    (supabase.from as jest.Mock).mockReturnValue(chain);

    const result = await flushQueue();

    expect(result).toBe(1);
    expect(chain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          event_type:    'entry',
          access_method: 'bluetooth_pc',
          is_authorized: true,
        }),
      ])
    );
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('OFFLINE_QUEUE_V2');
  });

  test('ignoră evenimentele cu employeeId invalid', async () => {
    const queue = JSON.stringify([{
      localId:       'local-bad',
      employeeId:    'invalid-id',
      eventType:     'Intrare',
      accessMethod:  'bluetooth_pc',
      eventAt:       '2026-06-10T08:00:00Z',
      outOfSchedule: false,
      isAuthorized:  true,
    }]);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(queue);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    const result = await flushQueue();

    expect(result).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('aruncă eroare la eroare Supabase', async () => {
    const queue = JSON.stringify([{
      localId:       'local-001',
      employeeId:    '672898fd-19d9-4364-ae64-f1542cfadaa4',
      eventType:     'Intrare',
      accessMethod:  'bluetooth_pc',
      eventAt:       '2026-06-10T08:00:00Z',
      outOfSchedule: false,
      isAuthorized:  true,
    }]);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(queue);

    const chain = {
      insert: jest.fn().mockResolvedValue({ error: { message: 'Insert failed' } }),
    };
    (supabase.from as jest.Mock).mockReturnValue(chain);

    await expect(flushQueue()).rejects.toThrow('Insert failed');
  });
});