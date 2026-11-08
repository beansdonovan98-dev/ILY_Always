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
  '#FFFFFF', '#F2F2F7', '#E5E5EA', '#AEAEB2', '#8E8E93',
  '#C7C7CC', '#D1D1D6', '#636366',
  '#FF3B30', '#FF2D55', '#FF9500', '#FFCC00', '#FFD60A',
  '#FF6B6B', '#FF6F61', '#FF6F91', '#D65076', '#955251',
  '#A2845E', '#A5D6A7', '#34C759', '#30D158', '#00C7BE', '#88B04B', '#009B77',
  '#5AC8FA', '#92A8D1', '#007AFF', '#5856D6', '#5B5EA6',
  '#AF52DE', '#6B5B95', '#B565A7', '#DD4124', '#45B8AC',
  '#EFC050', '#F7CAC9', '#1C1C1E', '#2C2C2E', '#3A3A3C', '#48484A',
];

/** Accepts "7:30 PM", "07:30pm", "19:30", "7:30" → normalized "HH:MM" (24h, zero-padded). */
export function parseTimeInput(input: string): string {
  const raw = input.trim().toLowerCase().replace(/\s+/g, '');
  const twelve = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(raw);
  if (twelve) {
    let hour = Number(twelve[1]);
    const minute = Number(twelve[2] || 0);
    if (hour < 1 || hour > 12 || minute > 59) return input.trim();
    if (twelve[3] === 'pm' && hour !== 12) hour += 12;
    if (twelve[3] === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour > 23 || minute > 59) return input.trim();
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  return input.trim();
}

function timeToMinutes(time: string): number {
  const parsed = parseTimeInput(time);
  const match = /^(\d{1,2}):(\d{2})$/.exec(parsed);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Stored "19:30" → display "7:30 PM". */
export function formatTimeForDisplay(time: string): string {
  const normalized = parseTimeInput(time);
  const match = /^(\d{1,2}):(\d{2})$/.exec(normalized);
  if (!match) return time;
  const hour24 = Number(match[1]);
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${match[2]} ${suffix}`;
}

/** Earliest first, comparing actual clock time; unparseable times sink to the end. */
export function sortEntriesByTime(entries: LogEntry[]): LogEntry[] {
  return [...entries].sort((a, b) => {
    const diff = timeToMinutes(a.time) - timeToMinutes(b.time);
    return diff !== 0 ? diff : a.createdAt - b.createdAt;
  });
}

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
  return sortEntriesByTime(logs);
}

export async function addLogEntry(coupleId: string, entry: LogEntry, date = localDateKey()): Promise<LogEntry[]> {
  const day = await getOrCreateDay(coupleId, date);
  const payload = (day.payload || {}) as Record<string, unknown>;
  const logs = ((payload.logs as LogEntry[]) || []).slice();
  logs.push(entry);
  const sorted = sortEntriesByTime(logs);
  const nextPayload = { ...payload, logs: sorted };
  await saveDay(coupleId, date, nextPayload);
  return sorted;
}

export async function updateLogEntry(coupleId: string, date: string, entryId: string, patch: Partial<LogEntry>): Promise<LogEntry[]> {
  const day = await getDay(coupleId, date);
  const payload = (day?.payload || {}) as Record<string, unknown>;
  const logs = sortEntriesByTime(((payload.logs as LogEntry[]) || []).map((e) => (e.id === entryId ? { ...e, ...patch } : e)));
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