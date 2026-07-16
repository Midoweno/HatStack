-- HatStack schema: run this once in the Supabase SQL editor
-- (Project → SQL Editor → New query → paste → Run).

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  hat text not null check (hat in ('routine', 'work', 'personal')),
  name text not null,
  icon text,
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  hat text not null check (hat in ('routine', 'work', 'personal')),
  project_id uuid references projects(id) on delete set null,
  parent_task_id uuid references tasks(id) on delete set null,
  name text not null,
  urgency text not null check (urgency in ('critical', 'high', 'medium', 'low')),
  due_date date,
  recurrence_freq text check (recurrence_freq in ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_interval integer not null default 1 check (recurrence_interval >= 1),
  recurrence_until date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on projects(user_id);
create index if not exists tasks_user_id_idx on tasks(user_id);
create index if not exists tasks_project_id_idx on tasks(project_id);

alter table projects enable row level security;
alter table tasks enable row level security;

create policy "projects: owner full access" on projects
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "tasks: owner full access" on tasks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Enable realtime updates so edits on one device show up live on others.
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table tasks;
