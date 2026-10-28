# Verification checklist

Everything below was **not** verified as of the Sprint 2 close-out unless marked done. Record the date, tester and result next to each item as it is completed. Do not report an item as passed in the PRD, README or demo until it is checked here.

Last updated: October 28, 2026.

## Automated (run on every pull request by CI)

- [x] `npm test` passes (backend, migrated-PostgreSQL permission tests, frontend component tests). Passed on Node 24.22.1 on October 28, 2026.
- [x] `npm run build` passes. Passed on October 28, 2026.
- [x] `npm run check:migrations` passes against the local folder.

## Deployed environment (pending)

- [x] **Intern walkthrough on the deployed site (October 21, commit `c20926e`).** The demo rehearsal record says the live intern journey showed the expected recommendation, milestone, completion, feedback, blocker response, notifications and agenda, and the AI explanation persisted after reloading history. Not repeated on current `dev`, which is 37 commits ahead (redesign PR #24, PR #25).
- [ ] **Lead walkthrough on the deployed site.** The rehearsal record says the lead dashboard was not verified live. Check cohort dashboard, review queue, blocker response, feedback, and task create, edit and remove.
- [ ] **Repeat the intern walkthrough on the current deployment** (after the redesign).
- [ ] **Migration ledger.** Run `backend/supabase/operations/ledger-query.sql` on the hosted project, then `npm run check:migrations -- --ledger ledger.txt`. Expect "Ledger and folder match."
- [ ] **Vercel Preview and Production environment variables.** Confirm `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the Google variables are set for the intended environments, with no `VITE_` prefix on server-only keys.
- [ ] **Supabase Storage.** Upload, replace, download and remove a private requirement attachment as an intern and as a lead. Confirm an intern cannot read another intern's file.
- [ ] **Google Calendar.** Complete real OAuth consent with the production redirect URI, sync one selected event, disconnect, and confirm tokens are removed.

## Acceptance gates from the PRD (pending, not yet measured)

- [ ] **AI accuracy.** 20 prepared questions on a real model: at least 90% accurate and zero evaluative outputs (no grading, ranking, scoring, penalties or pass/fail).
- [ ] **Usability.** 3-5 users: at least 80% identify their next priority within 30 seconds.
- [ ] **Performance.** Dashboard loads in under 3 seconds on the deployed site.
- [ ] **Accessibility and mobile.** Keyboard-only pass and a phone-width pass of the core workflows.
- [ ] **Demo data.** Curated cohort (about 20 interns, 5 teams, 2 sprints) loaded as demo records, not through the local-only synthetic Auth seed.

## Repository hygiene (done in this close-out)

- [x] `.playwright-mcp/` removed from Git tracking (it was committed before being ignored; it contained a hosted Supabase project URL in console logs, no keys or tokens).
- [x] Git history scanned for private keys and tokens: none found. Test files use placeholder values only.
- [x] Seed data and frontend bundle contain no real names or emails (`example.invalid` is used for the demo lead).
- [ ] Decide whether the repository stays public (see `docs/status.md`, Known limitations).
