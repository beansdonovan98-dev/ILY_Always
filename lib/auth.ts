import CryptoJS from 'crypto-js';

import { getItem, setItem } from '@/lib/storage';
import { UserKey } from '@/constants/content';

const pinKey = (user: UserKey) => `authPin:${user}`;

function hashPin(pin: string) {
  return CryptoJS.SHA256(`ilyalways:${pin.trim()}`).toString();
}

export async function hasPin(user: UserKey): Promise<boolean> {
  const stored = await getItem<string>(pinKey(user), '');
  return Boolean(stored);
}

export async function setPin(user: UserKey, pin: string): Promise<void> {
  await setItem(pinKey(user), hashPin(pin));
}

export async function verifyPin(user: UserKey, pin: string): Promise<boolean> {
  const stored = await getItem<string>(pinKey(user), '');
  if (!stored) return false;
  return stored === hashPin(pin);
}
