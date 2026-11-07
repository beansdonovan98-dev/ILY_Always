import type { ExpoConfig } from 'expo/config';

const config = {
  name: 'ILY Always',
  slug: 'ily-always',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'ilyalways',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    buildNumber: 1001,
    supportsTablet: true,
    bundleIdentifier: 'com.spector.ILYAlways',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSPhotoLibraryUsageDescription: 'This app needs access to your photo library to upload and share photos and GIFs.',
      NSUserNotificationsUsageDescription: 'This app uses notifications to keep you and your partner in sync.',
    },
  },
  plugins: [],
};

export default config;