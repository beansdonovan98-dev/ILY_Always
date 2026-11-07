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
  return colors;
}

/**
 * Continuously drifting mesh gradient.
 * Three translucent gradient sheets move at different speeds/directions, so the
 * background never looks flat or static.
 */
export default function AnimatedGradientBackground({ children }: { children: React.ReactNode }) {
  const { settings } = useTheme();

  const palette = parseColors(settings?.background_gradient);
  const base =
    settings?.background_color && !isDark(settings.background_color)
      ? settings.background_color
      : palette[0];

  const c1 = palette[0] ?? LIGHT_FALLBACK[0];
  const c2 = palette[1] ?? LIGHT_FALLBACK[1];
  const c3 = palette[2] ?? c2;
  const c4 = palette[3] ?? c1;

  const animated = settings?.animated_gradient !== false;

  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) {
      drift.stopAnimation();
      drift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, drift]);

  const sheetA = {
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: ['-12%', '10%'] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: ['6%', '-8%'] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1.4] }) },
    ],
  };

  const sheetB = {
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: ['10%', '-10%'] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: ['-8%', '8%'] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.35, 1.1] }) },
    ],
  };

  const sheetC = {
    opacity: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 0.8, 0.45] }),
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: ['-6%', '6%'] }) },
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1.3] }) },
    ],
  };

  return (
    <View style={[styles.root, { backgroundColor: base }]}>
      <Animated.View style={[styles.sheet, sheetA]}>
        <LinearGradient
          colors={[withAlpha(c2, 0.95), withAlpha(c2, 0)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fill}
        />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetB]}>
        <LinearGradient
          colors={[withAlpha(c3, 0), withAlpha(c3, 0.9)]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.fill}
        />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetC]}>
        <LinearGradient
          colors={[withAlpha(c4, 0.75), withAlpha(c1, 0.05), withAlpha(c4, 0.55)]}
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
  sheet: { position: 'absolute', width: '150%', height: '150%', left: '-25%', top: '-25%' },
  fill: { flex: 1 },
  content: { flex: 1 },
});
