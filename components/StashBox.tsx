import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { CannabisLeaf, LeafBorder } from '@/components/CannabisLeaf';
import { useAppTheme } from '@/hooks/useAppTheme';
import { loadBadges, StrainBadge } from '@/components/Mode420';
import { useEffect, useState } from 'react';

/** Frosted-glass stash jar archive placed on The Days of Old under the quote. */
export function StashBox({ dates, selectedDate, onPick, detail }: {
  dates: string[];
  selectedDate: string | null;
  onPick: (d: string) => void;
  detail?: React.ReactNode;
}) {
  const theme = useAppTheme();
  const font = theme.fontFamily;
  const [badges, setBadges] = useState<StrainBadge[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    void loadBadges(dates.length).then(setBadges);
  }, [dates.length]);

  return (
    <View style={[styles.jar, theme.cardStyle]}>
      <LeafBorder color={theme.leafColor} size={20} />
      {/* glass rim */}
      <View style={[styles.rim, { borderColor: theme.borderColor }]} />
      <View style={styles.head}>
        <View>
          <Text style={[styles.title, { fontFamily: font }]}>Stash Box</Text>
          <Text style={[styles.sub, { fontFamily: font, color: theme.subtitleColor }]}>
            Every past day, kept in the jar — {dates.length} harvested
          </Text>
        </View>
        <Pressable onPress={() => setExpanded((e) => !e)} style={[styles.btn, theme.buttonStyle]}>
          <Text style={styles.btnText}>{expanded ? 'Close' : 'Open'}</Text>
        </Pressable>
      </View>

      {/* badges */}
      {badges.length > 0 && (
        <View style={styles.badges}>
          {badges.map((b) => (
            <View key={b.id} style={[styles.badge, { borderColor: theme.borderColor, opacity: b.earned ? 1 : 0.45 }]}>
              <CannabisLeaf size={16} color={theme.leafColor} opacity={b.earned ? 0.9 : 0.4} />
              <Text style={[styles.badgeName, { fontFamily: font, color: theme.textColor }]}>{b.name}</Text>
              <Text style={[styles.badgeClaim, { fontFamily: font, color: theme.subtitleColor }]}>
                {b.earned ? 'Unlocked' : b.claim}
              </Text>
            </View>
          ))}
        </View>
      )}

      {expanded && (
        <>
          <View style={styles.chips}>
            {dates.map((d) => (
              <Pressable
                key={d}
                onPress={() => onPick(d)}
                style={[[styles.chip, theme.chipStyle], selectedDate === d && theme.activeChipStyle]}>
                <Text style={[styles.chipText, { fontFamily: font, color: theme.textColor }]}>{d}</Text>
              </Pressable>
            ))}
          </View>
          {selectedDate && detail}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  jar: { padding: 18, borderRadius: 26, overflow: 'hidden' },
  rim: { height: 14, borderRadius: 12, borderWidth: 2, marginBottom: 10, opacity: 0.5 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 21, fontWeight: '800' },
  sub: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  btn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  btnText: { fontWeight: '700', fontSize: 13 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 },
  badgeName: { fontSize: 12, fontWeight: '800' },
  badgeClaim: { fontSize: 10, opacity: 0.75 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },
});
