# Health tables + permissive policies

Paste this whole block into the Supabase SQL editor. Safe to re-run.

It matches the health model in `lib/health.ts`:
body measurements (3-day reset), permanent weight history, medicine
list with daily dose logs + reminders, daily fitness log, and the period
tracker (state + one row per check-in day).

```sql
-- ---------------------------------------------------------------
-- Health tables
-- ---------------------------------------------------------------

-- Body measurements — one row per person, overwritten on save.
create table if not exists health_body (
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  chest       text default '',
  waist       text default '',
  hips        text default '',
  biceps      text default '',
  thighs      text default '',
  body_fat    text default '',
  updated_at  timestamptz not null default now(),
  primary key (couple_id, user_key)
);

-- Weight log — permanent history, never reset.
create table if not exists health_weights (
  id          text primary key default gen_random_uuid()::text,
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  value       numeric not null check (value > 0),
  date_key    date not null,
  logged_at   timestamptz not null default now()
);
create index if not exists health_weights_lookup
  on health_weights (couple_id, user_key, logged_at);

-- Medicines / supplements — the recurring list + reminder settings.
create table if not exists health_meds (
  id            text primary key default gen_random_uuid()::text,
  couple_id     text not null,
  name          text not null,
  dosage        text default '',
  schedule_time text default '',
  reminder      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists health_meds_lookup on health_meds (couple_id);

-- Dose log — one row every time a dose is actually taken, with the time.
create table if not exists health_med_logs (
  id          text primary key default gen_random_uuid()::text,
  couple_id   text not null,
  med_id      text not null,
  name        text not null,
  dosage      text default '',
  time_label  text default '',
  taken_at    timestamptz not null default now(),
  date_key    date not null default current_date
);
create index if not exists health_med_logs_lookup
  on health_med_logs (couple_id, date_key, taken_at);

-- Fitness — per person, one row per exercise, today only in the UI.
create table if not exists health_fitness (
  id          text primary key default gen_random_uuid()::text,
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  exercise    text not null,
  sets        text default '',
  reps        text default '',
  minutes     text default '',
  date_key    date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists health_fitness_lookup
  on health_fitness (couple_id, user_key, date_key);

-- Period tracker — one state row per person.
create table if not exists health_period_state (
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  start_date  date,
  end_date    date,
  updated_at  timestamptz not null default now(),
  primary key (couple_id, user_key)
);

-- Period tracker — one check-in row per day (the daily tick marks).
create table if not exists health_period_days (
  couple_id   text not null,
  user_key    text not null check (user_key in ('daddy','princess')),
  date_key    date not null,
  pain        int not null default 0 check (pain between 0 and 10),
  symptoms    text[] not null default '{}',
  completed   boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (couple_id, user_key, date_key)
);

-- ---------------------------------------------------------------
-- Permissive RLS (matches the current no-auth app)
-- ---------------------------------------------------------------

alter table health_body         enable row level security;
alter table health_weights      enable row level security;
alter table health_meds         enable row level security;
alter table health_med_logs     enable row level security;
alter table health_fitness      enable row level security;
alter table health_period_state enable row level security;
alter table health_period_days  enable row level security;

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
  health_body,
  health_weights,
  health_meds,
  health_med_logs,
  health_fitness,
  health_period_state,
  health_period_days
to anon, authenticated;
```

## If you already ran the first version of `health_meds`
That version had `taken`, `date_key` and `time_label`. Replace it with the
new shape (or just drop the table and re-run the block above, since it was
not in use yet):

```sql
drop table if exists health_meds cascade;
```

Then run the full block again.

## Notes
- `user_key` is `daddy` or `princess`, so each partner's rows are isolated by key.
- `health_weights` is never cleared; `health_med_logs` keeps the exact time a dose was taken.
- The med log's `date_key` makes "today's doses" cheap; old rows are kept as history.
- Reminders are local iPhone notifications scheduled daily at `schedule_time`; `reminder` stores whether the toggle is on.
- Body measurements expire after 3 days — that rule stays in the client.
- Period tables are only used when the Period Tracker is revealed in Settings.
- This is permissive for testing (same as `media`, `days`, `log_events`). When you add real auth, swap `using (true)` for a couple-membership check.
