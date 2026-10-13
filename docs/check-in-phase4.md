# Phase 4 check-in verification — October 14, 2026

## Result

**Release readiness: blocked.** The deployed lead/intern journey, target database migration, private Storage, and Google consent have not been verified. Do not present those paths as passing.

| Check | Result | Evidence |
| --- | --- | --- |
| Correct Supabase target | Blocked | Intended project ref is `qshunuggruortqaeusxf`. Dashboard redirects to sign-in. Connected Supabase account lists only unrelated `Advisor-Console`; no migration was applied or inspected on target. |
| Preview settings and authentication | Blocked | GitHub reports a successful Preview deployment for the Phase 3 commit, but opening its URL redirects to Vercel login. The connected Vercel account lists only unrelated `advisor-console`. No Preview variable values or app sign-in could be inspected. |
| Attachments and Google connection | Blocked | Automated handler tests passed before the database test stopped. Real Supabase Storage and Google consent require access to the target Preview and test Google accounts. |
| Seeded cohort | Incomplete for hosted demo | Repository's isolated synthetic seed contains 20 fake interns, five teams and two sprints. It is expressly for disposable local databases and has not been applied to the hosted project. Hosted cohort shape remains unknown. |
| Lead/intern deployed script | Blocked | Preview access stops at Vercel login, before the app. |
| `npm test` | Inconclusive | Five backend suites passed. `submission-db.test.cjs` then stopped with Node `Fatal process out of memory: Zone`. Standalone retry failed the same way. Frontend test attempt stopped with `EBADF` while writing its test output. Host had about 900 MiB free RAM. These are host failures, not application assertions. |
| `npm run build` | Partial pass | Both TypeScript projects passed. Default Vite config bundling failed to write under `.vite-temp` (`ENOENT`). Direct Vite build with `--configLoader runner` completed: 72 modules transformed. Full root command did not pass. |
| SQL permission/workflow checks | Blocked | `workflows.sql` was not run against the target. The PGlite migration/permission suite stopped on host memory exhaustion. |

## Issues by severity

1. **P0 — Deployed demo cannot be verified.** Grant tester access to the intended Preview deployment or provide an accessible stable Preview URL. Then test both supplied app roles there.
2. **P0 — Target migration state unknown.** Verify project ref `qshunuggruortqaeusxf` before any SQL change. Compare applied migrations and required tables/policies with `backend/supabase/migrations/`. Use a test branch/project for workflow fixtures; do not run the isolated synthetic seed on hosted data.
3. **P1 — Attachment and Google integration unverified.** Use real Storage and separate Google accounts to test upload, review permissions, consent, sync, reconnect, and disconnect. Follow `docs/google-calendar-setup.md`.
4. **P1 — Hosted cohort realism unknown.** Inspect cohort, team, intern, project, sprint, task, requirement and event counts. Prepare synthetic demo data only in an authorized disposable environment.
5. **P1 — Full automated verification blocked locally.** Re-run `npm test`, `npm run build`, and SQL permission tests on a host with adequate free memory and working temporary writes. Capture exit codes.

## Check-in demo script

1. State that demo data is synthetic; show cohort, team and sprint counts.
2. Sign in as intern. Show assigned task, nearest requirement deadline and calendar agenda. Save a requirement draft with a link, note and PDF; refresh; submit.
3. Sign in as lead. Show cohort dashboard, review queue and intern submission. Open the attachment, request changes, then approve the resubmission.
4. Return to intern. Show review state and task status persistence after refresh.
5. If Google consent is configured, connect each user's own account, review selected events, confirm sync, and show one calendar entry without a duplicate after a second sync. Otherwise label this path unverified and skip it.
6. Close with the issue list above and distinguish automated checks from live Preview evidence.

Use only dedicated test records. Revert task and submission changes through the app after rehearsal if needed. Keep test credentials outside this document.
