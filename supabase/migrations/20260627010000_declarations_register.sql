-- Financial register of bienes_rentas declarations, readable by anon.
--
-- economic_declarations is publicly readable (RLS policy: true for SELECT).
-- This function extracts the OCR-derived numeric fields from raw_data so the
-- web client can display income totals and asset counts without receiving the
-- full ocr_text payload (~5-10 KB per processed record).
--
-- Sorted by declared_income DESC NULLS LAST so the financial register shows
-- highest declared incomes first.

CREATE OR REPLACE FUNCTION get_declarations_register()
RETURNS TABLE (
  id uuid,
  politician_id uuid,
  politician_name text,
  declaration_date date,
  source_url text,
  declared_income numeric,
  irpf_paid numeric,
  inmuebles_mentioned integer,
  vehiculos_mentioned integer,
  financial_assets_mentioned integer,
  ocr_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ed.id,
    ed.politician_id,
    p.full_name::text AS politician_name,
    ed.declaration_date,
    ed.source_url,
    (ed.raw_data->>'total_income')::numeric AS declared_income,
    (ed.raw_data->>'irpf_paid')::numeric AS irpf_paid,
    (ed.raw_data->>'inmuebles_mentioned')::integer AS inmuebles_mentioned,
    (ed.raw_data->>'vehiculos_mentioned')::integer AS vehiculos_mentioned,
    (ed.raw_data->>'financial_assets_mentioned')::integer AS financial_assets_mentioned,
    ed.raw_data->>'ocr_status' AS ocr_status
  FROM economic_declarations ed
  JOIN politicians p ON p.id = ed.politician_id
  WHERE ed.raw_data->>'type' = 'bienes_rentas'
  ORDER BY declared_income DESC NULLS LAST, ed.declaration_date DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_declarations_register() TO anon, authenticated;
