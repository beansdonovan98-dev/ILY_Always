import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';

import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { Celebration } from '@/components/Celebration';
import { useAppTheme } from '@/hooks/useAppTheme';

import { getItem, setItem } from '@/lib/storage';
import { daySeed, todayKey } from '@/constants/content';

interface Skill {
  id: string;
  module: string;
  name: string;
  emoji: string;
  steps: string[];
  practice: string;
}

const SKILLS: Skill[] = [
  // Mindfulness
  { id: 'observe', module: 'Mindfulness', name: 'Observe', emoji: '👀', steps: ['Notice the feeling without naming it yet.', 'Watch it rise, peak, and pass like weather.', 'You are the sky, not the storm.'], practice: 'Pick the strongest emotion you felt this week. Write: when it happened, what your body did, what the trigger was, and whether it peaked or plateaued. Finish with: "What does this tell me about what I need?"' },
  { id: 'describe', module: 'Mindfulness', name: 'Describe', emoji: '🏷️', steps: ['Put words on it: “I notice I feel anxious.”', 'Label the thought as a thought.', 'No judging, no fixing — just naming.'], practice: 'Take one recurring negative thought (“I always ruin things,” “Nobody really knows me”) and rewrite it as a description: “I notice I’m having the thought that...” Then write what evidence actually is. Seeing the difference between the thought and the fact is the whole skill.' },
  { id: 'mindful-moment', module: 'Mindfulness', name: 'Mindful Moment', emoji: '⏳', steps: ['Stop. Plant your feet. Breathe in, breathe out.', 'Name 5 things you can see, 4 hear, 3 touch, 2 smell, 1 taste.', 'Stay until the wave drops.'], practice: 'Do a 5-senses reset during the hardest moment of your day. Afterward, write one sentence: what did you notice that you usually would have missed?' },
  { id: 'igarette', module: 'Mindfulness', name: 'One Thing at a Time', emoji: '🎯', steps: ['Pick just one thing you are doing right now.', 'If your mind wanders, walk it back — gently, no shame.', 'Enjoy that one thing fully for 60 seconds.'], practice: 'Choose the meal you rush most often. Today, eat it phone-free and write three things you actually tasted or noticed. Track how many times your mind wandered.' },
  // Distress Tolerance
  { id: 'tipp', module: 'Distress Tolerance', name: 'TIPP Reset', emoji: '🧊', steps: ['Ice-cold water on your face or a cold pack (30s).', 'Intense exercise for 1 minute — stairs, squats, anything.', 'Paced breathing: in 4, out 6, for a minute.', 'Paired muscle relaxation: tense one area, let go.'], practice: 'Name the emotion you would most want to reset this week and prep for it: put cold packs in sight (freezer/bag), pick your 1-minute exercise, set a breathing timer. Build the kit before the crisis — not during.' },
  { id: 'soothe', module: 'Distress Tolerance', name: 'Self-Soothe', emoji: '🫧', steps: ['Sight: name something beautiful you can see.', 'Sound: put on soft music or nature sounds.', 'Smell: candles, lotion, coffee — something kind.', 'Taste: a favorite snack, eaten on purpose.', 'Touch: a soft blanket or warm shower.'], practice: 'Write a “sensory anchor” list: one specific sight, sound, smell, taste, and touch that reliably calms you. The specificity is the point — “warm shower steam on my skin” beats “something cozy.”' },
  { id: 'distract', module: 'Distress Tolerance', name: 'Distraction Station', emoji: '🎭', steps: ['Pick a big distraction: dance, movie, game, walk.', 'Ride the wave until the urge dips.', 'Use Wise Mind: is this the moment to act, or the moment to absorb?'], practice: 'Audit your last urge: what did you actually do, and did it teach you anything about what you needed instead (rest? company? reassurance?). Then build a distraction list of five — include one that gets you out of the house.' },
  { id: 'pros-cons', module: 'Distress Tolerance', name: 'Pros & Cons', emoji: '⚖️', steps: ['List the pros of acting on the urge.', 'List the cons — short-term AND long-term.', 'Ask: will I feel better or worse tomorrow?'], practice: 'Take the urge that keeps coming back and write the honest long-term cons column — the ones you usually skip. Then read the column before you act next time.' },
  { id: 'impulse-banana', module: 'Distress Tolerance', name: 'Ride the Wave', emoji: '🌊', steps: ['Urges peak in about 10–20 minutes.', 'Don\u2019t fight it and don\u2019t obey it — surf it.', 'Remind yourself: it passes, you don\u2019t have to.'], practice: 'Track today\u2019s strongest urge on a 1–10 scale every 10 minutes for an hour. Graph it in your notes. This is how you learn your own curve: how high, how long, and what actually brings it down.' },
  // Emotion Regulation
  { id: 'opposite-action', module: 'Emotion Regulation', name: 'Opposite Action', emoji: '🔀', steps: ['Name the emotion and the action it wants (hide, snap, quit).', 'Do the opposite, in a small safe way.', 'Joy → reach out. Fear → approach gently. Shame → connect.'], practice: 'Name one emotion you keep obeying instead of questioning. Write the action it wants, then the opposite action in miniature (e.g., shame wants hiding → write a three-line message to someone). Do the smallest version today.' },
  { id: 'check-facts', module: 'Emotion Regulation', name: 'Check the Facts', emoji: '🔍', steps: ['What do the actual facts say — not the story?', 'Would a trusted friend see it this way?', 'Adjust the response to fit the facts, not the fear.'], practice: 'Pick your most repeated anxious story. Write a three-column table: Story | Evidence For | Evidence Against. If the “against” column wins, write the sentence you\u2019ll say to yourself next time it shows up.' },
  { id: 'pleasant', module: 'Emotion Regulation', name: 'Build Pleasant Events', emoji: '🌸', steps: ['Schedule one pleasure — big or tiny.', 'Do it on purpose and savor it.', 'Small pleasures compound like interest.'], practice: 'Identify which need is starving right now — rest, play, company, nature, or beauty — and schedule the cheapest version of that exact thing tomorrow. Vague “be nicer to myself” doesn\u2019t count.' },
  { id: 'please-d', module: 'Emotion Regulation', name: 'PLEASE D', emoji: '❤️', steps: ['P — treat Physical illness (meds, rest).', 'L — balanced Eating, stay hydrated.', 'A — avoid mood-altering substances.', 'S — Sleep enough.', 'E — daily Exercise.', 'D — no Drugs (incl. alcohol).'], practice: 'Score your PLEASE D today, 1–5 on each letter, then circle the single lowest one. That letter is the smallest place to make one realistic change this week. One, not all — pick the one you\u2019ll actually do.' },
  { id: 'accumulate', module: 'Emotion Regulation', name: 'Accumulate Positives', emoji: '🌿', steps: ['Tiny positive moments count — sunlight, text, kind word.', 'Stack them on purpose.', 'Your bank account of good stuff funds the hard days.'], practice: 'Write down the last three moments this week that cost nothing and mattered (a laugh, light through a window, someone being kind). Ask: what pattern do they share, and how do you deliberately make one tomorrow?' },
  // Interpersonal Effectiveness
  { id: 'dear-man', module: 'Interpersonal Effectiveness', name: 'DEAR MAN', emoji: '📢', steps: ['Describe the situation, facts only.', 'Express how you feel: “I feel...”.', 'Assert what you want, plainly.', 'Reinforce: say what you\u2019ll give back.', 'Mindful: stay on one topic.', 'Agree on a middle ground.', 'Negotiate: offer alternatives.'], practice: 'Take one unspoken ask you keep swallowing. Write the full DEAR MAN script for it — all seven steps, verbatim. Then either send it or practice it aloud. Keeping it in your head is the loop; saying it breaks it.' },
  { id: 'give', module: 'Interpersonal Effectiveness', name: 'GIVE', emoji: '🎁', steps: ['Gentle: no threats, no attacks.', 'Interested: actually listen.', 'Validate their feelings out loud.', 'Easy manner: smile, warmth, light touch.'], practice: 'For your next disagreement, write the validation sentence BEFORE the argument starts (“Of course you feel that way — you hate being left out”). Then open with it. Watch what happens to the temperature of the conversation.' },
  { id: 'fast', module: 'Interpersonal Effectiveness', name: 'FAST', emoji: '🏁', steps: ['Fair: don\u2019t blame, own your part.', 'Apologies: when you\u2019re wrong, say so fast.', 'Stick to values: don\u2019t sell out to win.', 'Truthful: no exaggerating to win.'], practice: 'Think of the last conflict. Write honestly: which letter of FAST did you drop, and what would the apology version have sounded like? You\u2019re rehearsing for next time — that counts.' },
  { id: 'boundary', module: 'Interpersonal Effectiveness', name: 'Wise Boundaries', emoji: '🚪', steps: ['Decide what you can and cannot do.', 'Say it once, calmly, and clearly.', 'Repeat if pushed (broken record).'], practice: 'Name one boundary you keep crossing in your own life (offering help you resent, saying yes to everything, doomscrolling past bedtime). Write the boundary as an “I will / I won\u2019t” sentence and the exact words you\u2019ll say it with.' },
  { id: 'broken-record', module: 'Interpersonal Effectiveness', name: 'Broken Record', emoji: '🔁', steps: ['Repeat your ask calmly, same words.', 'Ignore pressure to change your answer.', 'Stay respectful — you can be a wall and be kind.'], practice: 'Choose a request people keep talking you out of (small one is fine). Rehearse the calm repeated sentence three times out loud — same words, same tone, no new justification. New justifications invite new arguments.' },
  { id: 'relationship-mind', module: 'Interpersonal Effectiveness', name: 'Relationship Mind', emoji: '💞', steps: ['Focus on the relationship, not winning the argument.', 'Long-term matters more than being right right now.', 'Ask yourself: do I want peace or the point?'], practice: 'Look back at your last disagreement. Write a short origin story of it: what was each person actually just asking for underneath the words? If you both wanted the same thing, that\u2019s the relationship working — notice it.' },
];

const DONE_KEY = (dateKey: string) => `dbt:done:${dateKey}`;

export default function DBTScreen() {
  const theme = useAppTheme();
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [celebration, setCelebration] = useState<{ mode: 'small' | 'big'; message: string } | null>(null);

  const today = todayKey(new Date());
  const seed = daySeed(new Date());
  const skill = SKILLS[seed % SKILLS.length];

  const load = useCallback(async () => {
    setDone(await getItem<boolean>(DONE_KEY(today), false));
    let s = 0;
    for (let back = 0; back < 365; back++) {
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() - back);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const flag = await getItem<boolean>(DONE_KEY(key), false);
      if (!flag) {
        if (back === 0) continue;
        break;
      }
      s += 1;
    }
    setStreak(s);
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const markDone = async () => {
    const next = !done;
    setDone(next);
    await setItem(DONE_KEY(today), next);
    if (next) {
      setStreak((s) => s + 1);
      setCelebration({
        mode: streak + 1 >= 7 ? 'big' : 'small',
        message: `${skill.emoji} ${skill.name} practiced — proud of you, darling 💚`,
      });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>DBT Cards 🧠</Text>
      <Text style={[styles.subtitle, { color: theme.subtitleColor }]}>
        One little skill a day for our stormy moments — we practice together, darling 🌿
      </Text>

      {/* Skill of the day */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Skill of the Day 🌤️</Text>
        <Text style={styles.cardHint}>Rotates daily — practice it once, even tiny 🌿</Text>

        <View style={[styles.skillHead, { borderColor: theme.borderColor }]}>
          <Text style={styles.skillEmoji}>{skill.emoji}</Text>
          <View style={styles.flex}>
            <Text style={styles.skillName}>{skill.name}</Text>
            <Text style={styles.skillModule}>{skill.module}</Text>
          </View>
          <View style={[styles.tag, theme.buttonStyle]}>
            <Text style={styles.tagText}>NEW</Text>
          </View>
        </View>

        <Text style={styles.label}>How to</Text>
        {skill.steps.map((step, i) => (
          <Text key={i} style={styles.step}>
            {i + 1}. {step}
          </Text>
        ))}

        <Text style={styles.label}>Today's assignment ✍️</Text>
        <Text style={styles.practice}>{skill.practice}</Text>

        <Pressable onPress={markDone} style={styles.pillPress}>
          <LinearGradient
            colors={done ? [theme.accentColor, theme.accentColor] : [theme.accentColor, '#C86DD7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pill}>
            <Text style={styles.pillText}>{done ? 'Practiced ✓' : 'I practiced it today ✓'}</Text>
          </LinearGradient>
        </Pressable>
        {done && <Text style={styles.doneNote}>Beautiful. That counts, darling 💚</Text>}
      </View>

      {/* Streak */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Practice Streak 🔥</Text>
        <Text style={[styles.cardHint, { color: theme.subtitleColor }]}>
          Show up for yourself, one day at a time — seven in a row earns the grand celebration, gorgeous 🎉
        </Text>
        <View style={styles.streakRow}>
          {Array.from({ length: 7 }, (_, i) => {
            const filled = i < Math.min(streak, 7);
            return (
              <View
                key={i}
                style={[
                  styles.streakDot,
                  filled
                    ? { backgroundColor: theme.accentColor, borderColor: theme.accentColor }
                    : { backgroundColor: 'rgba(255,255,255,0.5)', borderColor: theme.borderColor },
                ]}>
                <Text style={[styles.streakDotText, filled && { color: '#FFFFFF' }]}>{filled ? '✓' : '·'}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.streakText}>🔥 {streak}-day streak</Text>
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
  flex: { flex: 1 },
  skillHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  skillEmoji: { fontSize: 34 },
  skillName: { fontSize: 18, fontWeight: '800' },
  skillModule: { fontSize: 12, opacity: 0.65, marginTop: 2 },
  tag: { fontSize: 10, fontWeight: '800', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, overflow: 'hidden' },
  tagText: { fontSize: 10, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6, opacity: 0.8 },
  step: { fontSize: 14, lineHeight: 21, marginBottom: 4, opacity: 0.85 },
  practice: { fontSize: 14, lineHeight: 21, fontStyle: 'italic', opacity: 0.9 },
  pillPress: { alignSelf: 'flex-start', marginTop: 14 },
  pill: { paddingVertical: 13, paddingHorizontal: 26, borderRadius: 50 },
  pillText: { fontWeight: '800', fontSize: 15, color: '#FFFFFF' },
  doneNote: { fontSize: 12, fontStyle: 'italic', opacity: 0.65, marginTop: 8 },
  streakRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  streakDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDotText: { fontSize: 13, fontWeight: '800' },
  streakText: { fontSize: 14, fontWeight: '800', marginTop: 10 },
});
