-- Optional LOCAL-ONLY fixture. Never include this file in a migration.
-- Run in one SQL session after explicitly setting: SET eif.allow_synthetic_seed = 'yes';
-- It creates a separate synthetic cohort and 20 @example.invalid users.
begin;
do $$ begin
  if current_setting('eif.allow_synthetic_seed', true) is distinct from 'yes' then
    raise exception 'Synthetic seed requires explicit eif.allow_synthetic_seed=yes';
  end if;
  if exists (select 1 from public.cohorts where id = 'de000000-0000-4000-8000-000000000001') then
    raise exception 'Synthetic cohort already exists';
  end if;
end $$;

insert into public.cohorts(id, name, starts_on, ends_on)
values ('de000000-0000-4000-8000-000000000001', 'SYNTHETIC Week 2 Demo', '2026-10-01', '2026-11-30');

-- This fixture targets a disposable local auth schema only. Do not use it to
-- provision accounts on a hosted Supabase project; use Auth Admin there.
insert into auth.users(id, email, raw_user_meta_data)
select md5('eif-week2-demo-intern-' || n)::uuid,
       'eif-demo-intern-' || n || '@example.invalid',
       jsonb_build_object('full_name', 'Demo Intern ' || n)
from generate_series(1, 20) as n;
insert into auth.users(id, email, raw_user_meta_data)
values (md5('eif-week2-demo-lead')::uuid, 'eif-demo-lead@example.invalid', '{"full_name":"Demo Lead"}');

update public.profiles set cohort_id = 'de000000-0000-4000-8000-000000000001'
where id in (select md5('eif-week2-demo-intern-' || n)::uuid from generate_series(1, 20) as n);
update public.profiles set cohort_id = 'de000000-0000-4000-8000-000000000001', role = 'lead'
where id = md5('eif-week2-demo-lead')::uuid;

insert into public.teams(id, cohort_id, name)
select md5('eif-week2-demo-team-' || n)::uuid,
       'de000000-0000-4000-8000-000000000001',
       'Demo Team ' || n
from generate_series(1, 5) as n;

insert into public.team_memberships(team_id, cohort_id, user_id)
select md5('eif-week2-demo-team-' || ((n - 1) / 4 + 1))::uuid,
       'de000000-0000-4000-8000-000000000001',
       md5('eif-week2-demo-intern-' || n)::uuid
from generate_series(1, 20) as n;

insert into public.projects(id, cohort_id, team_id, title, description)
select md5('eif-week2-demo-project-' || n)::uuid,
       'de000000-0000-4000-8000-000000000001',
       md5('eif-week2-demo-team-' || n)::uuid,
       'Demo Project ' || n,
       'Synthetic project for permission and UI demos.'
from generate_series(1, 5) as n;

-- Two sprint cycles for each of five project teams.
insert into public.sprints(id, project_id, cohort_id, title, sequence, starts_on, ends_on)
select md5('eif-week2-demo-sprint-' || team_n || '-' || sprint_n)::uuid,
       md5('eif-week2-demo-project-' || team_n)::uuid,
       'de000000-0000-4000-8000-000000000001',
       'Sprint ' || sprint_n, sprint_n,
       case sprint_n when 1 then date '2026-10-01' else date '2026-10-15' end,
       case sprint_n when 1 then date '2026-10-14' else date '2026-10-28' end
from generate_series(1, 5) as team_n cross join generate_series(1, 2) as sprint_n;
commit;
