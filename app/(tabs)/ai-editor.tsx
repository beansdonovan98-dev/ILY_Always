import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, Alert } from 'react-native';
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
import { AIEditError, checkAIJob, createAIRequestId, editImageWithAI } from '@/lib/aiImage';
import { uploadMedia, getSignedUrl, deleteMedia, MediaRow } from '@/lib/media';
import { getItem, setItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { localDateKey } from '@/lib/days';
import { useUsage } from '@/contexts/UsageContext';
import { markActivity } from '@/lib/activity';

import { useAppFont } from '@/hooks/useAppFont';

const PENDING_JOB_KEY = 'ai-editor:pending-job';

const STRENGTH_MIN = 0.28;
const STRENGTH_MID = 0.35;
const STRENGTH_MAX = 0.45;

type PendingJob = {
  requestId: string;
  signature: string;
  coupleId: string;
  createdAt: number;
};

/** Slider position (0..1) -> denoising strength, with 0.35 exactly at center. */
function ratioToStrength(ratio: number): number {
  const t = Math.max(0, Math.min(1, ratio));
  const value = t <= 0.5
    ? STRENGTH_MIN + (t / 0.5) * (STRENGTH_MID - STRENGTH_MIN)
    : STRENGTH_MID + ((t - 0.5) / 0.5) * (STRENGTH_MAX - STRENGTH_MID);
  return Math.round(value * 100) / 100;
}

function strengthToRatio(value: number): number {
  const v = Math.max(STRENGTH_MIN, Math.min(STRENGTH_MAX, value));
  return v <= STRENGTH_MID
    ? ((v - STRENGTH_MIN) / (STRENGTH_MID - STRENGTH_MIN)) * 0.5
    : 0.5 + ((v - STRENGTH_MID) / (STRENGTH_MAX - STRENGTH_MID)) * 0.5;
}

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
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  // Reuse the same request id if the user retries after a timeout/network drop,
  // so the server returns the existing RunPod job instead of paying twice.
  const requestRef = useRef<{ signature: string; id: string } | null>(null);
  // Hard click lock: state updates are async, so two quick taps can both fire.
  const busyRef = useRef(false);
  const [styleStrength, setStyleStrength] = useState(STRENGTH_MID);
  const [strengthTrackWidth, setStrengthTrackWidth] = useState(0);
  const strengthTrackWidthRef = useRef(0);

  const strengthRatio = strengthToRatio(styleStrength);

  const updateStrengthFromX = useCallback((x: number) => {
    const width = strengthTrackWidthRef.current;
    if (width <= 0) return;
    setStyleStrength(ratioToStrength(x / width));
  }, []);

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
        .order('created_at', { ascending: false });
      if (error) return;
      const rows = ((data || []) as MediaRow[]).filter(
        (r) => (r.file_name || '').startsWith('ai-edit-') && r.kind === 'private'
      );
      setSavedPhotos(rows);
      const urls: Record<string, string> = {};
      await Promise.all(rows.map(async (r) => { try { urls[r.id] = await getSignedUrl(r); } catch {} }));
      setSavedUrls(urls);
    } catch {}
  }, []);

  /** If the app was closed mid-edit, check that job once when the screen opens. */
  const resumePending = useCallback(async () => {
    if (busyRef.current) return;
    const pending = await getItem<PendingJob | null>(PENDING_JOB_KEY, null);
    if (!pending?.requestId) return;
    if (Date.now() - (pending.createdAt || 0) > 24 * 60 * 60 * 1000) {
      await setItem(PENDING_JOB_KEY, null);
      return;
    }
    try {
      const job = await checkAIJob(pending.requestId, pending.coupleId);
      if (job.status === 'COMPLETED') {
        const uri = job.url || (job.b64 ? `data:image/png;base64,${job.b64}` : '');
        if (uri) {
          setResultUri(uri);
          setStatus('Your last AI edit finished while you were away 💞');
        }
        await setItem(PENDING_JOB_KEY, null);
      } else if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'TIMED_OUT') {
        await setItem(PENDING_JOB_KEY, null);
        setStatus(`Error: ${job.error || 'The AI editor failed.'}`);
      } else if (job.status) {
        setStatus('Your last AI edit is still running — tap AI Edit to keep waiting.');
      }
    } catch {
      // Network/backend blip: leave the pending job for the next focus.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSaved();
      void resumePending();
    }, [loadSaved, resumePending])
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
    const trimmed = prompt.trim();
    if (!sourceUri || !trimmed) return;
    if (busyRef.current) return; // ignore accidental double-taps
    busyRef.current = true;

    // Same photo + same prompt = same user action. If the last attempt timed
    // out, reuse its request id so we poll the existing job instead of
    // submitting (and paying for) a duplicate.
    const signature = `${sourceUri}\n${trimmed}`;
    const requestId =
      requestRef.current?.signature === signature
        ? requestRef.current.id
        : createAIRequestId();
    requestRef.current = { signature, id: requestId };

    setLoading(true);
    setEditBurn(1);
    setStatus('Editing with AI...');
    try {
      const coupleId = await getCoupleId();
      // Persist before submitting, so force-quitting and reopening can resume.
      await setItem<PendingJob>(PENDING_JOB_KEY, {
        requestId,
        signature,
        coupleId,
        createdAt: Date.now(),
      });

      const edited = await editImageWithAI(sourceUri, trimmed, requestId, coupleId, styleStrength);
      setResultUri(edited);
      requestRef.current = null;
      await setItem(PENDING_JOB_KEY, null);
      setStatus('Done! Tap Save to keep it 💞');
    } catch (e) {
      // A definitive job failure should get a fresh id next tap. Timeouts and
      // network errors keep the id so the retry continues the same job.
      if (!(e instanceof AIEditError) || !e.retryable) {
        requestRef.current = null;
        await setItem(PENDING_JOB_KEY, null);
      }
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setStatus(`Error: ${msg}`);
    } finally {
      busyRef.current = false;
      setLoading(false);
      setEditBurn(0);
      void bongHaptic();
    }
  }, [sourceUri, prompt, styleStrength]);

  /** Saves the edited photo to the couple's shared covers (Supabase storage). */
  const saveToCovers = useCallback(async () => {
    const uri = resultUri || sourceUri;
    if (!uri) return;
    setSaving(true);
    setStatus('Saving to gallery...');
    try {
      const cid = await getCoupleId();
      const row = await uploadMedia({
        coupleId: cid,
        kind: 'private',
        localUri: uri,
        fileName: `ai-edit-${Date.now()}.png`,
        mimeType: 'image/png',
        byteSize: 0,
        uploadedBy: currentUser,
        dailyDate: null,
      });
      await getSignedUrl(row);
      void markActivity('ai-editor', currentUser, cid);
      await loadSaved(); // reload so the Saved Creations gallery shows it immediately
      setStatus('Saved to the gallery below! 💞');
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setStatus(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [resultUri, sourceUri, currentUser, loadSaved]);

  /** Saves the current photo directly to this device's photo library. */
  const saveToDevice = useCallback(async () => {
    const uri = resultUri || sourceUri;
    if (!uri) return;
    setSaving(true);
    try {
      const { status: perm } = await MediaLibrary.requestPermissionsAsync(true);
      if (perm !== 'granted') {
        setStatus('Photo library permission not granted — saved to shared covers instead.');
        await saveToCovers();
        return;
      }
      let fileUri = uri;
      if (uri.startsWith('data:')) {
        // saveToLibraryAsync needs a real file URI — write the data URL to disk first.
        const FS = await import('expo-file-system/legacy');
        const filePath = `${FS.documentDirectory}ai-edit-${Date.now()}.png`;
        await FS.writeAsStringAsync(filePath, uri.split(',')[1] || '', { encoding: FS.EncodingType.Base64 });
        fileUri = filePath;
      } else if (/^https?:\/\//i.test(uri)) {
        // Storage results come back as signed URLs — download before saving.
        const FS = await import('expo-file-system/legacy');
        const filePath = `${FS.documentDirectory}ai-edit-${Date.now()}.png`;
        await FS.downloadAsync(uri, filePath);
        fileUri = filePath;
      }
      await MediaLibrary.saveToLibraryAsync(fileUri);
      setStatus('Saved to your photo library 💾');
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setStatus(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [resultUri, sourceUri, saveToCovers]);

  /** Saves a gallery thumbnail to this device's photo library (explicit tap / long-press). */
  const saveGalleryPhoto = useCallback(async (photo: MediaRow) => {
    const url = savedUrls[photo.id];
    if (!url) {
      setStatus('Image not ready yet — try again in a moment.');
      return;
    }
    setSaving(true);
    try {
      const { status: perm } = await MediaLibrary.requestPermissionsAsync(true);
      if (perm !== 'granted') {
        setStatus('Photo library permission not granted — save was cancelled.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(url);
      setStatus('Saved to your photo library 💾');
      void loadSaved(); // refresh gallery state after save
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setStatus(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [savedUrls, loadSaved]);

  /** Confirm then save a gallery thumbnail. */
  const confirmSaveGalleryPhoto = useCallback((photo: MediaRow) => {
    Alert.alert(
      'Save to Photos?',
      'Save this creation to your photo library?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: () => void saveGalleryPhoto(photo) },
      ],
    );
  }, [saveGalleryPhoto]);

  /** Confirm then delete a gallery photo. */
  const confirmDeleteSavedPhoto = useCallback((photo: MediaRow) => {
    Alert.alert(
      'Delete this creation?',
      'This will permanently remove it from your saved gallery.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteMedia(photo);
                setSavedPhotos((prev) => prev.filter((p) => p.id !== photo.id));
                setSavedUrls((prev) => {
                  const next = { ...prev };
                  delete next[photo.id];
                  return next;
                });
                if (previewId === photo.id) {
                  setPreviewUri(null);
                  setPreviewId(null);
                }
                setStatus('Deleted from gallery 🗑️');
                await loadSaved();
              } catch (e) {
                const msg = e instanceof Error ? e.message : JSON.stringify(e);
                setStatus(`Delete failed: ${msg}`);
              }
            })();
          },
        },
      ],
    );
  }, [loadSaved, previewId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { fontFamily: font }]}>{aiTitle}</Text>
      <Text style={[styles.subtitle, { fontFamily: font, color: appTheme.subtitleColor }]}>
        Developing our dirtiest fantasies in the dark — snapshots, but make them sinful 🔞📷
      </Text>

      <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>New Edit ✨</Text>} hint="Describe your dirtiest fantasy and watch it come alive 😏🔥" defaultStrain="PINEAPPLE EXP." stampRight="THC: 24.5%">
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

        <View style={styles.strengthHeader}>
          <Text style={styles.label}>Style strength</Text>
          <Text style={[styles.strengthValue, { color: appTheme.textColor }]}>
            {styleStrength.toFixed(2)}
          </Text>
        </View>
        <View
          style={styles.sliderTouch}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            strengthTrackWidthRef.current = width;
            setStrengthTrackWidth(width);
          }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => updateStrengthFromX(e.nativeEvent.locationX)}
          onResponderMove={(e) => updateStrengthFromX(e.nativeEvent.locationX)}
          accessibilityRole="adjustable"
          accessibilityLabel="Style strength"
          accessibilityValue={{ min: 28, max: 45, now: Math.round(styleStrength * 100) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const delta = e.nativeEvent.actionName === 'increment' ? 0.01 : -0.01;
            setStyleStrength((v) => ratioToStrength(strengthToRatio(v) + delta * 5));
          }}>
          <View style={[styles.sliderRail, { backgroundColor: appTheme.borderColor }]}>
            <View
              style={[
                styles.sliderFill,
                { width: strengthRatio * strengthTrackWidth, backgroundColor: appTheme.accentColor },
              ]}
            />
          </View>
          <View
            style={[
              styles.sliderThumb,
              {
                left: Math.max(0, Math.min(strengthTrackWidth - 22, strengthRatio * strengthTrackWidth - 11)),
                borderColor: appTheme.accentColor,
              },
            ]}
          />
        </View>
        <View style={styles.sliderEnds}>
          <Text style={styles.sliderEndText}>More realistic</Text>
          <Text style={styles.sliderEndText}>More stylized</Text>
        </View>

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
            <Text style={styles.pillText}>{saving ? 'Saving...' : 'Save to Gallery 💞'}</Text>
          </LinearGradient>
        </Pressable>

        <Pressable onPress={saveToDevice} disabled={saving || !(resultUri || sourceUri)} style={[styles.ghostPill, { borderColor: appTheme.borderColor }]}>
          <Text style={styles.ghostPillText}>Save to My Photos 💾</Text>
        </Pressable>
        <Text style={styles.hint}>Pick a photo first — Save keeps whichever photo is showing (edited or original).</Text>
      </MylarPouch>

      {resultUri ? (
        <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Result 🔥</Text>} hint="Mmm, look what the darkroom made us... take it home 🔥" defaultStrain="STRAWBERRY COUGH" stampRight="THC: 27.5%">
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
              <Text style={styles.pillText}>{saving ? 'Saving...' : 'Save to Gallery 💞'}</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={saveToDevice} disabled={saving} style={[styles.ghostPill, { borderColor: appTheme.borderColor }]}>
            <Text style={styles.ghostPillText}>Save to My Photos 💾</Text>
          </Pressable>
        </MylarPouch>
      ) : null}

      {status ? <Text style={[styles.muted, styles.fixedStatus, { fontFamily: font }]}>{status}</Text> : null}

      {/* Saved creations */}
      <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Saved Creations 🎞️</Text>} hint="Our filthiest masterpieces, saved forever for repeat mischief 💚" defaultStrain="WEDDING CAKE" stampRight="THC: 23.5%">
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.cardHint, { color: appTheme.subtitleColor }]}>
          Every edit you saved, kept forever — they never clear, gorgeous 💚
        </Text>
        {previewUri && (
          <View style={[styles.previewWrap, { borderColor: appTheme.borderColor }]}>
            <ExpoImage source={{ uri: previewUri }} style={styles.previewPhoto} contentFit="contain" />
            <View style={styles.previewActions}>
              <Pressable
                onPress={() => previewId && confirmSaveGalleryPhoto(savedPhotos.find((p) => p.id === previewId) as MediaRow)}
                style={[styles.ghostPill, { borderColor: appTheme.borderColor }]}>
                <Text style={styles.ghostPillText}>Save 💾</Text>
              </Pressable>
              <Pressable onPress={() => { setPreviewUri(null); setPreviewId(null); }} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close ✕</Text>
              </Pressable>
              {previewId && (
                <Pressable
                  onPress={() => {
                    const photo = savedPhotos.find((p) => p.id === previewId);
                    if (photo) confirmDeleteSavedPhoto(photo);
                  }}
                  style={[styles.tileDeleteBtn, styles.previewDeleteBtn, { borderColor: appTheme.borderColor }]}
                  accessibilityLabel="Delete previewed photo"
                >
                  <Text style={styles.tileDeleteText}>Delete 🗑️</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
        {savedPhotos.length === 0 ? (
          <Text style={styles.muted}>No saved creations yet — save your first edit above ✨</Text>
        ) : (
          <ScrollView
            style={[styles.galleryScroll, { borderColor: appTheme.borderColor }]}
            contentContainerStyle={styles.galleryContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled>
            {savedPhotos.map((photo) => {
              const url = savedUrls[photo.id];
              const ar = photo.width && photo.height ? Math.min(Math.max(photo.width / photo.height, 0.75), 1.5) : 1;
              return (
                <View key={photo.id} style={[styles.tile, { borderColor: appTheme.borderColor, backgroundColor: appTheme.accentSoft, aspectRatio: ar }]}>
                  <Pressable
                    style={styles.thumbPress}
                    onPress={() => { setPreviewUri(url || null); setPreviewId(photo.id); }}
                    onLongPress={() => confirmSaveGalleryPhoto(photo)}
                    accessibilityLabel={`Preview ${photo.file_name}. Long-press to save.`}
                  >
                    <ExpoImage source={{ uri: url || '' }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  </Pressable>
                  <Pressable
                    onPress={() => confirmSaveGalleryPhoto(photo)}
                    style={[styles.tileSaveBtn, { borderColor: appTheme.borderColor }]}
                    accessibilityLabel={`Save ${photo.file_name} to photos`}
                  >
                    <Text style={styles.tileSaveText}>Save 💾</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDeleteSavedPhoto(photo)}
                    style={[styles.tileDeleteBtn, { borderColor: appTheme.borderColor }]}
                    accessibilityLabel={`Delete ${photo.file_name}`}
                  >
                    <Text style={styles.tileDeleteText}>Delete 🗑️</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        )}
        {savedPhotos.length > 0 && <Text style={styles.muted}>Tap a tile to preview · Long-press or tap Save to keep it in your photos 💾</Text>}
      </MylarPouch>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 36, maxWidth: '100%' },
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
  strengthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 2,
  },
  strengthValue: { fontSize: 13, fontWeight: '800', opacity: 0.7 },
  sliderTouch: { height: 32, justifyContent: 'center', marginTop: 2, marginBottom: 2 },
  sliderRail: { height: 6, borderRadius: 3, overflow: 'hidden' },
  sliderFill: { height: 6, borderRadius: 3 },
  sliderThumb: {
    position: 'absolute',
    top: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  sliderEnds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 4,
  },
  sliderEndText: { fontSize: 11, opacity: 0.55, fontWeight: '600' },
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
  galleryScroll: { maxHeight: 380, borderWidth: 1, borderRadius: 16, padding: 8, backgroundColor: 'rgba(255,255,255,0.25)' },
  galleryContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%', borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.35)' },
  thumbPress: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  thumbWrap: { width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  thumb: { width: '100%', height: '100%' },
  tileSaveBtn: { position: 'absolute', bottom: 6, left: 6, right: 6, alignItems: 'center', paddingVertical: 5, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.85)' },
  tileSaveText: { fontWeight: '800', fontSize: 11 },
  tileDeleteBtn: { position: 'absolute', top: 6, right: 6, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.85)' },
  tileDeleteText: { fontWeight: '800', fontSize: 11, color: '#DC2626' },
  previewDeleteBtn: { position: 'relative', top: 0, right: 0, paddingVertical: 10, paddingHorizontal: 14 },
  previewWrap: { marginTop: 10, borderRadius: 16, overflow: 'hidden', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  previewPhoto: { width: '100%', height: 240 },
  previewActions: { flexDirection: 'row', gap: 10, padding: 10, alignItems: 'center' },
  closeBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 50, backgroundColor: 'rgba(0,0,0,0.1)' },
  closeBtnText: { fontWeight: '700', fontSize: 13 },
  muted: { fontSize: 13, opacity: 0.65, textAlign: 'center' },
  fixedStatus: { color: '#000000', opacity: 1 },
  hint: { fontSize: 12, opacity: 0.6, marginTop: 8, lineHeight: 17 },
});
