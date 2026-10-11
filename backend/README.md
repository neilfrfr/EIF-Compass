# EIF Compass backend

Supabase provides PostgreSQL, Authentication and private Storage. Vercel functions provide the OpenRouter assistant, Google OAuth/Calendar sync and authorized requirement attachment cleanup. There is no FastAPI/Render service.

For a fresh database, install `supabase/schema.sql`, then the existing lead workflow/removal/helper migrations in order. Existing projects must apply only missing migrations. The new `supabase/migrations/20261011060705_calendar_submission_bin.sql` preserves existing links and adds drafts, file metadata, deadline guards, private Storage policies and restricted encrypted credential storage. No live migration is applied by committing these files.

Backend secrets belong in ignored root `.env.local` or environment-scoped Vercel variables. Never prefix privileged credentials with `VITE_`. Run `npm run dev:api` alongside `npm run dev`; production functions live under root `api/`.

`npm test` covers assistant authorization, OAuth/state/encryption, Calendar retry behavior, attachment cleanup and migrated PostgreSQL role/permission/state checks. PGlite uses auth/storage test schemas; a live Storage and Google walkthrough is still required. See [integration setup and verification](../docs/google-calendar-setup.md) and [assistant setup](../docs/ai/assistant-framework.md).
