# Migration History Repair Implementation Plan

> Execute inline using the existing isolated checkout. The user authorized repair.

**Goal:** Align migration filenames and the live migration ledger without rerunning application DDL or modifying fellowship data.
**Architecture:** Recover applied SQL from the live ledger, compare a clean replay with live catalogs, then repair only verified missing ledger records transactionally. Preserve the original ledger entries and existing database objects.
**Tech Stack:** Supabase Management SQL, PostgreSQL catalogs, isolated PGlite, GitHub.
**Spec:** User request: repair the migration-history drift reported on 2026-10-20.

## Global Constraints
- Target only EIF Compass project qshunuggruortqaeusxf on Primary.
- Do not rerun already applied migrations or delete application records.
- Preserve applied AI Knowledge history without adding product functionality.

## Review Focus
- Filename version uniqueness and chronological dependency order.
- Recover historical SQL exactly rather than reconstructing it from current objects.
- Compare untracked calendar and assistant migrations against live definitions before recording them.
- Keep all test and setup references consistent after renames.
- Verify final ledger versions match repository files and application schemas stay unchanged.

## Tasks
- [x] Recover ledger and SQL; rename the five mismatched files and restore AI Knowledge migration.
- [x] Replay migrations in an isolated database; compare relevant tables, functions, policies, constraints, triggers and privileges against live catalogs.
- [x] Record only verified missing calendar/history versions in the live ledger, with conflict guards and a transaction.
- [x] Run repository tests and catalog/ledger checks; publish repair PR and report any remaining schema differences.

Verified live ledger: ten versions match the repository. Application catalog fingerprint before/after: `2c1e63f9cf19a9b639c695799272b32f`. Full npm test and additional changed-ledger/schema guard checks passed. Independent review found no blocking issues.
