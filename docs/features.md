# EIF Compass features

## Lead and intern workflows

Leads can create and edit cohort tasks, requirements, and events inside the app. Task assignment lists only interns in the lead's cohort. Interns can change their own assigned task status; shared tasks are view only. Events are displayed in Philippine time.

Requirements have individual submissions: interns save drafts with HTTP(S)/Google Workspace links, a note and private attachments, then submit for review. Before the cutoff they can unsubmit, edit and resubmit. Leads approve or request changes, including reopening approved work. Date-only cutoffs use the end of the specified Philippine date; optional exact cutoffs take precedence. At or after cutoff, intern changes are rejected by the database. Leads can extend or clear exact cutoffs. A shared requirement does not share completion status between interns. Approved submissions cannot be changed by interns. Pending requirements with past deadlines display as overdue.

For an existing database, apply only genuinely missing migrations from `backend/supabase/migrations/` in timestamp order after checking the remote ledger. Filenames now match the hosted migration versions. For a fresh project, run `backend/supabase/schema.sql` first, then every migration in that directory in timestamp order. Do not rerun the base schema on an upgraded project: its original grants and policies predate these workflows. See [migration-history repair](migration-history-repair.md) for the October 20 reconciliation and the verified existing SQL that must not be rerun.

Verification: `npm test` runs component interaction tests; `npm run build` checks TypeScript and the production build. Frontend tests require Node 24.19+ (jsdom 30). The SQL regression suite in `backend/supabase/tests/workflows.sql` creates isolated fixtures, exercises authenticated roles, and rolls back all fixture data.

See `docs/lead-intern-workflows.md` for usage and verification limitations.

## Database-backed dashboards

The intern overview shows assigned-task completion, personal requirement approval/review status, overdue work, deadline-based next actions and future cohort events. Shared view-only tasks are excluded from personal task completion.

The lead overview shows actual intern/team counts, cohort task completion, a submission review queue, overdue work, team task progress and individual intern drill-down. Shared requirements count once per eligible intern, with individual submissions overriding the original requirement status. Existing requirement statuses are retained as legacy fallback where no individual submission exists.

The fellowship week comes from cohort dates; percentages represent recorded task completion. Missing data produces explicit empty states. Suggestions prioritize overdue actionable tasks, nearest task or requirement deadline, then an open blocker on an incomplete milestone. Past-due requirement submissions are locked, so they remain in overdue lists but are not suggested as an action. The assistant answer does not set the dashboard suggestion.

### Lead removal and visual refinement

Leads can remove tasks, requirements, and calendar events from their own cohort with an explicit confirmation. Removing a requirement also removes its linked submissions; cancellation makes no database change. Interns retain view, task status, and submission controls without deletion privileges. Supabase row-level policies enforce the same restrictions independently of the UI.

The login and role dashboards use a teal, sage, and white palette derived from the supplied Eskwelabs screenshot, with larger controls and consistent focus states. The additive migration is `backend/supabase/migrations/20261005152647_lead_removal.sql`. Run `npm test` and `npm run build`; the database workflow test uses rollback-only fixtures.

### AI fellowship assistant

The AI assistant supports intern daily plans and requirement/check-in guidance, and lead cohort briefings, review summaries, and communication drafts. A server-side OpenRouter endpoint verifies Supabase sessions and fetches permitted records under RLS. Email and calendar suggestions are drafts only; Calendar now has a separate, user-confirmed own-account sync flow; assistant chat does not execute it.

Set server-only `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in root `.env.local` locally and Vercel Environment Variables when deployed. Never use a `VITE_` prefix for the OpenRouter key. Run `npm run dev:api` alongside `npm run dev` locally. Conversations are saved privately per account, role and cohort and restored across sessions after the history migration is deployed. See [assistant framework and setup](ai/assistant-framework.md) for limits, data handling, prompts, and planned Google integration.

### Google Calendar and editable submission bin

The feature branch adds secure Google OAuth/PKCE, encrypted server credentials, selected event/deadline review, retry-safe own-calendar sync and disconnect. Requirement removal cleans private attachments through the server Storage API; interrupted cleanup is locked and retryable. No Gmail, invitations or Drive Picker are included.

Run `npm test` and `npm run build`. Both passed for this implementation, including migrated PGlite PostgreSQL permission/state checks and mocked OAuth/provider tests. The due-notification migration was applied to the connected Supabase project. Local browser lead/intern role workflows passed. Real Google consent, Storage behavior and the deployed role walkthrough remain pending; Vercel Preview variables remain unverified.

Follow [Preview setup and pre-merge tests](google-calendar-setup.md). Keep integration variables in Preview while testing; set production-specific values only for the reviewed release. The dedicated projects/sprints, feedback, blockers and notification MVP work remains outstanding.
