import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { CannabisLeaf } from '@/components/CannabisLeaf';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useState } from 'react';

/** Mahogany + brushed-brass lockbox chest archive (Days of Old). */
export function StashBox({ dates, selectedDate, onPick, detail }: {
  dates: string[];
  selectedDate: string | null;
  onPick: (d: string) => void;
  detail?: React.ReactNode;
}) {
  const theme = useAppTheme();
  const font = theme.fontFamily;
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.chest}>
      {/* brass corner brackets */}
      <View style={[styles.bracket, styles.tl]}><Text style={{color:'#92400E',fontWeight:'900',fontSize:9}}>▟</Text></View>
      <View style={[styles.bracket, styles.tr]}><Text style={{color:'#92400E',fontWeight:'900',fontSize:9}}>▙</Text></View>
      <View style={[styles.bracket, styles.bl]}><Text style={{color:'#92400E',fontWeight:'900',fontSize:9}}>�28</Text></View>
      <View style={[styles.bracket, styles.br]}><Text style={{color:'#92400E',fontWeight:'900',fontSize:9}}>▞</Text></View>

      <Text style={[styles.title, { fontFamily: font }]}>Stash Box — The Days of Old</Text>
      <Text style={[styles.sub, { fontFamily: font }]}>
        Mahogany archive chest — {dates.length} days sealed inside
      </Text>

      {/* lid seam + brass clasp */}
      <View style={styles.lidSeam}>
        <Pressable style={styles.clasp} onPress={() => setExpanded((e) => !e)} accessibilityLabel="Toggle stash chest">
          <Text style={{ fontWeight: '900', fontSize: 11, color: '#1C1917' }}>🔒 MASTER STASH LATCH</Text>
        </Pressable>
      </View>

      <View style={styles.head}>
        <CannabisLeaf size={22} color="#FDE047" />
        <Pressable onPress={() => setExpanded((e) => !e)} style={styles.btn}>
          <Text style={styles.btnText}>{expanded ? 'Close Chest' : 'Open Chest'}</Text>
        </Pressable>
      </View>

      {expanded && (
        <ScrollView style={styles.chips} showsVerticalScrollIndicator contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
          <View style={styles.chipsGrid}>
            {dates.map((d) => (
              <Pressable
                key={d}
                onPress={() => onPick(d)}
                style={[styles.chip, selectedDate === d && styles.chipActive]}>
                <Text style={[styles.chipText, { fontFamily: font }]}>🫙 {d}</Text>
              </Pressable>
            ))}
          </View>
          {selectedDate && detail}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chest: {
    backgroundColor: '#2A1205', borderWidth: 4, borderColor: '#B45309',
    borderRadius: 20, padding: 16, paddingTop: 20, marginBottom: 36, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.75, shadowRadius: 44, shadowOffset: { width: 0, height: 22 },
    elevation: 18, maxHeight: 760,
  },
  bracket: { position: 'absolute', width: 26, height: 26, borderRadius: 6, backgroundColor: '#D97706', alignItems: 'center', justifyContent: 'center', opacity: 0.9 },
  tl: { top: 6, left: 6 }, tr: { top: 6, right: 6 }, bl: { bottom: 6, left: 6 }, br: { bottom: 6, right: 6 },
  title: { fontSize: 20, fontWeight: '900', color: '#FEF08A' },
  sub: { fontSize: 12, fontStyle: 'italic', color: '#FDE68A', marginTop: 2 },
  lidSeam: { height: 6, backgroundColor: '#F59E0B', marginTop: 14, marginBottom: 16, marginHorizontal: -16, position: 'relative' },
  clasp: {
    position: 'absolute', left: '32%', top: -12,
    backgroundColor: '#FDE047', borderWidth: 2, borderColor: '#FEF08A',
    paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  btn: { backgroundColor: '#D97706', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#FDE047' },
  btnText: { fontWeight: '800', fontSize: 13, color: '#1C1917' },
  chips: { flex: 1, maxHeight: 520, marginTop: 6 },
  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#D97706', backgroundColor: 'rgba(0,0,0,0.5)' },
  chipActive: { backgroundColor: '#D97706' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#FEF3C7' },
});
