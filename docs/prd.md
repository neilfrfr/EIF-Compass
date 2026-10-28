# EIF Compass: Product Requirements Document v2.3 (Sprint 2 Close-Out)

October 28, 2026. This is the repository copy of the PRD; the editable version is the shared document of the same name.

## Document control

Version 2.3 closes Sprint 2: it records what shipped, what is verified and what is still unmeasured, with no change to product scope. No reviewer feedback was received on v2.2, so no requirement was changed in response to feedback.

| Item | Value |
| --- | --- |
| Version | 2.3 (supersedes v2.2, EIF-Compass-PRD-Updated, October 20, 2026) |
| Product | EIF Compass, fellowship tracker for the Eskwelabs Innovation Fellowship |
| Cohort | EIF Innovation Fellowship 2026 (September 30 to November 24, 2026) |
| Repository | https://github.com/neilfrfr/EIF-Compass, branch `dev` |
| Production | https://eif-compass.vercel.app |
| Basis for this version | Repository documentation verified October 20, 2026, and a repository review and test run on October 28, 2026 |

**What changed from v2.2**

- Implementation status and verification status are now separate. A requirement counts as accepted only when its check in [verification-checklist.md](verification-checklist.md) passes.
- The architecture decision is recorded: Supabase row-level security and Vercel serverless functions replace the proposed FastAPI and Render stack.
- Known limitations are added: the assistant rate limiter is in memory, and the repository is public.
- Repository hygiene is recorded: tool logs removed from Git, documentation split into focused pages, a CI workflow added, and a migration check script added.

## Problem, goals and non-goals

Fellowship interns lose time working out what is due and what to do next, and leads repeat reminders and chase status updates, because tasks, requirements, events and feedback are spread across separate channels. EIF Compass puts that work in one workspace so an intern can see their next action and a lead can see where support is needed.

**Goals**

1. Give each intern one place for assigned tasks, requirements, events, feedback and blockers, with a single suggested next action.
2. Give each lead a cohort view of progress, review queue, blockers and overdue work, with drill-down to a team or intern.
3. Provide an AI assistant that explains priorities and drafts communication from permitted records, without grading or ranking people.
4. Enforce access in the database, so role and team boundaries do not depend on the interface.

**Non-goals**

- Grading, scoring, ranking or pass/fail decisions about interns, by the system or by the assistant.
- Sending email or creating calendar events from assistant chat. These stay drafts; calendar sync is a separate, user-confirmed flow.
- Kanban boards and bulk actions. Desktop is the primary surface; phone use must support the core workflows.

Reduced tracking time and clearer priorities are intended benefits. They have not been measured.

## Users and roles

The shipped system has two roles, intern and lead, enforced by database policies. The original PRD also named mentors as an audience; no mentor role exists, so mentoring tasks sit with leads (open decision below).

| Role | Can do | Cannot do |
| --- | --- | --- |
| Intern | See own and shared tasks, change status of own assigned tasks, save and submit requirement drafts, report blockers, read own feedback and notices, use the assistant | Create, edit or remove tasks, requirements or events; see other interns' submissions; change submissions after the cutoff or after approval |
| Lead | Create, edit and remove cohort tasks, requirements and events; review submissions (approve or request changes); manage teams, projects, sprints and milestones; give feedback; comment on and resolve blockers; extend or clear cutoffs | Read or act outside their own cohort |

New sign-ups receive the intern role and the first cohort. Roles are set in the database (Supabase table editor), not in the app; team membership is managed by leads in the app. Sign-in is email and password; signed-out visitors cannot open the dashboard.

## Scope

The P0 workflows and the assistant are implemented as of the October 20 record; the open work is verification on the deployed site, measurement of the acceptance gates, minimal operational metadata and curated demo data, not new features. Additional features stay frozen until that work is done. Google Calendar was added to scope on October 11.

| Area | Status | Notes |
| --- | --- | --- |
| Sign-in, roles, RLS | In scope, implemented | Email and password, session restore, profile role, database policies |
| Tasks, requirements, events, agenda | In scope, implemented | Filters, drafts, private attachments, deadline locks, lead review, combined chronological agenda |
| Projects, sprints, milestones, feedback, blockers, notifications | In scope, implemented | Team-scoped reads, lead feedback per sprint, blocker discussion and resolution, read state |
| Dashboards and next best action | In scope, implemented | Deterministic rule; AI only explains it |
| AI assistant | In scope, implemented | Live-model acceptance still pending |
| Google Calendar sync | Added October 11, implemented | Own account, user-selected events, explicit confirmation; live consent unverified |
| Feedback summaries, approve-to-create tasks, month and week calendar views | P1, optional | Optional after P0 |
| AI Knowledge (lead-uploaded context) | Deferred | Pull request #10 closed unmerged |
| Email execution, announcements, exports, AI cohort summaries | Deferred | Out of the MVP |

## Functional requirements

Every P0 requirement is implemented in code and covered by automated tests; none is accepted until it passes the deployed walkthrough in the verification checklist. Status below is from the October 20 record, with automated tests re-run on October 28.

| ID | Requirement | Status |
| --- | --- | --- |
| AUTH-1 | Email and password sign-in, session restore and sign-out. Project, feedback and blocker reads are limited by role and team through database policies. | Implemented; live lead and intern accounts saw their own views |
| TASK-1 | Leads create, edit and remove tasks linked to project, sprint and milestone. Interns update the status of their own assigned tasks; shared tasks are view only. | Implemented |
| TASK-2 | Combined filters on due date, sprint, priority, status and text. | Implemented |
| REQ-1 | Requirements with links, notes, private attachments, drafts, submit, unsubmit and resubmit before the cutoff, lead approval or change request. Display states: Upcoming (more than 24 hours out), Pending, Under review, Completed, Overdue, shared by dashboard, tracker, filters and assistant. | Implemented; live Storage check pending |
| CAL-1 | Cohort events and requirement deadlines in one chronological agenda, shown in Philippine time. | Implemented |
| PROJ-1 | Teams, projects, sprints and milestones with progress display. | Implemented; confirm lead create and edit controls in the deployed walkthrough |
| DASH-1 | Intern dashboard (progress, next action) and lead dashboard (cohort metrics, review queue, blockers, overdue lists, team and intern drill-down). | Implemented |
| DASH-2 | Next best action by fixed rule: overdue actionable task, then nearest deadline, then blocked milestone, shown with label, reason and due date. The assistant never sets it. | Implemented |
| FDBK-1 | Lead feedback per sprint; intern feedback history. | Implemented |
| BLK-1 / LEAD-1 | Interns report blockers with category and description; leads comment, resolve and list open blockers. | Implemented |
| NOTIF-1 | In-app notices for task assignment, new feedback, due soon and overdue, with read state. | Implemented |
| AI-1 | Assistant requirements in the next section. | Implemented; live-model acceptance pending |

Requirements that are past their cutoff are locked by the database and appear as overdue but are not suggested as an action. A shared requirement counts once per eligible intern, and one intern's completion does not complete it for others.

## AI assistant requirements and safety policy

The assistant helps with planning and communication and never evaluates people. Interns get daily plans and requirement or check-in guidance; leads get cohort briefings, review summaries and communication drafts.

**Requirements (AI-1)**

1. A server-side endpoint verifies the Supabase session and reads only the records the caller may see under RLS. The OpenRouter key never reaches the browser.
2. The system policy forbids grading, ranking, scoring, penalizing and pass/fail decisions. Obvious requests to evaluate a person get a fixed refusal; prioritizing tasks is allowed. The refusal check is narrow and is not a general moderation guarantee.
3. Snapshot text, user messages and history are treated as untrusted data and cannot override the policy. The assistant does not infer performance, motivation or circumstances from overdue work.
4. Answers stream to the browser as plain text only; reasoning and raw provider errors are never forwarded. Only complete answers are saved, and a failed save can be retried on its own.
5. Conversation history is private per account, role and cohort, and is restored across sessions.
6. Email and calendar suggestions are drafts. Chat does not send email or write to a calendar.
7. Explain this suggestion explains the same rule-based action the dashboard shows. If the snapshot is partial, the assistant says the overall ranking cannot be confirmed. A changed suggestion produces a recoverable error, and the dashboard works without AI.

**Limits**

- Six requests per minute per user and one active request at a time, enforced in function memory (see Risks).
- 25-second provider timeout; the first token still waits on authentication, database context and provider latency, so no start time is promised.

## Non-functional requirements

| Area | Requirement | Status |
| --- | --- | --- |
| Authorization | The database is the authorization boundary. Role, cohort and team limits hold even if the interface is bypassed. | Implemented; covered by migrated-PostgreSQL permission tests |
| Deadlines | Intern changes are rejected by the database at or after the cutoff. A date-only cutoff ends at the end of that Philippine date; an exact cutoff takes precedence. | Implemented and tested |
| Secrets | Server-only keys (OpenRouter, Google, Supabase secret key) are never given a `VITE_` prefix and are never committed. Google credentials are stored encrypted on the server. | Implemented; Git history scanned October 28, no keys or tokens found |
| Privacy | Attachments are private. Assistant history is private per account. Removing a requirement removes its submissions and attachments. Sample data contains no real names or emails. | Implemented; live Storage check pending |
| Performance | Dashboard loads in under 3 seconds on the deployed site. | Not yet measured |
| Accessibility | Keyboard operation, visible focus states, forced-colors and reduced-motion support, usable at phone width. | Component tests pass; keyboard and phone pass pending |
| Quality gate | Backend, database and frontend tests and the production build run on every pull request through CI. | Workflow added; add its check to the branch ruleset after the first run |
| Environments | Node 24.19 or newer for frontend tests; Vercel Preview used for Google Calendar testing before production values are set. | Documented |

## Architecture and data

The browser talks to Supabase directly for data, with row-level security as the access rule, and calls four Vercel serverless functions for anything that needs a server secret. This replaces the FastAPI and Render service proposed in the original PRD; the change is deliberate and documented, so the proposed stack is not counted as delivered.

| Component | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite on Vercel | Role-based workspace, login gate, dashboards, assistant panel |
| Database and auth | Supabase PostgreSQL, Auth, Storage | Tables, profile trigger, RLS policies, private attachments, due-date notifications |
| Assistant functions | Vercel functions `api/assistant` and `api/assistant/history` | Verify session, build permitted context, call OpenRouter, stream answers, save history |
| Google Calendar function | `api/google/[action]` | OAuth with PKCE, encrypted credentials, selected-event sync, disconnect |
| Submission cleanup | `api/submissions/remove` | Remove requirement attachments through the server Storage API, with retry after interruption |
| Shared rules | `shared/workflow-rules` | Requirement states and deadlines computed the same way in frontend and backend |
| CI | GitHub Actions | Migration check, tests and build on every pull request |

**Data.** Core tables cover profiles, cohorts, tasks, requirements, submissions, events, teams, projects, sprints, milestones, feedback, blockers, notifications, assistant conversations and Google connections. Ten migrations in `backend/supabase/migrations/` are applied in timestamp order after the base `schema.sql`; `npm run check:migrations` validates the folder and compares it with the hosted ledger.

## KPIs and acceptance gates

No KPI has been measured yet, so this document reports no results. Each gate below has a target and a method; record the date, tester and result in the verification checklist when it is run.

| KPI | Target | Method | Measured |
| --- | --- | --- | --- |
| AI answer accuracy | At least 90% correct | 20 prepared questions on the production model, scored against the records | Not run |
| AI safety | Zero evaluative outputs (no grading, ranking, scoring, penalties or pass/fail) | Same 20 questions plus prepared evaluative prompts | Not run |
| Findability of next action | At least 80% of users name their next priority within 30 seconds | 3 to 5 users on the deployed intern dashboard | Not run |
| Dashboard load time | Under 3 seconds | Deployed site, measured in the browser | Not run |
| Role integrity | Intern and lead see only permitted records | Deployed walkthrough with one lead and one intern account | Local and live-account checks passed; deployed walkthrough pending |
| Demo readiness | Two rehearsals and a backup recording | Rehearsal log and recording | Not recorded |

## Delivery timeline and status

The build ran from the September 30 kickoff to the October 21 Demo Day with checkpoints on October 7 and 14; Sprint 2 closes today, October 28, with the deliverables below due by 5 PM.

| Date (2026) | Milestone | Detail |
| --- | --- | --- |
| Oct 28 | Sprint 2 close-out | PRD v2.3, repository zip and project one-pager due by 5 PM; repository review, hygiene fixes, CI and migration check added |
| Oct 21 | Demo Day | Scheduled. Problem-solution demo of about four minutes; outcome not recorded in the repository |
| Oct 20 | Hardening and PRD v2.2 | Private assistant history, streaming, AI safety policy, shared requirement states, migration history reconciled with the hosted database |
| Oct 14 | Checkpoint 2 | Non-AI P0 workflows and deterministic next-action ranking; assistant readiness review |
| Oct 13 | Week 2 build | Team and cohort permissions, intern workflows, due-date notifications |
| Oct 11 | Scope change | Google Calendar added behind user selection and confirmation |
| Oct 7 | Checkpoint 1 | Sign-in by role, database-backed intern dashboard and requirements, sample records |
| Sep 30 | Kickoff | Two-developer team starts |

## Risks, open decisions and next steps

The largest risk is that deployed behavior is untested: attachments, Google consent, environment variables and the role walkthrough have only been checked locally or in automated tests.

| Risk | Effect | Response |
| --- | --- | --- |
| Deployed behavior unverified | A demo or pilot could fail on Storage, OAuth or missing Preview variables | Complete the deployed items in the verification checklist |
| KPIs not measured | No evidence for the accuracy, safety, usability and speed targets | Run the AI question set, usability test and load check |
| Assistant rate limiter held in function memory | Limits reset across instances and cold starts, so cost and abuse are not capped | Move counters to a shared store before wider use |
| Public repository | Schema and RLS policies are readable by anyone; a hosted Supabase project URL was in committed tool logs (now untracked, still in history; the URL is also public in the browser bundle) | Decide on private visibility; review policies as public artifacts |
| Migration drift | A rerun of the base schema on an upgraded database would undo later grants and policies | Compare the hosted ledger with the folder before every change |
| Demo data not curated | The cohort view looks empty or unrealistic | Prepare about 20 interns, 5 teams and 2 sprints as hosted-safe demo records |

**Open decisions**

- Mentor role: add it as a third role, or remove mentors from the audience. Not decided.
- Repository visibility: keep public or make private. Not decided.
- Demo Day outcome and any panel comments: not recorded in the repository; add them to the next revision.

**Next steps**

- [ ] Run the deployed role walkthrough and the Storage and Google checks
- [ ] Run the migration ledger comparison on the hosted project
- [ ] Add the CI check name to the `dev` branch ruleset after its first run
- [ ] Run the 20-question AI test and the 3 to 5 person usability test
- [ ] Prepare curated demo data and a backup recording
