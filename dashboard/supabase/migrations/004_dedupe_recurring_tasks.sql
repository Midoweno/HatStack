-- Run this in the Supabase SQL editor.
--
-- Fixes duplicate recurring-task occurrences (e.g. two "Today" rows for the
-- same daily task) that could happen when two devices completed the same
-- occurrence around the same time, each independently spawning a "next
-- occurrence" row.
--
-- Step 1: de-duplicate existing rows. For each recurrence_parent_id, keep
-- one row (preferring a completed one, to preserve archive history) and
-- delete the rest.
with ranked as (
  select id,
         row_number() over (
           partition by recurrence_parent_id
           order by completed desc, created_at asc
         ) as rn
  from tasks
  where recurrence_parent_id is not null
)
delete from tasks
where id in (select id from ranked where rn > 1);

-- Step 2: prevent it from happening again — each completed occurrence may
-- spawn at most one successor.
alter table tasks
  add constraint tasks_recurrence_parent_id_unique unique (recurrence_parent_id);
