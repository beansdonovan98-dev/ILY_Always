/**
 * Per-style medium overrides applied in pose mode, at token 1 of chunk 1.
 *
 * Source: the 99-style spec. Only the anime bucket is populated so far; the rest of
 * the map can be filled from migration/presets/all-99-style-prompts.json when that
 * file is dropped into the repo.
 *
 * `lead` replaces the shared anime header for that style. `negative` is appended to
 * the pose negatives. Pass-2 denoise numbers in the spec assume a second sampling
 * pass; our pose lane is single-pass, so they are recorded but unused until pass 2
 * is enabled for the bucket.
 */
export type StyleOverride = {
  lead: string;
  negative?: string;
  denoise?: number;
  loraStrength?: number;
};

export const STYLE_OVERRIDES: Record<string, StyleOverride> = {
  // ---- anime / cartoon ----
  'comic-book': {
    lead: '(Comic Style, Comic Art:1.25), (western comic book, american comic, heavy black ink shadows, ben-day dots, halftone print texture:1.35)',
    negative: '(photorealistic, 3d render, smooth gradients, anime cel shading:1.3)',
    denoise: 0.52,
    loraStrength: 0.7,
  },
  anime: {
    lead: '(modern high-budget anime key visual, crisp lineart, clean cel shading, vibrant anime color palette:1.35)',
    negative: '(photorealistic, 3d render, oil painting, blurry, messy lines:1.3)',
    denoise: 0.45,
  },
  'adult-anime': {
    lead: '(mature seinen OVA anime style, detailed glossy cel highlights, dramatic moody shading, sharp expressive linework:1.35)',
    negative: '(chibi, kids cartoon, photorealistic, 3d render, flat vector:1.3)',
    denoise: 0.48,
  },
  gta: {
    lead: '(grand theft auto loading screen art style, 2.5d vector illustration, bold black ink outlines, flat cell shading, high-contrast graphic shadows:1.35)',
    negative: '(3d render, blender, cgi, realistic skin texture, photorealistic, glossy, soft lighting:1.3)',
  },
  cartoon: {
    lead: '(Comic Style, Comic Art:1.25), (modern Western 2D animated series style, bold clean outlines, expressive flat colors, simplified cel shading:1.35)',
    negative: '(photorealistic, 3d render, intricate skin pores, painterly:1.3)',
    denoise: 0.5,
    loraStrength: 0.7,
  },
  'powerpuff-girls': {
    lead: '(powerpuff girls cartoon style, thick bold black contour lines, oversized expressive eyes, ultra-flat geometric color blocks, UPA retro vector:1.35)',
    negative: '(photorealistic, realistic anatomy, gradients, 3d render, fine hatching:1.3)',
    denoise: 0.55,
  },
  'sticker-pack': {
    lead: '(die-cut vinyl sticker illustration, thick white contour border around subject, clean vector lines, vibrant flat pop colors:1.35)',
    negative: '(full background scene, photorealistic, dark shadows, messy sketch:1.3)',
    denoise: 0.55,
  },
  'pixel-art': {
    lead: '(pixel art:1.25), (16-bit pixel art sprite, crisp chunky pixels, dithering, limited retro color palette, pixelated edges:1.35)',
    negative: '(smooth vector, anti-aliasing, photorealistic, 3d render, high resolution:1.3)',
    denoise: 0.6,
    loraStrength: 0.6,
  },
  'manga-memoir': {
    lead: '(Comic Style, Comic Art:1.25), (manga page art, screentone dot patterns, crisp G-pen ink linework, cel shaded colour:1.35)',
    negative: '(3d render, photorealistic, painterly, soft airbrush:1.3)',
    denoise: 0.52,
    loraStrength: 0.7,
  },
  '90s-anime': {
    lead: '(vintage 1990s cel-painted anime screencap, subtle VHS film grain, warm retro color palette, classic hand-inked lineart:1.35)',
    negative: '(modern digital glow, 3d render, CGI, photorealistic:1.3)',
    denoise: 0.45,
  },
  gameboy: {
    lead: '(pixel art:1.25), (retro Nintendo Game Boy screen, 4-color monochrome olive-green palette, dot matrix pixel grid, 8-bit low-res sprite:1.35)',
    negative: '(full color, RGB, smooth shading, high resolution, vector:1.3)',
    denoise: 0.62,
    loraStrength: 0.6,
  },
  'south-park': {
    lead: '(south park style construction paper cutout animation, flat textured craft paper shapes, crude simple geometric limbs, stop-motion paper shadows:1.35)',
    negative: '(smooth digital gradients, realistic anatomy, 3d render, detailed shading:1.3)',
    denoise: 0.58,
  },
  'adventure-time': {
    lead: '(adventure time cartoon style, whimsical bright pastel and primary colors, clean thin ink outlines, simplified noodle-limb cartoon aesthetic:1.35)',
    negative: '(photorealistic, heavy shadows, gritty, 3d render, realistic proportions:1.3)',
    denoise: 0.55,
  },
  atla: {
    lead: '(avatar the last airbender animated style, warm earthy color palette, painterly watercolor-wash backgrounds, clean martial-arts anime linework:1.35)',
    negative: '(photorealistic, neon cyberpunk, 3d render, thick comic ink:1.3)',
    denoise: 0.45,
  },
  '16-bit-arcade': {
    lead: '(pixel art:1.25), (16-bit SNES arcade cabinet sprite art, rich pixel dithering, vibrant arcade palette, crisp pixel grid:1.35)',
    negative: '(smooth vector, airbrushed, photorealistic, 3d render:1.3)',
    denoise: 0.6,
    loraStrength: 0.6,
  },
};
