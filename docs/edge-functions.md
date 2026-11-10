# Edge Functions

Three functions live in `supabase/functions/`. Deploy them once (needs the
Supabase CLI — `npm i -g supabase`, `supabase login`, `supabase link --project-ref <ref>`):

```bash
supabase functions deploy ai-image-edit
supabase functions deploy send-push
supabase functions deploy send-daily-code
```

## `ai-image-edit` (Dirty Darkroom 🔥)

Uses RunPod's **async** endpoints (`/run` + `/status/{job_id}`), never
`/runsync`, so cold starts can take minutes without hitting the 150s Edge
Function timeout.

Secrets needed:

```bash
supabase secrets set RUNPOD_API_KEY=rpa_...
# optional, defaults to pq2pwxs2hxv7sf
supabase secrets set RUNPOD_ENDPOINT_ID=pq2pwxs2hxv7sf
```

The function also needs the `ai_image_jobs` table. Run this once in the
Supabase SQL editor (also included in `docs/supabase-recreate.sql.md`):

```sql
create table if not exists ai_image_jobs (
  request_id  text primary key,
  job_id      text,
  status      text default 'PENDING',
  error       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table ai_image_jobs enable row level security;
drop policy if exists "ai_image_jobs_all" on ai_image_jobs;
create policy "ai_image_jobs_all" on ai_image_jobs
  for all using (true) with check (true);
grant select, insert, update, delete on ai_image_jobs to anon, authenticated;
```

(Or apply `supabase/migrations/20261109000100_ai_image_jobs.sql`.)

### How the app talks to it

1. `POST { action: "start", request_id, imageBase64, prompt }`
   - Inserts `{ request_id, status: "PENDING" }` first (primary-key dedupe).
   - Submits `POST https://api.runpod.ai/v2/<endpoint>/run`.
   - Stores `{ job_id, status }` and returns immediately.
   - A retry with the same `request_id` returns the stored `job_id` instead of
     submitting a second paid job.
2. `POST { action: "status", request_id }` repeatedly until done.
   - `COMPLETED` → returns `b64` parsed from `output.data[0].b64_json`.
   - `FAILED` / `CANCELLED` / `TIMED_OUT` → returns the error and stops.
   - `IN_QUEUE` / `IN_PROGRESS` / `RUNNING` / `PENDING` → keep polling.
   - HTTP 200 with `status: "FAILED"` is treated as a failure.

The client turns the base64 into `data:image/png;base64,...` for display.

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

## `send-daily-code` (SMS room code)

Sends the daily room code through Twilio. Needs `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` secrets.
