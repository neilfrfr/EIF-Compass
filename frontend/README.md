# EIF Compass frontend

React/TypeScript/Vite application for fellowship interns and leads. This folder owns the UI, login gate, styles, browser Supabase client, dependency lockfile, and build configuration.

## Run locally

From this folder:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Hosted values belong in Vercel Environment Variables. Do not put privileged keys in `VITE_` variables.

The repository root also supports `npm ci`, `npm run dev`, `npm run build`, and `npm run preview`. Its install script installs this folder's dependencies.

## Build

```bash
npm run build
npm run preview
```

Output is `frontend/dist` relative to the repository root. The production Vercel project should use the repository root and its committed `vercel.json`.

## Backend boundary

`src/lib/supabase.ts` is a browser client and belongs here. It calls Supabase Auth and the Data API; database schema and policies are in [../backend/supabase/schema.sql](../backend/supabase/schema.sql). The login gate controls UI visibility and database RLS controls access to records.

AI suggestions and lead summary metrics still include static/sample content. See [the handoff](../docs/check-in-1.md).
