import { getCachedProfile, getProfile, type ProfileResult } from '@/lib/api';
import { colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


const AUTH_TOKEN = 'AUTH_TOKEN';

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map((n) => n[0].toUpperCase()).slice(0, 2).join('');
}

export default function ProfilScreen() {
  const [profile, setProfile]     = useState<ProfileResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setLoading(true);
        try {
          const token = await SecureStore.getItemAsync(AUTH_TOKEN);
          if (token) {
            const p = await getProfile();
            setProfile(p);
          } else {
            const cached = await getCachedProfile();
            if (cached) setProfile(cached);
          }
        } catch {
          const cached = await getCachedProfile();
          if (cached) setProfile(cached);
        } finally {
          setLoading(false);
        }
      };
      load();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await getProfile();
      setProfile(fresh);
    } catch (e: any) {
      Alert.alert('Eroare', e.message ?? 'Nu s-a putut actualiza profilul.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Se încarcă profilul...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="person-outline" size={48} color={colors.border} />
        <Text style={styles.loadingText}>Profil indisponibil</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerBg}>
        <View style={styles.avatarLarge}>
  {profile.photoUrl ? (
    <Image
      source={{ uri: profile.photoUrl }}
      style={styles.avatarImage}
      defaultSource={require('@/assets/images/icon.png')}
    />
  ) : (
    <Text style={styles.avatarText}>{getInitials(profile.numeComplet)}</Text>
  )}
</View>
        <Text style={styles.headerName}>{profile.numeComplet}</Text>
        <Text style={styles.headerRole}>{profile.divisie}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} disabled={refreshing}>
          {refreshing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="refresh" size={16} color="#fff" />}
          <Text style={styles.refreshBtnText}>{refreshing ? 'Se actualizează...' : 'Actualizează date'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Date identificare</Text>
      <View style={styles.card}>
        <InfoRow icon="person-outline"   label="Nume complet"      value={profile.numeComplet} />
        <InfoRow icon="card-outline"     label="Număr legitimație" value={profile.badgeNumber} divider />
        <InfoRow icon="business-outline" label="Departament"       value={profile.divisie} divider />
        {profile.carPlate && <InfoRow icon="car-outline" label="Număr auto" value={profile.carPlate} divider />}
      </View>

      <Text style={styles.sectionTitle}>Drepturi de acces</Text>
      <View style={styles.card}>
        <InfoRow icon="time-outline"              label="Orar permis"         value={profile.orarPermis} />
        <InfoRow icon="shield-checkmark-outline"  label="Acces acordat de"    value={profile.acordatDe} divider />
        {profile.acordatDeBadge && <InfoRow icon="card-outline" label="Legitimație acordant" value={profile.acordatDeBadge} divider />}
        {profile.valabilPana    && <InfoRow icon="calendar-outline" label="Valabil până la" value={profile.valabilPana} divider />}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.iconWrap}>
            <Ionicons name={profile.isAccessActive ? 'checkmark-circle' : 'close-circle'} size={20} color={profile.isAccessActive ? colors.success : colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Status acces</Text>
            <Text style={[styles.rowValue, { color: profile.isAccessActive ? colors.success : colors.danger }]}>
              {profile.isAccessActive ? 'Activ' : 'Dezactivat'}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Securitate Bluetooth</Text>
      <View style={styles.card}>
        <View style={styles.btSecurityBox}>
          <View style={styles.btSecurityIcon}>
            <Ionicons name="bluetooth" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.btSecurityTitle}>Cod de securitate BLE</Text>
            <Text style={styles.btSecurityDesc}>
              Codul este unic și atribuit de administrator. Nu poate fi modificat din aplicație.
            </Text>
            <View style={styles.btCodeRow}>
              <Text style={styles.btCode}>
                {profile.bluetoothCode.slice(0, 8)}{'•'.repeat(Math.max(0, profile.bluetoothCode.length - 8))}
              </Text>
              <View style={styles.btLockedBadge}>
                <Ionicons name="lock-closed" size={10} color={colors.primary} />
                <Text style={styles.btLockedText}>Blocat</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Aplicație</Text>
      <View style={styles.card}>
        <View style={styles.appInfoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.appInfoText}>
            Aplicația este instalată exclusiv pe acest dispozitiv și asociată unui singur angajat prin Device ID.
            Nu poate fi transferată fără intervenția administratorului.
          </Text>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, divider = false }: { icon: any; label: string; value: string; divider?: boolean }) {
  return (
    <View style={[styles.row, divider && styles.rowBorder]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarImage: {
  width: 88,
  height: 88,
  borderRadius: 44,
},
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: colors.textSecondary, fontSize: 15 },
  headerBg: { backgroundColor: colors.primary, paddingTop: 70, paddingBottom: 28, alignItems: 'center', gap: 6 },
  avatarLarge: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  headerName: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerRole: { color: 'rgba(255,255,255,0.78)', fontSize: 14 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  refreshBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 8, marginHorizontal: 20 },
  card: { backgroundColor: colors.surface, marginHorizontal: 20, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  iconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  rowValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  btSecurityBox: { flexDirection: 'row', padding: 16, gap: 14, alignItems: 'flex-start' },
  btSecurityIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  btSecurityTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  btSecurityDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  btCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btCode: { fontSize: 13, fontWeight: '600', color: colors.primary, letterSpacing: 1 },
  btLockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  btLockedText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  appInfoBox: { flexDirection: 'row', padding: 16, gap: 12, alignItems: 'flex-start' },
  appInfoText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
});