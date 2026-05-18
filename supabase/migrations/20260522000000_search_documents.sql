-- Canonical public search corpus and broader RPC for answer-backed search.
-- The corpus is derived from public tables; raw source chunks can be added by ETLs.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS search_documents (
  document_id    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    text        NOT NULL,
  entity_id      text        NOT NULL,
  title          text        NOT NULL,
  subtitle       text,
  body           text,
  key_fact       text,
  route          text,
  source_url     text,
  document_date  date,
  amount         numeric,
  weight         integer     NOT NULL DEFAULT 1,
  metadata       jsonb       NOT NULL DEFAULT '{}',
  search_vector  tsvector    NOT NULL DEFAULT ''::tsvector,
  corpus_version text        NOT NULL DEFAULT 'v1',
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS search_documents_type_idx
  ON search_documents (entity_type);

CREATE INDEX IF NOT EXISTS search_documents_date_idx
  ON search_documents (document_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS search_documents_amount_idx
  ON search_documents (amount DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS search_documents_vector_idx
  ON search_documents USING gin (search_vector);

CREATE INDEX IF NOT EXISTS search_documents_title_trgm_idx
  ON search_documents USING gin (title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS search_aliases (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  alias           text        NOT NULL,
  canonical       text        NOT NULL,
  entity_type     text,
  entity_id       text,
  weight          integer     NOT NULL DEFAULT 1,
  source          text        NOT NULL DEFAULT 'curated',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS search_aliases_identity_idx
  ON search_aliases (alias, canonical, coalesce(entity_type, ''), coalesce(entity_id, ''));

CREATE INDEX IF NOT EXISTS search_aliases_alias_trgm_idx
  ON search_aliases USING gin (alias gin_trgm_ops);

CREATE TABLE IF NOT EXISTS source_documents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type     text        NOT NULL,
  source_url      text        NOT NULL,
  title           text,
  published_date  date,
  content_hash    text        NOT NULL,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_url, content_hash)
);

CREATE TABLE IF NOT EXISTS source_document_chunks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id  uuid        NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  chunk_index         integer     NOT NULL,
  content             text        NOT NULL,
  content_hash        text        NOT NULL,
  search_vector       tsvector    NOT NULL DEFAULT ''::tsvector,
  metadata            jsonb       NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_document_id, chunk_index),
  UNIQUE (content_hash)
);

CREATE INDEX IF NOT EXISTS source_document_chunks_vector_idx
  ON source_document_chunks USING gin (search_vector);

CREATE TABLE IF NOT EXISTS search_answer_cache (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_query   text        NOT NULL,
  filters_hash       text        NOT NULL DEFAULT '',
  corpus_version     text        NOT NULL,
  answer_json        jsonb       NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE (normalized_query, filters_hash, corpus_version)
);

CREATE INDEX IF NOT EXISTS search_answer_cache_expires_idx
  ON search_answer_cache (expires_at);

CREATE OR REPLACE FUNCTION refresh_search_documents()
RETURNS integer AS $$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO search_documents (
    entity_type,
    entity_id,
    title,
    subtitle,
    body,
    key_fact,
    route,
    source_url,
    document_date,
    amount,
    weight,
    metadata,
    search_vector,
    corpus_version,
    updated_at
  )
  SELECT
    src.entity_type,
    src.entity_id,
    src.title,
    src.subtitle,
    src.body,
    src.key_fact,
    src.route,
    src.source_url,
    src.document_date,
    src.amount,
    src.weight,
    src.metadata,
    setweight(to_tsvector('simple', unaccent(coalesce(src.title, ''))), 'A') ||
      setweight(to_tsvector('spanish', unaccent(coalesce(src.subtitle, ''))), 'B') ||
      setweight(to_tsvector('spanish', unaccent(coalesce(src.key_fact, ''))), 'B') ||
      setweight(to_tsvector('spanish', unaccent(coalesce(src.body, ''))), 'C'),
    'v1',
    now()
  FROM (
    SELECT
      CASE WHEN pm.chamber = 'senate' THEN 'senator' ELSE 'politician' END AS entity_type,
      p.id::text AS entity_id,
      p.full_name AS title,
      coalesce(par.acronym, pm.group_parliamentary, 'Sin partido') AS subtitle,
      concat_ws(' ', p.full_name, pm.constituency, pm.group_parliamentary, par.name, par.acronym) AS body,
      nullif(concat_ws(' · ', pm.constituency, par.acronym), '') AS key_fact,
      CASE WHEN pm.chamber = 'senate' THEN '/senado' ELSE '/diputados/' || p.id::text END AS route,
      p.website AS source_url,
      pm.start_date AS document_date,
      NULL::numeric AS amount,
      10 AS weight,
      jsonb_build_object('party', par.acronym, 'constituency', pm.constituency, 'chamber', pm.chamber) AS metadata
    FROM politicians p
    JOIN politician_memberships pm ON pm.politician_id = p.id AND pm.is_active = true
    LEFT JOIN parties par ON par.id = pm.party_id

    UNION ALL

    SELECT
      'party',
      par.id::text,
      coalesce(par.acronym, par.name),
      par.name,
      concat_ws(' ', par.name, par.acronym),
      par.name,
      '/partidos/' || par.id::text,
      coalesce(par.website, par.wikipedia_url),
      NULL::date,
      NULL::numeric,
      8,
      jsonb_build_object('acronym', par.acronym, 'color', par.color)
    FROM parties par

    UNION ALL

    SELECT
      'government_position',
      gp.id::text,
      gp.person_name,
      concat_ws(' · ', gp.organization_name, gp.government),
      concat_ws(' ', gp.person_name, gp.position_type, gp.organization_name, gp.political_party, gp.government),
      concat_ws(' · ', gp.position_type, gp.political_party),
      coalesce('/diputados/' || gp.politician_id::text, '/gobierno'),
      gp.source_url,
      gp.start_date,
      NULL::numeric,
      8,
      jsonb_build_object('organization', gp.organization_name, 'government', gp.government, 'party', gp.political_party)
    FROM government_positions gp

    UNION ALL

    SELECT
      'institution',
      m.id::text,
      m.person_name,
      concat_ws(' · ', m.institution, m.position_title),
      concat_ws(' ', m.person_name, m.institution, m.position_title, m.nominating_body, m.political_party),
      coalesce(m.nominating_body, m.political_party),
      coalesce('/diputados/' || m.politician_id::text, '/instituciones'),
      m.source_url,
      m.appointment_date,
      NULL::numeric,
      7,
      jsonb_build_object('institution', m.institution, 'position', m.position_title)
    FROM v_instituciones_actuales m

    UNION ALL

    SELECT
      'organization',
      o.id::text,
      o.name,
      o.sector,
      concat_ws(' ', o.name, o.organization_type, o.sector, o.country),
      nullif(concat_ws(' · ', o.organization_type, o.sector), ''),
      '/organizaciones/' || o.id::text,
      NULL::text,
      NULL::date,
      NULL::numeric,
      7,
      jsonb_build_object('type', o.organization_type, 'sector', o.sector)
    FROM organizations o

    UNION ALL

    SELECT
      'voting_session',
      vs.id::text,
      vs.title,
      coalesce(to_char(vs.date, 'DD/MM/YYYY'), ''),
      concat_ws(' ', vs.title, vs.initiative_number, vs.initiative_type),
      concat_ws(' · ', 'Sesión ' || vs.session_number::text, vs.initiative_number),
      '/votaciones/' || vs.id::text,
      NULL::text,
      vs.date,
      NULL::numeric,
      8,
      jsonb_build_object('session_number', vs.session_number, 'initiative_number', vs.initiative_number)
    FROM voting_sessions vs

    UNION ALL

    SELECT
      'contract',
      c.id::text,
      coalesce(c.title, c.contract_folder_id, 'Contrato'),
      coalesce(c.awarding_body_normalized, c.awarding_body, c.contractor),
      concat_ws(' ', c.title, c.description, c.awarding_body, c.awarding_body_normalized, c.contractor, c.contract_type, c.cpv_code, c.region),
      concat_ws(' · ', c.contractor, to_char(c.amount, 'FM999G999G999G990D00') || ' EUR'),
      '/contratos/' || c.id::text,
      c.source_url,
      c.date,
      c.amount,
      9,
      jsonb_build_object('awarding_body', coalesce(c.awarding_body_normalized, c.awarding_body), 'contractor', c.contractor, 'status', c.status)
    FROM contracts c

    UNION ALL

    SELECT
      'subsidy',
      s.id::text,
      coalesce(s.beneficiario, s.convocatoria, 'Subvención BDNS ' || s.bdns_id::text),
      coalesce(s.nivel3, s.nivel2, s.nivel1),
      concat_ws(' ', s.beneficiario, s.convocatoria, s.numero_convocatoria, s.instrumento, s.nivel1, s.nivel2, s.nivel3),
      concat_ws(' · ', s.instrumento, to_char(s.importe, 'FM999G999G999G990D00') || ' EUR'),
      '/subvenciones/' || s.id::text,
      s.source_url,
      s.fecha_concesion,
      s.importe,
      9,
      jsonb_build_object('bdns_id', s.bdns_id, 'granting_body', s.nivel3, 'territory', s.nivel2)
    FROM subsidies s

    UNION ALL

    SELECT
      'initiative',
      i.id::text,
      coalesce(i.title, i.number, 'Iniciativa'),
      coalesce(i.proposer_group, i.type, i.status),
      concat_ws(' ', i.title, i.number, i.type, i.proposer_group, i.status, i.origin_type, i.eu_directive_ref),
      concat_ws(' · ', i.type, i.proposer_group, i.status),
      '/iniciativas/' || i.id::text,
      i.source_url,
      i.created_at::date,
      NULL::numeric,
      8,
      jsonb_build_object('number', i.number, 'origin_type', i.origin_type, 'eu_directive_ref', i.eu_directive_ref)
    FROM initiatives i

    UNION ALL

    SELECT
      'budget',
      bs.year::text || ':' || bs.section_code,
      coalesce(bs.section_name, bs.ministry_normalized, 'Presupuesto ' || bs.year::text),
      'Presupuesto ' || bs.year::text,
      concat_ws(' ', bs.year::text, bs.section_code, bs.section_name, bs.ministry_normalized),
      concat_ws(' · ', bs.program_count::text || ' programas', to_char(bs.total_credit_initial, 'FM999G999G999G990D00') || ' EUR'),
      '/presupuestos/' || bs.section_code,
      NULL::text,
      make_date(bs.year, 1, 1),
      bs.total_credit_initial,
      7,
      jsonb_build_object('year', bs.year, 'section_code', bs.section_code, 'program_count', bs.program_count)
    FROM v_budget_summary bs

    UNION ALL

    SELECT
      'budget_program',
      bp.year::text || ':' || bp.section_code || ':' || bp.program_code,
      coalesce(bp.program_name, bp.program_code),
      concat_ws(' · ', bp.section_name, bp.year::text),
      concat_ws(' ', bp.year::text, bp.section_code, bp.section_name, bp.program_code, bp.program_name, bp.ministry_normalized),
      to_char(bp.total_credit_initial, 'FM999G999G999G990D00') || ' EUR',
      '/presupuestos/' || bp.section_code,
      NULL::text,
      make_date(bp.year, 1, 1),
      bp.total_credit_initial,
      6,
      jsonb_build_object('year', bp.year, 'section_code', bp.section_code, 'program_code', bp.program_code)
    FROM v_budget_by_program bp

    UNION ALL

    SELECT
      'indicator',
      ei.indicator_code,
      ei.indicator_name,
      ei.indicator_code,
      concat_ws(' ', ei.indicator_code, ei.indicator_name, ei.unit),
      concat_ws(' · ', ei.period, ei.value::text, ei.unit),
      '/indicadores/' || ei.indicator_code,
      NULL::text,
      NULL::date,
      NULL::numeric,
      7,
      jsonb_build_object('code', ei.indicator_code, 'unit', ei.unit)
    FROM (
      SELECT DISTINCT ON (indicator_code)
        indicator_code,
        indicator_name,
        period,
        value,
        unit
      FROM economic_indicators
      ORDER BY indicator_code, period DESC
    ) ei

    UNION ALL

    SELECT
      'eu_fund',
      ef.id,
      ef.label,
      'Fondos UE',
      concat_ws(' ', ef.label, ef.wikidata_link, ef.country_code),
      concat_ws(' · ', coalesce(ef.number_projects::text || ' proyectos', NULL), to_char(ef.eu_budget, 'FM999G999G999G990D00') || ' EUR'),
      '/fondos-ue',
      ef.wikidata_link,
      NULL::date,
      ef.eu_budget,
      6,
      jsonb_build_object('total_budget', ef.total_budget, 'cofinancing_rate', ef.cofinancing_rate)
    FROM eu_funds ef

    UNION ALL

    SELECT
      'revolving_door',
      rd.id::text,
      rd.person_name,
      concat_ws(' → ', rd.public_role, rd.private_organization),
      concat_ws(' ', rd.person_name, rd.public_role, rd.private_organization, rd.sector, rd.verification_status),
      concat_ws(' · ', rd.public_role, rd.private_organization),
      '/puertas-giratorias',
      rd.source_url,
      rd.private_start_date,
      NULL::numeric,
      7,
      jsonb_build_object('sector', rd.sector, 'verification_status', rd.verification_status)
    FROM revolving_door rd

    UNION ALL

    SELECT
      'source_document',
      sd.id::text,
      coalesce(sd.title, sd.source_url),
      sd.source_type,
      concat_ws(' ', sd.title, sd.source_url, sd.source_type),
      sd.source_type,
      NULL::text,
      sd.source_url,
      sd.published_date,
      NULL::numeric,
      4,
      sd.metadata
    FROM source_documents sd
  ) src
  WHERE src.title IS NOT NULL AND trim(src.title) <> ''
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    body = EXCLUDED.body,
    key_fact = EXCLUDED.key_fact,
    route = EXCLUDED.route,
    source_url = EXCLUDED.source_url,
    document_date = EXCLUDED.document_date,
    amount = EXCLUDED.amount,
    weight = EXCLUDED.weight,
    metadata = EXCLUDED.metadata,
    search_vector = EXCLUDED.search_vector,
    corpus_version = EXCLUDED.corpus_version,
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

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
  normalized_query text;
BEGIN
  normalized_query := lower(unaccent(trim(coalesce(query_text, ''))));
  IF length(normalized_query) < 2 THEN RETURN; END IF;

  ts_q := _build_search_query(query_text);

  RETURN QUERY
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
    (
      CASE WHEN ts_q IS NOT NULL THEN ts_rank_cd(sd.search_vector, ts_q) ELSE 0 END
      + CASE WHEN lower(unaccent(sd.title)) = normalized_query THEN 5 ELSE 0 END
      + CASE WHEN lower(unaccent(sd.title)) LIKE normalized_query || '%' THEN 2 ELSE 0 END
      + similarity(lower(unaccent(sd.title)), normalized_query)
      + (sd.weight::real / 10)
      + CASE WHEN sd.amount IS NOT NULL AND normalized_query ~ '(importe|mayor|contrato|subvencion|subvención|presupuesto)' THEN 0.25 ELSE 0 END
      + CASE WHEN sd.document_date IS NOT NULL THEN 0.05 ELSE 0 END
    )::real AS rank
  FROM search_documents sd
  WHERE (entity_types IS NULL OR array_length(entity_types, 1) IS NULL OR sd.entity_type = ANY(entity_types))
    AND (
      (ts_q IS NOT NULL AND sd.search_vector @@ ts_q)
      OR lower(unaccent(concat_ws(' ', sd.title, sd.subtitle, sd.key_fact, sd.body))) LIKE '%' || normalized_query || '%'
      OR similarity(lower(unaccent(sd.title)), normalized_query) > 0.18
      OR EXISTS (
        SELECT 1
        FROM search_aliases sa
        WHERE (sa.entity_type IS NULL OR sa.entity_type = sd.entity_type)
          AND (sa.entity_id IS NULL OR sa.entity_id = sd.entity_id)
          AND (
            lower(unaccent(sa.alias)) LIKE '%' || normalized_query || '%'
            OR lower(unaccent(sa.canonical)) LIKE '%' || normalized_query || '%'
            OR similarity(lower(unaccent(sa.alias)), normalized_query) > 0.2
          )
      )
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

DROP FUNCTION IF EXISTS search_global(text, int);

CREATE OR REPLACE FUNCTION search_global(query_text text, max_per_type int DEFAULT 5)
RETURNS TABLE (
  entity_type text,
  id          text,
  title       text,
  subtitle    text,
  url         text
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      result.entity_type,
      result.id,
      result.title,
      coalesce(result.subtitle, result.key_fact, '') AS subtitle,
      result.url,
      row_number() OVER (PARTITION BY result.entity_type ORDER BY result.rank DESC) AS rn
    FROM search_documents(query_text, NULL, '{}'::jsonb, greatest(1, max_per_type) * 16) result
  )
  SELECT ranked.entity_type, ranked.id, ranked.title, ranked.subtitle, ranked.url
  FROM ranked
  WHERE ranked.rn <= greatest(1, max_per_type);
END;
$$ LANGUAGE plpgsql STABLE;

INSERT INTO search_aliases (alias, canonical, entity_type, source)
VALUES
  ('IPC', 'Índice de precios de consumo', 'indicator', 'curated'),
  ('IPCA', 'Índice de precios de consumo armonizado', 'indicator', 'curated'),
  ('PIB', 'Producto interior bruto', 'indicator', 'curated'),
  ('BDNS', 'Base de Datos Nacional de Subvenciones', 'subsidy', 'curated'),
  ('PCSP', 'Plataforma de Contratación del Sector Público', 'contract', 'curated'),
  ('PGE', 'Presupuestos Generales del Estado', 'budget', 'curated'),
  ('BOE', 'Boletín Oficial del Estado', 'source_document', 'curated'),
  ('UE', 'Unión Europea', NULL, 'curated'),
  ('Defensa', 'Ministerio de Defensa', 'budget', 'curated'),
  ('Sanidad', 'Ministerio de Sanidad', NULL, 'curated')
ON CONFLICT DO NOTHING;

SELECT refresh_search_documents();

ALTER TABLE search_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_answer_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "search_documents_public_read" ON search_documents;
CREATE POLICY "search_documents_public_read" ON search_documents FOR SELECT USING (true);

DROP POLICY IF EXISTS "search_aliases_public_read" ON search_aliases;
CREATE POLICY "search_aliases_public_read" ON search_aliases FOR SELECT USING (true);

DROP POLICY IF EXISTS "source_documents_public_read" ON source_documents;
CREATE POLICY "source_documents_public_read" ON source_documents FOR SELECT USING (true);

DROP POLICY IF EXISTS "source_document_chunks_public_read" ON source_document_chunks;
CREATE POLICY "source_document_chunks_public_read" ON source_document_chunks FOR SELECT USING (true);

GRANT SELECT ON search_documents TO anon, authenticated;
GRANT SELECT ON search_aliases TO anon, authenticated;
GRANT SELECT ON source_documents TO anon, authenticated;
GRANT SELECT ON source_document_chunks TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_documents(text, text[], jsonb, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_search_documents() TO authenticated;
GRANT EXECUTE ON FUNCTION search_global(text, int) TO anon, authenticated;
