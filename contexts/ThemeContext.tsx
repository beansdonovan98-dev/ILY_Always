import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { getCoupleId } from '@/lib/couple';
import {
  CoupleSettings,
  getCoupleSettings,
  subscribeCoupleSettings,
  upsertCoupleSettings,
} from '@/lib/appearance';
import { getItem, setItem } from '@/lib/storage';

const CACHE_KEY = (coupleId: string) => `coupleSettings:${coupleId}`;

const BASE_SETTINGS: CoupleSettings = {
  couple_id: '',
  background_color: null,
  background_gradient: null,
  accent_color: null,
  font_id: null,
  font_color: null,
  border_color: null,
  animated_gradient: false,
  daily_rotation: false,
  tab_config: null,
  playtime_revealed: false,
  avatar_daddy: null,
  avatar_princess: null,
  love_notes: null,
  updated_at: new Date(0).toISOString(),
};

interface ThemeContextValue {
  settings: CoupleSettings | null;
  coupleId: string;
  /** Applies immediately to the whole app, then syncs to Supabase in the background. */
  updateSettings: (patch: Partial<CoupleSettings>) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  settings: null,
  coupleId: '',
  updateSettings: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CoupleSettings | null>(null);
  const [coupleId, setCoupleId] = useState('');
  const coupleIdRef = useRef('');
  const settingsRef = useRef<CoupleSettings | null>(null);

  settingsRef.current = settings;

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let alive = true;

    (async () => {
      const cid = await getCoupleId();
      coupleIdRef.current = cid;
      setCoupleId(cid);

      // Cache first so the saved theme is visible instantly at launch.
      const cached = await getItem<CoupleSettings | null>(CACHE_KEY(cid), null);
      if (alive && cached) setSettings(cached);

      const remote = await getCoupleSettings(cid);
      if (alive && remote) setSettings(remote);

      unsub = subscribeCoupleSettings(cid, (next) => {
        if (alive) setSettings(next);
      });
    })();

    return () => {
      alive = false;
      if (unsub) unsub();
    };
  }, []);

  const updateSettings = useCallback(async (patch: Partial<CoupleSettings>) => {
    const cid = coupleIdRef.current || (await getCoupleId());
    if (!coupleIdRef.current) {
      coupleIdRef.current = cid;
      setCoupleId(cid);
    }

    const previous =
      settingsRef.current ||
      (await getItem<CoupleSettings | null>(CACHE_KEY(cid), null)) ||
      BASE_SETTINGS;

    const merged: CoupleSettings = {
      ...BASE_SETTINGS,
      ...previous,
      ...patch,
      couple_id: cid,
      updated_at: new Date().toISOString(),
    };

    // 1. Apply instantly (no round-trip, works offline).
    settingsRef.current = merged;
    setSettings(merged);
    await setItem(CACHE_KEY(cid), merged);

    // 2. Sync in the background; local state is already correct either way.
    try {
      const saved = await upsertCoupleSettings(merged);
      settingsRef.current = saved;
      setSettings(saved);
      await setItem(CACHE_KEY(cid), saved);
    } catch (e) {
      console.warn('[theme] Supabase sync failed — kept local settings.', e);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, coupleId, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
