import { supabase } from '@/lib/supabase';
import { getDay, saveDay, localDateKey, getOrCreateDay } from '@/lib/days';

export interface LogEvent {
  id: string;
  couple_id: string;
  emoji: string;
  name: string;
  color: string;
  created_at: string;
}

export interface LogEntry {
  id: string;
  eventId: string | null;
  eventEmoji: string;
  eventName: string;
  eventColor: string;
  whatHappened: string;
  time: string;
  createdAt: number;
}

export const EVENT_COLORS: string[] = [
  '#FF3B30', '#FF6B6B', '#FF9500', '#FFCC00', '#FFD60A', '#34C759', '#30D158', '#00C7BE',
  '#5AC8FA', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#A2845E', '#8E8E93', '#636366',
  '#1C1C1E', '#2C2C2E', '#3A3A3C', '#48484A', '#AEAEB2', '#C7C7CC',
  '#D1D1D6', '#E5E5EA', '#F2F2F7', '#FF6F61', '#6B5B95', '#88B04B', '#F7CAC9', '#92A8D1',
  '#955251', '#B565A7', '#009B77', '#DD4124', '#D65076', '#45B8AC', '#EFC050', '#5B5EA6',
];

export async function getLogEvents(coupleId: string): Promise<LogEvent[]> {
  const { data, error } = await supabase
    .from('log_events')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as LogEvent[];
}

export async function saveLogEvent(coupleId: string, emoji: string, name: string, color: string): Promise<LogEvent> {
  const { data, error } = await supabase
    .from('log_events')
    .insert({ couple_id: coupleId, emoji, name, color })
    .select()
    .single();
  if (error) throw error;
  return data as LogEvent;
}

export async function updateLogEvent(coupleId: string, eventId: string, patch: Partial<Pick<LogEvent, 'emoji' | 'name' | 'color'>>): Promise<LogEvent> {
  const { data, error } = await supabase
    .from('log_events')
    .update(patch)
    .eq('id', eventId)
    .eq('couple_id', coupleId)
    .select()
    .single();
  if (error) throw error;
  return data as LogEvent;
}

export async function deleteLogEvent(coupleId: string, eventId: string): Promise<void> {
  const { error } = await supabase.from('log_events').delete().eq('id', eventId).eq('couple_id', coupleId);
  if (error) throw error;
}

export async function getDayLogEntries(coupleId: string, date = localDateKey()): Promise<LogEntry[]> {
  const day = await getDay(coupleId, date);
  const payload = (day?.payload || {}) as Record<string, unknown>;
  const logs = (payload.logs as LogEntry[]) || [];
  return [...logs].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

export async function addLogEntry(coupleId: string, entry: LogEntry, date = localDateKey()): Promise<LogEntry[]> {
  const day = await getOrCreateDay(coupleId, date);
  const payload = (day.payload || {}) as Record<string, unknown>;
  const logs = ((payload.logs as LogEntry[]) || []).slice();
  logs.push(entry);
  const sorted = logs.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const nextPayload = { ...payload, logs: sorted };
  await saveDay(coupleId, date, nextPayload);
  return sorted;
}

export async function updateLogEntry(coupleId: string, date: string, entryId: string, patch: Partial<LogEntry>): Promise<LogEntry[]> {
  const day = await getDay(coupleId, date);
  const payload = (day?.payload || {}) as Record<string, unknown>;
  const logs = ((payload.logs as LogEntry[]) || []).map((e) => (e.id === entryId ? { ...e, ...patch } : e)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const nextPayload = { ...payload, logs };
  await saveDay(coupleId, date, nextPayload);
  return logs;
}

export async function deleteLogEntry(coupleId: string, entryId: string, date = localDateKey()): Promise<LogEntry[]> {
  const day = await getDay(coupleId, date);
  const payload = (day?.payload || {}) as Record<string, unknown>;
  const logs = ((payload.logs as LogEntry[]) || []).filter((e) => e.id !== entryId);
  const nextPayload = { ...payload, logs };
  await saveDay(coupleId, date, nextPayload);
  return logs;
}