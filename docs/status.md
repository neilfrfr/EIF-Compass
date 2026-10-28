# EIF Compass implementation status

> **Document map.** This file is the current status record. Setup lives in [setup.md](setup.md), feature behavior in [features.md](features.md), and the verification list in [verification-checklist.md](verification-checklist.md). The product requirements are in [prd.md](prd.md).
>
> **Last updated October 28, 2026 (Sprint 2 close-out).** The implementation facts below were last verified on October 20, 2026. Items marked *pending* were not re-verified for this close-out and must not be reported as passed until the checklist is completed.

## Implementation status (verified October 20, 2026)

Check-in 1 foundation: October 7. The foundation and October 14 non-AI P0 workflows are implemented. A local browser lead/intern walkthrough passed; the deployed walkthrough and realistic demo dataset still need verification. This is not yet the complete Demo Day MVP.

| Area | Current status |
| --- | --- |
| Authentication and roles | Email/password login, session restoration, sign-out, profile role loading, and database RLS implemented |
| Intern dashboard | Database-backed progress and deterministic suggested next action: overdue task, nearest deadline, then blocked milestone |
| Lead dashboard | Cohort metrics, review queue, open blockers, overdue item lists, team and intern drill-down |
| Task management | Lead create/edit/remove with project, sprint and milestone links; intern assigned-task status; combined search, deadline, sprint, priority and status filters |
| Requirements | Links, notes, private attachments, drafts, unsubmit/resubmit, deadline locks and lead review implemented on the feature branch; live Storage verification pending |
| Calendar | Cohort event management and chronological event/requirement agenda; Google selected-event sync remains unverified against live OAuth |
| Assistant | Server-side OpenRouter with verified sessions and permission-filtered feedback context; private saved history, explicit no-evaluation rules and incremental streaming implemented; real-provider acceptance remains pending |
| Projects, feedback, blockers, notifications | Project progress, lead feedback, blocker discussion/resolution, and task, feedback, due-soon, overdue notices with read state implemented |
| Demo data | Base seed contains a cohort and sample requirements/events; the planned ~20 interns, 5 teams, and 2 sprints need preparation |
| Validation | Component/API and migrated database tests, production build, and local browser lead/intern walkthrough passed; deployed browser walkthrough remains pending |

### Remaining committed MVP work

This checklist follows the supplied PRD's P0 requirements. Implemented portions are listed above; partial items below must be completed before calling the MVP done.

- [x] **AUTH-1 / team access:** database policies restrict project, feedback and blocker reads; live lead/intern accounts verified their own views.
- [x] **TASK-1 / TASK-2:** project/sprint/milestone links and combined due date, sprint, priority, status and text filters.
- [x] **CAL-1:** combined events and requirement deadlines in a chronological agenda.
- [x] **PROJ-1 / DASH-1:** lead team membership and project/sprint/milestone create/edit controls; team/project progress, sprint and milestone display.
- [x] **FDBK-1:** lead feedback per sprint and intern feedback history.
- [x] **BLK-1 / LEAD-1:** intern blocker reports with category/description, lead comments/resolution, and lead blocker list.
- [x] **NOTIF-1:** in-app notices for deadlines, overdue work, new feedback, and task assignment, with mark-as-read.
- [x] **DASH-2 rule:** deterministic Next Best Action (overdue actionable task, nearest deadline, then blocked milestone), suggestion label, reason/due date. AI explanation remains unverified.
- [x] **AI-1 implementation:** permitted feedback context, explicit no-grading/ranking/scoring/penalties/pass-fail policy, incremental streaming, and complete-only history persistence. Provider acceptance and KPI measurements remain separate.
- [x] **REQ-1 display:** shared Upcoming/Pending/Under review/Completed/Overdue states across dashboard, tracker, filters and assistant context.
- [ ] **Remaining implementation/preparation:** minimal operational metadata and curated demo data/recording. Dashboard greeting, team milestone and a grounded one-click suggestion explanation are implemented in the follow-up branch. See [PRD update](prd-status-2026-10-20.md).
- [ ] **Demo and QA:** realistic seeded cohort, deployed end-to-end role/persistence tests, 20-question AI test (at least 90% accuracy and zero evaluative outputs), 3–5 user usability test (at least 80% identify next priority within 30 seconds), dashboard load under 3 seconds, keyboard/mobile checks, two rehearsals and backup recording.

### Scope and checkpoints

- **October 7:** demonstrate sign-in by role, database-backed intern dashboard and requirements, sample records, and confirm the remaining P0 plan.
- **October 14:** complete all non-AI P0 workflows and deterministic ranking; review assistant readiness.
- **October 21:** demonstrate the tested P0 MVP. Freeze and rehearse by October 20.

Freeze additional features until the missing P0 workflows are complete. AI Knowledge (closed, unmerged PR #10), email execution, announcements, exports, and further AI cohort-summary work are deferred. Google Calendar was explicitly added to scope on October 11 and implemented behind user selection/confirmation. Existing email/calendar assistant outputs remain drafts only; chat does not execute them. P1 feedback summaries, approve-to-create tasks, and month/week calendars are optional after P0.

The implementation deliberately uses Supabase RLS and Vercel functions instead of the proposed FastAPI/Render stack. Database checks enforce authorization; document this architecture choice rather than treating the proposed stack as completed.

See [workflow verification](lead-intern-workflows.md) and [dashboard definitions](dashboard-metrics.md). The older [Check-in 1 handoff](check-in-1.md) records the initial foundation and contains historical scope statements; this page is the current status.

## Known limitations

- The assistant rate limiter (6 requests per minute per user, one active request) is held in memory inside the serverless function. Limits do not carry across function instances or cold starts, so treat it as a courtesy limit, not a hard quota. A shared store (for example a Supabase table or Vercel KV) is required for a hard limit.
- The repository is public. Authorization depends on Supabase RLS, so the policies in `backend/supabase/` are visible to anyone. Review them as a public artifact, and make the repository private if the fellowship does not want its schema public.
- No measured KPI results exist yet. The 20-question AI test, the 3-5 person usability test and the dashboard load-time check are defined but not run.
