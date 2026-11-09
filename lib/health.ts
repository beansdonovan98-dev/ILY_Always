import { hasSupabaseEnv, supabase } from '@/lib/supabase';
import { localDateKey } from '@/lib/days';
import { getItem, setItem } from '@/lib/storage';

export type HealthUser = 'daddy' | 'princess';

/* ------------------------------------------------------------------ */
/* Body measurements — resets every 3 days                             */
/* ------------------------------------------------------------------ */

export const BODY_FIELDS = [
  { key: 'chest', label: 'Chest / Bust', emoji: '💗' },
  { key: 'waist', label: 'Waist', emoji: '📏' },
  { key: 'hips', label: 'Hips', emoji: '🍑' },
  { key: 'biceps', label: 'Biceps', emoji: '💪' },
  { key: 'thighs', label: 'Thighs', emoji: '🦵' },
  { key: 'bodyFat', label: 'Body Fat %', emoji: '⚖️' },
] as const;

export type BodyField = (typeof BODY_FIELDS)[number]['key'];

export interface BodyMetrics {
  chest: string;
  waist: string;
  hips: string;
  biceps: string;
  thighs: string;
  bodyFat: string;
  updatedAt: number;
}

export const BODY_RESET_MS = 3 * 24 * 60 * 60 * 1000;

export const EMPTY_BODY: BodyMetrics = {
  chest: '',
  waist: '',
  hips: '',
  biceps: '',
  thighs: '',
  bodyFat: '',
  updatedAt: 0,
};

const bodyKey = (coupleId: string, user: HealthUser) => `health:body:${coupleId}:${user}`;

function rowToBody(row: Record<string, unknown>): BodyMetrics {
  return {
    chest: (row.chest as string) ?? '',
    waist: (row.waist as string) ?? '',
    hips: (row.hips as string) ?? '',
    biceps: (row.biceps as string) ?? '',
    thighs: (row.thighs as string) ?? '',
    bodyFat: (row.body_fat as string) ?? '',
    updatedAt: row.updated_at ? Date.parse(row.updated_at as string) : 0,
  };
}

function expireBody(saved: BodyMetrics | null): BodyMetrics {
  if (!saved) return { ...EMPTY_BODY };
  if (!saved.updatedAt || Date.now() - saved.updatedAt >= BODY_RESET_MS) {
    // Measurements expire every 3 days so they stay current.
    return { ...EMPTY_BODY };
  }
  return saved;
}

export async function loadBody(coupleId: string, user: HealthUser): Promise<BodyMetrics> {
  const cached = await getItem<BodyMetrics | null>(bodyKey(coupleId, user), null);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { data, error } = await supabase
        .from('health_body')
        .select('*')
        .eq('couple_id', coupleId)
        .eq('user_key', user)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const next = expireBody(rowToBody(data));
        if (next.updatedAt) await setItem(bodyKey(coupleId, user), next);
        return next;
      }
    } catch {
      // fall through to cache
    }
  }

  return expireBody(cached);
}

export async function saveBody(coupleId: string, user: HealthUser, values: Partial<BodyMetrics>) {
  const next: BodyMetrics = { ...EMPTY_BODY, ...values, updatedAt: Date.now() };
  await setItem(bodyKey(coupleId, user), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('health_body').upsert(
        {
          couple_id: coupleId,
          user_key: user,
          chest: next.chest,
          waist: next.waist,
          hips: next.hips,
          biceps: next.biceps,
          thighs: next.thighs,
          body_fat: next.bodyFat,
          updated_at: new Date(next.updatedAt).toISOString(),
        },
        { onConflict: 'couple_id,user_key' }
      );
      if (error) throw error;
    } catch (e) {
      console.warn('[health] saveBody fell back to local cache', e);
    }
  }

  return next;
}

export function bodyResetLabel(metrics: BodyMetrics) {
  if (!metrics.updatedAt) return 'Resets every 3 days — nothing logged yet';
  const elapsed = Date.now() - metrics.updatedAt;
  const remaining = Math.max(BODY_RESET_MS - elapsed, 0);
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return days > 0 ? `Resets in ${days}d ${hours}h` : `Resets in ${Math.max(hours, 1)}h`;
}

/* ------------------------------------------------------------------ */
/* Weight — permanent history                                          */
/* ------------------------------------------------------------------ */

export interface WeightEntry {
  id: string;
  value: number;
  dateKey: string;
  at: number;
}

const weightKey = (coupleId: string, user: HealthUser) => `health:weight:${coupleId}:${user}`;

const sortWeights = (list: WeightEntry[]) => [...list].sort((a, b) => a.at - b.at);

export async function loadWeights(coupleId: string, user: HealthUser): Promise<WeightEntry[]> {
  const cached = await getItem<WeightEntry[]>(weightKey(coupleId, user), []);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { data, error } = await supabase
        .from('health_weights')
        .select('*')
        .eq('couple_id', coupleId)
        .eq('user_key', user)
        .order('logged_at', { ascending: true });
      if (error) throw error;
      const next = sortWeights(
        (data || []).map((row) => ({
          id: row.id as string,
          value: Number(row.value),
          dateKey: row.date_key as string,
          at: Date.parse(row.logged_at as string),
        }))
      );
      await setItem(weightKey(coupleId, user), next);
      return next;
    } catch {
      // fall through to cache
    }
  }

  return sortWeights(cached);
}

export async function addWeight(coupleId: string, user: HealthUser, value: number): Promise<WeightEntry[]> {
  const current = await loadWeights(coupleId, user);
  const entry: WeightEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    value,
    dateKey: localDateKey(),
    at: Date.now(),
  };
  const next = sortWeights([...current, entry]);
  await setItem(weightKey(coupleId, user), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('health_weights').insert({
        id: entry.id,
        couple_id: coupleId,
        user_key: user,
        value: entry.value,
        date_key: entry.dateKey,
        logged_at: new Date(entry.at).toISOString(),
      });
      if (error) throw error;
    } catch (e) {
      console.warn('[health] addWeight fell back to local cache', e);
    }
  }

  return next;
}

export async function updateWeight(
  coupleId: string,
  user: HealthUser,
  id: string,
  value: number
): Promise<WeightEntry[]> {
  const current = await loadWeights(coupleId, user);
  const next = sortWeights(current.map((w) => (w.id === id ? { ...w, value } : w)));
  await setItem(weightKey(coupleId, user), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase
        .from('health_weights')
        .update({ value })
        .eq('id', id)
        .eq('couple_id', coupleId);
      if (error) throw error;
    } catch (e) {
      console.warn('[health] updateWeight fell back to local cache', e);
    }
  }

  return next;
}

export async function removeWeight(coupleId: string, user: HealthUser, id: string): Promise<WeightEntry[]> {
  const current = await loadWeights(coupleId, user);
  const next = current.filter((w) => w.id !== id);
  await setItem(weightKey(coupleId, user), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('health_weights').delete().eq('id', id).eq('couple_id', coupleId);
      if (error) throw error;
    } catch (e) {
      console.warn('[health] removeWeight fell back to local cache', e);
    }
  }

  return next;
}

/* ------------------------------------------------------------------ */
/* Medicine — recurring list + a log of when each dose was taken        */
/* ------------------------------------------------------------------ */

export interface Med {
  id: string;
  name: string;
  dosage: string;
  timeLabel: string;
  reminder: boolean;
  who: string;
  createdAt: number;
}

export interface MedLog {
  id: string;
  medId: string;
  name: string;
  dosage: string;
  timeLabel: string;
  takenAt: number;
  dateKey: string;
}

const medsKey = (coupleId: string) => `health:meds:${coupleId}`;
const medLogsKey = (coupleId: string) => `health:medLogs:${coupleId}`;

function rowToMed(row: Record<string, unknown>): Med {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    dosage: (row.dosage as string) ?? '',
    timeLabel: (row.schedule_time as string) ?? '',
    reminder: Boolean(row.reminder),
    who: (row.who as string) ?? 'both',
    createdAt: row.created_at ? Date.parse(row.created_at as string) : Date.now(),
  };
}

export async function loadMeds(coupleId: string): Promise<Med[]> {
  const cached = await getItem<Med[]>(medsKey(coupleId), []);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { data, error } = await supabase
        .from('health_meds')
        .select('*')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const next = (data || []).map(rowToMed);
      await setItem(medsKey(coupleId), next);
      return next;
    } catch {
      // fall through to cache
    }
  }

  return cached;
}

export async function addMed(
  coupleId: string,
  input: { name: string; dosage: string; timeLabel: string; reminder: boolean; who?: string }
): Promise<Med[]> {
  const current = await loadMeds(coupleId);
  const med: Med = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: input.name,
    dosage: input.dosage,
    timeLabel: input.timeLabel,
    reminder: input.reminder,
    who: input.who ?? 'both',
    createdAt: Date.now(),
  };
  const next = [...current, med];
  await setItem(medsKey(coupleId), next);

  if (hasSupabaseEnv && coupleId) {
    const base = {
      id: med.id,
      couple_id: coupleId,
      name: med.name,
      dosage: med.dosage,
      schedule_time: med.timeLabel,
      reminder: med.reminder,
      created_at: new Date(med.createdAt).toISOString(),
    };
    try {
      const { error } = await supabase.from('health_meds').insert({ ...base, who: med.who });
      if (error) throw error;
    } catch (e) {
      // Graceful if `who` column does not exist yet — retry without it.
      try {
        const { error: retryError } = await supabase.from('health_meds').insert(base);
        if (retryError) throw retryError;
      } catch (retryErr) {
        console.warn('[health] addMed fell back to local cache', retryErr);
      }
    }
  }

  return next;
}

export async function updateMed(coupleId: string, id: string, patch: Partial<Med>): Promise<Med[]> {
  const current = await loadMeds(coupleId);
  const next = current.map((m) => (m.id === id ? { ...m, ...patch } : m));
  await setItem(medsKey(coupleId), next);

  if (hasSupabaseEnv && coupleId) {
    const patchPayload = {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.dosage !== undefined ? { dosage: patch.dosage } : {}),
      ...(patch.timeLabel !== undefined ? { schedule_time: patch.timeLabel } : {}),
      ...(patch.reminder !== undefined ? { reminder: patch.reminder } : {}),
      ...(patch.who !== undefined ? { who: patch.who } : {}),
    };
    try {
      const { error } = await supabase.from('health_meds').update(patchPayload).eq('id', id).eq('couple_id', coupleId);
      if (error) throw error;
    } catch (e) {
      // Graceful if `who` column missing — retry without it.
      if ((patchPayload as Record<string, unknown>).who !== undefined) {
        try {
          const { who: _omitted, ...withoutWho } = patchPayload as Record<string, unknown> & { who?: string };
          void _omitted;
          const { error: retryError } = await supabase.from('health_meds').update(withoutWho).eq('id', id).eq('couple_id', coupleId);
          if (retryError) throw retryError;
        } catch (retryErr) {
          console.warn('[health] updateMed fell back to local cache', retryErr);
        }
      } else {
        console.warn('[health] updateMed fell back to local cache', e);
      }
    }
  }

  return next;
}

export async function removeMed(coupleId: string, id: string): Promise<Med[]> {
  const current = await loadMeds(coupleId);
  const next = current.filter((m) => m.id !== id);
  await setItem(medsKey(coupleId), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('health_meds').delete().eq('id', id).eq('couple_id', coupleId);
      if (error) throw error;
      await supabase.from('health_med_logs').delete().eq('med_id', id).eq('couple_id', coupleId);
    } catch (e) {
      console.warn('[health] removeMed fell back to local cache', e);
    }
  }

  return next;
}

export async function loadMedLogs(coupleId: string, date = localDateKey()): Promise<MedLog[]> {
  const cached = await getItem<MedLog[]>(medLogsKey(coupleId), []);
  const localToday = cached.filter((l) => l.dateKey === date);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { data, error } = await supabase
        .from('health_med_logs')
        .select('*')
        .eq('couple_id', coupleId)
        .eq('date_key', date)
        .order('taken_at', { ascending: true });
      if (error) throw error;
      const next = (data || []).map((row) => ({
        id: row.id as string,
        medId: row.med_id as string,
        name: (row.name as string) ?? '',
        dosage: (row.dosage as string) ?? '',
        timeLabel: (row.time_label as string) ?? '',
        takenAt: Date.parse(row.taken_at as string),
        dateKey: row.date_key as string,
      }));
      const others = cached.filter((l) => l.dateKey !== date);
      await setItem(medLogsKey(coupleId), [...others, ...next]);
      return next;
    } catch {
      // fall through to cache
    }
  }

  return localToday;
}

export async function logMedDose(coupleId: string, med: Med, takenAt = Date.now()): Promise<MedLog[]> {
  const dateKey = localDateKey(new Date(takenAt));
  const log: MedLog = {
    id: `${takenAt}-${Math.random().toString(36).slice(2)}`,
    medId: med.id,
    name: med.name,
    dosage: med.dosage,
    timeLabel: med.timeLabel,
    takenAt,
    dateKey,
  };
  const cached = await getItem<MedLog[]>(medLogsKey(coupleId), []);
  const next = [...cached, log].sort((a, b) => a.takenAt - b.takenAt);
  await setItem(medLogsKey(coupleId), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('health_med_logs').insert({
        id: log.id,
        couple_id: coupleId,
        med_id: log.medId,
        name: log.name,
        dosage: log.dosage,
        time_label: log.timeLabel,
        taken_at: new Date(log.takenAt).toISOString(),
        date_key: log.dateKey,
      });
      if (error) throw error;
    } catch (e) {
      console.warn('[health] logMedDose fell back to local cache', e);
    }
  }

  return next.filter((l) => l.dateKey === dateKey);
}

export async function removeMedLog(coupleId: string, id: string, date = localDateKey()): Promise<MedLog[]> {
  const cached = await getItem<MedLog[]>(medLogsKey(coupleId), []);
  const next = cached.filter((l) => l.id !== id);
  await setItem(medLogsKey(coupleId), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('health_med_logs').delete().eq('id', id).eq('couple_id', coupleId);
      if (error) throw error;
    } catch (e) {
      console.warn('[health] removeMedLog fell back to local cache', e);
    }
  }

  return next.filter((l) => l.dateKey === date);
}

/* ------------------------------------------------------------------ */
/* Fitness — today only (resets daily)                                 */
/* ------------------------------------------------------------------ */

export interface FitnessEntry {
  id: string;
  exercise: string;
  sets: string;
  reps: string;
  minutes: string;
  dateKey: string;
  at: number;
}

const fitnessKey = (coupleId: string, user: HealthUser) => `health:fitness:${coupleId}:${user}`;

export async function loadFitness(coupleId: string, user: HealthUser): Promise<FitnessEntry[]> {
  const cached = await getItem<FitnessEntry[]>(fitnessKey(coupleId, user), []);
  const today = localDateKey();

  if (hasSupabaseEnv && coupleId) {
    try {
      const { data, error } = await supabase
        .from('health_fitness')
        .select('*')
        .eq('couple_id', coupleId)
        .eq('user_key', user)
        .eq('date_key', today)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const next = (data || []).map((row) => ({
        id: row.id as string,
        exercise: (row.exercise as string) ?? '',
        sets: (row.sets as string) ?? '',
        reps: (row.reps as string) ?? '',
        minutes: (row.minutes as string) ?? '',
        dateKey: row.date_key as string,
        at: row.created_at ? Date.parse(row.created_at as string) : Date.now(),
      }));
      const previous = cached.filter((f) => f.dateKey !== today);
      await setItem(fitnessKey(coupleId, user), [...previous, ...next]);
      return next;
    } catch {
      // fall through to cache
    }
  }

  return cached.filter((f) => f.dateKey === today);
}

export async function addFitness(coupleId: string, user: HealthUser, entry: FitnessEntry): Promise<FitnessEntry[]> {
  const cached = await getItem<FitnessEntry[]>(fitnessKey(coupleId, user), []);
  const today = localDateKey();
  // Keep a little local history but only today's shows in the app.
  const next = [...cached.filter((f) => f.dateKey >= shiftDateKey(today, -14)), entry];
  await setItem(fitnessKey(coupleId, user), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('health_fitness').insert({
        id: entry.id,
        couple_id: coupleId,
        user_key: user,
        exercise: entry.exercise,
        sets: entry.sets,
        reps: entry.reps,
        minutes: entry.minutes,
        date_key: entry.dateKey,
        created_at: new Date(entry.at).toISOString(),
      });
      if (error) throw error;
    } catch (e) {
      console.warn('[health] addFitness fell back to local cache', e);
    }
  }

  return next.filter((f) => f.dateKey === today);
}

export async function removeFitness(coupleId: string, user: HealthUser, id: string): Promise<FitnessEntry[]> {
  const cached = await getItem<FitnessEntry[]>(fitnessKey(coupleId, user), []);
  const next = cached.filter((f) => f.id !== id);
  await setItem(fitnessKey(coupleId, user), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('health_fitness').delete().eq('id', id).eq('couple_id', coupleId);
      if (error) throw error;
    } catch (e) {
      console.warn('[health] removeFitness fell back to local cache', e);
    }
  }

  const today = localDateKey();
  return next.filter((f) => f.dateKey === today);
}

/* ------------------------------------------------------------------ */
/* Period tracker — daily check-ins, kept as history                   */
/* ------------------------------------------------------------------ */

export const PERIOD_SYMPTOMS = [
  'Cramps',
  'Headache',
  'Bloating',
  'Fatigue',
  'Back pain',
  'Mood swings',
  'Nausea',
  'Cravings',
];

export interface PeriodDay {
  dateKey: string;
  pain: number;
  symptoms: string[];
  completed: boolean;
}

export interface PeriodState {
  startDate: string | null;
  endDate: string | null;
  days: PeriodDay[];
}

export const EMPTY_PERIOD: PeriodState = { startDate: null, endDate: null, days: [] };

const periodKey = (coupleId: string, user: HealthUser) => `health:period:${coupleId}:${user}`;

export async function loadPeriod(coupleId: string, user: HealthUser): Promise<PeriodState> {
  const cached = await getItem<PeriodState>(periodKey(coupleId, user), { ...EMPTY_PERIOD });

  if (hasSupabaseEnv && coupleId) {
    try {
      const [stateRes, daysRes] = await Promise.all([
        supabase
          .from('health_period_state')
          .select('*')
          .eq('couple_id', coupleId)
          .eq('user_key', user)
          .maybeSingle(),
        supabase
          .from('health_period_days')
          .select('*')
          .eq('couple_id', coupleId)
          .eq('user_key', user)
          .order('date_key', { ascending: true }),
      ]);
      if (stateRes.error) throw stateRes.error;
      if (daysRes.error) throw daysRes.error;

      const next: PeriodState = {
        startDate: (stateRes.data?.start_date as string) ?? null,
        endDate: (stateRes.data?.end_date as string) ?? null,
        days: (daysRes.data || []).map((row) => ({
          dateKey: row.date_key as string,
          pain: Number(row.pain ?? 0),
          symptoms: (row.symptoms as string[]) ?? [],
          completed: Boolean(row.completed),
        })),
      };
      await setItem(periodKey(coupleId, user), next);
      return next;
    } catch {
      // fall through to cache
    }
  }

  return cached;
}

export async function savePeriod(coupleId: string, user: HealthUser, state: PeriodState) {
  await setItem(periodKey(coupleId, user), state);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('health_period_state').upsert(
        {
          couple_id: coupleId,
          user_key: user,
          start_date: state.startDate,
          end_date: state.endDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'couple_id,user_key' }
      );
      if (error) throw error;

      // Small dataset: replace this person's day rows so removals stick too.
      await supabase.from('health_period_days').delete().eq('couple_id', coupleId).eq('user_key', user);
      if (state.days.length > 0) {
        await supabase.from('health_period_days').insert(
          state.days.map((d) => ({
            couple_id: coupleId,
            user_key: user,
            date_key: d.dateKey,
            pain: d.pain,
            symptoms: d.symptoms,
            completed: d.completed,
            updated_at: new Date().toISOString(),
          }))
        );
      }
    } catch (e) {
      console.warn('[health] savePeriod fell back to local cache', e);
    }
  }

  return state;
}

export function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

export function periodLength(state: PeriodState): number {
  if (!state.startDate) return 0;
  const start = new Date(`${state.startDate}T12:00:00`).getTime();
  const end = state.endDate
    ? new Date(`${state.endDate}T12:00:00`).getTime()
    : new Date(`${localDateKey()}T12:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1);
}

/* ------------------------------------------------------------------ */
/* Daily health list — same fixed list for both, never resets          */
/* ------------------------------------------------------------------ */

export const DAILY_HEALTH_TASKS = [
  { id: 'vitamins', label: 'Vitamins', emoji: '💊' },
  { id: 'skincare', label: 'Skincare', emoji: '✨' },
  { id: 'stretch', label: 'Stretch', emoji: '🧘' },
  { id: 'walk', label: 'Walk', emoji: '🚶' },
  { id: 'greens', label: 'Greens', emoji: '🥬' },
] as const;

export type DailyTaskId = (typeof DAILY_HEALTH_TASKS)[number]['id'];

export interface DailyTask {
  id: string;
  label: string;
  emoji: string;
}

const listKey = (coupleId: string) => `health:dailyList:${coupleId}`;

const seedTasks = (): DailyTask[] =>
  DAILY_HEALTH_TASKS.map((t) => ({ id: t.id as string, label: t.label, emoji: t.emoji }));

export async function loadDailyTasks(coupleId: string): Promise<DailyTask[]> {
  const cached = await getItem<DailyTask[]>(listKey(coupleId), []);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { data, error } = await supabase
        .from('health_daily_list')
        .select('task_id,label,emoji')
        .eq('couple_id', coupleId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      let next = (data || []).map((row) => ({
        id: row.task_id as string,
        label: (row.label as string) ?? '',
        emoji: (row.emoji as string) ?? '🌿',
      }));
      if (next.length === 0) {
        const seeded = seedTasks();
        await supabase.from('health_daily_list').insert(
          seeded.map((t) => ({
            couple_id: coupleId,
            task_id: t.id,
            label: t.label,
            emoji: t.emoji,
            created_at: new Date().toISOString(),
          }))
        );
        next = seeded;
      }
      await setItem(listKey(coupleId), next);
      return next;
    } catch {
      // fall through to cache
    }
  }

  return cached.length > 0 ? cached : seedTasks();
}

export async function addDailyTask(coupleId: string, label: string, emoji: string): Promise<DailyTask[]> {
  const current = await loadDailyTasks(coupleId);
  const task: DailyTask = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label,
    emoji: emoji || '🌿',
  };
  const next = [...current, task];
  await setItem(listKey(coupleId), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('health_daily_list').insert({
        couple_id: coupleId,
        task_id: task.id,
        label: task.label,
        emoji: task.emoji,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (e) {
      console.warn('[health] addDailyTask fell back to local cache', e);
    }
  }

  return next;
}

export async function removeDailyTask(coupleId: string, taskId: string): Promise<DailyTask[]> {
  const current = await loadDailyTasks(coupleId);
  const next = current.filter((t) => t.id !== taskId);
  await setItem(listKey(coupleId), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase
        .from('health_daily_list')
        .delete()
        .eq('task_id', taskId)
        .eq('couple_id', coupleId);
      if (error) throw error;
    } catch (e) {
      console.warn('[health] removeDailyTask fell back to local cache', e);
    }
  }

  return next;
}

const dailyKey = (coupleId: string, user: HealthUser) => `health:daily:${coupleId}:${user}`;
const dayTaskId = (taskId: string, dateKey: string) => `${taskId}|${dateKey}`;

export async function loadDailyChecks(coupleId: string, user: HealthUser): Promise<Record<string, boolean>> {
  const cached = await getItem<Record<string, boolean>>(dailyKey(coupleId, user), {});
  const since = shiftDateKey(localDateKey(), -60);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { data, error } = await supabase
        .from('health_daily_checks')
        .select('task_id,date_key,completed')
        .eq('couple_id', coupleId)
        .eq('user_key', user)
        .gte('date_key', since);
      if (error) throw error;
      const next: Record<string, boolean> = {};
      for (const row of data || []) {
        next[dayTaskId(row.task_id as string, row.date_key as string)] = Boolean(row.completed);
      }
      await setItem(dailyKey(coupleId, user), next);
      return next;
    } catch {
      // fall through to cache
    }
  }

  return cached;
}

export async function toggleDailyCheck(
  coupleId: string,
  user: HealthUser,
  checks: Record<string, boolean>,
  taskId: string,
  dateKey: string
): Promise<Record<string, boolean>> {
  const key = dayTaskId(taskId, dateKey);
  const next = { ...checks, [key]: !checks[key] };
  await setItem(dailyKey(coupleId, user), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('health_daily_checks').upsert(
        {
          couple_id: coupleId,
          user_key: user,
          task_id: taskId,
          date_key: dateKey,
          completed: next[key],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'couple_id,user_key,task_id,date_key' }
      );
      if (error) throw error;
    } catch (e) {
      console.warn('[health] toggleDailyCheck fell back to local cache', e);
    }
  }

  return next;
}

/* ------------------------------------------------------------------ */
/* Water tracker — 4 cups a day, per person                            */
/* ------------------------------------------------------------------ */

export const WATER_GOAL = 4;

const waterKey = (coupleId: string, user: HealthUser) => `health:water:${coupleId}:${user}`;

export async function loadWater(coupleId: string, user: HealthUser): Promise<Record<string, number>> {
  const cached = await getItem<Record<string, number>>(waterKey(coupleId, user), {});
  const since = shiftDateKey(localDateKey(), -60);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { data, error } = await supabase
        .from('health_water')
        .select('date_key,cups')
        .eq('couple_id', coupleId)
        .eq('user_key', user)
        .gte('date_key', since);
      if (error) throw error;
      const next: Record<string, number> = {};
      for (const row of data || []) {
        next[row.date_key as string] = Number(row.cups ?? 0);
      }
      await setItem(waterKey(coupleId, user), next);
      return next;
    } catch {
      // fall through to cache
    }
  }

  return cached;
}

export async function setWaterCups(
  coupleId: string,
  user: HealthUser,
  water: Record<string, number>,
  dateKey: string,
  cups: number
): Promise<Record<string, number>> {
  const clamped = Math.max(0, Math.min(cups, WATER_GOAL));
  const next = { ...water, [dateKey]: clamped };
  await setItem(waterKey(coupleId, user), next);

  if (hasSupabaseEnv && coupleId) {
    try {
      const { error } = await supabase.from('health_water').upsert(
        {
          couple_id: coupleId,
          user_key: user,
          date_key: dateKey,
          cups: clamped,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'couple_id,user_key,date_key' }
      );
      if (error) throw error;
    } catch (e) {
      console.warn('[health] setWaterCups fell back to local cache', e);
    }
  }

  return next;
}

/* ------------------------------------------------------------------ */
/* 7-day streak helpers (shared by daily list + water)                 */
/* ------------------------------------------------------------------ */

export function lastSevenDays(): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDateKey(localDateKey(), i - 6));
}

export function streakEndingToday(doneForDay: (dateKey: string) => boolean): number {
  let streak = 0;
  let cursor = localDateKey();
  // If today isn't done yet, the streak can still run through yesterday.
  if (!doneForDay(cursor)) cursor = shiftDateKey(cursor, -1);
  while (doneForDay(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

export function isPerfectWeek(doneForDay: (dateKey: string) => boolean): boolean {
  return lastSevenDays().every(doneForDay);
}
