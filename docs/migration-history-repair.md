# Migration-history repair — October 20, 2026

Target: EIF Compass, Supabase project `qshunuggruortqaeusxf` (Primary connection).

The hosted database contained calendar/submission and assistant-history objects without corresponding rows in `supabase_migrations.schema_migrations`. Five repository filenames differed from recorded versions; three shared the short `20261005` prefix. The database also contained an applied AI Knowledge migration absent from the repository.

## Repository reconciliation

| Previous filename | Canonical filename from hosted history |
| --- | --- |
| `20261005_lead_workflows.sql` | `20261005135713_lead_workflows.sql` |
| `20261005_restrict_helpers.sql` | `20261005140451_restrict_profile_helper_execution.sql` |
| `20261005_lead_removal.sql` | `20261005152647_lead_removal.sql` |
| `20261013150014_week2_data_permissions.sql` | `20261013152305_week2_data_permissions.sql` |
| `20261013170000_intern_workflows.sql` | `20261013155455_intern_workflows.sql` |

Existing migration bodies were preserved. `20261005170257_ai_knowledge.sql` was restored from the hosted ledger's original SQL; this preserves historical database behavior and does not add AI Knowledge to the app UI.

## Existing changes recorded as applied

- `20261011060705_calendar_submission_bin.sql`
- `20261020115000_assistant_history.sql`
- `20261020121308_capture_existing_google_rls.sql`

The third file captures RLS already enabled on `eif_private.google_connections`, `google_states` and `google_sync`. It reproduces that existing protection on fresh databases.

The metadata-only operation is archived at `backend/supabase/operations/2026-10-20-repair-history.sql`, outside the automatic migration directory. It stores those migration sources as text in the ledger; it does not execute their DDL. It locks the ledger, verifies the original seven records and the application catalog fingerprint, rejects conflicting existing versions, and commits all three records together. If verification fails, stop and compare again. Do not bypass its fingerprints against another database. Repeating it is safe only while those verification conditions still match.

## Verification and limits

A fresh isolated PostgreSQL replay applies the base schema followed by all ten uniquely versioned migrations. Its application columns, nullability, defaults, constraints, indexes, policies, triggers, function definitions and RLS match the hosted catalogs after normalizing SQL formatting and the PostgreSQL 17/18 representation of NOT NULL constraints. Raw ACLs differ because Supabase provides platform defaults; they are not treated as interchangeable with the local test roles. The repair fingerprints the hosted schema including raw table/function ACLs and checks that it remains unchanged afterward. The private submission bucket's size, MIME types and visibility were also checked.

The repair tests cover repeat execution, conflicting versions, a changed original ledger and a changed schema. These are metadata and replay checks, not a live application or cross-device smoke test. No fellowship records, auth accounts, files, OAuth credentials or conversation content need to be read or changed for this repair.

`schema.sql` remains the documented initial bootstrap rather than a tracked migration. New databases must apply it before the ten upgrades; this repair does not claim that the migration directory alone bootstraps an empty Supabase project.

Going forward, create a uniquely versioned migration with the Supabase CLI, commit it, and deploy through migration tooling. Review SQL applied manually and reconcile history before using `db push`. Do not reset the hosted database to resolve history differences.

## Completion evidence

The metadata repair was executed and verified on October 20, 2026. The live ledger contains all ten repository versions. The application catalog fingerprint before and after is identical: `2c1e63f9cf19a9b639c695799272b32f`. The full `npm test` suite passed; the replay/repair test additionally passed changed-history and changed-schema rejection checks. Independent review found no blocking issues. The corrected filenames and restored migrations require merging the repository repair PR; no application deployment is needed for the metadata repair itself.
