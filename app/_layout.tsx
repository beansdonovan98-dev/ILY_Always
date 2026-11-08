import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider as NavThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { initCrashReporting } from '@/lib/sentry';
import LoginScreen from '@/components/LoginScreen';
import { UsageProvider, useUsage } from '@/contexts/UsageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import AnimatedGradientBackground from '@/components/AnimatedGradientBackground';
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
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

/** Requires the partner to log in before the app (and user identity) is exposed. */
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
  return (
    <UsageProvider>
      <ThemeProvider>
        <AnimatedGradientBackground>
          <NavThemeProvider value={APP_NAV_THEME}>
            <StatusBar style="dark" />
            <AuthGate />
          </NavThemeProvider>
        </AnimatedGradientBackground>
      </ThemeProvider>
    </UsageProvider>
  );
}
