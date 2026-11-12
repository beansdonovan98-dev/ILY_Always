import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';
import { STYLE_PRESETS } from './stylePresets.ts';
import { configForStyle } from './styleFamilies.ts';
import {
  buildComfyWorkflow,
  buildGeneratedBackgroundWorkflow,
  buildInpaintWorkflow,
  buildBucketStyleWorkflow,
  buildCoupleWorkflow,
  buildRealismCompositeWorkflow,
  buildRealismOutfitWorkflow,
  buildRipShirtWorkflow,
  InpaintMaskSource,
} from './comfyWorkflow.ts';
import {
  bucketConfig,
  bucketForStyle,
  generateFinalOpenCodePayload,
  LORA_FILES,
  loraForSubject,
  type SubjectMode,
} from './styleBuckets.ts';
import { buildBrushMaskPng } from './maskPng.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RUNPOD_BASE = 'https://api.runpod.ai/v2';
const DEFAULT_ENDPOINT = '7ckfcko9p6h503';
const STYLE_FACE_TAGS =
  'natural eye size, symmetrical eyes, realistic face proportions, natural lips, relaxed closed mouth, symmetrical lips, realistic mouth, open eyes, exact same face, exact same body shape, exact same pose, exact same camera angle, natural anatomy, two arms, two legs, two feet, sharp facial details, sharp eyes, same glasses, realistic skin texture';

const ANIME_FACE_TAGS =
  'same face, same glasses, detailed eyes, expressive eyes, anime face, natural anatomy, same body shape, same pose, same camera angle, two arms, two legs, two feet, curvy figure, wide hips, thick thighs, soft stomach, natural belly, natural body proportions, detailed nipples, areola, natural nipples, topless, nude, explicit anatomy';
const BASE_NEGATIVE =
  'score_6, score_5, score_4, deformed, bad anatomy, bad hands, extra limbs, extra feet, duplicate feet, extra foot, extra legs, duplicate legs, third leg, extra body parts, changed pose, different pose, deformed feet, mutated feet, missing fingers, mutated hands, poorly drawn face, asymmetric eyes, blurry, big eyes, anime eyes, asymmetrical eyes, uneven eyes, cross-eyed, lazy eye, deformed eyes, extra pupils, mismatched eyes, weird lips, deformed lips, crooked mouth, mismatched lips, bad teeth, extra lips, open mouth, ugly mouth, botox style mouth, fake mouth';

/** Animagine-style SDXL models use danbooru tags, not Pony score tags. */
const ANIME_NEGATIVE =
  'lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, extra limbs, extra feet, duplicate feet, extra foot, extra legs, third leg, deformed hands, mutated hands, abs, six pack, muscular stomach, defined abs';

/** Background passes must not draw people/limbs into the environment. */
const BACKGROUND_NEGATIVE = `${BASE_NEGATIVE}, people, person, human, body parts, limbs, hands, feet, text, watermark, logo`;

/**
 * NSFW negative used by item/body edits. The base negative bans "open mouth",
 * which directly fights prompts like "cock in her mouth". Keep anatomy hygiene,
 * drop the mouth bans.
 */
const EDIT_NEGATIVE =
  'score_6, score_5, score_4, deformed, bad anatomy, bad hands, extra limbs, extra feet, duplicate feet, extra foot, extra legs, duplicate legs, third leg, extra body parts, changed pose, different pose, deformed feet, mutated feet, missing fingers, mutated hands, poorly drawn face, asymmetric eyes, blurry, big eyes, anime eyes, asymmetrical eyes, uneven eyes, cross-eyed, lazy eye, deformed eyes, extra pupils, mismatched eyes, weird lips, deformed lips, bad teeth';

/** Every prompt the model sees starts with Pony's score tags. */
const PONY_QUALITY = 'score_9, score_8_up, score_7_up';
const ANIME_QUALITY = 'masterpiece, best quality, very aesthetic, absurdres';

type EditTarget = 'background' | 'hair' | 'body' | 'item';

type EditTargetConfig = {
  label: string;
  /** Appended after the user's text so the model knows what it is editing. */
  suffix: string;
  /** SetLatentNoiseMask denoise. Higher = more replacement. */
  denoise: number;
};

const EDIT_TARGETS: Record<EditTarget, EditTargetConfig> = {
  background: {
    label: 'Background',
    suffix: 'detailed background, scenery, environment',
    // Subject-protection + harmonization let the background be fully rewritten
    // from the prompt without repainting the legs/feet.
    denoise: 0.90,
  },
  hair: {
    label: 'Hair',
    suffix: 'detailed hair, hair texture, hairstyle',
    denoise: 0.68,
  },
  body: {
    label: 'Body',
    suffix: 'detailed skin, body detail',
    denoise: 0.72,
  },
  item: {
    label: 'Item',
    suffix: 'replace the existing held object with the described object, detailed object, visible hand holding it, natural fingers, preserve the original hand',
    denoise: 0.86,
  },
};

const EDIT_DENOISE_MIN = 0.3;
const EDIT_DENOISE_MAX = 0.95;

// The style pass must stay a style pass for real photos: enough to grade or
// texture, not enough to redraw her face/body into Pony's cartoon bias.
const STYLE_DENOISE_CAP = 0.35;

/**
 * Photographic / grade / effect styles whose point is the original image.
 * These keep the 0.35 cap so a real photo doesn't drift into Pony's cartoon
 * bias. Art mediums and composition styles use their preset strength instead.
 */
/** Illustration/anime styles get enough strength to actually look drawn. */
const ANIME_STYLES = new Set<string>([
  'anime',
  'adult-anime',
  '90s-anime',
  'cartoon',
  'comic-book',
  'manga-memoir',
  'powerpuff-girls',
  'south-park',
  'adventure-time',
  'atla',
  '16-bit-arcade',
  'pokemon-card',
  'yugioh-card',
]);

const ILLUSTRATION_STYLES = new Set<string>([
  ...ANIME_STYLES,
  'lego',
  'figurine',
  'sticker-pack',
  'pixel-art',
  'ink-illustration',
  'pixar',
  'coloring-book',
  'gameboy',
  'claymation',
  'plush doll',
  'kawaii-collector',
  'bobblehead',
  'minecraft',
  'mini-me',
  'sketch',
  'paper-people',
  '3d-avatar',
  'drawn-to life',
  'stained-glass',
  'posterize',
  'comic-dot',
  'pop-garden',
  'superhero',
]);

const PHOTO_TEXTURE_STYLES = new Set<string>([
  'realistic',
  'black-and-white',
  '20s-era',
  'polaroid',
  'polaroid-after-dark',
  'y2k-film',
  'candle-light',
  'velvet-glow',
  'plum-and-espresso',
  'thumbnail',
  'luminescence',
  'prism',
  'glitch-art',
  'color-swap',
  'double-exposure',
]);

/**
 * Mockups: her image is printed/painted onto a card, bus, car, bong, poster,
 * shirt, wall, etc. These only work if the composition is allowed to change.
 */
const MOCKUP_STYLES = new Set<string>([
  'tarot-card',
  'snowglobe',
  'holiday-cards',
  'magazine-cover',
  'pokemon-card',
  'yugioh-card',
  'playing-card',
  'album-cover',
  'record-vinyl',
  'app-icon',
  'scrapbook',
  'post-it-note',
  'post-card',
  'wanted-poster',
  'fbi-wanted',
  'missing-poster',
  'milk-carton',
  'billboard',
  'side-of-bus',
  'car-wrap',
  'perc-in-bong',
  'backwoods-wrapper',
  'advertisement',
  'book-cover',
  'merchandise',
  'sticker-pack',
  'photobooth',
  'mural',
  'graffiti',
  'rip-shirt',
  'blueprint',
  'magazine-ransom-note',
  'negative-space-invasion',
]);

/** Scene styles that rebuild the environment around her. */
const SCENE_STYLES = new Set<string>([
  'neon-noir',
  'lord-of-the-rings',
  'superhero',
  'pop-garden',
  'dream-diffusion',
  'astrology',
  'dungeon',
  'olympian-greek-god',
  'alien-abduction-beam',
  'park-bench',
  'product-photo',
  'walmart-security-cam',
]);

const INSIDE_OBJECT_STYLES = new Set<string>(['snowglobe', 'perc-in-bong']);

/** Style passes that need to recompose get a little extra push and stronger FaceID. */
function styleDenoise(styleMode: string, _presetDenoise: number): number {
  return configForStyle(styleMode).denoise;
}

function styleFaceIdWeight(styleMode: string): number {
  return configForStyle(styleMode).faceIdWeight;
}

function checkpointForStyle(styleMode: string): string | undefined {
  if (configForStyle(styleMode).checkpoint === 'anime') {
    return Deno.env.get('COMFY_ANIME_CHECKPOINT') || 'SDXL/sd_xl_base_1.0.safetensors';
  }
  return Deno.env.get('COMFY_CHECKPOINT') || undefined;
}

function negativeForStyle(styleMode: string): string {
  return configForStyle(styleMode).negative === 'anime' ? ANIME_NEGATIVE : BASE_NEGATIVE;
}

function stylePromptSuffix(styleMode: string): string {
  const cfg = configForStyle(styleMode);
  if (cfg.quality === 'anime') {
    return ', 2d anime illustration, anime screencap, cel shaded, flat colors, clean lineart';
  }
  if (cfg.mockup && styleMode !== 'rip-shirt' && !INSIDE_OBJECT_STYLES.has(styleMode)) {
    return ', her photo printed on the object as the graphic, recognizable face';
  }
  return '';
}

// Reject blank/1x1/truncated uploads before they reach RunPod and burn GPU time.
const MIN_IMAGE_BASE64_CHARS = 20_000;
const MAX_IMAGE_BASE64_CHARS = 4_000_000;
const MIN_IMAGE_DIMENSION = 64;

// Completed images are written here so the client gets a short signed URL
// instead of a multi-MB base64 JSON body. Falls back to base64 if upload fails.
const STORAGE_BUCKET = 'couple-private';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// If a job row is PENDING with no job_id for this long, the submit request
// probably died before RunPod answered. Allow a later retry to claim it.
const STALE_PENDING_MS = 2 * 60_000;

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type RunpodJob = {
  id?: string;
  status?: string;
  error?: string;
  detail?: string;
  title?: string;
  message?: string;
  output?: unknown;
};

type JobRow = {
  request_id: string;
  job_id: string | null;
  status: string;
  error: string | null;
  couple_id: string | null;
  result_path: string | null;
  variation_token: string | null;
  final_prompt: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeStatus(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

/** 5-char random tag so the same prompt explores different details. */
function makeVariationToken(): string {
  return Math.random().toString(36).slice(2, 7).padEnd(5, '0');
}

function isFailedStatus(status: string): boolean {
  return status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT';
}

function stripDataUrl(value: string): string {
  return value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s/g, '');
}

type ImageInfo = {
  format: 'png' | 'jpeg' | 'webp';
  width?: number;
  height?: number;
};

function base64ToBytes(value: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function imageInfoFromBytes(bytes: Uint8Array): ImageInfo | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A, dimensions at bytes 16-23.
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { format: 'png', width: view.getUint32(16), height: view.getUint32(20) };
  }

  // JPEG: FF D8 FF ... walk markers until a SOF segment with dimensions.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      if (
        marker === 0xd8 || marker === 0xd9 || marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)
      ) {
        i += 2;
        continue;
      }
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (len < 2) break;
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        return { format: 'jpeg', width, height };
      }
      i += 2 + len;
    }
    // Valid JPEG header even if no SOF marker was found in range.
    return { format: 'jpeg' };
  }

  // WebP: RIFF....WEBP. Dimensions are left to the worker.
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { format: 'webp' };
  }

  return null;
}

/** Validates the source image before any paid RunPod request is made. */
function validateInputImage(
  imageBase64: string
): { ok: true; raw: string; mimeType: string } | { ok: false; error: string } {
  // Accept both a raw base64 string and a data:image/...;base64 URL.
  const raw = stripDataUrl(imageBase64);
  if (!raw) return { ok: false, error: 'Missing image data.' };
  if (raw.length < MIN_IMAGE_BASE64_CHARS) {
    return {
      ok: false,
      error: 'The selected image is too small or blank. Pick a normal photo and try again.',
    };
  }
  if (raw.length > MAX_IMAGE_BASE64_CHARS) {
    return {
      ok: false,
      error: 'The selected image is too large for the AI worker. Try a smaller photo or crop it first.',
    };
  }

  const bytes = base64ToBytes(raw);
  if (!bytes || bytes.length < 24) {
    return { ok: false, error: 'The selected file is not a valid image.' };
  }

  const info = imageInfoFromBytes(bytes);
  if (!info) {
    return { ok: false, error: 'The selected file is not a valid JPEG, PNG, or WebP image.' };
  }

  if (
    info.width !== undefined &&
    info.height !== undefined &&
    (info.width < MIN_IMAGE_DIMENSION || info.height < MIN_IMAGE_DIMENSION)
  ) {
    return {
      ok: false,
      error: `The selected image is too small (${info.width}\u00d7${info.height}). Minimum is ${MIN_IMAGE_DIMENSION}\u00d7${MIN_IMAGE_DIMENSION}.`,
    };
  }

  const mimeType = info.format === 'jpeg' ? 'image/jpeg' : `image/${info.format}`;
  return { ok: true, raw, mimeType };
}

async function makeSignedResultUrl(
  db: NonNullable<ReturnType<typeof getDb>>,
  path: string
): Promise<string | null> {
  const { data, error } = await db.storage.from(STORAGE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * worker-vllm-omni / OpenAI-compatible image response:
 *   output.data[0].b64_json
 * Also tolerates the older nested shapes we used to see.
 */
function extractImageB64(output: unknown, depth = 0): string | null {
  if (!output || depth > 4) return null;

  if (typeof output === 'string') {
    if (/^https?:\/\//i.test(output)) return null; // URL-only result: not a b64 payload.
    if (/^data:image/i.test(output)) return stripDataUrl(output);
    if (/^[A-Za-z0-9+/=\s]{200,}$/.test(output)) return stripDataUrl(output);
    return null;
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const hit = extractImageB64(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  if (typeof output === 'object') {
    const obj = output as Record<string, unknown>;

    // Exact shape from the worker: { data: [{ b64_json, url }] }
    if (Array.isArray(obj.data)) {
      for (const item of obj.data) {
        if (item && typeof item === 'object') {
          const b64 = (item as Record<string, unknown>).b64_json;
          if (typeof b64 === 'string' && b64.trim()) return stripDataUrl(b64);
        }
      }
    }

    for (const key of ['b64_json', 'b64', 'base64', 'image', 'images', 'data', 'output']) {
      if (key in obj) {
        const hit = extractImageB64(obj[key], depth + 1);
        if (hit) return hit;
      }
    }
  }

  return null;
}

type ResultImage = {
  b64: string;
  mimeType: string;
};

/** FLUX.2 klein result shape: output.images[0].b64 + mime_type. */
function extractResultImage(output: unknown): ResultImage | null {
  const obj = output as Record<string, unknown> | null;
  if (obj && Array.isArray(obj.images)) {
    for (const item of obj.images) {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const b64 = rec.b64;
        if (typeof b64 === 'string' && b64) {
          const mimeType = typeof rec.mime_type === 'string' && rec.mime_type
            ? rec.mime_type
            : 'image/webp';
          return { b64: stripDataUrl(b64), mimeType };
        }
      }
    }
  }

  // Backward compatibility with the old vLLM shape.
  const old = extractImageB64(output);
  if (old) return { b64: old, mimeType: 'image/png' };
  return null;
}

function mimeFromPath(path: string | null): string {
  if (!path) return 'image/webp';
  if (/\.png$/i.test(path)) return 'image/png';
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
  return 'image/webp';
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

function runpodErrorMessage(job: RunpodJob): string | null {
  if (typeof job.error === 'string' && job.error) return job.error;
  if (typeof job.detail === 'string' && job.detail) return job.detail;
  if (typeof job.message === 'string' && job.message) return job.message;
  if (typeof job.title === 'string' && job.title && job.title !== 'Forbidden') return job.title;
  const out = job.output as Record<string, unknown> | undefined;
  if (out && typeof out === 'object') {
    const msg = out.error ?? out.message ?? out.detail;
    if (typeof msg === 'string' && msg) return msg;
    const workerStatus = out.status;
    if (typeof workerStatus === 'number' && workerStatus >= 400) {
      return `RunPod worker returned status ${workerStatus}. Try a smaller image.`;
    }
    if (typeof workerStatus === 'string' && /^[45]\d\d$/.test(workerStatus)) {
      return `RunPod worker returned status ${workerStatus}. Try a smaller image.`;
    }
  }
  return null;
}

/** Compact view of a ComfyUI node's input spec (combo values included). */
function describeComfyInput(spec: unknown): unknown {
  if (Array.isArray(spec)) {
    if (Array.isArray(spec[0])) return (spec[0] as unknown[]).slice(0, 80);
    return spec[0];
  }
  return typeof spec;
}

function summarizeComfyInputs(inputs?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(inputs ?? {})) out[key] = describeComfyInput(spec);
  return out;
}

function getDb() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function getJobRow(db: ReturnType<typeof getDb>, requestId: string): Promise<JobRow | null> {
  if (!db) return null;
  const { data, error } = await db
    .from('ai_image_jobs')
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) throw new Error(`Could not read ai_image_jobs: ${error.message}`);
  return (data as JobRow | null) ?? null;
}

function publicJob(row: JobRow) {
  return {
    requestId: row.request_id,
    jobId: row.job_id,
    status: normalizeStatus(row.status) || 'PENDING',
  };
}

async function publicJobWithResult(
  db: NonNullable<ReturnType<typeof getDb>>,
  row: JobRow
): Promise<Record<string, unknown>> {
  const base = publicJob(row);
  if (normalizeStatus(row.status) === 'COMPLETED' && row.result_path) {
    const url = await makeSignedResultUrl(db, row.result_path);
    if (url) {
      return { ...base, url, path: row.result_path, mimeType: mimeFromPath(row.result_path) };
    }
  }
  return base;
}

function extractA1111Image(output: unknown): string | null {
  if (!output) return null;
  if (typeof output === 'string') return stripDataUrl(output);

  if (Array.isArray(output)) {
    for (const item of output) {
      const hit = extractA1111Image(item);
      if (hit) return hit;
    }
    return null;
  }

  if (typeof output === 'object') {
    const obj = output as Record<string, unknown>;
    if (typeof obj.image === 'string') return stripDataUrl(obj.image);
    if (Array.isArray(obj.images) && typeof obj.images[0] === 'string') {
      return stripDataUrl(obj.images[0]);
    }
    if (Array.isArray(obj.data) && obj.data[0] && typeof obj.data[0] === 'object') {
      const rec = obj.data[0] as Record<string, unknown>;
      if (typeof rec.b64_json === 'string') return stripDataUrl(rec.b64_json);
    }
    for (const key of ['output', 'data', 'result']) {
      if (key in obj) {
        const hit = extractA1111Image(obj[key]);
        if (hit) return hit;
      }
    }
  }

  return extractImageB64(output);
}

function buildStylePrompt(prefix: string, userPrompt: string, styleMode?: string): string {
  // Style pass: the preset leads. Per-region text belongs to the inpaint passes.
  let prompt = prefix.trim();
  if (styleMode && configForStyle(styleMode).quality === 'anime') {
    prompt = prompt.replace(/^score_9,\s*score_8_up,\s*score_7_up,\s*/i, '');
    prompt += ', masterpiece, best quality, very aesthetic, absurdres';
  }
  const extra = userPrompt.trim();
  if (extra) prompt += `, ${extra}`;
  // The presets already include these, but keep the guarantee for custom styles.
  if (!/rating_explicit/i.test(prompt)) prompt += ', rating_explicit';
  if (!/explicit anatomical details/i.test(prompt)) prompt += ', explicit anatomical details';
  return prompt;
}

function normalizeEditTarget(value: string): EditTarget | null {
  const target = value.trim().toLowerCase();
  return target === 'background' || target === 'hair' || target === 'body' || target === 'item'
    ? target
    : null;
}

/**
 * The style prefix without Pony's boilerplate tags, so inpaint passes can
 * reuse it without duplicating score/NSFW tags.
 */
function styleTagsForEdit(styleMode: string): string {
  const preset = STYLE_PRESETS[styleMode];
  if (!preset) return '';
  let tags = preset.prefix
    .replace(/score_9,\s*score_8_up,\s*score_7_up,\s*/i, '')
    .replace(/rating_explicit,?/gi, '')
    .replace(/explicit anatomical details,?/gi, '')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim();
  if (configForStyle(styleMode).quality === 'anime') tags += ', anime style, cel shaded, clean lineart';
  return tags;
}

function buildBackgroundPrompt(userPrompt: string): string {
  // Background edits need scene-level wording, not just a noun.
  return `${userPrompt.trim()}, wide establishing shot, full environment, immersive scene, detailed scenery, atmospheric depth, realistic perspective, cinematic lighting, high detail`;
}

function nsfwTagsForEdit(target: EditTarget, userPrompt: string): string {
  // Every pass is explicit. Anatomical detail is only needed when the edit
  // actually touches the body or adds something explicit.
  let tags = 'rating_explicit';
  const touchesAnatomy =
    target === 'body' ||
    target === 'item' ||
    /\b(tattoo|nipple|breast|pussy|ass|cock|dick|penis|nude|naked|anatomy|mouth|throat)\b/i.test(userPrompt);
  if (touchesAnatomy) tags += ', explicit anatomical details';
  return tags;
}

function buildEditPrompt(target: EditTarget, userPrompt: string, styleMode: string): string {
  const config = EDIT_TARGETS[target];
  const style = styleTagsForEdit(styleMode);
  // NSFW tags go early so a long style prefix can never push them past CLIP's
  // 77-token cutoff. User text stays near the front because the model weights
  // early tokens heavily; the style tags follow so the repaint matches the photo.
  const quality = configForStyle(styleMode).quality === 'anime' ? ANIME_QUALITY : PONY_QUALITY;
  const promptText = target === 'background' ? buildBackgroundPrompt(userPrompt) : userPrompt.trim();
  const parts = [quality, nsfwTagsForEdit(target, userPrompt), promptText];
  if (style) parts.push(style);
  parts.push(config.suffix);
  return parts.join(', ');
}

function negativeForEdit(target: EditTarget, userPrompt: string, styleMode?: string): string {
  // Mouth edits must not be told "no open mouth".
  const mouthEdit = /\b(mouth|lips|face|throat|cock|dick|penis|blunt|joint|bong|strapon)\b/i.test(userPrompt);
  const base =
    styleMode && configForStyle(styleMode).negative === 'anime'
      ? ANIME_NEGATIVE
      : target === 'item' || mouthEdit
        ? EDIT_NEGATIVE
        : BASE_NEGATIVE;
  return target === 'background' ? `${base}, people, person, human, body parts, limbs, hands, feet, text, watermark` : base;
}

function clampEditDenoise(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(EDIT_DENOISE_MAX, Math.max(EDIT_DENOISE_MIN, num));
}

function editTargetConfig(target: EditTarget): EditTargetConfig {
  return EDIT_TARGETS[target];
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

let comfyUrlCache: { url: string; at: number } | null = null;

/** Prefer a key that can read pods, then any available Runpod key. */
function podApiKey(): string {
  const key =
    Deno.env.get('RUNPOD_CONTROL_KEY') ||
    Deno.env.get('RUNPOD_DISCOVERY_KEY') ||
    Deno.env.get('RUNPOD_API_KEY');
  if (!key) {
    throw new Error(
      'No Runpod key is available for pod control. Set RUNPOD_DISCOVERY_KEY (pods:read) or RUNPOD_CONTROL_KEY (pods:write).'
    );
  }
  return key;
}

async function listRunpodPods(): Promise<Array<Record<string, unknown>>> {
  const key = podApiKey();

  const listPods = async (url: string): Promise<Array<Record<string, unknown>>> => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    const parsed = JSON.parse(text) as { pods?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
    return Array.isArray(parsed) ? parsed : parsed.pods || [];
  };

  try {
    return await listPods('https://api.runpod.io/v2/pods?limit=100');
  } catch (v2Error) {
    // Some keys are scoped to serverless only on v2; the legacy v1 list often
    // still returns the account's pods.
    try {
      return await listPods('https://rest.runpod.io/v1/pods');
    } catch (v1Error) {
      // Last resort: the GraphQL API uses the same key but a different scope
      // check, and older full-access keys still work there.
      try {
        const gqlRes = await fetch(`https://api.runpod.io/graphql?api_key=${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: '{ myself { pods { id name desiredStatus imageName } } }',
          }),
        });
        const gqlText = await gqlRes.text();
        if (!gqlRes.ok) throw new Error(`HTTP ${gqlRes.status}: ${gqlText.slice(0, 200)}`);
        const gql = JSON.parse(gqlText) as {
          data?: { myself?: { pods?: Array<Record<string, unknown>> } };
          errors?: Array<{ message?: string }>;
        };
        if (gql.errors?.length) throw new Error(gql.errors.map((e) => e.message).join('; '));
        const pods = gql.data?.myself?.pods || [];
        if (pods.length === 0) throw new Error('GraphQL returned no pods.');
        return pods;
      } catch (gqlError) {
        throw new Error(
          `Could not list Runpod pods. Set RUNPOD_DISCOVERY_KEY to a Runpod key with pods:read, or set RUNPOD_COMFY_URL to the current pod URL. (v2 ${
            v2Error instanceof Error ? v2Error.message : String(v2Error)
          }; v1 ${v1Error instanceof Error ? v1Error.message : String(v1Error)}; graphql ${
            gqlError instanceof Error ? gqlError.message : String(gqlError)
          })`
        );
      }
    }
  }
}

function podExposes8188(pod: Record<string, unknown>): boolean {
  return (Array.isArray(pod.ports) ? pod.ports : []).some((port) => String(port).startsWith('8188/'));
}

function podImage(pod: Record<string, unknown>): string {
  return String(pod.image ?? pod.imageName ?? '');
}

function podStatus(pod: Record<string, unknown>): string {
  return String(pod.status ?? pod.desiredStatus ?? '').toUpperCase();
}

function podUrl(pod: Record<string, unknown>): string {
  return `https://${String(pod.id)}-8188.proxy.runpod.net`;
}

/**
 * A restarted Runpod Pod gets a new id and therefore a new proxy hostname.
 * Listing the account's running pods keeps the editor working without editing
 * a secret after every restart. Set RUNPOD_COMFY_URL to a URL to pin one.
 */
async function discoverComfyUrl(): Promise<string> {
  const pods = await listRunpodPods();
  const running = pods.filter((pod) => podStatus(pod) === 'RUNNING');
  const comfy =
    running.find((pod) => /comfyui/i.test(podImage(pod)) && podExposes8188(pod)) ||
    running.find(podExposes8188);

  if (!comfy) {
    throw new Error('No running ComfyUI pod found. Start the ComfyUI pod, then try again.');
  }
  return podUrl(comfy);
}

async function runpodPodAction(
  id: string,
  action: 'start' | 'stop'
): Promise<Record<string, unknown>> {
  const key = podApiKey();
  const res = await fetch(`https://api.runpod.io/v2/pods/${encodeURIComponent(id)}/action`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Runpod ${action} failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Status / stop / start for the ComfyUI pod, used by the in-app kill switch. */
async function handleComfyPod(body: Record<string, unknown>): Promise<Response> {
  const command = String(body.command ?? 'status').trim().toLowerCase();
  if (command === 'stop' || command === 'start') {
    if (String(body.confirm ?? '') !== command) {
      return json(400, { error: `Send confirm: "${command}" to ${command} the pod.` });
    }
  }

  const pods = await listRunpodPods();
  const comfyPods = pods.filter((pod) => /comfyui/i.test(podImage(pod)) || podExposes8188(pod));
  const summary = comfyPods.map((pod) => ({
    id: String(pod.id ?? ''),
    name: String(pod.name ?? ''),
    status: podStatus(pod),
    url: podExposes8188(pod) ? podUrl(pod) : null,
    createdAt: pod.createdAt ?? null,
  }));

  if (command === 'status') {
    const running = summary.filter((pod) => pod.status === 'RUNNING');
    return json(200, { running: running.length > 0, pods: summary });
  }

  if (command === 'probe') {
    // Harmless permission check: stop on an EXITED pod is rejected with 409
    // when the key has pods:write, and 403 when it does not.
    const target = comfyPods[0];
    if (!target) return json(200, { ok: false, error: 'No ComfyUI pod found.' });
    try {
      await runpodPodAction(String(target.id), 'stop');
      return json(200, { ok: true, note: 'Stop action accepted.' });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return json(200, {
        ok: /HTTP 409/.test(message),
        error: message,
        note: /HTTP 409/.test(message) ? 'Key can write pods (409 = already stopped).' : 'Check pods:write on the key.',
      });
    }
  }

  if (command === 'stop') {
    const running = comfyPods.filter((pod) => podStatus(pod) === 'RUNNING');
    if (running.length === 0) {
      return json(200, { status: 'EXITED', message: 'No running ComfyUI pod.', pods: summary });
    }
    const target = running[0];
    const updated = await runpodPodAction(String(target.id), 'stop');
    comfyUrlCache = null;
    return json(200, {
      status: String(updated.status ?? 'EXITED'),
      podId: target.id,
      pods: summary,
    });
  }

  if (command === 'start') {
    const stopped = comfyPods
      .filter((pod) => ['EXITED', 'ERROR'].includes(podStatus(pod)))
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
    if (stopped.length === 0) {
      return json(200, { status: 'NONE', message: 'No stopped ComfyUI pod to start.', pods: summary });
    }
    const target = stopped[0];
    try {
      const updated = await runpodPodAction(String(target.id), 'start');
      comfyUrlCache = null;
      return json(200, {
        status: String(updated.status ?? 'STARTING'),
        podId: target.id,
        pods: summary,
      });
    } catch (e) {
      return json(502, {
        error: e instanceof Error ? e.message : String(e),
        status: podStatus(target),
        podId: target.id,
      });
    }
  }

  return json(400, { error: 'command must be status, stop, or start.' });
}

async function comfyBaseUrl(): Promise<string> {
  const raw = (Deno.env.get('RUNPOD_COMFY_URL') || '').trim();
  if (raw && raw.toLowerCase() !== 'auto') return raw.replace(/\/+$/, '');
  if (comfyUrlCache && Date.now() - comfyUrlCache.at < 60_000) return comfyUrlCache.url;
  const url = await discoverComfyUrl();
  comfyUrlCache = { url, at: Date.now() };
  return url;
}

async function uploadBytesToComfy(
  bytes: Uint8Array,
  mimeType: string,
  prefix: string
): Promise<string> {
  const ext =
    mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const form = new FormData();
  form.append('image', new Blob([bytes as unknown as BlobPart], { type: mimeType }), `${prefix}-${Date.now()}.${ext}`);
  form.append('overwrite', 'true');

  const res = await fetch(`${await comfyBaseUrl()}/upload/image`, { method: 'POST', body: form });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ComfyUI upload failed (HTTP ${res.status}): ${text.slice(0, 500)}`);
  }

  let data: { name?: string; subfolder?: string } = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (!data.name) throw new Error('ComfyUI upload returned no filename.');
  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
}

/** Upload the source photo to ComfyUI and return the filename its LoadImage node expects. */
async function uploadImageToComfy(imageBase64: string): Promise<string> {
  const imageCheck = validateInputImage(imageBase64);
  if (!imageCheck.ok) throw new Error(imageCheck.error);

  const bytes = base64ToBytes(imageCheck.raw);
  if (!bytes) throw new Error('Could not decode the image.');

  return uploadBytesToComfy(bytes, imageCheck.mimeType, 'upload');
}

type ComfyImage = { filename: string; subfolder?: string; type?: string };
type ComfyHistoryEntry = {
  outputs?: Record<string, { images?: ComfyImage[] }>;
  status?: { status_str?: string; messages?: unknown[]; completed?: boolean };
  /** ComfyUI stores [number, apiPrompt, extraData, outputsToExecute] here. */
  prompt?: unknown;
};

function findComfyOutputImage(outputs: ComfyHistoryEntry['outputs']): ComfyImage | null {
  if (!outputs) return null;
  for (const node of Object.values(outputs)) {
    const image = node?.images?.find((item) => Boolean(item?.filename));
    if (image) return image;
  }
  return null;
}

/** FaceID hard-fails when InsightFace cannot find a face. That is recoverable. */
function isNoFaceError(text: string): boolean {
  return /no\s*face\s*detected|insightface[^"]*face|face[^"]*not\s*detected/i.test(text);
}

/**
 * ComfyUI history puts the graph inside the `prompt` tuple. Depending on the
 * version the tuple is [number, graph, ...] or [number, promptId, graph, ...],
 * so pick the first object that actually looks like a ComfyUI graph.
 */
function findWorkflowInPrompt(prompt: unknown): Record<string, unknown> | null {
  const candidates = Array.isArray(prompt) ? prompt : [prompt];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const nodes = Object.values(candidate as Record<string, unknown>);
    if (nodes.some((node) => node && typeof node === 'object' && 'class_type' in (node as object))) {
      return candidate as Record<string, unknown>;
    }
  }
  return null;
}

/**
 * Remove the FaceID branch (nodes 85/86) and feed the checkpoint model straight
 * into KSampler. Returns null when the prompt has no FaceID branch to remove.
 */
/**
 * Names the app uses for her. Only `ashley` is the LoRA trigger and the only one
 * that belongs in an image prompt — the rest are app/chat aliases. Feeding
 * "princess" or "kitten" to Pony would summon a crown or a cat, not her.
 */
const SUBJECT_ALIASES = [
  'ashley',
  'princess',
  'budzie',
  'mommy',
  'wifey',
  'good girl',
  'kitten',
];
const SUBJECT_TRIGGER = 'ashley';

/**
 * Golden-standard seed, locked from ily_retry-1794485964. Stylized buckets default
 * to this so composition, framing, hair and glasses stay reproducible. Realism
 * keeps a random seed because those graphs are driven by the source photo.
 */
const GOLDEN_SEED = 300661729;

/**
 * Fallback physical traits when the client sends none. The LoRA was trained on
 * both glasses and no-glasses photos, so the glasses only appear if they are in
 * the prompt — nothing about them is baked into the weights.
 */
const DEFAULT_SUBJECT_TRAITS: Record<SubjectMode, string> = {
  wife: '',
  husband: '',
  couple: '',
};

/**
 * Per-style negative guardrails. These exist because a soft-gradient source image
 * plus a low denoise lets a style collapse into its neighbour: pointillism bleeds
 * into watercolour, stencil into poster art, and so on.
 */
const STYLE_NEGATIVE_GUARDRAILS: Record<string, string> = {
  // Empty on purpose: the pointillism guardrail made the dots bead on skin and
  // flattened her face. v6 (no per-style guardrail) is the locked baseline.
};

  // Per-style positive nudges that a bucket-wide anchor cannot express.
const STYLE_POSITIVE_NUDGES: Record<string, string> = {};

/**
 * Injects the trained subject LoRA into any built workflow by rewiring the
 * checkpoint's MODEL and CLIP outputs through a LoraLoader. VAE stays direct.
 * This is applied to every generation path, not just the benchmark router.
 */
function applySubjectLora(
  workflow: Record<string, unknown>,
  loraName: string,
  strength: number
): Record<string, unknown> {
  const ckptId = Object.keys(workflow).find(
    (k) => (workflow[k] as { class_type?: string })?.class_type === 'CheckpointLoaderSimple'
  );
  if (!ckptId) return workflow;

  // Already loaded (e.g. a bucket builder added it) — do not stack a second LoRA.
  const already = Object.values(workflow).some(
    (n) =>
      (n as { class_type?: string })?.class_type === 'LoraLoader' &&
      (n as { inputs?: { lora_name?: string } })?.inputs?.lora_name === loraName
  );
  if (already) return workflow;

  const loraId = 'lora_subject';
  workflow[loraId] = {
    class_type: 'LoraLoader',
    inputs: {
      model: [ckptId, 0],
      clip: [ckptId, 1],
      lora_name: loraName,
      strength_model: strength,
      strength_clip: strength,
    },
  };

  for (const node of Object.values(workflow)) {
    const inputs = (node as { inputs?: Record<string, unknown> })?.inputs;
    if (!inputs) continue;
    for (const key of Object.keys(inputs)) {
      const ref = inputs[key];
      if (Array.isArray(ref) && ref[0] === ckptId && (ref[1] === 0 || ref[1] === 1)) {
        inputs[key] = [loraId, ref[1]];
      }
    }
  }
  return workflow;
}

function subjectLoraName(): string {
  return Deno.env.get('COMFY_SUBJECT_LORA') || 'ashley_v1_1200_steps_00001_.safetensors';
}

function withoutFaceId(prompt: unknown): Record<string, unknown> | null {
  const candidate = findWorkflowInPrompt(prompt);
  if (!candidate) return null;

  const workflow = JSON.parse(JSON.stringify(candidate)) as Record<string, unknown>;

  // Collect every FaceID applier BEFORE deleting the loader, otherwise refs to
  // the appliers are left dangling and the retry fails validation.
  const faceIdAppliers = new Set<string>();
  for (const [nodeId, node] of Object.entries(workflow)) {
    const classType = (node as { class_type?: string })?.class_type;
    if (classType === 'IPAdapterFaceID' || classType === 'IPAdapterAdvanced') {
      faceIdAppliers.add(nodeId);
    }
  }

  let removed = false;
  for (const nodeId of ['85', '86']) {
    if (nodeId in workflow) {
      delete workflow[nodeId];
      removed = true;
    }
  }
  if (!removed) return null;

  for (const nodeId of faceIdAppliers) {
    delete workflow[nodeId];
  }

  const loraNodeId = Object.keys(workflow).find((k) =>
    ((workflow[k] as { class_type?: string })?.class_type || '').includes('Lora')
  );
  const modelFallback: [string, number] = loraNodeId ? [loraNodeId, 0] : ['72', 0];

  for (const node of Object.values(workflow)) {
    const inputs = (node as { inputs?: Record<string, unknown> })?.inputs;
    if (!inputs) continue;
    for (const key of ['model', 'positive', 'negative']) {
      const ref = inputs[key];
      if (Array.isArray(ref) && faceIdAppliers.has(String(ref[0]))) {
        inputs[key] = modelFallback;
      }
    }
  }

  return workflow;
}

async function handleStyleStart(
  requestId: string,
  imageBase64: string,
  styleMode: string,
  userPrompt: string,
  coupleId: string,
  overrides?: {
    denoise?: number;
    faceIdWeight?: number;
    depthStrength?: number;
    subject?: SubjectMode;
    isNude?: boolean;
    backgroundPrompt?: string;
    poseImageBase64?: string;
    subjectTraits?: string;
    seed?: number;
    wide?: boolean;
    bodyTags?: string;
  }
): Promise<Response> {
  const db = getDb();
  if (!db) {
    return json(500, {
      error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not available to the Edge Function.',
    });
  }

  const preset = STYLE_PRESETS[styleMode] || STYLE_PRESETS['tarot-card'];
  const effectivePrompt = userPrompt.trim();
  // Photo/texture styles stay at 0.35; mockup/scene/character styles use their
  // designed strength so the style actually does what its name says.
  const denoiseOverride = Number(overrides?.denoise);
  const denoise =
    Number.isFinite(denoiseOverride) && denoiseOverride > 0
      ? Math.min(0.9, Math.max(0.2, denoiseOverride))
      : styleDenoise(styleMode, preset.denoising);
  const faceIdOverride = Number(overrides?.faceIdWeight);
  const faceIdWeight =
    Number.isFinite(faceIdOverride) && faceIdOverride > 0
      ? Math.min(1, Math.max(0.1, faceIdOverride))
      : styleFaceIdWeight(styleMode);

  const imageCheck = validateInputImage(imageBase64);
  if (!imageCheck.ok) return json(400, { error: imageCheck.error });

  // Primary-key dedupe: a retry with the same request_id must not submit twice.
  const { data: inserted, error: insertError } = await db
    .from('ai_image_jobs')
    .insert({ request_id: requestId, status: 'PENDING', couple_id: coupleId || null })
    .select('*')
    .maybeSingle();

  let row = (inserted as JobRow | null) ?? null;

  if (insertError && insertError.code !== '23505') {
    return json(500, { error: `Could not create AI job: ${insertError.message}` });
  }

  if (!row) {
    row = await getJobRow(db, requestId);
    if (!row) return json(500, { error: 'AI job disappeared while being created.' });

    if (row.job_id || row.status === 'COMPLETED' || isFailedStatus(row.status)) {
      if (isFailedStatus(row.status)) {
        return json(200, {
          requestId,
          jobId: row.job_id,
          status: 'FAILED',
          error: row.error || 'ComfyUI job failed.',
        });
      }
      return json(200, { requestId, jobId: row.job_id, status: row.status });
    }

    const updatedAt = Date.parse(row.updated_at || row.created_at);
    const stale = !Number.isFinite(updatedAt) || Date.now() - updatedAt > STALE_PENDING_MS;
    if (!stale) {
      return json(200, { requestId, jobId: null, status: 'PENDING' });
    }

    await db
      .from('ai_image_jobs')
      .update({ status: 'PENDING', error: null, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);
  }

  try {
    const imageName = await uploadImageToComfy(imageCheck.raw);

    // The app path now runs the same 98-style bucket system as the benchmark,
    // instead of the legacy STYLE_PRESETS family config.
    const cfg = bucketConfig(styleMode);
    const subject: SubjectMode = overrides?.subject ?? 'wife';
    const isNude = overrides?.isNude !== false;
    const backgroundPrompt = (overrides?.backgroundPrompt ?? '').trim() || effectivePrompt;
    const subjectTraits =
      (overrides?.subjectTraits ?? '').trim() || DEFAULT_SUBJECT_TRAITS[subject];
    const wide = overrides?.wide === true;
    const payload = generateFinalOpenCodePayload(
      styleMode,
      subject,
      isNude,
      backgroundPrompt,
      subjectTraits,
      wide
    );

    // Optional pose reference: uploaded and fed to OpenPose so the body adopts
    // that skeleton while the LoRA and style keep her face and the medium.
    let poseImage: string | undefined;
    if (overrides?.poseImageBase64) {
      const poseCheck = validateInputImage(overrides.poseImageBase64);
      if (poseCheck.ok) poseImage = await uploadImageToComfy(poseCheck.raw);
    }
    const width = wide ? 1216 : cfg.portrait ? 832 : 1024;
    const height = wide ? 832 : cfg.portrait ? 1216 : 1024;
    const bodyTags = (overrides?.bodyTags ?? '').replace(/[{}]/g, '').trim().slice(0, 160);
    const positive = bodyTags ? `${payload.positive}, ${bodyTags}` : payload.positive;
    const isAnimeBucket = bucketForStyle(styleMode) === 'anime_2d_toon';
    const baseNeg = [BASE_NEGATIVE, payload.negative].filter(Boolean).join(', ');
    // "big eyes, anime eyes" in the negative actively fights source_anime, so they
    // are stripped for 2d buckets only and kept everywhere else.
    const negative = isAnimeBucket
      ? baseNeg.replace(/,?\s*big eyes/gi, '').replace(/,?\s*anime eyes/gi, '')
      : baseNeg;

    const common = {
      imageName,
      positive,
      negative,
      seed:
        Number.isFinite(Number(overrides?.seed)) && Number(overrides?.seed) > 0
          ? Number(overrides?.seed)
          : bucketForStyle(styleMode) === 'realism_composite' ||
              bucketForStyle(styleMode) === 'realism_outfit_nsfw'
            ? Math.floor(Math.random() * 2_147_483_647)
            : GOLDEN_SEED,
      filenamePrefix: `ily_${requestId}`,
      checkpoint: Deno.env.get('COMFY_CHECKPOINT') || undefined,
      width,
      height,
    };

    let workflow: Record<string, unknown>;
    if (bucketForStyle(styleMode) !== 'realism_composite') {
      workflow = buildBucketStyleWorkflow({
        ...common,
        controlNet: poseImage ? 'openpose' : cfg.controlNet,
        poseImage,
        controlNetStrength: wide ? 0.32 : cfg.controlNetStrength,
        controlNetEndPercent: wide ? 0.45 : cfg.controlNetEndPercent,
        lineartStrength: cfg.lineartStrength,
        lineartEndPercent: cfg.lineartEndPercent,
        faceIdWeight:
          Number.isFinite(Number(overrides?.faceIdWeight)) && Number(overrides?.faceIdWeight) > 0
            ? Number(overrides?.faceIdWeight)
            : cfg.faceIdWeight,
        faceIdLoraStrength: cfg.faceIdLoraStrength,
        faceIdEndAt: cfg.faceIdEndAt,
        faceIdProvider: Deno.env.get('COMFY_FACEID_PROVIDER') || 'CPU',
        initFromSource: cfg.initFromSource,
        denoise: cfg.denoise,
        loraName: LORA_FILES.wife,
        loraStrength: cfg.loraStrength,
        loraClipStrength: cfg.loraClipStrength,
        useFaceId: cfg.useFaceId,
        cfgScale: cfg.cfgScale,
        neonSign: (Deno.env.get('COMFY_EASTER_EGG') ?? '1') !== '0',
      });
    } else if (bucketForStyle(styleMode) === 'realism_outfit_nsfw') {
      workflow = buildRealismOutfitWorkflow({ ...common, editPositive: payload.positive });
    } else {
      workflow = buildRealismCompositeWorkflow(common);
    }

    const promptRes = await fetch(`${await comfyBaseUrl()}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: applySubjectLora(workflow, subjectLoraName(), 0.7),
        client_id: crypto.randomUUID(),
      }),
    });
    const promptText = await promptRes.text();

    if (!promptRes.ok) {
      throw new Error(`ComfyUI rejected the workflow (HTTP ${promptRes.status}): ${promptText.slice(0, 1000)}`);
    }

    let promptData: { prompt_id?: string; error?: unknown; node_errors?: unknown } = {};
    try {
      promptData = JSON.parse(promptText);
    } catch {
      promptData = {};
    }
    if (!promptData.prompt_id) {
      throw new Error(`ComfyUI returned no prompt_id: ${promptText.slice(0, 1000)}`);
    }

    await db
      .from('ai_image_jobs')
      .update({
        job_id: promptData.prompt_id,
        status: 'IN_PROGRESS',
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('request_id', requestId);

    return json(200, { requestId, jobId: promptData.prompt_id, status: 'IN_PROGRESS' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db
      .from('ai_image_jobs')
      .update({ status: 'FAILED', error: message, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);
    return json(502, { requestId, status: 'FAILED', error: message });
  }
}

type ResolvedImage = { bytes: Uint8Array; mimeType: string; width?: number; height?: number };

function validateImageBytes(bytes: Uint8Array): { ok: true; mimeType: string } | { ok: false; error: string } {
  if (bytes.length < 24) return { ok: false, error: 'The source image is empty or truncated.' };
  const info = imageInfoFromBytes(bytes);
  if (!info) return { ok: false, error: 'The source image is not a valid JPEG, PNG, or WebP.' };
  if (
    info.width !== undefined &&
    info.height !== undefined &&
    (info.width < MIN_IMAGE_DIMENSION || info.height < MIN_IMAGE_DIMENSION)
  ) {
    return {
      ok: false,
      error: `The source image is too small (${info.width}\u00d7${info.height}).`,
    };
  }
  return { ok: true, mimeType: info.format === 'jpeg' ? 'image/jpeg' : `image/${info.format}` };
}

/** Accepts either uploaded base64 or the signed URL of a previous pass. */
async function resolveSourceImage(body: Record<string, unknown>): Promise<ResolvedImage> {
  const rawBase64 = String(body.imageBase64 ?? body.image_base64 ?? '').trim();

  if (rawBase64) {
    const check = validateInputImage(rawBase64);
    if (!check.ok) throw new Error(check.error);
    const bytes = base64ToBytes(check.raw);
    if (!bytes) throw new Error('Could not decode the image.');
    const info = imageInfoFromBytes(bytes);
    return { bytes, mimeType: check.mimeType, width: info?.width, height: info?.height };
  }

  const url = String(body.imageUrl ?? body.image_url ?? '').trim();
  if (!url) throw new Error('Missing imageUrl or imageBase64.');

  let bytes: Uint8Array;
  let mimeType = 'image/png';

  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;,]+)[;,]/i);
    mimeType = match?.[1] || 'image/png';
    const decoded = base64ToBytes(stripDataUrl(url));
    if (!decoded) throw new Error('Could not decode the image data URL.');
    bytes = decoded;
  } else if (/^https?:\/\//i.test(url)) {
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    } catch (e) {
      throw new Error(`Could not download the previous pass: ${String(e)}`);
    }
    if (!res.ok) throw new Error(`Could not download the previous pass (HTTP ${res.status}).`);
    bytes = new Uint8Array(await res.arrayBuffer());
    mimeType = (res.headers.get('content-type') || 'image/png').split(';')[0].trim();
  } else {
    throw new Error('imageUrl must be an http(s) or data: URL.');
  }

  const check = validateImageBytes(bytes);
  if (!check.ok) throw new Error(check.error);
  const info = imageInfoFromBytes(bytes);
  return { bytes, mimeType, width: info?.width, height: info?.height };
}

async function submitComfyWorkflow(
  db: NonNullable<ReturnType<typeof getDb>>,
  requestId: string,
  workflow: Record<string, unknown>
): Promise<string> {
  const promptRes = await fetch(`${await comfyBaseUrl()}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: crypto.randomUUID() }),
  });
  const promptText = await promptRes.text();

  if (!promptRes.ok) {
    throw new Error(`ComfyUI rejected the workflow (HTTP ${promptRes.status}): ${promptText.slice(0, 1000)}`);
  }

  let promptData: { prompt_id?: string } = {};
  try {
    promptData = JSON.parse(promptText);
  } catch {
    promptData = {};
  }
  if (!promptData.prompt_id) {
    throw new Error(`ComfyUI returned no prompt_id: ${promptText.slice(0, 1000)}`);
  }

  await db
    .from('ai_image_jobs')
    .update({
      job_id: promptData.prompt_id,
      status: 'IN_PROGRESS',
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('request_id', requestId);

  return promptData.prompt_id;
}

async function handleInpaintStart(
  requestId: string,
  body: Record<string, unknown>,
  coupleId: string
): Promise<Response> {
  const db = getDb();
  if (!db) {
    return json(500, {
      error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not available to the Edge Function.',
    });
  }

  const targetRaw = String(body.target ?? '').trim();
  const target = normalizeEditTarget(targetRaw);
  if (!target) {
    return json(400, { error: 'target must be background, hair, body, or item.' });
  }

  const userPrompt = String(body.prompt ?? '').trim();
  if (!userPrompt) return json(400, { error: 'Missing prompt for this edit.' });

  let source: ResolvedImage;
  try {
    source = await resolveSourceImage(body);
  } catch (e) {
    return json(400, { error: e instanceof Error ? e.message : String(e) });
  }

  const imageCheck = validateImageBytes(source.bytes);
  if (!imageCheck.ok) return json(400, { error: imageCheck.error });

  const { data: inserted, error: insertError } = await db
    .from('ai_image_jobs')
    .insert({ request_id: requestId, status: 'PENDING', couple_id: coupleId || null })
    .select('*')
    .maybeSingle();

  let row = (inserted as JobRow | null) ?? null;

  if (insertError && insertError.code !== '23505') {
    return json(500, { error: `Could not create AI job: ${insertError.message}` });
  }

  if (!row) {
    row = await getJobRow(db, requestId);
    if (!row) return json(500, { error: 'AI job disappeared while being created.' });

    if (row.job_id || row.status === 'COMPLETED' || isFailedStatus(row.status)) {
      if (isFailedStatus(row.status)) {
        return json(200, {
          requestId,
          jobId: row.job_id,
          status: 'FAILED',
          error: row.error || 'ComfyUI job failed.',
        });
      }
      return json(200, { requestId, jobId: row.job_id, status: row.status });
    }

    const updatedAt = Date.parse(row.updated_at || row.created_at);
    const stale = !Number.isFinite(updatedAt) || Date.now() - updatedAt > STALE_PENDING_MS;
    if (!stale) {
      return json(200, { requestId, jobId: null, status: 'PENDING' });
    }

    await db
      .from('ai_image_jobs')
      .update({ status: 'PENDING', error: null, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);
  }

  try {
    const imageName = await uploadBytesToComfy(source.bytes, source.mimeType, 'inpaint');
    const imageScale = source.width && source.height
      ? Math.min(source.width, source.height)
      : 0;

    const strokes = body.strokes;
    let mask: InpaintMaskSource;

    if (Array.isArray(strokes) && strokes.length > 0) {
      if (!source.width || !source.height) {
        throw new Error('Could not read the image size to build the brush mask. Try a JPEG or PNG.');
      }
      const maskPng = await buildBrushMaskPng(source.width, source.height, strokes);
      if (!maskPng) {
        throw new Error('The painted area was empty. Paint over the spot you want to change.');
      }
      const maskName = await uploadBytesToComfy(maskPng, 'image/png', `mask-${requestId.slice(-8)}`);
      mask = { kind: 'brush', maskImage: maskName };
    } else if (target === 'background') {
      mask = {
        kind: 'background',
        node: Deno.env.get('COMFY_BG_MASK_NODE') || 'RMBG',
        model: Deno.env.get('COMFY_RMBG_MODEL') || 'RMBG-2.0',
      };
    } else if (target === 'hair') {
      mask = {
        kind: 'hair',
        node: Deno.env.get('COMFY_HAIR_MASK_NODE') || 'HumanParts',
      };
    } else {
      throw new Error('Paint the area you want to change for Body and Item edits.');
    }

    if (imageScale && imageScale < 256) {
      throw new Error('The source image is too small for an inpaint pass.');
    }

    const styleMode = String(body.styleMode ?? '').trim();
    const config = editTargetConfig(target);
    const sceneNegative = String(body.negative ?? '').trim();
    const baseNegative = negativeForEdit(target, userPrompt, styleMode);
    const workflow = buildInpaintWorkflow({
      imageName,
      mask,
      positive: buildEditPrompt(target, userPrompt, styleMode),
      negative: sceneNegative ? `${baseNegative}, ${sceneNegative}` : baseNegative,
      denoise: clampEditDenoise(body.denoise, config.denoise),
      seed: Math.floor(Math.random() * 2_147_483_647),
      filenamePrefix: `ily_${target}_${requestId.slice(-8)}`,
      checkpoint: checkpointForStyle(styleMode),
      faceIdProvider: Deno.env.get('COMFY_FACEID_PROVIDER') || 'CPU',
      faceIdWeight: configForStyle(styleMode).faceIdWeight,
      // Background and hair masks never cover the face, so FaceID is not needed
      // and would fail outright on a photo with no detectable face.
      useFaceId: target === 'body' || target === 'item',
    });

    const jobId = await submitComfyWorkflow(
      db,
      requestId,
      applySubjectLora(workflow, subjectLoraName(), 0.7)
    );
    return json(200, { requestId, jobId, status: 'IN_PROGRESS', target });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db
      .from('ai_image_jobs')
      .update({ status: 'FAILED', error: message, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);
    return json(502, { requestId, status: 'FAILED', error: message });
  }
}

/** Text-to-image background + untouched subject composite + harmonization. */
async function handleBackgroundGenerate(
  body: Record<string, unknown>,
  requestId: string,
  coupleId: string
): Promise<Response> {
  const db = getDb();
  if (!db) {
    return json(500, {
      error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not available to the Edge Function.',
    });
  }

  const styleMode = String(body.styleMode ?? '').trim();
  const userPrompt = String(body.prompt ?? '').trim();

  let source: ResolvedImage;
  try {
    source = await resolveSourceImage(body);
  } catch (e) {
    return json(400, { error: e instanceof Error ? e.message : String(e) });
  }
  const imageCheck = validateImageBytes(source.bytes);
  if (!imageCheck.ok) return json(400, { error: imageCheck.error });

  const { data: inserted, error: insertError } = await db
    .from('ai_image_jobs')
    .insert({ request_id: requestId, status: 'PENDING', couple_id: coupleId || null })
    .select('*')
    .maybeSingle();

  let row = (inserted as JobRow | null) ?? null;
  if (insertError && insertError.code !== '23505') {
    return json(500, { error: `Could not create AI job: ${insertError.message}` });
  }
  if (!row) {
    row = await getJobRow(db, requestId);
    if (!row) return json(500, { error: 'AI job disappeared while being created.' });
    if (row.job_id || row.status === 'COMPLETED' || isFailedStatus(row.status)) {
      return json(200, { requestId, jobId: row.job_id, status: row.status, error: row.error });
    }
    const updatedAt = Date.parse(row.updated_at || row.created_at);
    const stale = !Number.isFinite(updatedAt) || Date.now() - updatedAt > STALE_PENDING_MS;
    if (!stale) return json(200, { requestId, status: 'PENDING' });
    await db
      .from('ai_image_jobs')
      .update({ status: 'PENDING', error: null, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);
  }

  try {
    const imageName = await uploadBytesToComfy(source.bytes, source.mimeType, 'bg');
    const cfg = configForStyle(styleMode);
    const quality = cfg.quality === 'anime' ? ANIME_QUALITY : PONY_QUALITY;
    const styleTags = styleTagsForEdit(styleMode);
    // Scene-specific shorthand, then style tags first so the style wins over
    // the scene noun (otherwise "grow room" erases "1920s").
    const expanded = userPrompt
      ? (() => {
          const extras: string[] = [];
          if (/grow room|weed|cannabis|marijuana/i.test(userPrompt)) {
            extras.push(
              'indoor cannabis cultivation room, rows of marijuana plants under LED grow lights, reflective floor, purple and green smoke'
            );
          }
          if (/walmart|store|aisle/i.test(userPrompt)) {
            extras.push('big-box retail store interior, fluorescent ceiling lights, long aisles, shelves of products');
          }
          if (/moon/i.test(userPrompt)) extras.push('large glowing moon, night sky');
          if (/beach/i.test(userPrompt)) extras.push('sandy beach, ocean waves, palm trees');
          return [userPrompt, ...extras].join(', ');
        })()
      : 'detailed background, scenery, environment';
    const positive = [
      quality,
      styleTags,
      expanded,
      'wide establishing shot, full environment, detailed scenery, cinematic lighting, no people',
    ]
      .filter(Boolean)
      .join(', ');
    const baseNegative = cfg.negative === 'anime' ? ANIME_NEGATIVE : BASE_NEGATIVE;
    const negative = `${baseNegative}, people, person, human, body parts, limbs, hands, feet, text, watermark`;

    const srcW = source.width || 1024;
    const srcH = source.height || 1024;
    const scale = Math.min(1, 1024 / Math.max(srcW, srcH));
    const width = Math.max(512, Math.round((srcW * scale) / 8) * 8);
    const height = Math.max(512, Math.round((srcH * scale) / 8) * 8);

    const workflow = buildGeneratedBackgroundWorkflow({
      imageName,
      positive,
      negative,
      seed: Math.floor(Math.random() * 2_147_483_647),
      filenamePrefix: `ily_bg_${requestId.slice(-8)}`,
      checkpoint: checkpointForStyle(styleMode),
      width,
      height,
    });

    const jobId = await submitComfyWorkflow(db, requestId, workflow);
    return json(200, { requestId, jobId, status: 'IN_PROGRESS', mode: 'generate' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db
      .from('ai_image_jobs')
      .update({ status: 'FAILED', error: message, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);
    return json(502, { requestId, status: 'FAILED', error: message });
  }
}

/** Benchmark router: realism composite/outfit plus every style bucket. */
async function handleBenchmarkStart(
  body: Record<string, unknown>,
  requestId: string,
  coupleId: string
): Promise<Response> {
  const db = getDb();
  if (!db) {
    return json(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not available.' });
  }

  const styleMode = String(body.styleMode ?? '').trim();
  const bucket = bucketForStyle(styleMode);

  let source: ResolvedImage;
  try {
    source = await resolveSourceImage(body);
  } catch (e) {
    return json(400, { error: e instanceof Error ? e.message : String(e) });
  }
  const imageCheck = validateImageBytes(source.bytes);
  if (!imageCheck.ok) return json(400, { error: imageCheck.error });

  const { data: inserted, error: insertError } = await db
    .from('ai_image_jobs')
    .insert({ request_id: requestId, status: 'PENDING', couple_id: coupleId || null })
    .select('*')
    .maybeSingle();
  let row = (inserted as JobRow | null) ?? null;
  if (insertError && insertError.code !== '23505') {
    return json(500, { error: `Could not create AI job: ${insertError.message}` });
  }
  if (!row) {
    row = await getJobRow(db, requestId);
    if (!row) return json(500, { error: 'AI job disappeared while being created.' });
    if (row.job_id || row.status === 'COMPLETED' || isFailedStatus(row.status)) {
      return json(200, { requestId, jobId: row.job_id, status: row.status, error: row.error });
    }
    const updatedAt = Date.parse(row.updated_at || row.created_at);
    const stale = !Number.isFinite(updatedAt) || Date.now() - updatedAt > STALE_PENDING_MS;
    if (!stale) return json(200, { requestId, status: 'PENDING' });
    await db
      .from('ai_image_jobs')
      .update({ status: 'PENDING', error: null, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);
  }

  try {
    const imageName = await uploadBytesToComfy(source.bytes, source.mimeType, 'bench');
    const cfg = bucketConfig(styleMode);
    const styleTags = styleTagsForEdit(styleMode);
    const backgroundPrompt =
      String(body.backgroundPrompt ?? body.prompt ?? '').trim() ||
      'detailed background, scenery, environment';
    const editPrompt = String(body.editPrompt ?? '').trim();

    const realismPositive = [
      PONY_QUALITY,
      cfg.stylePrefix,
      styleTags,
      backgroundPrompt,
      'wide establishing shot, full environment, detailed scenery, cinematic lighting, no people',
    ]
      .filter(Boolean)
      .join(', ');
    const realismNegative = `${BASE_NEGATIVE}, ${cfg.negativeAdditions}, (skinny, anorexic, flat chest:1.15), (morbidly obese, bloated torso:1.25), people, person, human, body parts, limbs, hands, feet, text, watermark`;

    const subjectTraits = String(body.subjectTraits ?? '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[{}]/g, '')
      .trim()
      .slice(0, 200);

    const subject: SubjectMode =
      body.subject === 'husband' || body.subject === 'couple' ? body.subject : 'wife';
    const isNude = body.isNude === true || body.nude === true;

    // The stoner payload owns the bucket prompts: harmonised background, rotating
    // hardware, grooming rules and the Team No Lackin easter egg.
    const payload = generateFinalOpenCodePayload(styleMode, subject, isNude, backgroundPrompt);
    const bucketPositive = [PONY_QUALITY, payload.positive, subjectTraits]
      .filter(Boolean)
      .join(', ');
    const bucketNegative = [BASE_NEGATIVE, payload.negative]
      .filter(Boolean)
      .join(', ');
    const baseEditPositive = [PONY_QUALITY, cfg.stylePrefix, styleTags, editPrompt]
      .filter(Boolean)
      .join(', ');

    const srcW = source.width || 1024;
    const srcH = source.height || 1216;
    const scale = Math.min(1, 1024 / Math.max(srcW, srcH));
    const width = Math.max(512, Math.round((srcW * scale) / 8) * 8);
    const height = Math.max(512, Math.round((srcH * scale) / 8) * 8);
    // Stylized buckets render portrait so the scene has room around her instead of
    // being a pasted close-up filling 85% of the frame.
    const outWidth = cfg.portrait ? 832 : width;
    const outHeight = cfg.portrait ? 1216 : height;

    const common = {
      imageName,
      positive: realismPositive,
      negative: realismNegative,
      seed: Math.floor(Math.random() * 2_147_483_647),
      filenamePrefix: `ily_bench_${requestId.slice(-8)}`,
      checkpoint: Deno.env.get('COMFY_CHECKPOINT') || undefined,
      width: outWidth,
      height: outHeight,
    };

    let workflow: Record<string, unknown>;
    if (subject === 'couple') {
      // Two masked passes: her LoRA paints the frame, his repaints the right half.
      workflow = buildCoupleWorkflow({
        imageName,
        husbandFaceImage: Deno.env.get('COMFY_HUSBAND_IMAGE') || 'boi/boi_001.jpg',
        positive: bucketPositive,
        husbandPositive: [PONY_QUALITY, 'mbboi', 'man', backgroundPrompt].filter(Boolean).join(', '),
        negative: bucketNegative,
        seed: common.seed,
        filenamePrefix: common.filenamePrefix,
        checkpoint: common.checkpoint,
        width: outWidth,
        height: outHeight,
        loraWife: LORA_FILES.wife,
        loraHusband: LORA_FILES.husband,
        loraStrength: 0.8,
        faceIdProvider: Deno.env.get('COMFY_FACEID_PROVIDER') || 'CPU',
      });
    } else if (bucket === 'realism_composite') {
      workflow = buildRealismCompositeWorkflow(common);
    } else if (styleMode === 'rip-shirt') {
      // Two-pass macro: King Von in a blank tee, then her portrait printed on it.
      const hostPositive = [
        PONY_QUALITY,
        'photorealistic, raw photo, 35mm photograph',
        'King Von the rapper, black man, short hair, beard, standing, front view, upper body, torso visible',
        'wearing a thick gold O Block chain necklace, diamond pendant',
        'wearing a plain blank black T-shirt, no print, no logo, smooth black cotton fabric, large empty chest area',
        backgroundPrompt,
        'centered composition, sharp focus',
      ]
        .filter(Boolean)
        .join(', ');
      const portraitPositive = [
        PONY_QUALITY,
        'sticker graphic, printed portrait, head and shoulders portrait',
        '(curvy figure, natural body proportions, heavy bust, long wavy red hair, messy bangs, round wireframe glasses:1.1)',
        'rating_explicit, explicit anatomical details',
        'bold flat lighting, centered subject, clean simple backdrop',
      ]
        .filter(Boolean)
        .join(', ');
      const hostNegative = `${BASE_NEGATIVE}, anime, cartoon, 2d, sketch, drawing, painting, doll, plastic skin, text, watermark, logo, graphic print on shirt`;
      workflow = buildRipShirtWorkflow({
        imageName,
        hostPositive,
        portraitPositive,
        negative: hostNegative,
        seed: common.seed,
        filenamePrefix: common.filenamePrefix,
        checkpoint: common.checkpoint,
        width,
        height,
        faceIdWeight: cfg.faceIdWeight,
        faceIdLoraStrength: cfg.faceIdLoraStrength,
        faceIdProvider: Deno.env.get('COMFY_FACEID_PROVIDER') || 'CPU',
        hostFaceImage: Deno.env.get('COMFY_KINGVON_IMAGE') || 'kingvon.png',
        hostFaceIdWeight: 0.85,
      });
    } else {
      workflow = buildBucketStyleWorkflow({
        ...common,
        positive: bucketPositive,
        negative: bucketNegative,
        neonSign: (Deno.env.get('COMFY_EASTER_EGG') ?? '1') !== '0',
        controlNet:
          cfg.controlNet === 'depth_line'
            ? 'depth_line'
            : cfg.controlNet === 'anime_line'
              ? 'anime_line'
              : cfg.controlNet === 'openpose'
                ? 'openpose'
                : cfg.controlNet === 'depth'
                  ? 'depth'
                  : 'none',
        controlNetStrength: cfg.controlNetStrength,
        controlNetEndPercent: cfg.controlNetEndPercent,
        lineartStrength: cfg.lineartStrength,
        lineartEndPercent: cfg.lineartEndPercent,
        faceIdEndAt: cfg.faceIdEndAt,
        initFromSource: cfg.initFromSource,
        padScale: cfg.padScale,
        loraName:
          loraForSubject(subject) ??
          (Deno.env.get('COMFY_SUBJECT_LORA') || 'ashley_v1_1200_steps_00001_.safetensors'),
        loraStrength: cfg.loraStrength ?? 0.7,
        loraClipStrength: cfg.loraClipStrength,
        useFaceId: cfg.useFaceId,
        cfgScale: cfg.cfgScale,
        faceIdWeight: cfg.faceIdWeight,
        faceIdLoraStrength: cfg.faceIdLoraStrength,
        faceIdProvider: Deno.env.get('COMFY_FACEID_PROVIDER') || 'CPU',
        blurRadius: typeof body.blurRadius === 'number' ? body.blurRadius : cfg.blurRadius,
        denoise: typeof body.denoise === 'number' ? body.denoise : cfg.denoise,
        padSubject: cfg.padSubject,
      });
    }

    const jobId = await submitComfyWorkflow(
      db,
      requestId,
      applySubjectLora(workflow, subjectLoraName(), cfg.loraStrength ?? 0.85)
    );
    return json(200, { requestId, jobId, status: 'IN_PROGRESS', bucket });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db
      .from('ai_image_jobs')
      .update({ status: 'FAILED', error: message, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);
    return json(502, { requestId, status: 'FAILED', error: message });
  }
}

async function handleStyleStatus(requestId: string): Promise<Response> {
  const db = getDb();
  if (!db) {
    return json(500, {
      error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not available to the Edge Function.',
    });
  }

  const row = await getJobRow(db, requestId);
  if (!row) return json(404, { error: 'Unknown request_id.' });

  if (row.status === 'COMPLETED' && row.result_path) {
    const url = await makeSignedResultUrl(db, row.result_path);
    if (url) {
      return json(200, {
        requestId,
        status: 'COMPLETED',
        url,
        mimeType: mimeFromPath(row.result_path),
      });
    }
  }

  if (isFailedStatus(row.status)) {
    return json(200, {
      requestId,
      status: 'FAILED',
      error: row.error || 'ComfyUI job failed.',
    });
  }

  if (!row.job_id) {
    return json(200, { requestId, status: row.status || 'PENDING' });
  }

  const historyRes = await fetch(`${await comfyBaseUrl()}/history/${row.job_id}`);
  const historyText = await historyRes.text();

  if (!historyRes.ok) {
    return json(502, {
      requestId,
      status: 'ERROR',
      error: `ComfyUI history failed (HTTP ${historyRes.status}): ${historyText.slice(0, 500)}`,
    });
  }

  let history: Record<string, ComfyHistoryEntry> = {};
  try {
    history = JSON.parse(historyText);
  } catch {
    history = {};
  }

  const entry = history[row.job_id];
  if (!entry) {
    return json(200, { requestId, status: 'IN_PROGRESS' });
  }

  if (entry.status?.status_str === 'error') {
    const error = JSON.stringify(entry.status?.messages ?? entry.status ?? {}).slice(0, 1500);

    // FaceID is optional: if InsightFace cannot find a face, resubmit the same
    // workflow once with the FaceID branch removed instead of failing the edit.
    if (isNoFaceError(error) && row.job_id) {
      const fallback = withoutFaceId(entry.prompt);
      if (fallback) {
        // Claim the retry by clearing job_id only if it is still this failed job,
        // so two concurrent polls cannot submit the fallback twice.
        const { data: claimed } = await db
          .from('ai_image_jobs')
          .update({
            status: 'IN_PROGRESS',
            job_id: null,
            error: 'No face detected — retrying without FaceID.',
            updated_at: new Date().toISOString(),
          })
          .eq('request_id', requestId)
          .eq('job_id', row.job_id)
          .select('request_id')
          .maybeSingle();

        if (claimed) {
          try {
            const newJobId = await submitComfyWorkflow(db, requestId, fallback);
            return json(200, {
              requestId,
              jobId: newJobId,
              status: 'IN_PROGRESS',
              note: 'No face detected; retried without FaceID.',
            });
          } catch (e) {
            const retryError = `No face detected and the FaceID-free retry could not start: ${
              e instanceof Error ? e.message : String(e)
            }`;
            await db
              .from('ai_image_jobs')
              .update({ status: 'FAILED', error: retryError, updated_at: new Date().toISOString() })
              .eq('request_id', requestId);
            return json(200, { requestId, status: 'FAILED', error: retryError });
          }
        }

        return json(200, { requestId, status: 'IN_PROGRESS' });
      }
    }

    await db
      .from('ai_image_jobs')
      .update({ status: 'FAILED', error, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);
    return json(200, { requestId, status: 'FAILED', error });
  }

  const image = findComfyOutputImage(entry.outputs);
  if (!image) {
    return json(200, { requestId, status: 'IN_PROGRESS' });
  }

  const viewUrl = `${await comfyBaseUrl()}/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(
    image.subfolder || ''
  )}&type=${encodeURIComponent(image.type || 'output')}`;

  const imgRes = await fetch(viewUrl);
  if (!imgRes.ok) {
    return json(502, {
      requestId,
      status: 'ERROR',
      error: `Could not fetch the ComfyUI result (HTTP ${imgRes.status}).`,
    });
  }

  const bytes = new Uint8Array(await imgRes.arrayBuffer());
  const coupleId = row.couple_id || 'default-couple';
  const path = `${coupleId}/ai-edits/${requestId}.png`;

  let url: string | null = null;
  try {
    const { error: uploadError } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(path, new Blob([bytes], { type: 'image/png' }), {
        contentType: 'image/png',
        upsert: true,
      });
    if (!uploadError) url = await makeSignedResultUrl(db, path);
  } catch {
    // fall back to base64 below
  }

  await db
    .from('ai_image_jobs')
    .update({
      status: 'COMPLETED',
      error: null,
      result_path: url ? path : row.result_path,
      couple_id: coupleId,
      updated_at: new Date().toISOString(),
    })
    .eq('request_id', requestId);

  if (url) {
    return json(200, { requestId, status: 'COMPLETED', url, mimeType: 'image/png' });
  }

  return json(200, {
    requestId,
    status: 'COMPLETED',
    b64: bytesToBase64(bytes),
    mimeType: 'image/png',
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json(405, { error: 'Use POST.' });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const actionRaw = String(body.action ?? '').trim().toLowerCase();
    const styleMode = String(body.styleMode ?? '').trim();
    const userPrompt = String(body.userPrompt ?? '').trim();
    const styleImageBase64 = String(body.imageBase64 ?? body.image_base64 ?? '').trim();
    const requestId = String(body.request_id ?? body.requestId ?? '').trim();
    const coupleId = String(body.couple_id ?? body.coupleId ?? '').trim();

    // ComfyUI style flow.
    if (actionRaw === 'style_start') {
      if (!requestId || requestId.length > 160) {
        return json(400, { error: 'Missing or invalid request_id.' });
      }
      if (!styleMode) return json(400, { error: 'Missing styleMode.' });
      if (!styleImageBase64) return json(400, { error: 'Missing imageBase64.' });
      return await handleStyleStart(requestId, styleImageBase64, styleMode, userPrompt, coupleId, {
        denoise: Number(body.denoise),
        faceIdWeight: Number(body.faceIdWeight),
        depthStrength: Number(body.depthStrength),
        subject:
          body.subject === 'husband' || body.subject === 'couple' ? body.subject : 'wife',
        isNude: body.isNude !== false,
        backgroundPrompt: typeof body.backgroundPrompt === 'string' ? body.backgroundPrompt : undefined,
        poseImageBase64:
          typeof body.poseImageBase64 === 'string' ? body.poseImageBase64 : undefined,
        subjectTraits: typeof body.subjectTraits === 'string' ? body.subjectTraits : undefined,
        seed: typeof body.seed === 'number' ? body.seed : undefined,
        wide: body.wide === true,
        bodyTags: typeof body.bodyTags === 'string' ? body.bodyTags : undefined,
      });
    }

    if (actionRaw === 'style_status') {
      if (!requestId || requestId.length > 160) {
        return json(400, { error: 'Missing or invalid request_id.' });
      }
      return await handleStyleStatus(requestId);
    }

    if (actionRaw === 'style_health') {
      try {
        const healthRes = await fetch(`${await comfyBaseUrl()}/system_stats`);
        const healthText = await healthRes.text();
        return new Response(healthText, {
          status: healthRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return json(502, { error: String(e) });
      }
    }

    // Localized edit pass: auto-segmented background/hair or a brush mask.
    if (actionRaw === 'inpaint_start') {
      if (!requestId || requestId.length > 160) {
        return json(400, { error: 'Missing or invalid request_id.' });
      }
      return await handleInpaintStart(requestId, body, coupleId);
    }

    if (actionRaw === 'inpaint_status') {
      if (!requestId || requestId.length > 160) {
        return json(400, { error: 'Missing or invalid request_id.' });
      }
      return await handleStyleStatus(requestId);
    }

    if (actionRaw === 'background_generate') {
      if (!requestId || requestId.length > 160) {
        return json(400, { error: 'Missing or invalid request_id.' });
      }
      return await handleBackgroundGenerate(body, requestId, coupleId);
    }

    if (actionRaw === 'benchmark_start') {
      if (!requestId || requestId.length > 160) {
        return json(400, { error: 'Missing or invalid request_id.' });
      }
      return await handleBenchmarkStart(body, requestId, coupleId);
    }

    // In-app pod kill switch: status / stop / start. No image job is created.
    if (actionRaw === 'comfy_pod') {
      try {
        return await handleComfyPod(body);
      } catch (e) {
        return json(502, { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Show which ComfyUI URL auto-discovery resolves right now. No job created.
    if (actionRaw === 'comfy_discover') {
      try {
        const configured = (Deno.env.get('RUNPOD_COMFY_URL') || 'auto').trim() || 'auto';
        return json(200, { comfyUrl: await comfyBaseUrl(), source: configured });
      } catch (e) {
        return json(502, { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Diagnose which segmentation nodes the pod actually exposes. No job created.
    if (actionRaw === 'mask_health') {
      const nodes = [
        Deno.env.get('COMFY_BG_MASK_NODE') || 'RMBG',
        Deno.env.get('COMFY_HAIR_MASK_NODE') || 'HumanParts',
      ];

      // Show combo values (e.g. the RMBG model list) so we can pick a valid one.
      const describe = (spec: unknown): unknown => {
        if (Array.isArray(spec)) {
          if (Array.isArray(spec[0])) return (spec[0] as unknown[]).slice(0, 80);
          return spec[0];
        }
        return typeof spec;
      };
      const summarize = (inputs?: Record<string, unknown>): Record<string, unknown> => {
        const out: Record<string, unknown> = {};
        for (const [key, spec] of Object.entries(inputs ?? {})) out[key] = describe(spec);
        return out;
      };

      const results: Record<string, unknown> = {};
      for (const node of nodes) {
        try {
          const res = await fetch(`${await comfyBaseUrl()}/object_info/${encodeURIComponent(node)}`);
          const text = await res.text();
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = {};
          }
          const info = parsed[node] as
            | { input?: { required?: Record<string, unknown>; optional?: Record<string, unknown> } }
            | undefined;
          results[node] = info
            ? {
                ok: true,
                required: summarizeComfyInputs(info.input?.required),
                optional: summarizeComfyInputs(info.input?.optional),
              }
            : { ok: false, http: res.status, body: text.slice(0, 300) };
        } catch (e) {
          results[node] = { ok: false, error: String(e) };
        }
      }
      return json(200, { comfyUrl: await comfyBaseUrl(), nodes: results });
    }

    // Validate an arbitrary set of node classes/inputs. No job created.
    if (actionRaw === 'comfy_nodes') {
      const requested = Array.isArray(body.nodes) ? body.nodes.map(String) : [];
      const nodes = requested.length > 0 ? requested : [];
      const results: Record<string, unknown> = {};
      for (const node of nodes.slice(0, 40)) {
        try {
          const res = await fetch(`${await comfyBaseUrl()}/object_info/${encodeURIComponent(node)}`);
          const text = await res.text();
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = {};
          }
          const info = parsed[node] as
            | { input?: { required?: Record<string, unknown>; optional?: Record<string, unknown> } }
            | undefined;
          results[node] = info
            ? {
                ok: true,
                required: summarizeComfyInputs(info.input?.required),
                optional: summarizeComfyInputs(info.input?.optional),
              }
            : { ok: false, http: res.status };
        } catch (e) {
          results[node] = { ok: false, error: String(e) };
        }
      }
      return json(200, { comfyUrl: await comfyBaseUrl(), nodes: results });
    }

    // Backward-compatible call shape: { imageBase64, styleMode, userPrompt }.
    if (styleMode || body.userPrompt !== undefined) {
      if (!styleMode) return json(400, { error: 'Missing styleMode.' });
      if (!styleImageBase64) return json(400, { error: 'Missing imageBase64.' });
      return await handleStyleStart(
        requestId || crypto.randomUUID(),
        styleImageBase64,
        styleMode,
        userPrompt,
        coupleId
      );
    }

    const action = actionRaw || 'start';
    // Old app builds only understand b64. New builds send include_b64:false and
    // receive the short Storage URL instead. Default true keeps old builds alive.
    const includeB64 = body.include_b64 !== false;
    const endpoint = Deno.env.get('RUNPOD_ENDPOINT_ID') || DEFAULT_ENDPOINT;

    if (!requestId || requestId.length > 160) {
      return json(400, { error: 'Missing or invalid request_id.' });
    }

    const runpodKey = Deno.env.get('RUNPOD_API_KEY');
    if (!runpodKey) {
      return json(500, {
        error: 'RUNPOD_API_KEY is not set on the Supabase project. Run: supabase secrets set RUNPOD_API_KEY=rpa_...',
      });
    }

    const db = getDb();
    if (!db) {
      return json(500, {
        error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not available to the Edge Function.',
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${runpodKey}`,
    };

    // ---------------------------------------------------------------------
    // STATUS: cheap one-shot check. Client polls this until COMPLETED/FAILED.
    // Never submits a new RunPod job, so retries cannot double-charge.
    // ---------------------------------------------------------------------
    if (action === 'status') {
      const row = await getJobRow(db, requestId);
      if (!row) return json(404, { error: 'Unknown request_id.' });

      if (!row.job_id) {
        const status = normalizeStatus(row.status) || 'PENDING';
        if (isFailedStatus(status)) {
          return json(200, {
            requestId,
            jobId: null,
            status: 'FAILED',
            error: row.error || 'RunPod job failed.',
          });
        }
        return json(200, { requestId, jobId: null, status });
      }

      const pollRes = await fetch(`${RUNPOD_BASE}/${endpoint}/status/${row.job_id}`, { headers });
      const job = (await pollRes.json().catch(() => ({}))) as RunpodJob;

      if (!pollRes.ok) {
        return json(502, {
          requestId,
          jobId: row.job_id,
          status: 'ERROR',
          error: runpodErrorMessage(job) || `RunPod status check failed (HTTP ${pollRes.status}).`,
        });
      }

      const status = normalizeStatus(job.status) || normalizeStatus(row.status) || 'IN_QUEUE';

      // HTTP 200 can still mean FAILED. Trust the status field, not the code.
      if (isFailedStatus(status)) {
        const error = runpodErrorMessage(job) || `RunPod job ${status.toLowerCase()}.`;
        await db
          .from('ai_image_jobs')
          .update({ status: 'FAILED', error, updated_at: new Date().toISOString() })
          .eq('request_id', requestId);
        return json(200, { requestId, jobId: row.job_id, status: 'FAILED', error });
      }

      if (status === 'COMPLETED') {
        const result = extractResultImage(job.output);
        const b64 = result?.b64 ?? '';
        const mimeType = result?.mimeType || 'image/webp';
        if (!b64) {
          const error = runpodErrorMessage(job) || 'RunPod completed but returned no image (expected output.images[0].b64).';
          await db
            .from('ai_image_jobs')
            .update({ status: 'FAILED', error, updated_at: new Date().toISOString() })
            .eq('request_id', requestId);
          return json(200, { requestId, jobId: row.job_id, status: 'FAILED', error });
        }

        // Preferred path: store the image once, return a short signed URL.
        // result_path means later polls reuse the same object instead of
        // re-uploading (and avoid returning base64 over and over).
        let resultPath = row.result_path;
        let signedUrl: string | null = null;

        if (resultPath) {
          signedUrl = await makeSignedResultUrl(db, resultPath);
        } else {
          const targetCouple = row.couple_id || coupleId;
          const bytes = base64ToBytes(b64);
          if (targetCouple && bytes) {
            const ext = extensionForMime(mimeType);
            const path = `${targetCouple}/ai-edits/${requestId}.${ext}`;
            const { error: uploadError } = await db.storage
              .from(STORAGE_BUCKET)
              .upload(path, new Blob([bytes], { type: mimeType }), {
                contentType: mimeType,
                upsert: true,
              });
            if (!uploadError) {
              resultPath = path;
              signedUrl = await makeSignedResultUrl(db, path);
            } else {
              console.error('[ai-image-edit] storage upload failed:', uploadError.message);
            }
          }
        }

        await db
          .from('ai_image_jobs')
          .update({
            status: 'COMPLETED',
            error: null,
            result_path: resultPath,
            couple_id: row.couple_id || coupleId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('request_id', requestId);

        if (signedUrl) {
          return json(200, {
            requestId,
            jobId: row.job_id,
            status: 'COMPLETED',
            url: signedUrl,
            path: resultPath,
            mimeType,
            ...(includeB64 ? { b64 } : {}),
          });
        }

        // Fallback when Storage is unavailable: keep the base64 contract.
        return json(200, { requestId, jobId: row.job_id, status: 'COMPLETED', b64, mimeType });
      }

      await db
        .from('ai_image_jobs')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('request_id', requestId);
      return json(200, { requestId, jobId: row.job_id, status });
    }

    // ---------------------------------------------------------------------
    // START: idempotent submit. If this request_id already exists, return the
    // stored job_id instead of submitting (and paying for) a second job.
    // ---------------------------------------------------------------------
    if (action !== 'start' && action !== 'run') {
      return json(400, { error: `Unknown action "${action}". Use "start" or "status".` });
    }

    const prompt = String(body.prompt ?? '').trim();
    const imageBase64 = String(body.image_base64 ?? body.imageBase64 ?? '').trim();
    if (!prompt || !imageBase64) {
      return json(400, { error: 'Missing imageBase64 or prompt.' });
    }

    // Refuse blank / 1x1 / truncated images before spending any GPU time.
    const imageCheck = validateInputImage(imageBase64);
    if (!imageCheck.ok) {
      return json(400, { error: imageCheck.error });
    }
    const rawImageBase64 = imageCheck.raw;

    // One variation token per new job. It is stored on the row, so retries
    // reuse the exact same prompt instead of generating a different image.
    const newVariationToken = makeVariationToken();
    const newFinalPrompt = `${prompt} | variant:${newVariationToken}`;

    // Atomic-ish claim: primary-key insert only succeeds for the first caller.
    const { data: inserted, error: insertError } = await db
      .from('ai_image_jobs')
      .insert({
        request_id: requestId,
        status: 'PENDING',
        couple_id: coupleId || null,
        variation_token: newVariationToken,
        final_prompt: newFinalPrompt,
      })
      .select('*')
      .maybeSingle();

    let row = (inserted as JobRow | null) ?? null;
    let claimed = Boolean(row);

    if (insertError && insertError.code !== '23505') {
      if (/relation .* does not exist/i.test(insertError.message)) {
        return json(500, {
          error: 'The ai_image_jobs table does not exist. Run the SQL in docs/supabase-recreate.sql.md (or the migration) first.',
        });
      }
      return json(500, { error: `Could not create AI job: ${insertError.message}` });
    }

    if (!claimed) {
      row = await getJobRow(db, requestId);
      if (!row) return json(500, { error: 'AI job disappeared while being created.' });

      // Already submitted/completed/failed -> never submit again.
      if (row.job_id || row.status === 'COMPLETED' || isFailedStatus(row.status)) {
        if (isFailedStatus(row.status)) {
          return json(200, {
            requestId,
            jobId: row.job_id,
            status: 'FAILED',
            error: row.error || 'RunPod job failed.',
          });
        }
        return json(200, await publicJobWithResult(db, row));
      }

      // PENDING without a job_id: the first submit call is still in flight, or
      // it died. Only allow a retry to take over once it is clearly stale.
      const updatedAt = Date.parse(row.updated_at || row.created_at);
      const stale = !Number.isFinite(updatedAt) || Date.now() - updatedAt > STALE_PENDING_MS;
      if (stale) {
        const cutoff = new Date(Date.now() - STALE_PENDING_MS).toISOString();
        const { data: reclaimed } = await db
          .from('ai_image_jobs')
          .update({ status: 'PENDING', error: null, updated_at: new Date().toISOString() })
          .eq('request_id', requestId)
          .is('job_id', null)
          .lt('updated_at', cutoff)
          .select('*')
          .maybeSingle();
        if (reclaimed) {
          row = reclaimed as JobRow;
          claimed = true;
        }
      }

      if (!claimed) {
        // Still in flight elsewhere: tell the client to poll the same request.
        return json(200, publicJob(row));
      }
    }

    // Reuse the stored token/prompt for retries. Old rows created before this
    // column existed get backfilled once.
    const jobVariationToken = row?.variation_token || newVariationToken;
    const jobFinalPrompt = row?.final_prompt || `${prompt} | variant:${jobVariationToken}`;
    if (row && (!row.variation_token || !row.final_prompt)) {
      await db
        .from('ai_image_jobs')
        .update({
          variation_token: jobVariationToken,
          final_prompt: jobFinalPrompt,
          updated_at: new Date().toISOString(),
        })
        .eq('request_id', requestId);
    }

    const runpodRes = await fetch(`${RUNPOD_BASE}/${endpoint}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: {
          prompt:
            `${jobFinalPrompt}. Maintain the exact facial features, likenesses, and structural head placement of all subjects visible in the base photo 100% identical as an unchangeable blueprint.`,
          images: [`data:${imageCheck.mimeType};base64,${rawImageBase64}`],
          width: 1024,
          height: 1024,
          n: 1,
          steps: 20,
          guidance: 5.0,
          output_format: 'webp',
          quality: 90,
        },
      }),
    });

    const rawRunpod = await runpodRes.text().catch(() => '');
    let job: RunpodJob = {};
    try {
      job = JSON.parse(rawRunpod) as RunpodJob;
    } catch {
      job = {};
    }
    const runStatus = normalizeStatus(job.status);

    if (!runpodRes.ok || isFailedStatus(runStatus) || job.error) {
      const error = runpodErrorMessage(job) || `RunPod rejected the request (HTTP ${runpodRes.status}).`;
      await db
        .from('ai_image_jobs')
        .update({ status: 'FAILED', error, updated_at: new Date().toISOString() })
        .eq('request_id', requestId);
      return json(502, {
        requestId,
        jobId: job.id ?? null,
        status: 'FAILED',
        error,
      });
    }

    if (!job.id) {
      const error = runpodErrorMessage(job) || 'RunPod accepted the request but returned no job id.';
      await db
        .from('ai_image_jobs')
        .update({ status: 'FAILED', error, updated_at: new Date().toISOString() })
        .eq('request_id', requestId);
      return json(502, { requestId, jobId: null, status: 'FAILED', error });
    }

    const status = runStatus || 'IN_QUEUE';
    await db
      .from('ai_image_jobs')
      .update({ job_id: job.id, status, error: null, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);

    return json(200, { requestId, jobId: job.id, status });
  } catch (e) {
    return json(500, { error: `AI editor crashed: ${String(e)}` });
  }
});
