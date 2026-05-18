-- Shared search ranking primitives for suggestions and full search.

CREATE OR REPLACE FUNCTION _search_normalize_query(query_text text)
RETURNS text AS $$
DECLARE
  normalized text;
  search_text text;
BEGIN
  normalized := lower(unaccent(trim(coalesce(query_text, ''))));
  normalized := regexp_replace(normalized, '\s+', ' ', 'g');
  IF length(normalized) < 2 THEN RETURN NULL; END IF;

  search_text := regexp_replace(
    normalized,
    '\m(quien|que|cual|cuales|cuando|donde|como|a|al|de|del|la|las|el|los|un|una|unos|unas|su|sus|en|por|para|con|sobre|mayor|menor|importe|ultimo|ultima|ultimos|ultimas|contrato|contratos|subvencion|subvenciones|presupuesto|presupuestos|indicador|indicadores|iniciativa|iniciativas|votacion|votaciones|ministerio|ministerios|gobierno|organismo|organismos|entidad|entidades)\M',
    ' ',
    'gi'
  );
  search_text := trim(regexp_replace(search_text, '\s+', ' ', 'g'));
  IF length(search_text) < 2 THEN
    RETURN normalized;
  END IF;
  RETURN search_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Apellidos, Nombre → Nombre Apellidos (full inversion).
CREATE OR REPLACE FUNCTION _search_display_name(full_name text)
RETURNS text AS $$
DECLARE
  trimmed text;
  comma_pos integer;
BEGIN
  trimmed := trim(coalesce(full_name, ''));
  IF trimmed = '' THEN RETURN trimmed; END IF;
  comma_pos := position(',' in trimmed);
  IF comma_pos > 0 THEN
    RETURN trim(substring(trimmed from comma_pos + 1)) || ' ' || trim(substring(trimmed from 1 for comma_pos - 1));
  END IF;
  RETURN trimmed;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _search_title_prefix_score(title text, query_text text)
RETURNS real AS $$
DECLARE
  norm_title text;
  norm_query text;
  display_name text;
  word text;
  max_score real := 0;
  token_score real;
BEGIN
  norm_query := lower(unaccent(trim(coalesce(query_text, ''))));
  IF length(norm_query) < 2 THEN RETURN 0; END IF;

  norm_title := lower(unaccent(trim(coalesce(title, ''))));
  display_name := lower(unaccent(_search_display_name(title)));

  IF norm_title LIKE norm_query || '%' THEN
    max_score := greatest(max_score, 2::real);
  END IF;
  IF display_name LIKE norm_query || '%' THEN
    max_score := greatest(max_score, 2::real);
  END IF;
  IF norm_title = norm_query OR display_name = norm_query THEN
    max_score := greatest(max_score, 5::real);
  END IF;

  FOR word IN SELECT unnest(string_to_array(norm_query, ' ')) LOOP
    IF length(word) < 2 THEN CONTINUE; END IF;
    IF norm_title ~ ('\m' || regexp_replace(word, '([\\.*+?^${}()|[\]])', '\\\1', 'g') || '\M') THEN
      token_score := 1.5;
    ELSIF display_name ~ ('\m' || regexp_replace(word, '([\\.*+?^${}()|[\]])', '\\\1', 'g') || '\M') THEN
      token_score := 1.5;
    ELSE
      token_score := 0;
    END IF;
    max_score := greatest(max_score, token_score);
  END LOOP;

  RETURN max_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _search_query_intent(query_text text)
RETURNS text AS $$
DECLARE
  normalized text;
  token_count integer;
BEGIN
  normalized := _search_normalize_query(query_text);
  IF normalized IS NULL THEN RETURN 'general'; END IF;

  IF normalized ~ '\m(contrato|contratos|subvencion|subvenciones|presupuesto|presupuestos|importe|licitacion|bdns|pcsp|pge)\M' THEN
    RETURN 'fiscal';
  END IF;
  IF normalized ~ '\m(ministerio|ministerios|gobierno|organismo|organismos|institucion|instituciones)\M' THEN
    RETURN 'org';
  END IF;

  token_count := cardinality(string_to_array(trim(normalized), ' '));
  IF normalized !~ '[0-9]'
    AND token_count BETWEEN 1 AND 3
    AND normalized ~ '^[[:alpha:][:space:]-]+$'
  THEN
    RETURN 'person';
  END IF;

  RETURN 'general';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _search_entity_type_boost(entity_type text, intent text)
RETURNS real AS $$
BEGIN
  IF intent = 'person' THEN
    CASE entity_type
      WHEN 'politician', 'senator', 'government_position', 'institution' THEN RETURN 1.5;
      WHEN 'eu_fund' THEN RETURN -1.0;
      WHEN 'vote_divergence' THEN RETURN -0.5;
      ELSE RETURN 0;
    END CASE;
  END IF;
  IF intent = 'fiscal' THEN
    CASE entity_type
      WHEN 'contract', 'subsidy', 'budget', 'budget_program' THEN RETURN 1.0;
      WHEN 'politician', 'senator', 'government_position', 'eu_fund' THEN RETURN -0.75;
      ELSE RETURN 0;
    END CASE;
  END IF;
  IF intent = 'org' THEN
    CASE entity_type
      WHEN 'government_position', 'institution', 'organization' THEN RETURN 0.75;
      ELSE RETURN 0;
    END CASE;
  END IF;
  RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION _search_document_score(
  p_display_title text,
  p_title text,
  p_search_vector tsvector,
  p_search_text text,
  p_ts_q tsquery,
  p_entity_type text,
  p_weight integer,
  p_intent text
)
RETURNS real AS $$
  SELECT (
    CASE WHEN p_ts_q IS NOT NULL THEN ts_rank_cd(p_search_vector, p_ts_q) ELSE 0 END
    + _search_title_prefix_score(coalesce(p_display_title, p_title), p_search_text)
    + similarity(unaccent(coalesce(p_display_title, p_title)), p_search_text)
    + (coalesce(p_weight, 1)::real / 10)
    + _search_entity_type_boost(p_entity_type, p_intent)
  )::real;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION _search_normalize_query(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION _search_display_name(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION _search_title_prefix_score(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION _search_query_intent(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION _search_entity_type_boost(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION _search_document_score(text, text, tsvector, text, tsquery, text, integer, text) TO anon, authenticated;
