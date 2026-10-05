# Check-in 1 developer handoff

Updated October 5, 2026.

## Goal

Demonstrate a central fellowship tracker for interns and leads, with account sign-in and database-backed work records. Present the build as a foundation prototype; AI support and deeper lead analytics are future work.

## Progress recorded today

- Supabase client configuration updated to accept a publishable key and retain legacy anon-key support.
- Signed-in workspace loading clears sample/previous-user records and reports profile/query failures.
- Task completion checks that an assigned record was updated.
- TypeScript and production build passed.
- Vercel deployment and successful sign-in reported by the project owner.
- Setup guidance prepared for test accounts, role switching, and developer collaboration.
- UUID cohort references retained; no short-ID migration performed.

Remote schema application, role tests, persistence tests, and collaborator invitation acceptance have not been independently verified. Do not treat setup guidance as evidence that those actions were completed.

## Verification checklist

Use separate intern and lead accounts with the same cohort ID. Create another intern account to test record isolation. Keep test account credentials outside the repository.

- [ ] Intern signs in and sees the Fellow workspace.
- [ ] Lead signs in and sees the Lead workspace.
- [ ] Signed-out visitors see login without a dashboard or demo role selector.
- [ ] Refreshing a signed-in session restores the workspace without flashing the public dashboard.
- [ ] Invalid credentials stay on login and show an error.
- [ ] Intern sees a task assigned to their profile.
- [ ] Completing that task persists after a refresh and a new sign-in.
- [ ] Lead sees the intern's task in the cohort task view.
- [ ] Another intern cannot read or update that individually assigned task.
- [ ] Shared requirements and events load for cohort members.
- [ ] An account in another cohort cannot read these cohort records.
- [ ] Signing out returns to login and removes the dashboard and prior live records.
- [ ] Missing profile or failed queries show an error without displaying demo records as live data.

Record actual results before checking items off.

## Presentation flow

1. Explain the intern's need to track work, deadlines, and fellowship requirements in one place.
2. Sign in as an intern and show tasks, requirements, and events.
3. Complete an assigned task and refresh to demonstrate persistence after verifying it.
4. Sign in as a lead and show cohort tasks and requirements.
5. Identify sample lead metrics and static suggestions explicitly.
6. Close with next steps: requirement submissions/review, live analytics, and AI support.

## Scope boundaries

The lead fellow list and cohort summary use sample data. Intern journey percentages and next-action suggestions are static demo content. Requirement submission/review, in-app account administration, and AI-generated support are not implemented.

## Safe handoff

Share repository access and Supabase organization invitations using each developer's own account. Exchange required local configuration through an appropriate private channel. Do not include passwords, private user information, privileged keys, or database credentials in documentation or demo screenshots.

## Login page update

A dedicated sign-in page now gates the dashboard. Session restoration shows a loading screen; sign-out unmounts the workspace. There is no public demo bypass. The client gate controls presentation while Supabase RLS controls database access.

Validation: TypeScript and production build passed. Simulated component tests passed for the loading gate, signed-out login, invalid and successful sign-in, sign-out unmounting, restored sessions, stale initial-session races, and missing configuration. These are local mocked checks, not live account or RLS verification. Browser visual checks were blocked by an unavailable Chromium executable and failed browser download.
