-- Idempotency/deduping for Dirty Darkroom (RunPod async image edits).
-- The Edge Function uses the service role, so no client policies are needed.
create table if not exists public.ai_image_jobs (
  request_id text primary key,
  job_id     text,
  status     text not null default 'PENDING',
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_image_jobs_job_id_idx on public.ai_image_jobs (job_id);
create index if not exists ai_image_jobs_status_idx on public.ai_image_jobs (status);

alter table public.ai_image_jobs enable row level security;

-- Intentionally no anon/authenticated policies: clients must go through the
-- ai-image-edit Edge Function, which owns the RunPod key and the job records.
