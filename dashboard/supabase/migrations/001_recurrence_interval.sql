-- Run this in the Supabase SQL editor to add custom recurrence intervals
-- (e.g. "every 3 days") to an already-created tasks table.

alter table tasks
  add column if not exists recurrence_interval integer not null default 1
    check (recurrence_interval >= 1);
