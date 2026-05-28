-- Fix refresh_search_documents: replace single UNION ALL with IF blocks.
-- Problem: after ~5 calls PG switches to a generic plan and scans ALL tables
-- for every per-type call, making 'organization' take 30+ min instead of seconds.
-- Solution: each entity type is its own DELETE + INSERT statement inside an IF,
-- evaluated by PL/pgSQL (not the SQL planner), so only the relevant table runs.

-- Helper: compute weighted tsvector from pre-extracted fields.
CREATE OR REPLACE FUNCTION public._search_doc_vector(
  p_title      text,
  p_display    text,
  p_subtitle   text,
  p_key_fact   text,
  p_body       text
) RETURNS tsvector LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT
    setweight(to_tsvector('simple', unaccent(coalesce(p_title, ''))), 'A') ||
    CASE WHEN p_display IS NOT NULL AND p_display <> p_title
      THEN setweight(to_tsvector('simple', unaccent(p_display)), 'A')
      ELSE ''::tsvector END ||
    setweight(to_tsvector('simple',   unaccent(coalesce(p_subtitle,  ''))), 'B') ||
    setweight(to_tsvector('spanish',  unaccent(coalesce(p_subtitle,  ''))), 'B') ||
    setweight(to_tsvector('simple',   unaccent(coalesce(p_key_fact,  ''))), 'B') ||
    setweight(to_tsvector('spanish',  unaccent(coalesce(p_key_fact,  ''))), 'B') ||
    setweight(to_tsvector('simple',   unaccent(coalesce(p_body,      ''))), 'C') ||
    setweight(to_tsvector('spanish',  unaccent(coalesce(p_body,      ''))), 'C')
$$;


CREATE OR REPLACE FUNCTION public.refresh_search_documents(p_entity_type text DEFAULT NULL)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_total integer := 0;
  v_n     integer;
BEGIN

  ---------- politician / senator ----------
  IF p_entity_type IS NULL OR p_entity_type IN ('politician', 'senator') THEN
    DELETE FROM search_documents WHERE entity_type IN ('politician', 'senator');
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    WITH src AS (
      SELECT
        CASE WHEN pm.chamber = 'senate' THEN 'senator' ELSE 'politician' END AS entity_type,
        p.id::text                                                            AS entity_id,
        p.full_name                                                           AS title,
        _search_display_name(p.full_name)                                    AS display_title,
        coalesce(par.acronym, pm.group_parliamentary, 'Sin partido')         AS subtitle,
        concat_ws(' ', p.full_name, pm.constituency,
                  pm.group_parliamentary, par.name, par.acronym)             AS body,
        nullif(concat_ws(' · ', pm.constituency, par.acronym), '')           AS key_fact,
        '/diputados/' || p.id::text                                          AS route,
        p.website                                                             AS source_url,
        pm.start_date                                                         AS document_date,
        jsonb_build_object('party', par.acronym, 'constituency', pm.constituency,
                           'chamber', pm.chamber,
                           'official_name', p.full_name)                     AS metadata
      FROM politicians p
      JOIN politician_memberships pm ON pm.politician_id = p.id AND pm.is_active = true
      LEFT JOIN parties par ON par.id = pm.party_id
      WHERE p.full_name IS NOT NULL AND trim(p.full_name) <> ''
    )
    SELECT entity_type, entity_id, title, display_title, subtitle, body, key_fact,
           route, source_url, document_date, NULL::numeric, 10, metadata,
           _search_doc_vector(title, display_title, subtitle, key_fact, body),
           'v3', now()
    FROM src;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- party ----------
  IF p_entity_type IS NULL OR p_entity_type = 'party' THEN
    DELETE FROM search_documents WHERE entity_type = 'party';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    SELECT
      'party', par.id::text, coalesce(par.acronym, par.name), NULL,
      par.name, concat_ws(' ', par.name, par.acronym), par.name,
      '/partidos/' || par.id::text, coalesce(par.website, par.wikipedia_url),
      NULL::date, NULL::numeric, 8,
      jsonb_build_object('acronym', par.acronym, 'color', par.color),
      _search_doc_vector(coalesce(par.acronym, par.name), NULL, par.name,
                         par.name, concat_ws(' ', par.name, par.acronym)),
      'v3', now()
    FROM parties par
    WHERE coalesce(par.acronym, par.name) IS NOT NULL
      AND trim(coalesce(par.acronym, par.name)) <> '';
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- government_position ----------
  IF p_entity_type IS NULL OR p_entity_type = 'government_position' THEN
    DELETE FROM search_documents WHERE entity_type = 'government_position';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    WITH src AS (
      SELECT
        gobi.id::text                                                           AS entity_id,
        gobi.person_name                                                        AS title,
        _search_display_name(gobi.person_name)                                  AS display_title,
        concat_ws(' · ', gobi.organization_name, gobi.government)               AS subtitle,
        concat_ws(' ', gobi.person_name, gobi.position_type,
                  gobi.organization_name, gobi.political_party, gobi.government) AS body,
        concat_ws(' · ', gobi.position_type, gobi.political_party)              AS key_fact,
        '/ministerios/' || gobi.id::text                                        AS route,
        gobi.source_url, gobi.start_date,
        jsonb_build_object('organization', gobi.organization_name,
                           'government', gobi.government,
                           'party', gobi.political_party,
                           'politician_id', gobi.politician_id,
                           'official_name', gobi.person_name)                   AS metadata
      FROM v_gobierno_actual gobi
      WHERE gobi.person_name IS NOT NULL AND trim(gobi.person_name) <> ''
    )
    SELECT 'government_position', entity_id, title, display_title, subtitle, body, key_fact,
           route, source_url, start_date, NULL::numeric, 8, metadata,
           _search_doc_vector(title, display_title, subtitle, key_fact, body),
           'v3', now()
    FROM src;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- institution ----------
  IF p_entity_type IS NULL OR p_entity_type = 'institution' THEN
    DELETE FROM search_documents WHERE entity_type = 'institution';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    WITH src AS (
      SELECT
        m.id::text                                                               AS entity_id,
        m.person_name                                                            AS title,
        _search_display_name(m.person_name)                                      AS display_title,
        concat_ws(' · ', m.institution, m.position_title)                       AS subtitle,
        concat_ws(' ', m.person_name, m.institution, m.position_title,
                  m.nominating_body, m.political_party)                         AS body,
        coalesce(m.nominating_body, m.political_party)                          AS key_fact,
        '/instituciones/' || m.id::text                                         AS route,
        m.source_url, m.appointment_date,
        jsonb_build_object('institution', m.institution, 'position', m.position_title,
                           'politician_id', m.politician_id,
                           'official_name', m.person_name)                      AS metadata
      FROM v_instituciones_actuales m
      WHERE m.person_name IS NOT NULL AND trim(m.person_name) <> ''
    )
    SELECT 'institution', entity_id, title, display_title, subtitle, body, key_fact,
           route, source_url, appointment_date, NULL::numeric, 7, metadata,
           _search_doc_vector(title, display_title, subtitle, key_fact, body),
           'v3', now()
    FROM src;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- organization ----------
  IF p_entity_type IS NULL OR p_entity_type = 'organization' THEN
    DELETE FROM search_documents WHERE entity_type = 'organization';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    SELECT
      'organization', o.id::text, o.name, NULL,
      o.sector,
      concat_ws(' ', o.name, o.organization_type, o.sector, o.country),
      nullif(concat_ws(' · ', o.organization_type, o.sector), ''),
      '/organizaciones/' || o.id::text, NULL::text, NULL::date, NULL::numeric, 7,
      jsonb_build_object('type', o.organization_type, 'sector', o.sector),
      _search_doc_vector(o.name, NULL, o.sector,
                         nullif(concat_ws(' · ', o.organization_type, o.sector), ''),
                         concat_ws(' ', o.name, o.organization_type, o.sector, o.country)),
      'v3', now()
    FROM organizations o
    WHERE o.name IS NOT NULL AND trim(o.name) <> '';
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- voting_session ----------
  IF p_entity_type IS NULL OR p_entity_type = 'voting_session' THEN
    DELETE FROM search_documents WHERE entity_type = 'voting_session';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    WITH divergence_counts AS (
      SELECT d.initiative, d.date, count(*) AS divergence_count
      FROM vote_divergences_cache d GROUP BY d.initiative, d.date
    )
    SELECT
      'voting_session', vs.id::text, vs.title,
      NULL,
      coalesce(to_char(vs.date, 'DD/MM/YYYY'), ''),
      concat_ws(' ', vs.title, vs.initiative_number, vs.initiative_type,
                'votacion votación divergencias grupo votos'),
      concat_ws(' · ', 'Sesión ' || vs.session_number::text, vs.initiative_number,
                dc.divergence_count::text || ' divergencias'),
      '/votaciones/' || vs.id::text, NULL::text, vs.date, NULL::numeric, 8,
      jsonb_build_object('session_number', vs.session_number,
                         'initiative_number', vs.initiative_number,
                         'divergence_count', dc.divergence_count),
      _search_doc_vector(
        vs.title,
        NULL,
        coalesce(to_char(vs.date, 'DD/MM/YYYY'), ''),
        concat_ws(' · ', 'Sesión ' || vs.session_number::text, vs.initiative_number,
                  dc.divergence_count::text || ' divergencias'),
        concat_ws(' ', vs.title, vs.initiative_number, vs.initiative_type,
                  'votacion votación divergencias grupo votos')
      ),
      'v3', now()
    FROM voting_sessions vs
    LEFT JOIN divergence_counts dc ON dc.initiative = vs.title AND dc.date = vs.date
    WHERE vs.title IS NOT NULL AND trim(vs.title) <> '';
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- vote_divergence ----------
  IF p_entity_type IS NULL OR p_entity_type = 'vote_divergence' THEN
    DELETE FROM search_documents WHERE entity_type = 'vote_divergence';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    WITH src AS (
      SELECT
        md5(d.full_name || '|' || d.initiative || '|' || d.date::text)       AS entity_id,
        d.full_name                                                            AS title,
        _search_display_name(d.full_name)                                     AS display_title,
        concat_ws(' · ', d.acronym, d.date::text)                            AS subtitle,
        concat_ws(' ', d.full_name, d.acronym, d.initiative, d.voted,
                  d.party_voted, 'voto distinto grupo divergencia votacion votación') AS body,
        concat_ws(' · ', 'Votó ' || d.voted, 'Grupo: ' || d.party_voted)    AS key_fact,
        coalesce('/votaciones/' || vs.id::text, '/diputados/' || p.id::text) AS route,
        d.date,
        jsonb_build_object('party', d.acronym, 'voted', d.voted,
                           'party_voted', d.party_voted, 'initiative', d.initiative,
                           'politician_id', p.id, 'voting_session_id', vs.id,
                           'official_name', d.full_name)                      AS metadata
      FROM vote_divergences_cache d
      LEFT JOIN politicians p ON p.full_name = d.full_name
      LEFT JOIN voting_sessions vs ON vs.title = d.initiative AND vs.date = d.date
      WHERE (vs.id IS NOT NULL OR p.id IS NOT NULL)
    )
    SELECT 'vote_divergence', entity_id, title, display_title, subtitle, body, key_fact,
           route, NULL::text, date, NULL::numeric, 6, metadata,
           _search_doc_vector(title, display_title, subtitle, key_fact, body),
           'v3', now()
    FROM src
    WHERE title IS NOT NULL AND trim(title) <> '' AND route IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- contract ----------
  IF p_entity_type IS NULL OR p_entity_type = 'contract' THEN
    DELETE FROM search_documents WHERE entity_type = 'contract';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    SELECT
      'contract', c.id::text,
      coalesce(c.title, c.contract_folder_id, 'Contrato'),
      NULL,
      coalesce(c.awarding_body_normalized, c.awarding_body, c.contractor),
      concat_ws(' ', c.title, c.description, c.awarding_body,
                c.awarding_body_normalized, c.contractor, c.contract_type, c.cpv_code, c.region),
      concat_ws(' · ', c.contractor,
                to_char(c.amount, 'FM999G999G999G990D00') || ' EUR'),
      '/contratos/' || c.id::text, c.source_url, c.date, c.amount, 9,
      jsonb_build_object('awarding_body', coalesce(c.awarding_body_normalized, c.awarding_body),
                         'contractor', c.contractor, 'status', c.status),
      _search_doc_vector(
        coalesce(c.title, c.contract_folder_id, 'Contrato'),
        NULL,
        coalesce(c.awarding_body_normalized, c.awarding_body, c.contractor),
        concat_ws(' · ', c.contractor, to_char(c.amount, 'FM999G999G999G990D00') || ' EUR'),
        concat_ws(' ', c.title, c.description, c.awarding_body,
                  c.awarding_body_normalized, c.contractor, c.contract_type, c.cpv_code, c.region)
      ),
      'v3', now()
    FROM contracts c
    WHERE coalesce(c.title, c.contract_folder_id, 'Contrato') IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- subsidy ----------
  IF p_entity_type IS NULL OR p_entity_type = 'subsidy' THEN
    DELETE FROM search_documents WHERE entity_type = 'subsidy';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    SELECT
      'subsidy', s.id::text,
      coalesce(s.beneficiario, s.convocatoria, 'Subvención BDNS ' || s.bdns_id::text),
      NULL,
      coalesce(s.nivel3, s.nivel2, s.nivel1),
      concat_ws(' ', s.beneficiario, s.convocatoria, s.numero_convocatoria,
                s.instrumento, s.nivel1, s.nivel2, s.nivel3),
      concat_ws(' · ', s.instrumento,
                to_char(s.importe, 'FM999G999G999G990D00') || ' EUR'),
      '/subvenciones/' || s.id::text, s.source_url, s.fecha_concesion, s.importe, 9,
      jsonb_build_object('bdns_id', s.bdns_id, 'granting_body', s.nivel3,
                         'territory', s.nivel2),
      _search_doc_vector(
        coalesce(s.beneficiario, s.convocatoria, 'Subvención BDNS ' || s.bdns_id::text),
        NULL,
        coalesce(s.nivel3, s.nivel2, s.nivel1),
        concat_ws(' · ', s.instrumento, to_char(s.importe, 'FM999G999G999G990D00') || ' EUR'),
        concat_ws(' ', s.beneficiario, s.convocatoria, s.numero_convocatoria,
                  s.instrumento, s.nivel1, s.nivel2, s.nivel3)
      ),
      'v3', now()
    FROM subsidies s;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- initiative ----------
  IF p_entity_type IS NULL OR p_entity_type = 'initiative' THEN
    DELETE FROM search_documents WHERE entity_type = 'initiative';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    SELECT
      'initiative', i.id::text,
      coalesce(i.title, i.number, 'Iniciativa'),
      NULL,
      coalesce(i.proposer_group, i.type, i.status),
      concat_ws(' ', i.title, i.number, i.type, i.proposer_group,
                i.status, i.origin_type, i.eu_directive_ref),
      concat_ws(' · ', i.type, i.proposer_group, i.status),
      '/iniciativas/' || i.id::text, i.source_url, i.created_at::date, NULL::numeric, 8,
      jsonb_build_object('number', i.number, 'origin_type', i.origin_type,
                         'eu_directive_ref', i.eu_directive_ref),
      _search_doc_vector(
        coalesce(i.title, i.number, 'Iniciativa'),
        NULL,
        coalesce(i.proposer_group, i.type, i.status),
        concat_ws(' · ', i.type, i.proposer_group, i.status),
        concat_ws(' ', i.title, i.number, i.type, i.proposer_group,
                  i.status, i.origin_type, i.eu_directive_ref)
      ),
      'v3', now()
    FROM initiatives i
    WHERE coalesce(i.title, i.number, 'Iniciativa') IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- budget ----------
  IF p_entity_type IS NULL OR p_entity_type = 'budget' THEN
    DELETE FROM search_documents WHERE entity_type = 'budget';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    SELECT
      'budget',
      bs.year::text || ':' || bs.section_code,
      coalesce(bs.section_name, bs.ministry_normalized, 'Presupuesto ' || bs.year::text),
      NULL,
      'Presupuesto ' || bs.year::text,
      concat_ws(' ', bs.year::text, bs.section_code, bs.section_name, bs.ministry_normalized),
      concat_ws(' · ', bs.program_count::text || ' programas',
                to_char(bs.total_credit_initial, 'FM999G999G999G990D00') || ' EUR'),
      '/presupuestos/' || bs.section_code, NULL::text, make_date(bs.year, 1, 1),
      bs.total_credit_initial, 7,
      jsonb_build_object('year', bs.year, 'section_code', bs.section_code,
                         'program_count', bs.program_count),
      _search_doc_vector(
        coalesce(bs.section_name, bs.ministry_normalized, 'Presupuesto ' || bs.year::text),
        NULL,
        'Presupuesto ' || bs.year::text,
        concat_ws(' · ', bs.program_count::text || ' programas',
                  to_char(bs.total_credit_initial, 'FM999G999G999G990D00') || ' EUR'),
        concat_ws(' ', bs.year::text, bs.section_code, bs.section_name, bs.ministry_normalized)
      ),
      'v3', now()
    FROM v_budget_summary bs
    WHERE coalesce(bs.section_name, bs.ministry_normalized, 'Presupuesto ' || bs.year::text) IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- budget_program ----------
  IF p_entity_type IS NULL OR p_entity_type = 'budget_program' THEN
    DELETE FROM search_documents WHERE entity_type = 'budget_program';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    SELECT
      'budget_program',
      bp.year::text || ':' || bp.section_code || ':' || bp.program_code,
      coalesce(bp.program_name, bp.program_code),
      NULL,
      concat_ws(' · ', bp.section_name, bp.year::text),
      concat_ws(' ', bp.year::text, bp.section_code, bp.section_name,
                bp.program_code, bp.program_name, bp.ministry_normalized),
      to_char(bp.total_credit_initial, 'FM999G999G999G990D00') || ' EUR',
      '/presupuestos/' || bp.section_code || '/' || bp.program_code,
      NULL::text, make_date(bp.year, 1, 1), bp.total_credit_initial, 6,
      jsonb_build_object('year', bp.year, 'section_code', bp.section_code,
                         'program_code', bp.program_code),
      _search_doc_vector(
        coalesce(bp.program_name, bp.program_code),
        NULL,
        concat_ws(' · ', bp.section_name, bp.year::text),
        to_char(bp.total_credit_initial, 'FM999G999G999G990D00') || ' EUR',
        concat_ws(' ', bp.year::text, bp.section_code, bp.section_name,
                  bp.program_code, bp.program_name, bp.ministry_normalized)
      ),
      'v3', now()
    FROM v_budget_by_program bp
    WHERE coalesce(bp.program_name, bp.program_code) IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- indicator ----------
  IF p_entity_type IS NULL OR p_entity_type = 'indicator' THEN
    DELETE FROM search_documents WHERE entity_type = 'indicator';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    SELECT
      'indicator', ei.indicator_code, ei.indicator_name, NULL, ei.indicator_code,
      concat_ws(' ', ei.indicator_code, ei.indicator_name, ei.unit),
      concat_ws(' · ', ei.period, ei.value::text, ei.unit),
      '/indicadores/' || ei.indicator_code, NULL::text, NULL::date, NULL::numeric, 7,
      jsonb_build_object('code', ei.indicator_code, 'unit', ei.unit),
      _search_doc_vector(
        ei.indicator_name, NULL, ei.indicator_code,
        concat_ws(' · ', ei.period, ei.value::text, ei.unit),
        concat_ws(' ', ei.indicator_code, ei.indicator_name, ei.unit)
      ),
      'v3', now()
    FROM (
      SELECT DISTINCT ON (indicator_code) indicator_code, indicator_name, period, value, unit
      FROM economic_indicators ORDER BY indicator_code, period DESC
    ) ei
    WHERE ei.indicator_name IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- eu_fund ----------
  IF p_entity_type IS NULL OR p_entity_type = 'eu_fund' THEN
    DELETE FROM search_documents WHERE entity_type = 'eu_fund';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    SELECT
      'eu_fund', ef.id, ef.label, NULL, 'Fondos UE',
      concat_ws(' ', ef.label, ef.wikidata_link, ef.country_code),
      concat_ws(' · ', coalesce(ef.number_projects::text || ' proyectos', NULL),
                to_char(ef.eu_budget, 'FM999G999G999G990D00') || ' EUR'),
      '/fondos-ue/' || regexp_replace(ef.id, '^.*/', ''),
      ef.wikidata_link, NULL::date, ef.eu_budget, 6,
      jsonb_build_object('total_budget', ef.total_budget, 'cofinancing_rate', ef.cofinancing_rate),
      _search_doc_vector(
        ef.label, NULL, 'Fondos UE',
        concat_ws(' · ', coalesce(ef.number_projects::text || ' proyectos', NULL),
                  to_char(ef.eu_budget, 'FM999G999G999G990D00') || ' EUR'),
        concat_ws(' ', ef.label, ef.wikidata_link, ef.country_code)
      ),
      'v3', now()
    FROM eu_funds ef
    WHERE ef.label IS NOT NULL AND trim(ef.label) <> '';
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- revolving_door ----------
  IF p_entity_type IS NULL OR p_entity_type = 'revolving_door' THEN
    DELETE FROM search_documents WHERE entity_type = 'revolving_door';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    WITH src AS (
      SELECT
        rd.id::text                                                              AS entity_id,
        rd.person_name                                                           AS title,
        _search_display_name(rd.person_name)                                     AS display_title,
        concat_ws(' → ', rd.public_role, rd.private_organization)               AS subtitle,
        concat_ws(' ', rd.person_name, rd.public_role, rd.private_organization,
                  rd.sector, rd.verification_status)                             AS body,
        concat_ws(' · ', rd.public_role, rd.private_organization)               AS key_fact,
        '/puertas-giratorias/' || rd.id::text                                   AS route,
        rd.source_url, rd.private_start_date,
        jsonb_build_object('sector', rd.sector, 'verification_status', rd.verification_status,
                           'official_name', rd.person_name)                     AS metadata
      FROM revolving_door rd
      WHERE rd.person_name IS NOT NULL AND trim(rd.person_name) <> ''
    )
    SELECT 'revolving_door', entity_id, title, display_title, subtitle, body, key_fact,
           route, source_url, private_start_date, NULL::numeric, 7, metadata,
           _search_doc_vector(title, display_title, subtitle, key_fact, body),
           'v3', now()
    FROM src;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  ---------- source_document ----------
  IF p_entity_type IS NULL OR p_entity_type = 'source_document' THEN
    DELETE FROM search_documents WHERE entity_type = 'source_document';
    INSERT INTO search_documents (
      entity_type, entity_id, title, display_title, subtitle, body, key_fact,
      route, source_url, document_date, amount, weight, metadata, search_vector,
      corpus_version, updated_at)
    SELECT
      'source_document', sd.id::text,
      coalesce(sd.title, sd.source_url), NULL,
      sd.source_type,
      concat_ws(' ', sd.title, sd.source_url, sd.source_type),
      sd.source_type,
      sd.source_url, sd.source_url, sd.published_date, NULL::numeric, 4,
      sd.metadata,
      _search_doc_vector(
        coalesce(sd.title, sd.source_url), NULL,
        sd.source_type, sd.source_type,
        concat_ws(' ', sd.title, sd.source_url, sd.source_type)
      ),
      'v3', now()
    FROM source_documents sd
    WHERE coalesce(sd.title, sd.source_url) IS NOT NULL
      AND trim(coalesce(sd.title, sd.source_url)) <> ''
      AND sd.source_url IS NOT NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_total := v_total + v_n;
  END IF;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public._search_doc_vector(text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_search_documents(text) TO service_role;
