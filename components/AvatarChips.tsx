import { Pressable, StyleSheet, Text, View } from 'react-native';

import { USERS } from '@/constants/content';

interface Props {
  active: 'daddy' | 'princess';
  onChange?: (u: 'daddy' | 'princess') => void;
}

export default function AvatarChips({ active, onChange }: Props) {
  return (
    <View style={styles.row}>
      {(['daddy', 'princess'] as const).map((k) => (
        <Pressable
          key={k}
          onPress={() => onChange?.(k)}
          style={[styles.chip, active === k && styles.chipActive]}>
          <Text style={styles.chipText}>{USERS[k].emoji} {USERS[k].name}</Text>
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