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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, prompt, mimeType } = await req.json();
    if (!imageBase64 || !prompt) {
      return json(400, { error: 'Missing imageBase64 or prompt.' });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return json(500, {
        error: 'OPENAI_API_KEY is not set on the Supabase project. Run: supabase secrets set OPENAI_API_KEY=sk-...',
      });
    }

    const mime = mimeType || 'image/png';
    const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
    const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });

    // Try candidate edit models in order — different accounts expose
    // different model names, so fall back instead of failing on one.
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
      // Only fall through on "model does not exist" style errors.
      if (res.status === 400 && !/does not exist|not supported|unknown model/i.test(message)) break;
    }
    return json(502, { error: `AI provider could not edit with any known model (${lastMessage}).` });
  } catch (e) {
    return json(500, { error: `AI editor crashed: ${String(e)}` });
  }
});
