# Google Calendar and submission bin setup

Status: Implemented on the feature branch; automated tests and production build pass. Live Google consent and Supabase Storage testing remain required before merge. No production migration was applied.

## Preview configuration

Use a separate Supabase test project or branch for Preview. Preview credentials pointing to production also point uploads and deletions to production data.

1. Apply the existing migrations in order if missing: `20261005_lead_workflows.sql`, `20261005_lead_removal.sql`, `20261005_restrict_helpers.sql`. Do not reapply completed migrations or the base schema.
2. Apply `backend/supabase/migrations/20261011060705_calendar_submission_bin.sql` once to the test database. It preserves existing submission links, creates private file storage and adds encrypted Google connection storage. For a fresh project, install `backend/supabase/schema.sql` first.
3. In Google Cloud, enable **Google Calendar API**, configure a Web OAuth client and add testing lead/intern accounts to the consent audience.
4. Choose a stable Preview branch URL. Register exactly `https://<preview-host>/api/google/callback` as an authorized redirect URI. Use the same origin when opening the app; an immutable deployment URL with a different host will fail the Origin check.
5. Set the following Vercel **Preview** variables, preferably scoped to this feature branch. Redeploy after changing variables.

| Variable | Value / purpose |
| --- | --- |
| `APP_URL` | Trusted Preview origin, without trailing slash |
| `GOOGLE_REDIRECT_URI` | `APP_URL` followed by `/api/google/callback` |
| `GOOGLE_CLIENT_ID` | Web OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret; server only |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | 32 random bytes encoded as base64; server only |
| `SUPABASE_URL` | Test project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Test publishable key |
| `SUPABASE_SECRET_KEY` | Test backend secret key; legacy `SUPABASE_SERVICE_ROLE_KEY` is accepted instead |
| `VITE_SUPABASE_URL` | Same test project URL for browser queries |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Test publishable key for browser queries |

Retain the existing OpenRouter variables. No provider model change is needed for these controls. Never put secret keys in `VITE_` variables, commits, PRs or chat. Changing the encryption key makes existing encrypted credentials unreadable; reconnect accounts after a deliberate rotation.

## Local development

Copy root `.env.example` to ignored `.env.local` and frontend `.env.example` to `frontend/.env.local`; fill in local/test values. Use `APP_URL=http://localhost:5173` and `GOOGLE_REDIRECT_URI=http://localhost:5173/api/google/callback`, registered exactly in Google Cloud. Run `npm run dev:api` and `npm run dev` in separate terminals. Vite proxies `/api` to the local backend. The callback uses a Secure HttpOnly cookie; use localhost or HTTPS for local OAuth.

## Required pre-merge walkthrough

Use two interns and a lead with persisted profiles in the test cohort.

- Save a legacy/Google link, note and PDF as an intern draft. Refresh and confirm persistence. Share Google links with the reviewing lead separately.
- Submit, verify content/file removal is locked, then unsubmit before cutoff, edit and resubmit. Lead approval locks it; Request changes permits edits only before cutoff.
- Test exact cutoff and end-of-date cutoff in Philippine time. Intern edits, uploads, removal and unsubmit must fail at/after cutoff, including direct API attempts. Lead extension must display and enforce the new cutoff.
- Confirm a lead can download/review submitted work while another intern and anonymous visitor cannot access its files. Try six files, >10 MiB, mismatched types and a failed upload.
- Remove a requirement with both uploaded and pending attachments as the lead. Verify objects and submissions are gone. Interrupt cleanup and retry; other cohorts/interns must be denied.
- Connect each user's own Google account from **Calendar**. Test consent denial, reconnect, revoked access and callback replay.
- Select events/deadlines, choose **Review selected**, then **Confirm sync**. Verify all-day dates, Philippine times, visible default durations and per-item results. Review alone must write nothing.
- Sync twice: no duplicate entries. Change a source and sync again: update its existing entry. Delete a Google copy and explicitly resync: restore one entry. Disconnect: credentials removed and existing entries remain.

The automated suite uses PGlite PostgreSQL with auth/storage test schemas, React interactions and mocked Google HTTP/OAuth. It does not verify the real Storage service, cross-instance concurrency or actual Google consent. Vercel environment settings were inaccessible to the implementation session (403), so configured Preview values were not verified.

## Boundaries and rollback

Calendar sync writes only to the connected user's primary calendar. It sends no invitations. Gmail sending, Drive Picker and assistant chat execution are deferred. Google Workspace links are supported; link submission does not change sharing permissions. Deleted fellowship sources leave Google copies in place; automatic calendar deletion and a stale-copy management screen are deferred.

The private bucket accepts up to five PDF/Office/text/PNG/JPEG files per submission, 10 MiB each. Extension, declared MIME and Storage metadata are checked; malware scanning is not provided. The app requests 60-second signed downloads; this is not a server-enforced maximum for an otherwise authorized Storage client.

If Preview verification fails, retain the draft PR and fix it there. Revert the Preview deployment to its prior commit; keep additive database columns and private data until a cleanup/migration is reviewed. Do not drop submission or credential tables to revert a UI deployment. Removing stored files must use the Storage API, not SQL metadata deletion.

After successful testing and merge approval, configure the production origin/redirect and production secrets separately and apply the reviewed migration once. Keep test credentials scoped to Preview.
