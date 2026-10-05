# EIF Compass

EIF Compass gives Eskwelabs Innovation Fellowship interns one workspace for tasks, requirements, and upcoming events, with a cohort view for fellowship leads.

## Repository structure

| Path | Responsibility |
| --- | --- |
| `frontend/` | React UI, login gate, browser Supabase client, Vite/TypeScript configuration, and frontend dependencies |
| `backend/supabase/` | PostgreSQL schema, auth profile trigger, RLS policies, and sample seed records |
| `docs/` | Check-in handoff and repository ruleset documentation |
| `package.json` | Root convenience commands that forward to the frontend |
| `vercel.json` | Root deployment configuration for the frontend build |

The current backend uses Supabase for database authorization and a Vercel serverless endpoint for the OpenRouter assistant. There is no separate FastAPI/Render service. See [frontend setup](frontend/README.md) and [backend setup](backend/README.md).

## Check-in 1 status — October 6, 2026

Checkpoint: October 7. The foundation is largely implemented, with some Week 2 workflows and the assistant already built. The deployed lead/intern walkthrough and realistic demo dataset still need verification. This is not yet the complete Demo Day MVP.

| Area | Current status |
| --- | --- |
| Authentication and roles | Email/password login, session restoration, sign-out, profile role loading, and database RLS implemented |
| Intern dashboard | Database-backed task completion, requirement status, overdue work, upcoming events, and deadline-based next action |
| Lead dashboard | Database-backed cohort/team counts, task progress, review queue, overdue work, and intern drill-down; blocker list missing |
| Task management | Lead create/edit/remove; intern assigned-task status updates; text search; sprint linkage and due-date/priority/status/sprint filters missing |
| Requirements | Instructions, individual submission links, lead approval/request changes, and computed overdue status implemented |
| Calendar | Cohort events displayed in Philippine time; requirement deadlines are not yet combined into the agenda |
| Assistant | Server-side OpenRouter with verified Supabase sessions and permission-filtered context; real-provider accuracy/safety test and streaming pending |
| Projects, feedback, blockers, notifications | Dedicated P0 workflows not implemented |
| Demo data | Base seed contains a cohort and sample requirements/events; the planned ~20 interns, 5 teams, and 2 sprints need preparation |
| Validation | Component/API tests and production builds passed in prior implementation checks; live database workflow/permission tests passed with rolled-back fixtures; deployed browser walkthrough remains pending |

### Remaining committed MVP work

This checklist follows the supplied PRD's P0 requirements. Implemented portions are listed above; partial items below must be completed before calling the MVP done.

- [ ] **AUTH-1 / team access:** verify deployed role/cohort isolation and implement permitted team data access alongside the project model; current intern access is own assigned and shared cohort records.
- [ ] **TASK-1 / TASK-2:** add project/sprint relationships and filters for due date, sprint, priority, and status.
- [ ] **CAL-1:** combine fellowship events and requirement deadlines in a chronological agenda.
- [ ] **PROJ-1 / DASH-1:** team/project page, current sprint/milestone, milestone timeline, and derived project progress.
- [ ] **FDBK-1:** lead feedback per sprint and intern feedback history.
- [ ] **BLK-1 / LEAD-1:** intern blocker reports with category/description, lead comments/resolution, and lead blocker list.
- [ ] **NOTIF-1:** in-app notices for deadlines, overdue work, new feedback, and task assignment, with mark-as-read.
- [ ] **DASH-2:** complete deterministic Next Best Action (overdue, nearest deadline, then blocked milestone), suggestion label, reason/due date, and AI explanation while preserving the rule-based fallback.
- [ ] **AI-1:** include permitted feedback once available; explicitly prohibit grading, ranking/scoring/penalizing interns and pass/fail decisions; verify refusals and grounding; add streaming to meet the PRD's response requirement.
- [ ] **Demo and QA:** realistic seeded cohort, deployed end-to-end role/persistence tests, 20-question AI test (at least 90% accuracy and zero evaluative outputs), 3–5 user usability test (at least 80% identify next priority within 30 seconds), dashboard load under 3 seconds, keyboard/mobile checks, two rehearsals and backup recording.

### Scope and checkpoints

- **October 7:** demonstrate sign-in by role, database-backed intern dashboard and requirements, sample records, and confirm the remaining P0 plan.
- **October 14:** complete all non-AI P0 workflows and deterministic ranking; review assistant readiness.
- **October 21:** demonstrate the tested P0 MVP. Freeze and rehearse by October 20.

Freeze additional features until the missing P0 workflows are complete. AI Knowledge (closed, unmerged PR #10), Google Calendar/email execution, announcements, exports, and further AI cohort-summary work are deferred. Existing email/calendar assistant outputs are drafts only. P1 feedback summaries, approve-to-create tasks, and month/week calendars are optional after P0.

The implementation deliberately uses Supabase RLS and Vercel functions instead of the proposed FastAPI/Render stack. Database checks enforce authorization; document this architecture choice rather than treating the proposed stack as completed.

See [workflow verification](docs/lead-intern-workflows.md) and [dashboard definitions](docs/dashboard-metrics.md). The older [Check-in 1 handoff](docs/check-in-1.md) records the initial foundation and contains historical scope statements; this README is the current status.

## Local development

```bash
npm ci
cp frontend/.env.example frontend/.env.local
npm run dev
```

The app opens on a dedicated email/password login page. The dashboard is mounted only after session restoration or successful sign-in. Signed-out visitors cannot open the dashboard or switch demo roles. Sign-out returns to the login page. Without Supabase configuration, sign-in stays unavailable; the dashboard does not fall back to a public demo.

Root `npm ci` installs frontend dependencies through the `postinstall` script. You can also run `npm ci` and the frontend scripts directly inside `frontend/`.

Fill in `frontend/.env.local` to use live accounts:

```env
VITE_SUPABASE_URL=<your-project-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

The client also accepts `VITE_SUPABASE_ANON_KEY` for compatibility. Use the publishable-key variable for new configuration. Get the values from your Supabase project; this repository intentionally contains no project-specific values.

## Supabase setup

1. Run [backend/supabase/schema.sql](backend/supabase/schema.sql) in your project's SQL Editor. It creates the tables, profile trigger, access policies, and sample cohort requirements/events.
2. Create a test account under **Authentication → Users** after installing the schema. New users receive an `intern` profile and the first cohort.
3. If a user existed before the schema was installed, add their profile using their Auth user ID and the appropriate cohort ID.
4. In **Table Editor → profiles**, set `role` to `intern` or `lead`, and assign `cohort_id` and an optional `team_name`. Sign out and back in after changing roles.
5. Add a task in `public.tasks`, using the user's profile ID as `assignee_id` and the matching `cohort_id`.
6. Use the login page to sign in with the fellowship account.

Cohort IDs remain UUIDs. A human-readable label belongs in the cohort's `name`; keep related IDs consistent.

Authenticated accounts load records allowed by the database policies. Interns can update the status of their assigned tasks. Leads can read cohort records. The login gate controls dashboard visibility; database RLS remains the authorization boundary. Browser code and bundled sample content remain downloadable in this client-rendered app. Signed-in query failures are reported instead of retaining sample records, and task completion checks whether a record was actually updated.

## Vercel deployment

1. Merge the changes into the branch configured for deployment. Keep the Vercel **Root Directory** at the repository root (`.`). The committed `vercel.json` installs through the root package, runs `npm run build`, and publishes `frontend/dist`.
2. Open the Vercel project's **Settings → Environment Variables**.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the intended Production and Preview environments.
4. Redeploy a build containing the integration changes. Vite reads these variables at build time.
5. Open the deployment, sign in, and complete the [verification checklist](docs/check-in-1.md#verification-checklist).

Vercel Connect OAuth credentials are not required for this client integration.

## Developer collaboration

Invite collaborators through the Supabase organization's **Settings → Team** using their own accounts. A Developer role is suitable for database work; broader settings changes require suitable additional permissions. Dashboard membership is separate from an EIF Compass account used to test intern/lead behavior.

Keep passwords, user emails, secret/service-role keys, database connection strings, and private account IDs out of commits, screenshots, issues, and PR descriptions. Configure local values in ignored `frontend/.env.local` files and hosted values in Vercel. Publishable keys are browser-facing, but example files use placeholders for portability. Never put privileged keys in a `VITE_` variable.

## Build and validation

```bash
npm run build
npm run preview
```

Prior implementation checks passed the component/API tests, TypeScript check, Vite production build, and live Supabase workflow/permission regression suite. Database fixtures were rolled back. These results do not establish a successful deployed browser walkthrough or real-model accuracy test. Run `npm test` and `npm run build` for the checked-out revision; see the SQL tests under `backend/supabase/tests/`.

## Lead and intern workflows

Leads can create and edit cohort tasks, requirements, and events inside the app. Task assignment lists only interns in the lead's cohort. Interns can change their own assigned task status; shared tasks are view only. Events are displayed in Philippine time.

Requirements have individual submissions: interns submit HTTP(S) links; leads approve or request changes. A shared requirement does not share completion status between interns. Approved submissions cannot be changed by interns. Pending requirements with past deadlines display as overdue.

For an existing database, apply `backend/supabase/migrations/20261005_lead_workflows.sql`, then `20261005_restrict_helpers.sql`, once. For a fresh project, run `backend/supabase/schema.sql` first, then both upgrades. Do not rerun the base schema on an upgraded project: its original grants and policies predate these workflows.

Verification: `npm test` runs component interaction tests; `npm run build` checks TypeScript and the production build. Frontend tests require Node 24.19+ (jsdom 30). The SQL regression suite in `backend/supabase/tests/workflows.sql` creates isolated fixtures, exercises authenticated roles, and rolls back all fixture data.

See `docs/lead-intern-workflows.md` for usage and verification limitations.

## Database-backed dashboards

The intern overview shows assigned-task completion, personal requirement approval/review status, overdue work, deadline-based next actions and future cohort events. Shared view-only tasks are excluded from personal task completion.

The lead overview shows actual intern/team counts, cohort task completion, a submission review queue, overdue work, team task progress and individual intern drill-down. Shared requirements count once per eligible intern, with individual submissions overriding the original requirement status. Existing requirement statuses are retained as legacy fallback where no individual submission exists.

The fellowship week comes from cohort dates; percentages represent recorded task completion. Missing data produces explicit empty states, not sample metrics. Deadline suggestions prioritize overdue work and then nearest deadlines; blocker ranking and model-generated explanations remain future work. No seed records or database schema changes are introduced by this dashboard update.

### Lead removal and visual refinement

Leads can remove tasks, requirements, and calendar events from their own cohort with an explicit confirmation. Removing a requirement also removes its linked submissions; cancellation makes no database change. Interns retain view, task status, and submission controls without deletion privileges. Supabase row-level policies enforce the same restrictions independently of the UI.

The login and role dashboards use a teal, sage, and white palette derived from the supplied Eskwelabs screenshot, with larger controls and consistent focus states. The additive migration is `backend/supabase/migrations/20261005_lead_removal.sql`. Run `npm test` and `npm run build`; the database workflow test uses rollback-only fixtures.

### AI fellowship assistant

The AI assistant supports intern daily plans and requirement/check-in guidance, and lead cohort briefings, review summaries, and communication drafts. A server-side OpenRouter endpoint verifies Supabase sessions and fetches permitted records under RLS. Email and calendar suggestions are drafts only; Google execution is not connected yet.

Set server-only `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in root `.env.local` locally and Vercel Environment Variables when deployed. Never use a `VITE_` prefix for the OpenRouter key. Run `npm run dev:api` alongside `npm run dev` locally. See [assistant framework and setup](docs/ai/assistant-framework.md) for limits, data handling, prompts, and planned Google integration.
