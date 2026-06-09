import { getRaport, type RaportEntry } from '@/lib/api';
import { getRaportCache, saveRaportCache } from '@/lib/localStore';
import { colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' }),
    time: d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
  };
}

function getCurrentMonthLabel() {
  return new Date().toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });
}

export default function RaportScreen() {
  const [entries, setEntries]         = useState<RaportEntry[]>([]);
  const [fromCache, setFromCache]     = useState(false);
  const [loading, setLoading]         = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

 useFocusEffect(
  useCallback(() => {
    const loadData = async () => {
      try {
        const fresh = await getRaport();
        await saveRaportCache(fresh);
        setEntries(fresh);
        setFromCache(false);
        setLastUpdated(new Date().toISOString());
      } catch {
        // Offline sau eroare — fallback la cache silențios
        const cached = await getRaportCache();
        if (cached && cached.data.length > 0) {
          setEntries(cached.data);
          setFromCache(true);
          setLastUpdated(cached.savedAt);
        }
      }
    };
    loadData();
  }, [])
);

  const handleRefresh = async () => {
  setLoading(true);
  try {
    const fresh = await getRaport();
    await saveRaportCache(fresh);
    setEntries(fresh);
    setFromCache(false);
    setLastUpdated(new Date().toISOString());
  } catch (e: any) {
    // Mesaj prietenos în loc de TypeError
    const isOffline =
      e.message?.includes('Network request failed') ||
      e.message?.includes('Failed to fetch') ||
      e.message?.includes('network');

    if (isOffline) {
      // Fallback la cache fără să afișeze eroare
      const cached = await getRaportCache();
      if (cached && cached.data.length > 0) {
        setEntries(cached.data);
        setFromCache(true);
        setLastUpdated(cached.savedAt);
      } else {
        Alert.alert(
          'Fără conexiune',
          'Nu există conexiune la internet. Datele vor fi actualizate când revine conexiunea.'
        );
      }
    } else {
      Alert.alert('Eroare', e.message ?? 'Nu s-a putut actualiza raportul.');
    }
  } finally {
    setLoading(false);
  }
};

  const totalIntrari = entries.filter((e) => e.eventType === 'Intrare').length;
  const totalIesiri  = entries.filter((e) => e.eventType === 'Iesire').length;
  const zileUnice    = new Set(entries.map((e) => new Date(e.eventAt).toDateString())).size;

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerBg}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Raport prezență</Text>
            <Text style={styles.headerSubtitle}>{getCurrentMonthLabel()}</Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshBtn, loading && styles.refreshBtnLoading]}
            onPress={handleRefresh}
            disabled={loading}
            activeOpacity={0.75}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="refresh" size={20} color="#fff" />}
            <Text style={styles.refreshBtnText}>{loading ? 'Se actualizează...' : 'Actualizează'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.badgeRow}>
          {fromCache ? (
            <View style={styles.cacheBadge}>
              <Ionicons name="time-outline" size={13} color="#fff" />
              <Text style={styles.cacheBadgeText}>Date locale{lastUpdated ? ` · ${formatTime(lastUpdated)}` : ''}</Text>
            </View>
          ) : lastUpdated ? (
            <View style={styles.liveBadge}>
              <Ionicons name="cloud-done-outline" size={13} color="#fff" />
              <Text style={styles.liveBadgeText}>Actualizat · {formatTime(lastUpdated)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {entries.length > 0 && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
            <Text style={styles.statNum}>{totalIntrari}</Text>
            <Text style={styles.statLabel}>Intrări</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: colors.danger }]}>
            <Text style={styles.statNum}>{totalIesiri}</Text>
            <Text style={styles.statLabel}>Ieșiri</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
            <Text style={styles.statNum}>{zileUnice}</Text>
            <Text style={styles.statLabel}>Zile</Text>
          </View>
        </View>
      )}

      {entries.length > 0 ? (
        <View style={styles.card}>
          {entries.map((entry, idx) => {
            const { date, time } = formatDateTime(entry.eventAt);
            const isIn = entry.eventType === 'Intrare';
            return (
              <View key={entry.id} style={[styles.item, idx > 0 && styles.itemBorder]}>
                <View style={[styles.dot, { backgroundColor: isIn ? colors.success : colors.danger }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.itemTopRow}>
                    <Text style={styles.itemType}>{entry.eventType}</Text>
                    {!entry.synced && <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>nesincronizat</Text></View>}
                    {entry.outOfSchedule && (
                      <View style={styles.warnBadge}>
                        <Ionicons name="warning-outline" size={10} color="#92400E" />
                        <Text style={styles.warnBadgeText}>Aff. program</Text>
                      </View>
                    )}
                    {!entry.isAuthorized && <View style={styles.dangerBadge}><Text style={styles.dangerBadgeText}>neautorizat</Text></View>}
                  </View>
                  <Text style={styles.itemDetail}>{time} · {entry.accessMethod}</Text>
                </View>
                <Text style={styles.itemDate}>{date}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="bar-chart-outline" size={52} color={colors.border} />
          <Text style={styles.emptyTitle}>Nicio înregistrare</Text>
          <Text style={styles.emptySubtitle}>Apasă „Actualizează" pentru a prelua raportul de la server.</Text>
          <TouchableOpacity style={styles.emptyRefreshBtn} onPress={handleRefresh} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="refresh" size={18} color={colors.primary} />}
            <Text style={styles.emptyRefreshText}>{loading ? 'Se actualizează...' : 'Actualizează raportul'}</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerBg: { backgroundColor: colors.primary, paddingTop: 64, paddingBottom: 20, paddingHorizontal: 20, gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2, textTransform: 'capitalize' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  refreshBtnLoading: { opacity: 0.7 },
  refreshBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  badgeRow: { flexDirection: 'row' },
  cacheBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  cacheBadgeText: { color: '#fff', fontSize: 12 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(16,185,129,0.3)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(16,185,129,0.5)' },
  liveBadgeText: { color: '#fff', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 10, margin: 20, marginBottom: 0 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderLeftWidth: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statNum: { fontSize: 24, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: '500' },
  card: { backgroundColor: colors.surface, margin: 20, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 12 },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  itemType: { fontWeight: '700', fontSize: 15, color: colors.text },
  itemDetail: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },
  itemDate: { fontSize: 13, color: colors.textSecondary, flexShrink: 0 },
  pendingBadge: { backgroundColor: '#E0E7FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  pendingBadgeText: { color: colors.primary, fontSize: 10, fontWeight: '600' },
  warnBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  warnBadgeText: { color: '#92400E', fontSize: 10, fontWeight: '600' },
  dangerBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  dangerBadgeText: { color: '#991B1B', fontSize: 10, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  emptySubtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  emptyRefreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primaryLight },
  emptyRefreshText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});