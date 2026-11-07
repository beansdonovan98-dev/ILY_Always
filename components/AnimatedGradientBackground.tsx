import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
 */
export default function AnimatedGradientBackground({ children }: { children: React.ReactNode }) {
  const { settings } = useTheme();

  const palette = parseColors(settings?.background_gradient);
  const base = settings?.background_color && !isDark(settings.background_color) ? settings.background_color : palette[0];

  const c1 = palette[0] ?? LIGHT_FALLBACK[0];
  const c2 = palette[1] ?? LIGHT_FALLBACK[1];
  const c3 = palette[2] ?? c2;
  const c4 = palette[3] ?? c1;

  const drift = useRef(new Animated.Value(0)).current;
  const drift2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 11000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 11000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const loopB = Animated.loop(
      Animated.sequence([
        Animated.timing(drift2, {
          toValue: 1,
          duration: 17000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift2, {
          toValue: 0,
          duration: 17000,
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
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: ['-18%', '14%'] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: ['8%', '-12%'] }) },
      { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '10deg'] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1.45] }) },
    ],
  };

  const sheetB = {
    transform: [
      { translateX: drift2.interpolate({ inputRange: [0, 1], outputRange: ['14%', '-16%'] }) },
      { translateY: drift2.interpolate({ inputRange: [0, 1], outputRange: ['-12%', '12%'] }) },
      { rotate: drift2.interpolate({ inputRange: [0, 1], outputRange: ['12deg', '-6deg'] }) },
      { scale: drift2.interpolate({ inputRange: [0, 1], outputRange: [1.4, 1.12] }) },
    ],
  };

  const sheetC = {
    opacity: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0.9, 0.55] }),
    transform: [
      { translateX: drift2.interpolate({ inputRange: [0, 1], outputRange: ['-12%', '12%'] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: ['-6%', '10%'] }) },
      { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['6deg', '-12deg'] }) },
      { scale: drift2.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1.35] }) },
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

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  sheet: { position: 'absolute', width: '160%', height: '160%', left: '-30%', top: '-30%' },
  fill: { flex: 1 },
  content: { flex: 1 },
});
