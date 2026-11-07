import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { useAppTheme } from '@/hooks/useAppTheme';

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
  const appTheme = useAppTheme();
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

  const prettyDate = new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Our Log 📜</Text>
      <Text style={styles.subtitle}>
        Every wild story, sweet secret, and unforgettable moment we&apos;ve shared 💋📜
      </Text>

      {/* New entry card */}
      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />

        <Text style={styles.cardTitle}>New Entry</Text>
        <Text style={styles.cardHint}>{prettyDate} • A little memory to keep 💭</Text>

        <Pressable onPress={() => setShowForm((v) => !v)} style={styles.pillPress}>
          <LinearGradient
            colors={[appTheme.accentColor, '#C86DD7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pill}>
            <Text style={styles.pillText}>{showForm ? 'Close Form' : '+ Add Entry'}</Text>
          </LinearGradient>
        </Pressable>

        {showForm && (
          <View style={styles.form}>
            <Text style={styles.label}>What's happening?</Text>
            <TextInput
              value={whatHappened}
              onChangeText={setWhatHappened}
              placeholder="What happened / what we did..."
              placeholderTextColor="rgba(58,42,46,0.45)"
              style={[styles.input, { borderColor: appTheme.borderColor, color: appTheme.textColor }]}
              multiline
            />

            <Text style={styles.label}>Time (HH:MM)</Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="e.g. 19:30"
              placeholderTextColor="rgba(58,42,46,0.45)"
              style={[styles.input, { borderColor: appTheme.borderColor, color: appTheme.textColor }]}
            />

            <Text style={styles.label}>Event</Text>
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
                    selectedEventId === ev.id && !creatingEvent && [styles.eventChipSelected, appTheme.activeChipStyle],
                  ]}>
                  <Text style={styles.eventChipText}>
                    {ev.emoji} {ev.name}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  setCreatingEvent(true);
                  setSelectedEventId(null);
                }}
                style={[
                  styles.eventChip,
                  { backgroundColor: '#8E8E93' },
                  creatingEvent && [styles.eventChipSelected, appTheme.activeChipStyle],
                ]}>
                <Text style={styles.eventChipText}>+ New Event</Text>
              </Pressable>
            </View>

            {creatingEvent && (
              <View style={[styles.innerCard, { borderColor: appTheme.borderColor }]}>
                <Text style={styles.label}>Event emoji</Text>
                <TextInput
                  value={newEmoji}
                  onChangeText={setNewEmoji}
                  placeholder="🍽️"
                  placeholderTextColor="rgba(58,42,46,0.45)"
                  style={[styles.input, { borderColor: appTheme.borderColor, color: appTheme.textColor }]}
                />
                <Text style={styles.label}>Event name</Text>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Dinner"
                  placeholderTextColor="rgba(58,42,46,0.45)"
                  style={[styles.input, { borderColor: appTheme.borderColor, color: appTheme.textColor }]}
                />
                <Text style={styles.label}>Choose color</Text>
                <View style={styles.colorGrid}>
                  {EVENT_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setNewColor(c)}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: c },
                        newColor === c && [styles.colorSwatchSelected, appTheme.activeChipStyle],
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}

            <Pressable onPress={handleSave} style={styles.pillPress}>
              <LinearGradient
                colors={[appTheme.accentColor, '#C86DD7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pill}>
                <Text style={styles.pillText}>{editingEntryId ? 'Save Changes' : 'Save Entry'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>

      {/* Today's log card */}
      <View style={[styles.card, appTheme.cardStyle]}>
        <LeafBorder color={appTheme.leafColor} />
        <Text style={styles.cardTitle}>Today&apos;s Log 📜</Text>
        <Text style={styles.cardHint}>{prettyDate}</Text>

        {entries.length === 0 && <Text style={styles.muted}>No entries yet today. Add your first memory ✨</Text>}

        {entries.map((e) => (
          <View
            key={e.id}
            style={[styles.entryCard, { borderColor: appTheme.borderColor, borderLeftColor: e.eventColor }]}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryTime}>{e.time}</Text>
              <Text style={styles.entryEvent}>
                {e.eventEmoji} {e.eventName}
              </Text>
            </View>
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
              style={[styles.smallBtn, appTheme.buttonStyle]}>
              <Text style={styles.smallBtnText}>Edit</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {/* Saved events card */}
      {events.length > 0 && (
        <View style={[styles.card, appTheme.cardStyle]}>
          <LeafBorder color={appTheme.leafColor} />
          <Text style={styles.cardTitle}>Saved Events</Text>
          <Text style={styles.cardHint}>Tap Edit to rename, recolor or change the emoji 🎨</Text>

          {events.map((ev) => (
            <View key={ev.id} style={styles.eventRow}>
              {editingEventId === ev.id ? (
                <View style={styles.flex}>
                  <TextInput
                    value={newEmoji}
                    onChangeText={setNewEmoji}
                    placeholder="Emoji"
                    placeholderTextColor="rgba(58,42,46,0.45)"
                    style={[styles.input, { borderColor: appTheme.borderColor, color: appTheme.textColor }]}
                  />
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Name"
                    placeholderTextColor="rgba(58,42,46,0.45)"
                    style={[styles.input, { borderColor: appTheme.borderColor, color: appTheme.textColor }]}
                  />
                  <View style={styles.colorGrid}>
                    {EVENT_COLORS.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setNewColor(c)}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: c },
                          newColor === c && [styles.colorSwatchSelected, appTheme.activeChipStyle],
                        ]}
                      />
                    ))}
                  </View>
                  <Pressable
                    style={[styles.smallBtn, appTheme.buttonStyle, { marginLeft: 0, marginTop: 8 }]}
                    onPress={async () => {
                      const cid = coupleId || (await getCoupleId());
                      const updated = await updateLogEvent(cid, ev.id, {
                        emoji: newEmoji.trim(),
                        name: newName.trim(),
                        color: newColor,
                      });
                      setEvents((prev) => prev.map((x) => (x.id === ev.id ? updated : x)));
                      setEditingEventId(null);
                    }}>
                    <Text style={styles.smallBtnText}>Save Event</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={[styles.eventDot, { backgroundColor: ev.color }]} />
                  <Text style={styles.eventName}>
                    {ev.emoji} {ev.name}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setEditingEventId(ev.id);
                      setNewEmoji(ev.emoji);
                      setNewName(ev.name);
                      setNewColor(ev.color);
                    }}
                    style={[styles.smallBtn, appTheme.buttonStyle]}>
                    <Text style={styles.smallBtnText}>Edit</Text>
                  </Pressable>
                </>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 16, maxWidth: '100%' },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 17, opacity: 0.72, marginBottom: 4, lineHeight: 24 },
  card: { padding: 18, borderRadius: 24, marginBottom: 4 },
  cardTitle: { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  cardHint: { fontSize: 13, opacity: 0.65, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 6, opacity: 0.8 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    minHeight: 44,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  flex: { flex: 1 },
  form: { marginTop: 4 },
  pillPress: { alignSelf: 'flex-start', marginTop: 8, marginBottom: 4 },
  pill: { paddingVertical: 13, paddingHorizontal: 24, borderRadius: 50 },
  pillText: { fontWeight: '800', fontSize: 15, color: '#FFFFFF' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  eventChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 50, marginBottom: 6 },
  eventChipSelected: { borderWidth: 2 },
  eventChipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  innerCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  colorSwatch: { width: 30, height: 30, borderRadius: 15 },
  colorSwatchSelected: { borderWidth: 3 },
  smallBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 50, marginLeft: 8 },
  smallBtnText: { fontWeight: '700', fontSize: 12 },
  entryCard: {
    padding: 14,
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 5,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  entryTime: { fontSize: 11, opacity: 0.6, fontWeight: '700' },
  entryEvent: { fontSize: 15, fontWeight: '800' },
  entryText: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  eventDot: { width: 16, height: 16, borderRadius: 8 },
  eventName: { flex: 1, fontSize: 15, fontWeight: '600' },
  muted: { fontSize: 14, opacity: 0.65 },
});
