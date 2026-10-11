create schema if not exists eif_private;
revoke all on schema eif_private from public,anon;
grant usage on schema eif_private to authenticated,service_role;
alter table public.requirements add column due_at timestamptz;
alter table public.requirements add column removing boolean not null default false;
alter table public.requirement_submissions alter column submission_url drop not null;
alter table public.requirement_submissions add column links jsonb not null default '[]';
alter table public.requirement_submissions add column note text not null default '';
alter table public.requirement_submissions drop constraint requirement_submissions_status_check;
alter table public.requirement_submissions add constraint requirement_submissions_status_check check(status in ('draft','in_review','completed','pending'));
create function eif_private.cutoff(r public.requirements) returns timestamptz language sql stable set search_path='' as $$ select coalesce(r.due_at,((r.due_date+1)::timestamp at time zone 'Asia/Manila')) $$;
create table public.submission_files(
 id uuid primary key default gen_random_uuid(),requirement_id uuid not null,user_id uuid not null,
 name text not null check(length(name) between 1 and 200),extension text not null,mime_type text not null,
 size bigint not null check(size between 1 and 10485760),object_path text not null unique,
 uploaded boolean not null default false,created_at timestamptz not null default now(),
 foreign key(requirement_id,user_id) references public.requirement_submissions(requirement_id,user_id) on delete restrict
);
alter table public.submission_files enable row level security;
create function eif_private.editable_submission(req uuid,owner uuid) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare s public.requirement_submissions; r public.requirements;
begin
 select * into r from public.requirements where id=req for share;
 select * into s from public.requirement_submissions where requirement_id=req and user_id=owner for update;
 return not r.removing and auth.uid()=owner and s.status in ('draft','pending') and public.user_has_cohort_role(r.cohort_id,array['intern']) and (r.assignee_id is null or r.assignee_id=owner) and (eif_private.cutoff(r) is null or clock_timestamp()<eif_private.cutoff(r));
end $$;
revoke all on function eif_private.editable_submission(uuid,uuid) from public;
grant execute on function eif_private.editable_submission(uuid,uuid) to authenticated;
create policy "Attachment visibility" on public.submission_files for select to authenticated using(exists(select 1 from public.requirement_submissions s where s.requirement_id=submission_files.requirement_id and s.user_id=submission_files.user_id and (s.user_id=auth.uid() or s.status<>'draft')));
create policy "Reserve attachment" on public.submission_files for insert to authenticated with check(eif_private.editable_submission(requirement_id,user_id));
create policy "Delete reservation" on public.submission_files for delete to authenticated using(eif_private.editable_submission(requirement_id,user_id));
grant select,insert,delete on public.submission_files to authenticated;
grant all on public.submission_files to service_role;
create function eif_private.guard_file() returns trigger language plpgsql security definer set search_path='' as $$
declare n int;allowed jsonb:='{"pdf":"application/pdf","doc":"application/msword","docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","xls":"application/vnd.ms-excel","xlsx":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","ppt":"application/vnd.ms-powerpoint","pptx":"application/vnd.openxmlformats-officedocument.presentationml.presentation","txt":"text/plain","png":"image/png","jpg":"image/jpeg","jpeg":"image/jpeg"}';
begin
 if tg_op='DELETE' then
  if exists(select 1 from storage.objects where bucket_id='eif-submissions' and name=old.object_path) then raise exception 'Remove stored file before reservation';end if;return old;
 end if;
 if not eif_private.editable_submission(new.requirement_id,new.user_id) then raise exception 'Submission is locked' using errcode='42501';end if;
 select count(*) into n from public.submission_files where requirement_id=new.requirement_id and user_id=new.user_id;
 if n>=5 then raise exception 'Maximum five files';end if;
 if lower(regexp_replace(new.name,'^.*[.]',''))<>new.extension then raise exception 'Filename extension does not match';end if;
 if new.uploaded or (allowed->>new.extension) is distinct from new.mime_type then raise exception 'Invalid file type or upload state';end if;
 new.object_path:=new.user_id::text||'/'||new.requirement_id::text||'/'||new.id::text||'.'||new.extension;return new;
end $$;
revoke all on function eif_private.guard_file() from public,anon,authenticated;
create trigger guard_submission_file before insert or delete on public.submission_files for each row execute function eif_private.guard_file();
create or replace function public.guard_requirement_submission() returns trigger language plpgsql security invoker set search_path='' as $$
declare r public.requirements; link text;
begin
 if auth.uid() is null then return new;end if;
 select * into r from public.requirements where id=new.requirement_id for share;
 if r.id is null or r.removing then raise exception 'Requirement unavailable' using errcode='42501';end if;
 if tg_op='UPDATE' and (new.requirement_id<>old.requirement_id or new.user_id<>old.user_id) then raise exception 'Ownership cannot change';end if;
 if public.user_has_cohort_role(r.cohort_id,array['lead']) then
  if tg_op<>'UPDATE' or old.status not in ('in_review','completed','pending') or new.status not in ('completed','pending') or (to_jsonb(new)-'status'-'reviewed_at') is distinct from (to_jsonb(old)-'status'-'reviewed_at') then raise exception 'Leads review submitted work only' using errcode='42501';end if;
  new.reviewed_at:=clock_timestamp();return new;
 end if;
 if new.user_id<>auth.uid() or not public.user_has_cohort_role(r.cohort_id,array['intern']) or (r.assignee_id is not null and r.assignee_id<>auth.uid()) then raise exception 'Not your submission' using errcode='42501';end if;
 if eif_private.cutoff(r) is not null and clock_timestamp()>=eif_private.cutoff(r) then raise exception 'The submission deadline has passed' using errcode='42501';end if;
 if tg_op='UPDATE' and old.status='completed' then raise exception 'Approved work is locked';end if;
 if new.status not in ('draft','in_review') then raise exception 'Only leads review work';end if;
 if tg_op='UPDATE' and old.status='in_review' and (new.status<>'draft' or new.submission_url is distinct from old.submission_url or new.links<>old.links or new.note<>old.note) then raise exception 'Unsubmit before editing';end if;
 if jsonb_typeof(new.links)<>'array' or jsonb_array_length(new.links)>10 or length(new.note)>5000 then raise exception 'Too many links or note too long';end if;
 for link in select jsonb_array_elements_text(new.links) loop
  if link !~ '^https?://[^[:space:]]+$' or length(link)>2048 then raise exception 'Use valid HTTP or HTTPS links';end if;
 end loop;
 if new.status='in_review' then
  if new.submission_url is null and jsonb_array_length(new.links)=0 and not exists(select 1 from public.submission_files f where f.requirement_id=new.requirement_id and f.user_id=new.user_id) then raise exception 'Add a link or file';end if;
  if exists(select 1 from public.submission_files f where f.requirement_id=new.requirement_id and f.user_id=new.user_id and (not f.uploaded or not exists(select 1 from storage.objects o where o.bucket_id='eif-submissions' and o.name=f.object_path and (o.metadata->>'size')::bigint=f.size and o.metadata->>'mimetype'=f.mime_type))) then raise exception 'Finish or remove missing or pending uploads';end if;
  new.submitted_at:=clock_timestamp();
 end if;
 new.reviewed_at:=null;return new;
end $$;
drop policy "Submission visibility" on public.requirement_submissions;
create policy "Submission visibility" on public.requirement_submissions for select to authenticated using(exists(select 1 from public.requirements r where r.id=requirement_id and public.user_has_cohort_role(r.cohort_id,array['intern','lead']) and (r.assignee_id is null or r.assignee_id=user_id) and (user_id=auth.uid() or (status<>'draft' and public.user_has_cohort_role(r.cohort_id,array['lead'])))));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('eif-submissions','eif-submissions',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain','image/png','image/jpeg']);
create policy "Submission file download" on storage.objects for select to authenticated using(bucket_id='eif-submissions' and exists(select 1 from public.submission_files f where f.object_path=storage.objects.name));
create policy "Submission file upload" on storage.objects for insert to authenticated with check(bucket_id='eif-submissions' and exists(select 1 from public.submission_files f where f.object_path=storage.objects.name and not f.uploaded and eif_private.editable_submission(f.requirement_id,f.user_id)));
create policy "Submission file removal" on storage.objects for delete to authenticated using(bucket_id='eif-submissions' and exists(select 1 from public.submission_files f where f.object_path=storage.objects.name and eif_private.editable_submission(f.requirement_id,f.user_id)));
create function public.finish_submission_upload(file_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare f public.submission_files; meta jsonb;
begin
 select * into f from public.submission_files where id=file_id;
 if f.id is null or not eif_private.editable_submission(f.requirement_id,f.user_id) then raise exception 'Submission is locked' using errcode='42501';end if;
 select metadata into meta from storage.objects where bucket_id='eif-submissions' and name=f.object_path;
 if meta is null or coalesce(meta->>'mimetype','')<>f.mime_type or coalesce((meta->>'size')::bigint,-1)<>f.size then raise exception 'Upload is missing or metadata does not match';end if;
 update public.submission_files set uploaded=true where id=f.id;
end $$;
revoke all on function public.finish_submission_upload(uuid) from public,anon;
grant execute on function public.finish_submission_upload(uuid) to authenticated;
-- Google credentials are encrypted by the server and never exposed through the Data API.
create table eif_private.google_connections(user_id uuid primary key references public.profiles(id) on delete cascade,email text not null,tokens text not null,updated_at timestamptz not null default now());
create table eif_private.google_states(state_hash text primary key,user_id uuid not null references public.profiles(id) on delete cascade,binding_hash text not null,verifier text not null,expires_at timestamptz not null);
create table eif_private.google_sync(user_id uuid references public.profiles(id) on delete cascade,source_type text not null,source_id uuid not null,event_id text not null,fingerprint text not null,updated_at timestamptz not null default now(),primary key(user_id,source_type,source_id));
revoke all on all tables in schema eif_private from public,anon,authenticated;
create function eif_private.google_store(op text,owner uuid,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 case op
 when 'connect_get' then select to_jsonb(c) into result from eif_private.google_connections c where user_id=owner;
 when 'connect_put' then insert into eif_private.google_connections(user_id,email,tokens) values(owner,args->>'email',args->>'tokens') on conflict(user_id) do update set email=excluded.email,tokens=excluded.tokens,updated_at=now();
 when 'connect_refresh' then update eif_private.google_connections set tokens=args->>'tokens',updated_at=clock_timestamp() where user_id=owner and tokens=args->>'previous' returning to_jsonb(google_connections) into result;
 when 'connect_delete' then delete from eif_private.google_connections where user_id=owner;delete from eif_private.google_states where user_id=owner;
 when 'state_put' then
  delete from eif_private.google_states where expires_at<now();
  insert into eif_private.google_states values(args->>'hash',owner,args->>'binding',args->>'verifier',now()+interval '10 minutes');
 when 'state_consume' then
  delete from eif_private.google_states where state_hash=args->>'hash' and binding_hash=args->>'binding' and expires_at>now() returning to_jsonb(google_states) into result;
 when 'sync_get' then select to_jsonb(s) into result from eif_private.google_sync s where user_id=owner and source_type=args->>'type' and source_id=(args->>'id')::uuid;
 when 'sync_put' then insert into eif_private.google_sync(user_id,source_type,source_id,event_id,fingerprint) values(owner,args->>'type',(args->>'id')::uuid,args->>'event_id',args->>'fingerprint') on conflict(user_id,source_type,source_id) do update set event_id=excluded.event_id,fingerprint=excluded.fingerprint,updated_at=now();
 else raise exception 'Unknown store operation';
 end case;
 return result;
end $$;
revoke all on function eif_private.google_store(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function eif_private.google_store(text,uuid,jsonb) to service_role;
create function public.eif_google_store(op text,owner uuid,args jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select eif_private.google_store(op,owner,args) $$;
revoke all on function public.eif_google_store(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.eif_google_store(text,uuid,jsonb) to service_role;
-- Keep privileged upload implementation outside the exposed schema.
alter function public.finish_submission_upload(uuid) set schema eif_private;
create function public.finish_submission_upload(file_id uuid) returns void language sql security invoker set search_path='' as $$ select eif_private.finish_submission_upload(file_id) $$;
revoke all on function public.finish_submission_upload(uuid) from public,anon;
grant execute on function public.finish_submission_upload(uuid) to authenticated;
-- Parent-row locks need privileged lookup because interns have no requirement UPDATE policy.
-- The private trigger explicitly checks current auth.uid(), role, cohort and assignment above.
alter function public.guard_requirement_submission() security definer;
alter function public.guard_requirement_submission() set schema eif_private;
revoke all on function eif_private.guard_requirement_submission() from public,anon,authenticated;
