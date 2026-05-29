-- Add optional entity-type filter to refresh_search_documents so it can be called
-- per entity type from Python instead of one monolithic 30-min query.
-- When p_entity_type IS NULL the function behaves as before (full refresh).

CREATE OR REPLACE FUNCTION public.refresh_search_documents(
  p_entity_type text DEFAULT NULL
)
  RETURNS integer
  LANGUAGE plpgsql
AS $function$
DECLARE
  inserted_count integer;
BEGIN
  INSERT INTO search_documents (
    entity_type,
    entity_id,
    title,
    display_title,
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
    src.display_title,
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
      CASE WHEN src.display_title IS NOT NULL AND src.display_title <> src.title THEN
        setweight(to_tsvector('simple', unaccent(src.display_title)), 'A')
      ELSE ''::tsvector END ||
      setweight(to_tsvector('simple', unaccent(coalesce(src.subtitle, ''))), 'B') ||
      setweight(to_tsvector('spanish', unaccent(coalesce(src.subtitle, ''))), 'B') ||
      setweight(to_tsvector('simple', unaccent(coalesce(src.key_fact, ''))), 'B') ||
      setweight(to_tsvector('spanish', unaccent(coalesce(src.key_fact, ''))), 'B') ||
      setweight(to_tsvector('simple', unaccent(coalesce(src.body, ''))), 'C') ||
      setweight(to_tsvector('spanish', unaccent(coalesce(src.body, ''))), 'C'),
    'v3',
    now()
  FROM (
    SELECT DISTINCT ON (enriched.entity_type, enriched.entity_id)
      enriched.entity_type,
      enriched.entity_id,
      enriched.title,
      enriched.display_title,
      enriched.subtitle,
      enriched.body,
      enriched.key_fact,
      enriched.route,
      enriched.source_url,
      enriched.document_date,
      enriched.amount,
      enriched.weight,
      enriched.metadata
    FROM (
      SELECT
        all_src.entity_type,
        all_src.entity_id,
        all_src.title,
        CASE
          WHEN all_src.entity_type IN ('politician', 'senator', 'government_position', 'institution', 'revolving_door', 'vote_divergence') THEN _search_display_name(all_src.title)
          ELSE NULL
        END AS display_title,
        all_src.subtitle,
        all_src.body,
        all_src.key_fact,
        all_src.route,
        all_src.source_url,
        all_src.document_date,
        all_src.amount,
        all_src.weight,
        CASE
          WHEN all_src.entity_type IN ('politician', 'senator', 'government_position', 'institution', 'revolving_door', 'vote_divergence') THEN
            all_src.metadata || jsonb_build_object('official_name', all_src.title)
          ELSE all_src.metadata
        END AS metadata
      FROM (
      WITH divergence_counts AS (
        SELECT d.initiative, d.date, count(*) AS divergence_count
        FROM vote_divergences_cache d
        GROUP BY d.initiative, d.date
      )
    SELECT CASE WHEN pm.chamber = 'senate' THEN 'senator' ELSE 'politician' END AS entity_type,
      p.id::text AS entity_id, p.full_name AS title,
      coalesce(par.acronym, pm.group_parliamentary, 'Sin partido') AS subtitle,
      concat_ws(' ', p.full_name, pm.constituency, pm.group_parliamentary, par.name, par.acronym) AS body,
      nullif(concat_ws(' · ', pm.constituency, par.acronym), '') AS key_fact,
      '/diputados/' || p.id::text AS route, p.website AS source_url, pm.start_date AS document_date,
      NULL::numeric AS amount, 10 AS weight,
      jsonb_build_object('party', par.acronym, 'constituency', pm.constituency, 'chamber', pm.chamber) AS metadata
    FROM politicians p JOIN politician_memberships pm ON pm.politician_id = p.id AND pm.is_active = true
    LEFT JOIN parties par ON par.id = pm.party_id
    WHERE p_entity_type IS NULL OR p_entity_type IN ('politician','senator')

    UNION ALL
    SELECT 'party', par.id::text, coalesce(par.acronym, par.name), par.name,
      concat_ws(' ', par.name, par.acronym), par.name, '/partidos/' || par.id::text,
      coalesce(par.website, par.wikipedia_url), NULL::date, NULL::numeric, 8,
      jsonb_build_object('acronym', par.acronym, 'color', par.color)
    FROM parties par WHERE p_entity_type IS NULL OR p_entity_type = 'party'

    UNION ALL
    SELECT 'government_position', gobi.id::text, gobi.person_name,
      concat_ws(' · ', gobi.organization_name, gobi.government),
      concat_ws(' ', gobi.person_name, gobi.position_type, gobi.organization_name, gobi.political_party, gobi.government),
      concat_ws(' · ', gobi.position_type, gobi.political_party),
      '/ministerios/' || gobi.id::text, gobi.source_url, gobi.start_date, NULL::numeric, 8,
      jsonb_build_object('organization', gobi.organization_name, 'government', gobi.government, 'party', gobi.political_party, 'politician_id', gobi.politician_id)
    FROM v_gobierno_actual gobi WHERE p_entity_type IS NULL OR p_entity_type = 'government_position'

    UNION ALL
    SELECT 'institution', m.id::text, m.person_name,
      concat_ws(' · ', m.institution, m.position_title),
      concat_ws(' ', m.person_name, m.institution, m.position_title, m.nominating_body, m.political_party),
      coalesce(m.nominating_body, m.political_party), '/instituciones/' || m.id::text,
      m.source_url, m.appointment_date, NULL::numeric, 7,
      jsonb_build_object('institution', m.institution, 'position', m.position_title, 'politician_id', m.politician_id)
    FROM v_instituciones_actuales m WHERE p_entity_type IS NULL OR p_entity_type = 'institution'

    UNION ALL
    SELECT 'organization', o.id::text, o.name, o.sector,
      concat_ws(' ', o.name, o.organization_type, o.sector, o.country),
      nullif(concat_ws(' · ', o.organization_type, o.sector), ''),
      '/organizaciones/' || o.id::text, NULL::text, NULL::date, NULL::numeric, 7,
      jsonb_build_object('type', o.organization_type, 'sector', o.sector)
    FROM organizations o WHERE p_entity_type IS NULL OR p_entity_type = 'organization'

    UNION ALL
    SELECT 'voting_session', vs.id::text, vs.title, coalesce(to_char(vs.date, 'DD/MM/YYYY'), ''),
      concat_ws(' ', vs.title, vs.initiative_number, vs.initiative_type, 'votacion votación divergencias grupo votos'),
      concat_ws(' · ', 'Sesión ' || vs.session_number::text, vs.initiative_number, dc.divergence_count::text || ' divergencias'),
      '/votaciones/' || vs.id::text, NULL::text, vs.date, NULL::numeric, 8,
      jsonb_build_object('session_number', vs.session_number, 'initiative_number', vs.initiative_number, 'divergence_count', dc.divergence_count)
    FROM voting_sessions vs LEFT JOIN divergence_counts dc ON dc.initiative = vs.title AND dc.date = vs.date
    WHERE p_entity_type IS NULL OR p_entity_type = 'voting_session'

    UNION ALL
    SELECT 'vote_divergence', md5(d.full_name || '|' || d.initiative || '|' || d.date::text),
      d.full_name, concat_ws(' · ', d.acronym, d.date::text),
      concat_ws(' ', d.full_name, d.acronym, d.initiative, d.voted, d.party_voted, 'voto distinto grupo divergencia votacion votación'),
      concat_ws(' · ', 'Votó ' || d.voted, 'Grupo: ' || d.party_voted),
      coalesce('/votaciones/' || vs.id::text, '/diputados/' || p.id::text),
      NULL::text, d.date, NULL::numeric, 6,
      jsonb_build_object('party', d.acronym, 'voted', d.voted, 'party_voted', d.party_voted, 'initiative', d.initiative, 'politician_id', p.id, 'voting_session_id', vs.id)
    FROM vote_divergences_cache d
    LEFT JOIN politicians p ON p.full_name = d.full_name
    LEFT JOIN voting_sessions vs ON vs.title = d.initiative AND vs.date = d.date
    WHERE (vs.id IS NOT NULL OR p.id IS NOT NULL) AND (p_entity_type IS NULL OR p_entity_type = 'vote_divergence')

    UNION ALL
    SELECT 'contract', c.id::text, coalesce(c.title, c.contract_folder_id, 'Contrato'),
      coalesce(c.awarding_body_normalized, c.awarding_body, c.contractor),
      concat_ws(' ', c.title, c.description, c.awarding_body, c.awarding_body_normalized, c.contractor, c.contract_type, c.cpv_code, c.region),
      concat_ws(' · ', c.contractor, to_char(c.amount, 'FM999G999G999G990D00') || ' EUR'),
      '/contratos/' || c.id::text, c.source_url, c.date, c.amount, 9,
      jsonb_build_object('awarding_body', coalesce(c.awarding_body_normalized, c.awarding_body), 'contractor', c.contractor, 'status', c.status)
    FROM contracts c WHERE p_entity_type IS NULL OR p_entity_type = 'contract'

    UNION ALL
    SELECT 'subsidy', s.id::text,
      coalesce(s.beneficiario, s.convocatoria, 'Subvención BDNS ' || s.bdns_id::text),
      coalesce(s.nivel3, s.nivel2, s.nivel1),
      concat_ws(' ', s.beneficiario, s.convocatoria, s.numero_convocatoria, s.instrumento, s.nivel1, s.nivel2, s.nivel3),
      concat_ws(' · ', s.instrumento, to_char(s.importe, 'FM999G999G999G990D00') || ' EUR'),
      '/subvenciones/' || s.id::text, s.source_url, s.fecha_concesion, s.importe, 9,
      jsonb_build_object('bdns_id', s.bdns_id, 'granting_body', s.nivel3, 'territory', s.nivel2)
    FROM subsidies s WHERE p_entity_type IS NULL OR p_entity_type = 'subsidy'

    UNION ALL
    SELECT 'initiative', i.id::text, coalesce(i.title, i.number, 'Iniciativa'),
      coalesce(i.proposer_group, i.type, i.status),
      concat_ws(' ', i.title, i.number, i.type, i.proposer_group, i.status, i.origin_type, i.eu_directive_ref),
      concat_ws(' · ', i.type, i.proposer_group, i.status),
      '/iniciativas/' || i.id::text, i.source_url, i.created_at::date, NULL::numeric, 8,
      jsonb_build_object('number', i.number, 'origin_type', i.origin_type, 'eu_directive_ref', i.eu_directive_ref)
    FROM initiatives i WHERE p_entity_type IS NULL OR p_entity_type = 'initiative'

    UNION ALL
    SELECT 'budget', bs.year::text || ':' || bs.section_code,
      coalesce(bs.section_name, bs.ministry_normalized, 'Presupuesto ' || bs.year::text),
      'Presupuesto ' || bs.year::text,
      concat_ws(' ', bs.year::text, bs.section_code, bs.section_name, bs.ministry_normalized),
      concat_ws(' · ', bs.program_count::text || ' programas', to_char(bs.total_credit_initial, 'FM999G999G999G990D00') || ' EUR'),
      '/presupuestos/' || bs.section_code, NULL::text, make_date(bs.year, 1, 1), bs.total_credit_initial, 7,
      jsonb_build_object('year', bs.year, 'section_code', bs.section_code, 'program_count', bs.program_count)
    FROM v_budget_summary bs WHERE p_entity_type IS NULL OR p_entity_type = 'budget'

    UNION ALL
    SELECT 'budget_program', bp.year::text || ':' || bp.section_code || ':' || bp.program_code,
      coalesce(bp.program_name, bp.program_code), concat_ws(' · ', bp.section_name, bp.year::text),
      concat_ws(' ', bp.year::text, bp.section_code, bp.section_name, bp.program_code, bp.program_name, bp.ministry_normalized),
      to_char(bp.total_credit_initial, 'FM999G999G999G990D00') || ' EUR',
      '/presupuestos/' || bp.section_code || '/' || bp.program_code, NULL::text,
      make_date(bp.year, 1, 1), bp.total_credit_initial, 6,
      jsonb_build_object('year', bp.year, 'section_code', bp.section_code, 'program_code', bp.program_code)
    FROM v_budget_by_program bp WHERE p_entity_type IS NULL OR p_entity_type = 'budget_program'

    UNION ALL
    SELECT 'indicator', ei.indicator_code, ei.indicator_name, ei.indicator_code,
      concat_ws(' ', ei.indicator_code, ei.indicator_name, ei.unit),
      concat_ws(' · ', ei.period, ei.value::text, ei.unit),
      '/indicadores/' || ei.indicator_code, NULL::text, NULL::date, NULL::numeric, 7,
      jsonb_build_object('code', ei.indicator_code, 'unit', ei.unit)
    FROM (SELECT DISTINCT ON (indicator_code) indicator_code, indicator_name, period, value, unit
          FROM economic_indicators ORDER BY indicator_code, period DESC) ei
    WHERE p_entity_type IS NULL OR p_entity_type = 'indicator'

    UNION ALL
    SELECT 'eu_fund', ef.id, ef.label, 'Fondos UE',
      concat_ws(' ', ef.label, ef.wikidata_link, ef.country_code),
      concat_ws(' · ', coalesce(ef.number_projects::text || ' proyectos', NULL), to_char(ef.eu_budget, 'FM999G999G999G990D00') || ' EUR'),
      '/fondos-ue/' || regexp_replace(ef.id, '^.*/', ''), ef.wikidata_link,
      NULL::date, ef.eu_budget, 6,
      jsonb_build_object('total_budget', ef.total_budget, 'cofinancing_rate', ef.cofinancing_rate)
    FROM eu_funds ef WHERE p_entity_type IS NULL OR p_entity_type = 'eu_fund'

    UNION ALL
    SELECT 'revolving_door', rd.id::text, rd.person_name,
      concat_ws(' → ', rd.public_role, rd.private_organization),
      concat_ws(' ', rd.person_name, rd.public_role, rd.private_organization, rd.sector, rd.verification_status),
      concat_ws(' · ', rd.public_role, rd.private_organization),
      '/puertas-giratorias/' || rd.id::text, rd.source_url, rd.private_start_date, NULL::numeric, 7,
      jsonb_build_object('sector', rd.sector, 'verification_status', rd.verification_status)
    FROM revolving_door rd WHERE p_entity_type IS NULL OR p_entity_type = 'revolving_door'

    UNION ALL
    SELECT 'source_document', sd.id::text, coalesce(sd.title, sd.source_url), sd.source_type,
      concat_ws(' ', sd.title, sd.source_url, sd.source_type), sd.source_type,
      sd.source_url, sd.source_url, sd.published_date, NULL::numeric, 4, sd.metadata
    FROM source_documents sd WHERE p_entity_type IS NULL OR p_entity_type = 'source_document'

    ) all_src
    WHERE all_src.title IS NOT NULL
      AND trim(all_src.title) <> ''
      AND all_src.route IS NOT NULL
      AND trim(all_src.route) <> ''
    ) enriched
    WHERE enriched.title IS NOT NULL AND trim(enriched.title) <> ''
    ORDER BY enriched.entity_type, enriched.entity_id, enriched.weight DESC, enriched.document_date DESC NULLS LAST
  ) src
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    title = EXCLUDED.title,
    display_title = EXCLUDED.display_title,
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
$function$;
