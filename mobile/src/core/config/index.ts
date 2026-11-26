import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

export const DEFAULT_API_URL = extra.apiUrl ?? 'http://localhost:3000';
export const SHOW_SERVER_PICKER = __DEV__;

export function normalizeServerUrl(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/i.test(trimmed)) return null;
  if (!__DEV__ && !/^https:\/\//i.test(trimmed)) return null;
  return trimmed;
}
