# Calendar and submission bin implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task.

Goal: Add private file submissions with deadline locks and confirmed Google Calendar synchronization.
Architecture: Authenticated Supabase operations enforce submission permissions; Vercel functions own OAuth, encrypted credentials and Calendar writes.
Tech Stack: React/TypeScript, PostgreSQL/Supabase Storage, Node.js, Google OAuth.
Spec: docs/superpowers/specs/2026-10-11-calendar-submission-bin-design.md

## Global constraints
Five files maximum, 10 MiB each. Philippine time. Private storage. No calendar invitations, no AI writes, no public credentials. Preserve legacy links. No production merge/deploy/migration.
## Review focus
Deadline race; submitted object deletion; cross-user downloads; OAuth replay/browser binding; retry-safe calendar IDs.
## Task 1: Submission bin
Files: backend/supabase/migrations (CLI-generated), frontend/src/SubmissionBin.tsx, frontend/src/submissions.ts, frontend/src/WorkManager.tsx; frontend/tests/submissions.test.mjs; backend/tests/submission-db.test.cjs.
Interfaces: submissionCutoff(requirement), canEditSubmission(requirement,submission,now), validateAttachment(file); database draft/in_review transitions and attachment policies.
- [x] Write and run failing cutoff/file validation tests.
- [x] Implement helpers, migration/state guards and private bucket policies.
- [x] Implement draft/upload/submit/unsubmit UI and authorized downloads; adapt WorkManager.
- [x] Run helper/UI/SQL tests and production build; commit.
## Task 2: Google Calendar
Files: backend/google/{handler,crypto,calendar}.cjs, api/google/[action].js, frontend/src/GoogleCalendar.tsx; backend/tests/google.test.cjs.
Interfaces: createGoogleHandler({env,fetchImpl,oauthFactory}); encrypt/decrypt; eventPayload(source); stable event ID; authenticated connect/status/callback/sync/disconnect routes.
- [x] Write/run failing crypto, payload, authorization and OAuth replay tests.
- [x] Implement secret-only credential/state storage migration, OAuth flow and bounded retry-safe sync.
- [x] Add connection/review/sync results UI to Calendar; update environment examples/local API server.
- [x] Run complete tests/build; commit.
## Task 3: Review and handoff
- [x] Run whole suite and permission checks; review branch; fix important findings with regression tests.
- [x] Update setup/readme with fresh verification evidence and remaining live OAuth checks.
- [x] Push feature branch and open draft PR; do not merge.

Delivery: draft PR #15. Preview deployment READY for commit 421422d. Live OAuth/Storage walkthrough remains pending.
