# EIF Compass assistant framework

## Outcome and scope

Interns receive personal daily plans, requirement explanations, and check-in preparation. Leads receive cohort briefings, review summaries, and communication or event drafts. The initial assistant is read-only. Google Calendar and Gmail execution require a separate OAuth integration and an explicit reviewed action; this version only drafts text.

## Request flow

1. The React assistant obtains the current Supabase access token and sends the question, request UUID, and expected conversation identity/version to `/api/assistant`.
2. The server validates the token using Supabase Auth and reads the user's role/cohort from their profile. Browser role, cohort, and context fields are ignored.
3. Queries use the user's bearer token and publishable key, retaining RLS. Intern context is additionally filtered to own/shared tasks and requirements, own submissions, cohort events, and own profile. Leads receive permitted cohort records. No service-role key is used.
4. The context module computes deadline counts and priority order in Philippine time. It bounds record counts and text length; truncated snapshots are explicitly labeled partial.
5. The prompt module supplies role-specific instructions, the data snapshot, last six messages loaded from saved history (1,000 characters each), and question to OpenRouter. Record instructions are treated as untrusted text. Generated content remains advice, never authority to perform an action.
6. The frontend renders plain text and server-derived record-list navigation. The source list describes available context, not a claim that each listed record was cited by the model. Completed question/answer pairs are saved atomically in Supabase and restored on return. Older messages page in groups of 20; sources are resolved again under current RLS.

## Modules

- `api/assistant.js`: Vercel adapter.
- `backend/assistant/handler.cjs`: validation, authentication, orchestration, limits, and provider error handling.
- `backend/assistant/context.cjs`: permitted snapshot and deterministic counts/priorities.
- `backend/assistant/prompts.cjs`: shared boundaries and lead/intern prompts.
- `frontend/src/Assistant.tsx`: role starters, conversation, sources, paged restoration, confirmed clear, and save-only retry states.

## Configuration and local use

Copy root `.env.example` to root `.env.local` and fill `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (an exact available model ID), `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY`. The key/model are required; there is no automatic paid-model selection. Keep the existing frontend `.env.local` with its public `VITE_SUPABASE_*` variables for sign-in.

Run `npm run dev:api` in one terminal and `npm run dev` in another. Vite proxies `/api` to the local backend at port 3001. Node 22.9+ is required for the local environment-file command. The API can also read existing public `VITE_SUPABASE_*` values, but never put the OpenRouter key under a `VITE_` name.

On Vercel, add the four server variables in project Environment Variables and redeploy. A local `.env.local` does not configure Vercel. Use the repository root as the Vercel root directory, preserving the existing root build configuration. Missing configuration produces a recoverable setup message rather than fake answers.

## Bounds and deployment considerations

The snapshot includes at most 40 tasks, 40 requirements, 40 member profiles, 20 upcoming events, and 160 submission statuses. Queries prioritize earliest deadlines; all derived counts explicitly become partial when any bound is reached. This is not a replacement for full dashboard metrics. Emails, submission URLs, and auth credentials are excluded from model context. Relevant task/requirement text and member names are sent to the chosen OpenRouter provider; the UI discloses this. Conversations are persisted privately in Supabase per account, role and cohort until Clear conversation or account/cohort deletion. Cohort leads cannot read intern transcripts. Authorized database administrators can access database contents. Application code does not log chat text or store it in browser storage. Provider retention follows the configured OpenRouter/provider policies.

Maximum question length: 2,000 characters. Maximum history: six messages of 1,000 characters each. Provider output: 1,200 tokens. Database fetch timeout: eight seconds per request. Provider timeout: 25 seconds. Per-user protection is six attempts/minute and one in-flight request **per server instance**; it is not a distributed quota. Configure an OpenRouter key spending limit before exposing this to a larger cohort. A durable quota or platform rate limit is the next production hardening step. Stopping a browser response does not guarantee cancellation of provider processing or billing.

## Validation and next steps

Run `npm test` and `npm run build`. Tests exercise backend authentication, role and context isolation, summary calculations, validation, missing configuration, provider failures, UI starters, plain-text rendering, source navigation, and retry/reset. Provider tests use fixtures; real model quality and live credentials need an authenticated smoke test after configuration.

Next: tune prompts against real approved examples, add durable usage quotas, then implement Google OAuth and a separate structured draft/approval/execution pipeline with event/message IDs and idempotency. No Google credentials or integrations are required for this release.

Official references: [OpenRouter quickstart](https://openrouter.ai/docs/quickstart), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

### Empty model responses

Requests disable optional reasoning while retaining the 1,200-token cap. Models with mandatory reasoning may still exhaust that allowance before returning visible text. The handler accepts plain text and text-content blocks, never substitutes private reasoning for an answer, and distinguishes token exhaustion from content filtering. On repeated failures, inspect the corresponding OpenRouter Activity entry or select a fixed model without mandatory reasoning. No automatic retry or paid fallback is performed.

## Persistent history rollout

Apply `backend/supabase/migrations/20261020115000_assistant_history.sql` to the intended Supabase environment before deploying this code. Review the target project first; this change does not apply the migration automatically. The migration is additive and creates private conversation/turn tables, SELECT-only RLS, and constrained caller-JWT RPCs. Deploy `/api/assistant` and `/api/assistant/history` together with the frontend. A missing migration blocks new questions with a recoverable history error rather than silently falling back to memory-only chat.

`GET /api/assistant/history` restores the latest 20 complete turns; `before` + `generation` page earlier turns. POST retries saving the existing question/answer without calling OpenRouter; DELETE requires confirmation in the UI and compares conversation ID, generation and revision. Database row locking serializes mutations; clear increments generation so old pending responses cannot restore cleared content. Concurrent revision changes require reloading before an explicit retry. An unsaved answer stays visible during reload and can be discarded separately without deleting saved history.

After migration and deployment, smoke-test with an intern and lead account: ask → leave/sign out → sign back in → verify restoration; open another browser/device; page a transcript exceeding 20 pairs; clear with cancellation and confirmation; verify another user's transcript is inaccessible. Also simulate a save failure, a second-tab revision change and a second-tab clear during generation. Automated tests use isolated PostgreSQL and mocked provider/browser boundaries; they do not establish live environment readiness. Previously lost memory-only sessions cannot be recovered. Rolling code back leaves additive tables intact; avoid dropping transcripts during rollback.

## PRD priority completion on October 20

The assistant system policy explicitly prohibits grades, intern rankings or scores, penalties, and pass/fail decisions. Obvious people-evaluation requests receive a server-generated refusal without a provider call. This bounded classifier supplements the prompt and is not a complete safety guarantee. Task/deadline prioritization is permitted.

The browser sends `stream: true`. After authentication and fresh context reads, OpenRouter SSE answer deltas are forwarded as newline-delimited `{type: "delta", text}` frames. The terminal `{type: "complete", result}` contains the complete answer and durable-save outcome. `{type: "error", error}` terminates an incomplete stream. The frontend keeps partial text visibly incomplete and offers discard, never save-only retry for a partial answer. Existing JSON requests remain compatible. Interrupted, filtered, token-limited or oversize output is not saved; hidden reasoning is never forwarded. Reload history after a lost completion response before asking again. Clear and scope/version checks still protect the append transaction.

Requirement context includes per-user derived statuses using the same 24-hour Upcoming/Pending boundary as the tracker and dashboard. Draft and requested-change details remain separate. See `docs/prd-status-2026-10-20.md` for scope and release limits.
