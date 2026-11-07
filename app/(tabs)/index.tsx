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
import { getCoupleId } from '@/lib/couple';
import { getCoupleSettings, upsertCoupleSettings } from '@/lib/appearance';
import { formatDuration } from '@/hooks/useDailyUsage';
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

import { useAppFont } from '@/hooks/useAppFont';

export default function HomeScreen() {
  const font = useAppFont();
  const { usage, currentUser, setCurrentUser, ready } = useUsage();

  const [coupleId, setCoupleId] = useState('');
  const [loveNotes, setLoveNotes] = useState<Array<{ id: string; author: string; text: string; created_at: string }>>([]);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    (async () => {
      const cid = await getCoupleId();
      setCoupleId(cid);
      const s = await getCoupleSettings(cid);
      setLoveNotes(s?.love_notes || []);
    })();
  }, []);

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
      <Text style={[styles.header, { fontFamily: font }]}>Home Is Where the Heart Is 💗</Text>
      <Text style={[styles.subtitle, { fontFamily: font }]}>Our shared space, updated live ✨</Text>
      <Text style={styles.subheader}>Daddy 🍆 & Princess 🍑</Text>

      {/* Active user selector */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Who's using now?</Text>
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
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Relationship Tracker 💞</Text>
        <Text style={[styles.body, { fontFamily: font }]}>Together since 08/09/19</Text>
        <Text style={[styles.big, { fontFamily: font }]}>
          {relationshipElapsed.days}d {relationshipElapsed.hours}h {relationshipElapsed.mins}m {relationshipElapsed.secs}s
        </Text>
        <Text style={styles.loveNote}>Every second with you is my favorite. 💗</Text>
      </View>

      {/* Word & Fact */}

      {/* Word & Fact */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Word of the Day 📖</Text>
        <Text style={[styles.big, { fontFamily: font }]}>{wordOfDay.word}</Text>
        <Text style={[styles.body, { fontFamily: font }]}>{wordOfDay.pronunciation}</Text>
        <Text style={[styles.body, { fontFamily: font }]}>{wordOfDay.definition}</Text>
        <Text style={[styles.loveNote, { fontFamily: font }]}>{wordOfDay.example}</Text>
        <Text style={[styles.muted, { fontFamily: font }]}>Learning and loving new words together 📖💕</Text>
      </View>
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Fact of the Day 🧠</Text>
        <Text style={[styles.body, { fontFamily: font }]}>{factOfDay}</Text>
        <Text style={styles.loveNote}>Every fact is better when shared with you. 🌸</Text>
      </View>

      {/* Usage tracker */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Time on App Today ⏱️</Text>
        <Text style={[styles.body, { fontFamily: font }]}>Daddy 🍆: {formatDuration(usage.daddy)}</Text>
        <Text style={[styles.body, { fontFamily: font }]}>Princess 🍑: {formatDuration(usage.princess)}</Text>
        <Text style={[styles.muted, { fontFamily: font }]}>Resets at midnight. Active: {USERS[currentUser as keyof typeof USERS].label}</Text>
        <Text style={styles.loveNote}>Every moment together counts. ⏳❤️</Text>
      </View>

      {/* Cover photos (shared, reset daily) */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Love Notes 💌</Text>
        <Text style={[styles.muted, { fontFamily: font }]}>Little whispers for your heart 💌</Text>
        {loveNotes.map((n) => (
          <View key={n.id} style={styles.noteCard}>
            <Text style={[styles.body, { fontFamily: font }]}>{n.text}</Text>
            <Text style={[styles.muted, { fontFamily: font }]}>{n.author} • {new Date(n.created_at).toLocaleString()}</Text>
          </View>
        ))}
        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder="Leave a sweet note..."
          style={styles.input}
          multiline
        />
        <Pressable
          style={styles.smallBtn}
          onPress={async () => {
            if (!noteDraft.trim()) return;
            const note = { id: `${Date.now()}`, author: currentUser, text: noteDraft.trim(), created_at: new Date().toISOString() };
            const next = [...loveNotes, note];
            setLoveNotes(next);
            setNoteDraft('');
            const s = await getCoupleSettings(coupleId);
            await upsertCoupleSettings({ couple_id: coupleId, love_notes: next, updated_at: new Date().toISOString() });
          }}>
          <Text style={[styles.smallBtnText, { fontFamily: font }]}>Send Note</Text>
        </Pressable>
      </View>
      <Text style={styles.loveNote}>Our favorite faces, every single day. 💕</Text>
      <Text style={[styles.sectionTitle, { fontFamily: font }]}>Cover Photos 🖼️ (reset daily)</Text>
      <Text style={[styles.muted, { fontFamily: font }]}>Our favorite snap right now 📸✨</Text>
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
                <Text style={[styles.muted, { fontFamily: font }]}>Status: Today's cover 📸</Text>
                <Text style={[styles.muted, { fontFamily: font }]}>Partner: {(photo.captions && photo.captions[currentUser === 'daddy' ? 'princess' : 'daddy']) || ''}</Text>
                <Pressable onPress={() => { setEditingCaptionId(photo.id); setCaptionDraft((photo.captions && photo.captions[currentUser]) || photo.caption || ''); }} style={styles.smallBtn}><Text style={styles.smallBtnText}>Edit My Caption</Text></Pressable>
              </View>
            )}
          </View>
        </View>
      ))}
      {coverMedia.length === 0 && <Text style={[styles.muted, { fontFamily: font }]}>No cover photos yet. Upload one.</Text>}

      {!ready && <Text style={[styles.muted, { fontFamily: font }]}>Loading...</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { fontSize: 30, fontWeight: 'bold', marginBottom: 8, color: '#111' },
  subheader: { fontSize: 17, marginBottom: 16, opacity: 0.7, color: '#333' },
  subtitle: { fontSize: 16, opacity: 0.7, marginBottom: 16, color: '#444', textAlign: 'center' },
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, color: '#111' },
  body: { fontSize: 17, marginBottom: 6, color: '#222', lineHeight: 24 },
  big: { fontSize: 26, fontWeight: 'bold', color: '#111' },
  loveNote: { fontSize: 14, fontStyle: 'italic', color: '#c2185b', marginTop: 6, textAlign: 'center' },
  muted: { fontSize: 13, opacity: 0.6, marginTop: 4, color: '#444' },
  noteCard: { padding: 10, marginBottom: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.8)' },
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
  photoCard: { marginBottom: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
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