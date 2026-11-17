-- Run this in the Supabase SQL editor.
-- CHI goals can have an optional numeric target (e.g. 100 "emails") that you
-- log progress toward. Each progress entry is {id, date, amount}.

alter table projects
  add column if not exists target numeric;

alter table projects
  add column if not exists unit text;

alter table projects
  add column if not exists progress jsonb not null default '[]'::jsonb;
