-- Reduce duplicated search storage on the Supabase free tier.
--
-- The canonical contract, subsidy, and organization records remain in their
-- source tables. search_documents is only a derived discovery index, so it
-- must stay bounded instead of duplicating the full civic-data database.
--
-- TRUNCATE releases the oversized heap and indexes immediately. The scheduled
-- search refresh repopulates the corpus with all small entity types plus the
-- 10,000 highest-signal rows from each large entity type.

TRUNCATE TABLE search_documents;
DELETE FROM search_aliases WHERE source = 'generated';

-- v_entity_summary already materializes organization and politician facts.
-- Its old refresh function also copied every one of those rows back into
-- search_documents, bypassing the bounded Python refresh and recreating the
-- storage incident. Keep summary refresh and search refresh as separate jobs.
CREATE OR REPLACE FUNCTION public.refresh_entity_summary()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_count integer;
BEGIN
  REFRESH MATERIALIZED VIEW v_entity_summary;
  SELECT COUNT(*) INTO row_count FROM v_entity_summary;
  RETURN row_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_entity_summary() TO authenticated;

-- Run history is operational telemetry, not source data. A short retention
-- window is enough for freshness and incident diagnosis.
DELETE FROM etl_runs
WHERE started_at < now() - interval '30 days';
