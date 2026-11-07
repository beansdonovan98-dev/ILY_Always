import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getCoupleId } from '@/lib/couple';
import {
  addLogEntry,
  EVENT_COLORS,
  getDayLogEntries,
  getLogEvents,
  LogEntry,
  LogEvent,
  saveLogEvent,
  updateLogEntry,
  updateLogEvent,
} from '@/lib/log';
import { localDateKey } from '@/lib/days';

export default function OurLogScreen() {
  const [coupleId, setCoupleId] = useState<string>('');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [dateKey, setDateKey] = useState(localDateKey());

  // form state
  const [showForm, setShowForm] = useState(false);
  const [whatHappened, setWhatHappened] = useState('');
  const [time, setTime] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [newEmoji, setNewEmoji] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(EVENT_COLORS[0]);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const cid = await getCoupleId();
    setCoupleId(cid);
    const ev = await getLogEvents(cid);
    setEvents(ev);
    const logs = await getDayLogEntries(cid, dateKey);
    setEntries(logs);
  }, [dateKey]);

  useEffect(() => {
    load();
  }, [load]);

  // midnight rollover check
  useEffect(() => {
    const t = setInterval(() => {
      const k = localDateKey();
      if (k !== dateKey) setDateKey(k);
    }, 30000);
    return () => clearInterval(t);
  }, [dateKey]);

  const handleSave = useCallback(async () => {
    if (!whatHappened.trim()) return;
    const cid = coupleId || (await getCoupleId());

    let event: LogEvent | null = null;
    if (creatingEvent) {
      if (!newEmoji.trim() || !newName.trim()) return;
      event = await saveLogEvent(cid, newEmoji.trim(), newName.trim(), newColor);
      setEvents((prev) => [...prev, event!]);
    } else if (selectedEventId) {
      event = events.find((e) => e.id === selectedEventId) || null;
    }

    const entryPatch = {
      eventId: event?.id || null,
      eventEmoji: event?.emoji || '📝',
      eventName: event?.name || 'Event',
      eventColor: event?.color || '#8E8E93',
      whatHappened: whatHappened.trim(),
      time: time.trim() || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (editingEntryId) {
      const next = await updateLogEntry(cid, dateKey, editingEntryId, entryPatch);
      setEntries(next);
    } else {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...entryPatch,
        createdAt: Date.now(),
      };
      const next = await addLogEntry(cid, entry, dateKey);
      setEntries(next);
    }

    // reset form
    setWhatHappened('');
    setTime('');
    setSelectedEventId(null);
    setCreatingEvent(false);
    setNewEmoji('');
    setNewName('');
    setNewColor(EVENT_COLORS[0]);
    setEditingEntryId(null);
    setShowForm(false);
  }, [coupleId, creatingEvent, newEmoji, newName, newColor, selectedEventId, events, whatHappened, time, dateKey, editingEntryId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Our Log 📜</Text>
      <Text style={styles.muted}>{dateKey}</Text>

      <Pressable style={styles.btn} onPress={() => setShowForm((v) => !v)}>
        <Text style={styles.btnText}>{showForm ? 'Cancel' : 'Add Entry'}</Text>
      </Pressable>

      {showForm && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What's Happening?</Text>
          <TextInput
            value={whatHappened}
            onChangeText={setWhatHappened}
            placeholder="What happened / what we did..."
            style={styles.input}
            multiline
          />

          <Text style={styles.label}>Time (HH:MM)</Text>
          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="e.g. 19:30"
            style={styles.input}
          />

          <Text style={styles.label}>Event</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={styles.row}>
              {events.map((ev) => (
                <Pressable
                  key={ev.id}
                  onPress={() => {
                    setCreatingEvent(false);
                    setSelectedEventId(ev.id);
                  }}
                  style={[
                    styles.eventChip,
                    { backgroundColor: ev.color },
                    selectedEventId === ev.id && !creatingEvent && styles.eventChipSelected,
                  ]}>
                  <Text style={styles.eventChipText}>{ev.emoji} {ev.name}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  setCreatingEvent(true);
                  setSelectedEventId(null);
                }}
                style={[styles.eventChip, { backgroundColor: '#8E8E93' }, creatingEvent && styles.eventChipSelected]}>
                <Text style={styles.eventChipText}>+ New Event</Text>
              </Pressable>
            </View>
          </ScrollView>

          {creatingEvent && (
            <View style={styles.card}>
              <Text style={styles.label}>Event emoji</Text>
              <TextInput value={newEmoji} onChangeText={setNewEmoji} placeholder="🍽️" style={styles.input} />
              <Text style={styles.label}>Event name</Text>
              <TextInput value={newName} onChangeText={setNewName} placeholder="Dinner" style={styles.input} />
              <Text style={styles.label}>Choose color</Text>
              <View style={styles.colorGrid}>
                {EVENT_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setNewColor(c)}
                    style={[styles.colorSwatch, { backgroundColor: c }, newColor === c && styles.colorSwatchSelected]}
                  />
                ))}
              </View>
            </View>
          )}

          <Pressable style={styles.btn} onPress={handleSave}>
            <Text style={styles.btnText}>Save Entry</Text>
          </Pressable>
        </View>
      )}

      {events.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Saved Events (editable)</Text>
          {events.map((ev) => (
            <View key={ev.id} style={[styles.row, { alignItems: 'center', marginBottom: 8 }]}>
              {editingEventId === ev.id ? (
                <View style={{ flex: 1 }}>
                  <TextInput value={newEmoji} onChangeText={setNewEmoji} placeholder="Emoji" style={styles.input} />
                  <TextInput value={newName} onChangeText={setNewName} placeholder="Name" style={styles.input} />
                  <View style={styles.colorGrid}>
                    {EVENT_COLORS.map((c) => (
                      <Pressable key={c} onPress={() => setNewColor(c)} style={[styles.colorSwatch, { backgroundColor: c }, newColor === c && styles.colorSwatchSelected]} />
                    ))}
                  </View>
                  <Pressable
                    style={styles.btn}
                    onPress={async () => {
                      const cid = coupleId || (await getCoupleId());
                      const updated = await updateLogEvent(cid, ev.id, { emoji: newEmoji.trim(), name: newName.trim(), color: newColor });
                      setEvents((prev) => prev.map((x) => (x.id === ev.id ? updated : x)));
                      setEditingEventId(null);
                    }}>
                    <Text style={styles.btnText}>Save Event</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={[styles.colorSwatch, { backgroundColor: ev.color, marginRight: 8 }]} />
                  <Text style={{ flex: 1 }}>{ev.emoji} {ev.name}</Text>
                  <Pressable
                    onPress={() => {
                      setEditingEventId(ev.id);
                      setNewEmoji(ev.emoji);
                      setNewName(ev.name);
                      setNewColor(ev.color);
                    }}
                    style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>Edit</Text>
                  </Pressable>
                </>
              )}
            </View>
          ))}
        </View>
      )}

      {entries.length === 0 && <Text style={styles.muted}>No entries yet today.</Text>}
      {entries.map((e) => (
        <View key={e.id} style={[styles.entryCard, { borderLeftColor: e.eventColor, borderLeftWidth: 4 }]}>
          <Text style={styles.entryTime}>{e.time}</Text>
          <Text style={styles.entryEvent}>{e.eventEmoji} {e.eventName}</Text>
          <Text style={styles.entryText}>{e.whatHappened}</Text>
          <Pressable
            onPress={() => {
              setEditingEntryId(e.id);
              setWhatHappened(e.whatHappened);
              setTime(e.time);
              const ev = events.find((x) => x.id === e.eventId);
              if (ev) {
                setCreatingEvent(false);
                setSelectedEventId(ev.id);
              } else {
                setCreatingEvent(true);
                setNewEmoji(e.eventEmoji);
                setNewName(e.eventName);
                setNewColor(e.eventColor);
              }
              setShowForm(true);
            }}
            style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>Edit</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  muted: { fontSize: 12, opacity: 0.6, marginBottom: 12 },
  card: { borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: 'rgba(120,120,120,0.12)' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: 'rgba(120,120,120,0.4)', borderRadius: 8, padding: 8, minHeight: 40, marginBottom: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(100,150,255,0.4)', marginBottom: 12, alignSelf: 'flex-start' },
  btnText: { fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  eventChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, marginRight: 6 },
  eventChipSelected: { borderWidth: 2, borderColor: '#fff' },
  eventChipText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  colorSwatchSelected: { borderWidth: 3, borderColor: '#fff' },
  smallBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: 'rgba(100,150,255,0.4)', marginLeft: 8 },
  smallBtnText: { fontWeight: '600', fontSize: 12 },
  entryTime: { fontSize: 11, opacity: 0.6 },
  entryEvent: { fontSize: 15, fontWeight: '700', marginVertical: 2 },
  entryCard: { padding: 12, marginBottom: 10, borderRadius: 8, backgroundColor: 'rgba(120,120,120,0.12)' },
  entryText: { fontSize: 14 },
});