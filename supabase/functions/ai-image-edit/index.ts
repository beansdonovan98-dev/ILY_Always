import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  try {
    const { imageBase64, prompt, mimeType } = await req.json();
    if (!imageBase64 || !prompt) return new Response('Missing imageBase64/prompt', { status: 400 });

    const mime = mimeType || 'image/png';
    const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
    const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });

    const form = new FormData();
    form.append('image', blob, `image.${ext}`);
    form.append('prompt', prompt);
    form.append('n', '1');
    form.append('size', '1024x1024');
    form.append('model', 'gpt-image-1');

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
      body: form,
    });

    const json = await res.json();
    if (!res.ok) return new Response(JSON.stringify(json), { status: res.status, headers: { 'Content-Type': 'application/json' } });

    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) return new Response('No image returned', { status: 500 });
    return new Response(JSON.stringify({ b64 }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});