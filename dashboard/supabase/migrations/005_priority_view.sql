-- Run this in the Supabase SQL editor.
-- Adds the fields backing the new one-column "Priority" view: a star flag
-- and a manual ranking (also doubles as "most recently starred" ordering
-- until the user drags things around).

alter table tasks
  add column if not exists starred boolean not null default false,
  add column if not exists star_order bigint;
