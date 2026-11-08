import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { useAppTheme } from '@/hooks/useAppTheme';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import { daySeed, FACTS_OF_THE_DAY, RELATIONSHIP_START, todayKey, USERS, WORDS_OF_THE_DAY } from '@/constants/content';
import { getItem, setItem } from '@/lib/storage';
import { useUsage } from '@/contexts/UsageContext';
import { getCoupleId } from '@/lib/couple';
import { notifyPartner } from '@/lib/push';
import { getCoupleSettings, upsertCoupleSettings } from '@/lib/appearance';
import { getSignedUrl, MediaRow, resolveMime, updateCaption, uploadMedia, validateSize } from '@/lib/media';
import { supabase } from '@/lib/supabase';

const CAPTIONS_KEY = 'coverCaptions';

export default function HomeScreen() {
  const appTheme = useAppTheme();
  const { currentUser, ready } = useUsage();

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

  // word of the day
  const wordOfDay = useMemo(() => {
    const seed = daySeed(now);
    return WORDS_OF_THE_DAY[seed % WORDS_OF_THE_DAY.length];
  }, [now]);

  const factOfDay = useMemo(() => {
    const seed = daySeed(now);
    return FACTS_OF_THE_DAY[seed % FACTS_OF_THE_DAY.length];
  }, [now]);

  // cover media (shared, today)
  const [todayKeyState, setTodayKeyState] = useState(todayKey(new Date()));
  useEffect(() => {
    const t = setInterval(() => {
      const k = todayKey(new Date());
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

  useEffect(() => {
    loadCoverMedia();
  }, [loadCoverMedia]);

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
        void notifyPartner(cid, currentUser, 'cover');
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

  const sendLoveNote = useCallback(async () => {
    if (!noteDraft.trim()) return;
    const note = { id: `${Date.now()}`, author: currentUser, text: noteDraft.trim(), created_at: new Date().toISOString() };
    const next = [...loveNotes, note];
    setLoveNotes(next);
    setNoteDraft('');
    await upsertCoupleSettings({ couple_id: coupleId, love_notes: next, updated_at: new Date().toISOString() });
  }, [coupleId, currentUser, loveNotes, noteDraft]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Home 🏠</Text>
      <Text style={[styles.subtitle, { color: appTheme.subtitleColor }]}>
        Our little corner of the world — snuggles, giggles, and little secrets, just us two 💞
      </Text>

      {/* 1. Relationship Tracker */}
      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={styles.cardTitle}>Relationship Tracker 💞</Text>
        <Text style={styles.cardHint}>Counting every second of us ❤️</Text>
        <Text style={styles.body}>Together since 08/09/19</Text>
        <Text style={styles.big}>
          {relationshipElapsed.days}d {relationshipElapsed.hours}h {relationshipElapsed.mins}m {relationshipElapsed.secs}s
        </Text>
        <Text style={[styles.loveNote, { color: appTheme.subtitleColor }]}>
          Every second with you is my favorite — and I still want more. 💗
        </Text>
      </View>

      {/* 2. Cover Photo */}
      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={styles.cardTitle}>Cover Photo 📸</Text>
        <Text style={styles.cardHint}>Our favorite snap right now 📸✨</Text>

        <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={uploadCover}>
          <Text style={styles.btnText}>Upload Cover (max 60MB)</Text>
        </Pressable>

        {coverMedia.length === 0 && (
          <Text style={styles.muted}>No cover photos yet. Upload one.</Text>
        )}

        {coverMedia.map((photo) => (
          <View key={photo.id} style={[styles.photoCard, { borderColor: appTheme.borderColor }]}>
            <ExpoImage source={{ uri: coverUrls[photo.id] || '' }} style={styles.photo} contentFit="contain" />
            <View style={styles.captionRow}>
              {editingCaptionId === photo.id ? (
                <View style={styles.stretch}>
                  <TextInput
                    value={captionDraft}
                    onChangeText={setCaptionDraft}
                    placeholder="Enter caption..."
                    placeholderTextColor="rgba(58,42,46,0.45)"
                    style={[styles.input, { borderColor: appTheme.borderColor, color: appTheme.textColor }]}
                    multiline
                  />
                  <View style={styles.row}>
                    <Pressable
                      onPress={async () => {
                        await updateCaption(photo.id, currentUser, captionDraft);
                        setEditingCaptionId(null);
                        loadCoverMedia();
                      }}
                      style={[styles.smallBtn, appTheme.buttonStyle]}>
                      <Text style={styles.smallBtnText}>Save</Text>
                    </Pressable>
                    <Pressable onPress={() => setEditingCaptionId(null)} style={[styles.smallBtn, styles.smallBtnSecondary]}>
                      <Text style={styles.smallBtnText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.stretch}>
                  <Text style={styles.caption}>
                    {(photo.captions && photo.captions[currentUser]) || photo.caption || 'No caption yet'}
                  </Text>
                  <Text style={styles.statusTag}>Today's cover 📸</Text>
                  <Text style={styles.muted}>
                    Partner: {(photo.captions && photo.captions[currentUser === 'daddy' ? 'princess' : 'daddy']) || ''}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setEditingCaptionId(photo.id);
                      setCaptionDraft((photo.captions && photo.captions[currentUser]) || photo.caption || '');
                    }}
                    style={[styles.smallBtn, appTheme.buttonStyle]}>
                    <Text style={styles.smallBtnText}>Edit My Caption</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* 3. Love Notes */}
      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={styles.cardTitle}>Love Notes 💌</Text>
        <Text style={styles.cardHint}>Little whispers for your heart 💌</Text>

        {loveNotes.filter((n) => n.created_at.slice(0, 10) === today).map((n) => (
          <View key={n.id} style={[styles.noteCard, { borderColor: appTheme.borderColor }]}>
            <Text style={styles.body}>{n.text}</Text>
            <Text style={styles.muted}>{USERS[n.author as keyof typeof USERS]?.label || n.author} • {new Date(n.created_at).toLocaleString()}</Text>
          </View>
        ))}

        <Text style={styles.muted}>Yesterday's notes live in The Days of Old 🧙‍♂️</Text>

        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder="Leave a sweet note..."
          placeholderTextColor="rgba(58,42,46,0.45)"
          style={[styles.input, { borderColor: appTheme.borderColor, color: appTheme.textColor }]}
          multiline
        />
        <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={sendLoveNote}>
          <Text style={styles.btnText}>Send Note</Text>
        </Pressable>
      </View>

      {/* 4. Word of the Day */}
      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={styles.cardTitle}>Word of the Day 📖</Text>
        <Text style={styles.cardHint}>Learning and loving new words together 📖💕</Text>
        <Text style={styles.big}>{wordOfDay.word}</Text>
        <Text style={styles.body}>{wordOfDay.pronunciation}</Text>
        <Text style={styles.body}>{wordOfDay.definition}</Text>
        <Text style={[styles.loveNote, { color: appTheme.subtitleColor }]}>{wordOfDay.example}</Text>
      </View>

      {/* 5. Fun Fact of the Day */}
      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={styles.cardTitle}>Fun Fact of the Day 🧠</Text>
        <Text style={styles.cardHint}>A tiny thing to learn together today ✨</Text>
        <Text style={styles.body}>{factOfDay}</Text>
      </View>

      {!ready && <Text style={styles.muted}>Loading...</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 16, maxWidth: '100%' },
  header: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subheader: { fontSize: 17, opacity: 0.75, marginBottom: 4 },
  subtitle: { fontSize: 17, fontStyle: 'italic', lineHeight: 24, marginBottom: 4 },
  card: {
    padding: 18,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardTitle: { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  cardHint: { fontSize: 13, fontStyle: 'italic', opacity: 0.65, marginBottom: 10 },
  body: { fontSize: 17, marginBottom: 6, lineHeight: 24 },
  big: { fontSize: 26, fontWeight: '800', marginVertical: 4 },
  loveNote: { fontSize: 14, fontStyle: 'italic', marginTop: 8, textAlign: 'center' },
  noteCard: { padding: 12, marginBottom: 8, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.4)' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  muted: { fontSize: 13, opacity: 0.65, marginTop: 4 },
  stretch: { flex: 1 },
  photoCard: { marginTop: 12, borderRadius: 16, overflow: 'hidden', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  photo: { width: '100%', height: 200 },
  captionRow: { padding: 12 },
  caption: { fontSize: 15, marginBottom: 6, fontWeight: '600' },
  statusTag: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,111,145,0.22)',
    marginBottom: 4,
    overflow: 'hidden',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    minHeight: 44,
    marginTop: 8,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  btn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, alignSelf: 'flex-start' },
  btnText: { fontWeight: '700', fontSize: 15 },
  smallBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, alignSelf: 'flex-start' },
  smallBtnSecondary: { backgroundColor: 'rgba(120,120,120,0.25)' },
  smallBtnText: { fontWeight: '700', fontSize: 14 },
});
