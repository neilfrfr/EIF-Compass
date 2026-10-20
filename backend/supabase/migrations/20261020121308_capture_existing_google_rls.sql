-- Capture protection already present on EIF Compass's hosted database.
-- No policies are added: these tables remain inaccessible to browser roles.
alter table eif_private.google_connections enable row level security;
alter table eif_private.google_states enable row level security;
alter table eif_private.google_sync enable row level security;
