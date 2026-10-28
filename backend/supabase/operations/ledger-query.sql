-- Read-only. Run in the Supabase SQL Editor and save the result (version column)
-- to a text file for: npm run check:migrations -- --ledger ledger.txt
select version, name
from supabase_migrations.schema_migrations
order by version;
