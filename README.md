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

The current backend runs on Supabase. There is no separate FastAPI or AI service yet. See [frontend setup](frontend/README.md) and [backend setup](backend/README.md).

## Check-in 1 status — October 5, 2026

This is a foundation prototype for the fellowship tracker. Vercel deployment and successful Supabase login were reported by the project owner. Role access and task persistence still need end-to-end verification before presenting them as tested.

| Area | Current status |
| --- | --- |
| Frontend | React/TypeScript application; Vercel deployment reported complete |
| Authentication | Supabase email/password sign-in; successful login reported |
| Intern workspace | Task, requirement, and event views with database queries |
| Lead workspace | Cohort task and requirement queries; summary metrics and fellow list use sample data |
| Task completion | Database update implemented; refresh/persistence test pending |
| Access control | Cohort/assignee RLS policies included in the schema; isolation test pending |
| AI support | Planned; current suggestions are static |
| Requirement submission/review | Not implemented; requirements are read-only in the app |

See [the Check-in 1 handoff](docs/check-in-1.md) for testing and presentation steps.

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

The integration's TypeScript check and Vite production build passed on October 5, 2026. Automated live Supabase verification was blocked by a connection timeout; successful app login was subsequently reported by the project owner.

## Next development phase

- Live lead analytics and fellow progress.
- Requirement submission links and lead review.
- In-app task and account administration.
- AI assistance and contextual reminders; FastAPI/OpenRouter remain planned integrations.

The seeded names and sample progress are demonstration data, not real intern records.

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
