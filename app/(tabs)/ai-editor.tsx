import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';

import { getCoupleId } from '@/lib/couple';
import { editImageWithAI } from '@/lib/aiImage';
import { uploadMedia, getSignedUrl, MediaRow } from '@/lib/media';
import { localDateKey } from '@/lib/days';

export default function AIEditorScreen() {
  const [prompt, setPrompt] = useState('');
  const [sourceUri, setSourceUri] = useState('');
  const [resultUri, setResultUri] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const pickSource = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (result.canceled) return;
    setSourceUri(result.assets[0].uri);
    setResultUri('');
  }, []);

  const runEdit = useCallback(async () => {
    if (!sourceUri || !prompt.trim()) return;
    setLoading(true);
    setStatus('Editing with AI...');
    try {
      const edited = await editImageWithAI(sourceUri, prompt.trim());
      setResultUri(edited);
      // upload result as shared cover for today
      const cid = await getCoupleId();
      const row = await uploadMedia({
        coupleId: cid,
        kind: 'shared',
        localUri: edited,
        fileName: `ai-edit-${Date.now()}.png`,
        mimeType: 'image/png',
        byteSize: 0,
        uploadedBy: 'daddy',
        dailyDate: localDateKey(),
      });
      const url = await getSignedUrl(row);
      setResultUri(url);
      setStatus('Done! Uploaded to shared covers.');
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [sourceUri, prompt]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>AI Photo Editor 📷</Text>
      <Text style={styles.loveNote}>Create something beautiful together. ✨</Text>
      <Text style={styles.body}>Pick a photo, describe the edit, and let AI create it.</Text>

      <Pressable style={styles.btn} onPress={pickSource}>
        <Text style={styles.btnText}>Pick Photo</Text>
      </Pressable>

      {sourceUri ? <ExpoImage source={{ uri: sourceUri }} style={styles.photo} contentFit="contain" /> : null}

      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Describe the edit (e.g. make it watercolor)"
        style={styles.input}
        multiline
      />

      <Pressable style={styles.btn} onPress={runEdit} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Working...' : 'AI Edit'}</Text>
      </Pressable>

      {resultUri ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Result</Text>
          <ExpoImage source={{ uri: resultUri }} style={styles.photo} contentFit="contain" />
        </View>
      ) : null}

      {status ? <Text style={styles.muted}>{status}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  body: { fontSize: 16, marginBottom: 12 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(100,150,255,0.4)', marginBottom: 12, alignSelf: 'flex-start' },
  btnText: { fontWeight: '600' },
  input: { borderWidth: 1, borderColor: 'rgba(120,120,120,0.4)', borderRadius: 8, padding: 8, minHeight: 60, marginBottom: 12 },
  photo: { width: '100%', height: 220, marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.9)' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  muted: { fontSize: 12, opacity: 0.6 },
  loveNote: { fontSize: 14, fontStyle: 'italic', color: '#c2185b', marginTop: 6, marginBottom: 12, textAlign: 'center' },
});