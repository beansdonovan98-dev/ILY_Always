import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';

import { getCoupleId } from '@/lib/couple';
import { supabase } from '@/lib/supabase';
import { USERS, UserKey } from '@/constants/content';
import { getSignedUrl, MediaRow, updateMediaComments } from '@/lib/media';

export default function MediaDetailScreen() {
  const appTheme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [media, setMedia] = useState<MediaRow | null>(null);
  const [url, setUrl] = useState('');
  const [comments, setComments] = useState<MediaRow['comments']>([]);
  const [draft, setDraft] = useState('');
  const [activeUser, setActiveUser] = useState<UserKey>('daddy');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('media').select('*').eq('id', id).single();
      if (error || !data) return;
      const row = data as MediaRow;
      setMedia(row);
      setComments(row.comments || []);
      try {
        setUrl(await getSignedUrl(row));
      } catch {}
    })();
  }, [id]);

  const postComment = useCallback(async () => {
    const text = draft.trim();
    if (!text || !media) return;
    const comment = { id: `${Date.now()}`, author: activeUser, text, created_at: new Date().toISOString() };
    const next = [...(comments || []), comment];
    await updateMediaComments(media.id, next);
    setComments(next);
    setDraft('');
  }, [draft, media, activeUser, comments]);

  if (!media) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading...</Text>
      </View>
    );
  }

  const isShared = media.kind === 'shared';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <ExpoImage source={{ uri: url }} style={styles.photo} contentFit="contain" />

        {isShared && (
          <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
            <Text style={styles.cardTitle}>Captions</Text>
            <Text style={styles.body}>Daddy 🍆: {(media.captions && media.captions.daddy) || media.caption || '—'}</Text>
            <Text style={styles.body}>Princess 🍑: {(media.captions && media.captions.princess) || '—'}</Text>
          </View>
        )}

        <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
          <Text style={styles.cardTitle}>Comments</Text>
          <View style={styles.row}>
            {(['daddy', 'princess'] as const).map((k) => (
              <Pressable key={k} onPress={() => setActiveUser(k)} style={[[styles.userBtn, appTheme.chipStyle], activeUser === k && [styles.userBtnActive, appTheme.activeChipStyle]]}>
                <Text style={styles.userBtnText}>{USERS[k].label}</Text>
              </Pressable>
            ))}
          </View>
          {(comments || []).map((c) => (
            <View key={c.id} style={[styles.comment, appTheme.cardStyle]}>
              <Text style={styles.chatAuthor}>{USERS[c.author as UserKey]?.label || c.author}</Text>
              <Text style={styles.chatText}>{c.text}</Text>
              <Text style={styles.chatTime}>{new Date(c.created_at).toLocaleString()}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <TextInput value={draft} onChangeText={setDraft} placeholder="Add a comment..." style={[styles.input, { flex: 1 }]} />
            <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={postComment}>
              <Text style={styles.btnText}>Post</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  backBtn: { marginBottom: 12 },
  backText: { fontSize: 16, fontWeight: '600' },
  photo: { width: '100%', height: 320, marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: 'rgba(120,120,120,0.12)' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 15, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' },
  userBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(120,120,120,0.2)' },
  userBtnActive: { backgroundColor: 'rgba(100,150,255,0.4)' },
  userBtnText: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: 'rgba(120,120,120,0.4)', borderRadius: 8, padding: 8, minHeight: 40 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(100,150,255,0.4)' },
  btnText: { fontWeight: '600' },
  comment: { marginBottom: 8, padding: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
  chatAuthor: { fontWeight: '700', fontSize: 13 },
  chatText: { fontSize: 15 },
  chatTime: { fontSize: 10, opacity: 0.6 },
});