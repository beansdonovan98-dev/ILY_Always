export const USERS = {
  daddy: { key: 'daddy', name: 'Daddy', emoji: '🍆', label: 'Daddy 🍆' },
  princess: { key: 'princess', name: 'Princess', emoji: '🍑', label: 'Princess 🍑' },
} as const;

export type UserKey = keyof typeof USERS;

export const RELATIONSHIP_START = new Date(2019, 7, 9); // 08/09/19 -> Aug 9, 2019 (MM/DD/YY)

export const WORDS_OF_THE_DAY: string[] = [
  'Serendipity', 'Ephemeral', 'Luminescence', 'Resilience', 'Aurora',
  'Euphoria', 'Solitude', 'Harmony', 'Velocity', 'Mellifluous',
  'Petrichor', 'Sonder', 'Vellichor', 'Chrysalism', 'Eunoia',
];

export const FACTS_OF_THE_DAY: string[] = [
  'Honey never spoils; archaeologists have found edible honey in ancient tombs.',
  'A day on Venus is longer than a year on Venus.',
  'Octopuses have three hearts and blue blood.',
  'Bananas are berries, but strawberries are not.',
  'The Eiffel Tower can be 15 cm taller during hot summer days.',
  'Sharks existed before trees.',
  'There are more stars in the universe than grains of sand on Earth.',
  'A group of flamingos is called a "flamboyance."',
  'Wombat poop is cube-shaped.',
  'The human brain uses about 20% of the body\u2019s energy.',
];

export interface CoverPhoto {
  id: string;
  title: string;
  url: string;
}

export const COVER_PHOTO_POOL: CoverPhoto[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `cover-${i + 1}`,
  title: `Cover ${i + 1}`,
  url: `https://picsum.photos/seed/ilyalways-cover-${i + 1}/800/500`,
}));

export function pickDailyItems<T>(pool: T[], count: number, seed: number): T[] {
  // deterministic daily selection
  const result: T[] = [];
  const n = pool.length;
  if (n === 0) return result;
  for (let i = 0; i < count; i++) {
    const idx = (seed + i * 7) % n;
    // avoid duplicates
    if (!result.includes(pool[idx])) result.push(pool[idx]);
  }
  // fill if duplicates skipped
  let cursor = seed;
  while (result.length < count && result.length < n) {
    const idx = cursor % n;
    if (!result.includes(pool[idx])) result.push(pool[idx]);
    cursor++;
  }
  return result;
}

export function daySeed(date = new Date()): number {
  return date.getFullYear() * 1000 + (date.getMonth() + 1) * 50 + date.getDate();
}

export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}