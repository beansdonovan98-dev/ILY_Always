import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { Celebration } from '@/components/Celebration';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useUsage } from '@/contexts/UsageContext';

import { getCoupleId } from '@/lib/couple';
import { localDateKey } from '@/lib/days';
import {
  Cadence,
  Chore,
  DAILY_CHORES,
  FOCUS_AREAS,
  Streaks,
  TWO_DAY_CHORES,
  WEEKLY_CHORES,
  allDone,
  computeStreaks,
  currentCycleKey,
  focusAreaForWeek,
  isDone,
  isFocusHiddenToday,
  loadChecks,
  sundayOfToday,
  toggleCheck,
  twoDayDueToday,
} from '@/lib/cleaning';

export default function CleaningScreen() {
  const theme = useAppTheme();
  const { currentUser } = useUsage();

  const [coupleId, setCoupleId] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [streaks, setStreaks] = useState<Streaks>({ daily: 0, twoDay: 0, weekly: 0 });
  const [celebration, setCelebration] = useState<{ mode: 'small' | 'big' | 'mega'; message: string } | null>(null);

  const today = localDateKey();
  const focusHidden = isFocusHiddenToday();
  const focusArea = focusAreaForWeek(sundayOfToday());
  const twoDayDue = twoDayDueToday(today);

  const load = useCallback(async () => {
    const cid = await getCoupleId();
    setCoupleId(cid);
    const loaded = await loadChecks(cid);
    setChecks(loaded);
    setStreaks(computeStreaks(loaded));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const cadenceComplete = (next: Record<string, boolean>, cadence: Cadence, chores: Chore[]) =>
    allDone(next, cadence, chores, currentCycleKey(cadence, today));

  const toggle = async (cadence: Cadence, chore: Chore) => {
    const cycleKey = currentCycleKey(cadence, today);
    const next = await toggleCheck(coupleId, checks, cadence, chore.id, cycleKey);
    setChecks(next);
    setStreaks(computeStreaks(next));

    const wasDone = isDone(checks, cadence, chore.id, cycleKey);
    const nowDone = isDone(next, cadence, chore.id, cycleKey);
    if (nowDone && !wasDone) {
      const dailyDoneNow = cadenceComplete(next, 'daily', DAILY_CHORES);
      const twoDayDoneNow = cadenceComplete(next, 'twoDay', TWO_DAY_CHORES);
      const weeklyDoneNow = cadenceComplete(next, 'weekly', WEEKLY_CHORES);
      const focusDoneNow =
        !focusHidden && focusArea.tasks.length > 0 && allDone(next, 'focus', focusArea.tasks, cycleKey);

      if (dailyDoneNow && twoDayDoneNow && weeklyDoneNow) {
        setCelebration({ mode: 'mega', message: 'EVERYTHING DONE. This house is a temple today. 🫧👑🌿' });
      } else if (weeklyDoneNow) {
        setCelebration({ mode: 'big', message: `Weekly reset complete — the nest is royal 👑` });
      } else if (twoDayDoneNow) {
        setCelebration({ mode: 'big', message: `Every-other-day list slammed 🌿` });
      } else if (dailyDoneNow) {
        setCelebration({ mode: 'small', message: `All daily chores done — love that for us 🧹✨` });
      } else if (focusDoneNow) {
        setCelebration({ mode: 'small', message: `${focusArea.emoji} ${focusArea.name} deep-cleaned — filthy clean 😏` });
      }
    }
  };

  const renderCheckRow = (cadence: Cadence, chore: Chore) => {
    const cycleKey = currentCycleKey(cadence, today);
    const done = isDone(checks, cadence, chore.id, cycleKey);
    return (
      <Pressable
        key={chore.id}
        onPress={() => toggle(cadence, chore)}
        style={[
          styles.checkRow,
          { borderColor: theme.borderColor },
          done && { backgroundColor: theme.accentSoft },
        ]}>
        <View
          style={[
            styles.checkCircle,
            { borderColor: theme.accentColor },
            done && { backgroundColor: theme.accentColor },
          ]}>
          <Text style={[styles.checkMark, done && { color: '#FFFFFF' }]}>{done ? '✓' : '○'}</Text>
        </View>
        <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>{chore.label}</Text>
      </Pressable>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Get It Squeaky Clean 🫧</Text>
      <Text style={[styles.subtitle, { color: theme.subtitleColor }]}>
        Keeping our lair irresistibly filthy-clean for mischief 🫧🌿
      </Text>

      {/* Deep clean focus — hidden until Sunday 12:00 AM */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Deep Clean Focus 🔥</Text>
        <Text style={[styles.cardHint, { color: theme.subtitleColor }]}>
          One room gets the full filthy treatment each week 😏
        </Text>

        {focusHidden ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderEmoji}>❓🌿🧽</Text>
            <Text style={styles.placeholderText}>
              The deep clean drops Sunday at 12:00 AM — smokescreen until then 🚬
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.focusHead}>
              <Text style={styles.focusTitle}>
                {focusArea.emoji} {focusArea.name} — this week
              </Text>
              <View style={styles.focusBar}>
                <View
                  style={[
                    styles.focusBarFill,
                    {
                      backgroundColor: theme.accentColor,
                      width: `${
                        (focusArea.tasks.filter((t) =>
                          isDone(checks, 'focus', t.id, currentCycleKey('focus', today))
                        ).length /
                          focusArea.tasks.length) *
                        100
                      }%`,
                    },
                  ]}
                />
              </View>
            </View>
            {focusArea.tasks.map((t) => renderCheckRow('focus', t))}
          </>
        )}
      </View>

      {/* Daily */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Daily Hustle 🧹</Text>
        <Text style={[styles.cardHint, { color: theme.subtitleColor }]}>
          A little effort every day keeps the dirty boys away 🌿
        </Text>
        <Text style={styles.streakLine}>🔥 {streaks.daily}-day streak</Text>
        {DAILY_CHORES.map((c) => renderCheckRow('daily', c))}
      </View>

      {/* Every 2 days */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Every Other Day 🌙</Text>
        <Text style={[styles.cardHint, { color: theme.subtitleColor }]}>
          {twoDayDue
            ? 'Due today — reset the lair, no excuses, gorgeous 🔥'
            : 'Not due today. Breathe, hold it in 🌿'}
        </Text>
        <Text style={styles.streakLine}>🔥 {streaks.twoDay}-cycle streak</Text>
        {TWO_DAY_CHORES.map((c) => renderCheckRow('twoDay', c))}
      </View>

      {/* Weekly */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Weekly Reset 👑</Text>
        <Text style={[styles.cardHint, { color: theme.subtitleColor }]}>
          The Sunday ritual that keeps our nest fit for royalty — done as {currentUser === 'daddy' ? 'his' : 'hers'} 💚
        </Text>
        <Text style={styles.streakLine}>🔥 {streaks.weekly}-week streak</Text>
        {WEEKLY_CHORES.map((c) => renderCheckRow('weekly', c))}
      </View>

      <Celebration
        mode={celebration?.mode ?? null}
        message={celebration?.message ?? ''}
        onDone={() => setCelebration(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 16, maxWidth: '100%' },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 17, fontStyle: 'italic', lineHeight: 24, marginBottom: 4 },
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
  cardHint: { fontSize: 13, fontStyle: 'italic', opacity: 0.72, marginBottom: 10, lineHeight: 18 },
  streakLine: { fontSize: 13, fontWeight: '800', opacity: 0.8, marginBottom: 8 },
  placeholder: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  placeholderEmoji: { fontSize: 44 },
  placeholderText: { fontSize: 14, fontStyle: 'italic', opacity: 0.7, textAlign: 'center', lineHeight: 20 },
  focusHead: { marginBottom: 4 },
  focusTitle: { fontSize: 16, fontWeight: '800' },
  focusBar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(58,42,46,0.1)', marginTop: 8, overflow: 'hidden' },
  focusBarFill: { height: 8, borderRadius: 4 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  checkMark: { fontSize: 17, fontWeight: '800' },
  checkLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  checkLabelDone: { opacity: 0.55, textDecorationLine: 'line-through' },
});
