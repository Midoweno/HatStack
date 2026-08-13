-- Run this in the Supabase SQL editor.
-- Adds the FIT tab: a free-text workout note per real calendar date, and a
-- reusable drill library you can drag into a day. The Calendar tab reuses
-- the existing tasks table (tasks with a due_date), so it needs no schema
-- change of its own.

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists drills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists workouts_user_id_idx on workouts(user_id);
create index if not exists drills_user_id_idx on drills(user_id);

alter table workouts enable row level security;
alter table drills enable row level security;

create policy "workouts: owner full access" on workouts
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "drills: owner full access" on drills
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter publication supabase_realtime add table workouts;
alter publication supabase_realtime add table drills;
