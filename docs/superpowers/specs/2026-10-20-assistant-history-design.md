# EIF Compass — Persistent Assistant History Design
Date: October 20, 2026  
Status: Proposed design for review; no implementation or live database changes.  
Baseline: dev at 9b1945c169397509375ade493b96455d4c69d671.

## 1. Outcome
An authenticated user can leave the Assistant, refresh, close the browser, sign out and sign back in, or use another device, and continue their saved conversation. History is private to that user and separated by their current fellowship role and cohort.

This is an architectural change: the existing implementation deliberately keeps messages in React memory and states that conversations are not stored. This design replaces that behavior with account-based persistence. Previously cleared messages cannot be recovered.

## 2. Chosen scope and alternatives
Use Supabase as the durable source of truth, with the existing React UI and authenticated Vercel assistant endpoint.

| Approach | Tradeoff | Decision |
| --- | --- | --- |
| Browser local storage | Small change, but tied to one browser/device and leaves transcripts on shared devices | Not selected |
| Private account-based Supabase history | Survives sessions and devices; requires database authorization and failure handling | Selected |
| Full conversation sidebar with multiple named threads | More navigation, state and testing before Demo Day | Deferred |

For this release there is one conversation per user/role/cohort, with Clear conversation rather than multiple named chats. No chat export, search, sharing, lead supervision of intern chats, automatic summarization, or new AI write tools.

## 3. What the user sees
- Opening Assistant shows “Loading your conversation…” before prompts are enabled. An empty-state prompt appears only after history was successfully checked.
- Saved messages return in their original order with the existing user/assistant styling and response timestamp.
- A short disclosure says: “Your conversation is saved privately to your account. Past answers reflect records checked at the time; new answers check your current permitted records.”
- Successful turns display a quiet “Saved” state.
- If an answer is available but saving fails, keep the question and answer visible and show “This response hasn’t been saved. Retry saving before leaving.” Provide Retry saving without another AI request.
- A history-load error shows Retry and does not silently start a blank conversation. Asking remains disabled until recovery, preventing accidental overwrite.
- Clear conversation asks for confirmation explaining that saved history will be deleted. Cancel makes no change. On success, show the normal empty state.
- Sign-out clears the browser’s in-memory display. Saved account history remains available after the same user signs back in.
- If role or cohort changes, cancel pending activity and load only the newly applicable conversation.

## 4. Data model
Add two tables through one additive versioned migration. Existing fellowship data and existing account roles remain unchanged.

### assistant_conversations
| Field | Purpose |
| --- | --- |
| id: UUID | Conversation identity |
| user_id: UUID | Owner; references the account profile |
| cohort_id: UUID | Fellowship scope |
| role: intern or lead | Role scope established from the authenticated profile |
| generation: integer | Changes when history is cleared, invalidating older pending saves |
| revision: integer | Increases with each committed turn |
| created_at, updated_at | Database-generated timestamps |

Unique constraint: user_id + cohort_id + role. Deleting the owner’s profile or the cohort removes the related conversation and turns.

### assistant_turns
| Field | Purpose |
| --- | --- |
| id: UUID | Turn identity |
| conversation_id: UUID | Parent conversation |
| request_id: UUID | Idempotency key created once per submitted question |
| sequence: integer | Database-assigned order within the conversation |
| user_content: text | Submitted question; maximum 2,000 characters |
| assistant_content: text | Visible answer; maximum 16,000 characters |
| generated_at | Time of the answer’s record snapshot |
| truncated: boolean | Whether its source snapshot was limited |
| source_refs: JSON array | Up to 240 validated record ID/view pairs; labels resolved again on load |
| created_at | Database save timestamp |

A turn stores the question and answer together, so partial pairs cannot appear. Unique constraints cover conversation/request_id and conversation/sequence. Do not store access tokens, provider credentials, full database snapshots, hidden reasoning, email addresses as identity keys, or attachment contents.

Persisted source chips store only bounded record IDs and destination views. Resolve their labels and access again under current permissions when loading them; omit inaccessible references. Do not save a second unrestricted copy of fellowship record text as source metadata.

## 5. Authorization
All history operations use the signed-in user’s Supabase token. No service-role key is needed.

- Enable RLS and explicit least-privilege grants on both tables.
- Read and write access requires owner = auth.uid(), with current profile role and cohort matching the conversation.
- A lead cannot read an intern’s conversation just because they lead the cohort.
- Cross-account, cross-cohort and old-role access is denied at the database boundary.
- Ownership, scope, IDs, order and creation timestamps cannot be reassigned through ordinary updates.
- Anonymous access is denied.
- Conversation creation, appending and clearing use constrained database functions. Derive identity and scope from authenticated profile records, never editable metadata or browser-supplied user/role/cohort values.
- Mutation functions are atomic. If privileged internal helpers are necessary, keep them private with a fixed search_path and restricted execution; expose only narrowly scoped authenticated entry points.

Stored transcripts remain untrusted conversation text. Even a deliberately edited or forged transcript must never grant access, override instructions or become an authoritative fellowship record.

## 6. Save, reload and clear flows
### Open or reload
1. Resolve the signed-in account’s current profile.
2. Find its matching conversation; create it atomically if absent.
3. Load the latest 20 complete turns in sequence order.
4. Display an “Earlier messages” control when older turns exist. Fetch 20 at a time with a sequence cursor; never load an unbounded transcript.
5. Record generation and revision for subsequent writes.

### Ask and save
1. Create a request_id for the submitted question and disable duplicate submission.
2. The existing assistant endpoint authenticates the caller, verifies scope and reads the latest saved conversation revision.
3. Build a fresh permitted-record snapshot and use shared deterministic priorities.
4. Send only the latest six saved messages, each bounded to 1,000 characters, plus the new question to OpenRouter. Display pagination does not change the model’s context limit.
5. After receiving an answer, append the complete turn atomically using request_id and the expected generation/revision.
6. Return the answer, current context metadata and an explicit save result.
7. On successful persistence, render Saved. On save failure, retain the visible pair and offer Retry saving.

Retry saving reuses the same request_id and the existing answer. It does not call OpenRouter or repeat provider charges. A duplicate successful append returns the existing turn rather than inserting another pair. If a retry submits different content for an already-used ID, reject it.

The authenticated retry operation accepts only a bounded transcript pair for the caller’s applicable conversation. Transcript data is not proof that the model generated it and remains untrusted. It cannot alter fellowship records, stored identity or permissions.

### Clear
Clear runs atomically: delete turns, increment generation, reset revision and retain the empty conversation identity. A pending append with an older generation must fail, even if another tab or server request finishes later. The browser aborts its pending request and clears its display only after the database confirms success. A failed clear leaves messages visible.

Application-level Clear removes the transcript from active application storage; it does not promise deletion from provider retention or database backups.

## 7. Concurrency and error behavior
- Use revision checks and a row lock or equivalent transaction to serialize turn commits.
- Two tabs cannot silently overwrite each other. If another turn was saved first, keep the local answer visible as unsaved and ask the user to reload the latest conversation before deliberately retrying its save against the updated revision. A generation mismatch caused by Clear permanently rejects the old turn; it cannot be retried into the new empty history.
- Returning to the tab or pressing Refresh conversation reloads persisted history. Realtime synchronization is not required for the demo.
- Navigating away must not update a different account’s UI when a pending operation completes. Guard responses by account/scope and request identity.
- A completed server-side answer may still be saved after the user leaves the page; clearing invalidates it through generation checks. Closing the tab before the server completes is not a delivery guarantee.
- If the session expires, request sign-in; never save into a fallback account or local-storage bucket.
- Provider failure creates no successful saved turn. Preserve the question for retry.
- A network failure after a database commit is recoverable by loading history and checking request_id before asking again. Never automatically repeat the provider call.

## 8. Freshness, privacy and retention
Saved history is a record of the conversation, not a replacement for current task data. Every new answer still authenticates the user, reapplies permissions, loads fresh records and uses current shared recommendations. Clearly distinguish historical answers from the latest snapshot.

Keep history until the user clears it or the associated account/cohort is deleted; automatic expiration is not part of this release. Store transcripts only in Supabase, not localStorage, analytics events or application logs. Continue the existing disclosure that selected history and permitted records are sent to OpenRouter; provider retention is governed separately.

Normal leads have no transcript access. Authorized database administrators retain administrative access; “private” means application access is owner-only, not end-to-end encryption.

## 9. Changes expected during implementation
- Versioned migration: conversation/turn tables, indexes, RLS, append/load/clear functions.
- frontend/src/Assistant.tsx: loading, restoration, save status, retry-save, pagination and confirmed clearing.
- Focused frontend history helper: typed calls and scope-safe state handling.
- backend/assistant/handler.cjs: authenticated history reads, bounded provider history, append and explicit save result.
- backend/assistant/history.cjs and api/assistant/history.js: authenticated history load, retry-save and clear; reuse existing backend authentication patterns.
- backend/assistant/dev.cjs: route local history requests to the same handler used by Vercel.
- frontend/src/App.tsx: pass or reset authenticated identity consistently.
- docs/ai/assistant-framework.md, UI disclosure and relevant README sections: replace memory-only claims.
- Existing provider model, Calendar, submissions, dashboards and shared ranking behavior remain unchanged.

No new provider key or dependency is expected. Applying the migration and deploying matching frontend/backend code must be coordinated; code must show a recoverable history-unavailable message if the migration is missing.

## 10. Acceptance checks
| Case | Required result |
| --- | --- |
| Leave Assistant, return, refresh or restart browser | Saved turns restored in order |
| Sign out/in or use another device with same account | Same conversation restored |
| Different user, role or cohort | No history leakage |
| Lead requests intern transcript directly | Database denies access |
| Two tabs append concurrently | No overwrite or duplicate turns; conflict is visible |
| Repeat save after lost response | Existing request_id reused; no duplicate or new provider call |
| Clear during an in-flight answer | Old answer cannot restore cleared history |
| History load/save/clear fails | Accurate error, retained visible content, safe retry |
| Task deadline changes between sessions | Old answer stays historical; new advice uses updated records |
| Large transcript | Cursor paging; model history remains bounded |
| Submitted/completed work or blocked milestone | Shared priority rules still apply |
| Direct forged identity, timestamps or transcript role | Rejected or treated as untrusted text, never authority |

Run database permission/transaction tests, frontend interaction tests, API tests, the complete suite and production build. Then verify a dedicated intern and lead account on the intended deployed environment, including a genuine second login. Mock tests alone do not establish cross-device or live-model behavior.

## 11. Review decision
Approve or revise this design before implementation planning. The main product decisions are: one conversation per user/role/cohort; owner-only history; retention until cleared; confirmed permanent clearing of active history; and no multiple-chat sidebar for this release.

The next step after design approval is a concrete implementation plan and its review. This document does not implement tables, alter live data, merge code or deploy the app.
