begin;
insert into public.cohorts(id,name) values ('f1000000-0000-4000-8000-000000000001','Workflow test'),('f1000000-0000-4000-8000-000000000002','Other test cohort');
insert into auth.users(id,email) values ('f2000000-0000-4000-8000-000000000001','workflow-lead@example.invalid'),('f2000000-0000-4000-8000-000000000002','workflow-intern-a@example.invalid'),('f2000000-0000-4000-8000-000000000003','workflow-intern-b@example.invalid'),('f2000000-0000-4000-8000-000000000004','workflow-other@example.invalid');
update public.profiles set cohort_id='f1000000-0000-4000-8000-000000000001',role=case when id='f2000000-0000-4000-8000-000000000001' then 'lead' else 'intern' end where id in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000003');
update public.profiles set cohort_id='f1000000-0000-4000-8000-000000000002' where id='f2000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000001',true);
insert into public.tasks(id,cohort_id,assignee_id,title) values ('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','Workflow task');
update public.tasks set title='Edited task' where id='f3000000-0000-4000-8000-000000000001';
insert into public.requirements(id,cohort_id,title) values ('f4000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Shared requirement');
insert into public.events(id,cohort_id,title,starts_at) values ('f5000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Workflow event','2026-10-07T14:00:00+08:00');
update public.requirements set title='Edited requirement' where id='f4000000-0000-4000-8000-000000000001';
update public.events set title='Edited event' where id='f5000000-0000-4000-8000-000000000001';
do $$ begin
 if (select title from public.tasks where id='f3000000-0000-4000-8000-000000000001')<>'Edited task' then raise exception 'Lead edit failed'; end if;
 begin
  insert into public.tasks(cohort_id,assignee_id,title) values ('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000004','Wrong cohort assignee');
  raise exception 'Cross-cohort assignment accepted';
 exception when check_violation then null; end;
 begin
  insert into public.events(cohort_id,title,starts_at) values('f1000000-0000-4000-8000-000000000002','Forbidden',now());
  raise exception 'Cross-cohort event accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000002',true);
update public.tasks set status='completed' where id='f3000000-0000-4000-8000-000000000001';
insert into public.requirement_submissions(requirement_id,user_id,submission_url) values('f4000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','https://example.com/intern-a');
do $$ begin
 if (select status from public.tasks where id='f3000000-0000-4000-8000-000000000001')<>'completed' then raise exception 'Own task completion failed'; end if;
 begin
  update public.tasks set title='Tampered' where id='f3000000-0000-4000-8000-000000000001';
  raise exception 'Intern edited task title';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.events(cohort_id,title,starts_at) values('f1000000-0000-4000-8000-000000000001','Forbidden',now());
  raise exception 'Intern created event';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.requirements(cohort_id,title) values('f1000000-0000-4000-8000-000000000001','Forbidden');
  raise exception 'Intern created requirement';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.tasks(cohort_id,title) values('f1000000-0000-4000-8000-000000000001','Forbidden');
  raise exception 'Intern created a task';
 exception when insufficient_privilege then null; end;
 begin
  update public.requirement_submissions set status='completed' where user_id=auth.uid();
  raise exception 'Intern approved own requirement';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.requirement_submissions(requirement_id,user_id,submission_url) values('f4000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000003','https://example.com/forged');
  raise exception 'Intern forged another submission';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000003',true);
do $$ begin
 if exists(select 1 from public.tasks where id='f3000000-0000-4000-8000-000000000001') then raise exception 'Other intern can read task'; end if;
 if exists(select 1 from public.requirement_submissions) then raise exception 'Other intern can read submission'; end if;
 update public.tasks set status='to_do' where id='f3000000-0000-4000-8000-000000000001';
 if found then raise exception 'Other intern changed task'; end if;
end $$;
insert into public.requirement_submissions(requirement_id,user_id,submission_url) values('f4000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000003','https://example.com/intern-b');
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000001',true);
update public.requirement_submissions set status='pending' where user_id='f2000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000002',true);
insert into public.requirement_submissions(requirement_id,user_id,submission_url,status,reviewed_at) values('f4000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','https://example.com/revised','in_review',null) on conflict(requirement_id,user_id) do update set submission_url=excluded.submission_url,status=excluded.status,reviewed_at=null;
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000001',true);
update public.requirement_submissions set status='completed' where user_id='f2000000-0000-4000-8000-000000000002';
do $$ begin
 if (select status from public.requirement_submissions where user_id='f2000000-0000-4000-8000-000000000002')<>'completed' then raise exception 'Lead review failed'; end if;
 if (select status from public.requirement_submissions where user_id='f2000000-0000-4000-8000-000000000003')<>'in_review' then raise exception 'Shared requirement approval leaked'; end if;
end $$;
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000004',true);
do $$ begin
 if exists(select 1 from public.tasks where cohort_id='f1000000-0000-4000-8000-000000000001') or exists(select 1 from public.events where cohort_id='f1000000-0000-4000-8000-000000000001') or exists(select 1 from public.requirement_submissions) then raise exception 'Cross-cohort read leaked'; end if;
end $$;
set local role anon;
do $$ begin
 if exists(select 1 from public.tasks where cohort_id='f1000000-0000-4000-8000-000000000001') then raise exception 'Anonymous task visibility'; end if;
end $$;
reset role;
select 'PASS: lead CRUD, intern task status, submission/review/resubmission, owner and cohort isolation' as workflow_test;
rollback;
