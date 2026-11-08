import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * AI photo edit. Two providers:
 *  - If REPLICATE_API_TOKEN is set → FLUX Kontext on Replicate (recommended next step).
 *  - Otherwise OpenAI, trying gpt-image-1 → gpt-image-1-mini → dall-e-2 in order.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, prompt, mimeType } = await req.json();
    if (!imageBase64 || !prompt) {
      return json(400, { error: 'Missing imageBase64 or prompt.' });
    }

    const mime = mimeType || 'image/jpeg';
    const dataUri = `data:${mime};base64,${imageBase64}`;

    const replicateKey = Deno.env.get('REPLICATE_API_TOKEN');
    if (replicateKey) {
      const resp = await replicateEdit(replicateKey, prompt, dataUri);
      if (resp !== null) return resp;
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return json(500, {
        error: 'No AI provider API key is set. Set OPENAI_API_KEY or REPLICATE_API_TOKEN via: supabase secrets set NAME=value',
      });
    }

    const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    const ext = mime.includes('png') ? 'png' : 'jpg';

    const models = ['gpt-image-1', 'gpt-image-1-mini', 'dall-e-2'];
    let lastMessage = 'OpenAI rejected the request.';
    for (const model of models) {
      const form = new FormData();
      form.append('image', blob, `image.${ext}`);
      form.append('prompt', prompt);
      form.append('n', '1');
      form.append('size', '1024x1024');
      form.append('model', model);

      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
      });

      const jsonRes = await res.json().catch(() => ({}));
      if (res.ok) {
        const b64 = jsonRes?.data?.[0]?.b64_json;
        if (b64) return json(200, { b64 });
        return json(502, { error: `The AI came back without an image (model: ${model}).` });
      }
      const message = jsonRes?.error?.message || 'OpenAI rejected the request.';
      lastMessage = `${model}: ${message}`;
      if (res.status === 400 && !/does not exist|not supported|unknown model/i.test(message)) break;
    }
    return json(502, { error: `AI provider could not edit with any known model (${lastMessage}).` });
  } catch (e) {
    return json(500, { error: `AI editor crashed: ${String(e)}` });
  }
});

async function replicateEdit(token: string, prompt: string, dataUri: string): Promise<Response | null> {
  const create = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt,
        input_image: dataUri,
        output_format: 'png',
        aspect_ratio: 'input_image',
        safety_tolerance: 6,
      },
    }),
  });

  const prediction = await create.json().catch(() => ({}));
  if (!create.ok) {
    const message = prediction?.detail || `Replicate HTTP ${create.status}`;
    return json(502, { error: `Replicate error: ${message}` });
  }

  const urls = (prediction?.output as string[]) ?? [];
  const firstUrl = urls[0];
  if (!firstUrl) {
    return json(502, { error: 'Replicate came back without an image.' });
  }

  const img = await fetch(firstUrl);
  const buf = await img.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const b64 = btoa(binary);
  return json(200, { b64 });
}
