-- Emergency fix for multiple permission gaps and performance problems.
--
-- Problems addressed:
--   1. Territory views (v_territory_money_rollups et al.) had no GRANT — /ccaa and
--      /municipios showed zero data for all users.
--   2. v_money_data_public uses security_invoker=true and calls v_money_data_internal,
--      which was only granted to `authenticated`, not `anon`.  Every anon query to
--      estado-datos and /dinero returned empty.
--   3. The full v_money_data_internal chain (UNION ALL over contracts + subsidies +
--      multiple responsibility joins) is too expensive to run live on Free-tier
--      shared CPU.  Replace the public views with cache-table reads.
--   4. Supabase storage near the 500 MB free-tier limit.  Prune old etl_runs rows
--      to reclaim space.  VACUUM is run to return pages to the OS.
--
-- After pushing this migration, run:
--   PYTHONPATH=src python -m common.search_refresh
-- That populates money_coverage_cache and money_examples_cache.
-- Until ETL runs, the money coverage sections will be empty (same as current state).

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Territory views — grant missing entirely since 20260528020000
-- ═══════════════════════════════════════════════════════════════════════════

GRANT SELECT ON v_subsidy_territory_records TO anon, authenticated;
GRANT SELECT ON v_contract_territory_records TO anon, authenticated;
GRANT SELECT ON v_territory_money_rollups    TO anon, authenticated;
GRANT SELECT ON v_territory_money_coverage   TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Money data chain — fix the security_invoker permission gap
--    Grant anon on every view in the chain so the fallback still works when
--    the cache below is empty (e.g. immediately after this migration runs).
-- ═══════════════════════════════════════════════════════════════════════════

GRANT SELECT ON v_contract_resolution_base           TO anon, authenticated;
GRANT SELECT ON v_subsidy_resolution_base            TO anon, authenticated;
GRANT SELECT ON v_contract_responsibility_candidates TO anon, authenticated;
GRANT SELECT ON v_subsidy_responsibility_candidates  TO anon, authenticated;
GRANT SELECT ON v_contract_responsibility_conflicts  TO anon, authenticated;
GRANT SELECT ON v_subsidy_responsibility_conflicts   TO anon, authenticated;
GRANT SELECT ON v_money_data_internal                TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. money_coverage_cache — lightweight pre-computed stats
--    Same pattern as section_index_cache.  ETL populates it via
--    refresh_money_coverage() after each contracts/subsidies pipeline run.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS money_coverage_cache (
  dataset                text NOT NULL,
  administration_level   text NOT NULL,
  total_rows             integer NOT NULL DEFAULT 0,
  resolved_rows          integer NOT NULL DEFAULT 0,
  unresolved_rows        integer NOT NULL DEFAULT 0,
  conflict_rows          integer NOT NULL DEFAULT 0,
  coverage_start_date    date,
  latest_record_date     date,
  freshness_window       text NOT NULL DEFAULT '90d+',
  updated_at             timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dataset, administration_level)
);

ALTER TABLE money_coverage_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "money_coverage_public_read" ON money_coverage_cache;
CREATE POLICY "money_coverage_public_read"
  ON money_coverage_cache FOR SELECT USING (true);
GRANT SELECT ON money_coverage_cache TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. money_examples_cache — top-18 unresolved / conflict examples
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS money_examples_cache (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset              text NOT NULL,
  record_id            text NOT NULL,
  record_date          date,
  body_name            text,
  body_normalized      text,
  administration_level text,
  display_title        text,
  source_url           text,
  issue_type           text NOT NULL CHECK (issue_type IN ('conflict', 'unresolved')),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE money_examples_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "money_examples_public_read" ON money_examples_cache;
CREATE POLICY "money_examples_public_read"
  ON money_examples_cache FOR SELECT USING (true);
GRANT SELECT ON money_examples_cache TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Redirect public views to cache tables
--    Reads from cache when populated; returns empty rows when cache is stale
--    (same behaviour as today — ETL run fills it).  No security_invoker needed
--    on a plain table read.
-- ═══════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS v_responsibility_coverage;
DROP VIEW IF EXISTS v_money_data_public;
CREATE OR REPLACE VIEW v_money_data_public AS
SELECT
  dataset,
  administration_level,
  total_rows,
  resolved_rows,
  unresolved_rows,
  conflict_rows,
  coverage_start_date,
  latest_record_date,
  freshness_window
FROM money_coverage_cache;

GRANT SELECT ON v_money_data_public TO anon, authenticated;

CREATE OR REPLACE VIEW v_responsibility_coverage AS
SELECT
  dataset,
  administration_level,
  total_rows,
  resolved_rows,
  unresolved_rows,
  conflict_rows,
  coverage_start_date,
  latest_record_date,
  freshness_window,
  CASE
    WHEN total_rows = 0 THEN 0
    ELSE round((resolved_rows::numeric / total_rows::numeric) * 100, 2)
  END AS resolved_pct
FROM v_money_data_public;

GRANT SELECT ON v_responsibility_coverage TO anon, authenticated;

DROP VIEW IF EXISTS v_money_resolution_conflicts;
DROP VIEW IF EXISTS v_unresolved_money_examples;
CREATE OR REPLACE VIEW v_unresolved_money_examples AS
SELECT
  dataset,
  record_id,
  record_date,
  body_name,
  body_normalized,
  administration_level,
  display_title,
  source_url,
  issue_type
FROM money_examples_cache;

GRANT SELECT ON v_unresolved_money_examples TO anon, authenticated;

CREATE OR REPLACE VIEW v_money_resolution_conflicts AS
SELECT
  dataset,
  record_id,
  body_name,
  administration_level,
  record_date
FROM v_unresolved_money_examples
WHERE issue_type = 'conflict';

GRANT SELECT ON v_money_resolution_conflicts TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. refresh_money_coverage() — called by ETL after contracts/subsidies runs
--    SECURITY DEFINER so it can query the full v_money_data_internal chain
--    regardless of the caller's role.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.refresh_money_coverage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats_count   integer;
  example_count integer;
BEGIN
  -- Coverage stats — inline the v_money_data_public aggregation to avoid the
  -- security_invoker chain.  This function owns v_money_data_internal access.
  INSERT INTO money_coverage_cache (
    dataset, administration_level, total_rows, resolved_rows, unresolved_rows,
    conflict_rows, coverage_start_date, latest_record_date, freshness_window, updated_at
  )
  SELECT
    dataset,
    coalesce(administration_level, 'sin_clasificar'),
    count(*)::integer,
    count(*) FILTER (WHERE person_name IS NOT NULL)::integer,
    count(*) FILTER (WHERE person_name IS NULL)::integer,
    count(*) FILTER (WHERE has_conflict)::integer,
    min(record_date)::date,
    max(record_date)::date,
    CASE
      WHEN max(record_date) >= current_date - interval '7 days'  THEN '7d'
      WHEN max(record_date) >= current_date - interval '30 days' THEN '30d'
      WHEN max(record_date) >= current_date - interval '90 days' THEN '90d'
      ELSE '90d+'
    END,
    now()
  FROM v_money_data_internal
  GROUP BY dataset, coalesce(administration_level, 'sin_clasificar')
  ON CONFLICT (dataset, administration_level) DO UPDATE SET
    total_rows           = EXCLUDED.total_rows,
    resolved_rows        = EXCLUDED.resolved_rows,
    unresolved_rows      = EXCLUDED.unresolved_rows,
    conflict_rows        = EXCLUDED.conflict_rows,
    coverage_start_date  = EXCLUDED.coverage_start_date,
    latest_record_date   = EXCLUDED.latest_record_date,
    freshness_window     = EXCLUDED.freshness_window,
    updated_at           = EXCLUDED.updated_at;

  GET DIAGNOSTICS stats_count = ROW_COUNT;

  -- Top-18 unresolved / conflict examples
  DELETE FROM money_examples_cache;

  INSERT INTO money_examples_cache (
    dataset, record_id, record_date, body_name, body_normalized,
    administration_level, display_title, source_url, issue_type, updated_at
  )
  SELECT
    dataset,
    record_id,
    record_date::date,
    body_name,
    body_normalized,
    administration_level,
    display_title,
    source_url,
    CASE WHEN has_conflict THEN 'conflict' ELSE 'unresolved' END,
    now()
  FROM v_money_data_internal
  WHERE person_name IS NULL OR has_conflict
  ORDER BY record_date DESC NULLS LAST
  LIMIT 18;

  GET DIAGNOSTICS example_count = ROW_COUNT;

  RETURN stats_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_money_coverage() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Storage reclaim — prune ETL run history older than 90 days
--    etl_runs grows ~(pipelines × runs_per_day) rows indefinitely.
--    Keeping 90 days is enough for the estado-datos freshness display.
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM etl_runs
WHERE started_at < now() - interval '90 days';

-- VACUUM cannot run inside Supabase CLI's migration pipeline. Run manually only
-- on hosted projects if storage pressure requires it:
--   VACUUM ANALYZE etl_runs;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Seed the cache immediately if the DB allows writes.
--    If the DB is still read-only (storage limit) this block is skipped
--    gracefully; ETL will populate the cache on the next successful run.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  PERFORM refresh_money_coverage();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE
    'Could not seed money_coverage_cache now (%): run search_refresh after writes are available.',
    SQLERRM;
END;
$$;
