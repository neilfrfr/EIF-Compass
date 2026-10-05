# EIF Compass

EIF Compass is a fellowship tracking and support workspace for EIF interns and leads. This Check-in 1 build focuses on the foundation: a polished intern dashboard, task and requirement views, a cohort lead view, Supabase Auth, and Supabase-backed records with row-level security.

## Run the demo

The app opens with sample cohort data, so the screens can be presented before real accounts and records are ready.

```bash
npm install
npm run dev
```

Choose **Fellow** or **Lead** in the top-right role preview to switch between the two demo experiences. In demo mode, task completion is kept in local page state only.

## Connect Supabase

1. Copy `.env.example` to `.env.local` and add the project's Supabase URL and anon key.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor.
3. Create test users in Supabase Auth. The profile trigger creates each new account as an intern and assigns the first cohort.
4. To designate a lead or assign a fellow to a team, update that user's `profiles` row in the Supabase dashboard. Do not expose the service-role key in the browser.
5. Add tasks in `public.tasks` and assign them to a profile. The seeded shared requirements and events are visible to members of the cohort.
6. Use **Connect account** in the sidebar to sign in with an existing Supabase email/password account.

Authenticated users load tasks and requirements from Supabase. Fellows only read records allowed by RLS and can update the `status` column on their own tasks. Leads can read profiles and records in their cohort. This first slice keeps requirement updates read-only; a later milestone can add submission links and lead review actions.

## Stack

- React 19, TypeScript, Vite, Tailwind CSS 4, and custom CSS for the branded dashboard.
- Supabase Auth and PostgreSQL with row-level security.
- Supabase JavaScript client for the current Check-in 1 read path; the FastAPI service and OpenRouter assistant remain later integration work.

## Build

```bash
npm run build
npm run preview
```

## Check-in 1 demo path

1. Start on the Fellow overview and show the next-best-action card, progress, active tasks, requirements, and upcoming events.
2. Open Requirements and filter by status.
3. Mark a demo task complete to show the interaction.
4. Switch to Lead and show the cohort pulse, team progress, and follow-up prompt. The lead dashboard's cohort summary uses clearly labeled sample data until lead analytics are wired to Supabase queries.

The seeded names and sample progress are for demonstration and are not real intern records.
