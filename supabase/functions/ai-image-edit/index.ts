import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RUNPOD_BASE = 'https://api.runpod.ai/v2';
const DEFAULT_ENDPOINT = 'pq2pwxs2hxv7sf';

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
  output?: unknown;
};

type JobRow = {
  request_id: string;
  job_id: string | null;
  status: string;
  error: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeStatus(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function isFailedStatus(status: string): boolean {
  return status === 'FAILED' || status === 'CANCELLED' || status === 'TIMED_OUT';
}

function stripDataUrl(value: string): string {
  return value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s/g, '');
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

function runpodErrorMessage(job: RunpodJob): string | null {
  if (typeof job.error === 'string' && job.error) return job.error;
  const out = job.output as Record<string, unknown> | undefined;
  if (out && typeof out === 'object') {
    const msg = out.error ?? out.message ?? out.detail;
    if (typeof msg === 'string' && msg) return msg;
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
    const endpoint = Deno.env.get('RUNPOD_ENDPOINT_ID') || DEFAULT_ENDPOINT;

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
        const b64 = extractImageB64(job.output);
        if (!b64) {
          const error = runpodErrorMessage(job) || 'RunPod completed but returned no image (expected output.data[0].b64_json).';
          await db
            .from('ai_image_jobs')
            .update({ status: 'FAILED', error, updated_at: new Date().toISOString() })
            .eq('request_id', requestId);
          return json(200, { requestId, jobId: row.job_id, status: 'FAILED', error, debug_output: job.output });
        }

        await db
          .from('ai_image_jobs')
          .update({ status: 'COMPLETED', error: null, updated_at: new Date().toISOString() })
          .eq('request_id', requestId);
        return json(200, { requestId, jobId: row.job_id, status: 'COMPLETED', b64 });
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

    // Atomic-ish claim: primary-key insert only succeeds for the first caller.
    const { data: inserted, error: insertError } = await db
      .from('ai_image_jobs')
      .insert({ request_id: requestId, status: 'PENDING' })
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
        return json(200, publicJob(row));
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

    const runpodRes = await fetch(`${RUNPOD_BASE}/${endpoint}/run`, {
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

    const job = (await runpodRes.json().catch(() => ({}))) as RunpodJob;
    const runStatus = normalizeStatus(job.status);

    if (!runpodRes.ok || isFailedStatus(runStatus) || job.error) {
      const error = runpodErrorMessage(job) || `RunPod rejected the request (HTTP ${runpodRes.status}).`;
      await db
        .from('ai_image_jobs')
        .update({ status: 'FAILED', error, updated_at: new Date().toISOString() })
        .eq('request_id', requestId);
      return json(502, { requestId, jobId: job.id ?? null, status: 'FAILED', error });
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
