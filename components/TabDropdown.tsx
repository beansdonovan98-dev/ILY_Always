import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

import { getCoupleId } from '@/lib/couple';
import { getCoupleSettings } from '@/lib/appearance';
import { LeafBorder } from '@/components/CannabisLeaf';

const DEFAULT_TABS = [
  { id: 'home', label: 'Home 🏠', path: '/', icon: '🏠', hint: 'Our shared space' },
  { id: 'our-log', label: 'Our Log 📜', path: '/our-log', icon: '📜', hint: 'Daily memories' },
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
            <Text style={styles.menuTitle}>Where to next? 🌿</Text>
            <Text style={styles.menuSubtitle}>Pick a page, lover 💋</Text>
            <ScrollView style={styles.menuScroll}>
              {tabs.map((o) => (
                <Pressable
                  key={o.id}
                  style={[styles.item, o.path === pathname && styles.itemActive]}
                  onPress={() => {
                    setOpen(false);
                    router.push(o.path as any);
                  }}>
                  <Text style={styles.itemIcon}>{o.icon}</Text>
                  <View style={styles.itemTextWrap}>
                    <Text style={styles.itemText}>{o.label}</Text>
                    <Text style={styles.itemHint}>{o.hint}</Text>
                  </View>
                  {o.path === pathname && <Text style={styles.itemActiveDot}>●</Text>}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeBtnText}>Close ✕</Text>
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
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '80%',
    position: 'relative',
    overflow: 'hidden',
  },
  menuTitle: { fontSize: 22, fontWeight: '800', marginBottom: 2, textAlign: 'center' },
  menuSubtitle: { fontSize: 13, opacity: 0.6, marginBottom: 14, textAlign: 'center', fontStyle: 'italic' },
  menuScroll: { maxHeight: 420 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, marginBottom: 6 },
  itemActive: { backgroundColor: 'rgba(46,125,79,0.12)' },
  itemIcon: { fontSize: 26 },
  itemTextWrap: { flex: 1 },
  itemText: { fontSize: 16, fontWeight: '700' },
  itemHint: { fontSize: 11, opacity: 0.55, marginTop: 1 },
  itemActiveDot: { fontSize: 10, color: '#2E7D4F' },
  closeBtn: { marginTop: 10, alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 24, borderRadius: 50, backgroundColor: 'rgba(46,125,79,0.12)' },
  closeBtnText: { fontWeight: '700', fontSize: 13 },
});