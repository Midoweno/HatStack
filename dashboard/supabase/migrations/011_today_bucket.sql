-- Run this in the Supabase SQL editor.
-- Adds a third Priority-view section, "Today", alongside Priority and Future.
-- The star_bucket column only allowed 'priority' and 'future', so widen the
-- check constraint to accept 'today' too.

alter table tasks
  drop constraint if exists tasks_star_bucket_check;

alter table tasks
  add constraint tasks_star_bucket_check
  check (star_bucket in ('priority', 'future', 'today'));
