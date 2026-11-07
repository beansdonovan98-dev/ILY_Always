import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { getItem, setItem } from '@/lib/storage';
import { todayKey, UserKey, USERS } from '@/constants/content';

interface UsageState {
  date: string;
  daddy: number;
  princess: number;
}

const USAGE_KEY = 'dailyUsage';
const USER_KEY = 'currentUser';

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function useDailyUsage() {
  const [usage, setUsage] = useState<UsageState>({ date: todayKey(), daddy: 0, princess: 0 });
  const [currentUser, setCurrentUserState] = useState<UserKey>('daddy');
  const [authenticated, setAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);

  const activeUserRef = useRef<UserKey>('daddy');
  const lastTickRef = useRef<number | null>(null);
  const usageRef = useRef<UsageState>(usage);

  useEffect(() => {
    usageRef.current = usage;
  }, [usage]);

  useEffect(() => {
    activeUserRef.current = currentUser;
  }, [currentUser]);

  // load persisted
  useEffect(() => {
    (async () => {
      const storedUsage = await getItem<UsageState>(USAGE_KEY, { date: todayKey(), daddy: 0, princess: 0 });
      const storedUser = await getItem<UserKey>(USER_KEY, 'daddy');
      const today = todayKey();
      const normalized: UsageState =
        storedUsage.date === today
          ? storedUsage
          : { date: today, daddy: 0, princess: 0 };
      setUsage(normalized);
      usageRef.current = normalized;
      setCurrentUserState(storedUser);
      activeUserRef.current = storedUser;
      setReady(true);
    })();
  }, []);

  const flush = useCallback(() => {
    const now = Date.now();
    const last = lastTickRef.current;
    if (last == null) return;
    const elapsed = (now - last) / 1000;
    lastTickRef.current = now;
    if (elapsed <= 0) return;
    setUsage((prev) => {
      const today = todayKey();
      let base = prev;
      if (prev.date !== today) {
        base = { date: today, daddy: 0, princess: 0 };
      }
      const next = { ...base };
      if (activeUserRef.current === 'daddy') next.daddy += elapsed;
      else next.princess += elapsed;
      usageRef.current = next;
      return next;
    });
  }, []);

  const setCurrentUser = useCallback((u: UserKey) => {
    // flush current elapsed before switching
    flush();
    setCurrentUserState(u);
    activeUserRef.current = u;
    setItem(USER_KEY, u);
  }, [flush]);

  /** Called by the login screen once the PIN is verified. */
  const login = useCallback((u: UserKey) => {
    flush();
    lastTickRef.current = Date.now();
    setCurrentUserState(u);
    activeUserRef.current = u;
    setItem(USER_KEY, u);
    setAuthenticated(true);
  }, [flush]);

  const logout = useCallback(() => {
    flush();
    setAuthenticated(false);
    lastTickRef.current = null;
  }, [flush]);

  useEffect(() => {
    if (!ready) return;
    // start ticking
    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      flush();
      // persist occasionally (every tick is fine but throttle not needed for small app)
      setItem(USAGE_KEY, usageRef.current);
    }, 1000);

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        lastTickRef.current = Date.now();
      } else {
        flush();
        setItem(USAGE_KEY, usageRef.current);
        lastTickRef.current = null;
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
      flush();
      setItem(USAGE_KEY, usageRef.current);
    };
  }, [ready, flush]);

  // midnight reset check via interval already handles date change in flush

  return { usage, currentUser, setCurrentUser, login, logout, authenticated, ready, formatDuration };
}