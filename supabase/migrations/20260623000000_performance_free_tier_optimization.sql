-- Free tier resource optimization.
-- The Supabase free tier (500 MB, shared RAM) was exhausting resources,
-- causing auth failures ("Database error granting user").
--
-- Strategy:
--   1. Replace expensive get_section_index() RPC (14 COUNTs over large
--      views/tables on every home visit) with a lightweight cache table
--      refreshed by ETL daily.
--   2. Drop redundant GIN indexes on search corpus to reclaim disk + RAM.
--   3. Add simple btree indexes for the most common homepage lookups.
--   4. Create a lightweight organization count cache to avoid the heavy
--      v_organization_public view on the section index and home.
--
-- Run: npx supabase db push
-- After push: PYTHONPATH=src python -m common.search_refresh

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Section index cache table (replaces get_section_index RPC)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS section_index_cache (
  section_key text PRIMARY KEY,
  record_count bigint NOT NULL DEFAULT 0,
  latest_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE section_index_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read section index" ON section_index_cache;
CREATE POLICY "Public read section index"
  ON section_index_cache FOR SELECT USING (true);

GRANT SELECT ON section_index_cache TO anon, authenticated;

-- Function to refresh the section index cache. Called by ETL after pipeline runs.
CREATE OR REPLACE FUNCTION public.refresh_section_index()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Delete old rows not present in this refresh
  DELETE FROM section_index_cache;

  -- Politicians (congress) — simple count on indexed table
  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'diputados',
         COUNT(DISTINCT politician_id),
         NULL
  FROM politician_memberships
  WHERE is_active AND chamber = 'congress';

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'senado',
         COUNT(DISTINCT politician_id),
         NULL
  FROM politician_memberships
  WHERE is_active AND chamber = 'senate';

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'gobierno',
         COUNT(*),
         NULL
  FROM v_gobierno_actual;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'partidos',
         COUNT(*),
         NULL
  FROM parties;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'instituciones',
         COUNT(*),
         NULL
  FROM v_instituciones_actuales;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'presupuestos',
         COUNT(DISTINCT (year, section_code)),
         NULL
  FROM budget_lines;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'contratos',
         COUNT(*),
         MAX(date)
  FROM contracts;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'subvenciones',
         COUNT(*),
         MAX(fecha_concesion)
  FROM subsidies;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'fondos-ue',
         COUNT(*),
         NULL
  FROM eu_funds;

  -- Organizations — use simple count instead of expensive v_organization_public
  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'organizaciones',
         COUNT(*),
         NULL
  FROM organizations;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'votaciones',
         COUNT(*),
         MAX(date)
  FROM voting_sessions
  WHERE chamber = 'congress';

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'iniciativas',
         COUNT(*),
         NULL
  FROM initiatives;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'declaraciones',
         COUNT(*),
         MAX(declaration_date)
  FROM economic_declarations;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'indicadores',
         COUNT(DISTINCT indicator_code),
         NULL
  FROM economic_indicators;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'puertas-giratorias',
         COUNT(*),
         NULL
  FROM revolving_door
  WHERE verification_status = 'verified';

  -- Money flow: count distinct budget programs
  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'dinero-publico',
         COUNT(*),
         NULL
  FROM budget_lines;

  -- CCAA / municipal counts from subsidies
  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'ccaa',
         COUNT(*),
         MAX(fecha_concesion)
  FROM subsidies
  WHERE nivel1 = 'AUTONOMICA';

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'municipios',
         COUNT(*),
         MAX(fecha_concesion)
  FROM subsidies
  WHERE nivel1 = 'LOCAL';
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_section_index() TO authenticated;

-- Replace get_section_index() to read from cache table (fallback to live counts)
CREATE OR REPLACE FUNCTION public.get_section_index()
RETURNS TABLE (
  section_key text,
  record_count bigint,
  latest_date date
)
LANGUAGE sql
STABLE
AS $$
  SELECT sic.section_key, sic.record_count, sic.latest_date
  FROM section_index_cache sic
  UNION ALL
  -- Fallback: if cache is empty, return live counts for the most critical
  SELECT 'organizaciones',
         (SELECT COUNT(*)::bigint FROM organizations),
         NULL::date
  WHERE NOT EXISTS (SELECT 1 FROM section_index_cache);
$$;

-- Seed the cache immediately
SELECT refresh_section_index();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Drop redundant search GIN indexes (keep only the essential one)
-- ═══════════════════════════════════════════════════════════════════════════

-- The vector GIN index is essential for full-text search — KEEP IT.
-- The trigram indexes on title/display_title are expensive and only used
-- for typeahead/suggestions; the pg_trgm btree approach is lighter.

DROP INDEX IF EXISTS search_documents_title_trgm_idx;
DROP INDEX IF EXISTS search_documents_display_title_trgm_idx;
DROP INDEX IF EXISTS search_aliases_alias_trgm_idx;
DROP INDEX IF EXISTS source_document_chunks_vector_idx;

-- Replace trigram indexes with simpler btree for prefix matching
-- (LIKE 'prefix%' can use btree, and that's what search_suggestions mostly does)
CREATE INDEX IF NOT EXISTS search_documents_title_btree_idx
  ON search_documents (title text_pattern_ops);

CREATE INDEX IF NOT EXISTS search_aliases_alias_btree_idx
  ON search_aliases (alias text_pattern_ops);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Organization counts cache table (avoids v_organization_public for counts)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS organization_counts (
  id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  contract_count integer NOT NULL DEFAULT 0,
  subsidy_beneficiary_count integer NOT NULL DEFAULT 0,
  subsidy_granting_count integer NOT NULL DEFAULT 0,
  revolving_door_count integer NOT NULL DEFAULT 0,
  eu_fund_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organization_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read org counts" ON organization_counts;
CREATE POLICY "Public read org counts"
  ON organization_counts FOR SELECT USING (true);

GRANT SELECT ON organization_counts TO anon, authenticated;

-- Index for looking up orgs by contract count (leaderboards)
CREATE INDEX IF NOT EXISTS org_counts_contract_idx
  ON organization_counts (contract_count DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Drop unused/empty search source tables if they have no data
--    (safe to keep the structure — just reclaiming indexes)
-- ═══════════════════════════════════════════════════════════════════════════

-- The source_documents* tables are for OCR ingestion pipeline (docacteco)
-- which is not yet populating them. Dropping indexes saves RAM + disk.
DROP INDEX IF EXISTS source_documents_published_idx;
DROP INDEX IF EXISTS source_documents_type_idx;
DROP INDEX IF EXISTS source_documents_url_idx;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Add lightweight indexes for hot homepage queries
-- ═══════════════════════════════════════════════════════════════════════════

-- Homepage queries these frequently; ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_subsidies_nivel1 ON subsidies (nivel1);
CREATE INDEX IF NOT EXISTS idx_voting_sessions_chamber_date ON voting_sessions (chamber, date DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_date_amount ON contracts (date DESC, amount DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Analyze tables to update query planner statistics
-- ═══════════════════════════════════════════════════════════════════════════

ANALYZE section_index_cache;
ANALYZE search_documents;
ANALYZE organizations;
ANALYZE contracts;
ANALYZE subsidies;
ANALYZE voting_sessions;
