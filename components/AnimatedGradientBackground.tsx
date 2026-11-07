import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme } from '@/contexts/ThemeContext';

function parseColors(gradient: string | null | undefined, fallback: string): string[] {
  if (!gradient) return [fallback, fallback];
  try {
    const parsed = JSON.parse(gradient);
    if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
  } catch {}
  // allow "color1,color2"
  if (gradient.includes(',')) return gradient.split(',').map((c) => c.trim());
  return [gradient, fallback];
}

export default function AnimatedGradientBackground({ children }: { children: React.ReactNode }) {
  const { settings } = useTheme();
  const bg = settings?.background_color || '#ffffff';
  const colors = parseColors(settings?.background_gradient, bg);
  const animated = settings?.animated_gradient === true;

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animated) {
      anim.stopAnimation();
      anim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [animated, anim]);

  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ flex: 1, backgroundColor: bg, overflow: 'hidden' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <LinearGradient
          colors={colors}
          style={{ flex: 1, width: '150%', height: '150%', marginLeft: '-25%', marginTop: '-25%' }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}