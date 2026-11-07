import { getItem, setItem } from '@/lib/storage';

const COUPLE_KEY = 'coupleId';

export async function getCoupleId(): Promise<string> {
  return getItem<string>(COUPLE_KEY, 'default-couple');
}

export async function setCoupleId(id: string): Promise<void> {
  await setItem(COUPLE_KEY, id);
}