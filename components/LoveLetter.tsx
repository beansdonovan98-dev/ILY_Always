import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { MylarPouch } from '@/components/MylarPouch';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTheme } from '@/contexts/ThemeContext';
import { bongHaptic } from '@/components/CannabisFeatures';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const DEFAULT_BODY =
  'My love,\n\nevery day with you is my favorite story — and I would choose you in every lifetime, in every universe, again and again.\n\nForever yours.';
const DEFAULT_SECRET = 'Psst… you are the reason my heart knows its way home. 🌙💋';
const DEFAULT_FINAL = 'You are my forever. ♡';
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

export function LoveLetterExperience({ onClose }: { onClose: () => void }) {
  const theme = useAppTheme();
  const { settings, updateSettings } = useTheme();
  const [opened, setOpened] = useState(0);
  const [secret, setSecret] = useState(false);
  const [final, setFinal] = useState(false);
  const reduce = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(settings?.letter_body || DEFAULT_BODY);
  const [secretMsg, setSecretMsg] = useState(settings?.secret_message || DEFAULT_SECRET);
  const [finalMsg, setFinalMsg] = useState(settings?.final_message || DEFAULT_FINAL);

  useEffect(() => {
    setBody(settings?.letter_body || DEFAULT_BODY);
    setSecretMsg(settings?.secret_message || DEFAULT_SECRET);
    setFinalMsg(settings?.final_message || DEFAULT_FINAL);
  }, [settings?.letter_body, settings?.secret_message, settings?.final_message]);

  // 3-day rotation: if the letter is older than 3 days, show fresh defaults.
  const letterAge = settings?.letter_updated_at ? Date.now() - Date.parse(settings.letter_updated_at) : 0;
  const expired = settings?.letter_updated_at ? letterAge > THREE_DAYS : false;
  const shownBody = expired ? DEFAULT_BODY : body;
  const shownSecret = expired ? DEFAULT_SECRET : secretMsg;
  const shownFinal = expired ? DEFAULT_FINAL : finalMsg;

  const open = async () => {
    void bongHaptic();
    setOpened(1);
    setTimeout(() => setOpened(2), 700);
  };

  const revealSecret = async () => {
    void bongHaptic();
    setSecret(true);
    setTimeout(() => setFinal(true), 900);
  };

  const saveLetter = async () => {
    void bongHaptic();
    await updateSettings({
      letter_body: body,
      secret_message: secretMsg,
      final_message: finalMsg,
      letter_updated_at: new Date().toISOString(),
    });
    setEditing(false);
  };

  return (
    <View style={styles.root}>
      {!reduce && <FloatingHearts />}
      <ScrollView contentContainerStyle={{ padding: 24, gap: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.kicker, { color: theme.subtitleColor }]}>A letter for you 💌</Text>
          <Pressable onPress={onClose} style={[styles.close, { borderColor: theme.borderColor }]}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <MylarPouch title={<Text style={styles.cardTitle}>Sealed with love 💗</Text>} hint="Something special is waiting inside, darling" defaultStrain="PINEAPPLE EXP." stampRight="THC: 24.5%">
          <Pressable onPress={open} style={[styles.envelope]}>
            {opened === 0 ? (
              <>
                <Text style={styles.envelopeEmoji}>💌</Text>
                <Text style={styles.tapHint}>Tap to open</Text>
              </>
            ) : opened === 1 ? (
              <EnvelopeOpening />
            ) : (
              <Text style={styles.letterBody}>{shownBody}</Text>
            )}
          </Pressable>

          {opened >= 2 && !secret && (
            <Pressable onPress={revealSecret} style={[styles.secretBtn, { backgroundColor: theme.accentColor }]}>
              <Text style={styles.secretBtnText}>💗 SECRET MESSAGE</Text>
            </Pressable>
          )}

          {secret && !final && <Text style={styles.secretBody}>{shownSecret}</Text>}
          {final && <Text style={styles.final}>{shownFinal}</Text>}

          {/* editable by both partners — only the letter text changes */}
          <Pressable onPress={() => setEditing((e) => !e)} style={[styles.editBtn, { borderColor: theme.borderColor }]}>
            <Text style={styles.editBtnText}>{editing ? '✕ Cancel' : '✏️ Write our letter'}</Text>
          </Pressable>
          {editing && (
            <View style={{ marginTop: 10 }}>
              {expired && (
                <Text style={styles.note}>This letter is 3 days old — write a fresh one for the next 3 days.</Text>
              )}
              <TextInput value={body} onChangeText={setBody} multiline style={styles.input} placeholder="Letter body" placeholderTextColor="rgba(58,42,46,0.45)" />
              <TextInput value={secretMsg} onChangeText={setSecretMsg} multiline style={styles.input} placeholder="Secret message" placeholderTextColor="rgba(58,42,46,0.45)" />
              <TextInput value={finalMsg} onChangeText={setFinalMsg} style={styles.input} placeholder="Final reveal line" placeholderTextColor="rgba(58,42,46,0.45)" />
              <Pressable onPress={saveLetter} style={[styles.secretBtn, { backgroundColor: theme.accentColor }]}>
                <Text style={styles.secretBtnText}>Save our letter 💞</Text>
              </Pressable>
            </View>
          )}
        </MylarPouch>
      </ScrollView>
    </View>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

function FloatingHearts() {
  const hearts = [
    { left: 20, size: 22, dur: 9000, delay: 0, char: '💗' },
    { left: 90, size: 16, dur: 11000, delay: 2000, char: '✨' },
    { left: 160, size: 20, dur: 9500, delay: 4000, char: '💖' },
    { left: 240, size: 14, dur: 12000, delay: 1000, char: '🌟' },
    { left: 300, size: 18, dur: 10000, delay: 3000, char: '💓' },
  ];
  return (
    <>
      {hearts.map((h, i) => (
        <FallingHeart key={i} left={h.left} size={h.size} dur={h.dur} delay={h.delay} char={h.char} />
      ))}
    </>
  );
}

function FallingHeart({ left, size, dur, delay, char }: { left: number; size: number; dur: number; delay: number; char: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withTiming(1, { duration: dur }),
      -1,
      false,
      () => {
        p.value = 0;
        p.value = withTiming(1, { duration: dur });
      }
    );
    return () => cancelAnimation(p);
  }, [p, dur, delay]);
  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left,
    opacity: 0.25 + 0.55 * Math.sin(Math.PI * p.value),
    transform: [
      { translateY: -40 + 820 * p.value },
      { translateX: Math.sin(p.value * Math.PI * 2) * 16 },
      { rotate: `${Math.sin(p.value * Math.PI * 2) * 20}deg` },
    ],
  }));
  return <Animated.Text style={[style, { fontSize: size }]}>{char}</Animated.Text>;
}

function EnvelopeOpening() {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withTiming(1.12, { duration: 350 });
  }, [s]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
  }));
  return <Animated.Text style={[style, styles.envelopeEmoji]}>💌</Animated.Text>;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 80, elevation: 80, backgroundColor: 'rgba(20,8,18,0.55)' },
  kicker: { fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  close: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  closeText: { color: '#fff', fontWeight: '800' },
  cardTitle: { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  envelope: {
    minHeight: 200, borderRadius: 18, backgroundColor: '#FFC9D7', alignItems: 'center', justifyContent: 'center',
    padding: 18, borderWidth: 2, borderColor: '#FF8FAB', marginTop: 6,
  },
  envelopeEmoji: { fontSize: 52 },
  tapHint: { marginTop: 8, fontWeight: '800', fontSize: 13, color: '#8E2457', letterSpacing: 1 },
  letterBody: { fontSize: 16, lineHeight: 24, color: '#5A1F33', fontStyle: 'italic' },
  secretBtn: { marginTop: 14, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, alignSelf: 'center' },
  secretBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  secretBody: { marginTop: 12, fontSize: 15, lineHeight: 22, color: '#8E2457', fontStyle: 'italic', textAlign: 'center' },
  final: { marginTop: 16, fontSize: 28, fontWeight: '900', color: '#8E2457', textAlign: 'center' },
  editBtn: {
    marginTop: 14, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)',
  },
  editBtnText: { fontWeight: '800', fontSize: 12 },
  note: { fontSize: 12, fontStyle: 'italic', opacity: 0.75, marginBottom: 6 },
  input: {
    borderWidth: 1, borderRadius: 12, padding: 10, minHeight: 40, marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.6)', fontSize: 15,
  },
});
