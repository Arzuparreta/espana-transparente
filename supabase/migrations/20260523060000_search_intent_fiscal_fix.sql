-- Intent must read fiscal keywords before stopword stripping removes them.

CREATE OR REPLACE FUNCTION _search_query_intent(query_text text)
RETURNS text AS $$
DECLARE
  raw_normalized text;
  search_text text;
  token_count integer;
BEGIN
  raw_normalized := lower(unaccent(trim(coalesce(query_text, ''))));
  raw_normalized := regexp_replace(raw_normalized, '\s+', ' ', 'g');
  IF length(raw_normalized) < 2 THEN RETURN 'general'; END IF;

  IF raw_normalized ~ '\m(contrato|contratos|subvencion|subvenciones|presupuesto|presupuestos|importe|licitacion|bdns|pcsp|pge)\M' THEN
    RETURN 'fiscal';
  END IF;
  IF raw_normalized ~ '\m(ministerio|ministerios|gobierno|organismo|organismos|institucion|instituciones)\M' THEN
    RETURN 'org';
  END IF;

  search_text := _search_normalize_query(query_text);
  IF search_text IS NULL THEN RETURN 'general'; END IF;

  token_count := cardinality(string_to_array(trim(search_text), ' '));
  IF search_text !~ '[0-9]'
    AND token_count BETWEEN 1 AND 3
    AND search_text ~ '^[[:alpha:][:space:]-]+$'
  THEN
    RETURN 'person';
  END IF;

  RETURN 'general';
END;
$$ LANGUAGE plpgsql IMMUTABLE;
