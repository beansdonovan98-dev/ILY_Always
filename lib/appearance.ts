import { supabase } from '@/lib/supabase';
import { getItem, setItem } from '@/lib/storage';

export interface CoupleSettings {
  couple_id: string;
  background_color: string | null;
  background_gradient: string | null;
  accent_color: string | null;
  font_id: string | null;
  font_color: string | null;
  subtitle_color: string | null;
  border_color: string | null;
  animated_gradient: boolean;
  daily_rotation: boolean;
  tab_config: Array<{ id: string; label: string; order: number }> | null;
  playtime_revealed: boolean;
  avatar_daddy: string | null;
  avatar_princess: string | null;
  love_notes: Array<{ id: string; author: string; text: string; created_at: string }> | null;
  updated_at: string;
}

const CACHE_KEY = (coupleId: string) => `coupleSettings:${coupleId}`;

export async function getCoupleSettings(coupleId: string): Promise<CoupleSettings | null> {
  const cached = await getItem<CoupleSettings | null>(CACHE_KEY(coupleId), null);
  try {
    const { data, error } = await supabase
      .from('couple_settings')
      .select('*')
      .eq('couple_id', coupleId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const row = data as CoupleSettings;
      // Never let an older remote row stomp a newer local change —
      // but if the local cache is newer, push it up so both phones converge.
      if (!cached || new Date(row.updated_at) >= new Date(cached.updated_at)) {
        await setItem(CACHE_KEY(coupleId), row);
        return row;
      }
      upsertCoupleSettings(cached as CoupleSettings).catch(() => {});
      return cached;
    }
    if (cached) {
      upsertCoupleSettings(cached).catch(() => {});
      return cached;
    }
  } catch (e) {
    // fallback to cache or defaults
  }
  return cached;
}

export type SyncStatus = 'idle' | 'synced' | 'local';

let syncStatus: SyncStatus = 'idle';
export const getSyncStatus = () => syncStatus;
const setSyncStatus = (status: SyncStatus) => {
  syncStatus = status;
};

export async function upsertCoupleSettings(
  settings: Partial<CoupleSettings> & { couple_id: string }
): Promise<CoupleSettings> {
  const cached = await getItem<CoupleSettings | null>(CACHE_KEY(settings.couple_id), null);
  const payload = {
    ...(cached || {}),
    ...settings,
    updated_at: new Date().toISOString(),
  } as CoupleSettings;

  try {
    const { data, error } = await supabase
      .from('couple_settings')
      .upsert(payload, { onConflict: 'couple_id' })
      .select()
      .single();
    if (error) throw error;
    const row = data as CoupleSettings;
    await setItem(CACHE_KEY(settings.couple_id), row);
    setSyncStatus('synced');
    return row;
  } catch (e) {
    // Local-first: keep the change even if Supabase is unreachable.
    setSyncStatus('local');
    console.warn('[theme] Supabase sync failed — kept local settings.', e);
    await setItem(CACHE_KEY(settings.couple_id), payload);
    return payload;
  }
}

export function subscribeCoupleSettings(
  coupleId: string,
  onChange: (settings: CoupleSettings) => void
): () => void {
  const channel = supabase
    .channel(`couple_settings:${coupleId}:${Math.random().toString(36).slice(2, 9)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'couple_settings', filter: `couple_id=eq.${coupleId}` },
      async (payload) => {
        const next = payload.new as CoupleSettings | undefined;
        if (!next) return;
        const cached = await getItem<CoupleSettings | null>(CACHE_KEY(coupleId), null);
        // older response never overwrites newer setting; if ours is newer,
        // push it up so both phones converge on the same row.
        if (cached && new Date(next.updated_at) < new Date(cached.updated_at)) {
          upsertCoupleSettings(cached).catch(() => {});
          return;
        }
        await setItem(CACHE_KEY(coupleId), next);
        onChange(next);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}