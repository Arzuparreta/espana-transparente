-- Keep full search bounded after the corpus grows.
-- 20260525010000 added pension ranking boosts but restored the older broad
-- similarity scan. This version keeps those boosts while returning to the
-- two-stage candidate plan used by the timeout fix.

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
    '\m(quien|que|cual|cuales|cuando|donde|como|a|al|de|del|la|las|el|los|un|una|unos|unas|su|sus|en|por|para|con|sobre|mayor|menor|importe|ultimo|ultima|ultimos|ultimas|contrato|contratos|subvencion|subvenciones|presupuesto|presupuestos|programa|programas|indicador|indicadores|iniciativa|iniciativas|votacion|votaciones|ministerio|ministerios|gobierno|organismo|organismos|entidad|entidades)\M',
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

CREATE OR REPLACE FUNCTION _search_query_intent(query_text text)
RETURNS text AS $$
DECLARE
  raw_normalized text;
  search_text text;
  token_count integer;
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
  IF raw_normalized ~ '\m(ministerio|ministerios|gobierno|organismo|organismos|institucion|instituciones)\M' THEN
    RETURN 'org';
  END IF;

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

CREATE OR REPLACE FUNCTION search_documents(
  query_text text,
  entity_types text[] DEFAULT NULL,
  filters jsonb DEFAULT '{}'::jsonb,
  limit_count integer DEFAULT 20
)
RETURNS TABLE (
  entity_type text,
  id text,
  title text,
  subtitle text,
  url text,
  key_fact text,
  document_date date,
  amount numeric,
  source_url text,
  metadata jsonb,
  rank real
) AS $$
DECLARE
  ts_q tsquery;
  search_text text;
  query_intent text;
  token_count integer;
BEGIN
  PERFORM set_config('statement_timeout', '8000', true);

  search_text := _search_normalize_query(query_text);
  IF search_text IS NULL THEN RETURN; END IF;

  query_intent := _search_query_intent(query_text);
  ts_q := _build_search_query(search_text);
  token_count := cardinality(string_to_array(trim(search_text), ' '));

  RETURN QUERY
  WITH fts_candidates AS (
    SELECT
      sd.document_id,
      ts_rank_cd(sd.search_vector, ts_q) AS fts_rank
    FROM search_documents sd
    WHERE ts_q IS NOT NULL
      AND sd.search_vector @@ ts_q
      AND (entity_types IS NULL OR array_length(entity_types, 1) IS NULL OR sd.entity_type = ANY(entity_types))
      AND (
        CASE query_intent
          WHEN 'person' THEN sd.entity_type IN (
            'politician', 'senator', 'government_position', 'institution', 'vote_divergence'
          )
          WHEN 'fiscal' THEN sd.entity_type IN ('contract', 'subsidy', 'budget', 'budget_program')
          ELSE true
        END
      )
    ORDER BY fts_rank DESC, sd.weight DESC, sd.document_date DESC NULLS LAST
    LIMIT 180
  ),
  alias_candidates AS (
    SELECT sd.document_id, 0.5::real AS fts_rank
    FROM search_aliases sa
    JOIN search_documents sd
      ON sa.entity_type = sd.entity_type
      AND sa.entity_id = sd.entity_id
    WHERE sa.entity_id IS NOT NULL
      AND (entity_types IS NULL OR array_length(entity_types, 1) IS NULL OR sd.entity_type = ANY(entity_types))
      AND (
        lower(unaccent(sa.alias)) LIKE '%' || search_text || '%'
        OR similarity(lower(unaccent(sa.alias)), search_text) > 0.25
      )
    LIMIT 40
  ),
  candidate_ids AS (
    SELECT document_id, max(fts_rank) AS fts_rank
    FROM (
      SELECT * FROM fts_candidates
      UNION ALL
      SELECT * FROM alias_candidates
    ) merged
    GROUP BY document_id
  ),
  scored AS (
    SELECT
      sd.document_id,
      (
        _search_document_score(
          sd.display_title,
          sd.title,
          sd.search_vector,
          search_text,
          ts_q,
          sd.entity_type,
          sd.weight,
          query_intent
        )
        + candidate_ids.fts_rank
        + CASE
            WHEN search_text ~ '(pension|pensiones|jubilacion|jubilaciones)'
              AND sd.entity_type = 'budget_program'
              AND sd.amount >= 100000000000 THEN 1.50
            WHEN search_text ~ '(pension|pensiones|jubilacion|jubilaciones)'
              AND sd.entity_type = 'budget_program'
              AND sd.amount >= 10000000000 THEN 0.70
            ELSE 0
          END
      ) AS score
    FROM candidate_ids
    JOIN search_documents sd ON sd.document_id = candidate_ids.document_id
    ORDER BY score DESC
    LIMIT 200
  )
  SELECT
    sd.entity_type,
    sd.entity_id AS id,
    coalesce(sd.display_title, sd.title) AS title,
    sd.subtitle,
    coalesce(sd.route, sd.source_url, '') AS url,
    sd.key_fact,
    sd.document_date,
    sd.amount,
    sd.source_url,
    sd.metadata,
    (
      scored.score
      + CASE WHEN sd.amount IS NOT NULL AND search_text ~ '(importe|mayor|contrato|subvencion|presupuesto|pension|pensiones)' THEN 0.25 ELSE 0 END
      + CASE WHEN sd.document_date IS NOT NULL THEN 0.05 ELSE 0 END
    )::real AS rank
  FROM scored
  JOIN search_documents sd ON sd.document_id = scored.document_id
  WHERE (
    token_count >= 2
    OR lower(unaccent(coalesce(sd.display_title, sd.title))) LIKE '%' || search_text || '%'
    OR lower(unaccent(coalesce(sd.subtitle, ''))) LIKE '%' || search_text || '%'
    OR lower(unaccent(coalesce(sd.body, ''))) LIKE '%' || search_text || '%'
  )
    AND (
      NOT (filters ? 'min_amount')
      OR sd.amount IS NULL
      OR sd.amount >= NULLIF(filters->>'min_amount', '')::numeric
    )
    AND (
      NOT (filters ? 'year')
      OR sd.document_date IS NULL
      OR extract(year from sd.document_date)::int = NULLIF(filters->>'year', '')::int
      OR (sd.metadata ? 'year' AND (sd.metadata->>'year')::int = NULLIF(filters->>'year', '')::int)
    )
  ORDER BY rank DESC, sd.document_date DESC NULLS LAST, sd.amount DESC NULLS LAST
  LIMIT greatest(1, least(coalesce(limit_count, 20), 100));
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION _search_normalize_query(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION _search_query_intent(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_documents(text, text[], jsonb, integer) TO anon, authenticated;
