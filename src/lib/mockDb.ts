/**
 * mockDb.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Simulează baza de date Supabase local, cu date realiste.
 * Înlocuiește cu apeluri reale când Supabase e conectat — vezi api.ts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Tipuri (oglindesc exact coloanele din Supabase) ─────────────────────────

export type Division = {
  id: string;
  name: string;
  created_at: string;
};

export type Role = {
  id: string;
  name: string;
  can_view_all: boolean;
  created_at: string;
};

export type User = {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  division_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserRole = {
  user_id: string;
  role_id: string;
};

export type Employee = {
  id: string;
  last_name: string;
  first_name: string;
  cnp: string;
  photo_url: string | null;
  badge_number: string;
  division_id: string;
  bluetooth_security_code: string; // codul unic transmis prin BLE
  car_plate: string | null;
  is_access_active: boolean;
  access_granted_by: string | null;       // uuid → employees.id
  access_granted_by_cnp: string | null;
  access_granted_by_badge: string | null;
  access_granted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Smartphone = {
  id: string;
  employee_id: string;
  puk_code: string;
  registered_at: string;
  is_active: boolean;
};

export type Schedule = {
  id: string;
  employee_id: string;
  day_of_week: number; // 1=Luni … 7=Duminică (ISO)
  time_from: string;   // "HH:MM"
  time_to: string;     // "HH:MM"
  valid_from: string | null;
  valid_to: string | null;
};

export type AccessLog = {
  id: string;
  employee_id: string;
  event_type: 'Intrare' | 'Iesire';
  access_method: 'bluetooth' | 'card' | 'manual';
  is_authorized: boolean;
  out_of_schedule: boolean;
  override_by: string | null; // uuid → employees.id (cine a forțat accesul)
  car_plate_seen: string | null;
  event_at: string;           // ISO timestamp — momentul real
  synced_to_cloud: boolean;
};

// ─── Date mock ───────────────────────────────────────────────────────────────

export const divisions: Division[] = [
  { id: 'div-001', name: 'IT & Infrastructură',   created_at: '2024-01-10T08:00:00Z' },
  { id: 'div-002', name: 'Resurse Umane',          created_at: '2024-01-10T08:00:00Z' },
  { id: 'div-003', name: 'Producție',              created_at: '2024-01-10T08:00:00Z' },
  { id: 'div-004', name: 'Financiar-Contabilitate',created_at: '2024-01-10T08:00:00Z' },
];

export const roles: Role[] = [
  { id: 'role-001', name: 'Admin',    can_view_all: true,  created_at: '2024-01-10T08:00:00Z' },
  { id: 'role-002', name: 'Manager',  can_view_all: true,  created_at: '2024-01-10T08:00:00Z' },
  { id: 'role-003', name: 'Angajat',  can_view_all: false, created_at: '2024-01-10T08:00:00Z' },
];

export const users: User[] = [
  {
    id: 'user-001',
    full_name: 'Mihai Popescu',
    email: 'mihai.popescu@firma.ro',
    password_hash: '$2b$10$hashexemplu',
    division_id: 'div-001',
    is_active: true,
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-15T09:00:00Z',
  },
  {
    id: 'user-002',
    full_name: 'Elena Ionescu',
    email: 'elena.ionescu@firma.ro',
    password_hash: '$2b$10$hashexemplu2',
    division_id: 'div-002',
    is_active: true,
    created_at: '2024-01-15T09:05:00Z',
    updated_at: '2024-01-15T09:05:00Z',
  },
];

export const userRoles: UserRole[] = [
  { user_id: 'user-001', role_id: 'role-001' },
  { user_id: 'user-002', role_id: 'role-003' },
];

export const employees: Employee[] = [
  {
    id: 'emp-001',
    last_name: 'Popescu',
    first_name: 'Mihai',
    cnp: '1900315350042',
    photo_url: null,
    badge_number: 'EMP-20240315',
    division_id: 'div-001',
    bluetooth_security_code: 'BT-A1B2C3D4E5F6A1B2',  // ← codul transmis prin BLE
    car_plate: 'TM-01-ABC',
    is_access_active: true,
    access_granted_by: 'emp-000',
    access_granted_by_cnp: '1750101350010',
    access_granted_by_badge: 'ADM-00001',
    access_granted_at: '2024-03-15T10:00:00Z',
    created_at: '2024-03-15T10:00:00Z',
    updated_at: '2025-01-01T08:00:00Z',
  },
  {
    id: 'emp-002',
    last_name: 'Ionescu',
    first_name: 'Elena',
    cnp: '2850622350018',
    photo_url: null,
    badge_number: 'EMP-20240420',
    division_id: 'div-002',
    bluetooth_security_code: 'BT-F6E5D4C3B2A1F6E5',
    car_plate: null,
    is_access_active: true,
    access_granted_by: 'emp-000',
    access_granted_by_cnp: '1750101350010',
    access_granted_by_badge: 'ADM-00001',
    access_granted_at: '2024-04-20T09:30:00Z',
    created_at: '2024-04-20T09:30:00Z',
    updated_at: '2025-01-01T08:00:00Z',
  },
];

export const smartphones: Smartphone[] = [
  {
    id: 'phone-001',
    employee_id: 'emp-001',
    puk_code: 'PUK-MIHAI-2024-XQ7',
    registered_at: '2024-03-15T10:30:00Z',
    is_active: true,
  },
  {
    id: 'phone-002',
    employee_id: 'emp-002',
    puk_code: 'PUK-ELENA-2024-ZR9',
    registered_at: '2024-04-20T10:00:00Z',
    is_active: true,
  },
];

// Zi săptămână: 1=Lun, 2=Mar, 3=Mie, 4=Joi, 5=Vin
export const schedules: Schedule[] = [
  // emp-001: Luni–Vineri, 08:00–17:00
  { id: 'sch-001', employee_id: 'emp-001', day_of_week: 1, time_from: '08:00', time_to: '17:00', valid_from: '2024-03-15', valid_to: null },
  { id: 'sch-002', employee_id: 'emp-001', day_of_week: 2, time_from: '08:00', time_to: '17:00', valid_from: '2024-03-15', valid_to: null },
  { id: 'sch-003', employee_id: 'emp-001', day_of_week: 3, time_from: '08:00', time_to: '17:00', valid_from: '2024-03-15', valid_to: null },
  { id: 'sch-004', employee_id: 'emp-001', day_of_week: 4, time_from: '08:00', time_to: '17:00', valid_from: '2024-03-15', valid_to: null },
  { id: 'sch-005', employee_id: 'emp-001', day_of_week: 5, time_from: '08:00', time_to: '17:00', valid_from: '2024-03-15', valid_to: null },
  // emp-002: Luni–Vineri, 09:00–18:00
  { id: 'sch-006', employee_id: 'emp-002', day_of_week: 1, time_from: '09:00', time_to: '18:00', valid_from: '2024-04-20', valid_to: null },
  { id: 'sch-007', employee_id: 'emp-002', day_of_week: 2, time_from: '09:00', time_to: '18:00', valid_from: '2024-04-20', valid_to: null },
  { id: 'sch-008', employee_id: 'emp-002', day_of_week: 3, time_from: '09:00', time_to: '18:00', valid_from: '2024-04-20', valid_to: null },
  { id: 'sch-009', employee_id: 'emp-002', day_of_week: 4, time_from: '09:00', time_to: '18:00', valid_from: '2024-04-20', valid_to: null },
  { id: 'sch-010', employee_id: 'emp-002', day_of_week: 5, time_from: '09:00', time_to: '18:00', valid_from: '2024-04-20', valid_to: null },
];

export const accessLogs: AccessLog[] = [
  { id: 'log-001', employee_id: 'emp-001', event_type: 'Intrare', access_method: 'bluetooth', is_authorized: true,  out_of_schedule: false, override_by: null, car_plate_seen: null,       event_at: '2026-05-09T08:14:00Z', synced_to_cloud: true  },
  { id: 'log-002', employee_id: 'emp-001', event_type: 'Iesire',  access_method: 'bluetooth', is_authorized: true,  out_of_schedule: false, override_by: null, car_plate_seen: null,       event_at: '2026-05-09T17:32:00Z', synced_to_cloud: true  },
  { id: 'log-003', employee_id: 'emp-001', event_type: 'Intrare', access_method: 'bluetooth', is_authorized: true,  out_of_schedule: false, override_by: null, car_plate_seen: null,       event_at: '2026-05-08T08:02:00Z', synced_to_cloud: true  },
  { id: 'log-004', employee_id: 'emp-001', event_type: 'Iesire',  access_method: 'bluetooth', is_authorized: true,  out_of_schedule: false, override_by: null, car_plate_seen: null,       event_at: '2026-05-08T17:55:00Z', synced_to_cloud: true  },
  { id: 'log-005', employee_id: 'emp-001', event_type: 'Intrare', access_method: 'bluetooth', is_authorized: true,  out_of_schedule: false, override_by: null, car_plate_seen: null,       event_at: '2026-05-07T08:22:00Z', synced_to_cloud: true  },
  { id: 'log-006', employee_id: 'emp-001', event_type: 'Iesire',  access_method: 'bluetooth', is_authorized: true,  out_of_schedule: false, override_by: null, car_plate_seen: null,       event_at: '2026-05-07T17:10:00Z', synced_to_cloud: true  },
  { id: 'log-007', employee_id: 'emp-001', event_type: 'Intrare', access_method: 'bluetooth', is_authorized: true,  out_of_schedule: false, override_by: null, car_plate_seen: null,       event_at: '2026-05-06T08:05:00Z', synced_to_cloud: true  },
  { id: 'log-008', employee_id: 'emp-001', event_type: 'Iesire',  access_method: 'bluetooth', is_authorized: true,  out_of_schedule: false, override_by: null, car_plate_seen: null,       event_at: '2026-05-06T16:58:00Z', synced_to_cloud: true  },
  // Exemplu: intrare în afara programului (vineri seară)
  { id: 'log-009', employee_id: 'emp-001', event_type: 'Intrare', access_method: 'bluetooth', is_authorized: true,  out_of_schedule: true,  override_by: null, car_plate_seen: null,       event_at: '2026-05-02T19:30:00Z', synced_to_cloud: true  },
  // Exemplu: acces neautorizat
  { id: 'log-010', employee_id: 'emp-001', event_type: 'Intrare', access_method: 'bluetooth', is_authorized: false, out_of_schedule: true,  override_by: null, car_plate_seen: 'TM-99-ZZZ', event_at: '2026-05-01T22:10:00Z', synced_to_cloud: true  },
];