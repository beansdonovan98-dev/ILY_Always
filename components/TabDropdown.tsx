import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

import { getCoupleId } from '@/lib/couple';
import { getCoupleSettings } from '@/lib/appearance';

const DEFAULT_TABS = [
  { id: 'home', label: 'Home 🏠', path: '/' },
  { id: 'our-log', label: 'Our Log 📜', path: '/our-log' },
  { id: 'days-of-old', label: 'The Days of Old 🧙‍♂️', path: '/days-of-old' },
  { id: 'ai-editor', label: 'AI Photo Editor 📷', path: '/ai-editor' },
  { id: 'playtime', label: 'Playtime 😓', path: '/playtime' },
  { id: 'settings', label: 'Settings ⚙️', path: '/settings' },
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
            return { id: t.id, label: t.label || def?.label || t.id, path: def?.path || '/' };
          });
        // filter playtime unless revealed
        const revealed = !!s.playtime_revealed;
        const filtered = mapped.filter((t) => t.id !== 'playtime' || revealed);
        setTabs(filtered.length ? filtered : DEFAULT_TABS);
      }
    })();
  }, []);

  const current = tabs.find((o) => o.path === pathname || (o.id === 'home' && (pathname === '/' || pathname === '/index' || pathname === '/(tabs)'))) || tabs[0] || DEFAULT_TABS[0];

  return (
    <View style={styles.container}>
      <Pressable style={styles.button} onPress={() => setOpen(true)}>
        <Text style={styles.buttonText}>Menu ☰</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {tabs.map((o) => (
              <Pressable
                key={o.id}
                style={[styles.item, o.path === pathname && styles.itemActive]}
                onPress={() => {
                  setOpen(false);
                  router.push(o.path as any);
                }}>
                <Text style={styles.itemText}>{o.label}</Text>
              </Pressable>
            ))}
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 60, paddingRight: 12 },
  menu: { backgroundColor: '#fff', borderRadius: 12, padding: 8, minWidth: 180, elevation: 4 },
  item: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  itemActive: { backgroundColor: 'rgba(100,150,255,0.2)' },
  itemText: { fontSize: 15 },
});