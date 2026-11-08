import { hasSupabaseEnv, supabase } from '@/lib/supabase';
import { getItem, setItem } from '@/lib/storage';
import { UserKey } from '@/constants/content';

export type ActivityRoute = 'home' | 'our-log' | 'playtime' | 'ai-editor' | 'health' | 'cleaning' | 'dbt';

const BERLIN_OK = ['home', 'our-log', 'playtime', 'ai-editor', 'health', 'cleaning', 'dbt'] as const;

const activityKey = (route: ActivityRoute) => `activity:${route}`;
const seenKey = (route: ActivityRoute, user: UserKey) => `seen:${route}:${user}`;
const normalizeRoute = (route: string): ActivityRoute => ((BERLIN_OK as readonly string[]).includes(route) ? (route as ActivityRoute) : 'home');

export interface DayActivity {
  daddy: number | null;
  princess: number | null;
}

/** Marks that this partner posted something on this page just now. Preserves seen_at. */
export async function markActivity(route: ActivityRoute, user: UserKey, coupleId = ''): Promise<void> {
  const r = normalizeRoute(route);
  const key = activityKey(r);
  const current = await getItem<DayActivity>(key, { daddy: null, princess: null });
  await setItem(key, { ...current, [user]: Date.now() });

  if (hasSupabaseEnv && coupleId) {
    try {
      // Read first so we never null out the other timestamp on upsert.
      const { data: existing } = await supabase
        .from('activity_flags')
        .select('posted_at,seen_at')
        .eq('couple_id', coupleId)
        .eq('user_key', user)
        .eq('route', r)
        .maybeSingle();
      const { error } = await supabase.from('activity_flags').upsert(
        {
          couple_id: coupleId,
          user_key: user,
          route: r,
          posted_at: new Date().toISOString(),
          seen_at: (existing as any)?.seen_at ?? null,
        },
        { onConflict: 'couple_id,user_key,route' }
      );
      if (error) throw error;
    } catch (e) {
      console.warn('[activity] post fell back to local cache', e);
    }
  }
}

/** Last time this user opened this page and "saw" the posts. Preserves posted_at. */
export async function markSeen(route: ActivityRoute, user: UserKey, coupleId = ''): Promise<void> {
  const r = normalizeRoute(route);
  await setItem(seenKey(r, user), Date.now());

  if (hasSupabaseEnv && coupleId) {
    try {
      const { data: existing } = await supabase
        .from('activity_flags')
        .select('posted_at,seen_at')
        .eq('couple_id', coupleId)
        .eq('user_key', user)
        .eq('route', r)
        .maybeSingle();
      const { error } = await supabase.from('activity_flags').upsert(
        {
          couple_id: coupleId,
          user_key: user,
          route: r,
          seen_at: new Date().toISOString(),
          posted_at: (existing as any)?.posted_at ?? null,
        },
        { onConflict: 'couple_id,user_key,route' }
      );
      if (error) throw error;
    } catch (e) {
      console.warn('[activity] seen fell back to local cache', e);
    }
  }
}

export interface ActivityDots {
  /** Partner posted something I haven't seen yet (her dot on my phone). */
  hers: boolean;
  /** I posted something she hasn't seen yet (my dot on her phone). */
  mine: boolean;
}

/**
 * For each route: "hers" = partner has a post newer than my last view;
 * "mine" = I have a post newer than her last view.
 */
export async function loadActivityDots(currentUser: UserKey, coupleId = ''): Promise<Record<string, ActivityDots>> {
  const out: Record<string, ActivityDots> = {};
  const partner: UserKey = currentUser === 'daddy' ? 'princess' : 'daddy';

  for (const route of BERLIN_OK) {
    out[route] = { mine: false, hers: false };
  }

  if (coupleId && hasSupabaseEnv) {
    try {
      const { data, error } = await supabase
        .from('activity_flags')
        .select('user_key,route,posted_at,seen_at')
        .eq('couple_id', coupleId);
      if (error) throw error;
      for (const route of BERLIN_OK) {
        const mine = (data || []).find((r: any) => r.user_key === currentUser && r.route === route) as
          | { posted_at?: string; seen_at?: string }
          | undefined;
        const hers = (data || []).find((r: any) => r.user_key === partner && r.route === route) as
          | { posted_at?: string; seen_at?: string }
          | undefined;
        const mySeenAt = mine?.seen_at ? Date.parse(mine.seen_at) : 0;
        const herSeenAt = hers?.seen_at ? Date.parse(hers.seen_at) : 0;
        const myPostedAt = mine?.posted_at ? Date.parse(mine.posted_at) : 0;
        const herPostedAt = hers?.posted_at ? Date.parse(hers.posted_at) : 0;
        out[route] = {
          mine: myPostedAt > herSeenAt && myPostedAt > 0,
          hers: herPostedAt > mySeenAt && herPostedAt > 0,
        };
      }
    } catch (e) {
      console.warn('[activity] Supabase dots fell back to local cache', e);
    }
  }

  return out;
}
