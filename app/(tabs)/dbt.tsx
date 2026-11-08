import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';

import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { Celebration } from '@/components/Celebration';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useUsage } from '@/contexts/UsageContext';

import { getItem, setItem } from '@/lib/storage';
import { useTabLabel } from '@/hooks/useTabLabel';
import { todayKey } from '@/constants/content';
import { markActivity } from '@/lib/activity';

interface Skill {
  id: string;
  module: string;
  name: string;
  emoji: string;
  steps: string[];
  taskType: 'journal' | 'select' | 'rate' | 'check' | 'diagram' | 'emotions';
  choices?: string[];
  practice: string;
}

const SKILLS: Skill[] = [
  // Mindfulness
  { id: 'observe', module: 'Mindfulness', name: 'Observe', emoji: '👀', steps: ['Notice the feeling without naming it yet.', 'Watch it rise, peak, and pass like weather.', 'You are the sky, not the storm.'], taskType: 'journal', practice: 'Pick the strongest emotion you felt this week. Write: when it happened, what your body did, what the trigger was, and whether it peaked or plateaued. Finish with: "What does this tell me about what I need?"' },
  { id: 'describe', module: 'Mindfulness', name: 'Describe', emoji: '🏷️', steps: ['Put words on it: “I notice I feel anxious.”', 'Label the thought as a thought.', 'No judging, no fixing — just naming.'], taskType: 'journal', practice: 'Take one recurring negative thought (“I always ruin things,” “Nobody really knows me”) and rewrite it as a description: “I notice I’m having the thought that...” Then write what evidence actually is. Seeing the difference between the thought and the fact is the whole skill.' },
  { id: 'mindful-moment', module: 'Mindfulness', name: 'Mindful Moment', emoji: '⏳', steps: ['Stop. Plant your feet. Breathe in, breathe out.', 'Name 5 things you can see, 4 hear, 3 touch, 2 smell, 1 taste.', 'Stay until the wave drops.'], taskType: 'select', choices: ['Morning reset', 'Afternoon reset', 'Night reset'], practice: 'Do a 5-senses reset during the hardest moment of your day. Afterward, write one sentence: what did you notice that you usually would have missed?' },
  { id: 'igarette', module: 'Mindfulness', name: 'One Thing at a Time', emoji: '🎯', steps: ['Pick just one thing you are doing right now.', 'If your mind wanders, walk it back — gently, no shame.', 'Enjoy that one thing fully for 60 seconds.'], taskType: 'check', practice: 'Choose the meal you rush most often. Today, eat it phone-free and write three things you actually tasted or noticed. Track how many times your mind wandered.' },
  // Distress Tolerance
  { id: 'tipp', module: 'Distress Tolerance', name: 'TIPP Reset', emoji: '🧊', steps: ['Ice-cold water on your face or a cold pack (30s).', 'Intense exercise for 1 minute — stairs, squats, anything.', 'Paced breathing: in 4, out 6, for a minute.', 'Paired muscle relaxation: tense one area, let go.'], taskType: 'check', practice: 'Name the emotion you would most want to reset this week and prep for it: put cold packs in sight (freezer/bag), pick your 1-minute exercise, set a breathing timer. Build the kit before the crisis — not during.' },
  { id: 'soothe', module: 'Distress Tolerance', name: 'Self-Soothe', emoji: '🫧', steps: ['Sight: name something beautiful you can see.', 'Sound: put on soft music or nature sounds.', 'Smell: candles, lotion, coffee — something kind.', 'Taste: a favorite snack, eaten on purpose.', 'Touch: a soft blanket or warm shower.'], taskType: 'check', practice: 'Write a “sensory anchor” list: one specific sight, sound, smell, taste, and touch that reliably calms you. The specificity is the point — “warm shower steam on my skin” beats “something cozy.”' },
  { id: 'distract', module: 'Distress Tolerance', name: 'Distraction Station', emoji: '🎭', steps: ['Pick a big distraction: dance, movie, game, walk.', 'Ride the wave until the urge dips.', 'Use Wise Mind: is this the moment to act, or the moment to absorb?'], taskType: 'select', choices: ['Keeps me home', 'Gets me out', 'Takes real skill', 'Pure numbing'], practice: 'Audit your last urge: what did you actually do, and did it teach you anything about what you needed instead (rest? company? reassurance?). Then build a distraction list of five — include one that gets you out of the house.' },
  { id: 'pros-cons', module: 'Distress Tolerance', name: 'Pros & Cons', emoji: '⚖️', steps: ['List the pros of acting on the urge.', 'List the cons — short-term AND long-term.', 'Ask: will I feel better or worse tomorrow?'], taskType: 'diagram', practice: 'Take the urge that keeps coming back and write the honest long-term cons column — the ones you usually skip. Then read the column before you act next time.' },
  { id: 'impulse-banana', module: 'Distress Tolerance', name: 'Ride the Wave', emoji: '🌊', steps: ['Urges peak in about 10–20 minutes.', 'Don\u2019t fight it and don\u2019t obey it — surf it.', 'Remind yourself: it passes, you don\u2019t have to.'], taskType: 'rate', practice: 'Track today\u2019s strongest urge on a 1–10 scale every 10 minutes for an hour. Graph it in your notes. This is how you learn your own curve: how high, how long, and what actually brings it down.' },
  // Emotion Regulation
  { id: 'opposite-action', module: 'Emotion Regulation', name: 'Opposite Action', emoji: '🔀', steps: ['Name the emotion and the action it wants (hide, snap, quit).', 'Do the opposite, in a small safe way.', 'Joy → reach out. Fear → approach gently. Shame → connect.'], taskType: 'select', choices: ['I reached out', 'I approached gently', 'I connected', 'I skipped it'], practice: 'Name one emotion you keep obeying instead of questioning. Write the action it wants, then the opposite action in miniature (e.g., shame wants hiding → write a three-line message to someone). Do the smallest version today.' },
  { id: 'check-facts', module: 'Emotion Regulation', name: 'Check the Facts', emoji: '🔍', steps: ['What do the actual facts say — not the story?', 'Would a trusted friend see it this way?', 'Adjust the response to fit the facts, not the fear.'], taskType: 'diagram', practice: 'Pick your most repeated anxious story. Write a three-column table: Story | Evidence For | Evidence Against. If the “against” column wins, write the sentence you\u2019ll say to yourself next time it shows up.' },
  { id: 'pleasant', module: 'Emotion Regulation', name: 'Build Pleasant Events', emoji: '🌸', steps: ['Schedule one pleasure — big or tiny.', 'Do it on purpose and savor it.', 'Small pleasures compound like interest.'], taskType: 'select', choices: ['Nature', 'Food', 'Music', 'Company', 'Rest'], practice: 'Identify which need is starving right now — rest, play, company, nature, or beauty — and schedule the cheapest version of that exact thing tomorrow. Vague “be nicer to myself” doesn\u2019t count.' },
  { id: 'please-d', module: 'Emotion Regulation', name: 'PLEASE D', emoji: '❤️', steps: ['P — treat Physical illness (meds, rest).', 'L — balanced Eating, stay hydrated.', 'A — avoid mood-altering substances.', 'S — Sleep enough.', 'E — daily Exercise.', 'D — no Drugs (incl. alcohol).'], taskType: 'rate', practice: 'Score your PLEASE D today, 1–5 on each letter, then circle the single lowest one. That letter is the smallest place to make one realistic change this week. One, not all — pick the one you\u2019ll actually do.' },
  { id: 'accumulate', module: 'Emotion Regulation', name: 'Accumulate Positives', emoji: '🌿', steps: ['Tiny positive moments count — sunlight, text, kind word.', 'Stack them on purpose.', 'Your bank account of good stuff funds the hard days.'], taskType: 'rate', practice: 'Write down the last three moments this week that cost nothing and mattered (a laugh, light through a window, someone being kind). Ask: what pattern do they share, and how do you deliberately make one tomorrow?' },
  // Interpersonal Effectiveness
  { id: 'dear-man', module: 'Interpersonal Effectiveness', name: 'DEAR MAN', emoji: '📢', steps: ['Describe the situation, facts only.', 'Express how you feel: “I feel...”.', 'Assert what you want, plainly.', 'Reinforce: say what you\u2019ll give back.', 'Mindful: stay on one topic.', 'Agree on a middle ground.', 'Negotiate: offer alternatives.'], taskType: 'diagram', practice: 'Take one unspoken ask you keep swallowing. Write the full DEAR MAN script for it — all seven steps, verbatim. Then either send it or practice it aloud. Keeping it in your head is the loop; saying it breaks it.' },
  { id: 'give', module: 'Interpersonal Effectiveness', name: 'GIVE', emoji: '🎁', steps: ['Gentle: no threats, no attacks.', 'Interested: actually listen.', 'Validate their feelings out loud.', 'Easy manner: smile, warmth, light touch.'], taskType: 'check', practice: 'For your next disagreement, write the validation sentence BEFORE the argument starts (“Of course you feel that way — you hate being left out”). Then open with it. Watch what happens to the temperature of the conversation.' },
  { id: 'fast', module: 'Interpersonal Effectiveness', name: 'FAST', emoji: '🏁', steps: ['Fair: don\u2019t blame, own your part.', 'Apologies: when you\u2019re wrong, say so fast.', 'Stick to values: don\u2019t sell out to win.', 'Truthful: no exaggerating to win.'], taskType: 'journal', practice: 'Think of the last conflict. Write honestly: which letter of FAST did you drop, and what would the apology version have sounded like? You\u2019re rehearsing for next time — that counts.' },
  { id: 'boundary', module: 'Interpersonal Effectiveness', name: 'Wise Boundaries', emoji: '🚪', steps: ['Decide what you can and cannot do.', 'Say it once, calmly, and clearly.', 'Repeat if pushed (broken record).'], taskType: 'journal', practice: 'Name one boundary you keep crossing in your own life (offering help you resent, saying yes to everything, doomscrolling past bedtime). Write the boundary as an “I will / I won\u2019t” sentence and the exact words you\u2019ll say it with.' },
  { id: 'broken-record', module: 'Interpersonal Effectiveness', name: 'Broken Record', emoji: '🔁', steps: ['Repeat your ask calmly, same words.', 'Ignore pressure to change your answer.', 'Stay respectful — you can be a wall and be kind.'], taskType: 'check', practice: 'Choose a request people keep talking you out of (small one is fine). Rehearse the calm repeated sentence three times out loud — same words, same tone, no new justification. New justifications invite new arguments.' },
  { id: 'relationship-mind', module: 'Interpersonal Effectiveness', name: 'Relationship Mind', emoji: '💞', steps: ['Focus on the relationship, not winning the argument.', 'Long-term matters more than being right right now.', 'Ask yourself: do I want peace or the point?'], taskType: 'select', choices: ['I wanted the point', 'I wanted peace', 'Something in between'], practice: 'Look back at your last disagreement. Write a short origin story of it: what was each person actually just asking for underneath the words? If you both wanted the same thing, that\u2019s the relationship working — notice it.' },
  // More skills that earned their keep
  { id: 'wise-mind', module: 'Mindfulness', name: 'Wise Mind', emoji: '🧭', steps: ['Emotion Mind is running the show — all feeling, no brakes.', 'Reasonable Mind is running the show — all logic, no heart.', 'Wise Mind is the overlap: facts + feelings, together.'], taskType: 'journal', practice: 'Take a decision you\u2019ve been avoiding. Write three columns: what Emotion Mind says, what Reasonable Mind says, then what the overlap answer is. That third column is Wise Mind — it\u2019s yours to use.' },
  { id: 'name-emotion', module: 'Emotion Regulation', name: 'Name That Emotion', emoji: '🔖', steps: ['“Mad” is a suitcase word — unpack it.', 'Was it anger, hurt, shame, fear, envy, grief?', 'Precise words shrink big feelings.'], taskType: 'emotions', choices: ['😡 Angry', '💔 Hurt', '😳 Ashamed', '😰 Afraid', '😒 Envious', '😢 Grief', '😖 Disgusted', '😑 Numb'], practice: 'Take today\u2019s loudest emotion and split it into parts: the primary feeling, the story under it, and the body sensation. Five exact words beat one vague one.' },
  { id: 'beginners-mind', module: 'Mindfulness', name: 'Beginner\u2019s Mind', emoji: '🌱', steps: ['Approach this moment like you\u2019ve never lived it.', 'Drop the “I already know how this goes.”', 'Curiosity instead of conclusions.'], taskType: 'check', practice: 'Pick something you do on autopilot (brushing teeth, coffee, the drive). Do it today as if for the first time and write down three things you never noticed before.' },
  { id: 'letting-go', module: 'Distress Tolerance', name: 'Letting Go', emoji: '☁️', steps: ['A thought is just a thought passing through.', 'Picture it on a cloud or a leaf in a stream.', 'Watch it drift away — without chasing.'], taskType: 'select', choices: ['I let one thought go', 'Partly — it came back', 'Still holding on'], practice: 'Catch one annoying thought and write it on a slip of paper. Read it, then literally tear it up or toss it. Physical acts make the metaphor stick in your nervous system.' },
  { id: 'nonjudgmental', module: 'Mindfulness', name: 'Drop the Judgment', emoji: '🕊️', steps: ['Notice the label (“lazy,” “stupid,” “too much”).', 'Swap it for a description (“I\u2019m resting at 3pm”).', 'Facts only — no grade, no gavel.'], taskType: 'diagram', practice: 'Catch three judgments you make today and rewrite each as a neutral fact. Track which ones are about other people vs. yourself — watch the pattern.' },
  { id: 'emergency-plan', module: 'Distress Tolerance', name: 'Crisis Coping Plan', emoji: '🆘', steps: ['Write it BEFORE the crisis, when your brain works.', 'Include: warning signs, 3 coping skills, 3 people to contact, how to make it safe.', 'Keep it in your phone, pinned.'], taskType: 'select', choices: ['Plan written', 'Plan half-written', 'Haven\u2019t started yet'], practice: 'Draft your crisis plan in your notes today, even if things are fine: your early warning signs, three skills, two people to text, and one reason you want to stay. Future-you will thank present-you.' },
  { id: 'behavioral-chain', module: 'Emotion Regulation', name: 'Behavioral Chain', emoji: '🔗', steps: ['Walk backward: Vulnerability → Event → Interpretation → Emotion.', 'The event is rarely the whole story — your interpretation is the hinge.', 'Change one link and the chain changes.'], taskType: 'diagram', practice: 'Take the last blowup. Map it: vulnerability (tired? hungry? lonely?), the event, your interpretation, the emotion, what you did, and the consequence. Circle the interpretation — that\u2019s where the leverage lives.' },
  { id: 'mindful-listening', module: 'Interpersonal Effectiveness', name: 'Mindful Listening', emoji: '👂', steps: ['Put the phone down, not just face-down.', 'Paraphrase before responding: “So you feel...?”', 'Ask one curious question before offering any fix.'], taskType: 'check', practice: 'Next time someone vents, count to three in your head before speaking. Paraphrase their feeling back first — and notice how much less defensive the conversation gets.' },
  { id: 'amends', module: 'Interpersonal Effectiveness', name: 'Making Amends', emoji: '🤝', steps: ['Clean repair, not a pity party.', 'Name what you did, no “but.”', 'Say what you\u2019ll do differently and follow through.'], taskType: 'select', choices: ['Sent it', 'Kept as rehearsal'], practice: 'Think of one small harm you owe someone. Write the amends sentence now: “I did X. It was wrong because Y. Here\u2019s what I\u2019m doing about it.” Then decide: send it, or keep it as rehearsal for when it matters?' },
  { id: 'saying-no', module: 'Interpersonal Effectiveness', name: 'Saying No Kindly', emoji: '🚪', steps: ['You can be kind and still be a closed door.', '“I can\u2019t do that” beats a resentful yes.', 'Offer a real alternative if you have one.'], taskType: 'check', practice: 'Recall the last time you said yes and meant no. Write the no you wish you\u2019d said — then practice saying that exact sentence out loud. The reps matter more than the words.' },
];

const DONE_KEY = (dateKey: string) => `dbt:done:${dateKey}`;
const RESPONSE_KEY = (windowKey: string, skillId: string) => `dbt:response:${windowKey}:${skillId}`;
const ANSWER_KEY = (windowKey: string, skillId: string) => `dbt:answer:${windowKey}:${skillId}`;

/** Skills rotate on a 2-day window (a new skill drops every other day). */
function twoDayWindow(date = new Date()): { index: number; windowKey: string; daysLeft: number } {
  const epoch = new Date('2026-01-04T12:00:00').getTime(); // a Sunday
  const days = Math.floor((date.getTime() - epoch) / (24 * 60 * 60 * 1000));
  const safeDays = Math.max(days, 0);
  const index = Math.floor(safeDays / 2);
  const windowStart = new Date(epoch + index * 2 * 24 * 60 * 60 * 1000);
  const windowKey = `${windowStart.getFullYear()}-${String(windowStart.getMonth() + 1).padStart(2, '0')}-${String(windowStart.getDate()).padStart(2, '0')}`;
  const daysLeft = 2 - (safeDays % 2) > 0 ? 2 - (safeDays % 2) : 1;
  return { index, windowKey, daysLeft };
}

export default function DBTScreen() {
  const theme = useAppTheme();
  const dbtTitle = useTabLabel('dbt', 'DBT Cards 🧠');
  const { currentUser } = useUsage();
  const [done, setDone] = useState(false);
  const [streak, setStreak] = useState(0);
  const [celebration, setCelebration] = useState<{ mode: 'small' | 'big'; message: string } | null>(null);
  const [response, setResponse] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [answer, setAnswer] = useState<string | number>('');
  const [emotionAnswer, setEmotionAnswer] = useState('');
  const [diagramVersion, setDiagramVersion] = useState(0);
  const diagramCache = useRef<Record<string, string>>({});

  const today = todayKey(new Date());
  const window2 = twoDayWindow(new Date());
  const skill = SKILLS[window2.index % SKILLS.length];
  const taskAnswerKey = ANSWER_KEY(window2.windowKey, skill.id);

  const load = useCallback(async () => {
    setDone(await getItem<boolean>(DONE_KEY(today), false));
    const resp = await getItem<string>(RESPONSE_KEY(window2.windowKey, skill.id), '');
    setResponse(resp);
    setSavedNote(resp);
    setNoteSaved(resp.length > 0);
    const savedAnswer = await getItem<string | number>(taskAnswerKey, '');
    setAnswer(savedAnswer);
    diagramCache.current[skill.id] = resp;
    setEmotionAnswer(typeof savedAnswer === 'string' ? savedAnswer : '');
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
  }, [today, skill.id, window2.windowKey, taskAnswerKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const assignmentComplete = () => {
    // No shortcuts: every day you must fill out whatever this skill asks
    // before the app will count you as practiced.
    if (skill.taskType === 'journal') return noteSaved && response.trim().length > 0;
    if (skill.taskType === 'check') return done && noteSaved && response.trim().length > 0;
    const answered = answer !== '';
    const noted = noteSaved && response.trim().length > 0;
    return answered && noted;
  };

  const markDone = async () => {
    if (!assignmentComplete()) return;
    void markActivity('dbt', currentUser);
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

  const pickAnswer = async (value: string | number) => {
    setAnswer(value);
    await setItem(taskAnswerKey, value);
  };

  const saveResponse = async () => {
    await setItem(RESPONSE_KEY(window2.windowKey, skill.id), response);
    setSavedNote(response);
    setNoteSaved(true);
  };

  const renderJournal = () => (
    <>
      <Text style={styles.label}>Response Journal ✍️</Text>
      <Text style={styles.responseHint}>
        Write about it — what came up, what surprised you. Saved to this skill window. 💭
      </Text>
      <TextInput
        value={response}
        onChangeText={(v) => {
          setResponse(v);
          setNoteSaved(false);
        }}
        placeholder="Dear journal..."
        placeholderTextColor="rgba(58,42,46,0.45)"
        multiline
        style={[styles.responseInput, { borderColor: theme.borderColor, color: theme.textColor }]}
      />
      <Pressable onPress={saveResponse} style={styles.pillPress}>
        <LinearGradient
          colors={[theme.accentColor, '#C86DD7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pill}>
          <Text style={styles.pillText}>{noteSaved && response === savedNote ? 'Saved ✓' : 'Save Response 💾'}</Text>
        </LinearGradient>
      </Pressable>
      {noteSaved && <Text style={styles.doneNote}>Saved to this skill's window 💚</Text>}
    </>
  );

  const renderTaskBlock = () => {
    if (skill.taskType === 'journal') {
      return renderJournal();
    }

    if (skill.taskType === 'diagram') {
      const fields = JSON.parse(
        (() => {
          const raw = diagramCache.current[skill.id];
          return raw ?? '[]';
        })()
      ) as string[];
      const setField = (index: number, value: string) => {
        const next = [...fields];
        next[index] = value;
        diagramCache.current[skill.id] = JSON.stringify(next);
        setDiagramVersion((v) => v + 1);
        void setItem(RESPONSE_KEY(window2.windowKey, skill.id), JSON.stringify(next));
        setNoteSaved(true);
      };
      const labels =
        skill.id === 'pros-cons'
          ? ['Pros of acting']
          : skill.id === 'nonjudgmental'
          ? ['Judgment']
          : skill.id === 'dear-man'
          ? ['DEAR MAN step']
          : skill.id === 'check-facts'
          ? ['Evidence']
          : ['Chain link'];
      const valueLabels =
        skill.id === 'nonjudgmental' ? ['Neutral fact'] : skill.id === 'pros-cons' || skill.id === 'check-facts' ? ['Cost / counterpoint'] : ['Detail'];
      return (
        <>
          <Text style={styles.label}>Fill the diagram</Text>
          {labels.map((label, i) => (
            <View key={label} style={styles.diagramSide}>
              <Text style={styles.diagramSideLabel}>{label}</Text>
              <View style={styles.diagramPair}>
                <TextInput
                  value={fields[i] ?? ''}
                  onChangeText={(v) => setField(i, v)}
                  placeholder="Write..."
                  placeholderTextColor="rgba(58,42,46,0.45)"
                  style={[styles.diagramInput, { borderColor: theme.borderColor, color: theme.textColor, flex: 1 }]}
                />
                <TextInput
                  value={fields[i + 4] ?? ''}
                  onChangeText={(v) => setField(i + 4, v)}
                  placeholder={valueLabels[0]}
                  placeholderTextColor="rgba(58,42,46,0.45)"
                  style={[styles.diagramInput, { borderColor: theme.borderColor, color: theme.textColor, flex: 1 }]}
                />
              </View>
            </View>
          ))}
          {noteSaved && <Text style={styles.doneNote}>Diagram saved to this skill's window 💚</Text>}
        </>
      );
    }

    if (skill.taskType === 'emotions') {
      const selected = emotionAnswer.length > 0 ? emotionAnswer.split(' | ') : [];
      return (
        <>
          <Text style={styles.label}>Pick everything true (up to 3)</Text>
          <View style={styles.choiceGrid}>
            {(skill.choices ?? []).map((choice) => {
              const active = selected.includes(choice);
              return (
                <Pressable
                  key={choice}
                  onPress={() => {
                    const next = active
                      ? selected.filter((c) => c !== choice)
                      : selected.length >= 3
                      ? selected
                      : [...selected, choice];
                    setEmotionAnswer(next.join(' | '));
                    void pickAnswer(next.join(' | '));
                  }}
                  style={[
                    styles.choicePill,
                    { borderColor: theme.borderColor },
                    active && { backgroundColor: theme.accentSoft, borderColor: theme.accentColor },
                  ]}>
                  <Text style={styles.choiceText}>{choice}</Text>
                </Pressable>
              );
            })}
          </View>
          {selected.length > 0 && (
            <Text style={styles.doneNote}>Named and felt — that's the work, gorgeous 💚</Text>
          )}
        </>
      );
    }

    if (skill.taskType === 'select') {
      return (
        <>
          <Text style={styles.label}>Pick the truest answer today</Text>
          <View style={styles.choiceGrid}>
            {(skill.choices ?? []).map((choice) => {
              const active = answer === choice;
              return (
                <Pressable
                  key={choice}
                  onPress={() => pickAnswer(choice)}
                  style={[
                    styles.choicePill,
                    { borderColor: theme.borderColor },
                    active && { backgroundColor: theme.accentSoft, borderColor: theme.accentColor },
                  ]}>
                  <Text style={styles.choiceText}>{choice}</Text>
                </Pressable>
              );
            })}
          </View>
          {answer !== '' && <Text style={styles.doneNote}>Locked in — no overthinking it 💚</Text>}
          {renderJournal()}
        </>
      );
    }

    if (skill.taskType === 'rate') {
      return (
        <>
          <Text style={styles.label}>Score it 1–10</Text>
          <View style={styles.choiceGrid}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
              const active = answer === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => pickAnswer(n)}
                  style={[
                    styles.rateBubble,
                    { borderColor: theme.borderColor },
                    active && { backgroundColor: theme.accentColor, borderColor: theme.accentColor },
                  ]}>
                  <Text style={[styles.rateText, active && { color: '#FFFFFF' }]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
          {answer !== '' && (
            <Text style={styles.doneNote}>
              Today you rated it {answer}/10 — that's honest data, darling 💚
            </Text>
          )}
          {renderJournal()}
        </>
      );
    }

    // 'check'
    return (
      <>
        <Text style={styles.responseHint}>Do it for real — then say how it went below.</Text>
        <Pressable
          onPress={markDone}
          style={[
            styles.checkRow,
            { borderColor: theme.borderColor },
            done && { backgroundColor: theme.accentSoft },
          ]}>
          <Text style={[styles.checkMark, { color: theme.accentColor }]}>{done ? '✓' : '○'}</Text>
          <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>Done today</Text>
        </Pressable>
        {!done && !(noteSaved && response.trim().length > 0) ? (
          <Text style={styles.doneNote}>Save your journal note below first — then tap ✓, gorgeous 💋</Text>
        ) : null}
        {done && <Text style={styles.doneNote}>Beautiful. That counts, darling 💚</Text>}
        {renderJournal()}
      </>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{dbtTitle}</Text>
      <Text style={[styles.subtitle, { color: theme.subtitleColor }]}>
        One little skill every two days for our stormy moments — we practice together, darling 🌿
      </Text>

      {/* Skill of the day */}
      <View style={[styles.card, theme.cardStyle]}>
        <LeafBorder color={theme.leafColor} />
        <Text style={styles.cardTitle}>Skill for the Next 2 Days 🌤️</Text>
        <Text style={styles.cardHint}>A new skill drops every 2 days — practice it once, even tiny 🌿</Text>
        <Text style={[styles.countdown, { color: theme.accentColor }]}>
          ⏳ New skill in {window2.daysLeft} day{window2.daysLeft === 1 ? '' : 's'}
        </Text>

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

        {skill.taskType !== 'check' && (
          <>
            <Pressable onPress={markDone} disabled={!assignmentComplete()} style={styles.pillPress}>
              <LinearGradient
                colors={
                  done
                    ? [theme.accentColor, theme.accentColor]
                    : assignmentComplete()
                    ? [theme.accentColor, '#C86DD7']
                    : ['#C7C3D4', '#C7C3D4']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pill}>
                <Text style={styles.pillText}>{done ? 'Practiced ✓' : 'I practiced it today ✓'}</Text>
              </LinearGradient>
            </Pressable>
            {!done && !assignmentComplete() ? (
              <Text style={styles.doneNote}>Answer the assignment above first — no shortcuts, gorgeous 💋</Text>
            ) : null}
          </>
        )}

        {renderTaskBlock()}
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
  countdown: { fontSize: 13, fontWeight: '800', marginBottom: 8 },
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
  responseHint: { fontSize: 12, fontStyle: 'italic', opacity: 0.7, marginBottom: 6, lineHeight: 17 },
  responseInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 90,
    backgroundColor: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choicePill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  choiceText: { fontSize: 13, fontWeight: '700' },
  diagramSide: { marginTop: 8 },
  diagramSideLabel: { fontSize: 11, fontWeight: '800', opacity: 0.65, marginBottom: 4 },
  diagramPair: { flexDirection: 'row', gap: 8 },
  diagramInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 9,
    minHeight: 38,
    backgroundColor: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  rateBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  rateText: { fontSize: 14, fontWeight: '800' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  checkMark: { fontSize: 18, fontWeight: '800' },
  checkLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  checkLabelDone: { opacity: 0.55, textDecorationLine: 'line-through' },
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
