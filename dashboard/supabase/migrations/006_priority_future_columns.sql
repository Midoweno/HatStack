-- Run this in the Supabase SQL editor.
-- Splits the Priority view into two columns: "Priority" and "Future".
-- Existing starred tasks (star_bucket is null) land in "Priority" — the
-- old single-column behavior. Newly-starred tasks default to "Future".

alter table tasks
  add column if not exists star_bucket text
    check (star_bucket in ('priority', 'future'));
