import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CannabisLeaf, WeedPlant } from '@/components/CannabisLeaf';
import { useTheme } from '@/contexts/ThemeContext';

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
    return () => {
      loopA.stop();
      loopB.stop();
    };
  }, [drift, drift2]);

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

  const smokeDrift = {
    opacity: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1, 0.5] }),
    transform: [
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [14, -30] }) },
      { translateX: drift2.interpolate({ inputRange: [0, 1], outputRange: [-8, 10] }) },
    ],
  };

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
        <View style={styles.leafA1}><CannabisLeaf size={30} color={leafColor} opacity={0.14} /></View>
        <View style={styles.leafA2}><CannabisLeaf size={20} color={leafColor} opacity={0.1} /></View>
        <View style={styles.leafA3}><CannabisLeaf size={24} color={leafColor} opacity={0.12} style={styles.tiltLeft} /></View>
        <View style={styles.leafA4}><CannabisLeaf size={16} color={leafColor} opacity={0.09} /></View>
        <View style={styles.leafB1}><CannabisLeaf size={26} color={leafColor} opacity={0.12} style={styles.tiltRight} /></View>
        <View style={styles.leafB2}><CannabisLeaf size={18} color={leafColor} opacity={0.1} /></View>
        <View style={styles.leafB3}><CannabisLeaf size={22} color={leafColor} opacity={0.11} /></View>
        <View style={styles.leafB4}><CannabisLeaf size={14} color={leafColor} opacity={0.08} style={styles.tiltLeft} /></View>
      </View>

      {/* Rooted plants on the edges — bud colour follows the active theme */}
      <View pointerEvents="none" style={styles.plantLeft}><WeedPlant height={190} color={leafColor} budColor={c3} opacity={0.85} /></View>
      <View pointerEvents="none" style={styles.plantRight}><WeedPlant height={150} color={leafColor} budColor={c4} opacity={0.65} /></View>

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
  smokeA: { position: 'absolute', top: '30%', left: '52%', transform: [{ rotate: '12deg' }] },
  smokeB: { position: 'absolute', top: '56%', left: '10%', transform: [{ rotate: '-8deg' }] },
  smokeC: { position: 'absolute', top: '8%', left: '22%', transform: [{ rotate: '14deg' }] },
  smokeD: { position: 'absolute', top: '72%', left: '60%', transform: [{ rotate: '-12deg' }] },
  plantLeft: { position: 'absolute', bottom: '-6%', left: '-3%', transform: [{ rotate: '-4deg' }] },
  plantRight: { position: 'absolute', bottom: '-6%', right: '-3%', transform: [{ rotate: '4deg' }] },
  bongSlot: { position: 'absolute', bottom: '10%', right: '6%', transform: [{ rotate: '6deg' }] },
  bongSlotSmall: { position: 'absolute', bottom: '18%', left: '4%', transform: [{ rotate: '-6deg' }] },
});
