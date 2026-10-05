create table public.ai_knowledge (
 id uuid primary key default gen_random_uuid(),
 cohort_id uuid not null references public.cohorts(id) on delete cascade,
 title text not null check (length(trim(title)) between 1 and 200),
 content text not null check (length(trim(content)) between 1 and 6000),
 audience text not null default 'both' check (audience in ('both','intern','lead')),
 status text not null default 'draft' check (status in ('draft','published')),
 version integer not null default 1,
 created_by uuid default auth.uid(),
 updated_by uuid default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index ai_knowledge_cohort_status_idx on public.ai_knowledge(cohort_id,status,updated_at desc);
alter table public.ai_knowledge enable row level security;
create policy "Lead reads cohort knowledge" on public.ai_knowledge for select to authenticated using(public.user_has_cohort_role(cohort_id,array['lead']));
create policy "Intern reads published guidance" on public.ai_knowledge for select to authenticated using(status='published' and audience in ('both','intern') and public.user_has_cohort_role(cohort_id,array['intern']));
create policy "Lead creates cohort knowledge" on public.ai_knowledge for insert to authenticated with check(public.user_has_cohort_role(cohort_id,array['lead']));
create policy "Lead edits cohort knowledge" on public.ai_knowledge for update to authenticated using(public.user_has_cohort_role(cohort_id,array['lead'])) with check(public.user_has_cohort_role(cohort_id,array['lead']));
grant select,insert,update on public.ai_knowledge to authenticated;
revoke all on public.ai_knowledge from anon;
create function public.stamp_ai_knowledge() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
  NEW.version:=1; NEW.created_by:=auth.uid(); NEW.created_at:=now();
 else
  if NEW.cohort_id<>OLD.cohort_id then raise exception 'Knowledge cohort cannot change'; end if;
  NEW.version:=OLD.version+1; NEW.created_by:=OLD.created_by; NEW.created_at:=OLD.created_at;
 end if;
 NEW.updated_by:=auth.uid(); NEW.updated_at:=now(); return NEW;
end $$;
revoke all on function public.stamp_ai_knowledge() from public,anon,authenticated;
create trigger stamp_ai_knowledge before insert or update on public.ai_knowledge for each row execute function public.stamp_ai_knowledge();
