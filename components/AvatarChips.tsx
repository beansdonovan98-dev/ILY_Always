import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getCoupleId } from '@/lib/couple';
import { getCoupleSettings } from '@/lib/appearance';

interface Props {
  active: 'daddy' | 'princess';
  onChange?: (u: 'daddy' | 'princess') => void;
}

export default function AvatarChips({ active, onChange }: Props) {
  const [daddyEmoji, setDaddyEmoji] = useState('🍆');
  const [princessEmoji, setPrincessEmoji] = useState('🍑');

  useEffect(() => {
    (async () => {
      const cid = await getCoupleId();
      const s = await getCoupleSettings(cid);
      if (s?.avatar_daddy) setDaddyEmoji(s.avatar_daddy);
      if (s?.avatar_princess) setPrincessEmoji(s.avatar_princess);
    })();
  }, []);

  const items = [
    { key: 'daddy' as const, emoji: daddyEmoji, name: 'Daddy' },
    { key: 'princess' as const, emoji: princessEmoji, name: 'Princess' },
  ];

  return (
    <View style={styles.row}>
      {items.map((it) => (
        <Pressable key={it.key} onPress={() => onChange?.(it.key)} style={[styles.chip, active === it.key && styles.chipActive]}>
          <Text style={styles.chipText}>{it.emoji} {it.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  chip: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'rgba(120,120,120,0.2)' },
  chipActive: { backgroundColor: 'rgba(100,150,255,0.4)' },
  chipText: { fontSize: 12, fontWeight: '600' },
});