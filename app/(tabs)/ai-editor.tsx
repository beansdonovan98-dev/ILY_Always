import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { useAppTheme } from '@/hooks/useAppTheme';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Image as ExpoImage } from 'expo-image';

import { getCoupleId } from '@/lib/couple';
import { editImageWithAI } from '@/lib/aiImage';
import { uploadMedia, getSignedUrl } from '@/lib/media';
import { localDateKey } from '@/lib/days';
import { useUsage } from '@/contexts/UsageContext';

import { useAppFont } from '@/hooks/useAppFont';

export default function AIEditorScreen() {
  const font = useAppFont();
  const appTheme = useAppTheme();
  const { currentUser } = useUsage();
  const [prompt, setPrompt] = useState('');
  const [sourceUri, setSourceUri] = useState('');
  const [resultUri, setResultUri] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const pickSource = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (result.canceled) return;
    setSourceUri(result.assets[0].uri);
    setResultUri('');
    setStatus('');
  }, []);

  const runEdit = useCallback(async () => {
    if (!sourceUri || !prompt.trim()) return;
    setLoading(true);
    setStatus('Editing with AI...');
    try {
      const edited = await editImageWithAI(sourceUri, prompt.trim());
      setResultUri(edited);
      setStatus('Done! Save it, or it is already uploaded to shared covers.');
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [sourceUri, prompt]);

  /** Saves the edited photo to the couple's shared covers (Supabase storage). */
  const saveToCovers = useCallback(async () => {
    if (!resultUri) return;
    setSaving(true);
    setStatus('Saving to shared covers...');
    try {
      const cid = await getCoupleId();
      const row = await uploadMedia({
        coupleId: cid,
        kind: 'shared',
        localUri: resultUri,
        fileName: `ai-edit-${Date.now()}.png`,
        mimeType: 'image/png',
        byteSize: 0,
        uploadedBy: currentUser,
        dailyDate: localDateKey(),
      });
      await getSignedUrl(row);
      setStatus('Saved to shared covers! It will show up on Home 📸');
    } catch (e) {
      setStatus(`Save failed: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [resultUri, currentUser]);

  /** Saves the edited photo directly to this device's photo library. */
  const saveToDevice = useCallback(async () => {
    if (!resultUri) return;
    setSaving(true);
    try {
      const { status: perm } = await MediaLibrary.requestPermissionsAsync();
      if (perm !== 'granted') {
        setStatus('Photo library permission not granted — saved to shared covers instead.');
        await saveToCovers();
        return;
      }
      await MediaLibrary.saveToLibraryAsync(resultUri);
      setStatus('Saved to your photo library 💾');
    } catch (e) {
      setStatus(`Save failed: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [resultUri, saveToCovers]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { fontFamily: font }]}>Dirty Darkroom 🔥</Text>
      <Text style={[styles.subtitle, { fontFamily: font, color: appTheme.subtitleColor }]}>
        Developing our dirtiest fantasies in the dark — snapshots, but make them sinful 🔞📷
      </Text>

      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.cardTitle, { fontFamily: font }]}>New Edit ✨</Text>
        <Text style={styles.cardHint}>Pick a photo, describe the edit, and let the AI do the dirty work 😏</Text>

        <Pressable onPress={pickSource} style={styles.pillPress}>
          <LinearGradient
            colors={[appTheme.accentColor, '#C86DD7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pill}>
            <Text style={styles.pillText}>Pick Photo</Text>
          </LinearGradient>
        </Pressable>

        {sourceUri ? (
          <View style={[styles.photoWrap, { borderColor: appTheme.borderColor }]}>
            <ExpoImage source={{ uri: sourceUri }} style={styles.photo} contentFit="contain" />
          </View>
        ) : null}

        <Text style={styles.label}>Describe the edit</Text>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="e.g. make it watercolor, dreamy neon..."
          placeholderTextColor="rgba(58,42,46,0.45)"
          style={[styles.input, { borderColor: appTheme.borderColor, color: appTheme.textColor }]}
          multiline
        />

        <Pressable onPress={runEdit} disabled={loading} style={styles.pillPress}>
          <LinearGradient
            colors={[appTheme.accentColor, '#C86DD7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pill}>
            <Text style={styles.pillText}>{loading ? 'Working...' : 'AI Edit ✨'}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {resultUri ? (
        <View style={[styles.card, appTheme.cardStyle]}>
          <LeafBorder color={appTheme.leafColor} />
          <Text style={[styles.cardTitle, { fontFamily: font }]}>Result 🔥</Text>
          <View style={[styles.photoWrap, { borderColor: appTheme.borderColor }]}>
            <ExpoImage source={{ uri: resultUri }} style={styles.photo} contentFit="contain" />
          </View>

          <Pressable onPress={saveToCovers} disabled={saving} style={styles.pillPress}>
            <LinearGradient
              colors={[appTheme.accentColor, '#C86DD7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pill}>
              <Text style={styles.pillText}>{saving ? 'Saving...' : 'Save to Shared Covers 💞'}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={saveToDevice} disabled={saving} style={[styles.ghostPill, { borderColor: appTheme.borderColor }]}>
            <Text style={styles.ghostPillText}>Save to My Photos 💾</Text>
          </Pressable>
        </View>
      ) : null}

      {status ? <Text style={[styles.muted, { fontFamily: font }]}>{status}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 16, maxWidth: '100%' },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 17, lineHeight: 24, marginBottom: 4 },
  card: {
    padding: 18,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    width: '100%',
  },
  cardTitle: { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  cardHint: { fontSize: 13, opacity: 0.65, marginBottom: 10, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 6, opacity: 0.8 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    minHeight: 60,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
    fontSize: 15,
  },
  pillPress: { alignSelf: 'flex-start', marginTop: 8, marginBottom: 4 },
  pill: { paddingVertical: 13, paddingHorizontal: 26, borderRadius: 50 },
  pillText: { fontWeight: '800', fontSize: 15, color: '#FFFFFF' },
  ghostPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 50,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  ghostPillText: { fontWeight: '700', fontSize: 13 },
  photoWrap: { marginTop: 12, borderRadius: 18, overflow: 'hidden', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  photo: { width: '100%', height: 240 },
  muted: { fontSize: 13, opacity: 0.65, textAlign: 'center' },
});
