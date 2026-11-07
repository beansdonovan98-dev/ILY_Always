# Supabase setup (media, days, logs, appearance)

Run these in the Supabase SQL editor for your new project.

## Storage buckets
```sql
insert into storage.buckets (id, name, public) values ('couple-media', 'couple-media', false);
insert into storage.buckets (id, name, public) values ('couple-private', 'couple-private', false);
```

## Tables
```sql
create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  couple_id text not null,
  kind text not null check (kind in ('shared','private')),
  storage_path text not null,
  file_name text,
  mime_type text,
  byte_size bigint,
  width int,
  height int,
  caption text,
  captions jsonb default '{}'::jsonb,
  comments jsonb default '[]'::jsonb,
  daily_date date,
  uploaded_by text,
  created_at timestamptz default now()
);

create table if not exists days (
  couple_id text not null,
  local_date date not null,
  payload jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  primary key (couple_id, local_date)
);

create table if not exists log_events (
  id uuid primary key default gen_random_uuid(),
  couple_id text not null,
  emoji text,
  name text,
  color text,
  created_at timestamptz default now()
);

create table if not exists couple_settings (
  couple_id text primary key,
  background_color text,
  background_gradient text,
  accent_color text,
  font_id text,
  font_color text,
  border_color text,
  animated_gradient boolean default false,
  daily_rotation boolean default false,
  updated_at timestamptz default now()
);
```

## Realtime
Enable Realtime on `couple_settings` (and optionally `media`, `days`) in Supabase dashboard.

## Storage policies
Add RLS policies so only couple members can read/write their objects. Private bucket must additionally gate on private access rules.

## Notes
- Media binaries go to Storage only; never in Postgres.
- Signed URLs only; buckets are private.
- Deleting a media row should delete its storage object (handled in app).