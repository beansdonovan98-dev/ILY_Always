import type { ExpoConfig } from 'expo/config';

const config = {
  name: 'ILY Always',
  slug: 'ily-always',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'ilyalways',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  ios: {
    buildNumber: 1001,
    supportsTablet: true,
    bundleIdentifier: 'com.spector.ILYAlways',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      CFBundleVersion: '1001',
      CFBundleShortVersionString: '1.0.0',
      NSPhotoLibraryUsageDescription: 'This app needs access to your photo library to upload and share photos and GIFs.',
      NSPhotoLibraryAddUsageDescription: 'Allow ILY Always to save edited photos to your photo library.',
      NSUserNotificationsUsageDescription: 'This app uses notifications to keep you and your lover in sync.',
    },
  },
  plugins: [
    'expo-media-library',
    [
      'expo-notifications',
      {
        icon: './assets/images/icon.png',
      },
    ],
  ],
};

export default config;