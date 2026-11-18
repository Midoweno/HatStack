-- Run this in the Supabase SQL editor.
-- Lets CHI tasks and goals keep a manual drag-and-drop order. Items without
-- a saved order simply sort after the ones that have one.

alter table tasks
  add column if not exists sort_order double precision;

alter table projects
  add column if not exists sort_order double precision;
