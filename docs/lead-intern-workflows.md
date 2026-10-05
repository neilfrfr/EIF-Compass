# Lead and intern workflows

## Lead
Open My work, Requirements, or Calendar and choose Add task/requirement/event. Select an intern or leave assignment shared. Save persists the record in Supabase. Use Edit to revise records. Dates and event times use Asia/Manila. In Requirements, open an intern's submission and choose Approve or Request changes.

## Intern
Open My work and change an assigned task's status. Shared tasks are view only. In Requirements, Submit link sends a HTTP(S) URL for review. Changes requested allows resubmission. Approval belongs to the lead. Calendar displays cohort events; attendance tracking is outside this change. Refresh reloads changes made in another session.

## Security
RLS restricts writes and reads by cohort and ownership. Invoker triggers restrict intern task updates to status, prevent record ownership/cohort changes, reject cross-cohort assignments, and enforce submission/review roles. New triggers are not exposed callable APIs. The existing cohort-role lookup remains intentionally executable by authenticated users for RLS; anonymous execution and direct execution of the profile-creation trigger are revoked.

## Validation
Database regression suite passed on the connected project using authenticated/anonymous database roles; fixtures were rolled back. Component tests passed for form validation, lead create/edit, intern status updates, submission URLs, approval, Philippine event times and failed-save recovery. Production build passed.

Browser visual QA and a deployed end-to-end session test remain outstanding. A clean offline install was blocked by an uncached test dependency; this is not a successful clean-install result. The overview now derives actual records and deadline suggestions; blocker-based suggestions and the AI assistant remain separate PRD work. Existing Supabase password-protection advisory remains.
