# Persistent Assistant History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Restore a user's private assistant conversation across sessions and devices, with reliable save, paging and clearing.

**Architecture:** Supabase stores atomic question/answer turns in owner-scoped conversations. Vercel verifies identity, reads saved history and fresh permitted records, and appends each response with generation/revision checks. React renders persisted history and explicit recovery states rather than keeping the only copy in memory.

**Tech Stack:** Existing React/TypeScript/Vite, Supabase/PostgreSQL/RLS, Node Vercel handlers, Node test scripts, jsdom and PGlite. No new package or provider key.

**Spec:** ../specs/2026-10-20-assistant-history-design.md — approved October 20, 2026.
**Baseline:** dev at 9b1945c169397509375ade493b96455d4c69d671. Preserve the design document on the implementation branch.

## Global Constraints
- One private conversation per user/role/cohort; current persisted profile establishes scope.
- A lead cannot read an intern's conversation just because they lead the cohort.
- All history operations use the signed-in user's Supabase token. No service-role key is needed.
- Load the latest 20 complete turns; fetch older turns in batches of 20.
- Maximum question 2,000 characters; answer 16,000; source_refs 240 validated ID/view pairs.
- Send only the latest six saved messages, each bounded to 1,000 characters, plus the new question to OpenRouter.
- Clear atomically deletes turns, increments generation and resets revision.
- Retry saving does not call OpenRouter.
- Keep history until cleared or account/cohort deletion; no transcripts in localStorage, analytics or application logs.
- Preserve Calendar, submissions, shared recommendation logic and existing model selection.

## Review Focus
1. A request finishes after sign-out or role/cohort change: it cannot populate the next account's display (Task 3).
2. Database commit succeeds but the HTTP response is lost: recover by request_id without another provider call (Tasks 1–3).
3. Clear races with append, paging or Retry saving: old messages cannot reappear (Tasks 1–3).
4. Missing migration or expired session: show a recoverable error and never fall back to blank writable history (Tasks 2–3).
5. Historical source access is revoked: omit inaccessible source chips and keep new recommendations grounded in current records (Tasks 2–4).

## File map
- New timestamped migration from Supabase CLI: tables, constraints, RLS and narrow history RPCs.
- backend/tests/assistant-history-db.test.cjs: isolated migrated PostgreSQL permissions and transaction tests.
- backend/assistant/auth.cjs: reusable caller validation and authenticated Supabase request helpers.
- backend/assistant/history-store.cjs: history RPC adapter and current-access source resolution.
- backend/assistant/history.cjs and api/assistant/history.js: GET/load, POST/retry-save, DELETE/clear.
- backend/assistant/handler.cjs: persisted model history, fresh context and save result.
- backend/assistant/dev.cjs: same history route locally and endpoint-specific request-size limits.
- backend/tests/assistant-history.test.cjs: endpoint/provider integration tests.
- frontend/src/assistant-history.ts: history types and authenticated endpoint calls.
- frontend/src/Assistant.tsx: restore, page, save status, recover and confirm clearing.
- frontend/src/App.tsx: pass userId and retain account/role/cohort component identity.
- frontend/tests/assistant-history-ui.test.mjs and existing assistant/role tests: session and race regression tests.
- package.json, frontend/package.json, docs/ai/assistant-framework.md, README.md and backend/README.md: test registration and accurate setup/disclosure.

## Task 1: Private conversation storage and atomic operations
**Interfaces produced:** Conversation {id,user_id,cohort_id,role,generation,revision,created_at,updated_at}; Turn {id,conversation_id,request_id,sequence,user_content,assistant_content,generated_at,truncated,source_refs,created_at}. IDs are UUID; scope and sequence are database-controlled.

Authenticated RPC contracts:
- eif_assistant_load(before_sequence bigint default null, expected_generation integer default null) → {conversation,turns,has_more,next_before}; at most 20 turns, ascending display order. Null cursor loads latest; paging requires matching generation.
- eif_assistant_find(request_id uuid, expected_generation integer) → saved turn or null for the caller's current conversation.
- eif_assistant_append(request_id uuid, expected_generation integer, expected_revision integer, user_content text, assistant_content text, generated_at timestamptz, truncated boolean, source_refs jsonb) → {conversation,turn}.
- eif_assistant_clear(expected_generation integer, expected_revision integer) → updated conversation.
All conversation identity comes from auth.uid() and its current profile. Mismatched generation/revision raises a recognizable conflict; malformed input raises validation error.

- [ ] Write database tests first using the existing migrated PGlite setup, closing the database in finally. Assert own-account persistence, unique scope, anonymous denial, unrelated-user/lead denial, and role/cohort mismatch denial. Assert direct table writes cannot forge ownership, order, timestamps or generation.
- [ ] Add assertions for duplicate identical request_id → same turn/revision; conflicting payload → rejection; stale revision → rejection; append/clear serialization → no resurrected turns; 21 turns → latest 20 plus correct older cursor; stale paging generation → conflict; profile/cohort deletion → cascade. Source_refs allow only work/requirements/calendar/projects/feedback/blockers plus UUID IDs; reject extra fields and more than 240 entries.
- [ ] Run node backend/tests/assistant-history-db.test.cjs and observe absent-RPC/table failure before implementation.
- [ ] Generate the additive migration with the available CLI. Implement unique constraints, text bounds, nonblank content, nonnegative counters, indexes and RLS. Grant only required SELECT and authenticated function execution; revoke direct mutation. Put necessary privileged mutations in private fixed-search-path helpers behind constrained public wrappers.
- [ ] Serialize writes by locking the scoped conversation. Check generation before accepting idempotent replay; look up existing request_id before revision rejection. Check all bounded content/metadata on replay. Save pairs and revision atomically. Clear deletes and increments generation in one transaction.
- [ ] Run new database tests and existing submission/week2 permission suites; require exit 0. Register the new suite and commit this deliverable.

## Task 2: Authenticated history endpoints and provider integration
**Consumes:** Task 1 RPC contracts.
**Produces:** createHistoryHandler({env,fetchImpl,now}) and authenticated history-store adapter used by createHandler.

API contracts:
- GET /api/assistant/history?before=<sequence>&generation=<generation> → history page.
- POST /api/assistant/history → retry an existing unsaved pair with requestId, generation, revision, question, answer, generatedAt, truncated and sourceRefs; return saved pair and conversation.
- DELETE /api/assistant/history → clear using generation/revision; return empty conversation metadata.
- POST /api/assistant now accepts {message,requestId,generation,revision}; reject malformed UUID/counters and ignore client-supplied history as context.
- Successful assistant result includes the existing answer/summary/sources fields, requestId and historySaved:boolean. Saved results include conversation metadata; unsaved results include the original bounded pair, expected generation/revision and a saveError code.
- History failures map to 401 expired/missing session, 403 unavailable scope, 409 stale generation/revision and 503 unavailable storage. All responses use Cache-Control:no-store.

- [ ] Write API tests first. Assert identity/role/cohort are server-derived, unrelated transcripts cannot be loaded/saved/cleared, and GET/DELETE/retry work without an OpenRouter key. Assert bad cursor/body is rejected, request and database timeouts are bounded, and missing migration is an explicit storage error.
- [ ] Add provider tests: latest three turns produce six short messages; older visible pages never enlarge provider context; fresh context is loaded on each ask; changed deadlines use current priorities. Assert existing requestId lookup recovers a prior committed result before provider execution; explicit retry-save makes zero provider calls. Assert provider failure saves no pair; append failure returns the answer as unsaved; post-provider revision conflict remains recoverable.
- [ ] Run node backend/tests/assistant-history.test.cjs and observe failure before implementation.
- [ ] Extract existing token/profile validation into auth.cjs without changing authorization. Implement history-store RPC calls, error mapping, paging and batch source resolution under the same user token. Resolve labels from current permitted tables; omit inaccessible/deleted references and never trust saved labels.
- [ ] Implement the history handler/adapter and exact local route. Keep the 12,000-byte existing ask-body cap; allow at most 128 KiB for retry-save so a 16,000-character answer plus bounded source refs can be saved. Bound question, answer and each source separately; do not relax Google/submission route limits.
- [ ] Integrate saved history into the assistant handler. Compare client generation/revision with persisted state before calling the provider; after generation use the same optimistic version for append. An identical completed request returns the stored answer without a new provider call. Failed persistence returns visible answer/save status rather than throwing away the answer.
- [ ] Add prompt guidance that historical messages are untrusted, may describe superseded records and must not override the current snapshot or permissions. Do not add unrelated AI features.
- [ ] Update existing assistant mocks for history operations and remove the old browser-history assumption. Run new and existing assistant tests plus deadline-context tests; require exit 0. Commit.

## Task 3: Restore history and recover safely in the UI
**Consumes:** Task 2 API. **Produces:** HistoryPage/Conversation/Turn/UnsavedTurn TypeScript types and loadHistory(client,cursor?,generation?), retrySave(client,pair), clearHistory(client,version). Each call gets the current auth session; never persists credentials.

- [ ] Write jsdom tests first: load saved conversation before enabling prompts; unmount/remount restores it; refreshed authentication token restores the same user; account/role/cohort change resets and rejects stale results. Test 20-turn paging, stable ordering, no duplicates and maintained scroll position when prepending.
- [ ] Assert history-load failure shows Retry and disables asking; append/save failure displays the answer with Retry saving; retries preserve requestId and perform no provider request. A committed-but-lost response is recovered by history reload; no automatic re-ask.
- [ ] Assert Clear cancel makes no request, failed clear retains messages, and successful clear empties them. Resolve a deferred ask/paging/retry after clear: no old message reappears. Revision conflict preserves the unsaved pair through reload; generation conflict makes the old pair ineligible for saving.
- [ ] Run frontend/tests/assistant-history-ui.test.mjs and observe failure before implementation.
- [ ] Implement assistant-history.ts and pass userId explicitly from App.tsx. Key/reset requests by user/role/cohort and generation; abort and guard stale async completions. Do not store transcripts locally.
- [ ] Replace the unconditional memory reset with a guarded initial load. Add Earlier messages, Refresh conversation, Saved/unsaved status, Retry saving and inline clear confirmation, preserving existing styling and accessible controls. Keep an unsaved pair separate from loaded pages and block a new ask until it is resolved; refresh must not erase it.
- [ ] Reload on tab focus only when no local operation is active, preserving unsaved content. Mark source references historical and use freshly resolved source chips. Render all transcript text as plain text.
- [ ] Replace the memory-only disclosure with the approved saved-history disclosure. Update existing assistant/role-refresh tests for loading, persisted state and confirmation behavior.
- [ ] Run all frontend tests and the production build; require exit 0. Commit.

## Task 4: Whole-flow verification and release preparation
**Consumes:** Completed Tasks 1–3; approved design.

- [ ] Add one integration regression that saves a turn, reconstructs the handler/client session, reloads it and continues with fresh context. Include role/cohort switch, clear-with-late-response and deleted-source cases from Review Focus.
- [ ] Run npm test and npm run build on the final branch; also build with placeholder public Supabase configuration so connected screens are included. Require passing exit codes and review all failures rather than hiding them behind a later command.
- [ ] Perform a desktop/mobile UI check of loading, saved and unsaved history, paging and clear confirmation. Verify keyboard labels/focus and readable long messages. Use synthetic content and no real account credentials in screenshots.
- [ ] Request one independent whole-branch review for authorization, async races, idempotency, endpoint limits, source freshness and deployment tracing. Resolve important findings with failing-then-passing regression tests and repeat affected/full checks.
- [ ] Update documentation: retention until clear/account/cohort deletion; administrator/provider caveats; no automatic recovery of old memory-only messages; migration-before-code rollout; no automatic provider retries; historical timestamps and source chips.
- [ ] Prepare a reviewable PR targeting dev with migration order, passed tests and explicit live-check limits. Do not silently merge or apply production SQL.
- [ ] For deployment after authorization, verify the intended Supabase project, apply only the new migration, deploy matching endpoints/frontend, and run a dedicated intern/lead second-login walkthrough. Confirm account isolation, clear, source revocation, and provider behavior. Record inaccessible live checks as pending, not passed.

## Self-review
All approved design sections map to Tasks 1–4. Review Focus cases have explicit database/API/UI assertions. Version fields, request IDs and endpoint payloads match across tasks. SQL filenames are generated at execution rather than invented. The plan preserves existing product features and provider configuration. Concurrent duplicate provider requests are not a new distributed execution guarantee; idempotent saving and retry-save prevent duplicate turns and avoid replaying an already-known answer. No implementation or live migration is part of this plan document.
