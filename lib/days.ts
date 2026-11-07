import { supabase } from '@/lib/supabase';

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface DayRow {
  couple_id: string;
  local_date: string;
  payload: Record<string, unknown>;
  updated_at: string;
}

export async function getDay(coupleId: string, localDate: string): Promise<DayRow | null> {
  const { data, error } = await supabase
    .from('days')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('local_date', localDate)
    .maybeSingle();
  if (error) throw error;
  return (data as DayRow) || null;
}

export async function getOrCreateDay(coupleId: string, localDate = localDateKey()): Promise<DayRow> {
  const existing = await getDay(coupleId, localDate);
  if (existing) return existing;
  const { data, error } = await supabase
    .from('days')
    .insert({ couple_id: coupleId, local_date: localDate, payload: {}, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as DayRow;
}

export async function saveDay(coupleId: string, localDate: string, payload: Record<string, unknown>): Promise<DayRow> {
  const { data, error } = await supabase
    .from('days')
    .upsert(
      { couple_id: coupleId, local_date: localDate, payload, updated_at: new Date().toISOString() },
      { onConflict: 'couple_id,local_date' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as DayRow;
}

// Manual reset: clears only payload for one specific date. Never touches appearance, profiles, invite code, saved templates, private history, or other dates.
export async function resetDay(coupleId: string, localDate: string): Promise<void> {
  await saveDay(coupleId, localDate, {});
}