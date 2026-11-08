import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { useAppTheme } from '@/hooks/useAppTheme';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { getCoupleId } from '@/lib/couple';
import { localDateKey } from '@/lib/days';
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

  useEffect(() => {
    (async () => {
      const c = await getItem<boolean>(CONSENT_KEY, false);
      setConsent(c);
      const m = await getItem<ChatMessage[]>(MESSAGES_KEY, []);
      setMessages(m);
      const cid = await getCoupleId();
      setCoupleId(cid);
      await loadMedia(cid);
    })();
  }, []);

  const loadMedia = useCallback(async (cid: string) => {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('couple_id', cid)
      .eq('kind', 'private')
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

  const persistMessages = useCallback(async (next: ChatMessage[]) => {
    setMessages(next);
    await setItem(MESSAGES_KEY, next);
  }, []);

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
          dailyDate: new Date().toISOString().slice(0, 10),
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
      <View style={[styles.gate, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.title, { fontFamily: font }]}>Playtime 🥵</Text>
        <Text style={[styles.subtitle, { fontFamily: font, color: appTheme.subtitleColor }]}>
          Where our deepest desires and hottest secrets come alive 💋🔥
        </Text>
        <Text style={[styles.body, { fontFamily: font }]}>This area is for adults 18 and older only.</Text>
        <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={handleConsent}>
          <Text style={styles.btnText}>I am 18 or older — Enter</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { fontFamily: font }]}>Playtime 🥵</Text>
      <Text style={[styles.subtitle, { fontFamily: font, color: appTheme.subtitleColor }]}>
        Where our deepest desires and hottest secrets come alive 💋🔥
      </Text>

      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Posting as {USERS[activeUser].label}</Text>
        <Text style={styles.muted}>You are locked to this account from login — messages and photos are always yours.</Text>
      </View>

        <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
          <Text style={[styles.cardTitle, { fontFamily: font }]}>Chat Log 💬</Text>
          {(() => {
          const today = localDateKey();
          const todayMsgs = messages.filter(
            (m) => (m.dateKey ?? localDateKey(new Date(m.timestamp))) === today
          );
          return (
            <>
              <View style={styles.chatBox}>
                {todayMsgs.map((m) => (
                  <View key={m.id} style={[styles.chatMsg, appTheme.cardStyle]}>
                    <Text style={styles.chatAuthor}>{USERS[m.author].label}</Text>
                    <Text style={styles.chatText}>{m.text}</Text>
                    <Text style={styles.chatTime}>{new Date(m.timestamp).toLocaleString()}</Text>
                  </View>
               ))}
                {todayMsgs.length === 0 && <Text style={[styles.muted, { fontFamily: font }]}>No messages yet today — yesterday's are in The Days of Old 🧙‍♂️</Text>}
              </View>
              <View style={styles.row}>
                <TextInput value={draftMessage} onChangeText={setDraftMessage} placeholder="Type a message..." style={[styles.input, { flex: 1 }]} />
                <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={sendMessage}>
                  <Text style={styles.btnText}>Send</Text>
                </Pressable>
              </View>
            </>
          );
        })()}
        </View>

        <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
          <Text style={[styles.cardTitle, { fontFamily: font }]}>Pictures & GIFs 📸 (max 60 MB)</Text>
          <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={pickPhotos}>
            <Text style={styles.btnText}>Upload (multiple)</Text>
          </Pressable>
          {uploadStatus ? <Text style={styles.muted}>{uploadStatus}</Text> : null}
          {media.map((m) => (
            <View key={m.id} style={[styles.photoCard, appTheme.cardStyle]}>
              <Pressable onPress={() => router.push(`/media/${m.id}`)}>
                <Image source={{ uri: signedUrls[m.id] || '' }} style={styles.photo} contentFit="contain" />
              </Pressable>
              <Text style={[styles.muted, { fontFamily: font }]}>{m.file_name}</Text>
              <Pressable onPress={() => router.push(`/media/${m.id}`)} style={styles.commentHeader}>
                <Text style={styles.commentHeaderText}>Comments ({(m.comments || []).length}) — tap to open</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gate: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 16, maxWidth: '100%' },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 17, fontStyle: 'italic', lineHeight: 24, marginBottom: 4 },
  body: { fontSize: 16, marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', width: '100%' },
  cardTitle: { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' },
  userBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(120,120,120,0.2)' },
  userBtnActive: { backgroundColor: 'rgba(100,150,255,0.4)' },
  userBtnText: { fontWeight: '600' },
  chatBox: { maxHeight: 300, marginBottom: 8 },
  chatMsg: { marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  chatAuthor: { fontWeight: '700', fontSize: 13 },
  chatText: { fontSize: 15 },
  chatTime: { fontSize: 10, opacity: 0.6 },
  input: { borderWidth: 1, borderColor: 'rgba(120,120,120,0.4)', borderRadius: 8, padding: 8, minHeight: 40 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(100,150,255,0.4)' },
  btnText: { fontWeight: '600' },
  muted: { fontSize: 12, opacity: 0.6 },
  loveNote: { fontSize: 14, fontStyle: 'italic', color: '#c2185b', marginTop: 6, marginBottom: 12, textAlign: 'center' },
  photoCard: { marginTop: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', width: '100%' },
  photo: { width: '100%', height: 220 },
  commentHeader: { padding: 10 },
  commentHeaderText: { fontWeight: '600' },
  commentsBox: { padding: 10 },
  comment: { marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
});