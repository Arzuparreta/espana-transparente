-- Avoid collisions between PL/pgSQL output variables and query columns.
-- The declarations imported from the official register do not always include
-- parsed numeric fields, so only cast values that are valid numbers.

CREATE OR REPLACE FUNCTION get_declarations_page(
  p_type text DEFAULT NULL,
  p_party text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'declared_income',
  p_direction text DEFAULT 'desc',
  p_page int DEFAULT 1,
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
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT
      ed.id AS declaration_id,
      ed.politician_id AS declaration_politician_id,
      p.full_name::text AS declaration_politician_name,
      ed.declaration_date AS recorded_declaration_date,
      ed.source_url AS declaration_source_url,
      CASE
        WHEN ed.raw_data->>'total_income' ~ '^-?[0-9]+([.][0-9]+)?$'
        THEN (ed.raw_data->>'total_income')::numeric
      END AS parsed_declared_income,
      CASE
        WHEN ed.raw_data->>'irpf_paid' ~ '^-?[0-9]+([.][0-9]+)?$'
        THEN (ed.raw_data->>'irpf_paid')::numeric
      END AS parsed_irpf_paid,
      CASE
        WHEN ed.raw_data->>'inmuebles_mentioned' ~ '^[0-9]+$'
        THEN (ed.raw_data->>'inmuebles_mentioned')::int
      END AS parsed_inmuebles_mentioned,
      CASE
        WHEN ed.raw_data->>'vehiculos_mentioned' ~ '^[0-9]+$'
        THEN (ed.raw_data->>'vehiculos_mentioned')::int
      END AS parsed_vehiculos_mentioned,
      CASE
        WHEN ed.raw_data->>'financial_assets_mentioned' ~ '^[0-9]+$'
        THEN (ed.raw_data->>'financial_assets_mentioned')::int
      END AS parsed_financial_assets_mentioned,
      ed.raw_data->>'ocr_status' AS declaration_ocr_status,
      ed.raw_data->>'type' AS declaration_type,
      pt.acronym AS declaration_party_acronym,
      pt.color AS declaration_party_color
    FROM economic_declarations ed
    JOIN politicians p ON p.id = ed.politician_id
    LEFT JOIN politician_memberships pm
      ON pm.politician_id = p.id
     AND pm.legislature_id = (
       SELECT l.id
       FROM legislatures l
       WHERE l.is_active = true
       LIMIT 1
     )
    LEFT JOIN parties pt ON pt.id = pm.party_id
    WHERE (p_type IS NULL OR ed.raw_data->>'type' = p_type)
      AND (p_party IS NULL OR pt.acronym = p_party)
      AND (p_search IS NULL OR p.full_name ILIKE '%' || p_search || '%')
  ),
  counted AS (
    SELECT filtered.*, count(*) OVER ()::bigint AS matched_count
    FROM filtered
  )
  SELECT
    c.declaration_id,
    c.declaration_politician_id,
    c.declaration_politician_name,
    c.recorded_declaration_date,
    c.declaration_source_url,
    c.parsed_declared_income,
    c.parsed_irpf_paid,
    c.parsed_inmuebles_mentioned,
    c.parsed_vehiculos_mentioned,
    c.parsed_financial_assets_mentioned,
    c.declaration_ocr_status,
    c.declaration_party_acronym,
    c.declaration_party_color,
    c.declaration_type,
    c.matched_count
  FROM counted c
  ORDER BY
    CASE WHEN p_sort = 'declared_income' AND p_direction = 'asc'
      THEN c.parsed_declared_income END ASC NULLS LAST,
    CASE WHEN p_sort = 'declared_income' AND p_direction = 'desc'
      THEN c.parsed_declared_income END DESC NULLS LAST,
    CASE WHEN p_sort = 'declaration_date' AND p_direction = 'asc'
      THEN c.recorded_declaration_date END ASC NULLS LAST,
    CASE WHEN p_sort = 'declaration_date' AND p_direction = 'desc'
      THEN c.recorded_declaration_date END DESC NULLS LAST,
    CASE WHEN p_sort = 'politician_name' AND p_direction = 'asc'
      THEN c.declaration_politician_name END ASC NULLS LAST,
    CASE WHEN p_sort = 'politician_name' AND p_direction = 'desc'
      THEN c.declaration_politician_name END DESC NULLS LAST,
    c.recorded_declaration_date DESC NULLS LAST,
    c.declaration_id
  LIMIT greatest(1, least(p_page_size, 100))
  OFFSET greatest(0, p_page - 1) * greatest(1, least(p_page_size, 100));
$$;

GRANT EXECUTE ON FUNCTION get_declarations_page(
  text, text, text, text, text, int, int
) TO anon, authenticated;
