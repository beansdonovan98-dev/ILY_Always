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

-- Let the anon key (the app) read/write these tables.
grant select, insert, update, delete on
  couple_settings,
  health_body,
  health_weights,
  health_meds,
  health_med_logs,
  health_fitness,
  health_period_state,
  health_period_days
to anon, authenticated;
```

## If `health_meds` already exists with the old shape

The old version had `taken`/`date_key`/`time_label`. If you already ran an
older script, replace it (it's empty/unused):

```sql
drop table if exists health_meds cascade;
```

then re-run section 2.
