-- Per-job variation token so the same prompt can produce fresh results while
-- retries/polling reuse the exact same stored prompt.
alter table public.ai_image_jobs add column if not exists variation_token text;
alter table public.ai_image_jobs add column if not exists final_prompt text;
