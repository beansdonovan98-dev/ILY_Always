import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider as NavThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { initCrashReporting } from '@/lib/sentry';
import LockScreen from '@/components/LockScreen';
import { UsageProvider } from '@/contexts/UsageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import AnimatedGradientBackground from '@/components/AnimatedGradientBackground';

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
  const [locked, setLocked] = useState(false);
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    initCrashReporting();
  }, []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <UsageProvider>
      <ThemeProvider>
        <AnimatedGradientBackground>
          <NavThemeProvider value={APP_NAV_THEME}>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
              }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
            </Stack>
          </NavThemeProvider>
        </AnimatedGradientBackground>
      </ThemeProvider>
    </UsageProvider>
  );
}
