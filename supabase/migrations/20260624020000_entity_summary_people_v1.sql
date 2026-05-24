-- Phase C v2: extend the unified entity summary to people.
-- Keeps organization totals from v1 and adds politician-level counters backed by
-- existing public datasets.

DROP MATERIALIZED VIEW IF EXISTS v_entity_summary;

CREATE MATERIALIZED VIEW v_entity_summary AS
WITH contract_awarding AS (
  SELECT
    awarding_body_organization_id AS organization_id,
    COUNT(*)::integer AS awarded_contract_count,
    COALESCE(SUM(amount), 0)::numeric AS awarded_contract_total,
    MAX(date) AS latest_contract_date
  FROM contracts
  WHERE awarding_body_organization_id IS NOT NULL
  GROUP BY awarding_body_organization_id
),
contract_contractor AS (
  SELECT
    contractor_organization_id AS organization_id,
    COUNT(*)::integer AS contractor_contract_count,
    COALESCE(SUM(amount), 0)::numeric AS contractor_contract_total,
    MAX(date) AS latest_contract_date
  FROM contracts
  WHERE contractor_organization_id IS NOT NULL
  GROUP BY contractor_organization_id
),
subsidy_beneficiary AS (
  SELECT
    beneficiary_organization_id AS organization_id,
    COUNT(*)::integer AS subsidy_received_count,
    COALESCE(SUM(importe), 0)::numeric AS subsidy_received_total,
    MAX(fecha_concesion) AS latest_subsidy_date
  FROM subsidies
  WHERE beneficiary_organization_id IS NOT NULL
  GROUP BY beneficiary_organization_id
),
subsidy_granting AS (
  SELECT
    granting_body_organization_id AS organization_id,
    COUNT(*)::integer AS subsidy_granted_count,
    COALESCE(SUM(importe), 0)::numeric AS subsidy_granted_total,
    MAX(fecha_concesion) AS latest_subsidy_date
  FROM subsidies
  WHERE granting_body_organization_id IS NOT NULL
  GROUP BY granting_body_organization_id
),
eu_fund_summary AS (
  SELECT
    beneficiary_organization_id AS organization_id,
    COUNT(*)::integer AS eu_fund_count,
    COALESCE(SUM(eu_budget), 0)::numeric AS eu_fund_total,
    MAX(updated_at)::date AS latest_eu_fund_date
  FROM eu_funds
  WHERE beneficiary_organization_id IS NOT NULL
  GROUP BY beneficiary_organization_id
),
revolving_summary AS (
  SELECT
    organization_id,
    COUNT(*)::integer AS revolving_door_count,
    MAX(private_start_date) AS latest_revolving_door_date
  FROM revolving_door
  WHERE organization_id IS NOT NULL
    AND verification_status = 'verified'
  GROUP BY organization_id
),
borme_summary AS (
  SELECT
    organization_id,
    COUNT(*)::integer AS borme_officer_count,
    MAX(since) AS latest_borme_date
  FROM borme_officers
  WHERE organization_id IS NOT NULL
    AND is_current = true
  GROUP BY organization_id
),
appointment_summary AS (
  SELECT
    o.id AS organization_id,
    COUNT(*)::integer AS institutional_appointment_count,
    MAX(ia.appointment_date) AS latest_appointment_date
  FROM organizations o
  JOIN institutional_appointments ia
    ON ia.institution LIKE 'SEPI-%'
   AND upper(unaccent(o.name)) LIKE '%' || replace(upper(unaccent(ia.institution)), 'SEPI-', '') || '%'
  GROUP BY o.id
),
judicial_summary AS (
  SELECT
    organization_id,
    COUNT(DISTINCT case_id)::integer AS judicial_case_count,
    MAX(last_verified_at) AS latest_judicial_date
  FROM v_corruption_case_actors_public
  WHERE organization_id IS NOT NULL
  GROUP BY organization_id
),
lobbying_summary AS (
  SELECT
    lol.organization_id,
    COUNT(DISTINCT lol.lobbying_group_id)::integer AS lobbying_group_count,
    MAX(lg.updated_at)::date AS latest_lobbying_date
  FROM lobbying_organization_links lol
  JOIN lobbying_groups lg ON lg.id = lol.lobbying_group_id
  WHERE lol.reviewed = true
  GROUP BY lol.organization_id
),
current_membership AS (
  SELECT DISTINCT ON (pm.politician_id)
    pm.politician_id,
    pm.chamber,
    pm.constituency,
    pm.group_parliamentary,
    pa.acronym AS party_acronym,
    pa.name AS party_name
  FROM politician_memberships pm
  LEFT JOIN parties pa ON pa.id = pm.party_id
  ORDER BY
    pm.politician_id,
    pm.is_active DESC,
    (pm.chamber = 'congress') DESC,
    pm.start_date DESC NULLS LAST,
    pm.created_at DESC
),
vote_summary AS (
  SELECT
    v.politician_id,
    COUNT(*)::integer AS vote_count,
    MAX(vs.date) AS latest_vote_date
  FROM votes v
  JOIN voting_sessions vs ON vs.id = v.voting_session_id
  GROUP BY v.politician_id
),
declaration_summary AS (
  SELECT
    politician_id,
    COUNT(*)::integer AS declaration_count,
    MAX(declaration_date) AS latest_declaration_date
  FROM economic_declarations
  GROUP BY politician_id
),
responsibility_summary AS (
  SELECT
    politician_id,
    COUNT(*)::integer AS responsibility_position_count,
    MAX(start_date) AS latest_responsibility_date
  FROM responsibility_positions
  WHERE politician_id IS NOT NULL
  GROUP BY politician_id
),
current_responsibility AS (
  SELECT DISTINCT ON (politician_id)
    politician_id,
    position_type AS current_role,
    organization_name AS current_organization,
    government AS current_government,
    source_url AS current_role_source_url
  FROM responsibility_positions
  WHERE politician_id IS NOT NULL
    AND end_date IS NULL
  ORDER BY
    politician_id,
    (administration_level = 'state') DESC,
    start_date DESC NULLS LAST
),
person_appointment_summary AS (
  SELECT
    politician_id,
    COUNT(*)::integer AS institutional_appointment_count,
    MAX(appointment_date) AS latest_appointment_date
  FROM institutional_appointments
  WHERE politician_id IS NOT NULL
  GROUP BY politician_id
),
person_revolving_summary AS (
  SELECT
    person_id AS politician_id,
    COUNT(*)::integer AS revolving_door_count,
    MAX(private_start_date) AS latest_revolving_door_date
  FROM v_revolving_door_public
  WHERE person_id IS NOT NULL
  GROUP BY person_id
),
person_judicial_summary AS (
  SELECT
    politician_id,
    COUNT(DISTINCT case_id)::integer AS judicial_case_count,
    MAX(last_verified_at) AS latest_judicial_date
  FROM v_corruption_case_actors_public
  WHERE politician_id IS NOT NULL
  GROUP BY politician_id
),
person_borme_summary AS (
  SELECT
    bpm.politician_id,
    COUNT(DISTINCT bo.id)::integer AS borme_match_count,
    MAX(bo.since) AS latest_borme_date
  FROM borme_politician_matches bpm
  JOIN borme_officers bo ON bo.id = bpm.borme_officer_id
  WHERE bpm.reviewed = true
  GROUP BY bpm.politician_id
)
SELECT
  'organization'::text AS entity_type,
  o.id AS entity_id,
  o.name,
  '/organizaciones/' || o.id::text AS route,
  nullif(concat_ws(' · ', o.organization_type, o.sector, o.country), '') AS subtitle,
  o.organization_type,
  o.sector,
  o.country,
  NULL::text AS party,
  NULL::text AS chamber,
  NULL::text AS constituency,
  NULL::text AS current_role,
  NULL::text AS current_organization,
  NULL::text AS current_government,
  o.source_url,
  COALESCE(ca.awarded_contract_count, 0)::integer AS awarded_contract_count,
  COALESCE(ca.awarded_contract_total, 0)::numeric AS awarded_contract_total,
  COALESCE(cc.contractor_contract_count, 0)::integer AS contractor_contract_count,
  COALESCE(cc.contractor_contract_total, 0)::numeric AS contractor_contract_total,
  (COALESCE(ca.awarded_contract_count, 0) + COALESCE(cc.contractor_contract_count, 0))::integer AS contract_count,
  (COALESCE(ca.awarded_contract_total, 0) + COALESCE(cc.contractor_contract_total, 0))::numeric AS contract_total,
  COALESCE(sb.subsidy_received_count, 0)::integer AS subsidy_received_count,
  COALESCE(sb.subsidy_received_total, 0)::numeric AS subsidy_received_total,
  COALESCE(sg.subsidy_granted_count, 0)::integer AS subsidy_granted_count,
  COALESCE(sg.subsidy_granted_total, 0)::numeric AS subsidy_granted_total,
  COALESCE(ef.eu_fund_count, 0)::integer AS eu_fund_count,
  COALESCE(ef.eu_fund_total, 0)::numeric AS eu_fund_total,
  COALESCE(rd.revolving_door_count, 0)::integer AS revolving_door_count,
  COALESCE(bo.borme_officer_count, 0)::integer AS borme_officer_count,
  COALESCE(ap.institutional_appointment_count, 0)::integer AS institutional_appointment_count,
  COALESCE(js.judicial_case_count, 0)::integer AS judicial_case_count,
  COALESCE(ls.lobbying_group_count, 0)::integer AS lobbying_group_count,
  0::integer AS vote_count,
  0::integer AS declaration_count,
  0::integer AS responsibility_position_count,
  0::integer AS borme_match_count,
  GREATEST(
    ca.latest_contract_date,
    cc.latest_contract_date,
    sb.latest_subsidy_date,
    sg.latest_subsidy_date,
    ef.latest_eu_fund_date,
    rd.latest_revolving_door_date,
    bo.latest_borme_date,
    ap.latest_appointment_date,
    js.latest_judicial_date,
    ls.latest_lobbying_date
  ) AS latest_record_date,
  now() AS updated_at
FROM organizations o
LEFT JOIN contract_awarding ca ON ca.organization_id = o.id
LEFT JOIN contract_contractor cc ON cc.organization_id = o.id
LEFT JOIN subsidy_beneficiary sb ON sb.organization_id = o.id
LEFT JOIN subsidy_granting sg ON sg.organization_id = o.id
LEFT JOIN eu_fund_summary ef ON ef.organization_id = o.id
LEFT JOIN revolving_summary rd ON rd.organization_id = o.id
LEFT JOIN borme_summary bo ON bo.organization_id = o.id
LEFT JOIN appointment_summary ap ON ap.organization_id = o.id
LEFT JOIN judicial_summary js ON js.organization_id = o.id
LEFT JOIN lobbying_summary ls ON ls.organization_id = o.id

UNION ALL

SELECT
  'politician'::text AS entity_type,
  p.id AS entity_id,
  p.full_name AS name,
  '/diputados/' || p.id::text AS route,
  nullif(concat_ws(' · ', cm.group_parliamentary, cm.constituency), '') AS subtitle,
  NULL::text AS organization_type,
  NULL::text AS sector,
  NULL::text AS country,
  COALESCE(cm.party_acronym, cm.party_name) AS party,
  cm.chamber,
  cm.constituency,
  cr.current_role,
  cr.current_organization,
  cr.current_government,
  COALESCE(cr.current_role_source_url, p.website) AS source_url,
  0::integer AS awarded_contract_count,
  0::numeric AS awarded_contract_total,
  0::integer AS contractor_contract_count,
  0::numeric AS contractor_contract_total,
  0::integer AS contract_count,
  0::numeric AS contract_total,
  0::integer AS subsidy_received_count,
  0::numeric AS subsidy_received_total,
  0::integer AS subsidy_granted_count,
  0::numeric AS subsidy_granted_total,
  0::integer AS eu_fund_count,
  0::numeric AS eu_fund_total,
  COALESCE(prs.revolving_door_count, 0)::integer AS revolving_door_count,
  0::integer AS borme_officer_count,
  COALESCE(pas.institutional_appointment_count, 0)::integer AS institutional_appointment_count,
  COALESCE(pjs.judicial_case_count, 0)::integer AS judicial_case_count,
  0::integer AS lobbying_group_count,
  COALESCE(vs.vote_count, 0)::integer AS vote_count,
  COALESCE(ds.declaration_count, 0)::integer AS declaration_count,
  COALESCE(rs.responsibility_position_count, 0)::integer AS responsibility_position_count,
  COALESCE(pbs.borme_match_count, 0)::integer AS borme_match_count,
  GREATEST(
    vs.latest_vote_date,
    ds.latest_declaration_date,
    rs.latest_responsibility_date,
    pas.latest_appointment_date,
    prs.latest_revolving_door_date,
    pjs.latest_judicial_date,
    pbs.latest_borme_date
  ) AS latest_record_date,
  now() AS updated_at
FROM politicians p
LEFT JOIN current_membership cm ON cm.politician_id = p.id
LEFT JOIN vote_summary vs ON vs.politician_id = p.id
LEFT JOIN declaration_summary ds ON ds.politician_id = p.id
LEFT JOIN responsibility_summary rs ON rs.politician_id = p.id
LEFT JOIN current_responsibility cr ON cr.politician_id = p.id
LEFT JOIN person_appointment_summary pas ON pas.politician_id = p.id
LEFT JOIN person_revolving_summary prs ON prs.politician_id = p.id
LEFT JOIN person_judicial_summary pjs ON pjs.politician_id = p.id
LEFT JOIN person_borme_summary pbs ON pbs.politician_id = p.id
WHERE cm.chamber = 'congress'
WITH DATA;

CREATE UNIQUE INDEX v_entity_summary_identity_idx
  ON v_entity_summary (entity_type, entity_id);

CREATE INDEX v_entity_summary_contract_total_idx
  ON v_entity_summary (contract_total DESC);

CREATE INDEX v_entity_summary_money_total_idx
  ON v_entity_summary ((contract_total + subsidy_received_total + eu_fund_total) DESC);

CREATE INDEX v_entity_summary_person_activity_idx
  ON v_entity_summary (
    (vote_count + declaration_count + responsibility_position_count + institutional_appointment_count + revolving_door_count + judicial_case_count + borme_match_count) DESC
  )
  WHERE entity_type = 'politician';

GRANT SELECT ON v_entity_summary TO anon, authenticated;

CREATE OR REPLACE FUNCTION refresh_entity_summary()
RETURNS integer AS $$
DECLARE
  row_count integer;
BEGIN
  REFRESH MATERIALIZED VIEW v_entity_summary;

  SELECT COUNT(*) INTO row_count FROM v_entity_summary;

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
    entity_type,
    entity_id::text,
    name,
    NULL::text,
    subtitle,
    CASE
      WHEN entity_type = 'organization' THEN concat_ws(
        ' ',
        name,
        organization_type,
        sector,
        country,
        contract_count::text || ' contratos',
        subsidy_received_count::text || ' subvenciones recibidas',
        subsidy_granted_count::text || ' subvenciones concedidas',
        eu_fund_count::text || ' fondos europeos',
        revolving_door_count::text || ' puertas giratorias',
        judicial_case_count::text || ' procesos judiciales',
        lobbying_group_count::text || ' grupos de interes'
      )
      ELSE concat_ws(
        ' ',
        name,
        subtitle,
        party,
        chamber,
        constituency,
        current_role,
        current_organization,
        vote_count::text || ' votos',
        declaration_count::text || ' declaraciones',
        responsibility_position_count::text || ' cargos',
        institutional_appointment_count::text || ' nombramientos',
        revolving_door_count::text || ' puertas giratorias',
        judicial_case_count::text || ' procesos judiciales',
        borme_match_count::text || ' cargos mercantiles'
      )
    END,
    CASE
      WHEN entity_type = 'organization' THEN concat_ws(
        ' · ',
        CASE WHEN contract_total > 0 THEN 'Contratos: ' || to_char(contract_total, 'FM999G999G999G990D00') || ' EUR' END,
        CASE WHEN subsidy_received_total > 0 THEN 'Subvenciones: ' || to_char(subsidy_received_total, 'FM999G999G999G990D00') || ' EUR' END,
        CASE WHEN eu_fund_total > 0 THEN 'Fondos UE: ' || to_char(eu_fund_total, 'FM999G999G999G990D00') || ' EUR' END
      )
      ELSE concat_ws(
        ' · ',
        CASE WHEN vote_count > 0 THEN vote_count::text || ' votos' END,
        CASE WHEN declaration_count > 0 THEN declaration_count::text || ' declaraciones' END,
        CASE WHEN revolving_door_count > 0 THEN revolving_door_count::text || ' puertas giratorias' END,
        CASE WHEN judicial_case_count > 0 THEN judicial_case_count::text || ' procesos judiciales' END
      )
    END,
    route,
    source_url,
    latest_record_date,
    CASE
      WHEN entity_type = 'organization' THEN NULLIF(contract_total + subsidy_received_total + eu_fund_total, 0)
      ELSE NULL
    END,
    CASE WHEN entity_type = 'organization' THEN 8 ELSE 7 END,
    CASE
      WHEN entity_type = 'organization' THEN jsonb_build_object(
        'organization_type', organization_type,
        'sector', sector,
        'contract_count', contract_count,
        'subsidy_received_count', subsidy_received_count,
        'eu_fund_count', eu_fund_count,
        'revolving_door_count', revolving_door_count,
        'judicial_case_count', judicial_case_count,
        'lobbying_group_count', lobbying_group_count
      )
      ELSE jsonb_build_object(
        'party', party,
        'chamber', chamber,
        'constituency', constituency,
        'current_role', current_role,
        'current_organization', current_organization,
        'vote_count', vote_count,
        'declaration_count', declaration_count,
        'responsibility_position_count', responsibility_position_count,
        'institutional_appointment_count', institutional_appointment_count,
        'revolving_door_count', revolving_door_count,
        'judicial_case_count', judicial_case_count,
        'borme_match_count', borme_match_count
      )
    END,
    setweight(to_tsvector('simple', unaccent(coalesce(name, ''))), 'A') ||
      setweight(to_tsvector('simple', unaccent(coalesce(subtitle, ''))), 'B') ||
      setweight(to_tsvector('spanish', unaccent(coalesce(subtitle, ''))), 'B') ||
      setweight(to_tsvector('simple', unaccent(coalesce(sector, ''))), 'C') ||
      setweight(to_tsvector('simple', unaccent(coalesce(party, ''))), 'C') ||
      setweight(to_tsvector('simple', unaccent(coalesce(current_organization, ''))), 'C'),
    'entity-summary-v2',
    now()
  FROM v_entity_summary
  WHERE entity_type IN ('organization', 'politician')
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

  RETURN row_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION refresh_entity_summary() TO authenticated;

SELECT refresh_entity_summary();
