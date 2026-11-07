import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';

interface CelebrationProps {
  /** null = hidden. small = daily pop; big = cadence party; mega = everything done. */
  mode: null | 'small' | 'big' | 'mega';
  message: string;
  onDone: () => void;
}

/**
 * Emoji-burst celebration overlay.
 * Small = one pop (daily completion). Big = repeated bursts (7-day streak).
 */
export function Celebration({ mode, message, onDone }: CelebrationProps) {
  const theme = useAppTheme();
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!mode) return;
    scale.setValue(0.6);
    opacity.setValue(0);
    burst.setValue(0);

    const pop = Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]);
    pop.start();

    let loop: Animated.CompositeAnimation | null = null;
    if (mode !== null && mode !== 'small') {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(burst, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(burst, { toValue: 0, duration: 420, useNativeDriver: true }),
        ])
      );
      loop.start();
    }

    const duration = mode === 'mega' ? 5000 : mode === 'big' ? 3200 : 1500;
    const timer = setTimeout(onDone, duration);
    return () => {
      pop.stop();
      loop?.stop();
      clearTimeout(timer);
    };
  }, [mode, message, onDone, scale, opacity, burst]);

  if (!mode) return null;

  const big = mode !== null && mode !== 'small';
  const mega = mode === 'mega';
  const emojis = mega ? ['🎆', '🌿', '🔥', '💦', '🎉', '✨'] : big ? ['🎆', '🔥', '💦', '🎉', '🌿', '✨'] : ['🎉', '✨', '💦'];
  const bigScale = burst.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDone}>
      <Pressable style={styles.overlay} onPress={onDone}>
        <Animated.View style={[styles.burst, { opacity, transform: [{ scale }] }]}>
          <Text style={[styles.emoji, big && { fontSize: mega ? 80 : 72 }]}>{emojis[0]}</Text>
          {big ? (
            <Animated.View style={{ transform: [{ scale: bigScale }] }}>
              <Text style={styles.emoji}>{emojis[1]}</Text>
            </Animated.View>
          ) : null}
          {mega ? <Text style={styles.emoji}>🫧</Text> : null}
          <Text style={[styles.message, { color: theme.textColor }]}>{message}</Text>
          {mega ? <Text style={styles.sub}>Everything. Done. Legend status earned. 🌿👑</Text> : big ? <Text style={styles.sub}>Keep the streak alive 🌿💪</Text> : null}
          <Text style={styles.tap}>tap to continue</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 10, 15, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  burst: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
    maxWidth: 340,
  },
  emoji: { fontSize: 56 },
  message: { fontSize: 17, fontWeight: '700', textAlign: 'center', lineHeight: 23 },
  sub: { fontSize: 14, fontWeight: '700', opacity: 0.75, textAlign: 'center' },
  tap: { fontSize: 11, opacity: 0.5, marginTop: 4 },
});

export default Celebration;
