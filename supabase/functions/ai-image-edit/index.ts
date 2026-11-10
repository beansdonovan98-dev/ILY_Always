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

type RunpodJob = {
  id?: string;
  status?: string;
  error?: string;
  output?: unknown;
};

/**
 * Pull the first image out of whatever shape the worker returned.
 * Covers: output.images[], output.image, output[] , {image: ...}, {images:[...]}
 */
function firstImage(out: unknown, depth = 0): string | null {
  if (!out || depth > 4) return null;
  if (typeof out === 'string') {
    if (out.startsWith('data:image')) return out;
    if (/^https?:\/\//i.test(out)) return out;
    if (/^[A-Za-z0-9+/=\s]{200,}$/.test(out)) return `data:image/png;base64,${out.replace(/\s/g, '')}`;
    return null;
  }
  if (Array.isArray(out)) {
    for (const item of out) {
      const hit = firstImage(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof out === 'object') {
    const obj = out as Record<string, unknown>;
    for (const key of ['images', 'image', 'b64', 'b64_json', 'base64', 'url', 'output', 'data']) {
      if (key in obj) {
        const hit = firstImage(obj[key], depth + 1);
        if (hit) return hit;
      }
    }
  }
  return null;
}

function runpodErrorMessage(job: RunpodJob): string | null {
  if (job.error) return job.error;
  const out = job.output as Record<string, unknown> | undefined;
  if (out && typeof out === 'object') {
    const msg = out.error ?? out.message ?? out.detail;
    if (typeof msg === 'string' && msg) return msg;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, prompt } = await req.json();
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

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${runpodKey}`,
    };

    // worker-vllm-omni schema: image edit is `task: "image_edit"` with the
    // source image as `<field>_b64`. The old A1111 fields (api_name /
    // init_images) are silently ignored -> the worker falls back to plain
    // text-to-image and you get a completely different picture.
    const runpodRes = await fetch(`https://api.runpod.ai/v2/${endpoint}/runsync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: {
          task: 'image_edit',
          prompt:
            `${prompt}. Maintain the exact facial features, likenesses, and structural head placement of all subjects visible in the base photo 100% identical as an unchangeable blueprint.`,
          image_b64: imageBase64,
          n: 1,
          response_format: 'b64_json',
          output_format: 'png',
        },
      }),
    });

    let job = (await runpodRes.json().catch(() => ({}))) as RunpodJob;

    if (!runpodRes.ok) {
      return json(502, {
        error: runpodErrorMessage(job) || `RunPod rejected the request (HTTP ${runpodRes.status}).`,
      });
    }

    // runsync usually blocks until done, but if the worker is cold it can
    // return IN_QUEUE / IN_PROGRESS with an id -> poll /status until done.
    const deadline = Date.now() + 120_000;
    while (
      job.id &&
      (job.status === 'IN_QUEUE' || job.status === 'IN_PROGRESS' || job.status === 'RUNNING') &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 1500));
      const pollRes = await fetch(`https://api.runpod.ai/v2/${endpoint}/status/${job.id}`, { headers });
      job = (await pollRes.json().catch(() => ({}))) as RunpodJob;
    }

    if (job.status === 'FAILED') {
      return json(502, { error: runpodErrorMessage(job) || 'RunPod job failed.' });
    }

    const image = firstImage(job.output);
    if (!image) {
      return json(502, {
        error: runpodErrorMessage(job) || `RunPod returned no image (status: ${job.status || 'unknown'}).`,
      });
    }

    // URL result -> download and inline as base64 so the app doesn't need auth.
    if (/^https?:\/\//i.test(image)) {
      const imgRes = await fetch(image);
      if (!imgRes.ok) {
        return json(502, { error: `Could not download the result image (HTTP ${imgRes.status}).` });
      }
      const imgBuf = new Uint8Array(await imgRes.arrayBuffer());
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < imgBuf.length; i += chunk) {
        binary += String.fromCharCode(...imgBuf.subarray(i, i + chunk));
      }
      return json(200, { b64: btoa(binary) });
    }

    // Already a data URL.
    return json(200, { b64: image.replace(/^data:image\/[a-z+]+;base64,/, '') });
  } catch (e) {
    return json(500, { error: `AI editor crashed: ${String(e)}` });
  }
});
