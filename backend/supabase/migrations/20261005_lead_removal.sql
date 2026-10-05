-- Leads can remove records only within their own cohort.
create policy "Lead removes tasks" on public.tasks for delete to authenticated
using (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Lead removes requirements" on public.requirements for delete to authenticated
using (public.user_has_cohort_role(cohort_id, array['lead']));
create policy "Lead removes events" on public.events for delete to authenticated
using (public.user_has_cohort_role(cohort_id, array['lead']));
grant delete on public.tasks, public.requirements, public.events to authenticated;
