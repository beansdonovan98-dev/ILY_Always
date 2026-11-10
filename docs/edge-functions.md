# Edge Functions

Two functions live in `supabase/functions/`. Deploy them once (needs the
Supabase CLI — `npm i -g supabase`, `supabase login`, `supabase link --project-ref <ref>`):

```bash
supabase functions deploy ai-image-edit
supabase functions deploy send-push
```

## `ai-image-edit` (Dirty Darkroom 🔥)

Uses RunPod's **async** endpoints (`/run` + `/status/{job_id}`), never
`/runsync`, so cold starts can take minutes without hitting the 150s Edge
Function timeout.

Secrets needed:

```bash
supabase secrets set RUNPOD_API_KEY=rpa_...
# optional, defaults to 7ckfcko9p6h503
supabase secrets set RUNPOD_ENDPOINT_ID=7ckfcko9p6h503
```

The function also needs the `ai_image_jobs` table. Run this once in the
Supabase SQL editor (also included in `docs/supabase-recreate.sql.md`):

```sql
create table if not exists ai_image_jobs (
  request_id  text primary key,
  job_id      text,
  status      text default 'PENDING',
  error       text,
  couple_id   text,
  result_path text,
  variation_token text,
  final_prompt text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table ai_image_jobs enable row level security;
drop policy if exists "ai_image_jobs_all" on ai_image_jobs;
-- No anon policy on purpose: only the ai-image-edit Edge Function's service
-- role reads/writes job rows. The Expo app never queries this table directly.
```

(Or apply both migrations in `supabase/migrations/`.)

### How the app talks to it

1. `POST { action: "start", request_id, couple_id, imageBase64, prompt }`
   - Validates the source image **before** calling RunPod: non-empty, at least
     20k base64 chars, valid JPEG/PNG/WebP magic bytes, and dimensions at least
     64×64. Blank/1×1/truncated images are rejected with HTTP 400 and cost no
     GPU time.
   - Inserts `{ request_id, status: "PENDING", couple_id }` first (primary-key
     dedupe).
   - Submits `POST https://api.runpod.ai/v2/<endpoint>/run`.
   - Stores `{ job_id, status }` and returns immediately.
   - A retry with the same `request_id` returns the stored `job_id` instead of
     submitting a second paid job.
2. `POST { action: "status", request_id, couple_id }` repeatedly until done.
   - `COMPLETED` → uploads the PNG to Supabase Storage at
     `couple-private/<couple_id>/ai-edits/<request_id>.png` and returns a
     7-day signed `url`. Falls back to `b64` if Storage fails.
   - `FAILED` / `CANCELLED` / `TIMED_OUT` → returns the error and stops.
   - `IN_QUEUE` / `IN_PROGRESS` / `RUNNING` / `PENDING` → keep polling.
   - HTTP 200 with `status: "FAILED"` is treated as a failure.

The client prefers `url` and falls back to `data:image/png;base64,...` when
Storage is unavailable. The pending `{ request_id, couple_id }` is persisted
in AsyncStorage so reopening the app can re-check the job without resubmitting.

### About "censored" / uncensored models

Fooocus-style (Stable Diffusion, no cloud filter) **cannot run inside the
iPhone app** — it needs a beefy GPU (an RTX card is typical) and ~8GB+ VRAM.
Hosted APIs apply their own content filters, so no hosted option is truly
"uncensored." A home PC with an NVIDIA GPU running Fooocus/ComfyUI can be
reached over Wi-Fi, but that is a separate local-server project.

## `send-push` (partner notifications)

Notifies your partner when you log in, add a daily cover photo, or post in
Playtime. Needs only the project's `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, which Supabase provides to functions
automatically. Also needs the `push_tokens` table from the SQL doc.
