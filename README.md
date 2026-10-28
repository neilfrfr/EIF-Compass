# EIF Compass

EIF Compass gives Eskwelabs Innovation Fellowship interns one workspace for tasks, requirements and upcoming events, with a cohort view for fellowship leads. Production: [eif-compass.vercel.app](https://eif-compass.vercel.app).

## Repository structure

| Path | Responsibility |
|---|---|
| `frontend/` | React, TypeScript and Vite UI, login gate, browser Supabase client |
| `api/` | Vercel serverless entry points (assistant, Google Calendar, submissions) |
| `backend/` | Server handlers, Supabase schema, migrations, RLS policies, seed data and tests |
| `shared/` | Workflow rules used by both frontend and backend |
| `docs/` | PRD, status, setup, features, verification checklist and design notes |
| `scripts/` | Repository tooling (migration check) |
| `.impeccable/` | Exported design tokens behind `DESIGN.md` |

The backend uses Supabase RLS for authorization and Vercel serverless functions for the OpenRouter assistant, Google Calendar sync and submission cleanup. There is no separate FastAPI or Render service.

## Quick start

```
nvm use            # Node 24
npm ci
cp frontend/.env.example frontend/.env.local
npm run dev
```

Fill in `frontend/.env.local` with your Supabase project URL and publishable key. Server-only variables (OpenRouter, Google, Supabase secret key) go in the root `.env.local`; see `.env.example`.

| Command | What it does |
|---|---|
| `npm run dev` | Frontend dev server |
| `npm run dev:api` | Local assistant API (run alongside `dev`) |
| `npm test` | Backend and frontend test suites |
| `npm run build` | TypeScript check and production build |
| `npm run check:migrations` | Validate the migration folder, optionally against the hosted ledger |

## Documentation

- [Product requirements (PRD)](docs/prd.md)
- [Implementation status](docs/status.md) and [verification checklist](docs/verification-checklist.md)
- [Setup: Supabase, Vercel, migrations](docs/setup.md)
- [Features: workflows, dashboards, assistant, Google Calendar](docs/features.md)
- [Design system](DESIGN.md) and [product brief](PRODUCT.md)
