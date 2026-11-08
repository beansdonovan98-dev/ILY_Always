import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { BongVector } from '@/components/CannabisHardware';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Lit joint burning down: body shrinks toward filter, ember + ash trail. */
export function JointBurnTimer({ ratio = 1, color = '#F5E6C8' }: { ratio?: number; color?: string }) {
  const r = Math.max(0, Math.min(1, ratio));
  // ember travels from x=16 (fresh) to x=78 (done); paper length shrinks accordingly
  const emberX = 16 + (1 - r) * 62;
  const paperEndX = 78;
  const paperStartX = r > 0.02 ? emberX : paperEndX;
  const ashOpacity = 1 - r;

  return (
    <Svg width={220} height={64} viewBox="0 0 220 64">
      {/* ash particles drifting down behind the ember */}
      {[0, 1, 2].map((i) => (
        <Circle key={i} cx={emberX + (i - 1) * 6} cy={34 + i * 7} r={2.2 - i * 0.4} fill="#9AA0A6" opacity={ashOpacity * (0.7 - i * 0.15)} />
      ))}
      {/* smoke wisp */}
      <Path d={`M${emberX},30 C${emberX - 6},22 ${emberX + 6},18 ${emberX - 2},10`} stroke="#CBD5E1" strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.55} />
      {/* unburned paper body (shrinks as it burns) */}
      {r > 0.02 && (
        <Path d={`M${paperStartX},42 L${paperEndX},20 L${paperEndX + 6},26 L${paperStartX + 4},48 Z`} fill={color} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
      )}
      {/* filter end */}
      <Path d="M84,24 L90,30 L86,34 L80,28 Z" fill="#D9B98A" />
      {/* ember */}
      <Circle cx={emberX} cy={35} r={11} fill="#FF7A1A" opacity={0.3} />
      <Circle cx={emberX} cy={35} r={5.5} fill="#FF7A1A" opacity={0.8} />
      <Circle cx={emberX} cy={35} r={2.7} fill="#FFE45E" />
      {/* burnt ash stub near filter */}
      <Path d="M78,24 L84,24 L84,30 L78,30 Z" fill="#9AA0A6" opacity={0.9} />
    </Svg>
  );
}

/** Heavy haptic — bong rip / lighter spark. Wrap any completion event. */
export async function bongHaptic() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {}
}

/** Bong filling with water while refreshing; smoke puff on release. */
export function BongRefresh({ refreshing, color = '#2E7D4F' }: { refreshing: boolean; color?: string }) {
  const fill = useSharedValue(0.15);
  useEffect(() => {
    fill.value = withTiming(refreshing ? 1 : 0.15, { duration: refreshing ? 900 : 400 });
  }, [refreshing, fill]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + fill.value * 0.2 }],
    opacity: 0.5 + 0.5 * fill.value,
  }));
  const waterH = useAnimatedStyle(() => ({
    height: 6 + fill.value * 26,
  }));
  if (!refreshing) return null;
  return (
    <View pointerEvents="none" style={{ alignItems: 'center', paddingVertical: 8 }}>
      <Animated.View style={style}>
        <BongVector size={72} color={color} />
      </Animated.View>
      <Animated.View style={[waterH, { width: 26, backgroundColor: '#7DD3FC', borderRadius: 6, marginTop: -34, opacity: 0.7 }]} />
    </View>
  );
}

/** Flickering flame shown when a toggle/slider is ON. */
export function LighterFlame({ on, size = 22 }: { on: boolean; size?: number }) {
  const f = useSharedValue(1);
  useEffect(() => {
    if (!on) return;
    f.value = withRepeat(withTiming(0.82, { duration: 120 }), -1, true, () => {
      f.value = withTiming(1, { duration: 120 });
    });
    return () => cancelAnimation(f);
  }, [on, f]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: f.value }, { scaleY: 2 - f.value }],
    opacity: on ? 1 : 0.25,
  }));
  return (
    <Animated.View style={style}>
      <Svg width={size} height={size * 1.2} viewBox="0 0 24 28">
        <Path d="M12,2 C16,8 19,12 19,18 A7,7 0 0 1 12,26 A7,7 0 0 1 5,18 C5,12 8,8 12,2 Z" fill="#FF7A1A" opacity={on ? 0.95 : 0.3} />
        <Path d="M12,10 C14,13 15,15 15,18 A3,3.5 0 0 1 12,22 A3,3.5 0 0 1 9,18 C9,15 10,13 12,10 Z" fill="#FFE45E" opacity={on ? 1 : 0.4} />
        <Ellipse cx={12} cy={26} rx={7} ry={2} fill="#FF7A1A" opacity={on ? 0.35 : 0.1} />
      </Svg>
    </Animated.View>
  );
}

/** Toggle wrapped with a flickering lighter flame when ON. */
export function LighterToggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <LighterFlame on={!!value} />
      <Pressable
        onPress={() => onValueChange(!value)}
        style={{
          width: 52, height: 32, borderRadius: 16, padding: 3,
          backgroundColor: value ? '#2E7D4F' : 'rgba(120,120,120,0.35)',
          flexDirection: 'row', alignItems: 'center',
          justifyContent: value ? 'flex-end' : 'flex-start',
        }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' }} />
      </Pressable>
    </View>
  );
}
export function SmokeTransition({ pathname }: { pathname: string }) {
  const [active, setActive] = useState(false);
  const x1 = useSharedValue(-160);
  const x2 = useSharedValue(-160);

  useEffect(() => {
    if (!pathname) return;
    setActive(true);
    x1.value = -160;
    x2.value = -160;
    x1.value = withTiming(420, { duration: 520, easing: Easing.out(Easing.ease) });
    x2.value = withTiming(500, { duration: 640, easing: Easing.out(Easing.ease) });
    const t = setTimeout(() => setActive(false), 700);
    return () => clearTimeout(t);
  }, [pathname, x1, x2]);

  const s1 = useAnimatedStyle(() => ({
    transform: [{ translateX: x1.value }],
    opacity: 0.85,
  }));
  const s2 = useAnimatedStyle(() => ({
    transform: [{ translateX: x2.value }],
    opacity: 0.6,
  }));

  if (!active) return null;

  return (
    <View pointerEvents="none" style={styles.transition}>
      <Animated.View style={[styles.cloud, styles.cloudA, s1]}>
        <SmokeCloud />
      </Animated.View>
      <Animated.View style={[styles.cloud, styles.cloudB, s2]}>
        <SmokeCloud />
      </Animated.View>
    </View>
  );
}

function SmokeCloud() {
  return (
    <Svg width={180} height={110} viewBox="0 0 180 110">
      <Path d="M10,80 C0,55 30,40 45,48 C50,20 90,8 105,22 C125,5 160,22 155,45 C175,50 178,80 160,90 C140,102 30,102 10,80 Z" fill="#CBD5E1" opacity={0.9} />
      <Path d="M40,85 C35,70 60,60 75,68 C85,50 115,50 122,66 C140,66 145,85 130,92 C110,100 55,98 40,85 Z" fill="#E2E8F0" opacity={0.8} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  transition: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 60, elevation: 60, overflow: 'hidden' },
  cloud: { position: 'absolute', top: '38%' },
  cloudA: { left: -160 },
  cloudB: { left: -160, top: '48%' },
});
