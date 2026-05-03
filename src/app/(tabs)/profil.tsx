import { colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const profileData = [
  { icon: 'person-outline',           label: 'Nume complet',    value: 'Nume Angajat' },
  { icon: 'card-outline',             label: 'Cod angajat',     value: 'EMP-20240315' },
  { icon: 'business-outline',         label: 'Departament',     value: 'IT & Infrastructură' },
  { icon: 'time-outline',             label: 'Orar permis',     value: 'Lun–Vin, 08:00–17:00' },
  { icon: 'shield-checkmark-outline', label: 'Acces acordat de',value: 'Administrator Sistem' },
  { icon: 'calendar-outline',         label: 'Valabil până la', value: '31 Decembrie 2026' },
];

export default function ProfilScreen() {
  return (
    <ScrollView style={styles.container}>
      {/* Header albastru */}
      <View style={styles.headerBg}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>NA</Text>
        </View>
        <Text style={styles.headerName}>Nume Angajat</Text>
        <Text style={styles.headerRole}>IT & Infrastructură</Text>
      </View>

      {/* Card cu date */}
      <View style={styles.card}>
        {profileData.map((item, idx) => (
          <View
            key={idx}
            style={[styles.row, idx > 0 && styles.rowBorder]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon as any} size={20} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowValue}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerBg: {
    backgroundColor: colors.primary,
    paddingTop: 70,
    paddingBottom: 32,
    alignItems: 'center',
  },
  avatarLarge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  headerName: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerRole: { color: 'rgba(255,255,255,0.78)', fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  rowValue: { fontSize: 15, fontWeight: '600', color: colors.text },
});