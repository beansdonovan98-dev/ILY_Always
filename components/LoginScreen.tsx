import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useUsage } from '@/contexts/UsageContext';
import { USERS, UserKey } from '@/constants/content';
import { hasPin, setPin, verifyPin } from '@/lib/auth';

export default function LoginScreen() {
  const theme = useAppTheme();
  const { login } = useUsage();

  const [selected, setSelected] = useState<UserKey | null>(null);
  const [existingPin, setExistingPin] = useState(false);
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPinValue('');
    setConfirm('');
    setError('');
    if (!selected) return;
    let alive = true;
    (async () => {
      const exists = await hasPin(selected);
      if (alive) setExistingPin(exists);
    })();
    return () => {
      alive = false;
    };
  }, [selected]);

  const submit = useCallback(async () => {
    if (!selected) return;
    const value = pin.trim();
    if (value.length < 4) {
      setError('Use at least 4 characters.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      if (existingPin) {
        const ok = await verifyPin(selected, value);
        if (!ok) {
          setError('That PIN is not right. Try again.');
          return;
        }
      } else {
        if (value !== confirm.trim()) {
          setError('The two PINs do not match.');
          return;
        }
        await setPin(selected, value);
      }
      login(selected);
    } finally {
      setBusy(false);
    }
  }, [selected, pin, confirm, existingPin, login]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>ILY Always 💞</Text>
      <Text style={[styles.subtitle, { color: theme.subtitleColor }]}>
        Two hearts, one private little world — log in and come sin with me 🔥🔐
      </Text>

      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Who&apos;s unlocking? 👀</Text>
        <Text style={styles.cardHint}>You stay locked to your own account once you&apos;re in 🔒</Text>

        <View style={styles.userRow}>
          {(['daddy', 'princess'] as const).map((key) => (
            <Pressable
              key={key}
              onPress={() => setSelected(key)}
              style={[
                styles.userCard,
                { borderColor: theme.borderColor },
                selected === key && { backgroundColor: theme.accentSoft, borderColor: theme.accentColor },
              ]}>
              <Text style={styles.userEmoji}>{USERS[key].emoji}</Text>
              <Text style={styles.userName}>{USERS[key].name}</Text>
            </Pressable>
          ))}
        </View>

        {selected ? (
          <View style={styles.pinBlock}>
            <Text style={styles.label}>
              {existingPin ? `Enter ${USERS[selected].name}'s PIN` : `Create ${USERS[selected].name}'s PIN`}
            </Text>
            <TextInput
              value={pin}
              onChangeText={setPinValue}
              placeholder="••••"
              placeholderTextColor="rgba(58,42,46,0.4)"
              secureTextEntry
              style={[styles.input, { borderColor: theme.borderColor, color: theme.textColor }]}
            />

            {!existingPin ? (
              <>
                <Text style={styles.label}>Confirm PIN</Text>
                <TextInput
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="••••"
                  placeholderTextColor="rgba(58,42,46,0.4)"
                  secureTextEntry
                  style={[styles.input, { borderColor: theme.borderColor, color: theme.textColor }]}
                />
                <Text style={styles.smallHint}>
                  First time on this phone — this PIN becomes your key to get in from now on.
                </Text>
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={submit} disabled={busy} style={styles.pillPress}>
              <LinearGradient
                colors={[theme.accentColor, '#C86DD7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pill}>
                <Text style={styles.pillText}>
                  {busy ? 'Unlocking...' : existingPin ? 'Unlock 💞' : 'Set PIN & Enter 💞'}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.smallHint}>Tap your name to continue.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 80, paddingBottom: 60, gap: 16, maxWidth: '100%' },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 17, lineHeight: 24, marginBottom: 8 },
  card: {
    padding: 18,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardTitle: { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  cardHint: { fontSize: 13, opacity: 0.65, marginBottom: 12 },
  userRow: { flexDirection: 'row', gap: 12 },
  userCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  userEmoji: { fontSize: 34 },
  userName: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  pinBlock: { marginTop: 8 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 6, opacity: 0.8 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 48,
    backgroundColor: 'rgba(255,255,255,0.55)',
    fontSize: 18,
  },
  smallHint: { fontSize: 12, opacity: 0.65, marginTop: 8 },
  error: { color: '#C0392B', fontWeight: '700', marginTop: 8 },
  pillPress: { alignSelf: 'flex-start', marginTop: 16 },
  pill: { paddingVertical: 13, paddingHorizontal: 26, borderRadius: 50 },
  pillText: { fontWeight: '800', fontSize: 15, color: '#FFFFFF' },
});
