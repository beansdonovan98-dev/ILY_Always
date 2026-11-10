import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RUNPOD_BASE = 'https://api.runpod.ai/v2';
const DEFAULT_ENDPOINT = '7ckfcko9p6h503';

// Reject blank/1x1/truncated uploads before they reach RunPod and burn GPU time.
const MIN_IMAGE_BASE64_CHARS = 20_000;
const MAX_IMAGE_BASE64_CHARS = 4_000_000;
const MIN_IMAGE_DIMENSION = 64;

// Completed images are written here so the client gets a short signed URL
// instead of a multi-MB base64 JSON body. Falls back to base64 if upload fails.
const STORAGE_BUCKET = 'couple-private';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// If a job row is PENDING with no job_id for this long, the submit request
// probably died before RunPod answered. Allow a later retry to claim it.
const STALE_PENDING_MS = 2 * 60_000;

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
  detail?: string;
  title?: string;
  message?: string;
  output?: unknown;
};

type JobRow = {
  request_id: string;
  job_id: string | null;
  status: string;
  error: string | null;
  couple_id: string | null;
  result_path: string | null;
  variation_token: string | null;
  final_prompt: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeStatus(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

/** 5-char random tag so the same prompt explores different details. */
function makeVariationToken(): string {
  return Math.random().toString(36).slice(2, 7).padEnd(5, '0');
}

function isFailedStatus(status: string): boolean {
  return status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT';
}

function stripDataUrl(value: string): string {
  return value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s/g, '');
}

type ImageInfo = {
  format: 'png' | 'jpeg' | 'webp';
  width?: number;
  height?: number;
};

function base64ToBytes(value: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function imageInfoFromBytes(bytes: Uint8Array): ImageInfo | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A, dimensions at bytes 16-23.
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { format: 'png', width: view.getUint32(16), height: view.getUint32(20) };
  }

  // JPEG: FF D8 FF ... walk markers until a SOF segment with dimensions.
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      if (
        marker === 0xd8 || marker === 0xd9 || marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)
      ) {
        i += 2;
        continue;
      }
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (len < 2) break;
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        return { format: 'jpeg', width, height };
      }
      i += 2 + len;
    }
    // Valid JPEG header even if no SOF marker was found in range.
    return { format: 'jpeg' };
  }

  // WebP: RIFF....WEBP. Dimensions are left to the worker.
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { format: 'webp' };
  }

  return null;
}

/** Validates the source image before any paid RunPod request is made. */
function validateInputImage(
  imageBase64: string
): { ok: true; raw: string; mimeType: string } | { ok: false; error: string } {
  // Accept both a raw base64 string and a data:image/...;base64 URL.
  const raw = stripDataUrl(imageBase64);
  if (!raw) return { ok: false, error: 'Missing image data.' };
  if (raw.length < MIN_IMAGE_BASE64_CHARS) {
    return {
      ok: false,
      error: 'The selected image is too small or blank. Pick a normal photo and try again.',
    };
  }
  if (raw.length > MAX_IMAGE_BASE64_CHARS) {
    return {
      ok: false,
      error: 'The selected image is too large for the AI worker. Try a smaller photo or crop it first.',
    };
  }

  const bytes = base64ToBytes(raw);
  if (!bytes || bytes.length < 24) {
    return { ok: false, error: 'The selected file is not a valid image.' };
  }

  const info = imageInfoFromBytes(bytes);
  if (!info) {
    return { ok: false, error: 'The selected file is not a valid JPEG, PNG, or WebP image.' };
  }

  if (
    info.width !== undefined &&
    info.height !== undefined &&
    (info.width < MIN_IMAGE_DIMENSION || info.height < MIN_IMAGE_DIMENSION)
  ) {
    return {
      ok: false,
      error: `The selected image is too small (${info.width}\u00d7${info.height}). Minimum is ${MIN_IMAGE_DIMENSION}\u00d7${MIN_IMAGE_DIMENSION}.`,
    };
  }

  const mimeType = info.format === 'jpeg' ? 'image/jpeg' : `image/${info.format}`;
  return { ok: true, raw, mimeType };
}

async function makeSignedResultUrl(
  db: NonNullable<ReturnType<typeof getDb>>,
  path: string
): Promise<string | null> {
  const { data, error } = await db.storage.from(STORAGE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * worker-vllm-omni / OpenAI-compatible image response:
 *   output.data[0].b64_json
 * Also tolerates the older nested shapes we used to see.
 */
function extractImageB64(output: unknown, depth = 0): string | null {
  if (!output || depth > 4) return null;

  if (typeof output === 'string') {
    if (/^https?:\/\//i.test(output)) return null; // URL-only result: not a b64 payload.
    if (/^data:image/i.test(output)) return stripDataUrl(output);
    if (/^[A-Za-z0-9+/=\s]{200,}$/.test(output)) return stripDataUrl(output);
    return null;
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const hit = extractImageB64(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  if (typeof output === 'object') {
    const obj = output as Record<string, unknown>;

    // Exact shape from the worker: { data: [{ b64_json, url }] }
    if (Array.isArray(obj.data)) {
      for (const item of obj.data) {
        if (item && typeof item === 'object') {
          const b64 = (item as Record<string, unknown>).b64_json;
          if (typeof b64 === 'string' && b64.trim()) return stripDataUrl(b64);
        }
      }
    }

    for (const key of ['b64_json', 'b64', 'base64', 'image', 'images', 'data', 'output']) {
      if (key in obj) {
        const hit = extractImageB64(obj[key], depth + 1);
        if (hit) return hit;
      }
    }
  }

  return null;
}

type ResultImage = {
  b64: string;
  mimeType: string;
};

/** FLUX.2 klein result shape: output.images[0].b64 + mime_type. */
function extractResultImage(output: unknown): ResultImage | null {
  const obj = output as Record<string, unknown> | null;
  if (obj && Array.isArray(obj.images)) {
    for (const item of obj.images) {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        const b64 = rec.b64;
        if (typeof b64 === 'string' && b64) {
          const mimeType = typeof rec.mime_type === 'string' && rec.mime_type
            ? rec.mime_type
            : 'image/webp';
          return { b64: stripDataUrl(b64), mimeType };
        }
      }
    }
  }

  // Backward compatibility with the old vLLM shape.
  const old = extractImageB64(output);
  if (old) return { b64: old, mimeType: 'image/png' };
  return null;
}

function mimeFromPath(path: string | null): string {
  if (!path) return 'image/webp';
  if (/\.png$/i.test(path)) return 'image/png';
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg';
  return 'image/webp';
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

function runpodErrorMessage(job: RunpodJob): string | null {
  if (typeof job.error === 'string' && job.error) return job.error;
  if (typeof job.detail === 'string' && job.detail) return job.detail;
  if (typeof job.message === 'string' && job.message) return job.message;
  if (typeof job.title === 'string' && job.title && job.title !== 'Forbidden') return job.title;
  const out = job.output as Record<string, unknown> | undefined;
  if (out && typeof out === 'object') {
    const msg = out.error ?? out.message ?? out.detail;
    if (typeof msg === 'string' && msg) return msg;
    const workerStatus = out.status;
    if (typeof workerStatus === 'number' && workerStatus >= 400) {
      return `RunPod worker returned status ${workerStatus}. Try a smaller image.`;
    }
    if (typeof workerStatus === 'string' && /^[45]\d\d$/.test(workerStatus)) {
      return `RunPod worker returned status ${workerStatus}. Try a smaller image.`;
    }
  }
  return null;
}

function getDb() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function getJobRow(db: ReturnType<typeof getDb>, requestId: string): Promise<JobRow | null> {
  if (!db) return null;
  const { data, error } = await db
    .from('ai_image_jobs')
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) throw new Error(`Could not read ai_image_jobs: ${error.message}`);
  return (data as JobRow | null) ?? null;
}

function publicJob(row: JobRow) {
  return {
    requestId: row.request_id,
    jobId: row.job_id,
    status: normalizeStatus(row.status) || 'PENDING',
  };
}

async function publicJobWithResult(
  db: NonNullable<ReturnType<typeof getDb>>,
  row: JobRow
): Promise<Record<string, unknown>> {
  const base = publicJob(row);
  if (normalizeStatus(row.status) === 'COMPLETED' && row.result_path) {
    const url = await makeSignedResultUrl(db, row.result_path);
    if (url) {
      return { ...base, url, path: row.result_path, mimeType: mimeFromPath(row.result_path) };
    }
  }
  return base;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json(405, { error: 'Use POST.' });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? 'start').trim().toLowerCase();
    const requestId = String(body.request_id ?? body.requestId ?? '').trim();
    const coupleId = String(body.couple_id ?? body.coupleId ?? '').trim();
    // Old app builds only understand b64. New builds send include_b64:false and
    // receive the short Storage URL instead. Default true keeps old builds alive.
    const includeB64 = body.include_b64 !== false;
    const endpoint = Deno.env.get('RUNPOD_ENDPOINT_ID') || DEFAULT_ENDPOINT;

    // Diagnostics: worker/queue health for the endpoint, no job created.
    if (action === 'health') {
      const healthKey = Deno.env.get('RUNPOD_API_KEY');
      if (!healthKey) return json(500, { error: 'RUNPOD_API_KEY is not set.' });
      const healthRes = await fetch(`${RUNPOD_BASE}/${endpoint}/health`, {
        headers: { Authorization: `Bearer ${healthKey}` },
      });
      const healthText = await healthRes.text();
      return new Response(healthText, {
        status: healthRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!requestId || requestId.length > 160) {
      return json(400, { error: 'Missing or invalid request_id.' });
    }

    const runpodKey = Deno.env.get('RUNPOD_API_KEY');
    if (!runpodKey) {
      return json(500, {
        error: 'RUNPOD_API_KEY is not set on the Supabase project. Run: supabase secrets set RUNPOD_API_KEY=rpa_...',
      });
    }

    const db = getDb();
    if (!db) {
      return json(500, {
        error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not available to the Edge Function.',
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${runpodKey}`,
    };

    // ---------------------------------------------------------------------
    // STATUS: cheap one-shot check. Client polls this until COMPLETED/FAILED.
    // Never submits a new RunPod job, so retries cannot double-charge.
    // ---------------------------------------------------------------------
    if (action === 'status') {
      const row = await getJobRow(db, requestId);
      if (!row) return json(404, { error: 'Unknown request_id.' });

      if (!row.job_id) {
        const status = normalizeStatus(row.status) || 'PENDING';
        if (isFailedStatus(status)) {
          return json(200, {
            requestId,
            jobId: null,
            status: 'FAILED',
            error: row.error || 'RunPod job failed.',
          });
        }
        return json(200, { requestId, jobId: null, status });
      }

      const pollRes = await fetch(`${RUNPOD_BASE}/${endpoint}/status/${row.job_id}`, { headers });
      const job = (await pollRes.json().catch(() => ({}))) as RunpodJob;

      if (!pollRes.ok) {
        return json(502, {
          requestId,
          jobId: row.job_id,
          status: 'ERROR',
          error: runpodErrorMessage(job) || `RunPod status check failed (HTTP ${pollRes.status}).`,
        });
      }

      const status = normalizeStatus(job.status) || normalizeStatus(row.status) || 'IN_QUEUE';

      // HTTP 200 can still mean FAILED. Trust the status field, not the code.
      if (isFailedStatus(status)) {
        const error = runpodErrorMessage(job) || `RunPod job ${status.toLowerCase()}.`;
        await db
          .from('ai_image_jobs')
          .update({ status: 'FAILED', error, updated_at: new Date().toISOString() })
          .eq('request_id', requestId);
        return json(200, { requestId, jobId: row.job_id, status: 'FAILED', error });
      }

      if (status === 'COMPLETED') {
        const result = extractResultImage(job.output);
        const b64 = result?.b64 ?? '';
        const mimeType = result?.mimeType || 'image/webp';
        if (!b64) {
          const error = runpodErrorMessage(job) || 'RunPod completed but returned no image (expected output.images[0].b64).';
          await db
            .from('ai_image_jobs')
            .update({ status: 'FAILED', error, updated_at: new Date().toISOString() })
            .eq('request_id', requestId);
          return json(200, { requestId, jobId: row.job_id, status: 'FAILED', error });
        }

        // Preferred path: store the image once, return a short signed URL.
        // result_path means later polls reuse the same object instead of
        // re-uploading (and avoid returning base64 over and over).
        let resultPath = row.result_path;
        let signedUrl: string | null = null;

        if (resultPath) {
          signedUrl = await makeSignedResultUrl(db, resultPath);
        } else {
          const targetCouple = row.couple_id || coupleId;
          const bytes = base64ToBytes(b64);
          if (targetCouple && bytes) {
            const ext = extensionForMime(mimeType);
            const path = `${targetCouple}/ai-edits/${requestId}.${ext}`;
            const { error: uploadError } = await db.storage
              .from(STORAGE_BUCKET)
              .upload(path, new Blob([bytes], { type: mimeType }), {
                contentType: mimeType,
                upsert: true,
              });
            if (!uploadError) {
              resultPath = path;
              signedUrl = await makeSignedResultUrl(db, path);
            } else {
              console.error('[ai-image-edit] storage upload failed:', uploadError.message);
            }
          }
        }

        await db
          .from('ai_image_jobs')
          .update({
            status: 'COMPLETED',
            error: null,
            result_path: resultPath,
            couple_id: row.couple_id || coupleId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('request_id', requestId);

        if (signedUrl) {
          return json(200, {
            requestId,
            jobId: row.job_id,
            status: 'COMPLETED',
            url: signedUrl,
            path: resultPath,
            mimeType,
            ...(includeB64 ? { b64 } : {}),
          });
        }

        // Fallback when Storage is unavailable: keep the base64 contract.
        return json(200, { requestId, jobId: row.job_id, status: 'COMPLETED', b64, mimeType });
      }

      await db
        .from('ai_image_jobs')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('request_id', requestId);
      return json(200, { requestId, jobId: row.job_id, status });
    }

    // ---------------------------------------------------------------------
    // START: idempotent submit. If this request_id already exists, return the
    // stored job_id instead of submitting (and paying for) a second job.
    // ---------------------------------------------------------------------
    if (action !== 'start' && action !== 'run') {
      return json(400, { error: `Unknown action "${action}". Use "start" or "status".` });
    }

    const prompt = String(body.prompt ?? '').trim();
    const imageBase64 = String(body.image_base64 ?? body.imageBase64 ?? '').trim();
    if (!prompt || !imageBase64) {
      return json(400, { error: 'Missing imageBase64 or prompt.' });
    }

    // Refuse blank / 1x1 / truncated images before spending any GPU time.
    const imageCheck = validateInputImage(imageBase64);
    if (!imageCheck.ok) {
      return json(400, { error: imageCheck.error });
    }
    const rawImageBase64 = imageCheck.raw;

    // One variation token per new job. It is stored on the row, so retries
    // reuse the exact same prompt instead of generating a different image.
    const newVariationToken = makeVariationToken();
    const newFinalPrompt = `${prompt} | variant:${newVariationToken}`;

    // Atomic-ish claim: primary-key insert only succeeds for the first caller.
    const { data: inserted, error: insertError } = await db
      .from('ai_image_jobs')
      .insert({
        request_id: requestId,
        status: 'PENDING',
        couple_id: coupleId || null,
        variation_token: newVariationToken,
        final_prompt: newFinalPrompt,
      })
      .select('*')
      .maybeSingle();

    let row = (inserted as JobRow | null) ?? null;
    let claimed = Boolean(row);

    if (insertError && insertError.code !== '23505') {
      if (/relation .* does not exist/i.test(insertError.message)) {
        return json(500, {
          error: 'The ai_image_jobs table does not exist. Run the SQL in docs/supabase-recreate.sql.md (or the migration) first.',
        });
      }
      return json(500, { error: `Could not create AI job: ${insertError.message}` });
    }

    if (!claimed) {
      row = await getJobRow(db, requestId);
      if (!row) return json(500, { error: 'AI job disappeared while being created.' });

      // Already submitted/completed/failed -> never submit again.
      if (row.job_id || row.status === 'COMPLETED' || isFailedStatus(row.status)) {
        if (isFailedStatus(row.status)) {
          return json(200, {
            requestId,
            jobId: row.job_id,
            status: 'FAILED',
            error: row.error || 'RunPod job failed.',
          });
        }
        return json(200, await publicJobWithResult(db, row));
      }

      // PENDING without a job_id: the first submit call is still in flight, or
      // it died. Only allow a retry to take over once it is clearly stale.
      const updatedAt = Date.parse(row.updated_at || row.created_at);
      const stale = !Number.isFinite(updatedAt) || Date.now() - updatedAt > STALE_PENDING_MS;
      if (stale) {
        const cutoff = new Date(Date.now() - STALE_PENDING_MS).toISOString();
        const { data: reclaimed } = await db
          .from('ai_image_jobs')
          .update({ status: 'PENDING', error: null, updated_at: new Date().toISOString() })
          .eq('request_id', requestId)
          .is('job_id', null)
          .lt('updated_at', cutoff)
          .select('*')
          .maybeSingle();
        if (reclaimed) {
          row = reclaimed as JobRow;
          claimed = true;
        }
      }

      if (!claimed) {
        // Still in flight elsewhere: tell the client to poll the same request.
        return json(200, publicJob(row));
      }
    }

    // Reuse the stored token/prompt for retries. Old rows created before this
    // column existed get backfilled once.
    const jobVariationToken = row?.variation_token || newVariationToken;
    const jobFinalPrompt = row?.final_prompt || `${prompt} | variant:${jobVariationToken}`;
    if (row && (!row.variation_token || !row.final_prompt)) {
      await db
        .from('ai_image_jobs')
        .update({
          variation_token: jobVariationToken,
          final_prompt: jobFinalPrompt,
          updated_at: new Date().toISOString(),
        })
        .eq('request_id', requestId);
    }

    const runpodRes = await fetch(`${RUNPOD_BASE}/${endpoint}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: {
          prompt:
            `${jobFinalPrompt}. Maintain the exact facial features, likenesses, and structural head placement of all subjects visible in the base photo 100% identical as an unchangeable blueprint.`,
          images: [`data:${imageCheck.mimeType};base64,${rawImageBase64}`],
          width: 1024,
          height: 1024,
          n: 1,
          steps: 20,
          guidance: 5.0,
          output_format: 'webp',
          quality: 90,
        },
      }),
    });

    const rawRunpod = await runpodRes.text().catch(() => '');
    let job: RunpodJob = {};
    try {
      job = JSON.parse(rawRunpod) as RunpodJob;
    } catch {
      job = {};
    }
    const runStatus = normalizeStatus(job.status);

    if (!runpodRes.ok || isFailedStatus(runStatus) || job.error) {
      const error = runpodErrorMessage(job) || `RunPod rejected the request (HTTP ${runpodRes.status}).`;
      await db
        .from('ai_image_jobs')
        .update({ status: 'FAILED', error, updated_at: new Date().toISOString() })
        .eq('request_id', requestId);
      return json(502, {
        requestId,
        jobId: job.id ?? null,
        status: 'FAILED',
        error,
      });
    }

    if (!job.id) {
      const error = runpodErrorMessage(job) || 'RunPod accepted the request but returned no job id.';
      await db
        .from('ai_image_jobs')
        .update({ status: 'FAILED', error, updated_at: new Date().toISOString() })
        .eq('request_id', requestId);
      return json(502, { requestId, jobId: null, status: 'FAILED', error });
    }

    const status = runStatus || 'IN_QUEUE';
    await db
      .from('ai_image_jobs')
      .update({ job_id: job.id, status, error: null, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);

    return json(200, { requestId, jobId: job.id, status });
  } catch (e) {
    return json(500, { error: `AI editor crashed: ${String(e)}` });
  }
});
