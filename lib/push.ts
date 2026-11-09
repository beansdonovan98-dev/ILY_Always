import { Platform } from 'react-native';

import { hasSupabaseEnv, supabase } from '@/lib/supabase';
import { getItem, setItem } from '@/lib/storage';
import { HealthUser } from '@/lib/health';

export type PushEventKind = 'login' | 'cover' | 'playtime' | 'dose' | 'joint';

const TOKEN_KEY = (coupleId: string, user: HealthUser) => `pushToken:${coupleId}:${user}`;

async function loadNotifications() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

/**
 * Registers this phone's APNs device token so the partner can be notified.
 * Uses the native APNs token (no Expo projectId / Expo account required).
 * Requires a native build (expo-notifications) — a safe no-op on web.
 */
export async function registerPushToken(coupleId: string, user: HealthUser): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  try {
    const current = await Notifications.getPermissionsAsync();
    const permission =
      current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return;

    const tokenResp = await Notifications.getDevicePushTokenAsync();
    if (!tokenResp || tokenResp.type !== 'ios') return;
    const deviceToken = tokenResp.data as string;
    if (!deviceToken) return;

    await setItem(TOKEN_KEY(coupleId, user), deviceToken);

    if (hasSupabaseEnv && coupleId) {
      try {
        const { error } = await supabase.from('push_tokens').upsert(
          {
            couple_id: coupleId,
            user_key: user,
            expo_push_token: deviceToken,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'couple_id,user_key' }
        );
        if (error) throw error;
      } catch (e) {
        console.warn('[push] token upload fell back to local cache', e);
      }
    }
  } catch (e) {
    console.warn('[push] token registration skipped', e);
  }
}

/**
 * Tells the `send-push` Edge Function to notify the other partner.
 * No-op until the function is deployed and the tables exist.
 */
export async function notifyPartner(
  coupleId: string,
  user: HealthUser,
  kind: PushEventKind
): Promise<void> {
  if (!coupleId || Platform.OS === 'web') return;
  if (!hasSupabaseEnv) return;

  try {
    const { error } = await supabase.functions.invoke('send-push', {
      body: { couple_id: coupleId, from_user: user, kind },
    });
    if (error) throw error;
  } catch (e) {
    // Function not deployed yet, or offline — the app keeps working.
    console.warn('[push] partner notification skipped', e);
  }
}

export async function readPushToken(coupleId: string, user: HealthUser): Promise<string> {
  return getItem<string>(TOKEN_KEY(coupleId, user), '');
}
