# SQL to run in Supabase SQL editor (safe to re-run)

You deleted `couple_settings`, so re-run this whole block to recreate it
and add the health tables the app expects. Column names match `lib/health.ts`
and `lib/appearance.ts` exactly.

## 1. `couple_settings` (shared theme / fonts / colors — one row per couple)

```sql
create table if not exists couple_settings (
  couple_id           text primary key,
  background_color    text,
  background_gradient text,
  accent_color        text,
  font_id             text,
  font_color          text,
  subtitle_color      text,
  border_color        text,
  animated_gradient   boolean default false,
  daily_rotation      boolean default false,
  tab_config          jsonb,
  playtime_revealed   boolean default false,
  avatar_daddy        text,
  avatar_princess     text,
  love_notes          jsonb,
  updated_at          timestamptz default now()
);
```

## 2. Health tables

```sql
-- Body measurements — one row per person, overwritten on save.
create table if not exists health_body (
  id          uuid primary key default gen_random_uuid(),
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  chest       text default '',
  waist       text default '',
  hips        text default '',
  biceps      text default '',
  thighs      text default '',
  body_fat    text default '',
  updated_at  timestamptz default now()
);
create unique index if not exists health_body_unique
  on health_body (couple_id, user_key);

-- Weight log — permanent history, never reset.
create table if not exists health_weights (
  id          text primary key,
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  value       numeric not null,
  date_key    date not null,
  logged_at   timestamptz default now()
);
create index if not exists health_weights_lookup
  on health_weights (couple_id, user_key, logged_at);

-- Medicines / supplements — the recurring list + reminder settings.
create table if not exists health_meds (
  id            text primary key,
  couple_id     text not null,
  name          text not null,
  dosage        text default '',
  schedule_time text default '',
  reminder      boolean not null default false,
  created_at    timestamptz default now()
);
create index if not exists health_meds_lookup on health_meds (couple_id);

-- Dose log — one row every time a dose is actually taken, with the time.
create table if not exists health_med_logs (
  id          text primary key,
  couple_id   text not null,
  med_id      text not null,
  name        text not null,
  dosage      text default '',
  time_label  text default '',
  taken_at    timestamptz default now(),
  date_key    date not null
);
create index if not exists health_med_logs_lookup
  on health_med_logs (couple_id, date_key, taken_at);

-- Fitness — per person, one row per exercise, today only in the UI.
create table if not exists health_fitness (
  id          text primary key,
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  exercise    text not null,
  sets        text default '',
  reps        text default '',
  minutes     text default '',
  date_key    date not null,
  created_at  timestamptz default now()
);
create index if not exists health_fitness_lookup
  on health_fitness (couple_id, user_key, date_key);

-- Period tracker — one state row per person.
create table if not exists health_period_state (
  id          uuid primary key default gen_random_uuid(),
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  start_date  date,
  end_date    date,
  updated_at  timestamptz default now()
);
create unique index if not exists health_period_state_unique
  on health_period_state (couple_id, user_key);

-- Period tracker — one check-in row per day (the daily tick marks).
create table if not exists health_period_days (
  id          uuid primary key default gen_random_uuid(),
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  date_key    date not null,
  pain        int default 0,
  symptoms    jsonb default '[]'::jsonb,
  completed   boolean default true,
  updated_at  timestamptz default now()
);
create unique index if not exists health_period_days_unique
  on health_period_days (couple_id, user_key, date_key);

-- Daily health list — same fixed list for both, never resets.
-- One row per person per task per day; `completed` is the cross-out.
create table if not exists health_daily_checks (
  id          uuid primary key default gen_random_uuid(),
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  task_id     text not null,
  date_key    date not null,
  completed   boolean not null default false,
  updated_at  timestamptz default now()
);
create unique index if not exists health_daily_checks_unique
  on health_daily_checks (couple_id, user_key, task_id, date_key);

-- Water tracker — cups per person per day (goal: 4).
create table if not exists health_water (
  id          uuid primary key default gen_random_uuid(),
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  date_key    date not null,
  cups        int not null default 0,
  updated_at  timestamptz default now()
);
create unique index if not exists health_water_unique
  on health_water (couple_id, user_key, date_key);

-- Push tokens — one Expo push token per partner phone.
create table if not exists push_tokens (
  couple_id       text not null,
  user_key        text not null check (user_key in ('daddy','princess')),
  expo_push_token text not null,
  updated_at      timestamptz default now(),
  primary key (couple_id, user_key)
);

-- Presence — partner online banner + push on login/dose.
create table if not exists presence (
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  last_seen   timestamptz default now(),
  primary key (couple_id, user_key)
);

-- Activity flags — powers the purple/pink unread dots in the menu.
create table if not exists activity_flags (
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  route       text not null,
  posted_at   timestamptz default now(),
  seen_at     timestamptz,
  primary key (couple_id, user_key, route)
);

-- Cleaning checks — shared household-chore ticks, keyed by cadence + cycle.
create table if not exists cleaning_checks (
  couple_id   text not null,
  cadence     text not null check (cadence in ('daily','twoDay','weekly','focus')),
  task_id     text not null,
  cycle_key   text not null,
  completed   boolean not null default false,
  updated_at  timestamptz default now(),
  primary key (couple_id, cadence, task_id, cycle_key)
);

-- Daily health list — the editable, shared task list (same for both).
create table if not exists health_daily_list (
  couple_id   text not null,
  task_id     text not null,
  label       text not null,
  emoji       text not null default '🌿',
  created_at  timestamptz default now(),
  primary key (couple_id, task_id)
);
```

## 3. Permissive RLS (matches the current no-auth app)

```sql
alter table couple_settings     enable row level security;
alter table health_body         enable row level security;
alter table health_weights      enable row level security;
alter table health_meds         enable row level security;
alter table health_med_logs     enable row level security;
alter table health_fitness      enable row level security;
alter table health_period_state enable row level security;
alter table health_period_days  enable row level security;
alter table health_daily_checks enable row level security;
alter table health_daily_list   enable row level security;
alter table health_water        enable row level security;
alter table push_tokens         enable row level security;
alter table presence            enable row level security;
alter table activity_flags      enable row level security;
alter table cleaning_checks    enable row level security;

drop policy if exists "couple_settings_all" on couple_settings;
create policy "couple_settings_all" on couple_settings
  for all using (true) with check (true);

drop policy if exists "health_body_all" on health_body;
create policy "health_body_all" on health_body
  for all using (true) with check (true);

drop policy if exists "health_weights_all" on health_weights;
create policy "health_weights_all" on health_weights
  for all using (true) with check (true);

drop policy if exists "health_meds_all" on health_meds;
create policy "health_meds_all" on health_meds
  for all using (true) with check (true);

drop policy if exists "health_med_logs_all" on health_med_logs;
create policy "health_med_logs_all" on health_med_logs
  for all using (true) with check (true);

drop policy if exists "health_fitness_all" on health_fitness;
create policy "health_fitness_all" on health_fitness
  for all using (true) with check (true);

drop policy if exists "health_period_state_all" on health_period_state;
create policy "health_period_state_all" on health_period_state
  for all using (true) with check (true);

drop policy if exists "health_period_days_all" on health_period_days;
create policy "health_period_days_all" on health_period_days
  for all using (true) with check (true);

drop policy if exists "health_daily_checks_all" on health_daily_checks;
create policy "health_daily_checks_all" on health_daily_checks
  for all using (true) with check (true);

drop policy if exists "health_daily_list_all" on health_daily_list;
create policy "health_daily_list_all" on health_daily_list
  for all using (true) with check (true);

drop policy if exists "health_water_all" on health_water;
create policy "health_water_all" on health_water
  for all using (true) with check (true);

drop policy if exists "push_tokens_all" on push_tokens;
create policy "push_tokens_all" on push_tokens
  for all using (true) with check (true);

drop policy if exists "presence_all" on presence;
create policy "presence_all" on presence
  for all using (true) with check (true);

drop policy if exists "activity_flags_all" on activity_flags;
create policy "activity_flags_all" on activity_flags
  for all using (true) with check (true);

drop policy if exists "cleaning_checks_all" on cleaning_checks;
create policy "cleaning_checks_all" on cleaning_checks
  for all using (true) with check (true);

-- Let the anon key (the app) read/write these tables.
grant select, insert, update, delete on
  couple_settings,
  health_body,
  health_weights,
  health_meds,
  health_med_logs,
  health_fitness,
  health_period_state,
  health_period_days,
  health_daily_checks,
  health_daily_list,
  health_water,
  push_tokens,
  presence,
  cleaning_checks
to anon, authenticated;
```

## Push notifications (optional but recommended)

The app pings your partner when you log in, add a daily cover photo, or post
in Playtime. For that to work:

1. Run the `push_tokens` SQL above.
2. In the repo, run once: `supabase functions deploy send-push`
   (needs the Supabase CLI: `npm i -g supabase` + `supabase login` + `supabase link --project-ref <ref>`).
   The function lives at `supabase/functions/send-push/index.ts` and uses the
   project's service-role key automatically.

## If `health_meds` already exists with the old shape

The old version had `taken`/`date_key`/`time_label`. If you already ran an
older script, replace it (it's empty/unused):

```sql
drop table if exists health_meds cascade;
```

then re-run section 2.

## Letter replies + shared DBT answers (run once)

The love letter now has a separate reply letter (same 3-stage reveal) that
never overwrites the original, and DBT answers are shared with your partner.
Run this block in the Supabase SQL editor:

```sql
-- Love letter (main + reply)
alter table couple_settings add column if not exists letter_body text;
alter table couple_settings add column if not exists secret_message text;
alter table couple_settings add column if not exists final_message text;
alter table couple_settings add column if not exists letter_updated_at timestamptz;
alter table couple_settings add column if not exists letter_reply_body text;
alter table couple_settings add column if not exists letter_reply_secret text;
alter table couple_settings add column if not exists letter_reply_final text;
alter table couple_settings add column if not exists letter_reply_from text;
alter table couple_settings add column if not exists letter_reply_at timestamptz;

-- Shared DBT responses (journal + assignment, both partners)
create table if not exists dbt_responses (
  id          uuid primary key default gen_random_uuid(),
  couple_id   text not null,
  window_key  text not null,
  skill_id    text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  response    text default '',
  updated_at  timestamptz default now()
);
create unique index if not exists dbt_responses_unique
  on dbt_responses (couple_id, window_key, skill_id, user_key);

alter table dbt_responses enable row level security;
drop policy if exists "dbt_responses_all" on dbt_responses;
create policy "dbt_responses_all" on dbt_responses
  for all using (true) with check (true);

grant select, insert, update, delete on dbt_responses to anon, authenticated;

-- Live partner updates (safe if already enabled)
do $$
begin
  alter publication supabase_realtime add table dbt_responses;
exception when duplicate_object then null;
end $$;

-- Darkroom job tracker (async RunPod jobs, so long generations never time out)
create table if not exists ai_image_jobs (
  request_id  text primary key,
  job_id      text,
  status      text default 'PENDING',
  error       text,
  couple_id   text,
  result_path text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table ai_image_jobs enable row level security;
-- No anon policy on purpose: only the Edge Function (service role) touches it.
```
