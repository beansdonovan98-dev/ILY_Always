// Client-side list of style keys. The server owns the actual prompts.
export const AI_STYLE_KEYS = [
  'tarot-card',
  'comic-book',
  'anime',
  'adult-anime',
  'cartoon',
  'powerpuff-girls',
  'lego',
  'superhero',
  'figurine',
  'watercolor',
  'realistic',
  'lord-of-the-rings',
  'sticker-pack',
  'change-outfit',
  'pixel-art',
  'ink-illustration',
  'manga-memoir',
  'double-exposure',
  'polaroid',
  'holiday-cards',
  'glitch-art',
  '90s-anime',
  'pixar',
  'posterize',
  'neon-noir',
  'coloring-book',
  'snowglobe',
  'stencil',
  'astrology',
  'color-swap',
  'gameboy',
  'luminescence',
  '20s-era',
  'prism',
  'psychedelic',
  'comic-dot',
  'black-and-white',
  'y2k-film',
  'claymation',
  'plush doll',
  'kawaii-collector',
  'pop-garden',
  'magazine-cover',
  'pokemon-card',
  'south-park',
  'olympian-greek-god',
  'statue',
  'adventure-time',
  'yugioh-card',
  'candle-light',
  'dream-diffusion',
  'playing-card',
  'velvet-glow',
  'polaroid-after-dark',
  'pointillism',
  'plum-and-espresso',
  'walmart-security-cam',
  'alien-abduction-beam',
  'dungeon',
  'myspace-glitter',
  'negative-space-invasion',
  'drawn-to-life',
  'magazine-ransom-note',
  'stained-glass',
  'album-cover',
  'record-vinyl',
  'app-icon',
  'scrapbook',
  'rip-shirt',
  'backwoods-wrapper',
  'post-it-note',
  'post-card',
  'mural',
  'merchandise',
  'graffiti',
  'photobooth',
  '3d-avatar',
  'atla',
  '16-bit-arcade',
  'bobblehead',
  'blueprint',
  'minecraft',
  'mini-me',
  'sketch',
  'paper-people',
  'product-photo',
  'wanted-poster',
  'book-cover',
  'thumbnail',
  'advertisement',
  'billboard',
  'side-of-bus',
  'missing-poster',
  'park-bench',
  'milk-carton',
  'fbi-wanted',
  'perc-in-bong',
  'car-wrap',
] as const;

export type AIStyleKey = typeof AI_STYLE_KEYS[number];

/**
 * Styles whose identity includes a real environment/format. The style pass
 * keeps the subject; this map drives an automatic background pass so the
 * scene changes too. The Background edit row remains free for extras like
 * weed, colours, or the moon.
 */
export type StyleScene = { prompt: string; negative?: string };

export const STYLE_SCENES: Record<string, StyleScene> = {
  '20s-era': {
    prompt:
      '1920s speakeasy interior, art deco architecture, vintage jazz club, ornate wallpaper, brass fixtures, warm tungsten light, sepia photograph, film grain, no modern objects',
    negative: 'castle, fantasy, medieval, neon, modern, futuristic',
  },
  'walmart-security-cam': {
    prompt:
      'big-box retail store interior, fluorescent ceiling lights, long aisles, shelves of products, blue signage, security camera footage, grainy CCTV, timestamp overlay, no neon',
    negative: 'arcade, casino, neon, fantasy, medieval',
  },
  dungeon: {
    prompt:
      'BDSM dungeon, stone walls, leather restraints, whips, bondage gear, dim torchlight, dungeon cell',
    negative: 'outdoors, modern room, bright daylight, castle',
  },
  'neon-noir': {
    prompt: 'rain-soaked cyberpunk street, neon cyan and magenta signs, reflective puddles, dark alley',
    negative: 'daylight, rural, fantasy, medieval',
  },
  'lord-of-the-rings': {
    prompt: 'epic Middle-earth landscape, fantasy castle, dramatic golden hour, cinematic',
    negative: 'modern city, neon, futuristic',
  },
  'olympian-greek-god': {
    prompt: 'Mount Olympus, Greek temple, marble columns, divine golden light',
    negative: 'modern city, neon, futuristic',
  },
  'alien-abduction-beam': {
    prompt: 'dark field at night, UFO tractor beam, teal light, stars',
    negative: 'daylight, city, indoor',
  },
  'park-bench': {
    prompt: 'outdoor park, wooden bench, dappled sunlight, trees',
    negative: 'indoor, room, neon',
  },
  photobooth: {
    prompt: 'vintage photobooth background, curtain, black and white flash',
    negative: 'modern room, neon',
  },
};

export function styleLabel(key: string): string {
  return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
