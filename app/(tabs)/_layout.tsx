import { Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';

import TabDropdown from '@/components/TabDropdown';
import { useTheme } from '@/contexts/ThemeContext';
import { useUsage } from '@/contexts/UsageContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { getCoupleId } from '@/lib/couple';
import { pingPresence, readPresence, isOnline } from '@/lib/presence';
import { USERS, UserKey } from '@/constants/content';
import { useCallback, useEffect, useState } from 'react';

/** Compact presence chip: lives in the header between Log out and Menu. */
function PresencePill() {
  const { currentUser, authenticated } = useUsage();
  const { settings } = useTheme();
  const appTheme = useAppTheme();
  const [online, setOnline] = useState(false);
  const partner: UserKey = currentUser === 'daddy' ? 'princess' : 'daddy';

  const refresh = useCallback(async () => {
    if (!authenticated) {
      setOnline(false);
      return;
    }
    const cid = await getCoupleId();
    setOnline(isOnline(await readPresence(cid, partner)));
  }, [authenticated, partner]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => void refresh(), 15000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!authenticated) return;
    let alive = true;
    (async () => {
      const cid = await getCoupleId();
      if (!alive) return;
      await pingPresence(cid, currentUser);
      const t = setInterval(async () => {
        if (!alive) return;
        const cid2 = await getCoupleId();
        await pingPresence(cid2, currentUser);
      }, 20000);
      return () => clearInterval(t);
    })();
    return () => {
      alive = false;
    };
  }, [authenticated, currentUser]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: 999,
        backgroundColor: 'rgba(120,120,120,0.18)',
        borderWidth: 1,
        borderColor: settings?.border_color || 'rgba(46,125,79,0.3)',
      }}>
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: online ? '#2E7D4F' : (settings?.font_color || '#3A2A2E'),
          opacity: online ? 1 : 0.35,
        }}
      />
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: settings?.font_color || '#3A2A2E',
          fontStyle: 'italic' as const,
          fontFamily: appTheme.fontFamily,
        }}>
        {online ? `${USERS[partner].name} here 💚` : `${USERS[partner].name} off ☁️`}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { settings } = useTheme();
  const { logout } = useUsage();
  const appTheme = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        // Each screen renders its own H1, so the nav bar only holds the menu.
        headerTitle: () => <PresencePill />,
        sceneStyle: { backgroundColor: 'transparent' },
        headerStyle: { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerTintColor: settings?.font_color || '#3A2A2E',
        tabBarStyle: { display: 'none' },
        headerLeft: () => (
          <Pressable onPress={logout} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(120,120,120,0.2)', marginLeft: 12, marginTop: 4 }}>
            <Text style={{ fontWeight: '600', fontSize: 14, color: settings?.font_color || '#3A2A2E', fontFamily: appTheme.fontFamily }}>Log out 🔒</Text>
          </Pressable>
        ),
        headerRight: () => <TabDropdown />,
      }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="our-log" />
      <Tabs.Screen name="dbt" />
      <Tabs.Screen name="playtime" />
      <Tabs.Screen name="ai-editor" />
      <Tabs.Screen name="health" />
      <Tabs.Screen name="cleaning" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="days-of-old" />
    </Tabs>
  );
}
