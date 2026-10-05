begin;
insert into public.cohorts(id,name) values ('f1000000-0000-4000-8000-000000000001','Workflow test'),('f1000000-0000-4000-8000-000000000002','Other test cohort');
insert into auth.users(id,email) values ('f2000000-0000-4000-8000-000000000001','workflow-lead@example.invalid'),('f2000000-0000-4000-8000-000000000002','workflow-intern-a@example.invalid'),('f2000000-0000-4000-8000-000000000003','workflow-intern-b@example.invalid'),('f2000000-0000-4000-8000-000000000004','workflow-other@example.invalid');
update public.profiles set cohort_id='f1000000-0000-4000-8000-000000000001',role=case when id='f2000000-0000-4000-8000-000000000001' then 'lead' else 'intern' end where id in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000003');
update public.profiles set cohort_id='f1000000-0000-4000-8000-000000000002' where id='f2000000-0000-4000-8000-000000000004';
update public.profiles set role='lead' where id='f2000000-0000-4000-8000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000001',true);
insert into public.ai_knowledge(id,cohort_id,title,content,status,audience) values
('f6000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Published FAQ','Approved guidance','published','both'),
('f6000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','Draft','Not approved','draft','both'),
('f6000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000001','Lead policy','Lead guidance','published','lead');
do $$ begin
 if (select count(*) from public.ai_knowledge)<>3 then raise exception 'Lead read failed'; end if;
 begin
 insert into public.ai_knowledge(cohort_id,title,content) values('f1000000-0000-4000-8000-000000000002','Forbidden','Cross-cohort');
 raise exception 'Cross-cohort insert allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000002',true);
do $$ begin
 if (select count(*) from public.ai_knowledge)<>1 then raise exception 'Intern sees drafts or lead policy'; end if;
 update public.ai_knowledge set content='Tampered' where id='f6000000-0000-4000-8000-000000000001';
 if found then raise exception 'Intern edited guidance'; end if;
 begin
 insert into public.ai_knowledge(cohort_id,title,content) values('f1000000-0000-4000-8000-000000000001','Forbidden','Intern content');
 raise exception 'Intern insert allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000004',true);
do $$ begin
 if exists(select 1 from public.ai_knowledge) then raise exception 'Other cohort lead read leaked'; end if;
 update public.ai_knowledge set status='published' where id='f6000000-0000-4000-8000-000000000002';
 if found then raise exception 'Other cohort lead edited guidance'; end if;
end $$;
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000001',true);
update public.ai_knowledge set content='Revised',version=999 where id='f6000000-0000-4000-8000-000000000001' and version=1;
do $$ begin
 if (select version from public.ai_knowledge where id='f6000000-0000-4000-8000-000000000001')<>2 then raise exception 'Version stamping failed'; end if;
 update public.ai_knowledge set content='Stale' where id='f6000000-0000-4000-8000-000000000001' and version=1;
 if found then raise exception 'Stale version overwrote guidance'; end if;
end $$;
update public.ai_knowledge set status='draft' where id='f6000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000002',true);
do $$ begin if exists(select 1 from public.ai_knowledge) then raise exception 'Unpublished guidance visible'; end if; end $$;
set local role anon;
do $$ begin
 begin perform 1 from public.ai_knowledge;raise exception 'Anonymous guidance access';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: lead publication/versioning, intern draft and audience isolation, other cohort isolation, unpublishing, anonymous denial' as knowledge_test;
rollback;
