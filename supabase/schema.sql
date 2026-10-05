-- EIF Compass Check-in 1 schema
-- Run this in the Supabase SQL Editor. The browser uses only the anon key;
-- Row Level Security determines which cohort records each signed-in user sees.

create extension if not exists pgcrypto;

create table if not exists public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'EIF Fellow',
  role text not null default 'intern' check (role in ('intern', 'lead')),
  cohort_id uuid references public.cohorts(id) on delete set null,
  team_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  project_name text not null default 'Fellowship work',
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'to_do' check (status in ('to_do', 'in_progress', 'for_review', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'in_review', 'completed', 'overdue')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  event_type text not null default 'Fellowship event',
  location text,
  created_at timestamptz not null default now()
);

create index if not exists tasks_assignee_due_idx on public.tasks(assignee_id, due_date);
create index if not exists requirements_assignee_due_idx on public.requirements(assignee_id, due_date);
create index if not exists events_cohort_start_idx on public.events(cohort_id, starts_at);

-- SECURITY DEFINER helpers avoid recursive profile-table RLS lookups.
create or replace function public.user_has_cohort_role(target_cohort uuid, allowed_roles text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and cohort_id = target_cohort
      and role = any(allowed_roles)
  );
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  first_cohort uuid;
begin
  select id into first_cohort from public.cohorts order by created_at limit 1;
  insert into public.profiles (id, display_name, role, cohort_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'EIF Fellow'),
    'intern',
    first_cohort
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.user_has_cohort_role(uuid, text[]) from public;
grant execute on function public.user_has_cohort_role(uuid, text[]) to authenticated;

drop trigger if exists on_auth_user_created_eif_profile on auth.users;
create trigger on_auth_user_created_eif_profile
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

alter table public.cohorts enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.requirements enable row level security;
alter table public.events enable row level security;

drop policy if exists "Cohort members can read their cohort" on public.cohorts;
create policy "Cohort members can read their cohort" on public.cohorts
  for select to authenticated using (public.user_has_cohort_role(id, array['intern', 'lead']));

drop policy if exists "Users can read their own profile and cohort leads can read fellows" on public.profiles;
create policy "Users can read their own profile and cohort leads can read fellows" on public.profiles
  for select to authenticated using (id = auth.uid() or public.user_has_cohort_role(cohort_id, array['lead']));

drop policy if exists "Members can read cohort tasks" on public.tasks;
create policy "Members can read cohort tasks" on public.tasks
  for select to authenticated using (
    assignee_id = auth.uid()
    or (assignee_id is null and public.user_has_cohort_role(cohort_id, array['intern', 'lead']))
    or public.user_has_cohort_role(cohort_id, array['lead'])
  );

drop policy if exists "Fellows can update their task status" on public.tasks;
create policy "Fellows can update their task status" on public.tasks
  for update to authenticated using (assignee_id = auth.uid()) with check (assignee_id = auth.uid());
revoke update on public.tasks from public, anon, authenticated;
grant update (status) on public.tasks to authenticated;

drop policy if exists "Members can read cohort requirements" on public.requirements;
create policy "Members can read cohort requirements" on public.requirements
  for select to authenticated using (
    assignee_id = auth.uid()
    or (assignee_id is null and public.user_has_cohort_role(cohort_id, array['intern', 'lead']))
    or public.user_has_cohort_role(cohort_id, array['lead'])
  );

drop policy if exists "Members can read cohort events" on public.events;
create policy "Members can read cohort events" on public.events
  for select to authenticated using (public.user_has_cohort_role(cohort_id, array['intern', 'lead']));

grant select on public.cohorts, public.profiles, public.tasks, public.requirements, public.events to authenticated;

-- Seed the Check-in 1 demo cohort and shared checklist/events. The app also
-- includes local sample data so the screens work before Supabase is configured.
insert into public.cohorts (id, name, starts_on, ends_on)
values ('c0a00000-0000-4000-8000-000000000026', 'EIF Innovation Fellowship 2026', '2026-09-30', '2026-11-24')
on conflict (id) do nothing;

insert into public.requirements (id, cohort_id, title, description, due_date, status)
values
  ('a1100000-0000-4000-8000-000000000001', 'c0a00000-0000-4000-8000-000000000026', 'Sprint 1 project brief', 'Upload the approved project brief and team roles.', '2026-10-07', 'in_review'),
  ('a1100000-0000-4000-8000-000000000002', 'c0a00000-0000-4000-8000-000000000026', 'Learning reflection', 'A short reflection on your first two weeks.', '2026-10-09', 'pending'),
  ('a1100000-0000-4000-8000-000000000003', 'c0a00000-0000-4000-8000-000000000026', 'Weekly progress update', 'Share progress, next steps, and any blockers.', '2026-10-10', 'pending')
on conflict (id) do nothing;

insert into public.events (id, cohort_id, title, starts_at, event_type, location)
values
  ('e1100000-0000-4000-8000-000000000001', 'c0a00000-0000-4000-8000-000000000026', 'Sprint 1 check-in', '2026-10-07 14:00:00+08', 'Team milestone', 'Online'),
  ('e1100000-0000-4000-8000-000000000002', 'c0a00000-0000-4000-8000-000000000026', 'Learning circle: user research', '2026-10-09 16:00:00+08', 'Fellowship event', 'Online'),
  ('e1100000-0000-4000-8000-000000000003', 'c0a00000-0000-4000-8000-000000000026', 'Submit weekly progress update', '2026-10-12 09:00:00+08', 'Requirement due', 'EIF Compass')
on conflict (id) do nothing;
