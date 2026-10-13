# EIF Compass remaining P0 workflows
Date: 2026-10-13
Status: Updated written specification for user review; implementation not started.
PRD: EIF Compass v2.1 Current Stack (user-provided requirements).
Baseline: dev at 02533bedddb13860394c991cc25861fa08bc903a. PRD v2.1 Current Stack, read October 13, 2026.

## Outcome and scope
Finish the October 7–13 core-build work for the October 14 check-in. Interns can track team projects, read sprint feedback, report blockers, and receive in-app notices. Leads can manage these workflows across their cohort. Preserve existing login, tasks, requirement submissions/review, record removal, dashboards, assistant, and teal/sage branding.
Committed: AUTH-1 team access, TASK-1/2, CAL-1, PROJ-1, FDBK-1, BLK-1, NOTIF-1, DASH-1/2 deterministic ranking, LEAD-1, and Week 2 AI context readiness.
Preserve the merged Google Calendar OAuth/sync and private submission-bin implementation. Exclude new email execution, AI Knowledge (closed PR #10), announcements, exports, AI grading, month/week calendar views, AI feedback summaries, and AI task generation. Week 3 streaming and full provider evaluation remain separately tracked.

## Architecture
Keep React/TypeScript/Vite, Supabase Auth/PostgreSQL/Data API, and Vercel assistant function. Use additive versioned SQL migrations under backend/supabase. Browser operations use the signed-in user token; the assistant also reads through that token. RLS is authoritative. No service-role credential in the browser, new standalone backend, or mandatory dependency change.
Existing component-state navigation gains Projects, Feedback, Blockers, and Notifications. Separate components and data helpers own these flows; WorkManager remains responsible for tasks and requirements. Agenda combines existing events with visible requirement deadlines.

## Dev A: structured data and authorization
Teams belong to a cohort. Team memberships link intern profiles to teams; leads manage membership within their cohort. Projects belong to a team and cohort. Sprints belong to a project, with title, sequence and start/end dates. Milestones belong to a sprint, with title, due date and status (pending/in_progress/completed). Dates must be ordered correctly.
Tasks gain nullable project, sprint and milestone foreign keys. Linked entities must belong to the task's cohort and compatible project/sprint hierarchy. Personal assignees on project tasks must belong to the project's team. Preserve project_name and team_name legacy labels; do not infer access from text. Legacy records remain visible under existing ownership/shared-cohort rules until explicitly linked.
Project-linked tasks are readable by project team members and cohort leads. Interns change only their own assigned-task status; teammates have read access only. Team membership does not expose another intern's personal requirements or submissions. Intern profile reads reveal only permitted teammates; no cross-cohort reads.
Feedback belongs to a project sprint and records its lead author, body and timestamp. Cohort leads create/edit their own feedback; project team members read history. Feedback is mentoring prose, without scoring or grading.
Blockers record cohort, reporter, optional project/milestone, category (technical/access/coordination/other), description, open/resolved status and timestamps. Interns report and read their own blockers, choosing only their permitted project links. Leads read cohort blockers, comment and resolve/reopen them. Comments belong to a blocker and record authenticated author/time; the reporter and cohort leads can comment. Identity, ownership and cohort cannot be reassigned.
Use explicit grants, RLS SELECT/INSERT/UPDATE policies and validation triggers. Privileged internal lookup/generation functions, where required to avoid RLS recursion or create trusted notices, use a private schema, fixed search_path, restricted execution and constrained inputs. Access is derived from persisted roles and membership, never editable user metadata.

## Dev A: notifications, aggregation and AI readiness
Notifications record recipient, cohort, type, title, reference, created_at and nullable read_at. Only the recipient reads and marks them read; clients cannot alter content, ownership, references or generate arbitrary notices.
Generate task-assignment notices on new/reassigned tasks and feedback notices for current project team members. A deduplicated database refresh operation generates due-soon (today/tomorrow in Asia/Manila) and overdue notices for actionable owned tasks and applicable requirements. Refresh on notification load is sufficient for the in-app MVP; no external delivery or required scheduler. Repeated refreshes do not duplicate the same source/type/deadline notice. Completed/under-review work is excluded from new reminders.
Project and team progress = completed visible linked tasks / all visible linked tasks. Zero tasks displays “No tasks yet”, not 100%. Milestones show persisted workflow state plus derived linked-task completion; completion percentages never score people.
Next Best Action is a deterministic suggestion: overdue actionable tasks/requirements, nearest dated actionable task/requirement, then an open blocker attached to an incomplete milestone. Exclude completed and review-pending work. Tie-break by date, source type, then ID, consistently in frontend and server. Show reason, due date where present, and “Suggestion”. Recommendation works without OpenRouter.
Extend bounded assistant context with permitted projects/sprints/milestones, feedback and blockers. Keep truncation disclosure and source references. Handle provider failure using existing behavior and the dashboard rule-based suggestion. Do not add write tools or grading. Explicitly prohibit grading, ranking, scoring, penalizing interns and pass/fail decisions; add tests that pin these instructions. Full real-model evaluation and streaming remain separately tracked.

## Dev B: workflows and presentation
Projects: lead creates teams, assigns existing cohort interns, creates projects/sprints/milestones, and edits them. Intern sees their teams' projects, current sprint (date-selected, otherwise upcoming/latest with an honest label), ordered milestones and derived progress. No destructive project removal required this week.
Tasks: maintain create/edit/remove and status updates. Add project/sprint/milestone selectors, plus combined due-date (all/overdue/today/next seven days/no deadline), sprint, priority and status filters alongside text search. Reset filters and show meaningful zero-result states.
Agenda: chronological combined event/deadline list, Philippine dates/time, explicit type labels, and navigation to Requirements. Requirement deadlines use individual submission-derived state; leads see cohort deadlines without duplicating every intern's same deadline. Exact due_at overrides due_date consistently in agenda ordering, overdue state, dashboard and assistant context. Date-only deadlines expire at the end of the Philippine date. Submitted/completed work does not become an actionable deadline recommendation.
Feedback: lead chooses accessible project/sprint and posts feedback; intern views chronological sprint history. Keep required fields, busy states and clear errors.
Blockers: intern submits category/description and optional permitted project/milestone. Both permitted roles read discussion; leads comment and resolve/reopen. Lead dashboard includes open blockers and team/project drill-down while retaining overdue/review lists.
Notifications: unread count, chronological list, reference navigation, mark one/all read. Do not mark read merely by rendering; wait for successful database writes.
All screens have loading/error/empty states, retry where appropriate, labeled controls, keyboard access, text status labels, responsive layout and disabled duplicate submissions. Failed writes retain form input; successful writes refresh dependent views. Reuse current palette and controls.

## Migration and demo-data strategy
Migrations preserve existing records and introduce nullable relationships before new link validation. Do not silently turn profile labels into authoritative memberships. Provide documented lead setup and an optional isolated demo seed for about 20 interns, five teams and two sprints, using synthetic identities only. Seed must not change existing real account roles or delete records. Applying migrations/seed to the connected production project requires explicit target verification and rollback/backup consideration; preparing files does not imply applying them.
Document migration order and the Dev A/Dev B handoff contracts.

## Acceptance and verification
1. Existing task/submission/event workflows and role restoration continue passing tests.
2. Intern A reads their team's project/tasks/feedback but cannot read another team's records, another intern's personal submissions, or another cohort. Forged project/sprint/assignee links are rejected.
3. Intern A changes only their own task status; project team read access grants no extra write permission. Leads cannot manage another cohort.
4. Lead posts sprint feedback; project intern reads it and gets one notification. Unrelated intern does neither.
5. Intern reports blocker; lead comments/resolves; reporter sees persisted history after refresh. Other interns cannot view private blockers.
6. Notification refresh is idempotent; only owner marks read; forged content/recipient changes fail.
7. Task filters combine correctly; agenda includes events and requirements in date order with Manila boundary tests.
8. Project percentages cover no tasks, partial and complete states. Rule-based ranking covers overdue, ties, review-pending exclusions and blocked-milestone fallback.
9. Assistant context excludes unauthorized feedback/project/blocker records and reports truncation.
10. Run rollback-based PostgreSQL permission tests, frontend/API tests, TypeScript/production build and desktop/mobile role walkthrough. Report unavailable live checks explicitly.
11. README records implemented versus pending work and an October 14 demo checklist; no completion claim without fresh verification.

## Delivery order
Dev A establishes data contracts and permission tests first; Dev B wires screens to those contracts. Integrate project model/task filters, then feedback/blockers, then notifications/agenda/dashboard/ranking/context. Keep changes on an isolated Week 2 branch targeting dev; no automatic merge or production deployment.


## October 13 implementation and cleanup decisions
- Keep work on feature/p0-core-workflows, starting from the exact reviewed dev commit. Do not merge, deploy, or apply live database migrations as part of preparing the implementation.
- First deliver structured teams, membership, projects, sprints and milestones with RLS and project-linked tasks. Then deliver sprint feedback and blocker discussions, then in-app notifications, combined task filters and agenda. Finish by integrating dashboards, shared deterministic ranking and permitted assistant context.
- Reuse existing React component-state navigation, Supabase session handling, teal/sage styles, form error patterns and dependency versions. Split the new screens into focused components rather than expanding WorkManager into all workflows.
- Make progress percentages transparent task-completion measures; no performance scoring or person ranking.
- Preserve shared cohort tasks and legacy task/project labels. Existing accounts and data must continue working before they are linked to structured teams.
- Database tests must cover anonymous users, own-team reads, unrelated-team denial, cross-cohort denial, own assigned-task writes, recipient-only notification updates and forged relationship/ownership changes.
- Notification refresh must be deduplicated and restricted to the caller's records. Current event-selection confirmation remains separate from agenda viewing and from assistant chat.
- Branch cleanup removes only branches proved ancestors of dev and unused by open PRs. Use exact-head leases so branches updated during cleanup are not removed. Retain dev and unmerged feat/lead-ai-knowledge.
- Completion evidence: full npm test and npm run build, fresh permission/migration tests, updated requirement mapping, and a reviewable PR. Live database and authenticated production walkthrough limitations must be explicit.
