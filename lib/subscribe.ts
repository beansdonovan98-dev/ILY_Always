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
  // Unique topic per subscription — two screens listening to the same table
  // must not share a channel name or Realtime rejects the duplicate.
  const topic = `${table}:${coupleId}:${Math.random().toString(36).slice(2, 9)}`;
  const channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `couple_id=eq.${coupleId}` },
      () => {
        onChange();
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[realtime] subscription problem for', table, '-- table must be in the supabase_realtime publication (SQL doc).');
      }
    });

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
