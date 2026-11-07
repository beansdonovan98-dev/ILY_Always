import CryptoJS from 'crypto-js';
import { getItem, setItem } from '@/lib/storage';

const UNLOCK_KEY = 'unlockedDate';

export function dailyRoomCode(coupleId: string, date = new Date()): string {
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const hash = CryptoJS.SHA256(`${coupleId}:${day}:ilyalways-room`).toString();
  return hash.slice(0, 6).toUpperCase();
}

export async function isUnlockedToday(): Promise<boolean> {
  const today = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
  const stored = await getItem<string>(UNLOCK_KEY, '');
  return stored === today;
}

export async function unlockWithCode(coupleId: string, code: string): Promise<boolean> {
  const expected = dailyRoomCode(coupleId);
  if (code.trim().toUpperCase() === expected) {
    const today = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
    await setItem(UNLOCK_KEY, today);
    return true;
  }
  return false;
}