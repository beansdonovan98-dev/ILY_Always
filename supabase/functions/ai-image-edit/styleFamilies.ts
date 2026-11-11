/**
 * Backend-only style taxonomy. The app keeps its flat style list; this file
 * decides which pipeline each style runs (checkpoint, strength, ControlNet,
 * face swap, prompt tags). Add a style once here and it inherits its family.
 */

export type StyleFamily =
  | 'photo'
  | 'anime'
  | 'toy'
  | 'art'
  | 'effect'
  | 'mockup'
  | 'fantasy'
  | 'object';

export type StyleFamilyConfig = {
  checkpoint: 'pony' | 'anime';
  denoise: number;
  faceIdWeight: number;
  controlNet: boolean;
  faceSwap: boolean;
  quality: 'pony' | 'anime';
  negative: 'base' | 'anime';
  mockup?: boolean;
  object?: boolean;
};

export const STYLE_FAMILY: Record<string, StyleFamily> = {
  // Photo / scene / lighting
  realistic: 'photo',
  'neon-noir': 'photo',
  'candle-light': 'photo',
  'velvet-glow': 'photo',
  'plum-and-espresso': 'photo',
  'walmart-security-cam': 'photo',
  'alien-abduction-beam': 'photo',
  dungeon: 'photo',
  polaroid: 'photo',
  'polaroid-after-dark': 'photo',
  'y2k-film': 'photo',
  'black-and-white': 'photo',
  '20s-era': 'photo',
  photobooth: 'photo',
  'park-bench': 'photo',
  'product-photo': 'photo',
  'change-outfit': 'photo',

  // Anime / cartoon / comic
  'comic-book': 'anime',
  anime: 'anime',
  'adult-anime': 'anime',
  cartoon: 'anime',
  'powerpuff-girls': 'anime',
  'sticker-pack': 'anime',
  'pixel-art': 'anime',
  'manga-memoir': 'anime',
  '90s-anime': 'anime',
  gameboy: 'anime',
  'pokemon-card': 'anime',
  'south-park': 'anime',
  'adventure-time': 'anime',
  atla: 'anime',
  '16-bit-arcade': 'anime',
  'yugioh-card': 'anime',

  // 3D / toy / sculpture
  lego: 'toy',
  figurine: 'toy',
  pixar: 'toy',
  snowglobe: 'toy',
  claymation: 'toy',
  'plush doll': 'toy',
  'kawaii-collector': 'toy',
  statue: 'toy',
  '3d-avatar': 'toy',
  bobblehead: 'toy',
  minecraft: 'toy',
  'mini-me': 'toy',
  'paper-people': 'toy',

  // Art / illustration / street art
  watercolor: 'art',
  'ink-illustration': 'art',
  'coloring-book': 'art',
  astrology: 'art',
  'comic-dot': 'art',
  'pop-garden': 'art',
  pointillism: 'art',
  'negative-space-invasion': 'art',
  'drawn-to life': 'art',
  'stained-glass': 'art',
  mural: 'art',
  graffiti: 'art',
  stencil: 'art',
  blueprint: 'art',
  sketch: 'art',

  // Colour / glitch / light effects
  'double-exposure': 'effect',
  'glitch-art': 'effect',
  posterize: 'effect',
  'color-swap': 'effect',
  luminescence: 'effect',
  prism: 'effect',
  psychedelic: 'effect',
  'dream-diffusion': 'effect',
  'myspace-glitter': 'effect',

  // Print / product / mockups
  'tarot-card': 'mockup',
  'holiday-cards': 'mockup',
  'magazine-cover': 'mockup',
  'playing-card': 'mockup',
  'magazine-ransom-note': 'mockup',
  'album-cover': 'mockup',
  'record-vinyl': 'mockup',
  'app-icon': 'mockup',
  scrapbook: 'mockup',
  'rip-shirt': 'mockup',
  'backwoods-wrapper': 'mockup',
  'post-it-note': 'mockup',
  'post-card': 'mockup',
  merchandise: 'mockup',
  'wanted-poster': 'mockup',
  'book-cover': 'mockup',
  thumbnail: 'mockup',
  advertisement: 'mockup',
  billboard: 'mockup',
  'side-of-bus': 'mockup',
  'missing-poster': 'mockup',
  'milk-carton': 'mockup',
  'fbi-wanted': 'mockup',
  'car-wrap': 'mockup',

  // Fantasy / cinematic character
  superhero: 'fantasy',
  'lord-of-the-rings': 'fantasy',
  'olympian-greek-god': 'fantasy',

  // Object / insert
  'perc-in-bong': 'object',
};

export const FAMILY_CONFIG: Record<StyleFamily, StyleFamilyConfig> = {
  photo: {
    checkpoint: 'pony',
    denoise: 0.32,
    faceIdWeight: 0.8,
    controlNet: false,
    faceSwap: false,
    quality: 'pony',
    negative: 'base',
  },
  anime: {
    // Animagine + pose + blurred depth. Lower strength preserves anatomy;
    // the largest-face composite restores the real face separately.
    checkpoint: 'anime',
    denoise: 0.50,
    faceIdWeight: 0.8,
    controlNet: true,
    faceSwap: false,
    quality: 'anime',
    negative: 'anime',
  },
  toy: {
    checkpoint: 'pony',
    denoise: 0.48,
    faceIdWeight: 0.75,
    controlNet: false,
    faceSwap: false,
    quality: 'pony',
    negative: 'base',
  },
  art: {
    checkpoint: 'pony',
    denoise: 0.4,
    faceIdWeight: 0.8,
    controlNet: false,
    faceSwap: false,
    quality: 'pony',
    negative: 'base',
  },
  effect: {
    checkpoint: 'pony',
    denoise: 0.36,
    faceIdWeight: 0.8,
    controlNet: false,
    faceSwap: false,
    quality: 'pony',
    negative: 'base',
  },
  mockup: {
    checkpoint: 'pony',
    denoise: 0.5,
    faceIdWeight: 0.75,
    controlNet: false,
    faceSwap: false,
    quality: 'pony',
    negative: 'base',
    mockup: true,
  },
  fantasy: {
    checkpoint: 'pony',
    denoise: 0.42,
    faceIdWeight: 0.78,
    controlNet: false,
    faceSwap: false,
    quality: 'pony',
    negative: 'base',
  },
  object: {
    checkpoint: 'pony',
    denoise: 0.52,
    faceIdWeight: 0.7,
    controlNet: false,
    faceSwap: false,
    quality: 'pony',
    negative: 'base',
    object: true,
  },
};

/**
 * Individual exceptions only where the family baseline is clearly wrong.
 * Keep this tiny; everything else inherits its family.
 */
export const STYLE_OVERRIDES: Record<string, Partial<StyleFamilyConfig>> = {
  dungeon: { denoise: 0.5 },
  'change-outfit': { denoise: 0.46 },
  'alien-abduction-beam': { denoise: 0.44 },
  'walmart-security-cam': { denoise: 0.42 },
  pointillism: { denoise: 0.5 },
  watercolor: { denoise: 0.4, faceIdWeight: 0.85 },
  'ink-illustration': { denoise: 0.4 },
  sketch: { denoise: 0.4 },
  'stained-glass': { denoise: 0.48 },
  'coloring-book': { denoise: 0.48 },
  'comic-dot': { denoise: 0.44 },
  'pop-garden': { denoise: 0.45 },
  psychedelic: { denoise: 0.46 },
  posterize: { denoise: 0.46 },
  'glitch-art': { denoise: 0.44 },
  'double-exposure': { denoise: 0.44 },
  'myspace-glitter': { denoise: 0.44 },
  'powerpuff-girls': { denoise: 0.6 },
};

export function familyForStyle(style: string): StyleFamily {
  return STYLE_FAMILY[style] ?? 'photo';
}

export function configForStyle(style: string): StyleFamilyConfig {
  const family = familyForStyle(style);
  return { ...FAMILY_CONFIG[family], ...(STYLE_OVERRIDES[style] ?? {}) };
}
