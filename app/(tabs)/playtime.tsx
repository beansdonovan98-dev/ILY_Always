import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { MylarPouch } from '@/components/MylarPouch';
import { useAppTheme } from '@/hooks/useAppTheme';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { getCoupleId } from '@/lib/couple';
import { useFocusEffect } from 'expo-router';
import { useTabLabel } from '@/hooks/useTabLabel';
import { localDateKey, getDay, saveDay } from '@/lib/days';
import { subscribeCoupleData } from '@/lib/subscribe';
import { markActivity } from '@/lib/activity';
import { getItem, setItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { USERS, UserKey } from '@/constants/content';
import { useUsage } from '@/contexts/UsageContext';
import { notifyPartner } from '@/lib/push';
import {
  getSignedUrl,
  MAX_MEDIA_BYTES,
  MediaRow,
  resolveMime,
  updateMediaComments,
  uploadMedia,
  validateSize,
} from '@/lib/media';

const CONSENT_KEY = 'playtimeConsent';
const MESSAGES_KEY = 'playtimeMessages';

interface ChatMessage {
  id: string;
  text: string;
  author: UserKey;
  timestamp: number;
  dateKey?: string;
}

import { useAppFont } from '@/hooks/useAppFont';

export default function PlaytimeScreen() {
  const font = useAppFont();
  const appTheme = useAppTheme();
  const playtimeTitle = useTabLabel('playtime', 'Playtime 🥵');
  const router = useRouter();
  const { currentUser } = useUsage();
  // Identity is locked to the account you logged in as.
  const activeUser = currentUser;
  const [consent, setConsent] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [draftMessage, setDraftMessage] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [coupleId, setCoupleId] = useState<string>('');

  // Every time you leave and come back, the area locks again — re-reveal required.
  useFocusEffect(
    useCallback(() => {
      setConsent(false);
    }, [])
  );

  /** Merges her phone's chat (from shared days row) with mine by id. */
  const pullRemoteChat = useCallback(async (cid: string) => {
    if (!cid) return;
    try {
      const row = await getDay(cid, localDateKey());
      const remote = (row?.payload?.playtimeChat as ChatMessage[] | undefined) || [];
      if (!remote.length) return;
      const local = await getItem<ChatMessage[]>(MESSAGES_KEY, []);
      const seen = new Set(local.map((m) => m.id));
      const merged = [...local, ...remote.filter((m) => !seen.has(m.id))].sort((a, b) => a.timestamp - b.timestamp);
      if (merged.length !== local.length) {
        setMessages(merged);
        await setItem(MESSAGES_KEY, merged);
      }
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      const c = await getItem<boolean>(CONSENT_KEY, false);
      setConsent(c);
      const m = await getItem<ChatMessage[]>(MESSAGES_KEY, []);
      setMessages(m);
      const cid = await getCoupleId();
      setCoupleId(cid);
      await pullRemoteChat(cid);
      const today = localDateKey();
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('couple_id', cid)
        .eq('kind', 'private')
        .eq('daily_date', today)
        .order('created_at', { ascending: false });
      if (!error) {
        const rows = (data || []) as MediaRow[];
        setMedia(rows);
        const urls: Record<string, string> = {};
        await Promise.all(
          rows.map(async (r) => {
            try {
              urls[r.id] = await getSignedUrl(r);
            } catch {}
          })
        );
        setSignedUrls(urls);
      }
    })();
  }, [pullRemoteChat]);

  const loadMedia = useCallback(async (cid: string) => {
    const today = localDateKey();
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('couple_id', cid)
      .eq('kind', 'private')
      .eq('daily_date', today)
      .order('created_at', { ascending: false });
    if (error) return;
    const rows = (data || []) as MediaRow[];
    setMedia(rows);
    const urls: Record<string, string> = {};
    await Promise.all(
      rows.map(async (r) => {
        try {
          urls[r.id] = await getSignedUrl(r);
        } catch {}
      })
    );
    setSignedUrls(urls);
  }, []);

  /** Live: her photos appear instantly; her chat merges in the second she sends it. */
  useEffect(() => {
    if (!coupleId) return;
    const unsubMedia = subscribeCoupleData('media', coupleId, () => void loadMedia(coupleId));
    const unsubChat = subscribeCoupleData('days', coupleId, () => void pullRemoteChat(coupleId));
    return () => {
      unsubMedia();
      unsubChat();
    };
  }, [coupleId, loadMedia, pullRemoteChat]);

  const persistMessages = useCallback(async (next: ChatMessage[]) => {
    setMessages(next);
    await setItem(MESSAGES_KEY, next);
    // Share via the days row so her phone sees it live (merged by id).
    if (coupleId) {
      try {
        const todayMsgs = next.filter((m) => (m.dateKey || localDateKey()) === localDateKey());
        const existing = await getDay(coupleId, localDateKey());
        await saveDay(coupleId, localDateKey(), { ...(existing?.payload || {}), playtimeChat: todayMsgs });
      } catch {}
    }
  }, [coupleId]);

  const handleConsent = useCallback(async () => {
    setConsent(true);
    await setItem(CONSENT_KEY, true);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = draftMessage.trim();
    if (!text) return;
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      author: activeUser,
      timestamp: Date.now(),
      dateKey: localDateKey(),
    };
    const next = [...messages, msg];
    await persistMessages(next);
    setDraftMessage('');
    void markActivity('playtime', activeUser, coupleId);
    if (coupleId) void notifyPartner(coupleId, activeUser, 'playtime');
  }, [draftMessage, activeUser, messages, persistMessages, coupleId]);

  const pickPhotos = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled) return;
    const cid = coupleId || (await getCoupleId());

    setUploadStatus('Uploading...');
    for (const asset of result.assets) {
      try {
        const mimeType = resolveMime({ mimeType: asset.mimeType, fileName: asset.fileName, uri: asset.uri });
        const byteSize = asset.fileSize || 0;
        validateSize(byteSize);
        const row = await uploadMedia({
          coupleId: cid,
          kind: 'private',
          localUri: asset.uri,
          fileName: asset.fileName || `photo-${Date.now()}.jpg`,
          mimeType,
          byteSize,
          width: asset.width ?? null,
          height: asset.height ?? null,
          uploadedBy: activeUser,
          dailyDate: localDateKey(),
        });
        setMedia((prev) => [row, ...prev]);
        setUploadStatus('Uploaded ' + row.file_name);
        try {
          const url = await getSignedUrl(row);
          setSignedUrls((prev) => ({ ...prev, [row.id]: url }));
        } catch {}
      } catch (e) {
        setUploadStatus('Upload failed: ' + String(e));
        console.warn('Upload failed', e);
      }
    }
  }, [coupleId, activeUser]);

  const toggleComments = useCallback((id: string) => {
    setOpenComments((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (consent === null) {
    return (
      <View style={styles.gate}>
        <Text style={[styles.title, { fontFamily: font }]}>Loading...</Text>
      </View>
    );
  }

  if (!consent) {
    return (
      <View style={styles.gate}>
      <MylarPouch title={<Text style={[styles.title, { fontFamily: font }]}>{playtimeTitle}</Text>} hint="Dark, dirty, and just for us two — enter if you dare 😏💋" defaultStrain="GRANDDADDY P." stampRight="THC: 25.5%">
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.subtitle, { fontFamily: font, color: appTheme.subtitleColor }]}>
          Where our deepest desires and hottest secrets come alive 💋🔥
        </Text>
        <Text style={[styles.body, { fontFamily: font }]}>This area is for adults 18 and older only.</Text>
        <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={handleConsent}>
          <Text style={styles.btnText}>I am 18 or older — Enter</Text>
        </Pressable>
      </MylarPouch>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { fontFamily: font }]}>{playtimeTitle}</Text>
      <Text style={[styles.subtitle, { fontFamily: font, color: appTheme.subtitleColor }]}>
        Where our deepest desires and hottest secrets come alive 💋🔥
      </Text>

      <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Posting as {USERS[activeUser].label}</Text>} hint="Locked to you, sweetheart — all yours, all naughty 🔥" defaultStrain="SOUR DIESEL" stampRight="THC: 26.5%">
        <LeafBorder color={appTheme.leafColor} />
        <Text style={styles.muted}>You are locked to this account from login — messages and photos are always yours.</Text>
      </MylarPouch>

        <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Chat Log 💬</Text>} hint="Whisper something filthy to me, darling 😏💋" defaultStrain="WEDDING CAKE" stampRight="THC: 23.5%">
        <LeafBorder color={appTheme.leafColor} />
          {(() => {
          const today = localDateKey();
          const todayMsgs = messages.filter(
            (m) => (m.dateKey ?? localDateKey(new Date(m.timestamp))) === today
          );
          return (
            <>
              <ScrollView style={styles.chatScroll} showsVerticalScrollIndicator>
                <View style={styles.chatBox}>
                  {todayMsgs.map((m) => (
                  <View key={m.id} style={[styles.chatMsg, { borderColor: appTheme.borderColor }]}>
                    <Text style={styles.chatAuthor}>{USERS[m.author].label}</Text>
                    <Text style={styles.chatText}>{m.text}</Text>
                    <Text style={styles.chatTime}>{new Date(m.timestamp).toLocaleString()}</Text>
                  </View>
      ))}
                {todayMsgs.length === 0 && <Text style={[styles.muted, { fontFamily: font }]}>No messages yet today — yesterday's are in The Days of Old 🧙‍♂️</Text>}
              </View>
              </ScrollView>
              <View style={styles.row}>
                <TextInput value={draftMessage} onChangeText={setDraftMessage} placeholder="Type a message..." style={[styles.input, { flex: 1 }]} />
                <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={sendMessage}>
                  <Text style={styles.btnText}>Send</Text>
                </Pressable>
              </View>
            </>
          );
        })()}
        </MylarPouch>

        <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Pictures & GIFs 📸 (max 60 MB)</Text>} hint="My naughtiest little treats, saved just for you 📸🔥" defaultStrain="BLUE DREAM" stampRight="THC: 20.5%">
        <LeafBorder color={appTheme.leafColor} />
          <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={pickPhotos}>
            <Text style={styles.btnText}>Upload (multiple)</Text>
          </Pressable>
          {uploadStatus ? <Text style={styles.muted}>{uploadStatus}</Text> : null}
          <ScrollView style={styles.photoScroll} showsVerticalScrollIndicator>
          <View style={styles.photoGrid}>
          {media.map((m) => {
            const loverKey = activeUser === 'daddy' ? 'princess' : 'daddy';
            const myCaption = (m.captions && m.captions[activeUser]) || m.caption || '';
            const loverCaption = (m.captions && m.captions[loverKey]) || '';
            return (
            <View key={m.id} style={[styles.photoCard, { borderColor: appTheme.borderColor }]}>
              <Pressable onPress={() => router.push(`/media/${m.id}`)}>
                <Image source={{ uri: signedUrls[m.id] || '' }} style={styles.photoThumb} contentFit="cover" />
              </Pressable>
              <Text style={[styles.muted, { fontFamily: font }]} numberOfLines={1}>{m.file_name}</Text>
              <Text style={styles.captionText} numberOfLines={2}>You: {myCaption || 'No caption yet'}</Text>
              <Text style={styles.captionText} numberOfLines={2}>Lover: {loverCaption || 'No caption yet'}</Text>
              <Pressable onPress={() => router.push(`/media/${m.id}`)} style={styles.editCaptionBtn}>
                <Text style={styles.editCaptionText}>Edit caption</Text>
              </Pressable>
              <Pressable onPress={() => router.push(`/media/${m.id}`)} style={styles.commentHeader}>
                <Text style={styles.commentHeaderText}>Comments ({(m.comments || []).length}) — tap to open</Text>
              </Pressable>
            </View>
            );
          })}
          </View>
          </ScrollView>
        </MylarPouch>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gate: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 36, maxWidth: '100%' },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 17, fontStyle: 'italic', lineHeight: 24, marginBottom: 4 },
  body: { fontSize: 16, marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', width: '100%' },
  cardTitle: { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' },
  userBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(120,120,120,0.2)' },
  userBtnActive: { backgroundColor: 'rgba(100,150,255,0.4)' },
  userBtnText: { fontWeight: '600' },
  chatBox: { marginBottom: 8 },
  chatScroll: { maxHeight: 380, marginBottom: 8 },
  photoScroll: { maxHeight: 380, marginTop: 6 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' },
  photoCard: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', marginBottom: 8, padding: 6 },
  photoThumb: { width: '100%', height: 160, borderRadius: 8 },
  chatMsg: { marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  chatAuthor: { fontWeight: '700', fontSize: 13 },
  chatText: { fontSize: 15 },
  chatTime: { fontSize: 10, opacity: 0.6 },
  input: { borderWidth: 1, borderColor: 'rgba(120,120,120,0.4)', borderRadius: 8, padding: 8, minHeight: 40 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(100,150,255,0.4)' },
  btnText: { fontWeight: '600' },
  muted: { fontSize: 12, opacity: 0.6 },
  loveNote: { fontSize: 14, fontStyle: 'italic', color: '#c2185b', marginTop: 6, marginBottom: 12, textAlign: 'center' },
  photo: { width: 135, height: 135, borderRadius: 8 },
  captionText: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  editCaptionBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(100,150,255,0.25)', marginTop: 6, alignSelf: 'stretch', alignItems: 'center' },
  editCaptionText: { fontWeight: '700', fontSize: 12 },
  commentHeader: { padding: 10 },
  commentHeaderText: { fontWeight: '600' },
  commentsBox: { padding: 10 },
  comment: { marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
});