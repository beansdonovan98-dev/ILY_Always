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

    const form = new FormData();
    form.append('image', blob, `image.${ext}`);
    form.append('prompt', prompt);
    form.append('n', '1');
    form.append('size', '1024x1024');
    form.append('model', 'dall-e-2');

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });

    const jsonRes = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = jsonRes?.error?.message || 'OpenAI rejected the request.';
      const code = jsonRes?.error?.code || res.status;
      return json(502, { error: `AI provider error (${code}): ${message}` });
    }

    const b64 = jsonRes?.data?.[0]?.b64_json;
    if (!b64) {
      return json(502, { error: 'The AI came back without an image.' });
    }
    return json(200, { b64 });
  } catch (e) {
    return json(500, { error: `AI editor crashed: ${String(e)}` });
  }
});
