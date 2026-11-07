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
  { id: 'playtime', label: 'Playtime 😓', order: 2 },
  { id: 'ai-editor', label: 'Dirty Darkroom 🔥', order: 3 },
  { id: 'health', label: 'Health 🩺', order: 4 },
  { id: 'settings', label: 'Settings ⚙️', order: 5 },
  { id: 'days-of-old', label: 'The Days of Old 🧙‍♂️', order: 6 },
];

const GRADIENT_PRESETS = [
  { name: 'Sunrise', colors: ['#FF8FAB', '#FFC1CC', '#F9C6E0', '#FFB5A7'] },
  { name: 'Sunset', colors: ['#FF5E3A', '#FF2E63', '#9D4EDD', '#FFB347'] },
  { name: 'Ocean', colors: ['#4D96FF', '#2EC4B6', '#A8DADC', '#457B9D'] },
  { name: 'Forest', colors: ['#B7E4C7', '#95D5B2', '#40916C', '#D8F3DC'] },
  { name: 'Lavender', colors: ['#B388FF', '#9B5DE5', '#D9B4FF', '#E0AAFF'] },
  { name: 'Neon', colors: ['#F72585', '#B5179E', '#7209B7', '#FFD60A'] },
  { name: 'Cannabis', colors: ['#2E7D32', '#66BB6A', '#A5D6A7', '#7B1FA2'] },
  { name: 'Cotton Candy', colors: ['#FF8FAB', '#FFAFCC', '#BDE0FE', '#FFC8DD'] },
  { name: 'Purple Haze', colors: ['#7B1FA2', '#9C27B0', '#BA68C8', '#4A148C'] },
];

import { useAppFont } from '@/hooks/useAppFont';

export default function SettingsScreen() {
  const router = useRouter();
  const font = useAppFont();
  const appTheme = useAppTheme();
  const { updateSettings } = useTheme();
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
  const [avatarDaddy, setAvatarDaddy] = useState('🍆');
  const [avatarPrincess, setAvatarPrincess] = useState('🍑');
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
        setAvatarDaddy(s.avatar_daddy || '🍆');
        setAvatarPrincess(s.avatar_princess || '🍑');
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

  const applyGradient = useCallback(async (colors: string[]) => {
    await saveSettings({ background_gradient: JSON.stringify(colors), animated_gradient: true });
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
        <Text style={styles.label}>Font color</Text>
        <View style={styles.row}>
          {EVENT_COLORS.map((c) => (
            <Pressable key={c} onPress={() => { setFontColor(c); updateSettings({ font_color: c }); }} style={[styles.colorSwatch, { backgroundColor: c }, fontColor === c && [styles.colorSwatchSelected, appTheme.activeChipStyle]]} />
          ))}
        </View>
        <Text style={styles.label}>Subtitle color</Text>
        <View style={styles.row}>
          {EVENT_COLORS.map((c) => (
            <Pressable key={c} onPress={() => { setSubtitleColor(c); updateSettings({ subtitle_color: c }); }} style={[styles.colorSwatch, { backgroundColor: c }, subtitleColor === c && [styles.colorSwatchSelected, appTheme.activeChipStyle]]} />
          ))}
        </View>
        <Text style={styles.label}>Border color</Text>
        <View style={styles.row}>
          {EVENT_COLORS.map((c) => (
            <Pressable key={c} onPress={() => { setBorderColor(c); updateSettings({ border_color: c }); }} style={[styles.colorSwatch, { backgroundColor: c }, borderColor === c && [styles.colorSwatchSelected, appTheme.activeChipStyle]]} />
          ))}
        </View>
        <Text style={styles.label}>Accent color</Text>
        <View style={styles.row}>
          {EVENT_COLORS.map((c) => (
            <Pressable key={c} onPress={() => { setAccentColor(c); updateSettings({ accent_color: c }); }} style={[styles.colorSwatch, { backgroundColor: c }, accentColor === c && [styles.colorSwatchSelected, appTheme.activeChipStyle]]} />
          ))}
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
              style={[styles.input, { flex: 1 }]}
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
        <View style={styles.row}>
          {FONT_OPTIONS.map((f) => (
            <Pressable key={f.id} onPress={() => setFontId(f.id)} style={[[styles.chip, appTheme.chipStyle], fontId === f.id && [styles.chipActive, appTheme.activeChipStyle]]}>
              <Text style={styles.chipText}>{f.label}</Text>
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
        <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={setLockBackground}>
          <Text style={styles.btnText}>Set Background Picture</Text>
        </Pressable>
      </View>

      <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={() => Sentry.captureException(new Error('Test crash from settings'))}>
        <Text style={styles.btnText}>Test Crash (Sentry)</Text>
      </Pressable>

      <Pressable style={[styles.btn, { borderWidth: 1, borderColor: appTheme.borderColor, borderRadius: 50 }]} onPress={logout}>
        <Text style={styles.btnText}>Log out 🔒</Text>
      </Pressable>

      {status ? <Text style={styles.muted}>{status}</Text> : null}

      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.cardTitle, { fontFamily: font }]}>Partner Avatars / Emojis</Text>
        <Text style={styles.label}>Daddy emoji</Text>
        <TextInput value={avatarDaddy} onChangeText={setAvatarDaddy} style={styles.input} />
        <Text style={styles.label}>Princess emoji</Text>
        <TextInput value={avatarPrincess} onChangeText={setAvatarPrincess} style={styles.input} />
        <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={() => saveSettings({ avatar_daddy: avatarDaddy, avatar_princess: avatarPrincess })}>
          <Text style={styles.btnText}>Save Avatars</Text>
        </Pressable>
      </View>

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
  subtitle: { fontSize: 17, marginBottom: 4, lineHeight: 24 },
  card: { borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', width: '100%' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: 'rgba(120,120,120,0.4)', borderRadius: 8, padding: 8, minHeight: 40, marginBottom: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(100,150,255,0.4)', marginBottom: 12, alignSelf: 'flex-start' },
  btnText: { fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(120,120,120,0.2)', marginRight: 6 },
  chipActive: { backgroundColor: 'rgba(100,150,255,0.4)' },  chipText: { fontWeight: '600', fontSize: 13 },
  gradientChip: { borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(58,42,46,0.15)' },
  gradientChipInner: { paddingVertical: 9, paddingHorizontal: 16 },
  gradientChipText: { color: '#3A2A2E', fontWeight: '700', fontSize: 13 },
  tabRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 8 },
  smallBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(100,150,255,0.4)' },
  smallBtnText: { fontWeight: '600', fontSize: 12 },
  colorSwatch: { width: 24, height: 24, borderRadius: 12, margin: 3 },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#fff' },
  secret: { position: 'absolute', bottom: 16, right: 16, opacity: 0.3 },
  muted: { fontSize: 12, opacity: 0.6, marginBottom: 8 },
  loveNote: { fontSize: 14, fontStyle: 'italic', color: '#c2185b', marginTop: 6, marginBottom: 12, textAlign: 'center' },
  secretText: { fontSize: 10 },
});