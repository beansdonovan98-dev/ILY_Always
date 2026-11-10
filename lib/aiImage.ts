import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

const FRIENDLY: Record<number, string> = {
  401: 'Your RunPod API key is invalid or missing.',
  403: 'The AI provider blocked this request (permissions).',
  429: 'The AI provider is rate-limited — wait a minute and try again.',
  502: 'The AI provider hit an error — try again in a bit.',
};

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

export async function editImageWithAI(
  imageUrl: string,
  prompt: string,
  existingRequestId?: string
): Promise<string> {
  // The RunPod worker only reliably decodes PNG/JPEG. iPhones shoot HEIC by
  // default -> convert to JPEG first so the AI never sees an unsupported file.
  let uri = imageUrl;
  try {
    const converted = await ImageManipulator.manipulateAsync(uri, [], {
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    uri = converted.uri;
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

  const requestId = existingRequestId || createAIRequestId();

  const headers = {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
  };
  const url = `${supabaseUrl}/functions/v1/ai-image-edit`;

  async function post(body: Record<string, unknown>) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch {
      throw new AIEditError('Could not reach the AI editor — check your connection.');
    }
    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
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
      throw new AIEditError(detail || FRIENDLY[res.status] || `The AI editor failed (HTTP ${res.status}).`);
    }
    return parsed || {};
  }

  // Kick off (idempotent) job.
  const started = await post({
    action: 'start',
    request_id: requestId,
    prompt,
    image_base64: imageBase64,
    imageBase64,
  });

  const startStatus = String(started.status ?? '').toUpperCase();
  if (startStatus === 'FAILED') {
    throw new AIEditError(String(started.error || 'The AI editor failed.'));
  }

  // Poll until the job finishes.
  const deadline = Date.now() + 180_000;
  let current: Record<string, unknown> = started;
  while (Date.now() < deadline) {
    const status = String(current.status ?? '').toUpperCase();
    if (status === 'COMPLETED') {
      const b64 = typeof current.b64 === 'string' ? current.b64 : '';
      if (!b64) throw new AIEditError('The AI came back without an edited image. Try a different prompt.');
      return `data:image/png;base64,${b64}`;
    }
    if (status === 'FAILED') {
      throw new AIEditError(String(current.error || 'The AI editor failed.'));
    }

    await new Promise((r) => setTimeout(r, 2000));
    current = await post({ action: 'status', request_id: requestId });
    const s = String(current.status ?? '').toUpperCase();
    if (s === 'FAILED') {
      throw new AIEditError(String(current.error || 'The AI editor failed.'));
    }
  }

  throw new AIEditError('The AI edit timed out. Try again in a moment.');
}