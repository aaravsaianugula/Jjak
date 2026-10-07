/**
 * Opt-in Daily reminders (local notifications, no server).
 *
 * Instead of one repeating ping we schedule the next seven days individually,
 * so each reminder can name that day's theme ("Leaf-fall Wednesday") and skip
 * today once it's played. Re-planned on every launch and after each Daily.
 * Alarms are inexact on purpose: a gentle nudge doesn't need the exact-alarm
 * permission (or the system settings screen it would open).
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { dailyNumber, dailyTheme, localDateKey } from '../engine/levels';
import { liveStreak } from './progress';
import { persist, save } from './storage';

const native = Capacitor.isNativePlatform();
const IDS = [101, 102, 103, 104, 105, 106, 107];

export const REMINDER_TIMES = [
  { hour: 8, label: 'Morning · 8:00' },
  { hour: 12, label: 'Lunch · 12:00' },
  { hour: 19, label: 'Evening · 19:00' },
];

export async function enableReminder(hour: number): Promise<boolean> {
  save.reminder.asked = true;
  if (!native) {
    save.reminder.hour = hour;
    persist();
    return true;
  }
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      persist();
      return false;
    }
    save.reminder.hour = hour;
    persist();
    await planReminders();
    return true;
  } catch {
    return false;
  }
}

export async function disableReminder(): Promise<void> {
  save.reminder.hour = null;
  persist();
  if (!native) return;
  try {
    await LocalNotifications.cancel({ notifications: IDS.map((id) => ({ id })) });
  } catch {
    /* nothing scheduled */
  }
}

/** (Re)schedule the coming week of reminders. Safe to call often. */
export async function planReminders(): Promise<void> {
  if (!native || save.reminder.hour == null) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;
    await LocalNotifications.cancel({ notifications: IDS.map((id) => ({ id })) });
    const now = new Date();
    const streak = liveStreak();
    const notifications = [];
    for (let d = 0; d < 7; d++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, save.reminder.hour, 0, 0);
      const key = localDateKey(at);
      if (at <= now || save.daily.results[key]) continue;
      const theme = dailyTheme(key);
      notifications.push({
        id: IDS[d],
        title: `Daily Jjak #${dailyNumber(key)} is ready`,
        body: d <= 1 && streak > 1 ? `${theme.name} · keep your ${streak}-day streak going` : `${theme.name} · one board for the whole world`,
        schedule: { at, allowWhileIdle: true },
        isExactNotification: false,
        smallIcon: 'ic_stat_jjak',
        iconColor: '#c4472f',
      });
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch {
    /* notifications unavailable */
  }
}
