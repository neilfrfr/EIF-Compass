-- Teammates need membership names on the project page. Keep access within their team.
drop policy if exists "Teammates see team membership" on public.team_memberships;
create policy "Teammates see team membership" on public.team_memberships
  for select to authenticated using (eif_private.is_team_member(team_id));

-- A notice is created when a task is assigned or a lead posts sprint feedback.
-- The trigger runs with database privileges because clients have no INSERT grant on notifications.
create or replace function eif_private.create_workflow_notice() returns trigger
language plpgsql security definer set search_path = '' as $$
declare team uuid;
begin
  if tg_table_name = 'tasks' then
    if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
      insert into public.notifications (recipient_id, cohort_id, type, title, reference_type, reference_id)
      values (new.assignee_id, new.cohort_id, 'task_assigned', 'Task assigned: ' || new.title, 'task', new.id);
    end if;
  elsif tg_table_name = 'sprint_feedback' then
    select p.team_id into team from public.projects p where p.id = new.project_id;
    insert into public.notifications (recipient_id, cohort_id, type, title, reference_type, reference_id)
    select m.user_id, new.cohort_id, 'feedback', 'New feedback on your sprint', 'feedback', new.id
    from public.team_memberships m
    join public.profiles p on p.id = m.user_id and p.role = 'intern'
    where m.team_id = team and m.cohort_id = new.cohort_id;
  end if;
  return new;
end;
$$;
revoke all on function eif_private.create_workflow_notice() from public, anon, authenticated;
drop trigger if exists task_assignment_notice on public.tasks;
create trigger task_assignment_notice after insert or update of assignee_id on public.tasks
  for each row execute function eif_private.create_workflow_notice();
drop trigger if exists sprint_feedback_notice on public.sprint_feedback;
create trigger sprint_feedback_notice after insert on public.sprint_feedback
  for each row execute function eif_private.create_workflow_notice();
