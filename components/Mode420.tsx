import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { CannabisLeaf, SmokePuff } from '@/components/CannabisLeaf';
import { useAppTheme } from '@/hooks/useAppTheme';
import { getItem, setItem } from '@/lib/storage';

const BADGE_KEY = 'strainBadges';
export const SEEN_420_KEY = 'seen420';

export interface StrainBadge {
  id: string;
  name: string;
  claim: string;
  earned: boolean;
}

export async function loadBadges(daysArchived: number): Promise<StrainBadge[]> {
  const seen420 = await getItem<boolean>(SEEN_420_KEY, false);
  return [
    { id: 'wake', name: 'Wake & Baker', claim: 'Opened the app before 10am', earned: true },
    { id: '420', name: '4:20 Veteran', claim: 'Lived through a 4:20 celebration', earned: seen420 },
    { id: 'stash', name: 'Stash Master', claim: 'Archived 10 days in the Stash Box', earned: daysArchived >= 10 },
  ];
}
export async function unlockBadge(id: string) {
  await setItem(SEEN_420_KEY, true);
  void id;
}

/** Fires at 4:20 AM and PM local time: 60s dense smoke + leaf sparkles + toast. */
export default function Mode420() {
  const theme = useAppTheme();
  const [active, setActive] = useState(false);
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const key = `${now.getFullYear()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
      const is420 = now.getHours() === 4 && now.getMinutes() === 20;
      if (is420 && firedRef.current !== key) {
        firedRef.current = key;
        setActive(true);
        void unlockBadge('420');
        setTimeout(() => setActive(false), 60000);
      }
    };
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);

  if (!active) return null;

  const sparkles = Array.from({ length: 24 }).map((_, i) => ({
    left: (i * 37) % 360,
    top: (i * 53) % 520,
    size: 16 + (i % 4) * 6,
    o: 0.25 + (i % 3) * 0.25,
  }));

  return (
    <View pointerEvents="none" style={styles.root}>
      {/* toast */}
      <View style={[styles.toast, { backgroundColor: theme.cardStyle.backgroundColor, borderColor: theme.borderColor }]}>
        <Text style={[styles.toastText, { color: theme.textColor }]}>It's 4:20 🌿</Text>
      </View>
      {/* dense smoke */}
      <View style={styles.layer}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ position: 'absolute', bottom: -20, left: (i * 70) % 320, opacity: 0.5 }}>
            <SmokePuff size={110} opacity={0.55} />
          </View>
        ))}
      </View>
      {/* trichome/leaf sparkles */}
      {sparkles.map((s, i) => (
        <View key={i} style={{ position: 'absolute', left: s.left, top: s.top, opacity: s.o }}>
          <CannabisLeaf size={s.size} color={theme.leafColor} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 70, elevation: 70 },
  toast: {
    position: 'absolute', top: 70, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 999, borderWidth: 1,
  },
  toastText: { fontWeight: '800', fontSize: 18, textAlign: 'center' },
  layer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});
