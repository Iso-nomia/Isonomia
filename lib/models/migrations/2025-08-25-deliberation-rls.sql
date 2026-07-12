-- Example: allow read to anyone for public hosts; restrict writes to room members
-- Replace room membership checks with your real schema.

alter table deliberations enable row level security;
alter table arguments enable row level security;
alter table argument_edges enable row level security;
alter table argument_approvals enable row level security;
alter table viewpoint_selections enable row level security;
alter table viewpoint_arguments enable row level security;

-- Read: public if deliberation.room_id IS NULL OR room is public; else members
create policy "delib_read_public_or_member"
on deliberations for select
to authenticated, anon
using (
  room_id is null
  or exists (select 1 from room_members rm join rooms r on r.id = rm.room_id
             where rm.user_id = auth.uid() and rm.room_id = deliberations.room_id)
);

-- Write: only members (or authors) of the room
create policy "delib_write_member"
on deliberations for insert
to authenticated
with check (
  exists (select 1 from room_members rm where rm.user_id = auth.uid()
    and rm.room_id = deliberations.room_id)
);

-- Child tables inherit via FK join on deliberation_id
create policy "args_read_public_or_member"
on arguments for select to authenticated, anon
using (
  exists (select 1 from deliberations d where d.id = arguments.deliberation_id
          and (d.room_id is null or exists (select 1 from room_members rm
                where rm.user_id = auth.uid() and rm.room_id = d.room_id)))
);

create policy "args_write_member"
on arguments for insert to authenticated
with check (
  exists (select 1 from deliberations d
          join room_members rm on rm.room_id = d.room_id
          where d.id = arguments.deliberation_id and rm.user_id = auth.uid())
);

-- Repeat similar policies for argument_edges, argument_approvals, viewpoint_*.
