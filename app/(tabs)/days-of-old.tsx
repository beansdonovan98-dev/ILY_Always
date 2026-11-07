import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { Image as ExpoImage } from 'expo-image';

import { getCoupleId } from '@/lib/couple';
import { getDay, localDateKey } from '@/lib/days';
import { daySeed } from '@/constants/content';
import { getDayLogEntries, LogEntry } from '@/lib/log';
import { getSignedUrl, MediaRow } from '@/lib/media';
import { supabase } from '@/lib/supabase';

import { useAppFont } from '@/hooks/useAppFont';

export const TOLKIEN_QUOTES: Array<{ quote: string; source: string }> = [
  { quote: 'All we have to decide is what to do with the time that is given us.', source: 'Gandalf, The Lord of the Rings' },
  { quote: 'Not all those who wander are lost.', source: 'Bilbo Baggins, The Lord of the Rings' },
  { quote: 'Even the smallest person can change the course of the future.', source: 'Galadriel, The Lord of the Rings' },
  { quote: 'The road goes ever on and on, down from the door where it began.', source: 'Bilbo Baggins, The Lord of the Rings' },
  { quote: 'It is not the strength of the body, but the strength of the spirit.', source: 'J.R.R. Tolkien' },
  { quote: 'Success is not the same as endurance.', source: 'Gandalf, The Lord of the Rings' },
  { quote: 'A journey of a thousand miles begins with a single step.', source: 'Gandalf — this one practically wrote itself for us' },
  { quote: 'In a hole in the ground there lived a hobbit.', source: 'J.R.R. Tolkien, The Hobbit' },
  { quote: 'I feel good, I know I should be feeling bad.', source: 'Bilbo Baggins, The Hobbit' },
  { quote: 'Far below the misty mountains, your gold can lie did we not yearn...', source: 'Thorin, The Hobbit' },
  { quote: 'Some believe it is only great power that can hold evil in check, but that is not what I have found.', source: 'Gandalf, The Hobbit' },
  { quote: 'Beyond the forest, the mountains have been named, and there has already been a storm of snow.', source: 'Bilbo Baggins, The Hobbit' },
  { quote: 'It always comes in the end.', source: 'Bilbo Baggins, The Hobbit' },
  { quote: 'Third age, third age, third age.', source: 'Gandalf, The Hobbit' },
  { quote: 'The greatest adventure is yet to come.', source: 'Gandalf, The Hobbit' },
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
              <Text style={styles.entryTime}>{e.time}</Text>
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
  subtitle: { fontSize: 17, lineHeight: 24, marginBottom: 4 },
  muted: { fontSize: 12, opacity: 0.6, marginBottom: 8 },
  loveNote: { fontSize: 14, fontStyle: 'italic', marginTop: 6, marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  dateChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(120,120,120,0.2)', marginRight: 6 },
  dateChipSelected: { backgroundColor: 'rgba(100,150,255,0.4)' },
  dateChipText: { fontWeight: '600', fontSize: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginVertical: 8 },
  entryCard: { padding: 12, marginBottom: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', width: '100%' },
  entryTime: { fontSize: 11, opacity: 0.6 },
  entryEvent: { fontSize: 15, fontWeight: '700', marginVertical: 2 },
  entryText: { fontSize: 14 },
  photoCard: { marginTop: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', width: '100%' },
  photo: { width: '100%', height: 220 },
});