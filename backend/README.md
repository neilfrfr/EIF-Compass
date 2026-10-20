# EIF Compass backend

Supabase provides PostgreSQL, Authentication and private Storage. Vercel functions provide the OpenRouter assistant, Google OAuth/Calendar sync and authorized requirement attachment cleanup. There is no FastAPI/Render service.

For a fresh database, install `supabase/schema.sql`, then the existing lead workflow/removal/helper migrations in order. Existing projects must apply only missing migrations. The new `supabase/migrations/20261011060705_calendar_submission_bin.sql` preserves existing links and adds drafts, file metadata, deadline guards, private Storage policies and restricted encrypted credential storage. No live migration is applied by committing these files.

## Week 2 data foundation

Apply `supabase/migrations/20261013152305_week2_data_permissions.sql` after the 20261011 migration. It adds teams, intern memberships, projects, sprints, milestones, feedback, blockers, comments, and notifications. Existing tasks keep their legacy labels and gain nullable `project_id`, `sprint_id`, and `milestone_id`. Composite foreign keys enforce cohort, project, sprint, and milestone consistency. A linked task's assignee must be a project team member. Legacy unlinked task access stays unchanged.

Leads manage teams, memberships, projects, sprints, and milestones only in their cohort. Project team members read linked tasks and feedback; only an assigned intern changes their task status. Blockers stay private to reporter and cohort leads, including comments. Notification clients can only read their own rows and mark `read_at`; server-side notice generation is a later phase. New tables are protected by RLS and explicit grants. `team_name` and `project_name` remain display labels, never permission sources.

For an isolated local demo, run `supabase/demo/week2_synthetic_seed.sql` manually in a disposable database after `SET eif.allow_synthetic_seed = 'yes'` in the same session. It creates a dedicated synthetic cohort, 20 fake interns, one fake lead, five teams/projects, and two sprints per project. It inserts into local `auth.users`; never run it against a hosted project or real cohort. The SQL rejects runs without the explicit setting and rejects a duplicate synthetic cohort. Run `node backend/tests/week2-db.test.cjs` to check cross-cohort/team permissions and seed shape without touching a connected Supabase project.

Backend secrets belong in ignored root `.env.local` or environment-scoped Vercel variables. Never prefix privileged credentials with `VITE_`. Run `npm run dev:api` alongside `npm run dev`; production functions live under root `api/`.

`npm test` covers assistant authorization, OAuth/state/encryption, Calendar retry behavior, attachment cleanup and migrated PostgreSQL role/permission/state checks. PGlite uses auth/storage test schemas; a live Storage and Google walkthrough is still required. See [integration setup and verification](../docs/google-calendar-setup.md) and [assistant setup](../docs/ai/assistant-framework.md).
