-- Pension searches are fiscal/budget queries, not person-name queries.

CREATE OR REPLACE FUNCTION _search_query_intent(query_text text)
RETURNS text AS $$
DECLARE
  normalized text;
  token_count integer;
BEGIN
  normalized := _search_normalize_query(query_text);
  IF normalized IS NULL THEN RETURN 'general'; END IF;

  IF normalized ~ '\m(contrato|contratos|subvencion|subvenciones|presupuesto|presupuestos|importe|licitacion|bdns|pcsp|pge|pension|pensiones|jubilacion|jubilaciones)\M'
    OR normalized LIKE '%seguridad social%'
    OR normalized LIKE '%clases pasivas%' THEN
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

CREATE OR REPLACE FUNCTION search_suggestions(
  query_text text,
  limit_count integer DEFAULT 12
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
  ts_or_q tsquery;
  search_text text;
  query_intent text;
  max_results integer;
  words text[];
  parts text[];
  word text;
  cleaned text;
BEGIN
  search_text := _search_normalize_query(query_text);
  IF search_text IS NULL THEN RETURN; END IF;

  query_intent := _search_query_intent(query_text);
  ts_q := _build_search_query(search_text);
  words := string_to_array(search_text, ' ');
  parts := ARRAY[]::text[];
  FOREACH word IN ARRAY words LOOP
    cleaned := lower(unaccent(regexp_replace(word, '[^[:alnum:]]', '', 'g')));
    IF length(cleaned) >= 2 THEN
      parts := parts || (cleaned || ':*');
    END IF;
  END LOOP;
  IF array_length(parts, 1) IS NOT NULL THEN
    BEGIN
      ts_or_q := to_tsquery('simple', array_to_string(parts, ' | '));
    EXCEPTION WHEN OTHERS THEN
      ts_or_q := ts_q;
    END;
  END IF;
  max_results := greatest(1, least(coalesce(limit_count, 12), 80));

  RETURN QUERY
  WITH candidates AS (
  (
    SELECT
      sd.document_id,
      _search_document_score(
        sd.display_title,
        sd.title,
        sd.search_vector,
        search_text,
        ts_q,
        sd.entity_type,
        sd.weight,
        query_intent
      ) AS score
    FROM search_documents sd
    WHERE query_intent = 'person'
      AND sd.entity_type IN ('politician', 'senator', 'government_position', 'institution')
      AND ts_q IS NOT NULL
      AND (
        sd.search_vector @@ ts_q
        OR (ts_or_q IS NOT NULL AND sd.search_vector @@ ts_or_q)
        OR similarity(unaccent(coalesce(sd.display_title, sd.title)), search_text) > 0.2
      )
    ORDER BY score DESC, sd.document_date DESC NULLS LAST
    LIMIT 80
  )
  UNION ALL
  (
    SELECT
      sd.document_id,
      _search_document_score(
        sd.display_title,
        sd.title,
        sd.search_vector,
        search_text,
        ts_q,
        sd.entity_type,
        sd.weight,
        query_intent
      ) AS score
    FROM search_documents sd
    WHERE ts_q IS NOT NULL
      AND (
        query_intent <> 'person'
        OR sd.entity_type NOT IN ('politician', 'senator', 'government_position', 'institution')
      )
      AND (
        sd.search_vector @@ ts_q
        OR (ts_or_q IS NOT NULL AND sd.search_vector @@ ts_or_q)
      )
    ORDER BY score DESC, sd.document_date DESC NULLS LAST
    LIMIT CASE WHEN query_intent = 'person' THEN 40 ELSE 120 END
  )
  UNION ALL
  (
    SELECT
      sd.document_id,
      (
        similarity(sa.alias, search_text)
        + (sa.weight::real / 10)
        + _search_document_score(
          sd.display_title,
          sd.title,
          sd.search_vector,
          search_text,
          ts_q,
          sd.entity_type,
          sd.weight,
          query_intent
        )
        + CASE WHEN lower(unaccent(sa.alias)) LIKE search_text || '%' THEN 2 ELSE 0 END
        + 2
      )::real AS score
    FROM search_aliases sa
    JOIN search_documents sd
      ON sa.entity_type = sd.entity_type
      AND sa.entity_id = sd.entity_id
    WHERE sa.entity_id IS NOT NULL
      AND (
        lower(unaccent(sa.alias)) LIKE search_text || '%'
        OR lower(unaccent(sa.canonical)) LIKE search_text || '%'
        OR sa.alias % search_text
        OR similarity(lower(unaccent(sa.alias)), search_text) > 0.2
      )
    ORDER BY score DESC, sd.document_date DESC NULLS LAST
    LIMIT 80
  )
  ),
  ranked AS (
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
        max(candidates.score)
        + CASE
            WHEN search_text ~ '(pension|pensiones|jubilacion|jubilaciones)'
              AND sd.entity_type = 'budget_program'
              AND sd.amount >= 100000000000 THEN 1.50
            WHEN search_text ~ '(pension|pensiones|jubilacion|jubilaciones)'
              AND sd.entity_type = 'budget_program'
              AND sd.amount >= 10000000000 THEN 0.70
            ELSE 0
          END
      )::real AS rank
    FROM candidates
    JOIN search_documents sd ON sd.document_id = candidates.document_id
    GROUP BY
      sd.entity_type,
      sd.entity_id,
      sd.display_title,
      sd.title,
      sd.subtitle,
      sd.route,
      sd.source_url,
      sd.key_fact,
      sd.document_date,
      sd.amount,
      sd.metadata
  )
  SELECT
    ranked.entity_type,
    ranked.id,
    ranked.title,
    ranked.subtitle,
    ranked.url,
    ranked.key_fact,
    ranked.document_date,
    ranked.amount,
    ranked.source_url,
    ranked.metadata,
    ranked.rank
  FROM ranked
  ORDER BY ranked.rank DESC, ranked.document_date DESC NULLS LAST, ranked.amount DESC NULLS LAST
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

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
  search_text := _search_normalize_query(query_text);
  IF search_text IS NULL THEN RETURN; END IF;

  query_intent := _search_query_intent(query_text);
  ts_q := _build_search_query(search_text);
  token_count := cardinality(string_to_array(trim(search_text), ' '));

  RETURN QUERY
  WITH alias_hits AS (
    SELECT DISTINCT sd.document_id
    FROM search_aliases sa
    JOIN search_documents sd
      ON sa.entity_type = sd.entity_type
      AND sa.entity_id = sd.entity_id
    WHERE sa.entity_id IS NOT NULL
      AND (
        lower(unaccent(sa.alias)) LIKE '%' || search_text || '%'
        OR lower(unaccent(sa.canonical)) LIKE '%' || search_text || '%'
        OR similarity(lower(unaccent(sa.alias)), search_text) > 0.2
      )
  ),
  candidates AS (
    SELECT
      sd.document_id,
      _search_document_score(
        sd.display_title,
        sd.title,
        sd.search_vector,
        search_text,
        ts_q,
        sd.entity_type,
        sd.weight,
        query_intent
      ) AS score
    FROM search_documents sd
    WHERE (entity_types IS NULL OR array_length(entity_types, 1) IS NULL OR sd.entity_type = ANY(entity_types))
      AND (
        (ts_q IS NOT NULL AND sd.search_vector @@ ts_q)
        OR similarity(unaccent(coalesce(sd.display_title, sd.title)), search_text) > 0.18
        OR sd.document_id IN (SELECT alias_hits.document_id FROM alias_hits)
      )
    ORDER BY score DESC, sd.document_date DESC NULLS LAST, sd.amount DESC NULLS LAST
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
      candidates.score
      + CASE WHEN sd.amount IS NOT NULL AND search_text ~ '(importe|mayor|contrato|subvencion|presupuesto|pension|pensiones)' THEN 0.25 ELSE 0 END
      + CASE
          WHEN search_text ~ '(pension|pensiones|jubilacion|jubilaciones)'
            AND sd.entity_type = 'budget_program'
            AND sd.amount >= 100000000000 THEN 1.50
          WHEN search_text ~ '(pension|pensiones|jubilacion|jubilaciones)'
            AND sd.entity_type = 'budget_program'
            AND sd.amount >= 10000000000 THEN 0.70
          ELSE 0
        END
      + CASE WHEN sd.document_date IS NOT NULL THEN 0.05 ELSE 0 END
    )::real AS rank
  FROM candidates
  JOIN search_documents sd ON sd.document_id = candidates.document_id
  WHERE (
    token_count >= 2
    OR lower(unaccent(concat_ws(' ', coalesce(sd.display_title, sd.title), sd.subtitle, sd.key_fact))) LIKE '%' || search_text || '%'
    OR lower(unaccent(coalesce(sd.body, ''))) LIKE '%' || search_text || '%'
    OR sd.document_id IN (SELECT alias_hits.document_id FROM alias_hits)
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

GRANT EXECUTE ON FUNCTION _search_query_intent(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_suggestions(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_documents(text, text[], jsonb, integer) TO anon, authenticated;
