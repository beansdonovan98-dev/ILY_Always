import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider as NavThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useCallback } from 'react';
import 'react-native-reanimated';

import { initCrashReporting } from '@/lib/sentry';
import LoginScreen from '@/components/LoginScreen';
import { UsageProvider, useUsage } from '@/contexts/UsageContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import AnimatedGradientBackground from '@/components/AnimatedGradientBackground';
import CannabisOverlay from '@/components/CannabisOverlay';
import Mode420 from '@/components/Mode420';
import { Caveat_400Regular } from '@expo-google-fonts/caveat';
import { ComicNeue_400Regular } from '@expo-google-fonts/comic-neue';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  anchor: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

/**
 * Always light, always transparent so the animated gradient is what you see.
 * The OS dark-mode setting must never paint a black sheet over the app.
 */
const APP_NAV_THEME: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: '#FF6F91',
    background: 'transparent',
    card: 'transparent',
    text: '#3A2A2E',
    border: 'transparent',
    notification: '#FF6F91',
  },
};

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontsError, setFontsError] = useState<Error | null>(null);

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ComicNeue_400Regular,
    Caveat_400Regular,
  });

  useEffect(() => {
    initCrashReporting();
  }, []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

/** True glassmorphism — everything frosted over the animated gradient. */
function AuthGate() {
  const { authenticated, ready } = useUsage();
  if (!ready) return null;
  if (!authenticated) return <LoginScreen />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

function RootLayoutNav() {
  const { settings } = useTheme();
  const palette = (settings?.background_gradient
    ? ((): string[] => {
        try {
          const parsed = JSON.parse(settings.background_gradient as string);
          return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
          return (settings.background_gradient as string).split(',').map((s: string) => s.trim());
        }
      })()
    : []) as string[];
  const luminance = (hex: string): number => {
    const h = hex.replace('#', '');
    if (h.length < 6) return 0.9;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  const avgLum = palette.length ? palette.reduce((sum, c) => sum + luminance(c), 0) / palette.length : 0.9;
  const statusStyle = avgLum < 0.62 ? 'light' : 'dark';

  return (
    <UsageProvider>
      <ThemeProvider>
        <AnimatedGradientBackground>
          <NavThemeProvider value={APP_NAV_THEME}>
            <StatusBar style={statusStyle} />
            <AuthGate />
          </NavThemeProvider>
          {/* Ambient smoke + falling leaves across every screen (untappable) */}
          <CannabisOverlay color={settings?.accent_color || '#2E7D4F'} smoke={palette[7] || '#CBD5E1'} />
          <Mode420 />
        </AnimatedGradientBackground>
      </ThemeProvider>
    </UsageProvider>
  );
}
