import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getCoupleId } from '@/lib/couple';
import { getCoupleSettings, upsertCoupleSettings, CoupleSettings } from '@/lib/appearance';
import { Sentry } from '@/lib/sentry';
import { setItem } from '@/lib/storage';
import { EVENT_COLORS } from '@/lib/log';

const DEFAULT_TABS = [
  { id: 'home', label: 'Home 🏠', order: 0 },
  { id: 'our-log', label: 'Our Log 📜', order: 1 },
  { id: 'days-of-old', label: 'The Days of Old 🧙‍♂️', order: 2 },
  { id: 'ai-editor', label: 'AI Photo Editor 📷', order: 3 },
  { id: 'playtime', label: 'Playtime 😓', order: 4 },
  { id: 'settings', label: 'Settings ⚙️', order: 5 },
];

const GRADIENT_PRESETS = [
  { name: 'Sunset', colors: ['#ff9a9e', '#fad0c4'] },
  { name: 'Ocean', colors: ['#a1c4fd', '#c2e9fb'] },
  { name: 'Forest', colors: ['#d4fc79', '#96e6a1'] },
  { name: 'Lavender', colors: ['#cfd9df', '#e2ebf0'] },
  { name: 'Neon', colors: ['#f857a6', '#ff5858'] },
  { name: 'Dark', colors: ['#0f2027', '#203a43', '#2c5364'] },
];

export default function SettingsScreen() {
  const router = useRouter();
  const [coupleId, setCoupleId] = useState('');
  const [settings, setSettings] = useState<CoupleSettings | null>(null);
  const [animated, setAnimated] = useState(false);
  const [fontColor, setFontColor] = useState('');
  const [borderColor, setBorderColor] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [tabConfig, setTabConfig] = useState(DEFAULT_TABS);
  const [playtimeRevealed, setPlaytimeRevealed] = useState(false);
  const [taps, setTaps] = useState(0);

  useEffect(() => {
    (async () => {
      const cid = await getCoupleId();
      setCoupleId(cid);
      const s = await getCoupleSettings(cid);
      setSettings(s);
      if (s) {
        setAnimated(!!s.animated_gradient);
        setFontColor(s.font_color || '');
        setBorderColor(s.border_color || '');
        setAccentColor(s.accent_color || '');
        setPlaytimeRevealed(!!s.playtime_revealed);
        if (s.tab_config && Array.isArray(s.tab_config)) setTabConfig(s.tab_config);
      }
    })();
  }, []);

  const saveSettings = useCallback(async (patch: Partial<CoupleSettings>) => {
    const cid = coupleId || (await getCoupleId());
    const next = await upsertCoupleSettings({ couple_id: cid, ...patch, updated_at: new Date().toISOString() });
    setSettings(next);
  }, [coupleId]);

  const applyGradient = useCallback(async (colors: string[]) => {
    await saveSettings({ background_gradient: JSON.stringify(colors) });
  }, [saveSettings]);

  const toggleAnimated = useCallback(async (v: boolean) => {
    setAnimated(v);
    await saveSettings({ animated_gradient: v });
  }, [saveSettings]);

  const saveColors = useCallback(async () => {
    await saveSettings({
      font_color: fontColor || null,
      border_color: borderColor || null,
      accent_color: accentColor || null,
    });
  }, [fontColor, borderColor, accentColor, saveSettings]);

  const updateTabLabel = useCallback((id: string, label: string) => {
    setTabConfig((prev) => prev.map((t) => (t.id === id ? { ...t, label } : t)));
  }, []);

  const moveTab = useCallback((id: string, dir: -1 | 1) => {
    setTabConfig((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((t) => t.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[newIdx];
      const orderA = a.order;
      const orderB = b.order;
      const next = prev.map((t) => {
        if (t.id === a.id) return { ...t, order: orderB };
        if (t.id === b.id) return { ...t, order: orderA };
        return t;
      });
      return next;
    });
  }, []);

  const saveTabConfig = useCallback(async () => {
    await saveSettings({ tab_config: tabConfig });
  }, [tabConfig, saveSettings]);

  const togglePlaytimeRevealed = useCallback(async (v: boolean) => {
    setPlaytimeRevealed(v);
    await saveSettings({ playtime_revealed: v });
  }, [saveSettings]);

  const setLockBackground = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    const dir = `${FileSystem.documentDirectory}lockbg/`;
    try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
    const dest = `${dir}lockbg.jpg`;
    try { await FileSystem.copyAsync({ from: uri, to: dest }); await setItem('lockBackgroundUri', dest); }
    catch { await setItem('lockBackgroundUri', uri); }
  };

  const handleSecretTap = () => {
    const next = taps + 1;
    setTaps(next);
    if (next >= 5) {
      setTaps(0);
      router.push('/playtime');
    }
  };

  const sortedTabs = [...tabConfig].sort((a, b) => a.order - b.order);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings ⚙️</Text>
      <Text style={styles.loveNote}>Make our space feel like home. 🏡</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Animated Gradient Themes</Text>
        <View style={styles.row}>
          {GRADIENT_PRESETS.map((g) => (
            <Pressable key={g.name} onPress={() => applyGradient(g.colors)} style={styles.chip}>
              <Text style={styles.chipText}>{g.name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Animate gradient</Text>
          <Switch value={animated} onValueChange={toggleAnimated} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Colors</Text>
        <Text style={styles.label}>Font color</Text>
        <View style={styles.row}>
          {EVENT_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setFontColor(c)} style={[styles.colorSwatch, { backgroundColor: c }, fontColor === c && styles.colorSwatchSelected]} />
          ))}
        </View>
        <Text style={styles.label}>Border color</Text>
        <View style={styles.row}>
          {EVENT_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setBorderColor(c)} style={[styles.colorSwatch, { backgroundColor: c }, borderColor === c && styles.colorSwatchSelected]} />
          ))}
        </View>
        <Text style={styles.label}>Accent color</Text>
        <View style={styles.row}>
          {EVENT_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setAccentColor(c)} style={[styles.colorSwatch, { backgroundColor: c }, accentColor === c && styles.colorSwatchSelected]} />
          ))}
        </View>
        <Pressable style={styles.btn} onPress={saveColors}>
          <Text style={styles.btnText}>Save Colors</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rename & Reorder Tabs</Text>
        {sortedTabs.map((t, idx) => (
          <View key={t.id} style={styles.tabRow}>
            <TextInput
              value={t.label}
              onChangeText={(v) => updateTabLabel(t.id, v)}
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable style={styles.smallBtn} onPress={() => moveTab(t.id, -1)}>
              <Text style={styles.smallBtnText}>↑</Text>
            </Pressable>
            <Pressable style={styles.smallBtn} onPress={() => moveTab(t.id, 1)}>
              <Text style={styles.smallBtnText}>↓</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.btn} onPress={saveTabConfig}>
          <Text style={styles.btnText}>Save Tab Layout</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Playtime Reveal</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Reveal Playtime in menu</Text>
          <Switch value={playtimeRevealed} onValueChange={togglePlaytimeRevealed} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Lock Screen</Text>
        <Pressable style={styles.btn} onPress={setLockBackground}>
          <Text style={styles.btnText}>Set Background Picture</Text>
        </Pressable>
      </View>

      <Pressable style={styles.btn} onPress={() => Sentry.captureException(new Error('Test crash from settings'))}>
        <Text style={styles.btnText}>Test Crash (Sentry)</Text>
      </Pressable>

      <Pressable onPress={handleSecretTap} style={styles.secret}>
        <Text style={styles.secretText}>v1.0.0</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.9)' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: 'rgba(120,120,120,0.4)', borderRadius: 8, padding: 8, minHeight: 40, marginBottom: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(100,150,255,0.4)', marginBottom: 12, alignSelf: 'flex-start' },
  btnText: { fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(120,120,120,0.2)', marginRight: 6 },
  chipText: { fontWeight: '600', fontSize: 13 },
  tabRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 8 },
  smallBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(100,150,255,0.4)' },
  smallBtnText: { fontWeight: '600', fontSize: 12 },
  colorSwatch: { width: 24, height: 24, borderRadius: 12, margin: 3 },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#fff' },
  secret: { position: 'absolute', bottom: 16, right: 16, opacity: 0.3 },
  secretText: { fontSize: 10 },
  loveNote: { fontSize: 14, fontStyle: 'italic', color: '#c2185b', marginTop: 6, marginBottom: 12, textAlign: 'center' },
});