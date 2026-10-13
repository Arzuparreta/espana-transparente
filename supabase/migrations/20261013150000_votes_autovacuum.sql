-- The growing votes table kept 15-day-old planner statistics and visibility
-- metadata under PostgreSQL's default 20% vacuum / 10% analyze thresholds.
-- That turned the Senate count into a full scan of nearly one million votes.
-- Keep index-only scans usable as the incremental ETL inserts new sessions.
-- These are table-local settings; other applications on the host are unchanged.
ALTER TABLE public.votes SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_threshold = 1000,
  autovacuum_vacuum_insert_scale_factor = 0.01,
  autovacuum_vacuum_insert_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_analyze_threshold = 1000
);

-- VACUUM cannot run inside a migration transaction. The initial maintenance
-- is performed separately with VACUUM (ANALYZE) public.votes on the VPS.
