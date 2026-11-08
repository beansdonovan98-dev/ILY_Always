import { getItem, setItem } from '@/lib/storage';
import { todayKey } from '@/constants/content';
import { UserKey } from '@/constants/content';

export type ActivityRoute = 'home' | 'our-log' | 'playtime' | 'ai-editor' | 'health' | 'cleaning' | 'dbt';

const activityKey = (route: ActivityRoute) => `activity:${route}:${todayKey()}`;

export interface DayActivity {
  daddy: boolean;
  princess: boolean;
}

/** Marks that this partner posted something on this page today (device-local). */
export async function markActivity(route: ActivityRoute, user: UserKey): Promise<void> {
  const key = activityKey(route);
  const current = await getItem<DayActivity>(key, { daddy: false, princess: false });
  const next = { ...current, [user]: true };
  await setItem(key, next);
}

/** Reads today's activity flags for all trackable routes. */
export async function loadActivityDots(): Promise<Record<string, DayActivity>> {
  const routes: ActivityRoute[] = ['home', 'our-log', 'playtime', 'ai-editor', 'health', 'cleaning', 'dbt'];
  const out: Record<string, DayActivity> = {};
  for (const route of routes) {
    out[route] = await getItem<DayActivity>(activityKey(route), { daddy: false, princess: false });
  }
  return out;
}
