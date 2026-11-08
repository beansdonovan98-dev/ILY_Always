import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useRouter } from 'expo-router';

import { getCoupleId } from '@/lib/couple';
import { getCoupleSettings, CoupleSettings } from '@/lib/appearance';
import { useTheme } from '@/contexts/ThemeContext';
import { useUsage } from '@/contexts/UsageContext';
import { FONT_OPTIONS } from '@/lib/fonts';
import { Sentry } from '@/lib/sentry';
import { getItem, setItem } from '@/lib/storage';
import { EVENT_COLORS } from '@/lib/log';

const DEFAULT_TABS = [
  { id: 'home', label: 'Home 🏠', order: 0 },
  { id: 'our-log', label: 'Our Log 📜', order: 1 },
  { id: 'dbt', label: 'DBT Cards 🧠', order: 2 },
  { id: 'playtime', label: 'Playtime 😓', order: 3 },
  { id: 'ai-editor', label: 'Dirty Darkroom 🔥', order: 4 },
  { id: 'health', label: 'Health 🩺', order: 5 },
  { id: 'cleaning', label: 'Get It Squeaky Clean 🫧', order: 6 },
  { id: 'settings', label: 'Settings ⚙️', order: 7 },
  { id: 'days-of-old', label: 'The Days of Old 🧙‍♂️', order: 8 },
];

const STRAIN_PRESETS = [
  { name: 'Jack Herer', colors: ['#FF9F1C', '#F4A259', '#BC4B51', '#2E7D32'] },
  { name: 'Granddaddy Purple', colors: ['#4A148C', '#6A1B9A', '#9D4EDD', '#66BB6A'] },
  { name: 'Purple Haze', colors: ['#3A0CA3', '#5A189A', '#F48C06', '#FF9F1C'] },
  { name: 'Tropicana Cherry', colors: ['#800000', '#DC143C', '#7B1FA2', '#E0FBFC'] },
  { name: 'Pink Runts', colors: ['#FF8FAB', '#F15BB5', '#9B5DE5', '#FFF0F5'] },
  { name: 'Blue Dream', colors: ['#1A237E', '#2962FF', '#82B1FF', '#ECEFF1'] },
  { name: 'Northern Lights', colors: ['#312E81', '#7C3AED', '#22D3EE', '#F9A8D4'] },
  { name: 'Sour Diesel', colors: ['#EAB308', '#A3E635', '#4D7C0F', '#7C3AED'] },
];

const GRADIENT_PRESETS = STRAIN_PRESETS;

import { useAppFont } from '@/hooks/useAppFont';

export default function SettingsScreen() {
  const router = useRouter();
  const font = useAppFont();
  const appTheme = useAppTheme();
  const { updateSettings, syncStatus } = useTheme();
  const { logout } = useUsage();
  const [, setCoupleId] = useState('');
  const [settings, setSettings] = useState<CoupleSettings | null>(null);
  const [fontColor, setFontColor] = useState('');
  const [subtitleColor, setSubtitleColor] = useState('');
  const [borderColor, setBorderColor] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [fontId, setFontId] = useState('sans');
  const [tabConfig, setTabConfig] = useState(DEFAULT_TABS);
  const [periodRevealed, setPeriodRevealed] = useState(false);
  const [status, setStatus] = useState('');
  const [taps, setTaps] = useState(0);

  useEffect(() => {
    (async () => {
      const cid = await getCoupleId();
      setCoupleId(cid);
      const s = await getCoupleSettings(cid);
      setSettings(s);
      if (s) {
        setFontColor(s.font_color || '');
        setSubtitleColor(s.subtitle_color || '');
        setBorderColor(s.border_color || '');
        setAccentColor(s.accent_color || '');
        setFontId(s.font_id || 'sans');
        setPeriodRevealed(await getItem<boolean>('periodRevealed', false));
        if (s.tab_config && Array.isArray(s.tab_config)) setTabConfig(s.tab_config);
      }
    })();
  }, []);

  const saveSettings = useCallback(async (patch: Partial<CoupleSettings>) => {
    // Applies to every screen immediately; Supabase syncs in the background.
    await updateSettings(patch);
    setSettings((prev) => (prev ? { ...prev, ...patch } : ({ ...patch } as CoupleSettings)));
    setStatus('Saved ✓');
  }, [updateSettings]);

  const syncToast = syncStatus === 'synced' ? 'Synced to Supabase ✓\nThemes now reach your lover\u2019s phone when they open the app.' : syncStatus === 'local' ? '⚠️ This is saving on THIS phone only — Supabase needs the couple_settings table (docs/supabase-recreate.sql.md) to sync themes to your lover.' : null;

  const autoThemeColors = (colors: string[]) => {
    const luminance = (hex: string): number => {
      const h = hex.replace('#', '');
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    };
    const avg = (arr: string[]) =>
      arr.reduce((sum, c) => sum + luminance(c), 0) / arr.length;
    // Saturated strain gradients are darker per-channel than pastels,
    // so a higher threshold keeps text readable on all eight.
    const darkTheme = avg(colors) < 0.62;
    const accent = colors[1] || colors[0];
    const border = darkTheme ? 'rgba(255,255,255,0.55)' : 'rgba(46,125,79,0.6)';
    const font = darkTheme ? '#FFFFFF' : '#3A2A2E';
    const subtitle = darkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(58,42,46,0.72)';
    return { accent_color: accent, border_color: border, subtitle_color: subtitle, font_color: font };
  };

  const applyGradient = useCallback(async (colors: string[]) => {
    await saveSettings({ background_gradient: JSON.stringify(colors), animated_gradient: true, ...autoThemeColors(colors) });
  }, [saveSettings]);

  const saveColors = useCallback(async () => {
    await saveSettings({
      font_color: fontColor || null,
      subtitle_color: subtitleColor || null,
      border_color: borderColor || null,
      accent_color: accentColor || null,
    });
  }, [fontColor, subtitleColor, borderColor, accentColor, saveSettings]);

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

  const setLockBackground = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    // Keep the original extension so GIFs stay GIFs.
    const ext = (uri.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
    const dir = `${FileSystem.documentDirectory}lockbg/`;
    try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
    const dest = `${dir}lockbg.${ext}`;
    try { await FileSystem.copyAsync({ from: uri, to: dest }); await setItem('lockBackgroundUri', dest); }
    catch { await setItem('lockBackgroundUri', uri); }
  };

  const clearLockBackground = async () => {
    await setItem('lockBackgroundUri', '');
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
      <Text style={[styles.title, { fontFamily: font }]}>Settings ⚙️</Text>
      <Text style={[styles.subtitle, { fontFamily: font, color: appTheme.subtitleColor }]}>
        Our naughtiest little control room — every colour, kink, and font is ours to play with 🔥⚙️💋
      </Text>

      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Animated Gradient Themes</Text>
        <View style={styles.row}>
          {GRADIENT_PRESETS.map((g) => (
            <Pressable key={g.name} onPress={() => applyGradient(g.colors)} style={styles.gradientChip}>
              <LinearGradient
                colors={g.colors as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientChipInner}>
                <Text style={styles.gradientChipText}>{g.name}</Text>
              </LinearGradient>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Colors</Text>
        <View style={styles.compactGrid}>
          <Text style={styles.compactLabel}>Font</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.swRow}>
            {EVENT_COLORS.map((c) => (
              <Pressable key={c} onPress={() => { setFontColor(c); updateSettings({ font_color: c }); }} style={[styles.colorSwatch, styles.colorSwatchSm, { backgroundColor: c }, fontColor === c && [styles.colorSwatchSelected, appTheme.activeChipStyle]]} />
            ))}
          </ScrollView>
        </View>
        <View style={styles.compactGrid}>
          <Text style={styles.compactLabel}>Subtitle</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.swRow}>
            {EVENT_COLORS.map((c) => (
              <Pressable key={c} onPress={() => { setSubtitleColor(c); updateSettings({ subtitle_color: c }); }} style={[styles.colorSwatch, styles.colorSwatchSm, { backgroundColor: c }, subtitleColor === c && [styles.colorSwatchSelected, appTheme.activeChipStyle]]} />
            ))}
          </ScrollView>
        </View>
        <View style={styles.compactGrid}>
          <Text style={styles.compactLabel}>Border</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.swRow}>
            {EVENT_COLORS.map((c) => (
              <Pressable key={c} onPress={() => { setBorderColor(c); updateSettings({ border_color: c }); }} style={[styles.colorSwatch, styles.colorSwatchSm, { backgroundColor: c }, borderColor === c && [styles.colorSwatchSelected, appTheme.activeChipStyle]]} />
            ))}
          </ScrollView>
        </View>
        <View style={styles.compactGrid}>
          <Text style={styles.compactLabel}>Accent</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.swRow}>
            {EVENT_COLORS.map((c) => (
              <Pressable key={c} onPress={() => { setAccentColor(c); updateSettings({ accent_color: c }); }} style={[styles.colorSwatch, styles.colorSwatchSm, { backgroundColor: c }, accentColor === c && [styles.colorSwatchSelected, appTheme.activeChipStyle]]} />
            ))}
          </ScrollView>
        </View>
        <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={saveColors}>
          <Text style={styles.btnText}>Save Colors</Text>
        </Pressable>
      </View>

      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Rename & Reorder Tabs</Text>
        {sortedTabs.map((t, idx) => (
          <View key={t.id} style={styles.tabRow}>
            <TextInput
              value={t.label}
              onChangeText={(v) => updateTabLabel(t.id, v)}
              style={[styles.input, styles.tabInput, { flex: 1 }]}
            />
            <Pressable style={[styles.smallBtn, appTheme.buttonStyle]} onPress={() => moveTab(t.id, -1)}>
              <Text style={styles.smallBtnText}>↑</Text>
            </Pressable>
            <Pressable style={[styles.smallBtn, appTheme.buttonStyle]} onPress={() => moveTab(t.id, 1)}>
              <Text style={styles.smallBtnText}>↓</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={saveTabConfig}>
          <Text style={styles.btnText}>Save Tab Layout</Text>
        </Pressable>
      </View>

      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Fonts</Text>
        <View style={styles.fontGrid}>
          {FONT_OPTIONS.map((f) => (
            <Pressable key={f.id} onPress={() => setFontId(f.id)} style={[[styles.fontChip, appTheme.chipStyle], fontId === f.id && [styles.fontChipActive, appTheme.activeChipStyle]]}>
              <Text style={styles.fontChipText}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={() => saveSettings({ font_id: fontId })}>
          <Text style={styles.btnText}>Save Font</Text>
        </Pressable>
      </View>

      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Period Tracker Reveal</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Show Period Tracker in Health</Text>
          <Switch value={periodRevealed} onValueChange={async (v) => { setPeriodRevealed(v); await setItem('periodRevealed', v); }} />
        </View>
      </View>
      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Lock Screen</Text>
        <Text style={styles.smallHint}>Photo or GIF shown behind the login screen on this phone.</Text>
        <View style={styles.row}>
          <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={setLockBackground}>
            <Text style={styles.btnText}>Set Background Picture / GIF</Text>
          </Pressable>
          <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={clearLockBackground}>
            <Text style={styles.btnText}>Remove</Text>
          </Pressable>
        </View>
      </View>

      {status ? <Text style={styles.muted}>{status}</Text> : null}
      {syncToast ? <Text style={[styles.muted, syncStatus === 'local' ? styles.syncWarn : undefined]}>{syncToast}</Text> : null}

      <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={() => Sentry.captureException(new Error('Test crash from settings'))}>
        <Text style={styles.btnText}>Test Crash (Sentry)</Text>
      </Pressable>

      <Pressable style={[styles.btn, { borderWidth: 1, borderColor: appTheme.borderColor, borderRadius: 50 }]} onPress={logout}>
        <Text style={styles.btnText}>Log out 🔒</Text>
      </Pressable>

      <Pressable onPress={handleSecretTap} style={styles.secret}>
        <Text style={styles.secretText}>v1.0.0</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 16, maxWidth: '100%' },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 17, fontStyle: 'italic', marginBottom: 4, lineHeight: 24 },
  card: { borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', width: '100%' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: 'rgba(120,120,120,0.4)', borderRadius: 8, padding: 8, minHeight: 40, marginBottom: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(100,150,255,0.4)', marginBottom: 12, alignSelf: 'flex-start' },
  btnText: { fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(120,120,120,0.2)', marginRight: 6 },
  chipActive: { backgroundColor: 'rgba(100,150,255,0.4)' },  chipText: { fontWeight: '600', fontSize: 13 },
  fontGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  fontChip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(120,120,120,0.2)', width: '48%' },
  fontChipActive: { backgroundColor: 'rgba(100,150,255,0.4)' },
  fontChipText: { fontWeight: '600', fontSize: 13 },
  gradientChip: { borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(58,42,46,0.15)' },
  gradientChipInner: { paddingVertical: 9, paddingHorizontal: 16 },
  gradientChipText: { color: '#3A2A2E', fontWeight: '700', fontSize: 13 },
  tabRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 8 },
  smallBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(100,150,255,0.4)' },
  smallBtnText: { fontWeight: '600', fontSize: 12 },
  colorSwatch: { width: 24, height: 24, borderRadius: 12, margin: 3 },
  colorSwatchSm: { width: 18, height: 18, borderRadius: 9, margin: 2 },
  swRow: { flex: 1 },
  compactGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  compactLabel: { fontSize: 11, fontWeight: '700', width: 52, paddingTop: 3, opacity: 0.8 },
  tabInput: { minHeight: 32, paddingVertical: 5, marginBottom: 2 },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#fff' },
  secret: { position: 'absolute', bottom: 16, right: 16, opacity: 0.3 },
  smallHint: { fontSize: 12, opacity: 0.65, marginBottom: 8 },
  muted: { fontSize: 12, opacity: 0.6, marginBottom: 8 },
  syncWarn: { color: '#B3261E', fontWeight: '700' },
  loveNote: { fontSize: 14, fontStyle: 'italic', color: '#c2185b', marginTop: 6, marginBottom: 12, textAlign: 'center' },
  secretText: { fontSize: 10 },
});