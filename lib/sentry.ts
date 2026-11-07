import * as Sentry from '@sentry/react-native';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || '';

export function initCrashReporting() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.2,
  });
}

export { Sentry };