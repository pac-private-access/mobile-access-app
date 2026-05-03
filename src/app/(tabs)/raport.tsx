import { colors } from '@/styles/global';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Entry = {
  type: 'Intrare' | 'Ieșire';
  time: string;
  gate: string;
  date: string;
};

const raportData: Entry[] = [
  { type: 'Intrare', time: '08:14', gate: 'Poarta principală', date: '01 Apr' },
  { type: 'Ieșire',  time: '17:32', gate: 'Poarta principală', date: '01 Apr' },
  { type: 'Intrare', time: '08:02', gate: 'Poarta principală', date: '31 Mar' },
  { type: 'Ieșire',  time: '17:55', gate: 'Poarta principală', date: '31 Mar' },
  { type: 'Intrare', time: '08:22', gate: 'Poarta principală', date: '30 Mar' },
  { type: 'Ieșire',  time: '17:10', gate: 'Poarta principală', date: '30 Mar' },
  { type: 'Intrare', time: '08:05', gate: 'Poarta principală', date: '29 Mar' },
  { type: 'Ieșire',  time: '16:58', gate: 'Poarta principală', date: '29 Mar' },
];

export default function RaportScreen() {
  return (
    <ScrollView style={styles.container}>
      {/* Header albastru */}
      <View style={styles.headerBg}>
        <Text style={styles.headerTitle}>Raport prezență</Text>
        <Text style={styles.headerSubtitle}>Aprilie 2026</Text>
      </View>

      {/* Lista intrări/ieșiri */}
      <View style={styles.card}>
        {raportData.map((entry, idx) => (
          <View
            key={idx}
            style={[styles.item, idx > 0 && styles.itemBorder]}
          >
            <View style={styles.itemLeft}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      entry.type === 'Intrare'
                        ? colors.success
                        : colors.danger,
                  },
                ]}
              />
              <View>
                <Text style={styles.itemType}>{entry.type}</Text>
                <Text style={styles.itemDetail}>
                  {entry.time} — {entry.gate}
                </Text>
              </View>
            </View>
            <Text style={styles.itemDate}>{entry.date}</Text>
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
    paddingTop: 64,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    marginTop: 4,
  },
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
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  itemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemType: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.text,
  },
  itemDetail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemDate: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});