import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';

function mimeForUri(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'image/jpeg';
}

export async function editImageWithAI(imageUrl: string, prompt: string): Promise<string> {
  const mimeType = mimeForUri(imageUrl);

  let imageBase64: string;
  try {
    imageBase64 = await FileSystem.readAsStringAsync(imageUrl, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (e) {
    throw new Error('Could not read the picked photo. Try picking it again.');
  }

  if (!imageBase64) throw new Error('The picked photo came back empty.');

  const { data, error } = await supabase.functions.invoke('ai-image-edit', {
    body: { imageBase64, prompt, mimeType },
  });

  if (error) {
    const ctx = (error as { context?: Response }).context;
    let detail = '';
    if (ctx?.status === 404) {
      throw new Error('The AI editor backend is not deployed yet. (supabase functions deploy ai-image-edit)');
    }
    try {
      const body = (await ctx?.clone().json()) as { error?: string } | undefined;
      detail = body?.error ? `: ${body.error}` : '';
    } catch {
      // non-JSON body — generic message below
    }
    throw new Error(`The AI editor could not run${detail || '. Check your connection and try again.'}`);
  }
  if (!data?.b64) throw new Error('The AI came back without an edited image. Try a different prompt.');
  return `data:image/png;base64,${data.b64}`;
}
