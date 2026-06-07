-- get_declarations_page: paginated, filterable, sortable declarations
-- Supports all three declaration types with party filter and name search.
-- Output includes party info for filter pills and declared_income for bienes_rentas.

CREATE OR REPLACE FUNCTION get_declarations_page(
  p_type text DEFAULT NULL,           -- 'bienes_rentas' | 'actividades' | 'intereses_economicos' | NULL (all)
  p_party text DEFAULT NULL,          -- party acronym filter | NULL (all)
  p_search text DEFAULT NULL,         -- name search (ilike) | NULL (no filter)
  p_sort text DEFAULT 'declared_income',  -- 'declared_income' | 'declaration_date' | 'politician_name'
  p_direction text DEFAULT 'desc',    -- 'asc' | 'desc'
  p_page int DEFAULT 1,               -- 1-indexed
  p_page_size int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  politician_id uuid,
  politician_name text,
  declaration_date date,
  source_url text,
  declared_income numeric,
  irpf_paid numeric,
  inmuebles_mentioned int,
  vehiculos_mentioned int,
  financial_assets_mentioned int,
  ocr_status text,
  party_acronym text,
  party_color text,
  type text,
  total_count bigint
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  offset_val int;
BEGIN
  offset_val := (p_page - 1) * p_page_size;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      ed.id,
      ed.politician_id,
      p.full_name::text AS politician_name,
      ed.declaration_date,
      ed.source_url,
      (ed.raw_data->>'total_income')::numeric AS declared_income,
      (ed.raw_data->>'irpf_paid')::numeric AS irpf_paid,
      (ed.raw_data->>'inmuebles_mentioned')::int AS inmuebles_mentioned,
      (ed.raw_data->>'vehiculos_mentioned')::int AS vehiculos_mentioned,
      (ed.raw_data->>'financial_assets_mentioned')::int AS financial_assets_mentioned,
      ed.raw_data->>'ocr_status' AS ocr_status,
      ed.raw_data->>'type' AS type,
      pm.group_parliamentary,
      pt.acronym AS party_acronym,
      pt.color AS party_color
    FROM economic_declarations ed
    JOIN politicians p ON p.id = ed.politician_id
    LEFT JOIN politician_memberships pm ON pm.politician_id = p.id
      AND pm.legislature_id = (SELECT id FROM legislatures WHERE is_active = true LIMIT 1)
    LEFT JOIN parties pt ON pt.id = pm.party_id
    WHERE
      (p_type IS NULL OR ed.raw_data->>'type' = p_type)
      AND (p_party IS NULL OR pt.acronym = p_party)
      AND (p_search IS NULL OR p.full_name ILIKE '%' || p_search || '%')
  ),
  sorted AS (
    SELECT *,
      CASE WHEN p_sort = 'declared_income' THEN declared_income END AS sort_income,
      CASE WHEN p_sort = 'declaration_date' THEN declaration_date END AS sort_date,
      CASE WHEN p_sort = 'politician_name' THEN politician_name END AS sort_name
    FROM filtered
  )
  SELECT
    s.id,
    s.politician_id,
    s.politician_name,
    s.declaration_date,
    s.source_url,
    s.declared_income,
    s.irpf_paid,
    s.inmuebles_mentioned,
    s.vehiculos_mentioned,
    s.financial_assets_mentioned,
    s.ocr_status,
    s.party_acronym,
    s.party_color,
    s.type,
    (SELECT count(*)::bigint FROM filtered)::bigint AS total_count
  FROM sorted s
  ORDER BY
    CASE WHEN p_direction = 'asc' THEN sort_income END ASC NULLS LAST,
    CASE WHEN p_direction = 'desc' THEN sort_income END DESC NULLS LAST,
    CASE WHEN p_sort = 'declaration_date' AND p_direction = 'asc' THEN sort_date END ASC NULLS LAST,
    CASE WHEN p_sort = 'declaration_date' AND p_direction = 'desc' THEN sort_date END DESC NULLS LAST,
    CASE WHEN p_sort = 'politician_name' AND p_direction = 'asc' THEN sort_name END ASC NULLS LAST,
    CASE WHEN p_sort = 'politician_name' AND p_direction = 'desc' THEN sort_name END DESC NULLS LAST,
    s.declaration_date DESC NULLS LAST
  LIMIT p_page_size
  OFFSET offset_val;
END;
$$;

GRANT EXECUTE ON FUNCTION get_declarations_page(text, text, text, text, text, int, int) TO anon, authenticated;