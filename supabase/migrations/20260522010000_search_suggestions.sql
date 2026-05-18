-- Fast deterministic suggestions over the canonical search corpus.
-- This is intentionally separate from search_documents(), which keeps broader
-- fallback matching for the full results page.

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
  normalized_query text;
  search_text text;
  max_results integer;
  words text[];
  parts text[];
  word text;
  cleaned text;
BEGIN
  normalized_query := lower(unaccent(trim(coalesce(query_text, ''))));
  normalized_query := regexp_replace(normalized_query, '\s+', ' ', 'g');
  IF length(normalized_query) < 2 THEN RETURN; END IF;

  search_text := regexp_replace(
    normalized_query,
    '\m(quien|que|cual|cuales|cuando|donde|como|a|al|de|del|la|las|el|los|un|una|unos|unas|su|sus|en|por|para|con|sobre|mayor|menor|importe|ultimo|ultima|ultimos|ultimas|contrato|contratos|subvencion|subvenciones|presupuesto|presupuestos|indicador|indicadores|iniciativa|iniciativas|votacion|votaciones|ministerio|ministerios|gobierno|organismo|organismos|entidad|entidades)\M',
    ' ',
    'gi'
  );
  search_text := trim(regexp_replace(search_text, '\s+', ' ', 'g'));
  IF length(search_text) < 2 THEN
    search_text := normalized_query;
  END IF;

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
  max_results := greatest(1, least(coalesce(limit_count, 12), 50));

  RETURN QUERY
  WITH candidates AS (
    (
      SELECT
        sd.document_id,
        (
          CASE WHEN ts_q IS NOT NULL THEN ts_rank_cd(sd.search_vector, ts_q) ELSE 0 END
          + CASE WHEN lower(unaccent(sd.title)) = search_text THEN 5 ELSE 0 END
          + CASE WHEN lower(unaccent(sd.title)) LIKE search_text || '%' THEN 2 ELSE 0 END
          + CASE WHEN sd.title % search_text THEN similarity(sd.title, search_text) ELSE 0 END
          + (sd.weight::real / 10)
        )::real AS score
      FROM search_documents sd
      WHERE ts_q IS NOT NULL
        AND (
          sd.search_vector @@ ts_q
          OR (ts_or_q IS NOT NULL AND sd.search_vector @@ ts_or_q)
        )
      ORDER BY score DESC, sd.document_date DESC NULLS LAST
      LIMIT 120
    )

    UNION ALL

    (
      SELECT
        sd.document_id,
        (
          similarity(sa.alias, search_text)
          + (sa.weight::real / 10)
          + (sd.weight::real / 10)
          + CASE WHEN lower(unaccent(sa.alias)) LIKE search_text || '%' THEN 2 ELSE 0 END
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
        )
      ORDER BY score DESC, sd.document_date DESC NULLS LAST
      LIMIT 80
    )
  ),
  ranked AS (
    SELECT
      sd.entity_type,
      sd.entity_id AS id,
      sd.title,
      sd.subtitle,
      coalesce(sd.route, sd.source_url, '') AS url,
      sd.key_fact,
      sd.document_date,
      sd.amount,
      sd.source_url,
      sd.metadata,
      max(candidates.score)::real AS rank
    FROM candidates
    JOIN search_documents sd ON sd.document_id = candidates.document_id
    GROUP BY
      sd.entity_type,
      sd.entity_id,
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

GRANT EXECUTE ON FUNCTION search_suggestions(text, integer) TO anon, authenticated;
