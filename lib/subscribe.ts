import { supabase } from '@/lib/supabase';

/**
 * Subscribes to row changes for one couple in the given table and fires
 * `onChange` the moment either phone writes. No-op without Supabase env.
 */
export function subscribeCoupleData(
  table: string,
  coupleId: string,
  onChange: () => void
): () => void {
  if (!coupleId) return () => {};
  const channel = supabase
    .channel(`${table}:${coupleId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `couple_id=eq.${coupleId}` },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Multi-table version: fires when any of the listed tables changes. */
export function subscribeMany(
  tables: string[],
  coupleId: string,
  onChange: () => void
): () => void {
  const unsubs = tables.map((t) => subscribeCoupleData(t, coupleId, onChange));
  return () => {
    unsubs.forEach((u) => u());
  };
}
