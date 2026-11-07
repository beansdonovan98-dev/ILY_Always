import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { COVER_PHOTO_POOL, daySeed, pickDailyItems, todayKey } from '@/constants/content';
import { getItem, setItem } from '@/lib/storage';
import { useUsage } from '@/contexts/UsageContext';
import AvatarChips from '@/components/AvatarChips';
import { formatDuration } from '@/hooks/useDailyUsage';
import { getCoupleId } from '@/lib/couple';
import { getSignedUrl, MediaRow, resolveMime, updateCaption, uploadMedia, validateSize } from '@/lib/media';
import { supabase } from '@/lib/supabase';

// placeholders for word/fact selection
import {
  FACTS_OF_THE_DAY,
  RELATIONSHIP_START,
  USERS,
  WORDS_OF_THE_DAY,
} from '@/constants/content';

const CAPTIONS_KEY = 'coverCaptions';

export default function HomeScreen() {
  const { usage, currentUser, setCurrentUser, ready } = useUsage();

  const [coupleId, setCoupleId] = useState('');
  const [coverMedia, setCoverMedia] = useState<MediaRow[]>([]);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // relationship elapsed
  const relationshipElapsed = useMemo(() => {
    const diff = now.getTime() - RELATIONSHIP_START.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    return { days, hours, mins, secs };
  }, [now]);

  // word & fact of day
  const wordOfDay = useMemo(() => {
    const seed = daySeed(now);
    return WORDS_OF_THE_DAY[seed % WORDS_OF_THE_DAY.length];
  }, [now]);
  const factOfDay = useMemo(() => {
    const seed = daySeed(now) + 3;
    return FACTS_OF_THE_DAY[seed % FACTS_OF_THE_DAY.length];
  }, [now]);

  // cover media (shared, today)
  const [todayKeyState, setTodayKeyState] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => {
    const t = setInterval(() => {
      const k = new Date().toISOString().slice(0, 10);
      if (k !== todayKeyState) setTodayKeyState(k);
    }, 30000);
    return () => clearInterval(t);
  }, [todayKeyState]);

  const today = todayKeyState;
  const loadCoverMedia = useCallback(async () => {
    const cid = await getCoupleId();
    setCoupleId(cid);
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('couple_id', cid)
      .eq('kind', 'shared')
      .eq('daily_date', today)
      .order('created_at', { ascending: false });
    if (error) return;
    const rows = (data || []) as MediaRow[];
    setCoverMedia(rows);
    const urls: Record<string, string> = {};
    await Promise.all(rows.map(async (r) => { try { urls[r.id] = await getSignedUrl(r); } catch {} }));
    setCoverUrls(urls);
  }, [today]);

  const uploadCover = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled) return;
    const cid = coupleId || (await getCoupleId());
    for (const asset of result.assets) {
      try {
        const mimeType = resolveMime({ mimeType: asset.mimeType, fileName: asset.fileName, uri: asset.uri });
        const byteSize = asset.fileSize || 0;
        validateSize(byteSize);
        const row = await uploadMedia({
          coupleId: cid,
          kind: 'shared',
          localUri: asset.uri,
          fileName: asset.fileName || `cover-${Date.now()}.jpg`,
          mimeType,
          byteSize,
          width: asset.width ?? null,
          height: asset.height ?? null,
          uploadedBy: currentUser,
          dailyDate: today,
        });
        setCoverMedia((prev) => [row, ...prev]);
        try {
          const url = await getSignedUrl(row);
          setCoverUrls((prev) => ({ ...prev, [row.id]: url }));
        } catch {}
      } catch (e) {
        console.warn('Cover upload failed', e);
      }
    }
  }, [coupleId, currentUser, today]);

  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCaption, setDraftCaption] = useState('');

  useEffect(() => {
    (async () => {
      const stored = await getItem<Record<string, string>>(CAPTIONS_KEY, {});
      setCaptions(stored);
    })();
  }, []);

  const saveCaption = useCallback(async (id: string) => {
    const next = { ...captions, [id]: draftCaption };
    setCaptions(next);
    await setItem(CAPTIONS_KEY, next);
    setEditingId(null);
  }, [captions, draftCaption]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AvatarChips active={currentUser} onChange={setCurrentUser} />
      <Text style={styles.header}>Home Is Where the Heart Is 💗</Text>
      <Text style={styles.subheader}>Daddy 🍆 & Princess 🍑</Text>

      {/* Active user selector */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Who's using now?</Text>
        <View style={styles.row}>
          {(['daddy', 'princess'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => setCurrentUser(k)}
              style={[styles.userBtn, currentUser === k && styles.userBtnActive]}>
              <Text style={styles.userBtnText}>{USERS[k].label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Relationship tracker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Relationship Tracker 💞</Text>
        <Text style={styles.body}>Together since 08/09/19</Text>
        <Text style={styles.big}>
          {relationshipElapsed.days}d {relationshipElapsed.hours}h {relationshipElapsed.mins}m {relationshipElapsed.secs}s
        </Text>
      </View>

      {/* Word & Fact */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Word of the Day 📖</Text>
        <Text style={styles.big}>{wordOfDay.word}</Text>
        <Text style={styles.body}>{wordOfDay.definition}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fact of the Day 🧠</Text>
        <Text style={styles.body}>{factOfDay}</Text>
      </View>

      {/* Usage tracker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Time on App Today ⏱️</Text>
        <Text style={styles.body}>Daddy 🍆: {formatDuration(usage.daddy)}</Text>
        <Text style={styles.body}>Princess 🍑: {formatDuration(usage.princess)}</Text>
        <Text style={styles.muted}>Resets at midnight. Active: {USERS[currentUser as keyof typeof USERS].label}</Text>
      </View>

      {/* Cover photos (shared, reset daily) */}
      <Text style={styles.sectionTitle}>Cover Photos 🖼️ (reset daily)</Text>
      <Pressable style={styles.smallBtn} onPress={uploadCover}><Text style={styles.smallBtnText}>Upload Cover (max 60MB)</Text></Pressable>
      {coverMedia.map((photo) => (
        <View key={photo.id} style={styles.photoCard}>
          <ExpoImage source={{ uri: coverUrls[photo.id] || '' }} style={styles.photo} contentFit="contain" />
          <View style={styles.captionRow}>
            {editingCaptionId === photo.id ? (
              <View style={{ flex: 1 }}>
                <TextInput value={captionDraft} onChangeText={setCaptionDraft} placeholder="Enter caption..." style={styles.input} multiline />
                <View style={styles.row}>
                  <Pressable onPress={async () => { await updateCaption(photo.id, currentUser, captionDraft); setEditingCaptionId(null); loadCoverMedia(); }} style={styles.smallBtn}><Text style={styles.smallBtnText}>Save</Text></Pressable>
                  <Pressable onPress={() => setEditingCaptionId(null)} style={styles.smallBtnSecondary}><Text style={styles.smallBtnText}>Cancel</Text></Pressable>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <Text style={styles.caption}>{(photo.captions && photo.captions[currentUser]) || photo.caption || 'No caption yet'}</Text>
                <Text style={styles.muted}>Partner: {(photo.captions && photo.captions[currentUser === 'daddy' ? 'princess' : 'daddy']) || ''}</Text>
                <Pressable onPress={() => { setEditingCaptionId(photo.id); setCaptionDraft((photo.captions && photo.captions[currentUser]) || photo.caption || ''); }} style={styles.smallBtn}><Text style={styles.smallBtnText}>Edit My Caption</Text></Pressable>
              </View>
            )}
          </View>
        </View>
      ))}
      {coverMedia.length === 0 && <Text style={styles.muted}>No cover photos yet. Upload one.</Text>}

      {!ready && <Text style={styles.muted}>Loading...</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { fontSize: 30, fontWeight: 'bold', marginBottom: 8, color: '#111' },
  subheader: { fontSize: 17, marginBottom: 16, opacity: 0.7, color: '#333' },
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#111' },
  body: { fontSize: 17, marginBottom: 6, color: '#222', lineHeight: 24 },
  big: { fontSize: 26, fontWeight: 'bold', color: '#111' },
  muted: { fontSize: 13, opacity: 0.6, marginTop: 4, color: '#444' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  userBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(120,120,120,0.2)',
  },
  userBtnActive: { backgroundColor: 'rgba(100,150,255,0.4)' },
  userBtnText: { fontWeight: '600' },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginVertical: 10, color: '#111' },
  photoCard: { marginBottom: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.9)', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  photo: { width: '100%', height: 180 },
  captionRow: { padding: 10 },
  caption: { fontSize: 14, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.4)',
    borderRadius: 8,
    padding: 8,
    minHeight: 40,
    marginBottom: 8,
  },
  smallBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(100,150,255,0.4)',
    marginRight: 8,
  },
  smallBtnSecondary: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(120,120,120,0.3)',
  },
  smallBtnText: { fontWeight: '600' },
});