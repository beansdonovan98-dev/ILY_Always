import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { getCoupleId } from '@/lib/couple';
import { getCoupleSettings } from '@/lib/appearance';
import { getItem, setItem } from '@/lib/storage';

interface WeightEntry { id: string; who: string; weight: string; date: string; }
interface Med { id: string; name: string; dosage: string; timing: string; taken: boolean; }
interface FitnessEntry { id: string; who: string; exercise: string; duration: string; date: string; }

export default function HealthScreen() {
  const [coupleId, setCoupleId] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [fitness, setFitness] = useState<FitnessEntry[]>([]);

  // weight form
  const [wWho, setWWho] = useState('Daddy');
  const [wVal, setWVal] = useState('');
  // med form
  const [mName, setMName] = useState('');
  const [mDose, setMDose] = useState('');
  const [mTime, setMTime] = useState('');
  // fitness form
  const [fWho, setFWho] = useState('Daddy');
  const [fEx, setFEx] = useState('');
  const [fDur, setFDur] = useState('');

  useEffect(() => {
    (async () => {
      const cid = await getCoupleId();
      setCoupleId(cid);
      const s = await getCoupleSettings(cid);
      setRevealed(!!s?.playtime_revealed); // reuse? better separate; use settings field period_revealed
      // Actually use a dedicated key
      const pr = await getItem<boolean>('periodRevealed', false);
      setRevealed(pr);
      setWeights(await getItem<WeightEntry[]>(`weights:${cid}`, []));
      setMeds(await getItem<Med[]>(`meds:${cid}`, []));
      setFitness(await getItem<FitnessEntry[]>(`fitness:${cid}`, []));
    })();
  }, []);

  const saveWeights = async (next: WeightEntry[]) => { setWeights(next); await setItem(`weights:${coupleId}`, next); };
  const saveMeds = async (next: Med[]) => { setMeds(next); await setItem(`meds:${coupleId}`, next); };
  const saveFitness = async (next: FitnessEntry[]) => { setFitness(next); await setItem(`fitness:${coupleId}`, next); };

  const addWeight = async () => {
    if (!wVal.trim()) return;
    const entry: WeightEntry = { id: `${Date.now()}`, who: wWho, weight: wVal.trim(), date: new Date().toLocaleDateString() };
    await saveWeights([...weights, entry]);
    setWVal('');
  };

  const addMed = async () => {
    if (!mName.trim()) return;
    const med: Med = { id: `${Date.now()}`, name: mName.trim(), dosage: mDose.trim(), timing: mTime.trim(), taken: false };
    await saveMeds([...meds, med]);
    setMName(''); setMDose(''); setMTime('');
  };

  const toggleMed = async (id: string) => {
    const next = meds.map((m) => (m.id === id ? { ...m, taken: !m.taken } : m));
    await saveMeds(next);
  };

  const addFitness = async () => {
    if (!fEx.trim()) return;
    const entry: FitnessEntry = { id: `${Date.now()}`, who: fWho, exercise: fEx.trim(), duration: fDur.trim(), date: new Date().toLocaleDateString() };
    await saveFitness([...fitness, entry]);
    setFEx(''); setFDur('');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Health 🩺</Text>
      <Text style={styles.subtitle}>Taking care of our temple and each other 🌿</Text>

      {/* Weight tracker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weight Tracker</Text>
        <View style={styles.row}>
          <Pressable onPress={() => setWWho('Daddy')} style={[styles.chip, wWho === 'Daddy' && styles.chipActive]}><Text style={styles.chipText}>Daddy</Text></Pressable>
          <Pressable onPress={() => setWWho('Princess')} style={[styles.chip, wWho === 'Princess' && styles.chipActive]}><Text style={styles.chipText}>Princess</Text></Pressable>
        </View>
        <TextInput value={wVal} onChangeText={setWVal} placeholder="Weight (kg/lbs)" style={styles.input} keyboardType="numeric" />
        <Pressable style={styles.btn} onPress={addWeight}><Text style={styles.btnText}>Log Weight</Text></Pressable>
        {weights.filter((w) => w.who === wWho).length > 0 && (
          <View style={styles.chart}>
            {weights.filter((w) => w.who === wWho).map((w) => {
              const max = Math.max(...weights.filter((x) => x.who === wWho).map((x) => parseFloat(x.weight) || 0));
              const h = max > 0 ? (parseFloat(w.weight) / max) * 80 : 0;
              return (
                <View key={w.id} style={styles.chartBar}>
                  <View style={[styles.bar, { height: h }]} />
                  <Text style={styles.chartLabel}>{w.weight}</Text>
                </View>
              );
            })}
          </View>
        )}
        {weights.filter((w) => w.who === wWho).map((w) => (
          <Text key={w.id} style={styles.body}>{w.who}: {w.weight} ({w.date})</Text>
        ))}
      </View>

      {/* Medicine tracker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Medicine / Supplement Tracker</Text>
        <TextInput value={mName} onChangeText={setMName} placeholder="Name" style={styles.input} />
        <TextInput value={mDose} onChangeText={setMDose} placeholder="Dosage" style={styles.input} />
        <TextInput value={mTime} onChangeText={setMTime} placeholder="Timing (e.g. 8am)" style={styles.input} />
        <Pressable style={styles.btn} onPress={addMed}><Text style={styles.btnText}>Add Medication</Text></Pressable>
        {meds.map((m) => (
          <View key={m.id} style={styles.row}>
            <Pressable onPress={() => toggleMed(m.id)} style={styles.checkBtn}>
              <Text style={styles.btnText}>{m.taken ? '✓' : '○'}</Text>
            </Pressable>
            <Text style={styles.body}>{m.name} — {m.dosage} ({m.timing})</Text>
          </View>
        ))}
      </View>

      {/* Fitness log */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fitness Log (Individual)</Text>
        <View style={styles.row}>
          <Pressable onPress={() => setFWho('Daddy')} style={[styles.chip, fWho === 'Daddy' && styles.chipActive]}><Text style={styles.chipText}>Daddy</Text></Pressable>
          <Pressable onPress={() => setFWho('Princess')} style={[styles.chip, fWho === 'Princess' && styles.chipActive]}><Text style={styles.chipText}>Princess</Text></Pressable>
        </View>
        <TextInput value={fEx} onChangeText={setFEx} placeholder="Exercise" style={styles.input} />
        <TextInput value={fDur} onChangeText={setFDur} placeholder="Duration (min)" style={styles.input} keyboardType="numeric" />
        <Pressable style={styles.btn} onPress={addFitness}><Text style={styles.btnText}>Log Workout</Text></Pressable>
        {fitness.filter((f) => f.who === fWho).map((f) => (
          <Text key={f.id} style={styles.body}>{f.who}: {f.exercise} — {f.duration} min ({f.date})</Text>
        ))}
      </View>

      {/* Period tracker hidden */}
      {revealed && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Period Tracker</Text>
          <Text style={styles.body}>Period tracking enabled (placeholder). Add dates here.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 16, opacity: 0.7, marginBottom: 16, textAlign: 'center' },
  card: { borderRadius: 16, padding: 18, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', width: '100%' },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: 'rgba(120,120,120,0.4)', borderRadius: 8, padding: 8, minHeight: 40, marginBottom: 8, width: '100%' },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(100,150,255,0.4)', marginBottom: 12, alignSelf: 'flex-start' },
  btnText: { fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(120,120,120,0.2)', marginRight: 6 },
  chipActive: { backgroundColor: 'rgba(100,150,255,0.4)' },
  chipText: { fontWeight: '600', fontSize: 13 },
  checkBtn: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: 'rgba(100,150,255,0.4)', marginRight: 8 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 10 },
  chartBar: { alignItems: 'center', width: 32 },
  bar: { width: 20, backgroundColor: 'rgba(100,150,255,0.6)', borderRadius: 4 },
  chartLabel: { fontSize: 10, marginTop: 2 },
});