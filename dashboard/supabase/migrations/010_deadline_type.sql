-- Run this in the Supabase SQL editor.
-- Lets a task be marked as an exam, assignment, or project so the Priority
-- view can show a countdown tile to its deadline.

alter table tasks
  add column if not exists deadline_type text
  check (deadline_type in ('exam', 'assignment', 'project'));
