import { Tabs, usePathname } from 'expo-router';
import { DeviceEventEmitter, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import TabDropdown from '@/components/TabDropdown';
import { JointVector } from '@/components/CannabisHardware';
import { SMOKE_BURST_EVENT } from '@/components/CannabisOverlay';
import { useTheme } from '@/contexts/ThemeContext';
import { useUsage } from '@/contexts/UsageContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { getCoupleId } from '@/lib/couple';
import { markSeen, ActivityRoute } from '@/lib/activity';
import { pingPresence, readPresence, isOnline } from '@/lib/presence';
import { supabase } from '@/lib/supabase';
import { USERS, UserKey } from '@/constants/content';
import { useCallback, useEffect, useState } from 'react';

/** Compact presence chip: lives in the header between Log out and Menu. */
function PresencePill() {
  const { currentUser, authenticated } = useUsage();
  const { settings } = useTheme();
  const appTheme = useAppTheme();
  const [online, setOnline] = useState(false);
  const partner: UserKey = currentUser === 'daddy' ? 'princess' : 'daddy';

  // Smoke pulse next to the pill; tapping fires a burst of puffs overlay-wide.
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.25, { duration: 700 }), withTiming(1, { duration: 700 })), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.6 + 0.4 * pulse.value,
  }));

  const handleTap = () => {
    DeviceEventEmitter.emit(SMOKE_BURST_EVENT);
  };

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
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  // Live: the moment her phone pings, our row updates — no polling lag.
  useEffect(() => {
    if (!authenticated) return;
    let alive = true;
    let unsub: (() => void) | undefined;
    (async () => {
      const cid = await getCoupleId();
      const channel = supabase
        .channel(`presence:${cid}:${partner}:${Math.random().toString(36).slice(2, 9)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'presence', filter: `couple_id=eq.${cid},user_key=eq.${partner}` },
          async (payload) => {
            if (!alive) return;
            const row = payload.new as { last_seen?: string } | undefined;
            if (row?.last_seen) setOnline(isOnline(Date.parse(row.last_seen)));
          }
        )
        .subscribe();
      unsub = () => {
        supabase.removeChannel(channel);
      };
    })();
    return () => {
      alive = false;
      unsub?.();
    };
  }, [authenticated, partner]);

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
    <Pressable
      onPress={handleTap}
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
      <Animated.View style={pulseStyle}>
        <JointVector size={26} color="#F5E6C8" />
      </Animated.View>
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
    </Pressable>
  );
}

export default function TabLayout() {
  const { settings } = useTheme();
  const { logout, currentUser, authenticated } = useUsage();
  const pathname = usePathname();

  // Opening a page clears its unread dot for you.
  useEffect(() => {
    if (!authenticated) return;
    const routeId = pathname.replace(/^\//, '').split('/')[0];
    if (!routeId) return;
    getCoupleId().then((cid) => {
      markSeen(routeId as ActivityRoute, currentUser, cid);
    });
  }, [pathname, authenticated, currentUser]);
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
