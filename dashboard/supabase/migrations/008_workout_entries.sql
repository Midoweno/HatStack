-- Run this in the Supabase SQL editor.
-- FIT days can now only hold drills picked from the library — no more free
-- text. Replaces the old free-text `notes` column with a structured
-- `entries` list (each `{id, drillId}`, so the same drill can be placed on
-- a day more than once and each placement removed independently).

alter table workouts
  add column if not exists entries jsonb not null default '[]'::jsonb;

alter table workouts
  drop column if exists notes;
