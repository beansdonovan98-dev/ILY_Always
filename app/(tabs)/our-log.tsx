import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText as Text } from '@/components/AppText';
import { LeafBorder } from '@/components/CannabisLeaf';
import { MylarPouch } from '@/components/MylarPouch';
import { useAppTheme } from '@/hooks/useAppTheme';

import { getCoupleId } from '@/lib/couple';
import { useTabLabel } from '@/hooks/useTabLabel';
import { subscribeMany } from '@/lib/subscribe';
import {
  addLogEntry,
  deleteLogEvent,
  EVENT_COLORS,
  formatTimeForDisplay,
  getDayLogEntries,
  getLogEvents,
  LogEntry,
  LogEvent,
  parseTimeInput,
  saveLogEvent,
  updateLogEntry,
  updateLogEvent,
} from '@/lib/log';
import { localDateKey } from '@/lib/days';
import { useUsage } from '@/contexts/UsageContext';
import { markActivity } from '@/lib/activity';

export default function OurLogScreen() {
  const appTheme = useAppTheme();
  const logTitle = useTabLabel('our-log', 'Our Log 📜');
  const { currentUser } = useUsage();
  const scrollRef = useRef<any>(null);
  const [coupleId, setCoupleId] = useState<string>('');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [dateKey, setDateKey] = useState(localDateKey());

  // form state
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

  // Live updates: whatever either phone writes lands here instantly.
  useEffect(() => {
    if (!coupleId) return;
    const unsub = subscribeMany(['days', 'log_events'], coupleId, () =>
      void load()
    );
    return unsub;
  }, [coupleId, load]);

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
      time: parseTimeInput(time || '') || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
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
    if (cid && currentUser) void markActivity('our-log', currentUser, cid);
    setWhatHappened('');
    setTime('');
    setSelectedEventId(null);
    setCreatingEvent(false);
    setNewEmoji('');
    setNewName('');
    setNewColor(EVENT_COLORS[0]);
    setEditingEntryId(null);
  }, [coupleId, creatingEvent, newEmoji, newName, newColor, selectedEventId, events, whatHappened, time, dateKey, editingEntryId]);

  const handleSaveEvent = useCallback(async () => {
    if (!newEmoji.trim() || !newName.trim()) return;
    const cid = coupleId || (await getCoupleId());
    if (editingEventId) {
      const updated = await updateLogEvent(cid, editingEventId, {
        emoji: newEmoji.trim(),
        name: newName.trim(),
        color: newColor,
      });
      setEvents((prev) => prev.map((x) => (x.id === editingEventId ? updated : x)));
      setEditingEventId(null);
      setSelectedEventId(updated.id);
    } else {
      const event = await saveLogEvent(cid, newEmoji.trim(), newName.trim(), newColor);
      setEvents((prev) => [...prev, event]);
      setSelectedEventId(event.id);
      setCreatingEvent(false);
      setNewEmoji('');
      setNewName('');
      setNewColor(EVENT_COLORS[0]);
    }
  }, [coupleId, editingEventId, newEmoji, newName, newColor]);

  const handleDeleteEvent = useCallback(async (id: string) => {
    const cid = coupleId || (await getCoupleId());
    await deleteLogEvent(cid, id);
    setEvents((prev) => prev.filter((x) => x.id !== id));
    if (selectedEventId === id) setSelectedEventId(null);
    if (editingEventId === id) setEditingEventId(null);
  }, [coupleId, selectedEventId, editingEventId]);

  const prettyDate = new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title]}>{logTitle}</Text>
      <Text style={[styles.subtitle, { color: appTheme.subtitleColor }]}>
        Our filthy little diary — every wild, sweet, sinful secret we&apos;ve ever dared to live 💋📜🔥
      </Text>

      {/* New entry card */}
      <MylarPouch title={<Text style={styles.cardTitle}>{editingEntryId ? 'Edit Entry ✏️' : 'New Entry'}</Text>} defaultStrain="PINEAPPLE EXP." stampRight="THC: 24.5%">
        <LeafBorder color={appTheme.leafColor} />
        <Text style={styles.cardHint}>
          {editingEntryId
            ? 'You\'re editing — tap Save Changes when done 💋'
            : `${prettyDate} • Spill the dirty little details here, baby 😏✍️`}
        </Text>
        {editingEntryId ? (
          <Pressable
            onPress={() => {
              setEditingEntryId(null);
              setWhatHappened('');
              setTime('');
              setSelectedEventId(null);
              setCreatingEvent(false);
            }}
            style={styles.cancelEditBtn}>
            <Text style={styles.cancelEditText}>Cancel editing ✕</Text>
          </Pressable>
        ) : null}

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

            <Text style={styles.label}>Time (e.g. 7:30 PM)</Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="e.g. 7:30 PM"
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

          <Text style={styles.label}>Your events 🎨</Text>
          <Text style={styles.hint}>Tap Edit to rename, recolor or change the emoji — or erase it entirely.</Text>
          {events.length === 0 ? (
            <Text style={styles.muted}>No events yet. Hit “+ New Event” above to make your first one.</Text>
          ) : (
            events.map((ev) => (
              <View key={ev.id} style={[styles.eventRow, { borderColor: appTheme.borderColor }]}>
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
                    <View style={styles.eventActions}>
                      <Pressable style={[styles.smallBtn, appTheme.buttonStyle]} onPress={handleSaveEvent}>
                        <Text style={styles.smallBtnText}>Save</Text>
                      </Pressable>
                      <Pressable style={[styles.smallBtn, styles.ghostBtn]} onPress={() => setEditingEventId(null)}>
                        <Text style={styles.smallBtnText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.eventRowInner}>
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
                    <Pressable style={[styles.smallBtn, styles.ghostBtn]} onPress={() => handleDeleteEvent(ev.id)}>
                      <Text style={styles.smallBtnText}>Erase</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
      </MylarPouch>

      {/* Today's log card */}
      <MylarPouch title={<Text style={styles.cardTitle}>Today&apos;s Log 📜</Text>} defaultStrain="BLUE DREAM" stampRight="THC: 22.5%">
        <LeafBorder color={appTheme.leafColor} />
        <Text style={[styles.spicyCaption, { color: appTheme.subtitleColor }]}>
          Read it, remember it, relive it — then do it all again tonight 😏🔥
        </Text>
        <Text style={styles.cardHint}>{prettyDate}</Text>

        {entries.length === 0 && <Text style={styles.muted}>No entries yet today. Add your first memory ✨</Text>}

          {entries.map((e) => (
          <MylarPouch
            key={e.id}
            title={<Text style={styles.cardTitle}>{e.eventEmoji} {e.eventName}</Text>}
            defaultStrain="SOUR DIESEL"
            stampRight="THC: 21.5%"
            style={{ borderLeftColor: e.eventColor, borderLeftWidth: 5 }}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryTime}>{formatTimeForDisplay(e.time)}</Text>
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
                scrollRef.current?.scrollTo({ y: 0, animated: true });
              }}
              style={[styles.smallBtn, appTheme.buttonStyle]}>
              <Text style={styles.smallBtnText}>Edit</Text>
            </Pressable>
          </MylarPouch>
        ))}
      </MylarPouch>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 60, alignItems: 'stretch', gap: 36, maxWidth: '100%' },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 17, fontStyle: 'italic', marginBottom: 4, lineHeight: 24 },
  spicyCaption: { fontSize: 15, fontStyle: 'italic', marginBottom: 8 },
  cancelEditBtn: { alignSelf: 'flex-start', marginBottom: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 50, backgroundColor: 'rgba(192,57,43,0.12)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.35)' },
  cancelEditText: { fontSize: 12, fontWeight: '700', color: '#C0392B' },
  hint: { fontSize: 13, opacity: 0.65, marginBottom: 8 },
  card: { padding: 18, borderRadius: 24, marginBottom: 4 },
  cardTitle: { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  cardHint: { fontSize: 13, fontStyle: 'italic', opacity: 0.65, marginBottom: 12 },
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
  smallBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 50, marginLeft: 8 },
  smallBtnText: { fontWeight: '700', fontSize: 10 },
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
  eventRow: { marginTop: 10, padding: 10, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.4)' },
  eventRowInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  ghostBtn: { borderWidth: 1, borderColor: 'rgba(58,42,46,0.25)', marginLeft: 0 },
  eventDot: { width: 16, height: 16, borderRadius: 8 },
  eventName: { flex: 1, fontSize: 15, fontWeight: '600' },
  muted: { fontSize: 14, opacity: 0.65 },
});
