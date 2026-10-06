import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the API lives.
 *
 * 1. `EXPO_PUBLIC_API_URL`, when set (e.g. your Heroku app: https://fintrack-yourname-1a2b3c.herokuapp.com).
 * 2. Otherwise, in development, the computer running `expo start`: Expo Go on your phone already knows its
 *    LAN address (that's how it loads the app), so the API is the same host on port 4000.
 */
export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, '');
  if (Platform.OS === 'web') return 'http://localhost:4000';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:4000`;
}

/** Photo URLs from the local storage driver are relative to the API; R2 ones are absolute already. */
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `${apiBaseUrl()}${url.startsWith('/') ? '' : '/'}${url}`;
}
