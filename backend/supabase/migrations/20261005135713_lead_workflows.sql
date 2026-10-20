-- Additive migration: existing records remain intact.
create table public.requirement_submissions (
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  submission_url text not null check (submission_url ~ '^https?://[^[:space:]]+$'),
  status text not null default 'in_review' check (status in ('in_review','completed','pending')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  primary key(requirement_id,user_id)
);
alter table public.requirement_submissions enable row level security;
create policy "Submission visibility" on public.requirement_submissions for select to authenticated using (
 exists(select 1 from public.requirements r where r.id=requirement_id and public.user_has_cohort_role(r.cohort_id,array['intern','lead']) and (r.assignee_id is null or r.assignee_id=user_id) and (user_id=auth.uid() or public.user_has_cohort_role(r.cohort_id,array['lead'])))
);
create policy "Intern submits own requirement" on public.requirement_submissions for insert to authenticated with check (
 user_id=auth.uid() and exists(select 1 from public.requirements r where r.id=requirement_id and public.user_has_cohort_role(r.cohort_id,array['intern']) and (r.assignee_id is null or r.assignee_id=auth.uid()))
);
create policy "Submission updates" on public.requirement_submissions for update to authenticated using (
 exists(select 1 from public.requirements r where r.id=requirement_id and (public.user_has_cohort_role(r.cohort_id,array['lead']) or (user_id=auth.uid() and public.user_has_cohort_role(r.cohort_id,array['intern']) and (r.assignee_id is null or r.assignee_id=auth.uid()))))
) with check (
 exists(select 1 from public.requirements r where r.id=requirement_id and (public.user_has_cohort_role(r.cohort_id,array['lead']) or (user_id=auth.uid() and public.user_has_cohort_role(r.cohort_id,array['intern']) and (r.assignee_id is null or r.assignee_id=auth.uid()))))
);
grant select,insert,update on public.requirement_submissions to authenticated;
revoke all on public.requirement_submissions from anon;

-- Leads may write only within their cohort; interns still update owned task status.
create policy "Lead creates tasks" on public.tasks for insert to authenticated with check(public.user_has_cohort_role(cohort_id,array['lead']));
create policy "Lead edits tasks" on public.tasks for update to authenticated using(public.user_has_cohort_role(cohort_id,array['lead'])) with check(public.user_has_cohort_role(cohort_id,array['lead']));
create policy "Lead creates requirements" on public.requirements for insert to authenticated with check(public.user_has_cohort_role(cohort_id,array['lead']));
create policy "Lead edits requirements" on public.requirements for update to authenticated using(public.user_has_cohort_role(cohort_id,array['lead'])) with check(public.user_has_cohort_role(cohort_id,array['lead']));
create policy "Lead creates events" on public.events for insert to authenticated with check(public.user_has_cohort_role(cohort_id,array['lead']));
create policy "Lead edits events" on public.events for update to authenticated using(public.user_has_cohort_role(cohort_id,array['lead'])) with check(public.user_has_cohort_role(cohort_id,array['lead']));
grant insert,update on public.tasks,public.requirements,public.events to authenticated;

-- Prevent table-level UPDATE grants from allowing interns to edit other task fields.
create function public.guard_workspace_record() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then return new; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.cohort_id<>old.cohort_id or new.created_at<>old.created_at) then
  raise exception 'Record identity and cohort cannot be changed' using errcode='42501';
 end if;
 if not public.user_has_cohort_role(new.cohort_id,array['lead']) then
  if tg_table_name<>'tasks' or tg_op<>'UPDATE' then raise exception 'Only leads can manage records' using errcode='42501'; end if;
  if new.assignee_id is distinct from auth.uid() or not public.user_has_cohort_role(new.cohort_id,array['intern']) or (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then
   raise exception 'Interns can update only their own task status' using errcode='42501';
  end if;
 end if;
 if nullif(btrim(new.title),'') is null then raise exception 'Title is required' using errcode='23514'; end if;
 if tg_table_name in ('tasks','requirements') then
  if new.assignee_id is not null and not exists(select 1 from public.profiles p where p.id=new.assignee_id and p.cohort_id=new.cohort_id and p.role='intern') then
   raise exception 'Assignee must be an intern in this cohort' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
create trigger guard_tasks before insert or update on public.tasks for each row execute function public.guard_workspace_record();
create trigger guard_requirements before insert or update on public.requirements for each row execute function public.guard_workspace_record();
create trigger guard_events before insert or update on public.events for each row execute function public.guard_workspace_record();
revoke all on function public.guard_workspace_record() from public,anon,authenticated;

create function public.guard_requirement_submission() returns trigger language plpgsql security invoker set search_path='' as $$
declare target_cohort uuid; is_lead boolean;
begin
 if auth.uid() is null then return new; end if;
 select r.cohort_id into target_cohort from public.requirements r where r.id=new.requirement_id;
 if target_cohort is null then raise exception 'Requirement unavailable' using errcode='42501'; end if;
 is_lead:=public.user_has_cohort_role(target_cohort,array['lead']);
 if tg_op='UPDATE' and (new.requirement_id<>old.requirement_id or new.user_id<>old.user_id) then raise exception 'Submission ownership cannot change' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles p where p.id=new.user_id and p.cohort_id=target_cohort and p.role='intern') then raise exception 'Invalid submission owner' using errcode='42501'; end if;
 if is_lead then
  if tg_op<>'UPDATE' or new.submission_url<>old.submission_url or new.submitted_at<>old.submitted_at then raise exception 'Leads review existing submissions' using errcode='42501'; end if;
  if new.status not in ('completed','pending') then raise exception 'Choose approved or changes requested' using errcode='23514'; end if;
  new.reviewed_at:=now();
 else
  if new.user_id<>auth.uid() or not public.user_has_cohort_role(target_cohort,array['intern']) then raise exception 'Not your submission' using errcode='42501'; end if;
  if tg_op='UPDATE' and old.status='completed' then raise exception 'Approved submissions cannot be changed' using errcode='42501'; end if;
  if new.status<>'in_review' or new.reviewed_at is not null then raise exception 'Only leads can approve requirements' using errcode='42501'; end if;
  new.submitted_at:=now(); new.reviewed_at:=null;
 end if;
 return new;
end $$;
create trigger guard_submissions before insert or update on public.requirement_submissions for each row execute function public.guard_requirement_submission();
revoke all on function public.guard_requirement_submission() from public,anon,authenticated;

-- Scope ownership reads and updates to current cohort membership as well.
drop policy "Members can read cohort tasks" on public.tasks;
create policy "Members can read cohort tasks" on public.tasks for select to authenticated using(public.user_has_cohort_role(cohort_id,array['intern','lead']) and (assignee_id=auth.uid() or assignee_id is null or public.user_has_cohort_role(cohort_id,array['lead'])));
drop policy "Fellows can update their task status" on public.tasks;
create policy "Fellows can update their task status" on public.tasks for update to authenticated using(assignee_id=auth.uid() and public.user_has_cohort_role(cohort_id,array['intern'])) with check(assignee_id=auth.uid() and public.user_has_cohort_role(cohort_id,array['intern']));
drop policy "Members can read cohort requirements" on public.requirements;
create policy "Members can read cohort requirements" on public.requirements for select to authenticated using(public.user_has_cohort_role(cohort_id,array['intern','lead']) and (assignee_id=auth.uid() or assignee_id is null or public.user_has_cohort_role(cohort_id,array['lead'])));

