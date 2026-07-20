-- Run this in the Supabase SQL editor.
-- Links an auto-created recurring task occurrence back to the task instance
-- that was completed to spawn it, so un-completing that instance can remove
-- the spawned occurrence again (instead of leaving an orphaned duplicate).

alter table tasks
  add column if not exists recurrence_parent_id uuid references tasks(id) on delete set null;
