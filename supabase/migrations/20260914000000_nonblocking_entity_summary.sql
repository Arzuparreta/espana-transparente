-- Keep public entity dossiers readable during the scheduled summary refresh.
-- The existing full unique index (entity_type, entity_id) permits concurrent refresh.
CREATE OR REPLACE FUNCTION public.refresh_entity_summary()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_count integer;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_entity_summary;
  SELECT COUNT(*) INTO row_count FROM v_entity_summary;
  RETURN row_count;
END;
$$;
