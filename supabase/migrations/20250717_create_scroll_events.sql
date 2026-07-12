-- Scroll events captured when a user lingers on a post or room
create table if not exists scroll_events (
  id          bigserial primary key,
  user_id     uuid        not null,
  content_id  uuid,                     -- optional: post / room / media id
  dwell_ms    integer     not null,     -- how long the user stayed, ms
  created_at  timestamptz not null default now()
);

-- (optional) index for queries grouped by user
create index if not exists scroll_events_user_idx on scroll_events (user_id);
