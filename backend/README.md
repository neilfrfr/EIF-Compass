# EIF Compass backend

The current backend is managed by Supabase: PostgreSQL, Authentication, and the Data API. This folder contains the project's backend database definitions; there is no separately running API server yet.

## Database setup

Run [supabase/schema.sql](supabase/schema.sql) in the project's Supabase SQL Editor. It defines cohorts, profiles, tasks, requirements, events, indexes, the new-user profile trigger, RLS policies, and sample seed records.

This reorganization moves the SQL file without changing its contents. It does not apply SQL to a live project. An already configured project does not need the schema reapplied solely because the file moved.

Create test users after installing the profile trigger. Set their roles and cohort assignments in `profiles`. Existing accounts created before the trigger need a profile row.

## Security and testing

Keep database passwords, secret/service-role keys, and private user information out of source control. Browser configuration belongs in `frontend/.env.local` or the Vercel project's environment settings.

Use the [verification checklist](../docs/check-in-1.md#verification-checklist) to test intern/lead access, task persistence, and cohort isolation. Supabase dashboard collaborator access is separate from app account roles.

## Future backend work

AI assistance and a FastAPI/OpenRouter service remain planned. Add their implementation, dependencies, server-only configuration, and tests here when those features are built.
