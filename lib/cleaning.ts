import { hasSupabaseEnv, supabase } from '@/lib/supabase';
import { localDateKey } from '@/lib/days';
import { getItem, setItem } from '@/lib/storage';

export interface Chore {
  id: string;
  label: string;
  emoji: string;
}

export const DAILY_CHORES: Chore[] = [
  { id: 'bed', label: 'Make the bed', emoji: '🛏️' },
  { id: 'sink', label: 'Dishes out of the sink', emoji: '🍽️' },
  { id: 'bowls', label: 'Wash the bowls', emoji: '🥣' },
  { id: 'counters', label: 'Wipe off the counters', emoji: '🧽' },
  { id: 'swiffer', label: 'Dry swiffer the floor', emoji: '✨' },
  { id: 'room-dishes', label: 'Dishes from the room', emoji: '🍷' },
  { id: 'laundry', label: 'At least one load of laundry', emoji: '🧺' },
  { id: 'soak', label: 'Soak the bongs', emoji: '🌿' },
];

export const TWO_DAY_CHORES: Chore[] = [
  { id: 'litter', label: 'Cat litter', emoji: '🐱' },
  { id: 'trash', label: 'Take down the trash', emoji: '🗑️' },
  { id: 'stove', label: 'Wipe down the stove', emoji: '🔥' },
  { id: 'pickup', label: 'Pick up the room', emoji: '🧹' },
];

export const WEEKLY_CHORES: Chore[] = [
  { id: 'sheets', label: 'Change sheets', emoji: '🛏' },
  { id: 'towels', label: 'Change towels', emoji: '🏳️' },
  { id: 'floormats', label: 'Bathroom floormats', emoji: '🚿' },
  { id: 'filters', label: 'Dust filters', emoji: '🪟' },
];

export interface FocusArea {
  name: string;
  emoji: string;
  tasks: Chore[];
}

export const FOCUS_AREAS: FocusArea[] = [
  {
    name: 'Kitchen',
    emoji: '🍳',
    tasks: [
      { id: 'fridge', label: 'Clean out the fridge', emoji: '🧊' },
      { id: 'microwave', label: 'Wipe the microwave', emoji: '♨️' },
      { id: 'stovetop', label: 'Degrease the stovetop', emoji: '🔥' },
      { id: 'sink-scrub', label: 'Scrub sink & faucet', emoji: '🚰' },
      { id: 'trash-can', label: 'Wash the trash can', emoji: '🗑️' },
    ],
  },
  {
    name: 'Living Room',
    emoji: '🛋️',
    tasks: [
      { id: 'dust-shelves', label: 'Dust shelves & surfaces', emoji: '✨' },
      { id: 'couch', label: 'Vacuum the couch cushions', emoji: '🛋' },
      { id: 'remotes', label: 'Clean remotes & coasters', emoji: '🎮' },
      { id: 'blankets', label: 'Wash throw blankets', emoji: '🧺' },
    ],
  },
  {
    name: 'Closets',
    emoji: '👕',
    tasks: [
      { id: 'purge', label: 'Purge what we don\u2019t wear', emoji: '👕' },
      { id: 'shelves', label: 'Dust the shelves', emoji: '✨' },
      { id: 'floor', label: 'Vacuum closet floors', emoji: '🧹' },
      { id: 'fold', label: 'Re-fold & stack neatly', emoji: '🧺' },
    ],
  },
  {
    name: 'Bedroom',
    emoji: '🛏️',
    tasks: [
      { id: 'mattress', label: 'Flip / rotate the mattress', emoji: '🔄' },
      { id: 'nightstands', label: 'Dust headboard & nightstands', emoji: '✨' },
      { id: 'pillows', label: 'Wash the pillows', emoji: '🛏' },
      { id: 'drawers', label: 'Organize the drawers', emoji: '🗄️' },
    ],
  },
  {
    name: 'Bathroom',
    emoji: '🚿',
    tasks: [
      { id: 'shower', label: 'Bleach the shower & tub', emoji: '🫧' },
      { id: 'toilet', label: 'Scrub toilet inside & out', emoji: '🚽' },
      { id: 'mirror', label: 'Descale & shine the mirror', emoji: '🪞' },
      { id: 'grout', label: 'Scrub the grout', emoji: '🧽' },
      { id: 'restock', label: 'Restock toilet paper', emoji: '🧻' },
    ],
  },
];

export type Cadence = 'daily' | 'twoDay' | 'weekly' | 'focus';

/* ------------------------------------------------------------------ */
/* Date math — weeks run Sunday → Saturday                             */
/* ------------------------------------------------------------------ */

const sundayOf = (dateKey: string): string => {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return localDateKey(d);
};

export const sundayOfToday = () => sundayOf(localDateKey());

/** Focus area for a given week-Sunday. Rotates through the 5 areas. */
export function focusAreaForWeek(weekSunday: string): FocusArea {
  const base = new Date('2026-01-04T12:00:00').getTime(); // a Sunday
  const weeks = Math.floor((new Date(`${weekSunday}T12:00:00`).getTime() - base) / (7 * 24 * 60 * 60 * 1000));
  const idx = ((weeks % FOCUS_AREAS.length) + FOCUS_AREAS.length) % FOCUS_AREAS.length;
  return FOCUS_AREAS[idx];
}

/** Saturday = the week has expired; the focus card stays hidden until Sunday. */
export const isFocusHiddenToday = () => new Date().getDay() === 6;

/** 2-day cadence anchors on Sundays: due every other day starting Sunday. */
export const TWO_DAY_ANCHOR = '2026-01-04'; // a Sunday

function daysSince(a: string, b: string): number {
  const A = new Date(`${a}T12:00:00`).getTime();
  const B = new Date(`${b}T12:00:00`).getTime();
  return Math.round((B - A) / (24 * 60 * 60 * 1000));
}

export const twoDayDueToday = (today = localDateKey()) => {
  const offset = daysSince(TWO_DAY_ANCHOR, today);
  return offset >= 0 && offset % 2 === 0;
};

export const twoDayCycleKey = (today = localDateKey()) => {
  const offset = Math.max(daysSince(TWO_DAY_ANCHOR, today), 0);
  const cycleStart = offset % 2 === 0 ? offset : offset - 1;
  const d = new Date(new Date(`${TWO_DAY_ANCHOR}T12:00:00`).getTime() + cycleStart * 24 * 60 * 60 * 1000);
  return localDateKey(d);
};

/** Key used for storing this cadence's checks in the current cycle. */
export function currentCycleKey(cadence: Cadence, today = localDateKey()): string {
  if (cadence === 'daily') return today;
  if (cadence === 'twoDay') return twoDayCycleKey(today);
  return sundayOf(today); // weekly + focus renew on Sunday
}

/* ------------------------------------------------------------------ */
/* Checks — checks keyed by cadence|taskId|cycleKey                    */
/* ------------------------------------------------------------------ */

const checksKey = (coupleId: string) => `cleaning:checks:${coupleId}`;
const checkId = (cadence: Cadence, taskId: string, cycleKey: string) => `${cadence}|${taskId}|${cycleKey}`;

export const isDone = (checks: Record<string, boolean>, cadence: Cadence, taskId: string, cycleKey: string) =>
  Boolean(checks[checkId(cadence, taskId, cycleKey)]);

export const allDone = (checks: Record<string, boolean>, cadence: Cadence, chores: Chore[], cycleKey: string) =>
  chores.length > 0 && chores.every((c) => isDone(checks, cadence, c.id, cycleKey));

export async function loadChecks(coupleId: string): Promise<Record<string, boolean>> {
  const cached = await getItem<Record<string, boolean>>(checksKey(coupleId), {});

  if (hasSupabaseEnv && coupleId) {
    try {
      const { data, error } = await supabase
        .from('cleaning_checks')
        .select('cadence,task_id,cycle_key,completed')
        .eq('couple_id', coupleId);
      if (error) throw error;
      const next: Record<string, boolean> = {};
      for (const row of data || []) {
        next[checkId(row.cadence as Cadence, row.task_id as string, row.cycle_key as string)] = Boolean(row.completed);
      }
      await setItem(checksKey(coupleId), next);
      return next;
    } catch {
      // fall through to cache
    }
  }

  return cached;
}

export async function toggleCheck(
  coupleId: string,
  checks: Record<string, boolean>,
  cadence: Cadence,
  taskId: string,
  cycleKey: string
): Promise<Record<string, boolean>> {
  const key = checkId(cadence, taskId, cycleKey);
  const next = { ...checks, [key]: !checks[key] };
  await setItem(checksKey(coupleId), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('cleaning_checks').upsert(
        {
          couple_id: coupleId,
          cadence,
          task_id: taskId,
          cycle_key: cycleKey,
          completed: next[key],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'couple_id,cadence,task_id,cycle_key' }
      );
      if (error) throw error;
    } catch (e) {
      console.warn('[cleaning] toggleCheck fell back to local cache', e);
    }
  }

  return next;
}

/* ------------------------------------------------------------------ */
/* Streaks                                                             */
/* ------------------------------------------------------------------ */

export interface Streaks {
  daily: number;
  twoDay: number;
  weekly: number;
}

function dateShifts(days: number): string {
  const d = new Date(`${localDateKey()}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

/** Consecutive days (ending today or yesterday) where every daily chore was done. */
function dailyStreak(checks: Record<string, boolean>): number {
  let streak = 0;
  for (let back = 0; back < 400; back++) {
    const key = dateShifts(-back);
    const done = allDone(checks, 'daily', DAILY_CHORES, key);
    if (!done) {
      if (back === 0) continue; // today not done yet — streak can still be alive via yesterday
      break;
    }
    streak += 1;
  }
  return streak;
}

function twoDayStreak(checks: Record<string, boolean>): number {
  let streak = 0;
  for (let cycle = 0; cycle < 200; cycle++) {
    const anchor = new Date(`${TWO_DAY_ANCHOR}T12:00:00`).getTime() + cycle * 2 * 24 * 60 * 60 * 1000;
    const key = localDateKey(new Date(anchor));
    const done = allDone(checks, 'twoDay', TWO_DAY_CHORES, key);
    if (!done) {
      if (twoDayCycleKey() === key) continue; // current cycle still in progress
      break;
    }
    streak += 1;
  }
  return streak;
}

function weeklyStreak(checks: Record<string, boolean>): number {
  let streak = 0;
  const todaySunday = sundayOfToday();
  for (let back = 0; back < 200; back++) {
    const weekSunday = (() => {
      const d = new Date(`${todaySunday}T12:00:00`);
      d.setDate(d.getDate() - back * 7);
      return localDateKey(d);
    })();
    const done = allDone(checks, 'weekly', WEEKLY_CHORES, weekSunday);
    if (!done) {
      if (back === 0) continue; // this week still in progress
      break;
    }
    streak += 1;
  }
  return streak;
}

export function computeStreaks(checks: Record<string, boolean>): Streaks {
  return {
    daily: dailyStreak(checks),
    twoDay: twoDayStreak(checks),
    weekly: weeklyStreak(checks),
  };
}
