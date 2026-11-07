import { supabase } from '@/lib/supabase';
import { getItem, setItem } from '@/lib/storage';

export interface CoupleSettings {
  couple_id: string;
  background_color: string | null;
  background_gradient: string | null;
  accent_color: string | null;
  font_id: string | null;
  font_color: string | null;
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
      if (!cached || new Date(row.updated_at) >= new Date(cached.updated_at)) {
        await setItem(CACHE_KEY(coupleId), row);
      }
      return row;
    }
  } catch (e) {
    // fallback to cache or defaults
    if (cached) return cached;
    return null;
  }
  return cached;
}

export async function upsertCoupleSettings(settings: Partial<CoupleSettings> & { couple_id: string }): Promise<CoupleSettings> {
  const payload = {
    ...settings,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('couple_settings')
    .upsert(payload, { onConflict: 'couple_id' })
    .select()
    .single();
  if (error) throw error;
  const row = data as CoupleSettings;
  await setItem(CACHE_KEY(settings.couple_id), row);
  return row;
}

export function subscribeCoupleSettings(
  coupleId: string,
  onChange: (settings: CoupleSettings) => void
): () => void {
  const channel = supabase
    .channel(`couple_settings:${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'couple_settings', filter: `couple_id=eq.${coupleId}` },
      async (payload) => {
        const next = payload.new as CoupleSettings | undefined;
        if (!next) return;
        const cached = await getItem<CoupleSettings | null>(CACHE_KEY(coupleId), null);
        // older response never overwrites newer setting
        if (cached && new Date(next.updated_at) < new Date(cached.updated_at)) return;
        await setItem(CACHE_KEY(coupleId), next);
        onChange(next);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}