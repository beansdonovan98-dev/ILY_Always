import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';

import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { Celebration } from '@/components/Celebration';
import { WeightChart, ChartPoint } from '@/components/WeightChart';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useUsage } from '@/contexts/UsageContext';

import { getCoupleId } from '@/lib/couple';
import { getItem } from '@/lib/storage';
import { localDateKey } from '@/lib/days';
import { USERS } from '@/constants/content';
import { formatReminderTime, syncMedReminders } from '@/lib/med-reminders';
import {
  BODY_FIELDS,
  BodyField,
  BodyMetrics,
  DAILY_HEALTH_TASKS,
  DailyTaskId,
  EMPTY_BODY,
  EMPTY_PERIOD,
  FitnessEntry,
  HealthUser,
  Med,
  MedLog,
  PERIOD_SYMPTOMS,
  PeriodDay,
  PeriodState,
  WATER_GOAL,
  WeightEntry,
  addFitness as addFitnessEntry,
  addMed as addMedRow,
  addWeight as addWeightEntry,
  bodyResetLabel,
  loadBody,
  loadDailyChecks,
  loadFitness,
  loadMedLogs,
  loadMeds,
  loadPeriod,
  loadWater,
  loadWeights,
  logMedDose,
  periodLength,
  removeFitness,
  removeMed as removeMedRow,
  removeMedLog,
  removeWeight as removeWeightEntry,
  updateWeight as updateWeightEntry,
  isPerfectWeek,
  lastSevenDays,
  saveBody,
  savePeriod,
  setWaterCups,
  shiftDateKey,
  streakEndingToday,
  toggleDailyCheck,
  updateMed as updateMedRow,
} from '@/lib/health';

/* ------------------------------------------------------------------ */

function Pill({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress} style={styles.pillPress}>
      <LinearGradient
        colors={[theme.accentColor, '#C86DD7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.pill}>
        <Text style={styles.pillText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function GhostPill({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.ghostPill,
        { borderColor: theme.borderColor, backgroundColor: 'rgba(255,255,255,0.45)' },
      ]}>
      <Text style={styles.ghostPillText}>{label}</Text>
    </Pressable>
  );
}

function DosePill({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={[theme.accentColor, '#C86DD7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.dosePill}>
        <Text style={styles.dosePillText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */

export default function HealthScreen() {
  const theme = useAppTheme();
  const { currentUser } = useUsage();
  const me = currentUser as HealthUser;
  const partner: HealthUser = me === 'daddy' ? 'princess' : 'daddy';

  const [coupleId, setCoupleId] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [myBody, setMyBody] = useState<BodyMetrics>({ ...EMPTY_BODY });
  const [theirBody, setTheirBody] = useState<BodyMetrics>({ ...EMPTY_BODY });
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [medLogs, setMedLogs] = useState<MedLog[]>([]);
  const [fitness, setFitness] = useState<FitnessEntry[]>([]);
  const [myDaily, setMyDaily] = useState<Record<string, boolean>>({});
  const [theirDaily, setTheirDaily] = useState<Record<string, boolean>>({});
  const [myWater, setMyWater] = useState<Record<string, number>>({});
  const [theirWater, setTheirWater] = useState<Record<string, number>>({});
  const [celebration, setCelebration] = useState<{ mode: 'small' | 'big'; message: string } | null>(null);
  const [period, setPeriod] = useState<PeriodState>({ ...EMPTY_PERIOD });
  const [pain, setPain] = useState(0);
  const [symptoms, setSymptoms] = useState<string[]>([]);

  // forms
  const [wVal, setWVal] = useState('');
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [mName, setMName] = useState('');
  const [mDose, setMDose] = useState('');
  const [mTime, setMTime] = useState('');
  const [mReminder, setMReminder] = useState(true);
  const [fEx, setFEx] = useState('');
  const [fSets, setFSets] = useState('');
  const [fReps, setFReps] = useState('');
  const [fMin, setFMin] = useState('');
  const [startDraft, setStartDraft] = useState('');

  const load = useCallback(async () => {
    const cid = await getCoupleId();
    setCoupleId(cid);

    setMyBody(await loadBody(cid, me));
    setTheirBody(await loadBody(cid, partner));
    setWeights(await loadWeights(cid, me));
    const loadedMeds = await loadMeds(cid);
    setMeds(loadedMeds);
    setMedLogs(await loadMedLogs(cid));
    setFitness(await loadFitness(cid, me));
    setMyDaily(await loadDailyChecks(cid, me));
    setTheirDaily(await loadDailyChecks(cid, partner));
    setMyWater(await loadWater(cid, me));
    setTheirWater(await loadWater(cid, partner));
    setRevealed(await getItem<boolean>('periodRevealed', false));

    const nextPeriod = await loadPeriod(cid, me);
    setPeriod(nextPeriod);
    setStartDraft(nextPeriod.startDate || '');
    const todayLog = nextPeriod.days.find((d) => d.dateKey === localDateKey());
    setPain(todayLog?.pain ?? 0);
    setSymptoms(todayLog?.symptoms ?? []);

    void syncMedReminders(loadedMeds);
  }, [me, partner]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  /* ----------------------------- body ----------------------------- */

  const updateMetric = (key: BodyField, value: string) => {
    setMyBody((prev) => ({ ...prev, [key]: value }));
  };

  const saveMyBody = async () => {
    if (!coupleId) return;
    setMyBody(await saveBody(coupleId, me, myBody));
  };

  /* ---------------------------- weight ---------------------------- */

  const addWeight = async () => {
    const value = parseFloat(wVal.replace(',', '.'));
    if (!isFinite(value) || value <= 0) return;
    if (editingWeightId) {
      setWeights(await updateWeightEntry(coupleId, me, editingWeightId, value));
      setEditingWeightId(null);
    } else {
      setWeights(await addWeightEntry(coupleId, me, value));
    }
    setWVal('');
  };

  const deleteWeight = async (id: string) => {
    setWeights(await removeWeightEntry(coupleId, me, id));
    if (editingWeightId === id) {
      setEditingWeightId(null);
      setWVal('');
    }
  };

  const chartData: ChartPoint[] = weights.map((w) => ({
    id: w.id,
    value: w.value,
    label: w.dateKey.slice(5).replace('-', '/'),
  }));

  /* --------------------------- medicine --------------------------- */

  const addMed = async () => {
    if (!mName.trim()) return;
    const next = await addMedRow(coupleId, {
      name: mName.trim(),
      dosage: mDose.trim(),
      timeLabel: mTime.trim(),
      reminder: mReminder,
    });
    setMeds(next);
    setMName('');
    setMDose('');
    setMTime('');
    setMReminder(true);
    void syncMedReminders(next);
  };

  const takeMed = async (med: Med) => {
    setMedLogs(await logMedDose(coupleId, med));
  };

  const undoDose = async (id: string) => {
    setMedLogs(await removeMedLog(coupleId, id));
  };

  const toggleReminder = async (med: Med) => {
    const next = await updateMedRow(coupleId, med.id, { reminder: !med.reminder });
    setMeds(next);
    void syncMedReminders(next);
  };

  const deleteMed = async (id: string) => {
    const next = await removeMedRow(coupleId, id);
    setMeds(next);
    setMedLogs((prev) => prev.filter((l) => l.medId !== id));
    void syncMedReminders(next);
  };

  /* ---------------------------- fitness --------------------------- */

  const addFitness = async () => {
    if (!fEx.trim()) return;
    const entry: FitnessEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      exercise: fEx.trim(),
      sets: fSets.trim(),
      reps: fReps.trim(),
      minutes: fMin.trim(),
      dateKey: localDateKey(),
      at: Date.now(),
    };
    setFitness(await addFitnessEntry(coupleId, me, entry));
    setFEx('');
    setFSets('');
    setFReps('');
    setFMin('');
  };

  const deleteFitness = async (id: string) => {
    setFitness(await removeFitness(coupleId, me, id));
  };

  /* --------------------- daily health list --------------------- */

  const dailyDone = (checks: Record<string, boolean>, taskId: string, dateKey: string) =>
    Boolean(checks[`${taskId}|${dateKey}`]);

  const toggleTask = async (taskId: DailyTaskId) => {
    const today = localDateKey();
    const next = await toggleDailyCheck(coupleId, me, myDaily, taskId, today);
    setMyDaily(next);
    if (dailyDone(next, taskId, today)) {
      const doneForDay = (d: string) => dailyDone(next, taskId, d);
      const task = DAILY_HEALTH_TASKS.find((t) => t.id === taskId);
      if (isPerfectWeek(doneForDay)) {
        setCelebration({ mode: 'big', message: `${task?.emoji ?? ''} ${task?.label ?? ''} — 7 days in a row! 🔥` });
      } else {
        setCelebration({ mode: 'small', message: `${task?.emoji ?? ''} ${task?.label ?? ''} — crossed off! ✔️` });
      }
    }
  };

  /* --------------------------- water --------------------------- */

  const waterCupsToday = (water: Record<string, number>) => water[localDateKey()] ?? 0;
  const waterDoneDay = (water: Record<string, number>) => (d: string) => (water[d] ?? 0) >= WATER_GOAL;

  const setWater = async (cups: number) => {
    const today = localDateKey();
    const before = waterCupsToday(myWater);
    const next = await setWaterCups(coupleId, me, myWater, today, cups);
    setMyWater(next);
    if (cups >= WATER_GOAL && next[today] >= WATER_GOAL && before < WATER_GOAL) {
      if (isPerfectWeek(waterDoneDay(next))) {
        setCelebration({ mode: 'big', message: '💧 Hydration hero — 4 cups, 7 days in a row! 🔥' });
      } else {
        setCelebration({ mode: 'small', message: '💧 4 cups down — goal smashed! ✔️' });
      }
    }
  };

  /* ----------------------------- period --------------------------- */

  const startPeriod = async () => {
    const start = startDraft.trim() || localDateKey();
    const next: PeriodState = { startDate: start, endDate: null, days: [] };
    setPeriod(next);
    await savePeriod(coupleId, me, next);
  };

  const completePeriod = async () => {
    const next: PeriodState = { ...period, endDate: localDateKey() };
    setPeriod(next);
    await savePeriod(coupleId, me, next);
  };

  const toggleSymptom = (s: string) => {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const saveCheckIn = async () => {
    const key = localDateKey();
    const day: PeriodDay = { dateKey: key, pain, symptoms, completed: true };
    const next: PeriodState = {
      ...period,
      startDate: period.startDate || key,
      days: [...period.days.filter((d) => d.dateKey !== key), day].sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
    };
    setPeriod(next);
    await savePeriod(coupleId, me, next);
  };

  const lastSeven = Array.from({ length: 7 }, (_, i) => shiftDateKey(localDateKey(), i - 6));
  const periodDays = periodLength(period);
  const todayChecked = period.days.some((d) => d.dateKey === localDateKey() && d.completed);

  /* ---------------------- 7-day streak trackers --------------------- */

  const renderStreakDots = (doneForDay: (d: string) => boolean) => (
    <View style={styles.streakRow}>
      {lastSevenDays().map((d) => (
        <View key={d} style={styles.dayWrap}>
          <View
            style={[
              styles.dayDot,
              doneForDay(d)
                ? { backgroundColor: theme.accentColor, borderColor: theme.accentColor }
                : { backgroundColor: 'rgba(255,255,255,0.5)', borderColor: theme.borderColor },
            ]}>
            <Text style={[styles.dayDotText, doneForDay(d) && { color: '#FFFFFF' }]}>
              {doneForDay(d) ? '✓' : '·'}
            </Text>
          </View>
          <Text style={styles.dayLabel}>{d.slice(8)}</Text>
        </View>
      ))}
    </View>
  );

  const renderBubble = (person: HealthUser, done: boolean, onPress: () => void) => {
    const isMe = person === me;
    return (
      <Pressable
        onPress={onPress}
        disabled={!isMe}
        style={[
          styles.bubble,
          isMe ? { borderColor: theme.accentColor } : { borderColor: theme.borderColor },
          done
            ? { backgroundColor: theme.accentSoft }
            : { backgroundColor: 'rgba(255,255,255,0.5)' },
        ]}>
        <Text style={styles.bubbleMark}>{done ? '✓' : '○'}</Text>
      </Pressable>
    );
  };

  /* ----------------------------- render --------------------------- */

  const renderBodyPanel = (person: HealthUser) => {
    const isMe = person === me;
    const metrics = isMe ? myBody : theirBody;
    const label = person === 'daddy' ? 'Him 👨' : 'Her 👩';

    return (
      <View style={[styles.subCard, { borderColor: theme.borderColor }]}>
        <View style={styles.subHeader}>
          <Text style={styles.subTitle}>{label}</Text>
          <Text style={[styles.tag, isMe ? styles.tagYou : styles.tagLock]}>
            {isMe ? 'You ✏️' : 'View only 🔒'}
          </Text>
        </View>

        {BODY_FIELDS.map((field) => (
          <View key={field.key} style={styles.metricRow}>
            <Text style={styles.metricLabel}>
              {field.emoji} {field.label}
            </Text>
            {isMe ? (
              <TextInput
                value={myBody[field.key]}
                onChangeText={(v) => updateMetric(field.key, v)}
                placeholder="—"
                placeholderTextColor="rgba(58,42,46,0.4)"
                keyboardType="decimal-pad"
                style={[styles.metricInput, { borderColor: theme.borderColor, color: theme.textColor }]}
              />
            ) : (
              <Text style={styles.metricValue}>{metrics[field.key] || '—'}</Text>
            )}
          </View>
        ))}

        {isMe && (
          <>
            <Text style={styles.smallHint}>{bodyResetLabel(myBody)}</Text>
            <Pill label="Save Measurements" onPress={saveMyBody} />
          </>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Health 🩺</Text>
      <Text style={[styles.subtitle, { color: theme.subtitleColor }]}>
        Keeping our dirty little temples fed, fit, and fully charged for mischief 🔥💪💦
      </Text>

      {/* Body measurements */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Him &amp; Her Body Measurements 💪</Text>
        <Text style={styles.cardHint}>
          Only you can edit your own numbers — measurements refresh every 3 days 🍃
        </Text>
        {renderBodyPanel('daddy')}
        {renderBodyPanel('princess')}
      </View>

      {/* Weight */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Weight Tracker ⚖️</Text>
        <Text style={styles.cardHint}>Every number on this scale matters just as much as every number in the bedroom 😏⚖️ (only you can edit yours)</Text>

        <WeightChart data={chartData} accentColor={theme.accentColor} textColor={theme.textColor} />

        <View style={styles.row}>
          <TextInput
            value={wVal}
            onChangeText={setWVal}
            placeholder="Weight (kg/lbs)"
            placeholderTextColor="rgba(58,42,46,0.4)"
            keyboardType="decimal-pad"
            style={[styles.input, styles.flex, { borderColor: theme.borderColor, color: theme.textColor }]}
          />
          <Pill label={editingWeightId ? 'Save Weight' : 'Log Weight'} onPress={addWeight} />
        </View>

        {editingWeightId ? (
          <GhostPill
            label="Cancel edit"
            onPress={() => {
              setEditingWeightId(null);
              setWVal('');
            }}
          />
        ) : null}

        {weights.length > 0 && (
          <View style={styles.list}>
            {[...weights]
              .reverse()
              .slice(0, 5)
              .map((w) => (
                <View key={w.id} style={styles.listRow}>
                  <Text style={styles.listText}>
                    {w.value} — {w.dateKey}
                  </Text>
                  <GhostPill
                    label="Edit"
                    onPress={() => {
                      setEditingWeightId(w.id);
                      setWVal(String(w.value));
                    }}
                  />
                  <GhostPill label="Delete" onPress={() => deleteWeight(w.id)} />
                </View>
              ))}
          </View>
        )}
      </View>

      {/* Medicine */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Medicine &amp; Supplements 💊</Text>
        <Text style={styles.cardHint}>
          Twice a day, every day — so we never run out of steam when it matters most 💊🔥 The log clears at midnight 🌅
        </Text>

        <TextInput
          value={mName}
          onChangeText={setMName}
          placeholder="Medicine name"
          placeholderTextColor="rgba(58,42,46,0.4)"
          style={[styles.input, { borderColor: theme.borderColor, color: theme.textColor }]}
        />
        <View style={styles.row}>
          <TextInput
            value={mDose}
            onChangeText={setMDose}
            placeholder="Dosage (1 pill)"
            placeholderTextColor="rgba(58,42,46,0.4)"
            style={[styles.input, styles.flex, { borderColor: theme.borderColor, color: theme.textColor }]}
          />
          <TextInput
            value={mTime}
            onChangeText={setMTime}
            placeholder="Time (8:00 AM)"
            placeholderTextColor="rgba(58,42,46,0.4)"
            style={[styles.input, styles.flex, { borderColor: theme.borderColor, color: theme.textColor }]}
          />
        </View>

        <View style={styles.reminderRow}>
          <Text style={styles.reminderLabel}>🔔 Daily reminder</Text>
          <Switch value={mReminder} onValueChange={setMReminder} />
        </View>

        <Pill label="+ Add Medication" onPress={addMed} />

        {meds.length === 0 && <Text style={styles.empty}>Nothing on the list yet.</Text>}

        {meds.map((m) => {
          const dose = medLogs.find((l) => l.medId === m.id);
          return (
            <View key={m.id} style={[styles.medRow, { borderColor: theme.borderColor }]}>
              <View style={styles.flex}>
                <Text style={styles.medName}>{m.name}</Text>
                <Text style={styles.smallHint}>
                  {m.dosage || 'No dose'} •{' '}
                  {m.timeLabel ? formatReminderTime(m.timeLabel) : 'Anytime'}
                  {m.reminder ? ' • 🔔' : ''}
                </Text>
                {dose ? (
                  <Text style={styles.takenAt}>
                    ✓ Taken at{' '}
                    {new Date(dose.takenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                ) : (
                  <Text style={styles.pendingAt}>○ Pending today</Text>
                )}
                <View style={styles.medActions}>
                  <GhostPill
                    label={m.reminder ? 'Reminder on' : 'Reminder off'}
                    onPress={() => toggleReminder(m)}
                  />
                  <GhostPill label="✕ Remove" onPress={() => deleteMed(m.id)} />
                </View>
              </View>

              {dose ? (
                <DosePill label="Undo" onPress={() => undoDose(dose.id)} />
              ) : (
                <DosePill label="Take now" onPress={() => takeMed(m)} />
              )}
            </View>
          );
        })}

        <Text style={styles.label}>Today&apos;s doses</Text>
        {medLogs.length === 0 ? (
          <Text style={styles.empty}>No doses logged today yet.</Text>
        ) : (
          medLogs.map((log) => (
            <View key={log.id} style={styles.listRow}>
              <Text style={styles.listText}>
                💊 {log.name} —{' '}
                {new Date(log.takenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </Text>
              <GhostPill label="Undo" onPress={() => undoDose(log.id)} />
            </View>
          ))
        )}
      </View>

      {/* Fitness */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Fitness Log 🏋️</Text>
        <Text style={styles.cardHint}>
          Working out keeps us looking dangerous and feeling even dirtier 🏋️💦 Logging as {USERS[me].name} — resets daily 🌅
        </Text>

        <TextInput
          value={fEx}
          onChangeText={setFEx}
          placeholder="Exercise (squats, run, yoga...)"
          placeholderTextColor="rgba(58,42,46,0.4)"
          style={[styles.input, { borderColor: theme.borderColor, color: theme.textColor }]}
        />
        <View style={styles.row}>
          <TextInput
            value={fSets}
            onChangeText={setFSets}
            placeholder="Sets"
            placeholderTextColor="rgba(58,42,46,0.4)"
            keyboardType="numeric"
            style={[styles.input, styles.flex, { borderColor: theme.borderColor, color: theme.textColor }]}
          />
          <TextInput
            value={fReps}
            onChangeText={setFReps}
            placeholder="Reps"
            placeholderTextColor="rgba(58,42,46,0.4)"
            keyboardType="numeric"
            style={[styles.input, styles.flex, { borderColor: theme.borderColor, color: theme.textColor }]}
          />
          <TextInput
            value={fMin}
            onChangeText={setFMin}
            placeholder="Min"
            placeholderTextColor="rgba(58,42,46,0.4)"
            keyboardType="numeric"
            style={[styles.input, styles.flex, { borderColor: theme.borderColor, color: theme.textColor }]}
          />
        </View>
        <Pill label="+ Log Workout" onPress={addFitness} />

        {fitness.length === 0 && <Text style={styles.empty}>No workouts logged today yet.</Text>}

        {fitness.map((f) => (
          <View key={f.id} style={styles.listRow}>
            <Text style={styles.listText}>
              {f.exercise}
              {f.sets || f.reps ? ` • ${f.sets || '-'}×${f.reps || '-'}` : ''}
              {f.minutes ? ` • ${f.minutes} min` : ''}
            </Text>
            <GhostPill label="✕" onPress={() => deleteFitness(f.id)} />
          </View>
        ))}
      </View>

      {/* Daily health list */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Daily Health List 🌿</Text>
        <Text style={[styles.cardHint, { color: theme.subtitleColor }]}>
          Cross off our little rituals together, darling — every tick is a promise we keep to each other 💚
        </Text>

        <View style={styles.bubbleHeader}>
          <Text style={styles.bubbleHeaderLabel}>Daddy 🍆</Text>
          <Text style={styles.bubbleHeaderLabel}>Princess 🍑</Text>
        </View>

        {DAILY_HEALTH_TASKS.map((task) => {
          const myDone = dailyDone(myDaily, task.id, localDateKey());
          const theirDone = dailyDone(theirDaily, task.id, localDateKey());
          const myStreak = streakEndingToday((d) => dailyDone(myDaily, task.id, d));
          return (
            <View key={task.id}>
              <View style={styles.bubbleRow}>
                {renderBubble('daddy', me === 'daddy' ? myDone : theirDone, () =>
                  me === 'daddy' ? toggleTask(task.id) : undefined
                )}
                <View style={styles.bubbleLabel}>
                  <Text style={styles.bubbleName}>
                    {task.emoji} {task.label}
                  </Text>
                </View>
                {renderBubble('princess', me === 'princess' ? myDone : theirDone, () =>
                  me === 'princess' ? toggleTask(task.id) : undefined
                )}
              </View>
              {me && (
                <View style={styles.streakWithCount}>
                  {renderStreakDots((d) => dailyDone(myDaily, task.id, d))}
                  <Text style={styles.streakCount}>
                    {myStreak > 0 ? `🔥 ${myStreak}-day streak` : 'Start your streak today 💪'}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Water tracker */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Water Tracker 💧</Text>
        <Text style={[styles.cardHint, { color: theme.subtitleColor }]}>
          Four cups a day keeps the thirst away — and keeps you glowing for me, sweetheart 💦
        </Text>

        <Text style={styles.label}>{USERS[me].label} — {waterCupsToday(myWater)}/{WATER_GOAL} cups</Text>
        <View style={styles.cupRow}>
          {Array.from({ length: WATER_GOAL }, (_, i) => (
            <Pressable
              key={i}
              onPress={() => setWater(waterCupsToday(myWater) === i + 1 ? i : i + 1)}
              style={[
                styles.cup,
                { borderColor: theme.borderColor },
                waterCupsToday(myWater) > i && { backgroundColor: theme.accentSoft, borderColor: theme.accentColor },
              ]}>
              <Text style={styles.cupEmoji}>{waterCupsToday(myWater) > i ? '💧' : '🤍'}</Text>
            </Pressable>
          ))}
          <Text style={styles.streakCount}>
            🔥 {streakEndingToday(waterDoneDay(myWater))}-day streak
          </Text>
        </View>
        {renderStreakDots(waterDoneDay(myWater))}

        <Text style={[styles.label, { marginTop: 16 }]}>{USERS[partner].label} — {waterCupsToday(theirWater)}/{WATER_GOAL} cups</Text>
        <View style={styles.cupRow}>
          {Array.from({ length: WATER_GOAL }, (_, i) => (
            <View
              key={i}
              style={[
                styles.cup,
                { borderColor: theme.borderColor },
                waterCupsToday(theirWater) > i && { backgroundColor: theme.accentSoft, borderColor: theme.accentColor },
              ]}>
              <Text style={styles.cupEmoji}>{waterCupsToday(theirWater) > i ? '💧' : '🤍'}</Text>
            </View>
          ))}
          <Text style={styles.streakCount}>
            🔥 {streakEndingToday(waterDoneDay(theirWater))}-day streak
          </Text>
        </View>
        {renderStreakDots(waterDoneDay(theirWater))}
      </View>

      <Celebration
        mode={celebration?.mode ?? null}
        message={celebration?.message ?? ''}
        onDone={() => setCelebration(null)}
      />

      {/* Period tracker */}
      {revealed && (
        <View style={[styles.card, theme.cardStyle]}>
          <LeafBorder color={theme.leafColor} />
          <Text style={styles.cardTitle}>Period Tracker 🌸</Text>
          <Text style={styles.cardHint}>
            {period.startDate
              ? period.endDate
                ? `Last cycle: ${period.startDate} → ${period.endDate} (${periodDays} days)`
                : `Day ${periodDays} of this cycle`
              : 'Start a cycle to begin tracking 🌱'}
          </Text>

          {!period.startDate || period.endDate ? (
            <>
              <Text style={styles.label}>Start day (YYYY-MM-DD)</Text>
              <TextInput
                value={startDraft}
                onChangeText={setStartDraft}
                placeholder={localDateKey()}
                placeholderTextColor="rgba(58,42,46,0.4)"
                style={[styles.input, { borderColor: theme.borderColor, color: theme.textColor }]}
              />
              <Pill label="Start Period" onPress={startPeriod} />
            </>
          ) : (
            <GhostPill label="Mark Period Complete ✓" onPress={completePeriod} />
          )}

          <Text style={styles.label}>Pain scale (0–10)</Text>
          <View style={styles.row}>
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <Pressable
                key={n}
                onPress={() => setPain(n)}
                style={[
                  styles.painChip,
                  pain === n
                    ? { backgroundColor: theme.accentSoft, borderColor: theme.accentColor }
                    : { backgroundColor: 'rgba(255,255,255,0.5)', borderColor: theme.borderColor },
                ]}>
                <Text style={styles.painChipText}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Symptoms</Text>
          <View style={styles.row}>
            {PERIOD_SYMPTOMS.map((s) => {
              const active = symptoms.includes(s);
              return (
                <Pressable
                  key={s}
                  onPress={() => toggleSymptom(s)}
                  style={[
                    styles.symptomChip,
                    active
                      ? { backgroundColor: theme.accentSoft, borderColor: theme.accentColor }
                      : { backgroundColor: 'rgba(255,255,255,0.5)', borderColor: theme.borderColor },
                  ]}>
                  <Text style={styles.symptomText}>{s}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pill
            label={todayChecked ? 'Update Today’s Check-in ✓' : 'Save Today’s Check-in ✓'}
            onPress={saveCheckIn}
          />

          <Text style={styles.label}>Last 7 days</Text>
          <View style={styles.row}>
            {lastSeven.map((d) => {
              const done = period.days.some((x) => x.dateKey === d && x.completed);
              return (
                <View key={d} style={styles.dayWrap}>
                  <View
                    style={[
                      styles.dayDot,
                      done
                        ? { backgroundColor: theme.accentColor, borderColor: theme.accentColor }
                        : { backgroundColor: 'rgba(255,255,255,0.5)', borderColor: theme.borderColor },
                    ]}>
                    <Text style={[styles.dayDotText, done && { color: '#FFFFFF' }]}>{done ? '✓' : '·'}</Text>
                  </View>
                  <Text style={styles.dayLabel}>{d.slice(8)}</Text>
                </View>
              );
            })}
          </View>

          {period.days.length > 0 && (
            <View style={styles.list}>
              {[...period.days]
                .reverse()
                .slice(0, 7)
                .map((d) => (
                  <Text key={d.dateKey} style={styles.smallHint}>
                    {d.dateKey} • pain {d.pain}/10 • {d.symptoms.length ? d.symptoms.join(', ') : 'no symptoms'}
                  </Text>
                ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 16, maxWidth: '100%' },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 17, marginBottom: 4, lineHeight: 24 },
  card: {
    padding: 18,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardTitle: { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  cardHint: { fontSize: 13, opacity: 0.65, marginBottom: 12 },
  subCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  subTitle: { fontSize: 16, fontWeight: '800' },
  tag: {
    fontSize: 11,
    fontWeight: '800',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  tagYou: { backgroundColor: 'rgba(46,125,79,0.18)' },
  tagLock: { backgroundColor: 'rgba(58,42,46,0.1)' },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  metricLabel: { fontSize: 14, flex: 1 },
  metricValue: { fontSize: 15, fontWeight: '700', opacity: 0.8 },
  metricInput: {
    width: 96,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    textAlign: 'right',
    backgroundColor: 'rgba(255,255,255,0.55)',
    fontSize: 15,
  },
  smallHint: { fontSize: 12, opacity: 0.65, marginTop: 4, marginBottom: 6 },
  pillPress: { alignSelf: 'flex-start', marginTop: 8 },
  pill: { paddingVertical: 12, paddingHorizontal: 22, borderRadius: 50 },
  pillText: { fontWeight: '800', fontSize: 14, color: '#FFFFFF' },
  ghostPill: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 50, borderWidth: 1 },
  ghostPillText: { fontSize: 12, fontWeight: '700' },
  dosePill: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 50 },
  dosePillText: { fontWeight: '800', fontSize: 13, color: '#FFFFFF' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 },
  flex: { flex: 1, minWidth: 90 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    minHeight: 44,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  label: { fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 2, opacity: 0.8 },
  bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 4 },
  bubbleHeaderLabel: { fontSize: 12, fontWeight: '800', opacity: 0.7 },
  bubbleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  bubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleMark: { fontSize: 20, fontWeight: '800' },
  bubbleLabel: { flex: 1, alignItems: 'center' },
  bubbleName: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  streakRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  streakWithCount: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  streakCount: { fontSize: 12, fontWeight: '700', opacity: 0.75 },
  cupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  cup: {
    width: 52,
    height: 62,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  cupEmoji: { fontSize: 24 },
  list: { marginTop: 10, gap: 6 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  listText: { fontSize: 14, flex: 1 },
  empty: { fontSize: 14, opacity: 0.6, marginTop: 10 },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 4,
  },
  reminderLabel: { fontSize: 14, fontWeight: '700' },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  medName: { fontSize: 15, fontWeight: '700' },
  medActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  takenAt: { fontSize: 12, fontWeight: '700', color: '#2E7D4F', marginTop: 4 },
  pendingAt: { fontSize: 12, fontWeight: '700', opacity: 0.55, marginTop: 4 },
  painChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  painChipText: { fontSize: 13, fontWeight: '700' },
  symptomChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 50, borderWidth: 1 },
  symptomText: { fontSize: 12, fontWeight: '700' },
  dayWrap: { alignItems: 'center', gap: 2 },
  dayDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotText: { fontSize: 14, fontWeight: '800' },
  dayLabel: { fontSize: 10, opacity: 0.6 },
});
