# EIF Compass assistant framework

## Outcome and scope

Interns receive personal daily plans, requirement explanations, and check-in preparation. Leads receive cohort briefings, review summaries, and communication or event drafts. The initial assistant is read-only. Google Calendar and Gmail execution require a separate OAuth integration and an explicit reviewed action; this version only drafts text.

## Request flow

1. The React assistant obtains the current Supabase access token and sends the question plus at most six short history messages to `/api/assistant`.
2. The server validates the token using Supabase Auth and reads the user's role/cohort from their profile. Browser role, cohort, and context fields are ignored.
3. Queries use the user's bearer token and publishable key, retaining RLS. Intern context is additionally filtered to own/shared tasks and requirements, own submissions, cohort events, and own profile. Leads receive permitted cohort records. No service-role key is used.
4. The context module computes deadline counts and priority order in Philippine time. It bounds record counts and text length; truncated snapshots are explicitly labeled partial.
5. The prompt module supplies role-specific instructions, the data snapshot, history, and question to OpenRouter. Record instructions are treated as untrusted text. Generated content remains advice, never authority to perform an action.
6. The frontend renders plain text and server-derived record-list navigation. The source list describes available context, not a claim that each listed record was cited by the model. Refreshing/navigating away clears the memory-only conversation.

## Modules

- `api/assistant.js`: Vercel adapter.
- `backend/assistant/handler.cjs`: validation, authentication, orchestration, limits, and provider error handling.
- `backend/assistant/context.cjs`: permitted snapshot and deterministic counts/priorities.
- `backend/assistant/prompts.cjs`: shared boundaries and lead/intern prompts.
- `frontend/src/Assistant.tsx`: role starters, conversation, sources, stop/reset, and retry states.

## Configuration and local use

Copy root `.env.example` to root `.env.local` and fill `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (an exact available model ID), `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY`. The key/model are required; there is no automatic paid-model selection. Keep the existing frontend `.env.local` with its public `VITE_SUPABASE_*` variables for sign-in.

Run `npm run dev:api` in one terminal and `npm run dev` in another. Vite proxies `/api` to the local backend at port 3001. Node 22.9+ is required for the local environment-file command. The API can also read existing public `VITE_SUPABASE_*` values, but never put the OpenRouter key under a `VITE_` name.

On Vercel, add the four server variables in project Environment Variables and redeploy. A local `.env.local` does not configure Vercel. Use the repository root as the Vercel root directory, preserving the existing root build configuration. Missing configuration produces a recoverable setup message rather than fake answers.

## Bounds and deployment considerations

The snapshot includes at most 40 tasks, 40 requirements, 40 member profiles, 20 upcoming events, and 160 submission statuses. Queries prioritize earliest deadlines; all derived counts explicitly become partial when any bound is reached. This is not a replacement for full dashboard metrics. Emails, submission URLs, and auth credentials are excluded from model context. Relevant task/requirement text and member names are sent to the chosen OpenRouter provider; the UI discloses this. No prompts or conversations are persisted or logged by application code.

Maximum question length: 2,000 characters. Maximum history: six messages of 1,000 characters each. Provider output: 1,200 tokens. Database fetch timeout: eight seconds per request. Provider timeout: 25 seconds. Per-user protection is six attempts/minute and one in-flight request **per server instance**; it is not a distributed quota. Configure an OpenRouter key spending limit before exposing this to a larger cohort. A durable quota or platform rate limit is the next production hardening step. Stopping a browser response does not guarantee cancellation of provider processing or billing.

## Validation and next steps

Run `npm test` and `npm run build`. Tests exercise backend authentication, role and context isolation, summary calculations, validation, missing configuration, provider failures, UI starters, plain-text rendering, source navigation, and retry/reset. Provider tests use fixtures; real model quality and live credentials need an authenticated smoke test after configuration.

Next: tune prompts against real approved examples, add durable usage quotas, then implement Google OAuth and a separate structured draft/approval/execution pipeline with event/message IDs and idempotency. No Google credentials or integrations are required for this release.

Official references: [OpenRouter quickstart](https://openrouter.ai/docs/quickstart), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
