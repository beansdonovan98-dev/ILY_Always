import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { MylarPouch } from '@/components/MylarPouch';
import { useAppTheme } from '@/hooks/useAppTheme';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Image as ExpoImage } from 'expo-image';

import { useTabLabel } from '@/hooks/useTabLabel';
import { JointBurnTimer, bongHaptic } from '@/components/CannabisFeatures';
import { getCoupleId } from '@/lib/couple';
import { BrushStroke, EditTarget, checkAIJob, editImageWithStyle } from '@/lib/aiImage';
import { AI_STYLE_KEYS, styleLabel } from '@/lib/aiStyles';
import { ROOM_LIGHT_COLORS } from '@/lib/lightColors';
import { uploadMedia, getSignedUrl, deleteMedia, MediaRow } from '@/lib/media';
import { getItem, setItem } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { localDateKey } from '@/lib/days';
import { useUsage } from '@/contexts/UsageContext';
import { markActivity } from '@/lib/activity';
import BrushMaskEditor from '@/components/BrushMaskEditor';

import { useAppFont } from '@/hooks/useAppFont';

const PENDING_JOB_KEY = 'ai-editor:pending-job';

type EditRow = {
  target: EditTarget;
  label: string;
  placeholder: string;
  /** Body/Objects need a painted mask; Background/Hair default to auto masks. */
  brush: boolean;
  hint: string;
};

const EDIT_ROWS: EditRow[] = [
  {
    target: 'background',
    label: 'Background',
    placeholder: 'e.g. weed grow room, neon green smoke',
    brush: false,
    hint: 'Auto-masked',
  },
  {
    target: 'hair',
    label: 'Hair',
    placeholder: 'e.g. long red hair, wet look',
    brush: false,
    hint: 'Auto-masked',
  },
  {
    target: 'body',
    label: 'Body',
    placeholder: 'e.g. snake tattoo across her ribs',
    brush: true,
    hint: 'Paint the area',
  },
  {
    target: 'item',
    label: 'Objects',
    placeholder: 'e.g. holding a joint, strapon',
    brush: true,
    hint: 'Paint the area',
  },
];

const QUICK_STYLES = [
  'adult-anime',
  'tarot-card',
  'anime',
  'lego',
  'figurine',
  'pointillism',
  'park-bench',
  'change-outfit',
];

const EMPTY_STROKES: Record<EditTarget, BrushStroke[]> = {
  background: [],
  hair: [],
  body: [],
  item: [],
};

type PendingJob = {
  requestId: string;
  signature: string;
  coupleId: string;
  createdAt: number;
};

function mimeFromResultUri(uri: string): string {
  if (uri.startsWith('data:')) {
    const m = uri.match(/^data:([^;,]+)[;,]/i);
    return m?.[1] || 'image/png';
  }
  const m = uri.match(/\.(webp|jpe?g|png)(?:[?#]|$)/i);
  if (!m) return 'image/png';
  const ext = m[1].toLowerCase();
  return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/png') return 'png';
  return 'png';
}

export default function AIEditorScreen() {
  const font = useAppFont();
  const appTheme = useAppTheme();
  const { currentUser } = useUsage();
  const aiTitle = useTabLabel('ai-editor', 'Dirty Darkroom 🔥');
  const [editPrompts, setEditPrompts] = useState<Record<EditTarget, string>>({
    background: '',
    hair: '',
    body: '',
    item: '',
  });
  const [editStrokes, setEditStrokes] = useState<Record<EditTarget, BrushStroke[]>>(EMPTY_STROKES);
  const [brushTarget, setBrushTarget] = useState<EditTarget | null>(null);
  const [brushOpen, setBrushOpen] = useState(false);
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
  const [selectedStyle, setSelectedStyle] = useState('tarot-card');
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [styleSearch, setStyleSearch] = useState('');
  const [subjectMode, setSubjectMode] = useState<'wife' | 'husband' | 'couple'>('wife');
  const [nude, setNude] = useState(true);
  const [poseUri, setPoseUri] = useState('');
  const [customRoom, setCustomRoom] = useState('');
  const [lightColor, setLightColor] = useState('');
  const [poseMode, setPoseMode] = useState<'match_photo' | 'random'>('match_photo');
  const [wide, setWide] = useState(false);
  const [editsOpen, setEditsOpen] = useState(false);
  // Hard click lock: state updates are async, so two quick taps can both fire.
  const busyRef = useRef(false);

  const filteredStyles = useMemo(() => {
    const q = styleSearch.trim().toLowerCase();
    if (!q) return AI_STYLE_KEYS;
    return AI_STYLE_KEYS.filter(
      (key) => key.toLowerCase().includes(q) || styleLabel(key).toLowerCase().includes(q)
    );
  }, [styleSearch]);

  const closeStylePicker = useCallback(() => {
    setStylePickerOpen(false);
    setStyleSearch('');
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
    setEditStrokes(EMPTY_STROKES);
  }, []);

  const pickPose = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled) return;
    setPoseUri(result.assets[0].uri);
  }, []);

  const runEdit = useCallback(async () => {
    if (!sourceUri) return;
    if (busyRef.current) return; // ignore accidental double-taps

    const activeEdits = EDIT_ROWS.map((row) => ({
      target: row.target,
      prompt: (editPrompts[row.target] || '').trim(),
      strokes: editStrokes[row.target] || [],
    })).filter((edit) => edit.prompt.length > 0);

    const missingMask = activeEdits.find(
      (edit) => (edit.target === 'body' || edit.target === 'item') && edit.strokes.length === 0
    );
    if (missingMask) {
      setStatus(`Paint the ${missingMask.target} area first, then run it again 🖌️`);
      return;
    }

    busyRef.current = true;

    setLoading(true);
    setEditBurn(1);
    setStatus(resultUri ? 'Applying edits...' : `Applying ${styleLabel(selectedStyle)}...`);
    try {
      const coupleId = await getCoupleId();
      const baseUri = resultUri || sourceUri;
      const edited = await editImageWithStyle(
        baseUri,
        selectedStyle,
        activeEdits,
        coupleId,
        (message) => setStatus(message),
        {
          skipStyle: Boolean(resultUri),
          subject: subjectMode,
          nude,
          poseImageUrl: poseUri || undefined,
          backgroundPrompt: customRoom,
          lightColor: lightColor || undefined,
          poseMode,
          wide,
        }
      );
      setResultUri(edited);
      setStatus(
        activeEdits.length > 0
          ? 'Done! Tap Save to keep it 💞'
          : 'Style applied! Tap Save to keep it 💞'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setStatus(`Error: ${msg}`);
    } finally {
      busyRef.current = false;
      setLoading(false);
      setEditBurn(0);
      void bongHaptic();
    }
  }, [sourceUri, resultUri, editPrompts, editStrokes, selectedStyle, subjectMode, nude, poseUri, customRoom, lightColor, poseMode, wide]);

  const openBrush = useCallback((target: EditTarget) => {
    setBrushTarget(target);
    setBrushOpen(true);
  }, []);

  const clearBrush = useCallback((target: EditTarget) => {
    setEditStrokes((prev) => ({ ...prev, [target]: [] }));
  }, []);

  const saveBrush = useCallback(
    (strokes: BrushStroke[]) => {
      if (brushTarget) {
        setEditStrokes((prev) => ({ ...prev, [brushTarget]: strokes }));
      }
      setBrushOpen(false);
    },
    [brushTarget]
  );

  /** Saves the edited photo to the editor's private creations gallery. */
  const saveToCovers = useCallback(async () => {
    const uri = resultUri || sourceUri;
    if (!uri) return;
    setSaving(true);
    setStatus('Saving to gallery...');
    try {
      const cid = await getCoupleId();
      const mimeType = mimeFromResultUri(uri);
      const ext = extensionForMime(mimeType);
      const row = await uploadMedia({
        coupleId: cid,
        kind: 'private',
        localUri: uri,
        fileName: `ai-edit-${Date.now()}.${ext}`,
        mimeType,
        byteSize: 0,
        uploadedBy: currentUser,
        dailyDate: null,
      });
      await getSignedUrl(row);
      void markActivity('ai-editor', currentUser, cid);
      await loadSaved(); // reload so the Saved Creations gallery shows it immediately
      setStatus('Saved to your creations below! 💞');
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
      let source = uri;
      const FS = await import('expo-file-system/legacy');
      if (uri.startsWith('data:')) {
        // Write the data URL to disk using its real extension first.
        const mimeType = mimeFromResultUri(uri);
        const ext = extensionForMime(mimeType);
        const dataPath = `${FS.documentDirectory}ai-edit-${Date.now()}.${ext}`;
        await FS.writeAsStringAsync(dataPath, uri.split(',')[1] || '', { encoding: FS.EncodingType.Base64 });
        source = dataPath;
      } else if (/^https?:\/\//i.test(uri)) {
        // Storage results come back as signed URLs — download before saving.
        const mimeType = mimeFromResultUri(uri);
        const ext = extensionForMime(mimeType);
        const dataPath = `${FS.documentDirectory}ai-edit-${Date.now()}.${ext}`;
        await FS.downloadAsync(uri, dataPath);
        source = dataPath;
      }

      // iOS Photos handles JPEG most reliably; convert WebP/PNG first.
      const converted = await ImageManipulator.manipulateAsync(source, [], {
        compress: 0.92,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      await MediaLibrary.saveToLibraryAsync(converted.uri);
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

      // saveToLibraryAsync needs a local file, not a signed Storage URL.
      const FS = await import('expo-file-system/legacy');
      const mimeType = mimeFromResultUri(url);
      const ext = extensionForMime(mimeType);
      const localPath = `${FS.documentDirectory}ai-gallery-${photo.id}.${ext}`;
      await FS.downloadAsync(url, localPath);

      let saveUri = localPath;
      try {
        const converted = await ImageManipulator.manipulateAsync(localPath, [], {
          compress: 0.92,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        saveUri = converted.uri;
      } catch {
        // Fall back to the downloaded file if conversion isn't available.
      }

      await MediaLibrary.saveToLibraryAsync(saveUri);
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

      <View style={[styles.summaryRow, { borderColor: appTheme.borderColor }]}>
        <Text style={[styles.summaryText, { fontFamily: font, color: appTheme.subtitleColor }]}>
          {subjectMode === 'wife' ? 'Her' : subjectMode === 'husband' ? 'Him' : 'Both'} ·{' '}
          {nude ? 'Nude' : 'Clothed'} · {styleLabel(selectedStyle)} · random room
        </Text>
      </View>

      <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>New Edit ✨</Text>} hint="Pick a style, add edits, and let the darkroom do the dirty work 😏🔥" defaultStrain="PINEAPPLE EXP." stampRight="THC: 24.5%">
        <LeafBorder color={appTheme.leafColor} />
        <Text style={styles.cardHint}>Pick a photo and a style, then add only the edits you want 😏</Text>

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

        <View style={styles.styleHeader}>
          <Text style={styles.label}>Style</Text>
          <Pressable onPress={() => setStylePickerOpen(true)}>
            <Text style={[styles.styleHint, { color: appTheme.accentColor }]}>All 98 →</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipStrip}>
          {QUICK_STYLES.map((key) => {
            const active = selectedStyle === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSelectedStyle(key)}
                style={[
                  styles.quickChip,
                  { borderColor: appTheme.borderColor },
                  active && { backgroundColor: appTheme.accentSoft, borderColor: appTheme.accentColor },
                ]}>
                <Text
                  style={[
                    styles.quickChipText,
                    { fontFamily: font, color: appTheme.textColor },
                    active && { color: appTheme.accentColor },
                  ]}>
                  {styleLabel(key)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.styleHeader}>
          <Text style={styles.label}>Direction</Text>
          <Text style={styles.styleHint}>Who and how</Text>
        </View>

        <View style={styles.segmentRow}>
          {(['wife', 'husband', 'couple'] as const).map((mode) => {
            const active = subjectMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setSubjectMode(mode)}
                style={[
                  styles.segment,
                  { borderColor: appTheme.borderColor },
                  active && { backgroundColor: appTheme.accentSoft, borderColor: appTheme.accentColor },
                ]}>
                <Text
                  style={[
                    styles.segmentText,
                    { fontFamily: font, color: appTheme.textColor },
                    active && { color: appTheme.accentColor },
                  ]}>
                  {mode === 'wife' ? 'Her' : mode === 'husband' ? 'Him' : 'Both'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.segmentRow}>
          {([true, false] as const).map((isNude) => {
            const active = nude === isNude;
            return (
              <Pressable
                key={String(isNude)}
                onPress={() => setNude(isNude)}
                style={[
                  styles.segment,
                  { borderColor: appTheme.borderColor },
                  active && { backgroundColor: appTheme.accentSoft, borderColor: appTheme.accentColor },
                ]}>
                <Text
                  style={[
                    styles.segmentText,
                    { fontFamily: font, color: appTheme.textColor },
                    active && { color: appTheme.accentColor },
                  ]}>
                  {isNude ? 'Nude' : 'Clothed'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.editRow, { borderColor: appTheme.borderColor }]}>
          <View style={styles.editRowHeader}>
            <Text style={[styles.editRowTitle, { fontFamily: font, color: appTheme.textColor }]}>Pose</Text>
            <Text style={[styles.editRowHint, { color: appTheme.textColor }]}>
              {poseUri ? 'Reference set ✓' : 'Optional'}
            </Text>
          </View>
          <Text style={[styles.editIntro, { color: appTheme.subtitleColor }]}>
            Pick a reference photo and her body copies that pose. Her face and the style stay.
          </Text>
          <View style={styles.segmentRow}>
            {(['match_photo', 'random'] as const).map((mode) => {
              const active = poseMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setPoseMode(mode)}
                  style={[
                    styles.segment,
                    { borderColor: appTheme.borderColor },
                    active && { backgroundColor: appTheme.accentSoft, borderColor: appTheme.accentColor },
                  ]}>
                  <Text
                    style={[
                      styles.segmentText,
                      { fontFamily: font, color: appTheme.textColor },
                      active && { color: appTheme.accentColor },
                    ]}>
                    {mode === 'match_photo' ? 'Match photo' : 'Random pose'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {poseMode === 'random' ? (
            <Text style={[styles.editIntro, { color: appTheme.subtitleColor }]}>
              Random pose from the pool. The room stays in frame.
            </Text>
          ) : (
            <>
          <View style={styles.editRowActions}>
            <Pressable
              onPress={pickPose}
              style={[styles.miniPill, { borderColor: appTheme.borderColor }]}>
              <Text style={[styles.miniPillText, { fontFamily: font, color: appTheme.textColor }]}>
                {poseUri ? 'Change pose' : 'Pick pose'}
              </Text>
            </Pressable>
            {poseUri ? (
              <Pressable onPress={() => setPoseUri('')} style={styles.clearMask}>
                <Text style={[styles.clearMaskText, { fontFamily: font }]}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          {poseUri ? (
            <View style={[styles.poseThumbWrap, { borderColor: appTheme.borderColor }]}>
              <ExpoImage source={{ uri: poseUri }} style={styles.poseThumb} contentFit="cover" />
            </View>
          ) : null}
            </>
          )}
        </View>

        <Text style={[styles.label, styles.roomLabel]}>Room (optional)</Text>
        <TextInput
          value={customRoom}
          onChangeText={setCustomRoom}
          placeholder="Leave blank for a random stoner room"
          placeholderTextColor="rgba(58,42,46,0.45)"
          style={[styles.editInput, { borderColor: appTheme.borderColor, color: appTheme.textColor }]}
        />
        <Text style={[styles.styleHint, styles.roomHint]}>
          Type a place and it replaces the random one — the seed keeps her the same.
        </Text>

        <Text style={[styles.label, styles.roomLabel]}>Room light</Text>
        <View style={styles.swatchRow}>
          <Pressable
            onPress={() => setLightColor('')}
            style={[
              styles.swatch,
              styles.swatchRandom,
              { borderColor: !lightColor ? appTheme.accentColor : appTheme.borderColor },
            ]}>
            <Text style={[styles.swatchRandomText, { color: appTheme.textColor }]}>RND</Text>
          </Pressable>
          {ROOM_LIGHT_COLORS.map((color) => {
            const active = lightColor === color.id;
            return (
              <Pressable
                key={color.id}
                onPress={() => setLightColor(active ? '' : color.id)}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: color.hex,
                    borderColor: active ? appTheme.accentColor : appTheme.borderColor,
                  },
                  active && styles.swatchActive,
                ]}
              />
            );
          })}
        </View>
        <Text style={[styles.styleHint, styles.roomHint]}>
          {lightColor
            ? `Strip lights set to ${ROOM_LIGHT_COLORS.find((c) => c.id === lightColor)?.label}. The room changes, the colour holds. Real-photo styles keep their own light.`
            : 'Pick a colour and the whole room is lit in it. RND keeps each room\u2019s own lighting.'}
        </Text>

        <Text style={[styles.label, styles.roomLabel]}>Frame</Text>
        <View style={styles.segmentRow}>
          {([false, true] as const).map((isWide) => {
            const active = wide === isWide;
            return (
              <Pressable
                key={String(isWide)}
                onPress={() => setWide(isWide)}
                style={[
                  styles.segment,
                  { borderColor: appTheme.borderColor },
                  active && { backgroundColor: appTheme.accentSoft, borderColor: appTheme.accentColor },
                ]}>
                <Text
                  style={[
                    styles.segmentText,
                    { fontFamily: font, color: appTheme.textColor },
                    active && { color: appTheme.accentColor },
                  ]}>
                  {isWide ? 'Wide' : 'Portrait'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.styleHint, styles.roomHint]}>
          Wide keeps the room in frame. Horizontal poses switch to wide on their own.
        </Text>

        <Pressable
          onPress={() => setEditsOpen((v) => !v)}
          style={[styles.editToggle, { borderColor: appTheme.borderColor }]}>
          <Text style={[styles.label, { color: appTheme.textColor }]}>
            {editsOpen ? 'Detail edits ▾' : 'Add detail edits ▸'}
          </Text>
          <Text style={[styles.styleHint, { color: appTheme.textColor }]}>
            {editsOpen ? 'Hide' : 'Optional'}
          </Text>
        </Pressable>

        {editsOpen ? (
          <>
            <Text style={[styles.editIntro, { color: appTheme.subtitleColor }]}>
              Optional. Add only what you want changed — each edit gets its own mask so her face and body stay put.
            </Text>

            {EDIT_ROWS.map((row) => {
          const painted = (editStrokes[row.target] || []).length > 0;
          return (
            <View key={row.target} style={[styles.editRow, { borderColor: appTheme.borderColor }]}>
              <View style={styles.editRowHeader}>
                <Text style={[styles.editRowTitle, { fontFamily: font, color: appTheme.textColor }]}>
                  {row.label}
                </Text>
                <Text style={[styles.editRowHint, { color: appTheme.textColor }]}>
                  {painted ? 'Painted mask ✓' : row.hint}
                </Text>
              </View>

              <TextInput
                value={editPrompts[row.target]}
                onChangeText={(value) => setEditPrompts((prev) => ({ ...prev, [row.target]: value }))}
                placeholder={row.placeholder}
                placeholderTextColor="rgba(58,42,46,0.45)"
                style={[styles.editInput, { borderColor: appTheme.borderColor, color: appTheme.textColor }]}
                multiline
              />

              <View style={styles.editRowActions}>
                <Pressable
                  onPress={() => openBrush(row.target)}
                  disabled={!sourceUri}
                  style={[
                    styles.miniPill,
                    {
                      borderColor: appTheme.borderColor,
                      opacity: sourceUri ? 1 : 0.4,
                    },
                  ]}>
                  <Text style={[styles.miniPillText, { fontFamily: font, color: appTheme.textColor }]}>
                    {painted ? 'Edit mask 🖌️' : 'Paint mask 🖌️'}
                  </Text>
                </Pressable>

                {painted ? (
                  <Pressable onPress={() => clearBrush(row.target)} style={styles.clearMask}>
                    <Text style={[styles.clearMaskText, { fontFamily: font }]}>Clear mask</Text>
                  </Pressable>
                ) : null}

                {row.brush && !painted ? (
                  <Text style={[styles.requiredHint, { fontFamily: font }]}>Mask required</Text>
                ) : null}
              </View>
            </View>
          );
        })}

        <Text style={styles.hint}>
          Background and Hair mask themselves. Body and Objects need you to paint the spot. Every prompt is sent as explicit.
        </Text>
          </>
        ) : null}

        {resultUri ? (
          <Pressable
            onPress={() => {
              setResultUri('');
              setEditStrokes(EMPTY_STROKES);
              setStatus('Back to the original photo — pick a style and run it again.');
            }}
            style={[styles.ghostPill, { borderColor: appTheme.borderColor }]}>
            <Text style={[styles.ghostPillText, { fontFamily: font, color: appTheme.textColor }]}>
              Start over from original
            </Text>
          </Pressable>
        ) : null}

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

        {loading && status ? (
          <Text style={[styles.inlineStatus, { fontFamily: font, color: appTheme.textColor }]}>
            {status}
          </Text>
        ) : null}

        <Pressable onPress={saveToCovers} disabled={saving || !(resultUri || sourceUri)} style={styles.pillPress}>
          <LinearGradient
            colors={[appTheme.accentColor, '#C86DD7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pill}>
            <Text style={styles.pillText}>{saving ? 'Saving...' : 'Save to Creations 💞'}</Text>
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
              <Text style={styles.pillText}>{saving ? 'Saving...' : 'Save to Creations 💞'}</Text>
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
                    accessibilityLabel={`Preview ${photo.file_name}`}
                  >
                    <ExpoImage source={{ uri: url || '' }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        )}
        {savedPhotos.length > 0 && <Text style={styles.muted}>Tap a tile to preview · Save or delete from the preview 💾</Text>}
      </MylarPouch>

      <Modal
        visible={stylePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={closeStylePicker}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.styleModalRoot}>
          <Pressable style={styles.styleBackdrop} onPress={closeStylePicker} />
          <View style={[styles.styleSheet, { borderColor: appTheme.borderColor }]}>
            <View style={styles.styleSheetHeader}>
              <View>
                <Text style={[styles.styleSheetTitle, { fontFamily: font }]}>Choose a style</Text>
                <Text style={styles.styleSheetSub}>Pick the look, then add edits below</Text>
              </View>
              <Pressable onPress={closeStylePicker} style={[styles.styleClose, { borderColor: appTheme.borderColor }]}>
                <Text style={styles.styleCloseText}>✕</Text>
              </Pressable>
            </View>

            <TextInput
              value={styleSearch}
              onChangeText={setStyleSearch}
              placeholder="Search styles..."
              placeholderTextColor="rgba(58,42,46,0.45)"
              style={[styles.styleSearch, { borderColor: appTheme.borderColor, color: appTheme.textColor }]}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <FlatList
              data={filteredStyles}
              keyExtractor={(item) => item}
              numColumns={2}
              columnWrapperStyle={styles.styleRow}
              contentContainerStyle={styles.styleListContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.styleList}
              renderItem={({ item }) => {
                const active = item === selectedStyle;
                return (
                  <Pressable
                    onPress={() => {
                      setSelectedStyle(item);
                      closeStylePicker();
                    }}
                    style={[
                      styles.styleChip,
                      {
                        borderColor: active ? appTheme.accentColor : appTheme.borderColor,
                        backgroundColor: active ? appTheme.accentSoft : 'rgba(255,255,255,0.7)',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.quickChipText,
                        {
                          fontFamily: font,
                          color: appTheme.textColor,
                          opacity: active ? 1 : 0.8,
                        },
                      ]}>
                      {styleLabel(item)}
                    </Text>
                    {active ? <Text style={[styles.styleChipCheck, { color: appTheme.accentColor }]}>✓</Text> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BrushMaskEditor
        visible={brushOpen && Boolean(brushTarget) && Boolean(resultUri || sourceUri)}
        imageUri={resultUri || sourceUri}
        targetLabel={EDIT_ROWS.find((row) => row.target === brushTarget)?.label || 'area'}
        initialStrokes={brushTarget ? editStrokes[brushTarget] || [] : []}
        onCancel={() => setBrushOpen(false)}
        onSave={saveBrush}
      />
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
  editIntro: { fontSize: 12, fontStyle: 'italic', lineHeight: 17, marginTop: 2, marginBottom: 4 },
  editRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.35)',
    gap: 7,
  },
  editRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editRowTitle: { fontSize: 15, fontWeight: '800' },
  editRowHint: { fontSize: 11, opacity: 0.55, fontWeight: '600' },
  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 9,
    minHeight: 46,
    backgroundColor: 'rgba(255,255,255,0.55)',
    fontSize: 14,
  },
  editRowActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniPill: {
    borderWidth: 1,
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  miniPillText: { fontSize: 12, fontWeight: '700' },
  clearMask: { paddingVertical: 6, paddingHorizontal: 2 },
  clearMaskText: { fontSize: 12, fontWeight: '700', opacity: 0.7 },
  requiredHint: { fontSize: 11, fontWeight: '700', opacity: 0.5, marginLeft: 'auto' },
  inlineStatus: { fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 2 },
  styleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  styleHint: { fontSize: 11, opacity: 0.5, fontWeight: '600' },
  summaryRow: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignSelf: 'center',
  },
  summaryText: { fontSize: 12, fontWeight: '700' },
  chipStrip: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  quickChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  quickChipText: { fontSize: 13, fontWeight: '800' },
  editToggle: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  styleSelect: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  styleSelectText: { fontSize: 15, fontWeight: '700' },
  styleSelectChevron: { fontSize: 20, fontWeight: '700', marginTop: -2 },
  segmentRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '800' },
  poseThumbWrap: {
    marginTop: 10,
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  poseThumb: { width: '100%', height: '100%' },
  roomLabel: { marginTop: 14 },
  roomHint: { marginTop: 4, marginBottom: 2 },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
  },
  swatchActive: {
    borderWidth: 4,
  },
  swatchRandom: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  swatchRandomText: { fontSize: 10, letterSpacing: 0.5, fontWeight: '700' },
  styleModalRoot: { flex: 1, justifyContent: 'flex-end' },
  styleBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(20,10,15,0.55)',
  },
  styleSheet: {
    height: '84%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 34,
    backgroundColor: '#FFF8F4',
  },
  styleSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  styleSheetTitle: { fontSize: 24, fontWeight: '800' },
  styleSheetSub: { fontSize: 12, opacity: 0.55, marginTop: 2 },
  styleClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleCloseText: { fontSize: 14, fontWeight: '800' },
  styleSearch: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.75)',
    marginBottom: 12,
  },
  styleList: { flex: 1 },
  styleListContent: { paddingBottom: 10, gap: 8 },
  styleRow: { gap: 8, marginBottom: 8 },
  styleChip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  styleChipText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  styleChipCheck: { fontSize: 13, fontWeight: '800' },
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
