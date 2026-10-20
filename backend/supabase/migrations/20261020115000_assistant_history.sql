-- Private, account/role/cohort-scoped transcripts. No changes to fellowship records.
create table public.assistant_conversations(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,
 cohort_id uuid not null references public.cohorts(id) on delete cascade,role text not null check(role in ('intern','lead')),
 generation integer not null default 0 check(generation>=0),revision bigint not null default 0 check(revision>=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,cohort_id,role)
);
create table public.assistant_turns(
 id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
 request_id uuid not null,sequence bigint not null check(sequence>0),user_content text not null check(length(btrim(user_content)) between 1 and 2000),
 assistant_content text not null check(length(btrim(assistant_content)) between 1 and 16000),generated_at timestamptz not null,
 truncated boolean not null default false,source_refs jsonb not null default '[]' check(jsonb_typeof(source_refs)='array' and jsonb_array_length(source_refs)<=240),
 created_at timestamptz not null default now(),unique(conversation_id,request_id),unique(conversation_id,sequence)
);
alter table public.assistant_conversations enable row level security;
alter table public.assistant_turns enable row level security;
revoke all on public.assistant_conversations,public.assistant_turns from public,anon,authenticated;
grant select on public.assistant_conversations,public.assistant_turns to authenticated;
create policy assistant_owner_read on public.assistant_conversations for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.cohort_id=assistant_conversations.cohort_id and p.role=assistant_conversations.role));
create policy assistant_turn_owner_read on public.assistant_turns for select to authenticated using(exists(select 1 from public.assistant_conversations c where c.id=conversation_id));
create function eif_private.assistant_history(op text,args jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles;c public.assistant_conversations;t public.assistant_turns;page jsonb;before_seq bigint;oldest bigint;
begin
 select * into p from public.profiles where id=auth.uid();
 if p.id is null or p.cohort_id is null or p.role not in ('intern','lead') then raise exception 'History requires a valid account profile' using errcode='42501';end if;
 insert into public.assistant_conversations(user_id,cohort_id,role)values(p.id,p.cohort_id,p.role) on conflict(user_id,cohort_id,role) do nothing;
 select * into c from public.assistant_conversations where user_id=p.id and cohort_id=p.cohort_id and role=p.role for update;
 if args->>'generation' is not null and (args->>'generation')::integer<>c.generation then raise exception 'Conversation was cleared: generation conflict' using errcode='40001';end if;
 if op in ('append','clear') and ((args->>'conversation_id') is null or (args->>'conversation_id')::uuid<>c.id) then raise exception 'Conversation scope changed' using errcode='40001';end if;
 if op='load' then
  before_seq:=(args->>'before')::bigint;
  if before_seq is not null and (before_seq<1 or args->>'generation' is null) then raise exception 'Invalid history cursor' using errcode='22023';end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.sequence),'[]'),min(q.sequence) into page,oldest from(select * from public.assistant_turns where conversation_id=c.id and (before_seq is null or sequence<before_seq) order by sequence desc limit 20)q;
  return jsonb_build_object('conversation',to_jsonb(c),'turns',page,'has_more',exists(select 1 from public.assistant_turns where conversation_id=c.id and sequence<oldest),'next_before',oldest);
 elsif op='find' then
  select * into t from public.assistant_turns where conversation_id=c.id and request_id=(args->>'request_id')::uuid;
  return case when t.id is null then null else jsonb_build_object('conversation',to_jsonb(c),'turn',to_jsonb(t)) end;
 elsif op='append' then
  if args->>'generation' is null or args->>'revision' is null or (args->>'revision')::bigint<0 or nullif(btrim(args->>'question'),'') is null or length(args->>'question')>2000 or nullif(btrim(args->>'answer'),'') is null or length(args->>'answer')>16000 or args->>'generated_at' is null or jsonb_typeof(args->'truncated') is distinct from 'boolean' or jsonb_typeof(args->'source_refs') is distinct from 'array' then raise exception 'Invalid history turn' using errcode='22023';end if;
  if jsonb_array_length(args->'source_refs')>240 then raise exception 'Too many source references' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(args->'source_refs') ref where jsonb_typeof(ref)<>'object' or ref->>'id' is null or ref->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or ref->>'view' is null or ref->>'view' not in ('work','requirements','calendar','projects','feedback','blockers') or (ref-'id'-'view')<>'{}'::jsonb) then raise exception 'Invalid history source references' using errcode='22023';end if;
  select * into t from public.assistant_turns where conversation_id=c.id and request_id=(args->>'request_id')::uuid;
  if t.id is not null then
   if t.user_content is distinct from args->>'question' or t.assistant_content is distinct from args->>'answer' or t.generated_at is distinct from (args->>'generated_at')::timestamptz or t.truncated is distinct from (args->>'truncated')::boolean or t.source_refs is distinct from args->'source_refs' then raise exception 'Request ID has different content' using errcode='22023';end if;
   return jsonb_build_object('conversation',to_jsonb(c),'turn',to_jsonb(t));
  end if;
  if (args->>'revision')::bigint<>c.revision then raise exception 'Conversation revision conflict' using errcode='40001';end if;
  insert into public.assistant_turns(conversation_id,request_id,sequence,user_content,assistant_content,generated_at,truncated,source_refs)values(c.id,(args->>'request_id')::uuid,c.revision+1,args->>'question',args->>'answer',(args->>'generated_at')::timestamptz,(args->>'truncated')::boolean,args->'source_refs')returning * into t;
  update public.assistant_conversations set revision=revision+1,updated_at=now() where id=c.id returning * into c;
  return jsonb_build_object('conversation',to_jsonb(c),'turn',to_jsonb(t));
 elsif op='clear' then
  if args->>'generation' is null or args->>'revision' is null or (args->>'revision')::bigint<>c.revision then raise exception 'Conversation revision conflict' using errcode='40001';end if;
  delete from public.assistant_turns where conversation_id=c.id;
  update public.assistant_conversations set generation=generation+1,revision=0,updated_at=now() where id=c.id returning * into c;
  return to_jsonb(c);
 end if;
 raise exception 'Invalid history operation' using errcode='22023';
end$$;
revoke all on function eif_private.assistant_history(text,jsonb) from public,anon;
grant execute on function eif_private.assistant_history(text,jsonb) to authenticated;
create function public.eif_assistant_load(before_sequence bigint default null,expected_generation integer default null) returns jsonb language sql security invoker set search_path='' as $$select eif_private.assistant_history('load',jsonb_build_object('before',before_sequence,'generation',expected_generation))$$;
create function public.eif_assistant_find(request_id uuid,expected_generation integer) returns jsonb language sql security invoker set search_path='' as $$select eif_private.assistant_history('find',jsonb_build_object('request_id',request_id,'generation',expected_generation))$$;
create function public.eif_assistant_append(request_id uuid,expected_generation integer,expected_revision bigint,user_content text,assistant_content text,generated_at timestamptz,truncated boolean,source_refs jsonb,expected_conversation uuid) returns jsonb language sql security invoker set search_path='' as $$select eif_private.assistant_history('append',jsonb_build_object('request_id',request_id,'generation',expected_generation,'revision',expected_revision,'question',user_content,'answer',assistant_content,'generated_at',generated_at,'truncated',truncated,'source_refs',source_refs,'conversation_id',expected_conversation))$$;
create function public.eif_assistant_clear(expected_generation integer,expected_revision bigint,expected_conversation uuid) returns jsonb language sql security invoker set search_path='' as $$select eif_private.assistant_history('clear',jsonb_build_object('generation',expected_generation,'revision',expected_revision,'conversation_id',expected_conversation))$$;
revoke all on function public.eif_assistant_load(bigint,integer),public.eif_assistant_find(uuid,integer),public.eif_assistant_append(uuid,integer,bigint,text,text,timestamptz,boolean,jsonb,uuid),public.eif_assistant_clear(integer,bigint,uuid) from public,anon;
grant execute on function public.eif_assistant_load(bigint,integer),public.eif_assistant_find(uuid,integer),public.eif_assistant_append(uuid,integer,bigint,text,text,timestamptz,boolean,jsonb,uuid),public.eif_assistant_clear(integer,bigint,uuid) to authenticated;
