import { colors } from '@/styles/global';
import { Ionicons } from '@expo/vector-icons';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AccesScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Header cu salut și avatar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bun venit,</Text>
          <Text style={styles.name}>Nume Angajat</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>NA</Text>
        </View>
      </View>

      {/* Cerc mare cu bifă */}
      <View style={styles.checkOuter}>
        <View style={styles.checkInner}>
          <Ionicons name="checkmark" size={72} color="#fff" />
        </View>
      </View>

      {/* Buton Bluetooth */}
      <TouchableOpacity style={styles.bluetoothBtn}>
        <Ionicons name="bluetooth" size={16} color={colors.primary} />
        <Text style={styles.bluetoothText}>Bluetooth activ</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>Apropiați-vă de punctul de acces</Text>

      {/* Card info */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Ultimul acces</Text>
          <Text style={styles.cardValue}>Azi, 08:14</Text>
        </View>
        <View style={[styles.cardRow, styles.cardRowBorder]}>
          <Text style={styles.cardLabel}>Status</Text>
          <View style={styles.badgeGreen}>
            <Text style={styles.badgeText}>Prezent</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 44,
  },
  greeting: { fontSize: 16, color: colors.textSecondary },
  name: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  checkOuter: {
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 7,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  checkInner: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bluetoothBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginBottom: 10,
  },
  bluetoothText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  cardRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 14,
  },
  cardLabel: { fontSize: 15, color: colors.textSecondary },
  cardValue: { fontSize: 15, fontWeight: '600', color: colors.text },
  badgeGreen: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: { color: '#059669', fontWeight: '700', fontSize: 13 },
});