import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

const FRIENDLY: Record<number, string> = {
  401: 'Your RunPod API key is invalid or missing.',
  403: 'The AI provider blocked this request (permissions).',
  429: 'The AI provider is rate-limited — wait a minute and try again.',
  502: 'The AI provider hit an error — try again in a bit.',
};

const COMFY_OFFLINE =
  'Darkroom is offline — the ComfyUI pod is stopped or still booting. Start the pod, wait for ComfyUI to finish loading, then try again.';

/** True when the failure is the pod being down, not a bad prompt/workflow. */
function isComfyOffline(detail: string): boolean {
  return /could not upload image to comfyui|comfyui history failed|error sending request|connection refused|econnrefused|dns error|network is unreachable|tcp connect|RUNPOD_COMFY_URL/i.test(
    detail
  );
}

const MAX_AI_INPUT_WIDTH = 1280;

/** A new id per user action. Reuse it on retries so the server can dedupe. */
export function createAIRequestId(): string {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class AIEditError extends Error {
  /** false = the job definitively failed; a retry should start a new job. */
  retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = 'AIEditError';
    this.retryable = retryable;
  }
}

type AIEdgeReply = Record<string, unknown>;

export type BrushStroke = {
  /** Normalized [x, y] pairs (0..1) relative to the photo. */
  points: Array<[number, number]>;
  /** Normalized radius relative to the photo width. */
  r: number;
};

export type EditTarget = 'background' | 'hair' | 'body' | 'item';

export type AIEdit = {
  target: EditTarget;
  prompt: string;
  /** Present for Brush targets (Body/Item). Background/Hair fall back to auto masks. */
  strokes?: BrushStroke[];
};

export type AIEditProgress = (message: string) => void;

export type AIJobCheck = {
  status: string;
  jobId?: string | null;
  url?: string;
  b64?: string;
  mimeType?: string;
  error?: string;
};

async function callAI(body: Record<string, unknown>): Promise<AIEdgeReply> {
  const headers = {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
  };
  const url = `${supabaseUrl}/functions/v1/ai-image-edit`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      // Ask for the short Storage URL only; old app builds omit this and get b64.
      body: JSON.stringify({ include_b64: false, ...body }),
    });
  } catch {
    throw new AIEditError('Could not reach the AI editor — check your connection.');
  }

  const text = await res.text();
  let parsed: AIEdgeReply | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new AIEditError('The AI editor backend is not deployed yet. (supabase functions deploy ai-image-edit)');
    }
    const detail =
      typeof parsed?.error === 'string'
        ? parsed.error
        : (parsed?.error as { message?: string } | undefined)?.message ||
          (text && text.length < 300 ? text : null);
    if (detail && isComfyOffline(detail)) throw new AIEditError(COMFY_OFFLINE);
    throw new AIEditError(detail || FRIENDLY[res.status] || `The AI editor failed (HTTP ${res.status}).`);
  }

  return parsed || {};
}

/** Re-check an existing job without ever submitting a new one. */
export async function checkAIJob(requestId: string, coupleId?: string): Promise<AIJobCheck> {
  const current = await callAI({ action: 'status', request_id: requestId, couple_id: coupleId });
  return {
    status: String(current.status ?? '').toUpperCase(),
    jobId: typeof current.jobId === 'string' ? current.jobId : null,
    url: typeof current.url === 'string' ? current.url : undefined,
    b64: typeof current.b64 === 'string' ? current.b64 : undefined,
    mimeType: typeof current.mimeType === 'string' ? current.mimeType : undefined,
    error: typeof current.error === 'string' ? current.error : undefined,
  };
}

async function prepareImageBase64(imageUrl: string): Promise<string> {
  // The RunPod worker only reliably decodes PNG/JPEG. iPhones shoot HEIC by
  // default -> convert to JPEG first so the AI never sees an unsupported file.
  // Also cap the long edge: full-resolution phone photos can crash the worker.
  let uri = imageUrl;
  try {
    const converted = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const resized = converted.width > MAX_AI_INPUT_WIDTH
      ? await ImageManipulator.manipulateAsync(
          converted.uri,
          [{ resize: { width: MAX_AI_INPUT_WIDTH } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        )
      : converted;
    uri = resized.uri;
  } catch {
    // Fall through with the original pick if the converter is unavailable.
  }

  let imageBase64: string;
  try {
    imageBase64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    throw new AIEditError('Could not read the picked photo. Try picking it again.');
  }
  if (!imageBase64) throw new AIEditError('The picked photo came back empty.');
  return imageBase64;
}

/**
 * Starts one ComfyUI pass and polls it to completion.
 * Every pass is its own request_id, so a retry can never double-submit.
 */
async function runComfyJob(
  startBody: Record<string, unknown>,
  statusAction: 'style_status' | 'inpaint_status',
  requestId: string
): Promise<string> {
  const started = await callAI(startBody);

  const startStatus = String(started.status ?? '').toUpperCase();
  if (startStatus === 'FAILED' || startStatus === 'CANCELLED' || startStatus === 'TIMED_OUT') {
    throw new AIEditError(String(started.error || 'The AI provider failed to start the job.'), false);
  }

  const firstUrl = typeof started.url === 'string' ? started.url : '';
  if (startStatus === 'COMPLETED' && firstUrl) return firstUrl;

  const deadline = Date.now() + 10 * 60_000;
  let waitMs = 2000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, waitMs));
    waitMs = Math.min(waitMs + 1000, 5000);

    let current: Record<string, unknown>;
    try {
      current = await callAI({ action: statusAction, request_id: requestId });
    } catch {
      // Network blip: keep polling the same request_id.
      continue;
    }

    const status = String(current.status ?? '').toUpperCase();

    if (status === 'COMPLETED') {
      const url = typeof current.url === 'string' ? current.url : '';
      if (url) return url;

      const image = typeof current.image === 'string' ? current.image : '';
      if (image) return image;

      const b64 = typeof current.b64 === 'string' ? current.b64 : '';
      if (b64) {
        const mimeType = typeof current.mimeType === 'string' ? current.mimeType : 'image/png';
        return `data:${mimeType};base64,${b64}`;
      }

      throw new AIEditError('The AI completed but returned no image.', false);
    }

    if (status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT') {
      throw new AIEditError(String(current.error || 'The AI editor failed.'), false);
    }
  }

  throw new AIEditError(
    'The AI is still working after 10 minutes. Run the edit again — the backend keeps the finished passes.',
    true
  );
}

/**
 * Style pass (denoise capped at 0.35, FaceID on) followed by one masked
 * inpaint pass per edit, in order: background -> hair -> body -> item.
 */
export async function editImageWithStyle(
  imageUrl: string,
  styleMode: string,
  edits: AIEdit[],
  coupleId?: string,
  onProgress?: AIEditProgress,
  options?: { skipStyle?: boolean }
): Promise<string> {
  const active = edits.filter((edit) => edit.prompt.trim().length > 0);

  let current = imageUrl;

  if (!options?.skipStyle) {
    const imageBase64 = await prepareImageBase64(imageUrl);
    const styleRequestId = createAIRequestId();

    onProgress?.('Applying style...');
    current = await runComfyJob(
      {
        action: 'style_start',
        request_id: styleRequestId,
        couple_id: coupleId,
        imageBase64,
        styleMode,
      },
      'style_status',
      styleRequestId
    );
  }

  for (const edit of active) {
    const label = edit.target.charAt(0).toUpperCase() + edit.target.slice(1);
    onProgress?.(`Editing ${label.toLowerCase()}...`);

    const requestId = createAIRequestId();
    const body: Record<string, unknown> = {
      action: 'inpaint_start',
      request_id: requestId,
      couple_id: coupleId,
      target: edit.target,
      prompt: edit.prompt.trim(),
      styleMode,
    };

    if (edit.strokes && edit.strokes.length > 0) body.strokes = edit.strokes;

    if (current.startsWith('data:')) {
      body.imageBase64 = current.replace(/^data:[^;,]+[;,]/, '');
    } else {
      body.imageUrl = current;
    }

    current = await runComfyJob(body, 'inpaint_status', requestId);
  }

  return current;
}

export async function editImageWithAI(
  imageUrl: string,
  prompt: string,
  existingRequestId?: string,
  coupleId?: string
): Promise<string> {
  const imageBase64 = await prepareImageBase64(imageUrl);

  const requestId = existingRequestId || createAIRequestId();

  // Kick off (idempotent) job.
  const started = await callAI({
    action: 'start',
    request_id: requestId,
    couple_id: coupleId,
    prompt,
    image_base64: imageBase64,
    imageBase64,
  });

  const startStatus = String(started.status ?? '').toUpperCase();
  if (startStatus === 'FAILED') {
    throw new AIEditError(String(started.error || 'The AI editor failed.'), false);
  }

  // Poll until the job finishes. Cold starts can exceed 150s, so give the
  // worker up to 10 minutes; each poll is a cheap status check, not a new job.
  const deadline = Date.now() + 10 * 60_000;
  let waitMs = 2000;
  let current: Record<string, unknown> = started;

  // A retried "start" can return COMPLETED without the result body. Fetch the
  // status once so the signed URL/base64 comes back before the loop exits.
  if (startStatus === 'COMPLETED' && !current.url && !current.b64) {
    current = await callAI({ action: 'status', request_id: requestId, couple_id: coupleId });
  }

  while (Date.now() < deadline) {
    const status = String(current.status ?? '').toUpperCase();
    if (status === 'COMPLETED') {
      const imageUrl = typeof current.url === 'string' ? current.url : '';
      if (imageUrl) return imageUrl;
      const b64 = typeof current.b64 === 'string' ? current.b64 : '';
      if (!b64) throw new AIEditError('The AI came back without an edited image. Try a different prompt.', false);
      const mimeType = typeof current.mimeType === 'string' ? current.mimeType : 'image/webp';
      return `data:${mimeType};base64,${b64}`;
    }
    if (status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT') {
      throw new AIEditError(String(current.error || 'The AI editor failed.'), false);
    }

    await new Promise((r) => setTimeout(r, waitMs));
    waitMs = Math.min(waitMs + 500, 5000);
    current = await callAI({ action: 'status', request_id: requestId, couple_id: coupleId });
    const s = String(current.status ?? '').toUpperCase();
    if (s === 'FAILED' || s === 'CANCELLED' || s === 'TIMED_OUT') {
      throw new AIEditError(String(current.error || 'The AI editor failed.'), false);
    }
  }

  throw new AIEditError(
    'The AI is still working after 10 minutes. Tap AI Edit again to keep waiting on the same job — you will not be charged twice.'
  );
}