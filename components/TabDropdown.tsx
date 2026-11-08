import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

import { getCoupleId } from '@/lib/couple';
import { getCoupleSettings } from '@/lib/appearance';
import { LeafBorder } from '@/components/CannabisLeaf';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useUsage } from '@/contexts/UsageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { loadActivityDots, ActivityRoute } from '@/lib/activity';

const DEFAULT_TABS = [
  { id: 'home', label: 'Home 🏠', path: '/' },
  { id: 'our-log', label: 'Our Log 📜', path: '/our-log' },
  { id: 'dbt', label: 'DBT Cards 🧠', path: '/dbt' },
  { id: 'playtime', label: 'Playtime 😓', path: '/playtime' },
  { id: 'ai-editor', label: 'Dirty Darkroom 🔥', path: '/ai-editor' },
  { id: 'health', label: 'Health 🩺', path: '/health' },
  { id: 'cleaning', label: 'Get It Squeaky Clean', path: '/cleaning' },
  { id: 'settings', label: 'Settings ⚙️', path: '/settings' },
  { id: 'days-of-old', label: 'The Days of Old 🧙‍♂️', path: '/days-of-old' },
];

export default function TabDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useAppTheme();
  const { currentUser } = useUsage();
  const [open, setOpen] = useState(false);
  const [tabs, setTabs] = useState(DEFAULT_TABS);
  const [activity, setActivity] = useState<Record<string, { mine: boolean; hers: boolean }>>({});

  const { settings } = useTheme();

  // Reactive: her rename flows through the shared settings straight into this menu.
  useEffect(() => {
    const config = settings?.tab_config as Array<{ id: string; label: string }> | null | undefined;
    if (config && Array.isArray(config)) {
      const mapped = [...config]
        .sort((a: any, b: any) => ((a as any).order ?? 0) - ((b as any).order ?? 0))
        .map((t: any) => {
          const def = DEFAULT_TABS.find((d) => d.id === t.id);
          return { id: t.id, label: t.label || def?.label || t.id, path: def?.path || '/' };
        });
      setTabs(mapped.length ? mapped : DEFAULT_TABS);
    }
  }, [settings]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getCoupleId().then((cid) => loadActivityDots(currentUser, cid)).then((dots) => {
      if (alive) setActivity(dots);
    });
    return () => {
      alive = false;
    };
  }, [open, currentUser]);

  const current = tabs.find((o) => o.path === pathname || (o.id === 'home' && (pathname === '/' || pathname === '/index' || pathname === '/(tabs)'))) || tabs[0] || DEFAULT_TABS[0];

  return (
    <View style={[styles.root, { marginRight: 12 }]}>
      <Pressable style={[styles.button, { borderColor: theme.borderColor }]} onPress={() => setOpen(true)}>
        <Text style={[styles.buttonText, { color: theme.textColor, fontFamily: theme.fontFamily }]}>Menu ☰</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: 'rgba(20,10,15,0.35)' }]} onPress={() => setOpen(false)}>
          <View style={[styles.menu, theme.cardStyle]}>
            <LeafBorder color={theme.leafColor} size={20} />
            <View style={[styles.handle, { backgroundColor: theme.borderColor }]} />
            <Text style={[styles.menuTitle, { color: theme.textColor }]}>Where are we going? 🌿</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {tabs.map((o, i) => {
                const dots = activity[o.id];
                // One direction only: Daddy sees PINK (her posts), Princess sees PURPLE (his posts).
                const showPink = currentUser === 'daddy' && (dots?.hers ?? false);
                const showPurple = currentUser !== 'daddy' && (dots?.mine ?? false);
                return (
                <Pressable
                  key={o.id}
                  style={[
                    styles.item,
                    i < tabs.length - 1 && { borderBottomColor: theme.borderColor },
                    o.path === pathname && { backgroundColor: theme.accentSoft },
                  ]}
                  onPress={() => {
                    setOpen(false);
                    router.push(o.path as any);
                  }}>
                  <Text style={[styles.itemText, { color: theme.textColor }]}>{o.label}</Text>
                  {showPurple ? <View style={[styles.dot, { backgroundColor: '#7B1FA2' }]} /> : null}
                  {showPink ? <View style={[styles.dot, { backgroundColor: '#FF8FAB' }]} /> : null}
                  <Text style={[styles.itemChevron, { color: theme.accentColor }]}>{o.path === pathname ? '●' : '›'}</Text>
                </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={[styles.closeBtn, { backgroundColor: theme.accentSoft }]} onPress={() => setOpen(false)}>
              <Text style={[styles.closeBtnText, { color: theme.textColor }]}>Stay here ✕</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginRight: 12, marginTop: 2 },
  button: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(120,120,120,0.2)', borderWidth: 1 },
  buttonText: { fontWeight: '600', fontSize: 14 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  menu: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 30,
    paddingTop: 12,
    maxHeight: '84%',
    position: 'relative',
    overflow: 'hidden',
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 12, opacity: 0.35 },
  menuTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 6, borderRadius: 12, borderBottomWidth: 1 },
  itemText: { fontSize: 17, fontWeight: '700', flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5, marginLeft: 6, marginRight: 2 },
  itemChevron: { fontSize: 15, fontWeight: '700' },
  closeBtn: { marginTop: 12, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 28, borderRadius: 50 },
  closeBtnText: { fontWeight: '700', fontSize: 13 },
});