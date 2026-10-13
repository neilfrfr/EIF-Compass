-- Refresh each intern's actionable deadline notices when they open Notifications.
-- The caller supplies no recipient or cohort; both come from the authenticated profile.
create function public.refresh_due_notifications() returns void
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  viewer_cohort uuid;
  today date := (now() at time zone 'Asia/Manila')::date;
begin
  select p.cohort_id into viewer_cohort from public.profiles p
  where p.id = viewer and p.role = 'intern';
  if viewer_cohort is null then return; end if;

  insert into public.notifications (recipient_id, cohort_id, type, title, reference_type, reference_id, dedupe_key)
  select viewer, viewer_cohort,
    case when t.due_date < today then 'overdue' else 'due_soon' end,
    case when t.due_date < today then 'Overdue task: ' else 'Task due soon: ' end || t.title,
    'task', t.id,
    'task:' || t.id || ':' || viewer || ':' || t.due_date || ':' ||
      case when t.due_date < today then 'overdue' else 'due_soon' end
  from public.tasks t
  where t.cohort_id = viewer_cohort and t.assignee_id = viewer
    and t.status not in ('completed', 'for_review') and t.due_date <= today + 1
  on conflict (dedupe_key) do nothing;

  insert into public.notifications (recipient_id, cohort_id, type, title, reference_type, reference_id, dedupe_key)
  select viewer, viewer_cohort,
    case when eif_private.cutoff(r) < now() then 'overdue' else 'due_soon' end,
    case when eif_private.cutoff(r) < now() then 'Overdue requirement: ' else 'Requirement due soon: ' end || r.title,
    'requirement', r.id,
    'requirement:' || r.id || ':' || viewer || ':' || eif_private.cutoff(r) || ':' ||
      case when eif_private.cutoff(r) < now() then 'overdue' else 'due_soon' end
  from public.requirements r
  where r.cohort_id = viewer_cohort and (r.assignee_id is null or r.assignee_id = viewer)
    and r.status not in ('completed', 'in_review')
    and eif_private.cutoff(r) <= ((today + 2)::timestamp at time zone 'Asia/Manila')
    and not exists (
      select 1 from public.requirement_submissions s
      where s.requirement_id = r.id and s.user_id = viewer and s.status in ('completed', 'in_review')
    )
  on conflict (dedupe_key) do nothing;
end;
$$;
revoke all on function public.refresh_due_notifications() from public, anon;
grant execute on function public.refresh_due_notifications() to authenticated;
