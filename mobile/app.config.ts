import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Bachelor Point',
  slug: 'bachelor-point',
  version: '1.0.0',
  scheme: 'bachelorpoint',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: { supportsTablet: false, bundleIdentifier: 'com.bachelorpoint.app' },
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.MESS_API_URL ?? 'http://localhost:3000',
  },
};

export default config;
