# Execution ledger: calendar/submission bin
Native execution authorized by user on 2026-10-11.
Ruling: work in a fresh feature-branch clone; original workspace has unrelated uncommitted changes.
Ruling: baseline heading test is stale after merged branding update; match current text, preserving role-refresh behavior.
Ruling: use SUPABASE_SECRET_KEY with legacy SUPABASE_SERVICE_ROLE_KEY fallback; privileged access is limited to private credential storage and authorized requirement attachment cleanup.

Task 1: Submission helpers, UI, private Storage migration, database locks and deadline editor implemented. PGlite tests execute actual PostgreSQL RLS with test auth/storage schemas. No live migration applied.
Task 2: OAuth/PKCE, encrypted tokens, user-scoped sync, review UI, deterministic IDs and disconnect implemented. Provider calls mocked for tests.
Review: Fresh reviewer found missing-object finalization, approved reopening, exact deadline editing, attachment cleanup and deleted-event restoration gaps. All fixed and independently rechecked. Conditional token refresh prevents disconnected credential resurrection.
Ruling: Requirement removal marks the parent under authenticated lead RLS before server Storage API cleanup. Interrupted removal remains locked and retryable. No SQL deletes from storage.objects.
Ruling: Use PGlite instead of unavailable local PostgreSQL/Docker. This proves migrated SQL permission/state behavior, not real Supabase Storage concurrency.
Validation: npm test and npm run build passed. Vercel metadata read denied with 403; Preview variables and live account flow remain unverified.
Limitations: Signed URLs request 60 seconds in the application; an authenticated eligible user can choose another lifetime through the Storage API. No malware scanning, Drive Picker, Gmail, invitations or assistant-initiated writes.

Delivery: Git push had no credentials; connected GitHub API published a tree whose SHA exactly matched the reviewed local tree. Branch update used a lease and no force. Draft PR #15 targets dev. Vercel Preview built successfully; production unchanged.
