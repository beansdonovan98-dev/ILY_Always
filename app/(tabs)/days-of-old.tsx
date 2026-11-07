import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { getCoupleId } from '@/lib/couple';
import { getDay, localDateKey } from '@/lib/days';
import { getDayLogEntries, LogEntry } from '@/lib/log';
import { getSignedUrl, MediaRow } from '@/lib/media';
import { supabase } from '@/lib/supabase';

export default function DaysOfOldScreen() {
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
      <Text style={styles.title}>The Days of Old 🧙‍♂️</Text>
      <Text style={styles.loveNote}>Our story, day by day. 📖💕</Text>
      {dates.length === 0 && <Text style={styles.muted}>No past days yet.</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.row}>
          {dates.map((d) => (
            <Pressable key={d} onPress={() => openDate(d)} style={[styles.dateChip, selectedDate === d && styles.dateChipSelected]}>
              <Text style={styles.dateChipText}>{d}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {selectedDate && (
        <View>
          <Text style={styles.sectionTitle}>{selectedDate} (read-only)</Text>
          {entries.length === 0 && <Text style={styles.muted}>No log entries.</Text>}
          {entries.map((e) => (
            <View key={e.id} style={[styles.entryCard, { borderLeftColor: e.eventColor, borderLeftWidth: 4 }]}>
              <Text style={styles.entryTime}>{e.time}</Text>
              <Text style={styles.entryEvent}>{e.eventEmoji} {e.eventName}</Text>
              <Text style={styles.entryText}>{e.whatHappened}</Text>
            </View>
          ))}
          {media.map((m) => (
            <View key={m.id} style={styles.photoCard}>
              <ExpoImage source={{ uri: urls[m.id] || '' }} style={styles.photo} contentFit="contain" />
              <Text style={styles.muted}>{m.file_name}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  muted: { fontSize: 12, opacity: 0.6, marginBottom: 8 },
  loveNote: { fontSize: 14, fontStyle: 'italic', color: '#c2185b', marginTop: 6, marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  dateChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(120,120,120,0.2)', marginRight: 6 },
  dateChipSelected: { backgroundColor: 'rgba(100,150,255,0.4)' },
  dateChipText: { fontWeight: '600', fontSize: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginVertical: 8 },
  entryCard: { padding: 12, marginBottom: 10, borderRadius: 8, backgroundColor: 'rgba(120,120,120,0.12)' },
  entryTime: { fontSize: 11, opacity: 0.6 },
  entryEvent: { fontSize: 15, fontWeight: '700', marginVertical: 2 },
  entryText: { fontSize: 14 },
  photoCard: { marginTop: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.05)' },
  photo: { width: '100%', height: 220 },
});