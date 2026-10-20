-- Week 2 data foundation. Apply after the existing 20261011 migration.
-- Legacy task/project and profile/team text labels remain untouched.

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now(),
  unique (id, cohort_id), unique (cohort_id, name)
);
create unique index profiles_id_cohort_idx on public.profiles(id, cohort_id);
create table public.team_memberships (
  team_id uuid not null,
  cohort_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id),
  foreign key (team_id, cohort_id) references public.teams(id, cohort_id) on delete cascade,
  foreign key (user_id, cohort_id) references public.profiles(id, cohort_id) on update restrict on delete cascade
);
create index team_memberships_user_idx on public.team_memberships(user_id, team_id);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null,
  team_id uuid not null,
  title text not null check (btrim(title) <> ''),
  description text,
  created_at timestamptz not null default now(),
  foreign key (team_id, cohort_id) references public.teams(id, cohort_id) on delete cascade,
  unique (id, cohort_id), unique (id, team_id, cohort_id)
);
create index projects_team_idx on public.projects(team_id);
create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  cohort_id uuid not null,
  title text not null check (btrim(title) <> ''),
  sequence integer not null check (sequence > 0),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  foreign key (project_id, cohort_id) references public.projects(id, cohort_id) on delete cascade,
  unique (project_id, sequence), unique (id, project_id, cohort_id)
);
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null,
  project_id uuid not null,
  cohort_id uuid not null,
  title text not null check (btrim(title) <> ''),
  due_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','completed')),
  created_at timestamptz not null default now(),
  foreign key (sprint_id, project_id, cohort_id) references public.sprints(id, project_id, cohort_id) on delete cascade,
  unique (id, sprint_id, project_id, cohort_id), unique (id, project_id, cohort_id)
);
create index milestones_sprint_idx on public.milestones(sprint_id);

alter table public.tasks add column project_id uuid, add column sprint_id uuid, add column milestone_id uuid, add column project_team_id uuid;
alter table public.tasks add constraint task_sprint_requires_project check (sprint_id is null or project_id is not null);
alter table public.tasks add constraint task_milestone_requires_sprint check (milestone_id is null or sprint_id is not null);
alter table public.tasks add constraint task_team_requires_project check ((project_id is null) = (project_team_id is null));
alter table public.tasks add constraint task_project_team_fk foreign key (project_id, project_team_id, cohort_id) references public.projects(id, team_id, cohort_id);
alter table public.tasks add constraint task_assignee_team_fk foreign key (project_team_id, assignee_id) references public.team_memberships(team_id, user_id);
alter table public.tasks add constraint task_sprint_project_fk foreign key (sprint_id, project_id, cohort_id) references public.sprints(id, project_id, cohort_id);
alter table public.tasks add constraint task_milestone_sprint_fk foreign key (milestone_id, sprint_id, project_id, cohort_id) references public.milestones(id, sprint_id, project_id, cohort_id);
create index tasks_project_idx on public.tasks(project_id);

create table public.sprint_feedback (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid not null,
  project_id uuid not null,
  cohort_id uuid not null,
  author_id uuid not null,
  body text not null check (btrim(body) <> ''),
  created_at timestamptz not null default now(),
  foreign key (sprint_id, project_id, cohort_id) references public.sprints(id, project_id, cohort_id) on delete cascade,
  foreign key (author_id, cohort_id) references public.profiles(id, cohort_id) on update restrict on delete cascade
);
create index sprint_feedback_sprint_idx on public.sprint_feedback(sprint_id, created_at);
create table public.blockers (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  reporter_id uuid not null,
  project_id uuid,
  milestone_id uuid,
  category text not null check (category in ('technical','access','coordination','other')),
  description text not null check (btrim(description) <> ''),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (milestone_id is null or project_id is not null),
  check ((status = 'open' and resolved_at is null) or (status = 'resolved' and resolved_at is not null)),
  foreign key (reporter_id, cohort_id) references public.profiles(id, cohort_id) on update restrict on delete cascade,
  foreign key (project_id, cohort_id) references public.projects(id, cohort_id),
  foreign key (milestone_id, project_id, cohort_id) references public.milestones(id, project_id, cohort_id),
  unique (id, cohort_id)
);
create index blockers_reporter_idx on public.blockers(reporter_id, status);
create table public.blocker_comments (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null,
  cohort_id uuid not null,
  author_id uuid not null,
  body text not null check (btrim(body) <> ''),
  created_at timestamptz not null default now(),
  foreign key (blocker_id, cohort_id) references public.blockers(id, cohort_id) on delete cascade,
  foreign key (author_id, cohort_id) references public.profiles(id, cohort_id) on update restrict on delete cascade
);
create index blocker_comments_blocker_idx on public.blocker_comments(blocker_id, created_at);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null,
  cohort_id uuid not null,
  type text not null check (type in ('task_assigned','feedback','due_soon','overdue')),
  title text not null check (btrim(title) <> ''),
  reference_type text not null check (reference_type in ('task','requirement','feedback')),
  reference_id uuid not null,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  foreign key (recipient_id, cohort_id) references public.profiles(id, cohort_id) on update restrict on delete cascade
);
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

-- Definer lookup avoids team-membership policy recursion. It returns only a boolean
-- about the current authenticated user and exposes no membership rows.
create function eif_private.is_team_member(target_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.team_memberships m where m.team_id = target_team and m.user_id = auth.uid()
  );
$$;
create function eif_private.shares_team(target_user uuid, target_cohort uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.team_memberships mine
    join public.team_memberships theirs on theirs.team_id = mine.team_id and theirs.cohort_id = mine.cohort_id
    where mine.user_id = auth.uid() and theirs.user_id = target_user and mine.cohort_id = target_cohort
  );
$$;
revoke all on function eif_private.is_team_member(uuid), eif_private.shares_team(uuid, uuid) from public, anon;
grant usage on schema eif_private to authenticated;
grant execute on function eif_private.is_team_member(uuid), eif_private.shares_team(uuid, uuid) to authenticated;

-- A single invoker trigger guards immutable identities and cross-table membership.
create function eif_private.guard_week2_row() returns trigger language plpgsql security invoker set search_path = '' as $$
declare linked_team uuid;
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.created_at <> old.created_at then
      raise exception 'Record identity cannot change' using errcode = '42501';
    end if;
    if tg_table_name = 'teams' then
      if new.cohort_id <> old.cohort_id then raise exception 'Team cohort cannot change' using errcode = '42501'; end if;
    elsif tg_table_name = 'projects' then
      if new.cohort_id <> old.cohort_id or new.team_id <> old.team_id then raise exception 'Project ownership cannot change' using errcode = '42501'; end if;
    elsif tg_table_name = 'sprints' then
      if new.cohort_id <> old.cohort_id or new.project_id <> old.project_id then raise exception 'Sprint ownership cannot change' using errcode = '42501'; end if;
    elsif tg_table_name = 'milestones' then
      if new.cohort_id <> old.cohort_id or new.project_id <> old.project_id or new.sprint_id <> old.sprint_id then raise exception 'Milestone ownership cannot change' using errcode = '42501'; end if;
    elsif tg_table_name = 'sprint_feedback' then
      if new.cohort_id <> old.cohort_id or new.project_id <> old.project_id or new.sprint_id <> old.sprint_id or new.author_id <> old.author_id then raise exception 'Feedback ownership cannot change' using errcode = '42501'; end if;
    elsif tg_table_name = 'blockers' then
      if new.cohort_id <> old.cohort_id or new.reporter_id <> old.reporter_id or new.project_id is distinct from old.project_id or new.milestone_id is distinct from old.milestone_id or new.category <> old.category or new.description <> old.description then
        raise exception 'Blocker ownership and content cannot change' using errcode = '42501';
      end if;
    elsif tg_table_name = 'notifications' then
      if (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then raise exception 'Notification content cannot change' using errcode = '42501'; end if;
    end if;
  end if;
  if tg_table_name = 'sprint_feedback' and not public.user_has_cohort_role(new.cohort_id, array['lead']) then
    raise exception 'Feedback author must be a cohort lead' using errcode = '42501';
  end if;
  if tg_table_name = 'sprint_feedback' and tg_op = 'INSERT' then new.created_at := now(); end if;
  if tg_table_name = 'blockers' then
    if tg_op = 'INSERT' then
      if new.reporter_id is distinct from auth.uid() or not public.user_has_cohort_role(new.cohort_id, array['intern']) or new.status <> 'open' or new.resolved_at is not null then
        raise exception 'Only interns can report open blockers' using errcode = '42501';
      end if;
      if new.project_id is not null then
        select p.team_id into linked_team from public.projects p where p.id = new.project_id and p.cohort_id = new.cohort_id;
        if linked_team is null or not eif_private.is_team_member(linked_team) then
          raise exception 'Reporter is not on the project team' using errcode = '42501';
        end if;
      end if;
      new.created_at := now();
    elsif new.status = 'resolved' then new.resolved_at := coalesce(old.resolved_at, now());
    else new.resolved_at := null;
    end if;
  end if;
  if tg_table_name = 'notifications' and tg_op = 'UPDATE' then
    if old.read_at is not null then raise exception 'Notification is already read' using errcode = '42501'; end if;
    new.read_at := now();
  end if;
  return new;
end $$;
revoke all on function eif_private.guard_week2_row() from public, anon, authenticated;
create trigger guard_teams before update on public.teams for each row execute function eif_private.guard_week2_row();
create trigger guard_projects before update on public.projects for each row execute function eif_private.guard_week2_row();
create trigger guard_sprints before update on public.sprints for each row execute function eif_private.guard_week2_row();
create trigger guard_milestones before update on public.milestones for each row execute function eif_private.guard_week2_row();
create trigger guard_feedback before insert or update on public.sprint_feedback for each row execute function eif_private.guard_week2_row();
create trigger guard_blockers before insert or update on public.blockers for each row execute function eif_private.guard_week2_row();
create trigger guard_notifications before update on public.notifications for each row execute function eif_private.guard_week2_row();

create function eif_private.guard_blocker_comment() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.author_id is distinct from auth.uid() then raise exception 'Comment author must be current user' using errcode = '42501'; end if;
  new.created_at := now();
  return new;
end $$;
revoke all on function eif_private.guard_blocker_comment() from public, anon, authenticated;
create trigger guard_blocker_comment before insert on public.blocker_comments for each row execute function eif_private.guard_blocker_comment();

create function eif_private.guard_team_membership() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.team_id <> old.team_id or new.user_id <> old.user_id or new.cohort_id <> old.cohort_id or new.created_at <> old.created_at) then
    raise exception 'Membership identity cannot change' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.user_id and p.cohort_id = new.cohort_id and p.role = 'intern') then
    raise exception 'Team members must be cohort interns' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function eif_private.guard_team_membership() from public, anon, authenticated;
create trigger guard_team_memberships before insert or update on public.team_memberships for each row execute function eif_private.guard_team_membership();

create function eif_private.guard_task_project() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.project_team_id := null;
  if new.project_id is not null then
    select p.team_id into new.project_team_id from public.projects p where p.id = new.project_id and p.cohort_id = new.cohort_id;
    if new.project_team_id is null then raise exception 'Task project is unavailable' using errcode = '23514'; end if;
  end if;
  return new;
end $$;
revoke all on function eif_private.guard_task_project() from public, anon, authenticated;
create trigger guard_task_project before insert or update on public.tasks for each row execute function eif_private.guard_task_project();

alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.sprints enable row level security;
alter table public.milestones enable row level security;
alter table public.sprint_feedback enable row level security;
alter table public.blockers enable row level security;
alter table public.blocker_comments enable row level security;
alter table public.notifications enable row level security;

create policy "Teams visible to leads and members" on public.teams for select to authenticated using (public.user_has_cohort_role(cohort_id, array['lead']) or eif_private.is_team_member(id));
create policy "Leads create teams" on public.teams for insert to authenticated with check (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Leads edit teams" on public.teams for update to authenticated using (public.user_has_cohort_role(cohort_id, array['lead'])) with check (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Membership visible to leads and member" on public.team_memberships for select to authenticated using (user_id = auth.uid() or public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Leads add members" on public.team_memberships for insert to authenticated with check (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Leads remove members" on public.team_memberships for delete to authenticated using (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Projects visible to leads and team" on public.projects for select to authenticated using (public.user_has_cohort_role(cohort_id, array['lead']) or eif_private.is_team_member(team_id));
create policy "Leads create projects" on public.projects for insert to authenticated with check (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Leads edit projects" on public.projects for update to authenticated using (public.user_has_cohort_role(cohort_id, array['lead'])) with check (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Sprints visible to leads and team" on public.sprints for select to authenticated using (public.user_has_cohort_role(cohort_id, array['lead']) or exists (select 1 from public.projects p where p.id = project_id));
create policy "Leads create sprints" on public.sprints for insert to authenticated with check (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Leads edit sprints" on public.sprints for update to authenticated using (public.user_has_cohort_role(cohort_id, array['lead'])) with check (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Milestones visible to leads and team" on public.milestones for select to authenticated using (public.user_has_cohort_role(cohort_id, array['lead']) or exists (select 1 from public.projects p where p.id = project_id));
create policy "Leads create milestones" on public.milestones for insert to authenticated with check (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Leads edit milestones" on public.milestones for update to authenticated using (public.user_has_cohort_role(cohort_id, array['lead'])) with check (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Feedback visible to leads and team" on public.sprint_feedback for select to authenticated using (public.user_has_cohort_role(cohort_id, array['lead']) or exists (select 1 from public.projects p where p.id = project_id));
create policy "Leads post own feedback" on public.sprint_feedback for insert to authenticated with check (author_id = auth.uid() and public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Leads edit own feedback" on public.sprint_feedback for update to authenticated using (author_id = auth.uid() and public.user_has_cohort_role(cohort_id, array['lead'])) with check (author_id = auth.uid() and public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Blockers visible to reporter and leads" on public.blockers for select to authenticated using (reporter_id = auth.uid() and public.user_has_cohort_role(cohort_id, array['intern']) or public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Interns report own blockers" on public.blockers for insert to authenticated with check (reporter_id = auth.uid() and public.user_has_cohort_role(cohort_id, array['intern']));
create policy "Leads resolve blockers" on public.blockers for update to authenticated using (public.user_has_cohort_role(cohort_id, array['lead'])) with check (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Blocker comments visible to participants" on public.blocker_comments for select to authenticated using (exists (select 1 from public.blockers b where b.id = blocker_id));
create policy "Participants comment on blockers" on public.blocker_comments for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.blockers b where b.id = blocker_id and b.cohort_id = blocker_comments.cohort_id));
create policy "Recipients see notifications" on public.notifications for select to authenticated using (recipient_id = auth.uid() and public.user_has_cohort_role(cohort_id, array['intern','lead']));
create policy "Recipients mark notifications read" on public.notifications for update to authenticated using (recipient_id = auth.uid() and public.user_has_cohort_role(cohort_id, array['intern','lead'])) with check (recipient_id = auth.uid() and public.user_has_cohort_role(cohort_id, array['intern','lead']));

-- Linked tasks use team access; unlinked tasks retain old personal/shared rules.
drop policy "Members can read cohort tasks" on public.tasks;
create policy "Members can read cohort tasks" on public.tasks for select to authenticated using (
  public.user_has_cohort_role(cohort_id, array['lead'])
  or (public.user_has_cohort_role(cohort_id, array['intern']) and (
    (project_id is null and (assignee_id = auth.uid() or assignee_id is null))
    or (project_id is not null and exists (select 1 from public.projects p where p.id = project_id))
  ))
);
create policy "Interns see teammate profiles" on public.profiles for select to authenticated using (
  public.user_has_cohort_role(cohort_id, array['intern']) and eif_private.shares_team(id, cohort_id)
);

revoke all on public.teams, public.team_memberships, public.projects, public.sprints, public.milestones, public.sprint_feedback, public.blockers, public.blocker_comments, public.notifications from public, anon, authenticated;
grant select, insert, update on public.teams, public.projects, public.sprints, public.milestones, public.sprint_feedback, public.blockers to authenticated;
grant select, insert, delete on public.team_memberships to authenticated;
grant select, insert on public.blocker_comments to authenticated;
grant select, update (read_at) on public.notifications to authenticated;
