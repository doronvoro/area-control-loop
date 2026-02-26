import { Platform } from 'react-native';

// In development, Android emulator uses 10.0.2.2 to reach host machine,
// iOS simulator can use localhost. Physical devices need the LAN IP.
function getDevBaseUrl() {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL
  || (__DEV__ ? getDevBaseUrl() : 'https://your-production-url.com');

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
