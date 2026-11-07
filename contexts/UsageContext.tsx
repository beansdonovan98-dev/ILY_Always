import { createContext, useContext } from 'react';

import { useDailyUsage } from '@/hooks/useDailyUsage';

type UsageContextValue = ReturnType<typeof useDailyUsage>;

const UsageContext = createContext<UsageContextValue | null>(null);

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const value = useDailyUsage();
  return <UsageContext.Provider value={value}>{children}</UsageContext.Provider>;
}

export function useUsage() {
  const ctx = useContext(UsageContext);
  if (!ctx) throw new Error('useUsage must be used within UsageProvider');
  return ctx;
}