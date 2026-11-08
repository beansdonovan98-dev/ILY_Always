import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg from 'react-native-svg';

import { CannabisLeaf, FanLeaf, SmokePuff, WeedPlant } from '@/components/CannabisLeaf';
import { useTheme } from '@/contexts/ThemeContext';

/** Dense cannabis foliage carpet along the bottom edge. */
function FoliageBand({ color, bud }: { color: string; bud: string }) {
  const leaves = [
    // x, y, scale, rot, opacity
    [12, 96, 2.4, -30, 0.85], [52, 84, 2.0, 15, 0.75], [96, 100, 2.2, -12, 0.85],
    [140, 82, 1.9, 28, 0.7], [180, 98, 2.4, -20, 0.85], [224, 84, 2.0, 10, 0.75],
    [268, 100, 2.2, -26, 0.85], [312, 82, 1.9, 18, 0.7], [352, 96, 2.4, -14, 0.85],
    [386, 86, 2.0, 22, 0.75],
  ] as const;
  return (
    <Svg width={400} height={115} viewBox="0 0 400 115">
      {leaves.map(([x, y, s, rot, o], i) => (
        <FanLeaf key={i} x={x} y={y} s={s} rot={rot} color={i % 4 === 0 ? bud : color} opacity={o} />
      ))}
    </Svg>
  );
}

const LIGHT_FALLBACK = ['#FFE3EC', '#F7D9FF', '#FFF3D6', '#FFD9E8'];

const DARK_COLORS = ['#000', '#000000', '#111', '#111111', '#0f2027', '#203a43', '#2c5364', '#1c1c1e', '#2c2c2e'];

function isDark(color: string) {
  return DARK_COLORS.includes(color.trim().toLowerCase());
}

function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  let r: number | null = null;
  let g: number | null = null;
  let b: number | null = null;
  if (short) {
    r = parseInt(short[1] + short[1], 16);
    g = parseInt(short[2] + short[2], 16);
    b = parseInt(short[3] + short[3], 16);
  } else if (long) {
    r = parseInt(long[1], 16);
    g = parseInt(long[2], 16);
    b = parseInt(long[3], 16);
  }
  if (r === null || g === null || b === null) return `rgba(255, 227, 236, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseColors(gradient: string | null | undefined): string[] {
  if (!gradient) return LIGHT_FALLBACK;
  let colors: string[] | null = null;
  try {
    const parsed = JSON.parse(gradient);
    if (Array.isArray(parsed) && parsed.length >= 2) colors = parsed.filter((c) => typeof c === 'string');
  } catch {
    if (gradient.includes(',')) colors = gradient.split(',').map((c) => c.trim());
  }
  if (!colors || colors.length < 2) return LIGHT_FALLBACK;
  // A stored dark theme must never be able to keep the app black.
  if (colors.every(isDark)) return LIGHT_FALLBACK;
  return colors.filter((c) => !isDark(c));
}

function gradientColors(palette: string[]): [string, string, ...string[]] {
  const safe = palette.length >= 2 ? palette : LIGHT_FALLBACK;
  return [safe[0], safe[1], ...safe.slice(2)] as [string, string, ...string[]];
}

/**
 * Continuously drifting mesh gradient.
 * A full-screen gradient base plus three oversized gradient sheets that move at
 * different speeds/directions, so the theme is always visibly animated.
 *
 * TEMPORARY SAFE MODE (crash bisect): renders a static gradient + static
 * artwork, with NO Animated loops and NO SVG layers. If the crash persists
 * on this build, the background is innocent and the search moves on.
 */
export const SAFEMODE = false;

export default function AnimatedGradientBackground({ children }: { children: React.ReactNode }) {
  const { settings } = useTheme();

  const palette = parseColors(settings?.background_gradient);
  const base = settings?.background_color && !isDark(settings.background_color) ? settings.background_color : palette[0];

  const c1 = palette[0] ?? LIGHT_FALLBACK[0];
  const c2 = palette[1] ?? LIGHT_FALLBACK[1];
  const c3 = palette[2] ?? c2;
  const c4 = palette[3] ?? c1;

  if (SAFEMODE) {
    return (
      <View style={[styles.root, { backgroundColor: base }]}>
        <LinearGradient colors={gradientColors(palette)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  const drift = useRef(new Animated.Value(0)).current;
  const drift2 = useRef(new Animated.Value(0)).current;
  // 8 smoke clocks so puffs appear at random times/places, not in a pattern.
  const smokeClocksRef = useRef<Animated.Value[] | null>(null);
  if (!smokeClocksRef.current) {
    smokeClocksRef.current = Array.from({ length: 8 }, () => new Animated.Value(0));
  }
  const smokeClocks = smokeClocksRef.current;
  // Irregular launch points, sizes, sway and durations (deterministic but scattered).
  const SMOKE = [
    { left: '4%', bottom: '3%', size: 84, sway: 14, dur: 9800, delay: 0, col: '#CBD5E1' },
    { left: '18%', bottom: '6%', size: 66, sway: -18, dur: 11200, delay: 3400, col: '#E2E8F0' },
    { left: '12%', bottom: '2%', size: 108, sway: 10, dur: 13400, delay: 6200, col: '#CBD5E1' },
    { left: '30%', bottom: '5%', size: 72, sway: -12, dur: 8600, delay: 1800, col: '#E7E5E4' },
    { left: '44%', bottom: '4%', size: 128, sway: 20, dur: 14200, delay: 5100, col: '#CBD5E1' },
    { left: '56%', bottom: '7%', size: 78, sway: -16, dur: 10400, delay: 7600, col: '#E2E8F0' },
    { left: '66%', bottom: '3%', size: 96, sway: 12, dur: 11800, delay: 2600, col: '#CBD5E1' },
    { left: '80%', bottom: '5%', size: 66, sway: -10, dur: 9200, delay: 4800, col: '#E7E5E4' },
  ] as const;

  useEffect(() => {
    // Sheets animate on the native driver (smooth, off the JS thread) so
    // scrolling stays buttery. Leaf/smoke drifts render as calm statics.
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 6500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 6500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const loopB = Animated.loop(
      Animated.sequence([
        Animated.timing(drift2, {
          toValue: 1,
          duration: 11000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift2, {
          toValue: 0,
          duration: 11000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loopA.start();
    loopB.start();

    // Smoke: each puff rises, expands and dissolves, then a fresh one
    // starts at a different spot — 8 independent plumes, no visible pattern.
    const rise = (v: Animated.Value, duration: number, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 10,
            useNativeDriver: true,
          }),
        ])
      );
    const loops = SMOKE.map((s, i) => rise(smokeClocks[i], s.dur, s.delay));
    loops.forEach((l) => l.start());
    return () => {
      loopA.stop();
      loopB.stop();
      loops.forEach((l) => l.stop());
    };
  }, [drift, drift2, smokeClocks]);

  const sheetA = {
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: ['-26%', '22%'] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: ['12%', '-18%'] }) },
      { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '16deg'] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1.6] }) },
    ],
  };

  const sheetB = {
    transform: [
      { translateX: drift2.interpolate({ inputRange: [0, 1], outputRange: ['22%', '-24%'] }) },
      { translateY: drift2.interpolate({ inputRange: [0, 1], outputRange: ['-18%', '18%'] }) },
      { rotate: drift2.interpolate({ inputRange: [0, 1], outputRange: ['18deg', '-12deg'] }) },
      { scale: drift2.interpolate({ inputRange: [0, 1], outputRange: [1.55, 1.08] }) },
    ],
  };

  const sheetC = {
    opacity: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 0.95, 0.45] }),
    transform: [
      { translateX: drift2.interpolate({ inputRange: [0, 1], outputRange: ['-20%', '20%'] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: ['-10%', '16%'] }) },
      { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['10deg', '-20deg'] }) },
      { scale: drift2.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.5] }) },
    ],
  };

  const leafColor = settings?.accent_color && !isDark(settings.accent_color) ? settings.accent_color : '#2E7D32';
  const leafDriftA = {
    transform: [
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
      { translateX: drift2.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) },
      { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '8deg'] }) },
    ],
  };
  const leafDriftB = {
    transform: [
      { translateY: drift2.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) },
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
      { rotate: drift2.interpolate({ inputRange: [0, 1], outputRange: ['8deg', '-8deg'] }) },
    ],
  };

  // Smoke puff cycle: rise ~170pt, drift sideways, swell, fade out.
  const smokeStyle = (v: Animated.Value, sway = 12) => ({
    opacity: v.interpolate({ inputRange: [0, 0.18, 0.72, 1], outputRange: [0, 0.85, 0.55, 0] }),
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -190] }) },
      { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, sway, -sway * 0.35] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.65, 2.15] }) },
    ],
  });

  return (
    <View style={[styles.root, { backgroundColor: base }]}>
      <LinearGradient colors={gradientColors(palette)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.sheet, sheetA]}>
        <LinearGradient
          colors={[withAlpha(c2, 0.95), withAlpha(c2, 0.1), withAlpha(c3, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetB]}>
        <LinearGradient
          colors={[withAlpha(c3, 0), withAlpha(c3, 0.85), withAlpha(c4, 0.95)]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.fill}
        />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetC]}>
        <LinearGradient
          colors={[withAlpha(c4, 0.85), withAlpha(c1, 0.1), withAlpha(c2, 0.7)]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.fill}
        />
      </Animated.View>

      {/* Weed scene sprites (static so scrolling stays smooth) */}
      <View style={styles.leafLayer}>
        <View style={styles.leafA1}><CannabisLeaf size={52} color={leafColor} opacity={0.38} /></View>
        <View style={styles.leafA2}><CannabisLeaf size={44} color={leafColor} opacity={0.34} /></View>
        <View style={styles.leafA3}><CannabisLeaf size={48} color={leafColor} opacity={0.36} style={styles.tiltLeft} /></View>
        <View style={styles.leafA4}><CannabisLeaf size={38} color={leafColor} opacity={0.3} /></View>
        <View style={styles.leafB1}><CannabisLeaf size={50} color={leafColor} opacity={0.36} style={styles.tiltRight} /></View>
        <View style={styles.leafB2}><CannabisLeaf size={40} color={leafColor} opacity={0.32} /></View>
        <View style={styles.leafB3}><CannabisLeaf size={46} color={leafColor} opacity={0.34} /></View>
        <View style={styles.leafB4}><CannabisLeaf size={34} color={leafColor} opacity={0.28} style={styles.tiltLeft} /></View>
        <View style={styles.leafC1}><CannabisLeaf size={36} color={leafColor} opacity={0.3} /></View>
        <View style={styles.leafC2}><CannabisLeaf size={42} color={leafColor} opacity={0.32} style={styles.tiltRight} /></View>
      </View>

      {/* Animated smoke plumes rising from scattered spots */}
      <View pointerEvents="none" style={styles.leafLayer}>
        {SMOKE.map((s, i) => (
          <Animated.View
            key={i}
            style={[
              styles.smokeSlot,
              { left: s.left as any, bottom: s.bottom as any },
              smokeStyle(smokeClocks[i], s.sway),
            ]}>
            <SmokePuff size={s.size} color={s.col} />
          </Animated.View>
        ))}
      </View>

      {/* Rooted plants on the edges — bud colour follows the active theme */}
      <View pointerEvents="none" style={styles.plantLeft}><WeedPlant height={320} color={leafColor} budColor={c3} opacity={1} /></View>
      <View pointerEvents="none" style={styles.plantRight}><WeedPlant height={260} color={leafColor} budColor={c4} opacity={1} /></View>

      {/* Dense foliage carpet across the bottom */}
      <View pointerEvents="none" style={styles.foliageBand}>
        <FoliageBand color={leafColor} bud={c2} />
      </View>

      {/* Leaf columns climbing the side edges */}
      <View style={styles.leafLayer}>
        <View style={styles.colA}><CannabisLeaf size={64} color={leafColor} opacity={0.5} /></View>
        <View style={styles.colB}><CannabisLeaf size={56} color={leafColor} opacity={0.45} /></View>
        <View style={styles.colC}><CannabisLeaf size={58} color={leafColor} opacity={0.48} /></View>
        <View style={styles.colD}><CannabisLeaf size={62} color={leafColor} opacity={0.5} /></View>
      </View>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  sheet: { position: 'absolute', width: '160%', height: '160%', left: '-30%', top: '-30%' },
  fill: { flex: 1 },
  content: { flex: 1 },
  leafLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  tiltLeft: { transform: [{ rotate: '-18deg' }] },
  tiltRight: { transform: [{ rotate: '18deg' }] },
  leafA1: { position: 'absolute', top: '6%', left: '8%' },
  leafA2: { position: 'absolute', top: '24%', left: '-6%' },
  leafA3: { position: 'absolute', top: '52%', left: '90%' },
  leafA4: { position: 'absolute', top: '78%', left: '4%' },
  leafB1: { position: 'absolute', top: '12%', left: '82%' },
  leafB2: { position: 'absolute', top: '38%', left: '6%' },
  leafB3: { position: 'absolute', top: '64%', left: '-4%' },
  leafB4: { position: 'absolute', top: '86%', left: '88%' },
  leafC1: { position: 'absolute', top: '40%', left: '44%' },
  leafC2: { position: 'absolute', top: '68%', left: '38%' },
  smokeSlot: { position: 'absolute' },
  foliageBand: { position: 'absolute', bottom: -14, left: -6, right: -6, alignItems: 'center' },
  colA: { position: 'absolute', top: '18%', left: '-14' },
  colB: { position: 'absolute', top: '46%', left: '-10' },
  colC: { position: 'absolute', top: '22%', right: '-14' },
  colD: { position: 'absolute', top: '58%', right: '-10' },
  plantLeft: { position: 'absolute', bottom: '-6%', left: '-3%', transform: [{ rotate: '-4deg' }] },
  plantRight: { position: 'absolute', bottom: '-6%', right: '-3%', transform: [{ rotate: '4deg' }] },
  bongSlot: { position: 'absolute', bottom: '10%', right: '6%', transform: [{ rotate: '6deg' }] },
  bongSlotSmall: { position: 'absolute', bottom: '18%', left: '4%', transform: [{ rotate: '-6deg' }] },
});
