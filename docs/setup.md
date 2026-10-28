# EIF Compass setup

## Local development

```bash
npm ci
cp frontend/.env.example frontend/.env.local
npm run dev
```

The app opens on a dedicated email/password login page. The dashboard is mounted only after session restoration or successful sign-in. Signed-out visitors cannot open the dashboard or switch demo roles. Sign-out returns to the login page. Without Supabase configuration, sign-in stays unavailable; the dashboard does not fall back to a public demo.

Root `npm ci` installs frontend dependencies through the `postinstall` script. You can also run `npm ci` and the frontend scripts directly inside `frontend/`.

Fill in `frontend/.env.local` to use live accounts:

```env
VITE_SUPABASE_URL=<your-project-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

The client also accepts `VITE_SUPABASE_ANON_KEY` for compatibility. Use the publishable-key variable for new configuration. Get the values from your Supabase project; this repository intentionally contains no project-specific values.

## Supabase setup

1. Run [backend/supabase/schema.sql](../backend/supabase/schema.sql) in your project's SQL Editor. It creates the tables, profile trigger, access policies, and sample cohort requirements/events.
2. Create a test account under **Authentication → Users** after installing the schema. New users receive an `intern` profile and the first cohort.
3. If a user existed before the schema was installed, add their profile using their Auth user ID and the appropriate cohort ID.
4. In **Table Editor → profiles**, set `role` to `intern` or `lead`, and assign `cohort_id` and an optional `team_name`. Sign out and back in after changing roles.
5. Add a task in `public.tasks`, using the user's profile ID as `assignee_id` and the matching `cohort_id`.
6. Use the login page to sign in with the fellowship account.

Cohort IDs remain UUIDs. A human-readable label belongs in the cohort's `name`; keep related IDs consistent.

Authenticated accounts load records allowed by the database policies. Interns can update the status of their assigned tasks. Leads can read cohort records. The login gate controls dashboard visibility; database RLS remains the authorization boundary. Browser code and bundled sample content remain downloadable in this client-rendered app. Signed-in query failures are reported instead of retaining sample records, and task completion checks whether a record was actually updated.

## Vercel deployment

1. Merge the changes into the branch configured for deployment. Keep the Vercel **Root Directory** at the repository root (`.`). The committed `vercel.json` installs through the root package, runs `npm run build`, and publishes `frontend/dist`.
2. Open the Vercel project's **Settings → Environment Variables**.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the intended Production and Preview environments.
4. Redeploy a build containing the integration changes. Vite reads these variables at build time.
5. Open the deployment, sign in, and complete the [verification checklist](check-in-1.md#verification-checklist).

Vercel Connect OAuth credentials are not required for this client integration.

## Developer collaboration

Invite collaborators through the Supabase organization's **Settings → Team** using their own accounts. A Developer role is suitable for database work; broader settings changes require suitable additional permissions. Dashboard membership is separate from an EIF Compass account used to test intern/lead behavior.

Keep passwords, user emails, secret/service-role keys, database connection strings, and private account IDs out of commits, screenshots, issues, and PR descriptions. Configure local values in ignored `frontend/.env.local` files and hosted values in Vercel. Publishable keys are browser-facing, but example files use placeholders for portability. Never put privileged keys in a `VITE_` variable.

## Build and validation

```bash
npm run build
npm run preview
```

Prior implementation checks passed the component/API tests, TypeScript check, Vite production build, and live Supabase workflow/permission regression suite. Database fixtures were rolled back. These results do not establish a successful deployed browser walkthrough or real-model accuracy test. Run `npm test` and `npm run build` for the checked-out revision; see the SQL tests under `backend/supabase/tests/`.

## Node version

Frontend tests need Node 24.19 or newer (jsdom 30). The repository's `.nvmrc` pins Node 24 and CI uses it.

## Database migrations

Run `npm run check:migrations` before applying anything. It validates the local `backend/supabase/migrations/` folder (timestamp filenames, no duplicates, strictly increasing order). To compare against the hosted database, run the query in `backend/supabase/operations/ledger-query.sql` in the Supabase SQL Editor, save the version column to a text file, and run `npm run check:migrations -- --ledger path/to/ledger.txt`. The script lists migrations missing from the hosted ledger and hosted versions with no local file.

For an existing database, apply only migrations that are genuinely missing, in timestamp order. For a fresh project, run `backend/supabase/schema.sql` first, then every migration in timestamp order. Never rerun the base schema on an upgraded project: its original grants and policies predate the later workflows. See [migration-history-repair.md](migration-history-repair.md) for the October 20 reconciliation and the verified SQL that must not be rerun.

## What is committed, and what is not

- Seed data uses generic cohort, task and event records. The synthetic demo seed uses the reserved `example.invalid` domain, and the frontend bundle contains no sample records. Do not run the local-only synthetic Auth seed on the hosted database.
- Editor and test-tool output stays out of Git. `.playwright-mcp/`, `.superpowers/`, `.test-output/` and env files are ignored. `.impeccable/design.json` is the exported design-token file behind `DESIGN.md` and is committed on purpose.
- Keep passwords, user emails, secret or service-role keys, connection strings and private account IDs out of commits, screenshots, issues and PR descriptions.
