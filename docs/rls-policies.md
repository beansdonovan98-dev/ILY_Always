# RLS & storage policies (quick start)

Run this in Supabase SQL editor to unblock uploads (permissive for testing; tighten later):

```sql
-- media table
alter table media enable row level security;
drop policy if exists "media_all" on media;
create policy "media_all" on media for all using (true) with check (true);

-- days
alter table days enable row level security;
drop policy if exists "days_all" on days;
create policy "days_all" on days for all using (true) with check (true);

-- log_events
alter table log_events enable row level security;
drop policy if exists "log_events_all" on log_events;
create policy "log_events_all" on log_events for all using (true) with check (true);

-- couple_settings
alter table couple_settings enable row level security;
drop policy if exists "couple_settings_all" on couple_settings;
create policy "couple_settings_all" on couple_settings for all using (true) with check (true);

-- storage
drop policy if exists "storage_all" on storage.objects;
create policy "storage_all" on storage.objects
  for all
  using (bucket_id in ('couple-media','couple-private'))
  with check (bucket_id in ('couple-media','couple-private'));
```