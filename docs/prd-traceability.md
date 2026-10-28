# PRD traceability (v2.2 requirements to repository evidence)

Checked October 28, 2026 against `dev` at the merge of PR #25. "Met" means the behavior exists in code and an automated test covers it. It does not mean the deployed site was verified or that a KPI was measured; those are tracked in [verification-checklist.md](verification-checklist.md).

## Functional requirements (PRD section 5)

| ID | Pri | PRD requirement | Evidence in repository | Result |
| --- | --- | --- | --- | --- |
| AUTH-1 | P0 | Sign in (Google or email); roles enforced server-side | `frontend/src/AuthGate.tsx` (email and password); RLS in `backend/supabase/migrations/`; `auth-ui.test.mjs`, `week2-db.test.cjs` | Met for email. Google sign-in not built (v2.2 calls it optional) |
| DASH-1 | P0 | Greeting, fellowship week, progress, deadlines and events, pending requirements, current milestone | `Dashboard.tsx` ("Week N of M"), `dashboard-model.ts`; `dashboard.test.mjs`, `dashboard-ui.test.mjs` | Met |
| DASH-2 | P0 | Next Best Action with reason and due date, labeled as a suggestion | `dashboard-model.ts`, `shared/workflow-rules.mjs`, `ExplainInline.tsx`; `suggestion-explanation.test.cjs`, `explain-inline.test.mjs` | Met. Live-model explanation not measured |
| TASK-1 | P0 | Task fields and four statuses, with project and sprint | `schema.sql` tasks table (title, description, assignee, due date, priority, status to_do / in_progress / for_review / completed); `project_id`, `sprint_id`, `milestone_id` added in `20261013152305_week2_data_permissions.sql` | Met |
| TASK-2 | P0 | Filter by due date, sprint, priority, status | `WorkManager.tsx` (four filters plus text); `workflows.test.mjs` | Met |
| REQ-1 | P0 | Requirement states Upcoming, Pending, Under Review, Completed, Overdue, computed automatically | `shared/workflow-rules.mjs`; `priority-gaps.test.cjs`, `submissions.test.mjs` | Met |
| REQ-2 | P0 | Intern submits a link; lead marks reviewed | `requirement_submissions` and `submission_files` tables, `SubmissionBin.tsx`; `submission-db.test.cjs`, `submission-bin-ui.test.mjs` | Met, and goes further (drafts, private files, deadline locks) |
| CAL-1 | P0 | Agenda view of events and requirement deadlines | `Agenda.tsx`; `intern-flows.test.mjs` (chronological agenda) | Met. Tasks appear in My work, not in the agenda |
| CAL-2 | P1 | Month and week views | No code | Not built (P1, deferred) |
| PROJ-1 | P0 | Project page: team, sprint, milestone timeline, derived progress | `InternFlows.tsx` (task and milestone progress); projects, teams, sprints, milestones tables | Met. Milestones are a list with progress, which the PRD's scope-cut order allows |
| FDBK-1 | P0 | Lead feedback per sprint; intern history | `sprint_feedback` table, `InternFlows.tsx`; `intern-flows.test.mjs` | Met |
| BLK-1 | P0 | Blocker with category and description; lead comments and resolves | `blockers`, `blocker_comments` tables; `intern-flows.test.mjs` | Met |
| NOTIF-1 | P0 | Notices for deadlines, overdue, feedback, assignment; mark as read | `notifications` table (types task_assigned, feedback, due_soon, overdue); `20261013174145_phase3_due_notifications.sql` | Met |
| LEAD-1 | P0 | Cohort overview, team progress with drill-down, overdue and blocker lists | `Dashboard.tsx` lead view (review queue, open blockers, team progress); `dashboard-ui.test.mjs` | Met |
| AI-1 | P0 | Assistant answers from the user's permitted data only | `backend/assistant/` (auth, context, safety, prompts, provider, history); `assistant*.test.cjs` | Met in code. 20-question accuracy test not run |
| AI-2 | P1 | AI feedback summary | No code | Not built (P1, deferred) |
| AI-3 | P1 | Approve-to-create tasks from suggestions | No code | Not built (P1, deferred) |
| LEAD-2, ANN-1, EXP-1 | P2 | AI cohort summary, announcements, CSV export | No code | Not built (post-demo) |
| INT-1 | P2 | Discord, Google Calendar, email | Google Calendar selected-event sync in `api/google/` (added Oct 11) | Calendar built; Discord and email not built |

## AI guardrails (PRD section 6)

| Guardrail | Evidence | Result |
| --- | --- | --- |
| Never grade, rank, score or penalize | `backend/assistant/safety.cjs` (refusal), `prompts.cjs` (policy) | Met. Refusal is narrow; live-model review not run |
| Grounded in permitted records; says so when data is missing | `context.cjs` (context fetched under the caller's RLS) | Met |
| Permissions applied before data reaches the model | `auth.cjs`, `context.cjs` | Met |
| AI-created tasks need approval | AI-3 not built, so the assistant cannot create tasks | Met by absence |
| Next Best Action is deterministic | `dashboard-model.ts`, `shared/workflow-rules.mjs` | Met |
| Rule-based fallback if AI is unavailable | Dashboard computes the action without the assistant | Met |

## Non-functional requirements (PRD section 7)

| Area | Evidence | Result |
| --- | --- | --- |
| Usability (next priority in about 30 seconds) | Dashboard design | Test not run |
| Accessibility | `StatusBadge.tsx` pairs an icon with a text label; focus, forced-colors and reduced-motion tests; keyboard shortcuts and command palette | Built. Keyboard pass not run |
| Performance (under 3 seconds; streaming starts in a few seconds) | Streaming implemented | Not measured |
| Responsiveness | 11 stylesheets with media queries | Built. Phone pass not run |
| Security and privacy | RLS, server-side secrets, private history; retention and OpenRouter disclosure in `Assistant.tsx` | Built. No formal Data Privacy Act review recorded |

## Gaps between the PRD and the repository

1. **Minimal AI operational metadata** (v2.2 "remaining work"): no code found. Not built.
2. **Demo data target** (about 20 interns, 5 teams, 2 sprints): the synthetic seed that generates it is local-only. The hosted cohort at the October 20 review had 2 interns, 2 leads and 1 team. v2.2 says a smaller demo needs an explicit scope adjustment, which is not recorded.
3. **Google sign-in** (AUTH-1): not built.
4. **`ai_knowledge` table**: migration `20261005170257_ai_knowledge.sql` is in the migrations folder although AI Knowledge was deferred and PR #10 closed unmerged. Confirm the table is intended to exist.
5. **Verified commit is behind `dev`**: the October 21 production check was against `c20926e` (PR #23). `dev` now has 37 more commits, including the PR #24 redesign and PR #25. Any live verification applies to that older commit until it is repeated.
