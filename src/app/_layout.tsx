import { startConnectivityWatcher } from '@/lib/connectivity';
import type { SyncResult } from '@/lib/syncService';
import { colors } from '@/styles/global';
import { router, Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const DEVICE_ID_KEY = 'PRIVATE_DEVICE_ID';
const AUTH_TOKEN    = 'AUTH_TOKEN';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [destination, setDestination] = useState<'login' | 'tabs' | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
        const token    = await SecureStore.getItemAsync(AUTH_TOKEN);
        if (!deviceId || !token) {
          setDestination('login');
        } else {
          setDestination('tabs');
        }
      } catch {
        setDestination('login');
      }

      try {
        startConnectivityWatcher((result: SyncResult) => {
          if (result.eventsSynced > 0) {
            console.log(`[App] Sync automat: ${result.eventsSynced} event(e) trimise.`);
          }
        });
      } catch (e) {
        console.warn('[Layout] Connectivity error:', e);
      }

      setReady(true);
    };

    const timeout = setTimeout(() => {
      setDestination('login');
      setReady(true);
    }, 5000);

    init().finally(() => clearTimeout(timeout));
  }, []);

  useEffect(() => {
    if (!ready || !destination) return;
    if (destination === 'login') {
      router.replace('/login' as any);
    }
  }, [ready, destination]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
      </Stack>
    </SafeAreaProvider>
  );
}
