export type BucketMode =
  | 'realism_composite'
  | 'realism_outfit_nsfw'
  | 'anime_2d_toon'
  | 'toy_3d_sculpt'
  | 'fine_art_medium'
  | 'framed_card'
  | 'macro_object_embed';

export type BucketParams = {
  checkpoint: 'pony' | 'anime';
  controlNet: 'depth' | 'depth_line' | 'anime_line' | 'openpose' | 'none';
  controlNetStrength: number;
  controlNetEndPercent: number;
  /** Lineart leg of a stacked ControlNet pair. */
  lineartStrength?: number;
  lineartEndPercent?: number;
  /** FaceID stops early so the style can own the final surface. */
  faceIdEndAt?: number;
  /** true = img2img from her gray-replaced cutout. */
  initFromSource?: boolean;
  /** Render at portrait 832x1216 instead of the source aspect. */
  portrait?: boolean;
  /** Subject LoRA strength override. */
  loraStrength?: number;
  /** Scale for the subject when padded (0.7 leaves a 15% margin per side). */
  padScale?: number;
  faceIdWeight: number;
  faceIdLoraStrength: number;
  stylePrefix: string;
  negativeAdditions: string;
  /** Extra positive tags appended for this bucket only. */
  extraPositive?: string;
  /** Shrink and center the subject so a container can form around her. */
  padSubject?: boolean;
  /** Blur radius for the color-block latent; 0 = empty latent. */
  blurRadius: number;
  denoise: number;
};

export const BUCKET_PRESETS: Record<BucketMode, BucketParams> = {
  realism_composite: {
    checkpoint: 'pony',
    controlNet: 'none',
    controlNetStrength: 0,
    controlNetEndPercent: 0,
    faceIdWeight: 0.65,
    faceIdLoraStrength: 0.5,
    stylePrefix: 'photorealistic, raw photo, 35mm photograph, detailed skin texture',
    negativeAdditions: 'anime, cartoon, 2d, sketch, drawing, painting, doll, plastic skin',
    blurRadius: 0,
    denoise: 0.65,
  },
  realism_outfit_nsfw: {
    checkpoint: 'pony',
    controlNet: 'depth',
    controlNetStrength: 0.8,
    controlNetEndPercent: 0.6,
    faceIdWeight: 0.65,
    faceIdLoraStrength: 0.5,
    stylePrefix: 'photorealistic, raw photo, 35mm photograph, detailed skin texture',
    negativeAdditions: 'anime, cartoon, 2d, sketch, drawing, painting, doll, plastic skin',
    blurRadius: 0,
    denoise: 0.65,
  },
  anime_2d_toon: {
    checkpoint: 'pony',
    controlNet: 'anime_line',
    controlNetStrength: 0.4,
    controlNetEndPercent: 0.4,
    faceIdWeight: 0.35,
    faceIdLoraStrength: 0.35,
    faceIdEndAt: 0.4,
    loraStrength: 0.85,
    portrait: true,
    stylePrefix: 'source_anime, anime screencap, cel shading, vibrant saturated colors, bold flat color fill, clean 2d linework',
    negativeAdditions:
      'photorealistic, 35mm photograph, detailed skin pores, real person, 3d render, photograph, washed out, desaturated',
    initFromSource: false,
    blurRadius: 0,
    denoise: 1.0,
  },
  toy_3d_sculpt: {
    checkpoint: 'pony',
    controlNet: 'none',
    controlNetStrength: 0,
    controlNetEndPercent: 0,
    faceIdWeight: 0.35,
    faceIdLoraStrength: 0.35,
    faceIdEndAt: 0.4,
    loraStrength: 0.85,
    portrait: true,
    stylePrefix: '3d render, macro collectible figure photography, stylized proportions',
    negativeAdditions: 'real human skin pores, 35mm photograph, flat 2d drawing',
    extraPositive: '(anatomically correct adult collectible figure, explicit nude anatomy:1.15)',
    initFromSource: false,
    blurRadius: 0,
    denoise: 1.0,
  },
  fine_art_medium: {
    checkpoint: 'pony',
    controlNet: 'depth_line',
    controlNetStrength: 0.3,
    controlNetEndPercent: 0.4,
    lineartStrength: 0.55,
    lineartEndPercent: 0.6,
    faceIdWeight: 0.65,
    faceIdLoraStrength: 0.5,
    faceIdEndAt: 0.65,
    stylePrefix: 'traditional media, fine art illustration, heavy canvas and paper texture',
    negativeAdditions:
      'photorealistic, 35mm photograph, detailed skin pores, smooth digital airbrush, 3d render',
    blurRadius: 0,
    denoise: 0.65,
  },
  framed_card: {
    checkpoint: 'pony',
    controlNet: 'none',
    controlNetStrength: 0,
    controlNetEndPercent: 0,
    faceIdWeight: 0.35,
    faceIdLoraStrength: 0.35,
    faceIdEndAt: 0.4,
    loraStrength: 0.85,
    portrait: true,
    stylePrefix: 'centered framed graphic design layout, ornate border composition',
    negativeAdditions: 'cropped border, cut off frame',
    initFromSource: false,
    blurRadius: 0,
    denoise: 1.0,
  },
  macro_object_embed: {
    checkpoint: 'pony',
    controlNet: 'none',
    controlNetStrength: 0,
    controlNetEndPercent: 0,
    faceIdWeight: 0.35,
    faceIdLoraStrength: 0.35,
    faceIdEndAt: 0.4,
    loraStrength: 0.85,
    stylePrefix: 'wide angle macro scene, high detail object composition',
    negativeAdditions: 'close-up selfie, cropped frame',
    initFromSource: false,
    blurRadius: 0,
    denoise: 1.0,
  },
};

export const STYLE_BUCKET: Record<string, BucketMode> = {
  // realism_composite (20)
  realistic: 'realism_composite',
  'double-exposure': 'realism_composite',
  polaroid: 'realism_composite',
  'glitch-art': 'realism_composite',
  'neon-noir': 'realism_composite',
  'color-swap': 'realism_composite',
  luminescence: 'realism_composite',
  '20s-era': 'realism_composite',
  prism: 'realism_composite',
  'black-and-white': 'realism_composite',
  'y2k-film': 'realism_composite',
  'candle-light': 'realism_composite',
  'dream-diffusion': 'realism_composite',
  'velvet-glow': 'realism_composite',
  'polaroid-after-dark': 'realism_composite',
  'plum-and-espresso': 'realism_composite',
  'walmart-security-cam': 'realism_composite',
  'alien-abduction-beam': 'realism_composite',
  'park-bench': 'realism_composite',
  'product-photo': 'realism_composite',

  // realism_outfit_nsfw (5)
  superhero: 'realism_outfit_nsfw',
  'lord-of-the-rings': 'realism_outfit_nsfw',
  'change-outfit': 'realism_outfit_nsfw',
  'olympian-greek-god': 'realism_outfit_nsfw',
  dungeon: 'realism_outfit_nsfw',

  // anime_2d_toon (14)
  'comic-book': 'anime_2d_toon',
  anime: 'anime_2d_toon',
  'adult-anime': 'anime_2d_toon',
  cartoon: 'anime_2d_toon',
  'powerpuff-girls': 'anime_2d_toon',
  'sticker-pack': 'anime_2d_toon',
  'pixel-art': 'anime_2d_toon',
  'manga-memoir': 'anime_2d_toon',
  '90s-anime': 'anime_2d_toon',
  gameboy: 'anime_2d_toon',
  'south-park': 'anime_2d_toon',
  'adventure-time': 'anime_2d_toon',
  atla: 'anime_2d_toon',
  '16-bit-arcade': 'anime_2d_toon',

  // toy_3d_sculpt (12)
  lego: 'toy_3d_sculpt',
  figurine: 'toy_3d_sculpt',
  pixar: 'toy_3d_sculpt',
  claymation: 'toy_3d_sculpt',
  'plush doll': 'toy_3d_sculpt',
  'kawaii-collector': 'toy_3d_sculpt',
  statue: 'toy_3d_sculpt',
  '3d-avatar': 'toy_3d_sculpt',
  bobblehead: 'toy_3d_sculpt',
  minecraft: 'toy_3d_sculpt',
  'mini-me': 'toy_3d_sculpt',
  'paper-people': 'toy_3d_sculpt',

  // fine_art_medium (17)
  watercolor: 'fine_art_medium',
  'ink-illustration': 'fine_art_medium',
  posterize: 'fine_art_medium',
  'coloring-book': 'fine_art_medium',
  stencil: 'fine_art_medium',
  astrology: 'fine_art_medium',
  psychedelic: 'fine_art_medium',
  'comic-dot': 'fine_art_medium',
  'pop-garden': 'fine_art_medium',
  pointillism: 'fine_art_medium',
  'negative-space-invasion': 'fine_art_medium',
  'drawn-to life': 'fine_art_medium',
  'stained-glass': 'fine_art_medium',
  mural: 'fine_art_medium',
  graffiti: 'fine_art_medium',
  blueprint: 'fine_art_medium',
  sketch: 'fine_art_medium',

  // framed_card (22)
  'tarot-card': 'framed_card',
  'holiday-cards': 'framed_card',
  'magazine-cover': 'framed_card',
  'pokemon-card': 'framed_card',
  'yugioh-card': 'framed_card',
  'playing-card': 'framed_card',
  'myspace-glitter': 'framed_card',
  'magazine-ransom-note': 'framed_card',
  'album-cover': 'framed_card',
  'record-vinyl': 'framed_card',
  'app-icon': 'framed_card',
  scrapbook: 'framed_card',
  'backwoods-wrapper': 'framed_card',
  'post-card': 'framed_card',
  photobooth: 'framed_card',
  'wanted-poster': 'framed_card',
  'book-cover': 'framed_card',
  thumbnail: 'framed_card',
  advertisement: 'framed_card',
  'missing-poster': 'framed_card',
  'fbi-wanted': 'framed_card',
  'post-it-note': 'framed_card',

  // macro_object_embed (8)
  snowglobe: 'macro_object_embed',
  'rip-shirt': 'macro_object_embed',
  merchandise: 'macro_object_embed',
  billboard: 'macro_object_embed',
  'side-of-bus': 'macro_object_embed',
  'milk-carton': 'macro_object_embed',
  'perc-in-bong': 'macro_object_embed',
  'car-wrap': 'macro_object_embed',
};

export function bucketForStyle(style: string): BucketMode {
  return STYLE_BUCKET[style] ?? 'realism_composite';
}

export function bucketConfig(style: string): BucketParams {
  return BUCKET_PRESETS[bucketForStyle(style)];
}
