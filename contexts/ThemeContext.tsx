import { createContext, useContext, useEffect, useState } from 'react';
import { View } from 'react-native';

import { getCoupleId } from '@/lib/couple';
import { getCoupleSettings, subscribeCoupleSettings, CoupleSettings } from '@/lib/appearance';

interface ThemeContextValue {
  settings: CoupleSettings | null;
  coupleId: string;
}

const ThemeContext = createContext<ThemeContextValue>({ settings: null, coupleId: '' });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CoupleSettings | null>(null);
  const [coupleId, setCoupleId] = useState('');

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const cid = await getCoupleId();
      setCoupleId(cid);
      const s = await getCoupleSettings(cid);
      setSettings(s);
      unsub = subscribeCoupleSettings(cid, (next) => setSettings(next));
    })();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, coupleId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { settings } = useTheme();
  const bg = settings?.background_color || '#ffffff';
  return <View style={{ flex: 1, backgroundColor: bg }}>{children}</View>;
}