-- Run this in the Supabase SQL editor.
-- Adds a single "current task" pin, shown above Priority/Future. At most one
-- task is pinned at a time — enforced in the app, not the database.

alter table tasks
  add column if not exists pinned boolean not null default false;
