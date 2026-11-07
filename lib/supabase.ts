import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!hasSupabaseEnv) {
  console.warn('[supabase] Missing EXPO_PUBLIC_SUPABASE_URL / ANON_KEY — using local-only fallback.');
}

// Never throw at import time. Without env vars the client talks to a dead
// placeholder and every call fails gracefully into the local cache.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'public-anon-key-placeholder',
  {
    auth: { persistSession: true, autoRefreshToken: true },
  }
);
