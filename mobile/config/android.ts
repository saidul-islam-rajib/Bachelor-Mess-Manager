import type { ExpoConfig } from 'expo/config';

export const androidConfig: NonNullable<ExpoConfig['android']> = {
  package: 'com.bachelorpoint.app',
  adaptiveIcon: { backgroundColor: '#ffffff' },
  softwareKeyboardLayoutMode: 'resize',
  permissions: [],
};
