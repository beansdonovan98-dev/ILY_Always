import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useUsage } from '@/contexts/UsageContext';
import { getCoupleId } from '@/lib/couple';
import { pingPresence, readPresence, isOnline } from '@/lib/presence';
import { USERS, UserKey } from '@/constants/content';

/**
 * Tiny top banner showing whether your partner is on the app right now.
 * "Online" = last ping within 90 seconds.
 */
export function PresenceBanner() {
  const theme = useAppTheme();
  const { currentUser, authenticated } = useUsage();
  const partner = currentUser === 'daddy' ? 'princess' : 'daddy';
  const partnerLabel = USERS[partner].name;
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!authenticated) return;
    const cid = await getCoupleId();
    setLastSeen(await readPresence(cid, partner as UserKey));
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

  const online = isOnline(lastSeen);

  return (
    <View style={[styles.banner, { backgroundColor: theme.accentSoft, borderBottomColor: theme.borderColor }]}>
      <View style={[styles.dot, { backgroundColor: online ? '#2E7D4F' : theme.textColor, opacity: online ? 1 : 0.3 }]} />
      <Text style={[styles.text, { color: theme.textColor }]}>
        {online
          ? `${partnerLabel} is here with us 💚`
          : `${partnerLabel} isn't on the app right now ☁️`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: '700' },
});

export default PresenceBanner;
