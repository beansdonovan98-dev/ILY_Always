import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { Image as ExpoImage } from 'expo-image';

import { getCoupleId } from '@/lib/couple';
import { getDay, localDateKey } from '@/lib/days';
import { daySeed } from '@/constants/content';
import { getDayLogEntries, LogEntry, formatTimeForDisplay } from '@/lib/log';
import { getSignedUrl, MediaRow } from '@/lib/media';
import { supabase } from '@/lib/supabase';

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
  const todaySeed = daySeed(new Date());
  const quoteOfDay = TOLKIEN_QUOTES[todaySeed % TOLKIEN_QUOTES.length];
  const [coupleId, setCoupleId] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const cid = await getCoupleId();
      setCoupleId(cid);
      const { data, error } = await supabase
        .from('days')
        .select('local_date')
        .eq('couple_id', cid)
        .order('local_date', { ascending: false });
      if (error) return;
      const today = localDateKey();
      const list = (data || []).map((d: any) => d.local_date).filter((d: string) => d !== today);
      setDates(list);
    })();
  }, []);

  const openDate = useCallback(async (date: string) => {
    setSelectedDate(date);
    const cid = coupleId || (await getCoupleId());
    const logs = await getDayLogEntries(cid, date);
    setEntries(logs);
    const { data } = await supabase
      .from('media')
      .select('*')
      .eq('couple_id', cid)
      .eq('daily_date', date);
    const rows = (data || []) as MediaRow[];
    setMedia(rows);
    const u: Record<string, string> = {};
    await Promise.all(rows.map(async (r) => { try { u[r.id] = await getSignedUrl(r); } catch {} }));
    setUrls(u);
  }, [coupleId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { fontFamily: font }]}>The Days of Old 🧙‍♂️</Text>
      <Text style={[styles.subtitle, { fontFamily: font, color: appTheme.subtitleColor }]}>
        “{quoteOfDay.quote}” — {quoteOfDay.source} 🧙‍♂️
      </Text>
      {dates.length === 0 && <Text style={[styles.muted, { fontFamily: font }]}>No past days yet.</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.row}>
          {dates.map((d) => (
            <Pressable key={d} onPress={() => openDate(d)} style={[[styles.dateChip, appTheme.chipStyle], selectedDate === d && [styles.dateChipSelected, appTheme.activeChipStyle]]}>
              <Text style={styles.dateChipText}>{d}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {selectedDate && (
        <View>
          <Text style={styles.sectionTitle}>{selectedDate} (read-only)</Text>
          {entries.length === 0 && <Text style={[styles.muted, { fontFamily: font }]}>No log entries.</Text>}
          {entries.map((e) => (
            <View key={e.id} style={[[styles.entryCard, appTheme.cardStyle], { borderLeftColor: e.eventColor, borderLeftWidth: 4 }]}>
              <Text style={styles.entryTime}>{formatTimeForDisplay(e.time)}</Text>
              <Text style={styles.entryEvent}>{e.eventEmoji} {e.eventName}</Text>
              <Text style={styles.entryText}>{e.whatHappened}</Text>
            </View>
          ))}
          {media.map((m) => (
            <View key={m.id} style={[styles.photoCard, appTheme.cardStyle]}>
              <ExpoImage source={{ uri: urls[m.id] || '' }} style={styles.photo} contentFit="contain" />
              <Text style={[styles.muted, { fontFamily: font }]}>{m.file_name}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 16, maxWidth: '100%' },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 17, fontStyle: 'italic', lineHeight: 24, marginBottom: 4 },
  muted: { fontSize: 12, opacity: 0.6, marginBottom: 8 },
  loveNote: { fontSize: 14, fontStyle: 'italic', marginTop: 6, marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  dateChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 50, backgroundColor: 'rgba(120,120,120,0.2)', marginRight: 6, borderWidth: 1, borderColor: 'rgba(58,42,46,0.12)' },
  dateChipSelected: { backgroundColor: 'rgba(46,125,79,0.3)' },
  dateChipText: { fontWeight: '600', fontSize: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '800', marginVertical: 8 },
  entryCard: { padding: 14, marginBottom: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', width: '100%' },
  entryTime: { fontSize: 11, opacity: 0.6 },
  entryEvent: { fontSize: 15, fontWeight: '700', marginVertical: 2 },
  entryText: { fontSize: 14 },
  photoCard: { marginTop: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', width: '100%' },
  photo: { width: '100%', height: 220 },
});