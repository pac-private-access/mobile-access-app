import { getProfile } from './api';
import { clearAccessQueue, getAccessQueue, saveProfileCache } from './localStore';
import { supabase } from './supabase';

export type SyncResult = {
  eventsSynced:     number;
  profileRefreshed: boolean;
  errors:           string[];
};

let isFlushing = false;

export async function flushAccessQueue(): Promise<number> {
  if (isFlushing) {
    console.log('[Sync] Flush deja în progres, skip.');
    return 0;
  }
  isFlushing = true;

  try {
    const queue = await getAccessQueue();
    if (queue.length === 0) return 0;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validQueue = queue.filter((ev) => uuidRegex.test(ev.employeeId));

    if (validQueue.length === 0) {
      await clearAccessQueue();
      return 0;
    }

    await clearAccessQueue();

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
    if (error) throw new Error(`[Sync] Eroare la flush: ${error.message}`);

    return validQueue.length;
  } finally {
    isFlushing = false;
  }
}

export async function syncProfileCache(): Promise<boolean> {
  try {
    const profile = await getProfile();
    await saveProfileCache(profile);
    console.log('[Sync] Cache profil actualizat.');
    return true;
  } catch (e) {
    console.warn('[Sync] Profil sync eșuat:', e);
    return false;
  }
}

export async function runFullSync(): Promise<SyncResult> {
  const result: SyncResult = { eventsSynced: 0, profileRefreshed: false, errors: [] };

  try {
    result.eventsSynced = await flushAccessQueue();
  } catch (e: any) {
    result.errors.push(`Flush coadă: ${e.message}`);
  }

  try {
    result.profileRefreshed = await syncProfileCache();
  } catch (e: any) {
    result.errors.push(`Sync profil: ${e.message}`);
  }

  return result;
}
