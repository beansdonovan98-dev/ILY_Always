import { hasSupabaseEnv, supabase } from '@/lib/supabase';
import { HealthUser } from '@/lib/health';
import { UserKey } from '@/constants/content';

/** Writes "I'm on the app right now" for this partner.
 *  Partner app reads it to render the top banner. */
export async function pingPresence(coupleId: string, user: UserKey): Promise<void> {
  if (!coupleId || !hasSupabaseEnv) return;
  try {
    const { error } = await supabase.from('presence').upsert(
      {
        couple_id: coupleId,
        user_key: user,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'couple_id,user_key' }
    );
    if (error) throw error;
  } catch (e) {
    console.warn('[presence] ping fell back silently', e);
  }
}

/** Reads the partner's last-seen timestamp. */
export async function readPresence(coupleId: string, user: UserKey): Promise<number | null> {
  if (!coupleId || !hasSupabaseEnv) return null;
  try {
    const { data, error } = await supabase
      .from('presence')
      .select('last_seen')
      .eq('couple_id', coupleId)
      .eq('user_key', user)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const last = Date.parse(data.last_seen as string);
    if (isNaN(last)) return null;
    return last;
  } catch {
    return null;
  }
}

/** "Is this person online right now?" — pings within the last 90s count. */
export const ONLINE_WINDOW_MS = 90_000;
export const isOnline = (lastSeen: number | null) =>
  lastSeen !== null && Date.now() - lastSeen < ONLINE_WINDOW_MS;
