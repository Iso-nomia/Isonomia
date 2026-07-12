create extension if not exists pgcrypto;

create table if not exists scroll_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid not null,
  pathname text not null,
  scroll_pause int not null,
  dwell_time int not null,
  created_at timestamptz not null default now()
);

alter table scroll_events enable row level security;
create policy "Users can insert their own events"
  on scroll_events
  for insert
  with check (auth.uid() = user_id);
