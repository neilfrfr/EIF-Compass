-- Trigger-only function must not be an exposed callable API.
revoke all on function public.create_profile_for_new_user() from public,anon,authenticated;
revoke all on function public.user_has_cohort_role(uuid,text[]) from public,anon;
grant execute on function public.user_has_cohort_role(uuid,text[]) to authenticated;
