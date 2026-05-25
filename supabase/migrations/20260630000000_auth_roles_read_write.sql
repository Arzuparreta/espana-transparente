-- Supabase Auth and PostgREST must be able to create users/profile rows.
-- The ETL pooler can report read-only sessions unless overridden, but product
-- runtime services must not depend on per-session ETL overrides.

ALTER DATABASE postgres SET default_transaction_read_only = off;
