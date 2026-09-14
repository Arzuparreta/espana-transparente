-- Cache the divergence ranking the same way the attendance ranking is cached.
--
-- v_divergence_ranking was a plain view over get_divergences(), which scans the
-- whole vote history: ~3.2s on production for 285 rows. The public page aborts
-- its queries after 5s, so /divergencias fell back to "datos no disponibles"
-- whenever the database was under load. The rows are identical; only the
-- evaluation moves to the daily pipeline that already refreshes attendance.

-- Populating (and refreshing) a materialized view runs with a restricted
-- search_path, and get_divergences() resolves its tables at runtime. Without
-- this the population fails with "relation \"votes\" does not exist".
ALTER FUNCTION public.get_divergences() SET search_path = public, pg_temp;

DROP VIEW IF EXISTS v_divergence_ranking;

CREATE MATERIALIZED VIEW v_divergence_ranking AS
SELECT
  p.id            AS politician_id,
  d.full_name,
  p.photo_url,
  p.photo_variants,
  d.acronym       AS party_acronym,
  par.color       AS party_color,
  COUNT(*)        AS divergence_count
FROM get_divergences() d
JOIN politicians p
  ON lower(unaccent(p.full_name)) = lower(unaccent(d.full_name))
LEFT JOIN politician_memberships pm
  ON pm.politician_id = p.id AND pm.is_active = true
LEFT JOIN parties par
  ON par.id = pm.party_id
GROUP BY p.id, d.full_name, p.photo_url, p.photo_variants, d.acronym, par.color;

-- Required for a concurrent refresh, so the public page keeps reading while the
-- pipeline recalculates.
CREATE UNIQUE INDEX v_divergence_ranking_politician_idx
  ON v_divergence_ranking (politician_id);

CREATE INDEX v_divergence_ranking_order_idx
  ON v_divergence_ranking (divergence_count DESC);

GRANT SELECT ON v_divergence_ranking TO anon, authenticated;

CREATE OR REPLACE FUNCTION refresh_divergence_ranking()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_count integer;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_divergence_ranking;
  SELECT COUNT(*) INTO row_count FROM v_divergence_ranking;
  RETURN row_count;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_divergence_ranking() TO authenticated;

-- The relation is replaced, so its oid changes: ask PostgREST to reload.
NOTIFY pgrst, 'reload schema';
