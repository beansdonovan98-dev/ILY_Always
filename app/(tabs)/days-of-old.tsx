import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { MylarPouch } from '@/components/MylarPouch';
import { useAppTheme } from '@/hooks/useAppTheme';
import { Image as ExpoImage } from 'expo-image';

import { getCoupleId } from '@/lib/couple';
import { getDay, localDateKey, saveDay } from '@/lib/days';
import { useTabLabel } from '@/hooks/useTabLabel';
import { getItem } from '@/lib/storage';
import { daySeed, USERS } from '@/constants/content';
import { getDayLogEntries, LogEntry, formatTimeForDisplay } from '@/lib/log';
import { getCoupleSettings } from '@/lib/appearance';
import { StashBox } from '@/components/StashBox';
import { getSignedUrl, MediaRow } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { loadDailyTasks, loadDailyChecks } from '@/lib/health';
import { UserKey } from '@/constants/content';

import { useAppFont } from '@/hooks/useAppFont';

export const TOLKIEN_QUOTES: Array<{ quote: string; source: string }> = [
  { quote: 'All we have to decide is what to do with the time that is given us.', source: 'Gandalf, The Fellowship of the Ring' },
  { quote: 'Not all those who wander are lost.', source: 'Aragorn, The Fellowship of the Ring' },
  { quote: 'Even the smallest person can change the course of the future.', source: 'Galadriel, The Fellowship of the Ring' },
  { quote: 'The road goes ever on and on, down from the door where it began.', source: 'Bilbo Baggins, The Fellowship of the Ring' },
  { quote: 'You shall not pass!', source: 'Gandalf, The Fellowship of the Ring' },
  { quote: 'Fly, you fools!', source: 'Gandalf, The Fellowship of the Ring' },
  { quote: 'My precious.', source: 'Gollum, The Fellowship of the Ring' },
  { quote: 'There is some good in this world, Mr. Frodo. And it\u2019s worth fighting for.', source: 'Samwise Gamgee, The Two Towers' },
  { quote: 'Go back, to the shadow!', source: 'Gandalf, The Return of the King' },
  { quote: 'A very fine morning to you, my dear.', source: 'Bilbo Baggins, The Fellowship of the Ring' },
  { quote: 'Far away o\u2019er the Misty Mountains cold, to dungeons deep and caverns old.', source: 'Thorin Oakenshield, The Hobbit: An Unexpected Journey' },
  { quote: 'In a hole in the ground there lived a hobbit.', source: 'Bilbo Baggins, The Hobbit: An Unexpected Journey' },
  { quote: 'The Eagles! The Eagles!', source: 'Gandalf, The Hobbit' },
  { quote: 'They\u2019re taking the Hobbits to Isengard!', source: 'Ugl\u00fak, The Fellowship of the Ring' },
];

export default function DaysOfOldScreen() {
  const font = useAppFont();
  const appTheme = useAppTheme();
  const daysTitle = useTabLabel('days-of-old', 'The Days of Old 🧙‍♂️');
  const todaySeed = daySeed(new Date());
  const quoteOfDay = TOLKIEN_QUOTES[todaySeed % TOLKIEN_QUOTES.length];
  const [coupleId, setCoupleId] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [notes, setNotes] = useState<Array<{ id: string; author: string; text: string; created_at: string }>>([]);
  const [chat, setChat] = useState<Array<{ id: string; text: string; author: UserKey; timestamp: number }>>([]);
  const [healthRows, setHealthRows] = useState<Array<{ label: string; emoji: string; hisDone: boolean; hersDone: boolean }>>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const cid = await getCoupleId();
      setCoupleId(cid);
      const { data, error } = await supabase
        .from('days')
        .select('local_date, payload')
        .eq('couple_id', cid)
        .order('local_date', { ascending: false });
      if (error) return;
      const today = localDateKey();
      const rows: Array<{ local_date: string; payload?: Record<string, unknown> | null }> = (data || []) as any;
      const payloadByDate: Record<string, Record<string, unknown> | null> = {};
      const dayDates = new Set<string>();
      for (const r of rows) {
        const d = r.local_date as string;
        if (!d || d === today) continue;
        dayDates.add(d);
        payloadByDate[d] = (r.payload as Record<string, unknown> | null) ?? null;
      }

      // Midnight archiving: ensure yesterday's local chat is persisted into
      // Days of Old storage (days table payload) if missing — runs on mount
      // (i.e. first app open after local midnight). Love notes already live
      // in couple_settings with timestamps; media already carries daily_date.
      try {
        const yesterday = localDateKey(new Date(Date.now() - 86400000));
        if (yesterday !== today) {
          const localMsgsAll = await getItem<Array<{ id: string; text: string; author: UserKey; timestamp: number; dateKey?: string }>>('playtimeMessages', []);
          const yMsgs = localMsgsAll
            .filter((m) => (m.dateKey ?? localDateKey(new Date(m.timestamp))) === yesterday)
            .sort((a, b) => a.timestamp - b.timestamp);
          if (yMsgs.length > 0) {
            const existing = await getDay(cid, yesterday);
            const remote = (existing?.payload?.playtimeChat as Array<{ id: string }> | undefined) || [];
            const remoteIds = new Set(remote.map((m) => m.id));
            if (yMsgs.some((m) => !remoteIds.has(m.id))) {
              await saveDay(cid, yesterday, { ...(existing?.payload || {}), playtimeChat: yMsgs });
              if (!payloadByDate[yesterday]) payloadByDate[yesterday] = { playtimeChat: yMsgs } as any;
              dayDates.add(yesterday);
            }
          }
        }
      } catch {}

      // Bulk sources checked once per mount (existing loaders + storage).
      const settings: any = await getCoupleSettings(cid);
      const allNotes: Array<{ created_at?: string }> = settings?.love_notes || [];
      const noteDates = new Set(allNotes.map((n: any) => (n.created_at || '').slice(0, 10)).filter(Boolean));

      const allMsgs = await getItem<Array<{ timestamp: number; dateKey?: string }>>('playtimeMessages', []);
      const chatDates = new Set(
        allMsgs.map((m: any) => m.dateKey ?? localDateKey(new Date(m.timestamp))).filter(Boolean)
      );
      // Also consider remote playtimeChat archived in days payloads.
      for (const r of rows) {
        const d = r.local_date as string;
        const p: any = r.payload;
        const chats = p?.playtimeChat;
        if (Array.isArray(chats) && chats.length > 0) {
          chatDates.add(d);
          for (const m of chats) {
            chatDates.add(m.dateKey ?? (m.timestamp ? localDateKey(new Date(m.timestamp)) : d));
          }
        }
      }

      const tasks = await loadDailyTasks(cid);
      const hisChecks = await loadDailyChecks(cid, 'daddy');
      const hersChecks = await loadDailyChecks(cid, 'princess');
      const healthDates = new Set<string>();
      const taskIds = new Set(tasks.map((t) => t.id));
      for (const [k, v] of Object.entries(hisChecks)) {
        if (!v) continue;
        const [taskId, date] = k.split('|');
        if (taskIds.has(taskId) && date) healthDates.add(date);
      }
      for (const [k, v] of Object.entries(hersChecks)) {
        if (!v) continue;
        const [taskId, date] = k.split('|');
        if (taskIds.has(taskId) && date) healthDates.add(date);
      }

      // Media daily dates: ALL media (both kinds), plus created_at-derived dates
      // so rows show even if daily_date differs (UTC vs local).
      const mediaDates = new Set<string>();
      const { data: mediaData } = await supabase
        .from('media')
        .select('daily_date, created_at')
        .eq('couple_id', cid);
      for (const m of (mediaData || []) as Array<{ daily_date?: string | null; created_at?: string }>) {
        if (m.daily_date) mediaDates.add(m.daily_date);
        if (m.created_at) {
          try { mediaDates.add(localDateKey(new Date(m.created_at))); } catch {}
        }
      }

      // Candidate = union of every archive source (past dates only).
      const candidateSet = new Set<string>();
      for (const s of [dayDates, noteDates, chatDates, mediaDates, healthDates]) {
        for (const d of s) if (d && d !== today) candidateSet.add(d);
      }
      const candidate = [...candidateSet].sort().reverse();

      // Per-date log entries (existing loader).
      const logDates = new Set<string>();
      await Promise.all(
        candidate.map(async (date) => {
          try {
            const logs = await getDayLogEntries(cid, date);
            if (logs && logs.length > 0) logDates.add(date);
          } catch {
            // treat as no logs
          }
        })
      );
      for (const d of logDates) if (d !== today) candidateSet.add(d);

      const hasPayload = (date: string) => {
        const p: any = payloadByDate[date];
        if (!p) return false;
        if (Array.isArray(p)) return p.length > 0;
        if (typeof p === 'object') return Object.keys(p).length > 0;
        return Boolean(p);
      };

      const filtered = [...candidateSet]
        .filter((d) => d !== today)
        .filter(
          (date) =>
            hasPayload(date) || logDates.has(date) || noteDates.has(date) || chatDates.has(date) || mediaDates.has(date) || healthDates.has(date)
        )
        .sort()
        .reverse();
      setDates(filtered);
    })();
  }, []);

  const openDate = useCallback(async (date: string) => {
    setSelectedDate(date);
    const cid = coupleId || (await getCoupleId());
    const logs = await getDayLogEntries(cid, date);
    setEntries(logs);

    // Love notes: any note whose timestamp falls on `date` (not today-only).
    const settings = await getCoupleSettings(cid);
    const allNotes = settings?.love_notes || [];
    setNotes(allNotes.filter((n: any) => (n.created_at || '').slice(0, 10) === date));

    // Playtime chat: merge local storage with remote days-payload archive.
    const allMsgs = await getItem<Array<{ id: string; text: string; author: UserKey; timestamp: number; dateKey?: string }>>('playtimeMessages', []);
    const localForDate = allMsgs.filter((m) => (m.dateKey ?? localDateKey(new Date(m.timestamp))) === date);
    let remoteForDate: typeof localForDate = [];
    try {
      const dayRow = await getDay(cid, date);
      const remote = (dayRow?.payload?.playtimeChat as typeof localForDate | undefined) || [];
      remoteForDate = remote.filter((m) => (m.dateKey ?? localDateKey(new Date(m.timestamp))) === date);
    } catch {}
    const mergedById = new Map(localForDate.map((m) => [m.id, m]));
    for (const m of remoteForDate) if (!mergedById.has(m.id)) mergedById.set(m.id, m);
    const mergedChat = [...mergedById.values()].sort((a, b) => a.timestamp - b.timestamp);
    setChat(mergedChat);
    // Persist backfill: local chat not yet in Days of Old storage gets archived.
    try {
      if (mergedChat.length > 0) {
        const dayRow = await getDay(cid, date);
        const remoteIds = new Set(((dayRow?.payload?.playtimeChat as Array<{ id: string }> | undefined) || []).map((m) => m.id));
        if (mergedChat.some((m) => !remoteIds.has(m.id))) {
          await saveDay(cid, date, { ...(dayRow?.payload || {}), playtimeChat: mergedChat });
        }
      }
    } catch {}

    const tasks = await loadDailyTasks(cid);
    const hisChecks = await loadDailyChecks(cid, 'daddy');
    const hersChecks = await loadDailyChecks(cid, 'princess');
    setHealthRows(
      tasks.map((t) => ({
        label: t.label,
        emoji: t.emoji,
        hisDone: Boolean(hisChecks[`${t.id}|${date}`]),
        hersDone: Boolean(hersChecks[`${t.id}|${date}`]),
      }))
    );

    // Media: cover photos (shared) + playtime photos (private) for `date`.
    // Primary: daily_date == date. Fallback: created_at within that local day
    // so rows display even if daily_date differs (UTC vs local mismatch).
    const seen = new Map<string, MediaRow>();
    const { data } = await supabase
      .from('media')
      .select('*')
      .eq('couple_id', cid)
      .eq('daily_date', date);
    for (const r of ((data || []) as MediaRow[])) seen.set(r.id, r);
    try {
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(start.getTime() + 86400000);
      const { data: byCreated } = await supabase
        .from('media')
        .select('*')
        .eq('couple_id', cid)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString());
      for (const r of ((byCreated || []) as MediaRow[])) seen.set(r.id, r);
    } catch {}
    const rows = [...seen.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setMedia(rows);
    const u: Record<string, string> = {};
    await Promise.all(rows.map(async (r) => { try { u[r.id] = await getSignedUrl(r); } catch {} }));
    setUrls(u);
  }, [coupleId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { fontFamily: font }]}>{daysTitle}</Text>
      <Text style={[styles.subtitle, { fontFamily: font, color: appTheme.subtitleColor }]}>
        “{quoteOfDay.quote}” — {quoteOfDay.source} 🧙‍♂️
      </Text>

      {/* Stash Box right under the quote: jar archive + strain badges */}
      <StashBox dates={dates} selectedDate={selectedDate} onPick={openDate} detail={selectedDate ? (
        <View>
          <Text style={styles.sectionTitle}>{selectedDate} (read-only)</Text>
          <Text style={styles.sectionSub}>Our Log 📜</Text>
          {entries.length === 0 && <Text style={[styles.muted, { fontFamily: font }]}>No log entries.</Text>}
          {entries.map((e) => (
            <MylarPouch key={e.id} title={<Text style={styles.entryEvent}>{e.eventEmoji} {e.eventName}</Text>} defaultStrain="GRANDDADDY P." stampRight="THC: 28.5%" style={{ borderLeftColor: e.eventColor, borderLeftWidth: 4 }}>
              <Text style={styles.entryTime}>{formatTimeForDisplay(e.time)}</Text>
              <Text style={styles.entryEvent}>{e.eventEmoji} {e.eventName}</Text>
              <Text style={styles.entryText}>{e.whatHappened}</Text>
            </MylarPouch>
          ))}

          <Text style={styles.sectionSub}>Love Notes 💌</Text>
          {notes.length === 0 && <Text style={[styles.muted, { fontFamily: font }]}>No love notes this day.</Text>}
          {notes.map((n) => (
            <MylarPouch key={n.id} title={<Text style={styles.chatAuthor}>{USERS[n.author as keyof typeof USERS]?.label || n.author} • {new Date(n.created_at).toLocaleDateString()}</Text>} defaultStrain="SOUR DIESEL" stampRight="THC: 21.5%">
              <Text style={styles.entryText}>{n.text}</Text>
              <Text style={styles.muted}>{USERS[n.author as keyof typeof USERS]?.label || n.author} • {new Date(n.created_at).toLocaleString()}</Text>
            </MylarPouch>
          ))}

          <Text style={styles.sectionSub}>Daily Health List 🌿</Text>
          {healthRows.length === 0 && <Text style={[styles.muted, { fontFamily: font }]}>No checks logged.</Text>}
          {healthRows.map((h) => (
            <MylarPouch key={h.label} title={<Text style={styles.entryEvent}>{h.emoji} {h.label}</Text>} defaultStrain="PINEAPPLE EXP." stampRight="THC: 24.5%">
              <Text style={styles.entryText}>{h.emoji} {h.label}</Text>
              <View style={styles.healthMarks}>
                <Text style={styles.healthMark}>{h.hisDone ? '✓ His 🍆' : '○ His'}</Text>
                <Text style={styles.healthMark}>{h.hersDone ? '✓ Hers 🍑' : '○ Hers'}</Text>
              </View>
            </MylarPouch>
          ))}

          <Text style={styles.sectionSub}>Covers & Playtime 📸</Text>
          {chat.length === 0 && media.length === 0 && <Text style={[styles.muted, { fontFamily: font }]}>No chats or photos this day.</Text>}
          {chat.map((m) => (
            <MylarPouch key={m.id} title={<Text style={styles.chatAuthor}>{USERS[m.author]?.label || m.author}</Text>} defaultStrain="STRAWBERRY COUGH" stampRight="THC: 27.5%">
              <Text style={styles.chatAuthor}>{USERS[m.author]?.label || m.author}</Text>
              <Text style={styles.entryText}>{m.text}</Text>
              <Text style={styles.muted}>{new Date(m.timestamp).toLocaleTimeString()}</Text>
            </MylarPouch>
          ))}
          {media.map((m) => (
            <MylarPouch key={m.id} title={<Text style={styles.entryEvent}>{m.file_name}</Text>} defaultStrain="BLUE DREAM" stampRight="THC: 22.5%">
              <ExpoImage source={{ uri: urls[m.id] || '' }} style={styles.photo} contentFit="contain" />
              <Text style={[styles.muted, { fontFamily: font }]}>{m.file_name}</Text>
            </MylarPouch>
          ))}
        </View>
      ) : null} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 36, maxWidth: '100%' },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 17, fontStyle: 'italic', lineHeight: 24, marginBottom: 4 },
  muted: { fontSize: 12, opacity: 0.6, marginBottom: 8 },
  loveNote: { fontSize: 14, fontStyle: 'italic', marginTop: 6, marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  dateChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 50, backgroundColor: 'rgba(120,120,120,0.2)', marginRight: 6, borderWidth: 1, borderColor: 'rgba(58,42,46,0.12)' },
  dateChipSelected: { backgroundColor: 'rgba(46,125,79,0.3)' },
  dateChipText: { fontWeight: '600', fontSize: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '800', marginVertical: 8 },
  sectionSub: { fontSize: 15, fontWeight: '800', opacity: 0.8, marginTop: 16, marginBottom: 6 },
  noteCard: { padding: 12, marginBottom: 8, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.4)' },
  healthRow: { padding: 12, marginBottom: 8, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.4)' },
  healthMarks: { flexDirection: 'row', gap: 12, marginTop: 4 },
  healthMark: { fontSize: 12, fontWeight: '700', opacity: 0.8 },
  chatRow: { padding: 12, marginBottom: 8, borderRadius: 14, opacity: 0.95 },
  chatAuthor: { fontWeight: '700', fontSize: 12, marginBottom: 2 },
  entryCard: { padding: 14, marginBottom: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', width: '100%' },
  entryTime: { fontSize: 11, opacity: 0.6 },
  entryEvent: { fontSize: 15, fontWeight: '700', marginVertical: 2 },
  entryText: { fontSize: 14 },
  photoCard: { marginTop: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', width: '100%' },
  photo: { width: '100%', height: 220 },
});