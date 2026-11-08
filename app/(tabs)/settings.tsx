import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { MylarPouch } from '@/components/MylarPouch';
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
  { id: 'cleaning', label: 'Get It Squeaky Clean', order: 6 },
  { id: 'settings', label: 'Settings ⚙️', order: 7 },
  { id: 'days-of-old', label: 'The Days of Old 🧙‍♂️', order: 8 },
];

const STRAIN_PRESETS = [
  // Full token palettes: [bgDeep, cardBg, cardBorder, text, subtitle, accent, ember, smoke]
  { name: 'Granddaddy Purple (Indica)', leaf: '#A855F7', colors: ['#1A0B2E', '#2A0E4E', '#6B21A8', '#F3E8FF', '#C084FC', '#A855F7', '#F59E0B', '#D8B4FE'] },
  { name: 'Sour Diesel (Sativa)', leaf: '#84CC16', colors: ['#121816', '#062E1B', '#15803D', '#ECFDF5', '#6EE7B7', '#84CC16', '#EAB308', '#A3E635'] },
  { name: 'Pineapple Express (Hybrid)', leaf: '#FACC15', colors: ['#0B2016', '#144229', '#16A34A', '#FEF3C7', '#FDE047', '#FACC15', '#F97316', '#FEF08A'] },
  { name: 'Strawberry Cough (Sativa)', leaf: '#F43F5E', colors: ['#0F172A', '#1E293B', '#475569', '#FFE4E6', '#FDA4AF', '#F43F5E', '#E11D48', '#FB7185'] },
  { name: 'Blue Dream (Hybrid)', leaf: '#38BDF8', colors: ['#091E3A', '#102A4C', '#0284C7', '#F0F9FF', '#7DD3FC', '#38BDF8', '#F97316', '#BAE6FD'] },
  { name: 'Wedding Cake (Indica - Light)', leaf: '#16A34A', colors: ['#F8FAFC', '#FFFFFF', '#CBD5E1', '#064E3B', '#475569', '#16A34A', '#D97706', '#94A3B8'] },
];

const GRADIENT_PRESETS = STRAIN_PRESETS;

import { useTabLabel } from '@/hooks/useTabLabel';
import { LighterToggle, bongHaptic } from '@/components/CannabisFeatures';
import { useAppFont } from '@/hooks/useAppFont';

export default function SettingsScreen() {
  const router = useRouter();
  const font = useAppFont();
  const appTheme = useAppTheme();
  const { updateSettings, syncStatus } = useTheme();
  const { logout } = useUsage();
  const settingsTitle = useTabLabel('settings', 'Settings ⚙️');
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

  const autoThemeColors = (colors: string[], leaf?: string) => {
    // 8-token palettes: [bgDeep, cardBg, cardBorder, text, subtitle, accent, ember, smoke]
    if (colors.length >= 8) {
      return {
        accent_color: colors[5],
        border_color: colors[2],
        subtitle_color: colors[4],
        font_color: colors[3],
      };
    }
    const luminance = (hex: string): number => {
      const h = hex.replace('#', '');
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    };
    const avg = (arr: string[]) =>
      arr.reduce((sum, c) => sum + luminance(c), 0) / arr.length;
    const darkTheme = avg(colors) < 0.62;
    const accent = leaf || colors[1] || colors[0];
    const border = darkTheme ? 'rgba(255,255,255,0.55)' : 'rgba(46,125,79,0.6)';
    const font = darkTheme ? '#FFFFFF' : '#3A2A2E';
    const subtitle = darkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(58,42,46,0.72)';
    return { accent_color: accent, border_color: border, subtitle_color: subtitle, font_color: font };
  };

  const applyGradient = useCallback(async (preset: { colors: string[]; leaf?: string }) => {
    const colors = preset.colors;
    await saveSettings({ background_gradient: JSON.stringify(colors), animated_gradient: true, ...autoThemeColors(colors, preset.leaf) });
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
      <Text style={[styles.title, { fontFamily: font }]}>{settingsTitle}</Text>
      <Text style={[styles.subtitle, { fontFamily: font, color: appTheme.subtitleColor }]}>
        Our naughtiest little control room — every colour, kink, and font is ours to play with 🔥⚙️💋
      </Text>

      <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Animated Gradient Themes</Text>} hint="Pick the high you want to bathe in, baby 😏💜" defaultStrain="GRANDDADDY P." stampRight="THC: 28.5%">
        <LeafBorder color={appTheme.leafColor} />
        <View style={styles.row}>
          {GRADIENT_PRESETS.map((g) => (
            <Pressable key={g.name} onPress={() => applyGradient(g)} style={styles.gradientChip}>
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
      </MylarPouch>

      <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Colors</Text>} hint="Dress us in your favourite colours — we look best when you choose 💋" defaultStrain="SOUR DIESEL" stampRight="THC: 21.5%">
        <LeafBorder color={appTheme.leafColor} />
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
      </MylarPouch>

      <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Rename & Reorder Tabs</Text>} hint="Name our toys exactly how you like them, daddy... 😈" defaultStrain="PINEAPPLE EXP." stampRight="THC: 24.5%">
        <LeafBorder color={appTheme.leafColor} />
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
      </MylarPouch>

      <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Fonts</Text>} hint="Make every dirty little word look as sexy as it feels 🔥" defaultStrain="STRAWBERRY COUGH" stampRight="THC: 27.5%">
        <LeafBorder color={appTheme.leafColor} />
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
      </MylarPouch>

      <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Period Tracker Reveal</Text>} hint="Reveal her secrets — only if you're ready to worship them 🩸💋" defaultStrain="BLUE DREAM" stampRight="THC: 22.5%">
        <LeafBorder color={appTheme.leafColor} />
        <View style={styles.row}>
          <Text style={styles.label}>Show Period Tracker in Health</Text>
          <LighterToggle value={periodRevealed} onValueChange={async (v: boolean) => { setPeriodRevealed(v); await setItem('periodRevealed', v); void bongHaptic(); }} />
        </View>
      </MylarPouch>
      <MylarPouch title={<Text style={[styles.cardTitle, { fontFamily: font }]}>Lock Screen</Text>} hint="Hide our naughtiest photo behind the lock — only we get in 🔒😏" defaultStrain="WEDDING CAKE" stampRight="THC: 25.5%">
        <LeafBorder color={appTheme.leafColor} />
        <Text style={styles.smallHint}>Photo or GIF shown behind the login screen on this phone.</Text>
        <View style={styles.row}>
          <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={setLockBackground}>
            <Text style={styles.btnText}>Set Background Picture / GIF</Text>
          </Pressable>
          <Pressable style={[styles.btn, appTheme.buttonStyle]} onPress={clearLockBackground}>
            <Text style={styles.btnText}>Remove</Text>
          </Pressable>
        </View>
      </MylarPouch>

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
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 36, maxWidth: '100%' },
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