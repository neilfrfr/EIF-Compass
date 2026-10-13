const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const migrationDir = 'backend/supabase/migrations/';
const id = n => `a2000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [cohortA, cohortB, leadA, leadB, internA, teammateA, internB, otherCohort] = Array.from({ length: 8 }, (_, i) => id(i + 1));
const [teamA, teamB, teamC, projectA, projectB, projectC, sprintA, sprintB, sprintC, milestoneA, milestoneB, milestoneC, taskA, feedbackA, blockerA, commentA, noticeA] = Array.from({ length: 17 }, (_, i) => id(i + 20));
const [legacyTask, sharedRequirement] = [id(37), id(38)];

(async () => {
  const db = new PGlite();
  const query = sql => db.query(sql);
  const exec = sql => db.exec(sql);
  const login = async user => exec(`reset role; set request.jwt.claim.sub = '${user}'; set role authenticated;`);
  const owner = async () => exec(`reset role; set request.jwt.claim.sub = '';`);
  const count = async (table, predicate = 'true') => Number((await query(`select count(*)::int as n from public.${table} where ${predicate}`)).rows[0].n);
  const denied = async sql => assert.rejects(() => exec(sql), /permission|policy|violat|cannot|must|not on|not your|author|only|reassign|unavailable/i);
  const empty = async sql => assert.equal((await query(sql)).rows.length, 0);

  try {
    await exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,storage to anon,authenticated,service_role;
      grant execute on function auth.uid() to public;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to authenticated;`);
    await exec(fs.readFileSync('backend/supabase/schema.sql', 'utf8').replace('create extension if not exists pgcrypto;', ''));
    const week2Migration = '20261013150014_week2_data_permissions.sql';
    const workflowMigration = '20261013170000_intern_workflows.sql';
    for (const file of fs.readdirSync(migrationDir).sort().filter(file => file !== week2Migration && file !== workflowMigration)) {
      await exec(fs.readFileSync(migrationDir + file, 'utf8'));
    }
    await exec(`insert into public.cohorts(id,name) values ('${cohortA}','A'),('${cohortB}','B');
      insert into auth.users(id,email) values
      ('${leadA}','lead-a@example.invalid'),('${leadB}','lead-b@example.invalid'),
      ('${internA}','intern-a@example.invalid'),('${teammateA}','teammate-a@example.invalid'),
      ('${internB}','intern-b@example.invalid'),('${otherCohort}','other@example.invalid');
      update public.profiles set cohort_id = '${cohortA}', role = 'lead' where id = '${leadA}';
      update public.profiles set cohort_id = '${cohortB}', role = 'lead' where id = '${leadB}';
      update public.profiles set cohort_id = '${cohortA}' where id in ('${internA}','${teammateA}','${internB}');
      update public.profiles set cohort_id = '${cohortB}' where id = '${otherCohort}';
      insert into public.tasks(id,cohort_id,assignee_id,title,project_name)
      values ('${legacyTask}','${cohortA}','${internA}','Existing private task','Legacy label');
      insert into public.requirements(id,cohort_id,title) values ('${sharedRequirement}','${cohortA}','Shared requirement');
      insert into public.requirement_submissions(requirement_id,user_id,submission_url,status)
      values ('${sharedRequirement}','${internA}','https://example.invalid/work','in_review');`);
    await exec(fs.readFileSync(migrationDir + week2Migration, 'utf8'));
    await exec(fs.readFileSync(migrationDir + workflowMigration, 'utf8'));
    assert.equal(Number((await query(`select count(*)::int as n from pg_constraint
      where conrelid = 'public.tasks'::regclass and confrelid = 'public.team_memberships'::regclass
      and contype = 'f'`)).rows[0].n), 1, 'database FK must protect task membership across concurrent writes');
    assert.equal(await count('tasks', `id = '${legacyTask}' and project_id is null and sprint_id is null and milestone_id is null`), 1, 'existing task stays unlinked');

    await login(leadA);
    await exec(`insert into public.teams(id,cohort_id,name) values ('${teamA}','${cohortA}','Team A'),('${teamB}','${cohortA}','Team B');
      insert into public.team_memberships(team_id,cohort_id,user_id) values
      ('${teamA}','${cohortA}','${internA}'),('${teamA}','${cohortA}','${teammateA}'),('${teamB}','${cohortA}','${internB}');
      insert into public.projects(id,cohort_id,team_id,title) values
      ('${projectA}','${cohortA}','${teamA}','Project A'),('${projectB}','${cohortA}','${teamB}','Project B');
      insert into public.sprints(id,project_id,cohort_id,title,sequence,starts_on,ends_on) values
      ('${sprintA}','${projectA}','${cohortA}','Sprint 1',1,'2026-10-01','2026-10-14'),
      ('${sprintB}','${projectB}','${cohortA}','Sprint 1',1,'2026-10-01','2026-10-14');
      insert into public.milestones(id,sprint_id,project_id,cohort_id,title) values
      ('${milestoneA}','${sprintA}','${projectA}','${cohortA}','Milestone A'),
      ('${milestoneB}','${sprintB}','${projectB}','${cohortA}','Milestone B');
      insert into public.tasks(id,cohort_id,project_id,sprint_id,milestone_id,assignee_id,title) values
      ('${taskA}','${cohortA}','${projectA}','${sprintA}','${milestoneA}','${internA}','Linked task');
      insert into public.sprint_feedback(id,sprint_id,project_id,cohort_id,author_id,body) values
      ('${feedbackA}','${sprintA}','${projectA}','${cohortA}','${leadA}','Good progress');`);
    await owner();
    await exec(`insert into public.notifications(id,recipient_id,cohort_id,type,title,reference_type,reference_id)
      values ('${noticeA}','${internA}','${cohortA}','feedback','New feedback','feedback','${feedbackA}');`);
    await login(leadA);
    await denied(`insert into public.team_memberships(team_id,cohort_id,user_id) values ('${teamA}','${cohortA}','${otherCohort}')`);
    await denied(`insert into public.tasks(cohort_id,project_id,sprint_id,assignee_id,title) values ('${cohortA}','${projectA}','${sprintB}','${internA}','Bad sprint')`);
    await denied(`insert into public.tasks(cohort_id,project_id,sprint_id,milestone_id,title) values ('${cohortA}','${projectA}','${sprintA}','${milestoneB}','Bad milestone')`);
    await denied(`insert into public.tasks(cohort_id,project_id,assignee_id,title) values ('${cohortA}','${projectA}','${internB}','Bad assignee')`);
    await denied(`insert into public.tasks(cohort_id,sprint_id,title) values ('${cohortA}','${sprintA}','Missing project')`);
    await denied(`update public.projects set team_id = '${teamB}' where id = '${projectA}'`);
    await denied(`delete from public.team_memberships where team_id = '${teamA}' and user_id = '${internA}'`);
    await denied(`insert into public.sprints(project_id,cohort_id,title,sequence,starts_on,ends_on) values ('${projectA}','${cohortA}','Bad',2,'2026-10-15','2026-10-01')`);

    await login(internA);
    assert.equal(await count('projects'), 1);
    assert.equal(await count('sprints'), 1);
    assert.equal(await count('milestones'), 1);
    assert.equal(await count('sprint_feedback'), 1);
    assert.equal(await count('tasks', `id = '${taskA}'`), 1);
    assert.equal(await count('tasks', `id = '${legacyTask}'`), 1);
    assert.equal(await count('requirement_submissions', `user_id = '${internA}'`), 1);
    assert.equal(await count('profiles', `id = '${teammateA}'`), 1);
    assert.equal(await count('profiles', `id = '${internB}'`), 0);
    assert.equal(await count('team_memberships'), 2, 'intern sees own team membership');
    assert.equal(await count('notifications'), 3, 'task and feedback notices are created alongside the manual notice');
    await exec(`update public.tasks set status = 'completed' where id = '${taskA}'`);
    await exec(`update public.tasks set status = 'completed' where id = '${legacyTask}'`);
    await denied(`update public.tasks set title = 'Forged' where id = '${taskA}'`);
    await denied(`insert into public.projects(cohort_id,team_id,title) values ('${cohortA}','${teamA}','Forbidden')`);
    await denied(`insert into public.sprint_feedback(sprint_id,project_id,cohort_id,author_id,body) values ('${sprintA}','${projectA}','${cohortA}','${internA}','Forged')`);
    await denied(`insert into public.notifications(recipient_id,cohort_id,type,title,reference_type,reference_id) values ('${internA}','${cohortA}','feedback','Forged','feedback','${feedbackA}')`);
    await denied(`update public.notifications set recipient_id = '${teammateA}' where id = '${noticeA}'`);
    await exec(`update public.notifications set read_at = now() where id = '${noticeA}'`);
    assert.equal(await count('notifications', 'read_at is not null'), 1);
    await exec(`insert into public.blockers(id,cohort_id,reporter_id,project_id,milestone_id,category,description)
      values ('${blockerA}','${cohortA}','${internA}','${projectA}','${milestoneA}','technical','Need access');
      insert into public.blocker_comments(id,blocker_id,cohort_id,author_id,body)
      values ('${commentA}','${blockerA}','${cohortA}','${internA}','Investigating');`);
    await denied(`insert into public.blockers(cohort_id,reporter_id,project_id,category,description) values ('${cohortA}','${internA}','${projectB}','other','Forged')`);
    await denied(`insert into public.blockers(cohort_id,reporter_id,category,description) values ('${cohortA}','${teammateA}','other','Forged')`);
    await empty(`select * from public.requirement_submissions where user_id = '${teammateA}'`);

    await login(teammateA);
    assert.equal(await count('tasks', `id = '${taskA}'`), 1);
    assert.equal(await count('tasks', `id = '${legacyTask}'`), 0, 'legacy assigned task stays private');
    assert.equal(await count('requirements', `id = '${sharedRequirement}'`), 1);
    assert.equal(await count('requirement_submissions', `requirement_id = '${sharedRequirement}'`), 0, 'another intern cannot read a personal submission');
    assert.equal(await count('blockers'), 0, 'blockers stay personal even for teammates');
    assert.equal(await count('blocker_comments'), 0);
    assert.equal(await count('notifications'), 1, 'teammate receives shared sprint feedback');
    await exec(`update public.tasks set status = 'to_do' where id = '${taskA}'`);
    assert.equal(await count('tasks', `id = '${taskA}' and status = 'completed'`), 1);
    await denied(`insert into public.blocker_comments(blocker_id,cohort_id,author_id,body) values ('${blockerA}','${cohortA}','${teammateA}','Sneak')`);
    await exec(`update public.notifications set read_at = now() where id = '${noticeA}'`);

    await login(internB);
    assert.equal(await count('projects'), 1);
    assert.equal(await count('tasks', `id = '${taskA}'`), 0);
    assert.equal(await count('sprint_feedback'), 0);
    assert.equal(await count('blockers'), 0);

    await login(leadA);
    assert.equal(await count('projects'), 2);
    assert.equal(await count('blockers'), 1);
    assert.equal(await count('requirement_submissions', `requirement_id = '${sharedRequirement}'`), 1);
    await exec(`insert into public.blocker_comments(blocker_id,cohort_id,author_id,body) values ('${blockerA}','${cohortA}','${leadA}','I can help');
      update public.blockers set status = 'resolved' where id = '${blockerA}';`);
    assert.equal(await count('blockers', 'resolved_at is not null'), 1);
    await denied(`update public.blockers set description = 'Changed' where id = '${blockerA}'`);

    await login(leadB);
    await empty(`select * from public.projects where id = '${projectA}'`);
    await empty(`select * from public.blockers where id = '${blockerA}'`);
    await empty(`select * from public.requirement_submissions where requirement_id = '${sharedRequirement}'`);
    await denied(`insert into public.projects(cohort_id,team_id,title) values ('${cohortA}','${teamA}','Wrong lead')`);
    await owner();
    await exec(`insert into public.teams(id,cohort_id,name) values ('${teamC}','${cohortB}','Team C');
      insert into public.team_memberships(team_id,cohort_id,user_id) values ('${teamC}','${cohortB}','${otherCohort}');
      insert into public.projects(id,cohort_id,team_id,title) values ('${projectC}','${cohortB}','${teamC}','Project C');
      insert into public.sprints(id,project_id,cohort_id,title,sequence,starts_on,ends_on)
      values ('${sprintC}','${projectC}','${cohortB}','Sprint 1',1,'2026-10-01','2026-10-14');
      insert into public.milestones(id,sprint_id,project_id,cohort_id,title)
      values ('${milestoneC}','${sprintC}','${projectC}','${cohortB}','Milestone C');`);
    await login(leadA);
    await denied(`insert into public.tasks(cohort_id,project_id,title) values ('${cohortA}','${projectC}','Cross cohort')`);
    await denied(`insert into public.tasks(cohort_id,project_id,sprint_id,title) values ('${cohortA}','${projectA}','${sprintC}','Cross cohort sprint')`);
    await denied(`insert into public.tasks(cohort_id,project_id,sprint_id,milestone_id,title) values ('${cohortA}','${projectA}','${sprintA}','${milestoneC}','Cross cohort milestone')`);
    await login(otherCohort);
    assert.equal(await count('projects'), 1);
    assert.equal(await count('tasks', `id = '${taskA}'`), 0);
    assert.equal(await count('blockers'), 0);
    await exec('reset role; set role anon;');
    for (const table of ['teams','team_memberships','projects','sprints','milestones','sprint_feedback','blockers','blocker_comments','notifications']) {
      await denied(`select * from public.${table}`);
    }
    await owner();
    await exec("set eif.allow_synthetic_seed = 'yes';");
    await exec(fs.readFileSync('backend/supabase/demo/week2_synthetic_seed.sql', 'utf8'));
    assert.equal(await count('profiles', "cohort_id = 'de000000-0000-4000-8000-000000000001' and role = 'intern'"), 20);
    assert.equal(await count('teams', "cohort_id = 'de000000-0000-4000-8000-000000000001'"), 5);
    assert.equal(await count('team_memberships', "cohort_id = 'de000000-0000-4000-8000-000000000001'"), 20);
    assert.equal(await count('sprints', "cohort_id = 'de000000-0000-4000-8000-000000000001'"), 10);
    await exec("set eif.allow_synthetic_seed = 'no';");
    await assert.rejects(() => exec(fs.readFileSync('backend/supabase/demo/week2_synthetic_seed.sql', 'utf8')), /explicit eif.allow_synthetic_seed/);
    await exec('rollback;');
    console.log('PASS: Week 2 migration, team/cohort RLS, linked-task integrity, blocker and notification permissions');
  } finally { await db.close(); }
})().catch(error => { console.error(error.message, error.code, error.detail || ''); process.exitCode = 1; });
