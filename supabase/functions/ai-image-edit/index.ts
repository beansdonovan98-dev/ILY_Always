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
 * AI photo edit — RunPod (uncensored SDXL/LUX.2 img2img).
 * Proxies the app's photo to the user's private RunPod endpoint so the
 * API key stays in secrets (never shipped in the app).
 *
 * Secrets needed:
 *   RUNPOD_API_KEY=...
 *   RUNPOD_ENDPOINT_ID=... (the pq2pwxs2hxv7sf segment)
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

    const runpodKey = Deno.env.get('RUNPOD_API_KEY');
    const endpoint = Deno.env.get('RUNPOD_ENDPOINT_ID') || 'pq2pwxs2hxv7sf';
    if (!runpodKey) {
      return json(500, {
        error: 'RUNPOD_API_KEY is not set on the Supabase project. Run: supabase secrets set RUNPOD_API_KEY=rpa_...',
      });
    }

    const mime = mimeType || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${imageBase64}`;

    // Your RunPod sync endpoint (LUX.2 img2img). Keep face/body identical,
    // only restyle — matches the prompt the app sends.
    const runpodRes = await fetch(`https://api.runpod.ai/v2/${endpoint}/runsync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${runpodKey}`,
      },
      body: JSON.stringify({
        input: {
          api_name: 'img2img',
          init_images: [dataUrl],
          prompt:
            `${prompt}. Maintain the exact facial features, likenesses, and structural head placement of all subjects visible in the base photo 100% identical as an unchangeable blueprint.`,
          denoising_strength: 0.55,
          steps: 30,
          cfg_scale: 7.0,
        },
      }),
    });

    const runpodJson = await runpodRes.json().catch(() => ({}));
    if (!runpodRes.ok) {
      return json(502, { error: `RunPod rejected the request (HTTP ${runpodRes.status}).` });
    }

    const images: string[] = runpodJson?.output?.images || [];
    if (!images.length) {
      return json(502, { error: 'RunPod came back without an image. Try a different prompt.' });
    }

    // Download the result image and return it as base64 for the app.
    const imgRes = await fetch(images[0]);
    const imgBuf = new Uint8Array(await imgRes.arrayBuffer());
    let binary = '';
    for (let i = 0; i < imgBuf.length; i++) binary += String.fromCharCode(imgBuf[i]);
    const b64 = btoa(binary);
    return json(200, { b64 });
  } catch (e) {
    return json(500, { error: `AI editor crashed: ${String(e)}` });
  }
});
