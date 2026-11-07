import * as FileSystem from 'expo-file-system/legacy';

import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

function mimeForUri(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}

const FRIENDLY: Record<number, string> = {
  401: 'Your OpenAI API key is invalid or missing.',
  403: 'The AI provider blocked this request (permissions).',
  429: 'The AI provider is rate-limited — wait a minute and try again.',
  502: 'The AI provider hit an error — try again in a bit.',
};

export async function editImageWithAI(imageUrl: string, prompt: string): Promise<string> {
  const mimeType = mimeForUri(imageUrl);

  let imageBase64: string;
  try {
    imageBase64 = await FileSystem.readAsStringAsync(imageUrl, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    throw new Error('Could not read the picked photo. Try picking it again.');
  }
  if (!imageBase64) throw new Error('The picked photo came back empty.');

  let res: Response;
  try {
    // Direct fetch (not supabase.functions.invoke) so we can always read the
    // real error body instead of the generic "non-2xx status code" message.
    res = await fetch(`${supabaseUrl}/functions/v1/ai-image-edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ imageBase64, prompt, mimeType }),
    });
  } catch {
    throw new Error('Could not reach the AI editor — check your connection.');
  }

  const text = await res.text();
  let parsed: { b64?: string; error?: string } | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('The AI editor backend is not deployed yet. (supabase functions deploy ai-image-edit)');
    }
    const detail =
      typeof parsed?.error === 'string'
        ? parsed.error
        : (parsed?.error as { message?: string } | undefined)?.message ||
          (text && text.length < 300 ? text : null);
    throw new Error(detail || FRIENDLY[res.status] || `The AI editor failed (HTTP ${res.status}).`);
  }

  if (!parsed?.b64) throw new Error('The AI came back without an edited image. Try a different prompt.');
  return `data:image/png;base64,${parsed.b64}`;
}
