-- Store completed Darkroom results in Supabase Storage instead of returning
-- multi-MB base64 JSON on every poll.
alter table public.ai_image_jobs add column if not exists couple_id text;
alter table public.ai_image_jobs add column if not exists result_path text;

create index if not exists ai_image_jobs_result_path_idx
  on public.ai_image_jobs (result_path)
  where result_path is not null;

-- Only the ai-image-edit Edge Function (service role) should touch job rows.
-- The Expo client never queries this table directly.
alter table public.ai_image_jobs enable row level security;
drop policy if exists "ai_image_jobs_all" on public.ai_image_jobs;
revoke all on public.ai_image_jobs from anon, authenticated;
