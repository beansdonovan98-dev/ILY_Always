import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

import { getCoupleId } from '@/lib/couple';
import { getCoupleSettings } from '@/lib/appearance';
import { LeafBorder } from '@/components/CannabisLeaf';

const DEFAULT_TABS = [
  { id: 'home', label: 'Home 🏠', path: '/', icon: '🏠', hint: 'Our shared space' },
  { id: 'our-log', label: 'Our Log 📜', path: '/our-log', icon: '📜', hint: 'Daily memories' },
  { id: 'dbt', label: 'DBT Cards 🧠', path: '/dbt', icon: '🧠', hint: 'Daily skill practice' },
  { id: 'playtime', label: 'Playtime 😓', path: '/playtime', icon: '🥵', hint: 'Adults only' },
  { id: 'ai-editor', label: 'Dirty Darkroom 🔥', path: '/ai-editor', icon: '📷', hint: 'AI photo editor' },
  { id: 'health', label: 'Health 🩺', path: '/health', icon: '🩺', hint: 'Body & wellness' },
  { id: 'cleaning', label: 'Get It Squeaky Clean 🫧', path: '/cleaning', icon: '🫧', hint: 'House chores' },
  { id: 'settings', label: 'Settings ⚙️', path: '/settings', icon: '⚙️', hint: 'Themes & fonts' },
  { id: 'days-of-old', label: 'The Days of Old 🧙‍♂️', path: '/days-of-old', icon: '🧙‍♂️', hint: 'Past days' },
];

export default function TabDropdown() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tabs, setTabs] = useState(DEFAULT_TABS);

  useEffect(() => {
    (async () => {
      const cid = await getCoupleId();
      const s = await getCoupleSettings(cid);
      if (s?.tab_config && Array.isArray(s.tab_config)) {
        const mapped = s.tab_config
          .sort((a: any, b: any) => a.order - b.order)
          .map((t: any) => {
            const def = DEFAULT_TABS.find((d) => d.id === t.id);
            return { id: t.id, label: t.label || def?.label || t.id, path: def?.path || '/', icon: def?.icon || '📌', hint: def?.hint || '' };
          });
        setTabs(mapped.length ? mapped : DEFAULT_TABS);
      }
    })();
  }, []);

  const current = tabs.find((o) => o.path === pathname || (o.id === 'home' && (pathname === '/' || pathname === '/index' || pathname === '/(tabs)'))) || tabs[0] || DEFAULT_TABS[0];

  return (
    <View style={styles.container}>
      <Pressable style={styles.button} onPress={() => setOpen(true)}>
        <Text style={styles.buttonText}>Menu ☰</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <LeafBorder color="#2E7D4F" size={20} />
            <View style={styles.handle} />
            <Text style={styles.menuTitle}>Where are we going? 🌿</Text>
            <Text style={styles.menuSubtitle}>I love you — pick a page, gorgeous 💋</Text>
            <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
              {tabs.map((o, i) => (
                <Pressable
                  key={o.id}
                  style={[styles.item, i < tabs.length - 1 && styles.itemDivider, o.path === pathname && styles.itemActive]}
                  onPress={() => {
                    setOpen(false);
                    router.push(o.path as any);
                  }}>
                  <View style={[styles.iconChip, o.path === pathname && styles.iconChipActive]}>
                    <Text style={styles.itemIcon}>{o.icon}</Text>
                  </View>
                  <View style={styles.itemTextWrap}>
                    <Text style={styles.itemText}>{o.label}</Text>
                    <Text style={styles.itemHint}>{o.hint}</Text>
                  </View>
                  <Text style={styles.itemChevron}>{o.path === pathname ? '●' : '›'}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeBtnText}>Stay here ✕</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginRight: 12 },
  button: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(120,120,120,0.2)' },
  buttonText: { fontWeight: '600', fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,10,15,0.45)', justifyContent: 'flex-end' },
  menu: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 30,
    paddingTop: 12,
    maxHeight: '84%',
    position: 'relative',
    overflow: 'hidden',
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(58,42,46,0.18)', marginBottom: 12 },
  menuTitle: { fontSize: 22, fontWeight: '800', marginBottom: 2, textAlign: 'center' },
  menuSubtitle: { fontSize: 13, opacity: 0.6, marginBottom: 14, textAlign: 'center', fontStyle: 'italic' },
  menuScroll: { maxHeight: 440 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 14 },
  itemDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(46,125,79,0.12)' },
  itemActive: { backgroundColor: 'rgba(46,125,79,0.1)' },
  iconChip: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(46,125,79,0.1)' },
  iconChipActive: { backgroundColor: 'rgba(46,125,79,0.24)' },
  itemIcon: { fontSize: 22 },
  itemTextWrap: { flex: 1 },
  itemText: { fontSize: 16, fontWeight: '700' },
  itemHint: { fontSize: 11, opacity: 0.55, marginTop: 1 },
  itemChevron: { fontSize: 16, color: '#2E7D4F', fontWeight: '700' },
  closeBtn: { marginTop: 12, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 28, borderRadius: 50, backgroundColor: 'rgba(46,125,79,0.12)' },
  closeBtnText: { fontWeight: '700', fontSize: 13 },
});