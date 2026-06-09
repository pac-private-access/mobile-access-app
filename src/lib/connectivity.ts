import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { runFullSync, type SyncResult } from './syncService';

let unsubscribe: (() => void) | null = null;
let lastOnlineState: boolean | null = null;
let onSyncCallback: ((result: SyncResult) => void) | null = null;

function isConnected(state: NetInfoState): boolean {
  return !!(state.isConnected && state.isInternetReachable !== false);
}

export function startConnectivityWatcher(
  onSync?: (result: SyncResult) => void
): void {
  if (unsubscribe) return;

  if (onSync) onSyncCallback = onSync;

  unsubscribe = NetInfo.addEventListener(async (state) => {
    const online = isConnected(state);

    if (online && lastOnlineState === false) {
      console.log('[Connectivity] Conexiune restabilită. Se sincronizează...');

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

  console.log('[Connectivity] Watcher pornit.');
}

export function stopConnectivityWatcher(): void {
  unsubscribe?.();
  unsubscribe = null;
  lastOnlineState = null;
  console.log('[Connectivity] Watcher oprit.');
}

export async function checkIsOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return isConnected(state);
}
