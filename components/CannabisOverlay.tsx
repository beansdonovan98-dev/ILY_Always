import { useEffect, useState } from 'react';
import { DeviceEventEmitter, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CannabisLeaf } from '@/components/CannabisLeaf';
import { SmokePuff } from '@/components/CannabisLeaf';

export const SMOKE_BURST_EVENT = 'smoke-burst';

/** One leaf twisting slowly downward in a loop. */
function LeafPuff({ left, leafSize, dur, delay, color, fromY, toY }: {
  left: number; leafSize: number; dur: number; delay: number; color: string; fromY: number; toY: number;
}) {
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
    opacity: 0.03 + 0.2 * Math.sin(Math.PI * p.value),
    transform: [
      { translateY: fromY + (toY - fromY) * p.value },
      { rotate: `${Math.sin(p.value * Math.PI * 2) * 40}deg` },
      { translateX: Math.sin(p.value * Math.PI * 2) * 14 },
    ],
  }));

  return (
    <Animated.View style={style}>
      <CannabisLeaf size={leafSize} color={color} />
    </Animated.View>
  );
}

/** One smoke puff rising and expanding in a loop. */
function SmokePuffRise({ left, size, dur, sway, delay, col }: {
  left: number; size: number; dur: number; sway: number; delay: number; col: string;
}) {
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
    bottom: 0,
    opacity: 0.5 * Math.sin(Math.PI * p.value),
    transform: [
      { translateY: -500 * p.value },
      { translateX: Math.sin(p.value * Math.PI * 2) * sway },
      { scale: 0.7 + 1.4 * p.value },
    ],
  }));

  return (
    <Animated.View style={style}>
      <SmokePuff size={size} color={col} />
    </Animated.View>
  );
}

/**
 * Ambient overlay: continuous smoke + gently falling leaves.
 * Untappable; mount once at the root so every screen gets it.
 */
export default function CannabisOverlay({ color = '#2E7D4F', smoke = '#CBD5E1' }: { color?: string; smoke?: string }) {
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(SMOKE_BURST_EVENT, () => setBurst((b) => b + 1));
    return () => sub.remove();
  }, []);

  const leaves = [
    { left: 14, leafSize: 30, dur: 26000, delay: 0 },
    { left: 90, leafSize: 22, dur: 31000, delay: 4000 },
    { left: 180, leafSize: 26, dur: 24000, delay: 8000 },
    { left: 260, leafSize: 20, dur: 28000, delay: 12000 },
    { left: 320, leafSize: 28, dur: 25000, delay: 2000 },
  ];
  const smokes = [
    { left: 20, size: 56, dur: 11000, sway: 14, delay: 0, col: smoke },
    { left: 120, size: 44, dur: 13000, sway: -16, delay: 3200, col: smoke },
    { left: 220, size: 62, dur: 12000, sway: 12, delay: 6000, col: smoke },
    { left: 300, size: 48, dur: 14000, sway: -12, delay: 9000, col: smoke },
  ];

  return (
    <View pointerEvents="none" style={styles.root}>
      {leaves.map((l, i) => (
        <LeafPuff key={`leaf-${i}`} left={l.left} leafSize={l.leafSize} dur={l.dur} delay={l.delay} color={color} fromY={-60} toY={820} />
      ))}
      {smokes.map((s, i) => (
        <SmokePuffRise key={`smoke-${i}`} left={s.left} size={s.size} dur={s.dur} sway={s.sway} delay={s.delay} col={s.col} />
      ))}
      {/* burst remounts a fresh set of fast puffs when the pill is tapped */}
      {burst > 0 && (
        <View key={burst} pointerEvents="none" style={styles.root}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SmokePuffRise
              key={i}
              left={40 + Math.random() * 280}
              size={40 + Math.random() * 36}
              dur={3600 + Math.random() * 1600}
              sway={(Math.random() - 0.5) * 30}
              delay={0}
              col="#E2E8F0"
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, elevation: 50 },
});
