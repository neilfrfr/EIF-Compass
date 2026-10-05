# Dashboard metrics

Both roles load the cohort and permitted profiles/tasks/requirements/submissions/events through the ordinary browser Supabase client. RLS remains authoritative. No database records are inserted or rewritten for dashboard display.

Intern task completion is completed personally assigned tasks / all personally assigned tasks. Shared view-only tasks appear in the list but do not affect this percentage. Lead task completion is completed cohort tasks / all cohort tasks, including shared tasks. Empty denominators display an em dash.

Requirement status uses an individual submission if present; otherwise the existing requirement status is a legacy fallback. Completed/in-review states are retained; outstanding requirements become overdue when the due date precedes today in Asia/Manila. A shared requirement applies to each current intern; an assigned requirement applies only to its assignee. Leads see the sum of these individual requirement obligations.

Team groups come from nonempty profile team_name values. Team progress uses members' assigned tasks, excluding shared cohort tasks. Unassigned interns remain visible in the intern table. Review queue counts in-review submissions for visible applicable requirements. Drill-down shows a selected intern's assigned tasks and applicable requirements.

Upcoming events exclude records whose start time has passed. Suggested next action uses personally assigned unfinished/non-review tasks and outstanding requirements with deadlines; earliest deadline wins, with tasks before requirements on ties. There is no blocker table or AI inference in this rule. Cohort week and duration come from starts_on/ends_on, independent of work completion.

Dashboard metrics, shared submissions, empty states, permission-related rendering, role refresh and existing management interactions pass automated tests. Production build passes. Visual browser QA and a real deployed lead/intern session test remain outstanding.
