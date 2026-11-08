import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { MylarPouch } from '@/components/MylarPouch';
import { useAppTheme } from '@/hooks/useAppTheme';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Image as ExpoImage } from 'expo-image';

import { useTabLabel } from '@/hooks/useTabLabel';
import { JointBurnTimer, bongHaptic } from '@/components/CannabisFeatures';
import { getCoupleId } from '@/lib/couple';
import { editImageWithAI } from '@/lib/aiImage';
import { uploadMedia, getSignedUrl, MediaRow } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { localDateKey } from '@/lib/days';
import { useUsage } from '@/contexts/UsageContext';
import { markActivity } from '@/lib/activity';

import { useAppFont } from '@/hooks/useAppFont';

export default function AIEditorScreen() {
  const font = useAppFont();
  const appTheme = useAppTheme();
  const { currentUser } = useUsage();
  const aiTitle = useTabLabel('ai-editor', 'Dirty Darkroom 🔥');
  const [prompt, setPrompt] = useState('');
  const [sourceUri, setSourceUri] = useState('');
  const [resultUri, setResultUri] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [savedPhotos, setSavedPhotos] = useState<MediaRow[]>([]);
  const [savedUrls, setSavedUrls] = useState<Record<string, string>>({});
  // Joint-burning edit timer (1 = fresh, 0 = done)
  const [editBurn, setEditBurn] = useState(1);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setEditBurn((r) => Math.max(0, r - 0.015)), 500);
    return () => clearInterval(t);
  }, [loading]);

  const loadSaved = useCallback(async () => {
    try {
      const cid = await getCoupleId();
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('couple_id', cid)
        .eq('kind', 'shared')
        .order('created_at', { ascending: false });
      if (error) return;
      const rows = ((data || []) as MediaRow[]).filter((r) => (r.file_name || '').startsWith('ai-edit-'));
      setSavedPhotos(rows);
      const urls: Record<string, string> = {};
      await Promise.all(rows.map(async (r) => { try { urls[r.id] = await getSignedUrl(r); } catch {} }));
      setSavedUrls(urls);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSaved();
    }, [loadSaved])
  );

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
    setEditBurn(1);
    setStatus('Editing with AI...');
    try {
      const edited = await editImageWithAI(sourceUri, prompt.trim());
      setResultUri(edited);
      setStatus('Done! Tap Save to keep it 💞');
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setStatus(`Error: ${msg}`);
    } finally {
      setLoading(false);
      setEditBurn(0);
      void bongHaptic();
    }
  }, [sourceUri, prompt]);

  /** Saves the edited photo to the couple's shared covers (Supabase storage). */
  const saveToCovers = useCallback(async () => {
    const uri = resultUri || sourceUri;
    if (!uri) return;
    setSaving(true);
    setStatus('Saving to shared covers...');
    try {
      const cid = await getCoupleId();
      const row = await uploadMedia({
        coupleId: cid,
        kind: 'shared',
        localUri: uri,
        fileName: `ai-edit-${Date.now()}.png`,
        mimeType: 'image/png',
        byteSize: 0,
        uploadedBy: currentUser,
        dailyDate: localDateKey(),
      });
      await getSignedUrl(row);
      void markActivity('ai-editor', currentUser, cid);
      setStatus('Saved to shared covers! It will show up on Home 📸');
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setStatus(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [resultUri, sourceUri, currentUser]);

  /** Saves the current photo directly to this device's photo library. */
  const saveToDevice = useCallback(async () => {
    const uri = resultUri || sourceUri;
    if (!uri) return;
    setSaving(true);
    try {
      const { status: perm } = await MediaLibrary.requestPermissionsAsync();
      if (perm !== 'granted') {
        setStatus('Photo library permission not granted — saved to shared covers instead.');
        await saveToCovers();
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      setStatus('Saved to your photo library 💾');
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setStatus(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [resultUri, sourceUri, saveToCovers]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { fontFamily: font }]}>{aiTitle}</Text>
      <Text style={[styles.subtitle, { fontFamily: font, color: appTheme.subtitleColor }]}>
        Developing our dirtiest fantasies in the dark — snapshots, but make them sinful 🔞📷
      </Text>

      <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>New Edit ✨</Text>} defaultStrain="PINEAPPLE EXP." stampRight="THC: 24.5%">
        <LeafBorder color={appTheme.leafColor} />
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

        {loading && <JointBurnTimer ratio={editBurn} />}
        <Pressable onPress={runEdit} disabled={loading} style={styles.pillPress}>
          <LinearGradient
            colors={[appTheme.accentColor, '#C86DD7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pill}>
            <Text style={styles.pillText}>{loading ? 'Working...' : 'AI Edit ✨'}</Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={saveToCovers} disabled={saving || !(resultUri || sourceUri)} style={styles.pillPress}>
          <LinearGradient
            colors={[appTheme.accentColor, '#C86DD7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pill}>
            <Text style={styles.pillText}>{saving ? 'Saving...' : 'Save to Shared Covers 💞'}</Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={saveToDevice} disabled={saving || !(resultUri || sourceUri)} style={[styles.ghostPill, { borderColor: appTheme.borderColor }]}>
          <Text style={styles.ghostPillText}>Save to My Photos 💾</Text>
        </Pressable>
        <Text style={styles.hint}>Pick a photo first — Save keeps whichever photo is showing (edited or original).</Text>
      </MylarPouch>

      {resultUri ? (
        <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Result 🔥</Text>} defaultStrain="STRAWBERRY COUGH" stampRight="THC: 27.5%">
          <LeafBorder color={appTheme.leafColor} />
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
        </MylarPouch>
      ) : null}

      {status ? <Text style={[styles.muted, { fontFamily: font }]}>{status}</Text> : null}

      {/* Saved creations */}
      <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Saved Creations 🎞️</Text>} defaultStrain="WEDDING CAKE" stampRight="THC: 23.5%">
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.cardHint, { color: appTheme.subtitleColor }]}>
          Every edit you saved, kept forever — they never clear, gorgeous 💚
        </Text>
        {savedPhotos.length === 0 ? (
          <Text style={styles.muted}>No saved creations yet — save your first edit above ✨</Text>
        ) : (
          <View style={styles.grid}>
            {savedPhotos.map((photo) => (
              <MylarPouch
                key={photo.id}
                title={<Text style={styles.cardTitle}>{photo.file_name}</Text>}
                defaultStrain="AI EDIT"
                stampRight="THC: 33.3%"
                style={{ width: '31%' }}>
              <Pressable
                style={[styles.thumbWrap, { borderColor: appTheme.borderColor, width: '100%' }]}
                onPress={async () => {
                  try {
                    const url = savedUrls[photo.id];
                    if (!url) return;
                    const { status: perm } = await MediaLibrary.requestPermissionsAsync();
                    if (perm === 'granted') {
                      await MediaLibrary.saveToLibraryAsync(url);
                      setStatus('Saved to your photo library 💾');
                    }
                  } catch {}
                }}>
                <ExpoImage source={{ uri: savedUrls[photo.id] || '' }} style={styles.thumb} contentFit="cover" />
              </Pressable>
              </MylarPouch>
            ))}
          </View>
        )}
        {savedPhotos.length > 0 && <Text style={styles.muted}>Tap any creation to save it to your photos 💾</Text>}
      </MylarPouch>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 16, maxWidth: '100%' },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 17, fontStyle: 'italic', lineHeight: 24, marginBottom: 4 },
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
  cardHint: { fontSize: 13, fontStyle: 'italic', opacity: 0.65, marginBottom: 10, lineHeight: 18 },
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  thumbWrap: { width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  thumb: { width: '100%', height: '100%' },
  muted: { fontSize: 13, opacity: 0.65, textAlign: 'center' },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 8, lineHeight: 17 },
});
