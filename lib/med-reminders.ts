import { Platform } from 'react-native';

import { getItem, setItem } from '@/lib/storage';
import { Med } from '@/lib/health';

const REMINDER_MAP_KEY = 'health:medReminders';
let handlerReady = false;

/** "8:00 AM", "8am", "20:30" → { hour, minute } or null. */
export function parseReminderTime(input: string): { hour: number; minute: number } | null {
  const raw = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!raw) return null;

  const ampm = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(raw);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2] || 0);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (ampm[3] === 'pm' && hour !== 12) hour += 12;
    if (ampm[3] === 'am' && hour === 12) hour = 0;
    return { hour, minute };
  }

  const plain = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (plain) {
    const hour = Number(plain[1]);
    const minute = Number(plain[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }

  return null;
}

export function formatReminderTime(input: string): string {
  const parsed = parseReminderTime(input);
  if (!parsed) return input;
  const date = new Date();
  date.setHours(parsed.hour, parsed.minute, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

async function loadNotifications() {
  // Notifications are native-only; web just keeps the reminder flag.
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

async function ensureReady(Notifications: Awaited<ReturnType<typeof loadNotifications>>) {
  if (!Notifications) return false;
  if (!handlerReady) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerReady = true;
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Cancels every med reminder and re-schedules the enabled ones.
 * Reminders are daily local notifications at the med's schedule time.
 */
export async function syncMedReminders(meds: Med[]) {
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  try {
    const previous = await getItem<Record<string, string>>(REMINDER_MAP_KEY, {});
    for (const notificationId of Object.values(previous)) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      } catch {
        // already gone
      }
    }

    const withTimes = meds
      .map((med) => ({ med, time: parseReminderTime(med.timeLabel) }))
      .filter((item): item is { med: Med; time: { hour: number; minute: number } } => Boolean(item.time) && item.med.reminder);

    if (withTimes.length === 0) {
      await setItem(REMINDER_MAP_KEY, {});
      return;
    }

    const granted = await ensureReady(Notifications);
    if (!granted) {
      await setItem(REMINDER_MAP_KEY, {});
      return;
    }

    const next: Record<string, string> = {};
    for (const { med, time } of withTimes) {
      next[med.id] = await Notifications.scheduleNotificationAsync({
        content: {
          title: `💊 ${med.name}`,
          body: `${med.dosage || 'Time for your dose'} — ${formatReminderTime(med.timeLabel)}`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: time.hour,
          minute: time.minute,
        },
      });
    }
    await setItem(REMINDER_MAP_KEY, next);
  } catch (e) {
    console.warn('[health] reminder scheduling skipped', e);
  }
}
