-- Let company-like bare names reach organization documents.
-- The app layer still narrows name-like searches to people/institutions/organizations;
-- keeping the SQL intent general avoids filtering organizations out before ranking.

CREATE OR REPLACE FUNCTION _search_query_intent(query_text text)
RETURNS text AS $$
DECLARE
  raw_normalized text;
  search_text text;
BEGIN
  raw_normalized := lower(unaccent(trim(coalesce(query_text, ''))));
  raw_normalized := regexp_replace(raw_normalized, '\s+', ' ', 'g');
  search_text := _search_normalize_query(query_text);
  IF search_text IS NULL THEN RETURN 'general'; END IF;

  IF raw_normalized ~ '\m(contrato|contratos|subvencion|subvenciones|presupuesto|presupuestos|programa|programas|importe|licitacion|bdns|pcsp|pge|pension|pensiones|jubilacion|jubilaciones)\M'
    OR raw_normalized LIKE '%seguridad social%'
    OR raw_normalized LIKE '%clases pasivas%' THEN
    RETURN 'fiscal';
  END IF;
  IF raw_normalized ~ '\m(ministerio|ministerios|gobierno|organismo|organismos|institucion|instituciones|empresa|empresas|organizacion|organizaciones|entidad|entidades)\M' THEN
    RETURN 'org';
  END IF;

  RETURN 'general';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION _search_query_intent(text) TO anon, authenticated;
