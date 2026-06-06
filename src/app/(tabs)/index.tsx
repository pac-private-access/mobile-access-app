import { getCachedProfile, getProfile, getRaport, type ProfileResult, type RaportEntry } from '@/lib/api';
import { disableBluetooth, enableBluetooth, isBluetoothReady, transmitSecurityCode } from '@/lib/bluetooth';
import { checkIsOnline } from '@/lib/connectivity';
import { enqueueAccessEvent, getQueueCount, getRaportCache, saveRaportCache } from '@/lib/localStore';
import { flushAccessQueue } from '@/lib/syncService';
import { colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Image,
  ScrollView, StyleSheet,
  Text, TouchableOpacity, View
} from 'react-native';

const AUTH_TOKEN = 'AUTH_TOKEN';

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map((n) => n[0].toUpperCase()).slice(0, 2).join('');
}

function formatLastAccess(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const isToday = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  return isToday ? `Azi, ${time}` : `${d.toLocaleDateString('ro-RO')}, ${time}`;
}

export default function AccesScreen() {
  const [profile, setProfile]             = useState<ProfileResult | null>(null);
  const [btEnabled, setBtEnabled]         = useState(false);
  const [togglingBt, setTogglingBt]       = useState(false);
  const [transmitting, setTransmitting]   = useState(false);
  const [pendingCount, setPendingCount]   = useState(0);
  const [lastAccess, setLastAccess]       = useState<string | null>(null);
  const [statusMsg, setStatusMsg]         = useState<string | null>(null);
  const [nextEventType, setNextEventType] = useState<'Intrare' | 'Iesire'>('Intrare');

  const showStatus = (msg: string, duration = 4000) => {
  setStatusMsg(msg);
  setTimeout(() => setStatusMsg(null), duration);
};

  useEffect(() => {
  const init = async () => {
    try {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN);
      if (token) {
        const p = await getProfile();
        setProfile(p);
      }
    } catch {
      const cached = await getCachedProfile();
      if (cached) setProfile(cached);
    }

    setBtEnabled(await isBluetoothReady());
    setPendingCount(await getQueueCount());

    const cached = await getRaportCache();
    if (cached && cached.data.length > 0) {
      const last = cached.data[0].eventType;
      setNextEventType(last === 'Intrare' ? 'Iesire' : 'Intrare');
      
      setLastAccess(cached.data[0].eventAt);
    }
  };
  init();
}, []);

  useFocusEffect(
  useCallback(() => {
    const refresh = async () => {
      const count = await getQueueCount();
      setPendingCount(count);

      // Actualizează ultimul acces
      const cached = await getRaportCache();
      if (cached && cached.data.length > 0) {
        setLastAccess(cached.data[0].eventAt);
        const last = cached.data[0].eventType;
        setNextEventType(last === 'Intrare' ? 'Iesire' : 'Intrare');
      }
    };
    refresh();
  }, [])
);

  const handleToggleBluetooth = async () => {
  setTogglingBt(true);
  setStatusMsg(null);
  try {
    if (btEnabled) {
      await disableBluetooth();
      setBtEnabled(false);
      setStatusMsg('Bluetooth dezactivat');
    } else {
      const success = await enableBluetooth();
      // Verifică starea reală după enable
      const nowReady = await isBluetoothReady();
      setBtEnabled(nowReady);
      setStatusMsg(
        nowReady
          ? 'Bluetooth activat ✓'
          : 'Nu s-a putut activa Bluetooth'
      );
    }
  } catch (e: any) {
    Alert.alert('Eroare', e.message);
  } finally {
    setTogglingBt(false);
  }
};

 const handleOpenBarrier = async () => {
  if (transmitting || !profile) return;
  if (!btEnabled) {
    Alert.alert('Bluetooth inactiv', 'Activează Bluetooth înainte de a acționa bariera.');
    return;
  }

  setTransmitting(true);
  setStatusMsg(null);

  try {
    const result = await transmitSecurityCode(profile.bluetoothCode);
    if (!result.success) {
      Alert.alert('Eroare', result.error);
      return;
    }

    const existingRaport = await getRaportCache();
    const currentEntries = existingRaport?.data ?? [];
    const lastEventType  = currentEntries.length > 0 ? currentEntries[0].eventType : null;
    const eventType: 'Intrare' | 'Iesire' = lastEventType === 'Intrare' ? 'Iesire' : 'Intrare';
    const now = new Date();

    const event = {
      localId:       await Crypto.randomUUID(),
      employeeId:    profile.employeeId,
      eventType,
      accessMethod:  'bluetooth_esp32' as const,
      eventAt:       now.toISOString(),
      outOfSchedule: false,
      isAuthorized:  true,
    };

    await enqueueAccessEvent(event);
    setLastAccess(now.toISOString());

    const next: 'Intrare' | 'Iesire' = eventType === 'Intrare' ? 'Iesire' : 'Intrare';
    setNextEventType(next);

    const online = await checkIsOnline();
    if (online) {
      try {
        await flushAccessQueue();
        // Supabase are deja evenimentul — preia fresh fără să mai adaugi local
        const freshEntries = await getRaport();
        await saveRaportCache(freshEntries);
        setPendingCount(0);
        showStatus(`${eventType === 'Intrare' ? 'Intrare' : 'Ieșire'} înregistrată și sincronizată ✓`);
      } catch (syncErr: any) {
        const isOffline =
          syncErr.message?.includes('Network request failed') ||
          syncErr.message?.includes('Failed to fetch');

        if (isOffline) {
          // A pierdut internetul între timp — salvează local
          const newEntry: RaportEntry = {
            id:            event.localId,
            eventType,
            accessMethod:  event.accessMethod,
            isAuthorized:  event.isAuthorized,
            outOfSchedule: event.outOfSchedule,
            eventAt:       event.eventAt,
            synced:        false,
          };
          await saveRaportCache([newEntry, ...currentEntries]);
          const count = await getQueueCount();
          setPendingCount(count);
          showStatus(`${eventType === 'Intrare' ? 'Intrare' : 'Ieșire'} salvată local (fără internet)`);
        } else {
          throw syncErr;
        }
      }
    } else {
      // Offline — salvează doar local, NU trimite la Supabase
      const newEntry: RaportEntry = {
        id:            event.localId,
        eventType,
        accessMethod:  event.accessMethod,
        isAuthorized:  event.isAuthorized,
        outOfSchedule: event.outOfSchedule,
        eventAt:       event.eventAt,
        synced:        false,
      };
      await saveRaportCache([newEntry, ...currentEntries]);
      const count = await getQueueCount();
      setPendingCount(count);  // ← actualizează badge imediat
      showStatus(`${eventType === 'Intrare' ? 'Intrare' : 'Ieșire'} salvată local (fără internet)`);
    }

  } catch (e: any) {
    Alert.alert('Eroare', e.message);
  } finally {
    setTransmitting(false);
  }
};

  const isPrezent = nextEventType === 'Iesire';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bun venit,</Text>
          <Text style={styles.name}>{profile?.numeComplet ?? '...'}</Text>
        </View>
        <View style={styles.avatar}>
  {profile?.photoUrl ? (
    <Image
      source={{ uri: profile.photoUrl }}
      style={styles.avatarSmall}
    />
  ) : (
    <Text style={styles.avatarText}>
      {profile ? getInitials(profile.numeComplet) : '?'}
    </Text>
  )}
</View>
      </View>

      <View style={[styles.checkOuter, isPrezent ? styles.checkOuterPresent : styles.checkOuterAway]}>
        <View style={[styles.checkInner, isPrezent ? styles.checkInnerPresent : styles.checkInnerAway]}>
          {transmitting
            ? <ActivityIndicator size="large" color="#fff" />
            : <Ionicons name={isPrezent ? 'checkmark' : 'home-outline'} size={72} color="#fff" />}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btBtn, btEnabled ? styles.btBtnOn : styles.btBtnOff]}
        onPress={handleToggleBluetooth}
        disabled={togglingBt}
      >
        {togglingBt
          ? <ActivityIndicator size="small" color={btEnabled ? colors.primary : '#fff'} />
          : <Ionicons name="bluetooth" size={18} color={btEnabled ? colors.primary : '#fff'} />}
        <Text style={[styles.btBtnText, btEnabled ? styles.btBtnTextOn : styles.btBtnTextOff]}>
          {togglingBt
            ? (btEnabled ? 'Se dezactivează...' : 'Se activează...')
            : (btEnabled ? 'Bluetooth activ' : 'Activează Bluetooth')}
        </Text>
        <View style={[styles.btDot, { backgroundColor: btEnabled ? colors.success : colors.danger }]} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.barrierBtn,
          nextEventType === 'Intrare' ? styles.barrierBtnEnter : styles.barrierBtnExit,
          (!btEnabled || transmitting || !profile?.isAccessActive) && styles.barrierBtnDisabled,
        ]}
        onPress={handleOpenBarrier}
        disabled={!btEnabled || transmitting || !profile?.isAccessActive}
      >
        {transmitting
          ? <ActivityIndicator size="small" color="#fff" />
          : <Ionicons name={nextEventType === 'Intrare' ? 'log-in-outline' : 'log-out-outline'} size={20} color="#fff" />}
        <Text style={styles.barrierBtnText}>
          {transmitting ? 'Se acționează...'
            : nextEventType === 'Intrare' ? 'Înregistrează Intrare' : 'Înregistrează Ieșire'}
        </Text>
      </TouchableOpacity>

      {statusMsg && (
        <Text style={[
          styles.statusMsg,
          statusMsg.includes('fără internet') || statusMsg.includes('Setări') ? styles.statusWarn : styles.statusOk,
        ]}>
          {statusMsg}
        </Text>
      )}

      <Text style={styles.hint}>Apropiați-vă de punctul de acces</Text>

      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Ultimul acces</Text>
          <Text style={styles.cardValue}>{formatLastAccess(lastAccess)}</Text>
        </View>
        <View style={[styles.cardRow, styles.cardRowBorder]}>
          <Text style={styles.cardLabel}>Status</Text>
          <View style={isPrezent ? styles.badgeGreen : styles.badgeGray}>
            <Text style={[styles.badgeText, { color: isPrezent ? '#059669' : colors.textSecondary }]}>
              {isPrezent ? 'Prezent' : 'Plecat'}
            </Text>
          </View>
        </View>
        {pendingCount > 0 && (
          <View style={[styles.cardRow, styles.cardRowBorder]}>
            <Text style={styles.cardLabel}>Nesincronizate</Text>
            <View style={styles.badgeOrange}>
              <Text style={styles.badgeOrangeText}>{pendingCount} local</Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatarSmall: {
  width: 50,
  height: 50,
  borderRadius: 25,
},
  container: { flex: 1, backgroundColor: colors.background },
  content:   { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 40, alignItems: 'center' },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 44 },
  greeting:  { fontSize: 16, color: colors.textSecondary },
  name:      { fontSize: 22, fontWeight: 'bold', color: colors.text },
  avatar:    { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText:{ color: '#fff', fontWeight: 'bold', fontSize: 16 },
  checkOuter:{ width: 168, height: 168, borderRadius: 84, borderWidth: 7, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  checkOuterPresent: { borderColor: colors.success },
  checkOuterAway:    { borderColor: colors.primary },
  checkInner:{ width: 136, height: 136, borderRadius: 68, justifyContent: 'center', alignItems: 'center' },
  checkInnerPresent: { backgroundColor: colors.success },
  checkInnerAway:    { backgroundColor: colors.primary },
  btBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 24, marginBottom: 12, width: '100%', justifyContent: 'center' },
  btBtnOn:   { backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary },
  btBtnOff:  { backgroundColor: colors.primary },
  btBtnText: { fontWeight: '600', fontSize: 15 },
  btBtnTextOn:  { color: colors.primary },
  btBtnTextOff: { color: '#fff' },
  btDot:     { width: 8, height: 8, borderRadius: 4, position: 'absolute', right: 18 },
  barrierBtn:{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, marginBottom: 12, width: '100%', justifyContent: 'center' },
  barrierBtnEnter:    { backgroundColor: colors.success },
  barrierBtnExit:     { backgroundColor: colors.danger },
  barrierBtnDisabled: { opacity: 0.4 },
  barrierBtnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  statusMsg: { fontSize: 13, marginBottom: 8, fontWeight: '500' },
  statusOk:  { color: colors.success },
  statusWarn:{ color: '#F59E0B' },
  hint:      { color: colors.textSecondary, fontSize: 14, marginBottom: 32 },
  card:      { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  cardRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  cardRowBorder:   { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 14, paddingTop: 14 },
  cardLabel: { fontSize: 15, color: colors.textSecondary },
  cardValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  badgeGreen:{ backgroundColor: '#D1FAE5', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12 },
  badgeGray: { backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12 },
  badgeOrange:     { backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12 },
  badgeText: { fontWeight: '700', fontSize: 13 },
  badgeOrangeText: { color: '#92400E', fontWeight: '700', fontSize: 13 },
});