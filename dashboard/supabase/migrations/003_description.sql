-- Run this in the Supabase SQL editor.
-- Adds an optional description field to projects and tasks, shown only in
-- the edit/detail views (not on the compact dashboard cards).

alter table projects
  add column if not exists description text;

alter table tasks
  add column if not exists description text;
