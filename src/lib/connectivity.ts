/**
 * connectivity.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Monitorizează starea conexiunii la internet.
 * La reconectare → declanșează automat sincronizarea completă.
 *
 * Folosit în _layout.tsx (pornit o singură dată la mount).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { runFullSync, type SyncResult } from './syncService';

// ─── State intern ────────────────────────────────────────────────────────────
let unsubscribe: (() => void) | null = null;
let lastOnlineState: boolean | null = null;  // evităm trigger duplicat
let onSyncCallback: ((result: SyncResult) => void) | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isConnected(state: NetInfoState): boolean {
  return !!(state.isConnected && state.isInternetReachable !== false);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  API PUBLIC
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pornește monitorizarea conexiunii.
 * Apelat o singură dată din _layout.tsx la montarea aplicației.
 *
 * @param onSync - callback opțional apelat după fiecare sync reușit
 *                 (util pentru toast-uri sau badge updates în UI)
 */
export function startConnectivityWatcher(
  onSync?: (result: SyncResult) => void
): void {
  if (unsubscribe) return; // deja pornit

  if (onSync) onSyncCallback = onSync;

  unsubscribe = NetInfo.addEventListener(async (state) => {
    const online = isConnected(state);

    // Declanșăm sync doar la tranziția offline → online
    if (online && lastOnlineState === false) {
      console.log('[Connectivity] Conexiune restabilită. Se sincronizează...');

      try {
        const result = await runFullSync();

        if (result.eventsSynced > 0) {
          console.log(`[Connectivity] Sync complet: ${result.eventsSynced} event(e) trimise.`);
        }
        if (result.errors.length > 0) {
          console.warn('[Connectivity] Erori sync:', result.errors);
        }

        onSyncCallback?.(result);
      } catch (e) {
        console.warn('[Connectivity] Sync eșuat:', e);
      }
    }

    lastOnlineState = online;
  });

  console.log('[Connectivity] Watcher pornit.');
}

/**
 * Oprește monitorizarea (apelat la unmount dacă e nevoie, opțional).
 */
export function stopConnectivityWatcher(): void {
  unsubscribe?.();
  unsubscribe = null;
  lastOnlineState = null;
  console.log('[Connectivity] Watcher oprit.');
}

/**
 * Verifică starea curentă a conexiunii (snapshot, nu live).
 */
export async function checkIsOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return isConnected(state);
}

unsubscribe = NetInfo.addEventListener(async (state) => {
  const online = isConnected(state);

  if (online && lastOnlineState === false) {
    console.log('[Connectivity] Conexiune restabilită. Se sincronizează...');

    // Delay de 2 secunde — lasă handleOpenBarrier să termine flush-ul său
    await new Promise((res) => setTimeout(res, 2000));

    try {
      const result = await runFullSync();
      if (result.eventsSynced > 0) {
        console.log(`[Connectivity] Sync: ${result.eventsSynced} event(e) trimise.`);
      }
      onSyncCallback?.(result);
    } catch (e) {
      console.warn('[Connectivity] Sync eșuat:', e);
    }
  }

  lastOnlineState = online;
});