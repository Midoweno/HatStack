-- Run this in the Supabase SQL editor.
-- Adds the CHI (passion) space: its tasks and goals live in the same tables
-- as Hats, tagged with a "space" so each tab only shows its own. A goal is a
-- project with a "passion" label (Music, Writing, ...).

alter table projects
  add column if not exists space text not null default 'hats'
    check (space in ('hats', 'chi'));

alter table projects
  add column if not exists passion text;

alter table tasks
  add column if not exists space text not null default 'hats'
    check (space in ('hats', 'chi'));
