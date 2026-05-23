-- Phase B.5: judicial accountability foundation.
-- Public surfaces must read only reviewed actor/link rows.

CREATE TABLE IF NOT EXISTS corruption_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (
    source_type IN ('cgpj', 'cendoj', 'boe', 'court_press', 'institutional_release')
  ),
  source_name text NOT NULL,
  external_id text,
  title text NOT NULL,
  court_body text,
  territory text,
  offence_category text,
  procedural_status text NOT NULL DEFAULT 'desconocido' CHECK (
    procedural_status IN (
      'procesamiento_o_juicio_oral',
      'condena_no_firme',
      'condena_firme',
      'absuelto',
      'sobreseido',
      'desconocido'
    )
  ),
  procedure_type text,
  summary text,
  source_url text NOT NULL,
  source_published_at date,
  last_verified_at date NOT NULL DEFAULT CURRENT_DATE,
  raw_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS corruption_cases_source_external_idx
  ON corruption_cases (source_type, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS corruption_cases_status_date_idx
  ON corruption_cases (procedural_status, source_published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS corruption_cases_title_btree_idx
  ON corruption_cases (title text_pattern_ops);

CREATE TABLE IF NOT EXISTS corruption_case_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES corruption_cases(id) ON DELETE CASCADE,
  actor_type text NOT NULL DEFAULT 'unknown' CHECK (actor_type IN ('person', 'organization', 'unknown')),
  actor_label text NOT NULL,
  role text,
  politician_id uuid REFERENCES politicians(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  match_confidence numeric(3,2),
  match_method text,
  review_status text NOT NULL DEFAULT 'needs_review' CHECK (
    review_status IN ('candidate', 'needs_review', 'reviewed', 'rejected')
  ),
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  evidence_url text,
  raw_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS corruption_case_actors_case_idx
  ON corruption_case_actors (case_id);

CREATE INDEX IF NOT EXISTS corruption_case_actors_org_review_idx
  ON corruption_case_actors (organization_id, review_status);

CREATE INDEX IF NOT EXISTS corruption_case_actors_politician_review_idx
  ON corruption_case_actors (politician_id, review_status);

CREATE INDEX IF NOT EXISTS corruption_case_actors_label_btree_idx
  ON corruption_case_actors (actor_label text_pattern_ops);

CREATE TABLE IF NOT EXISTS corruption_contract_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES corruption_cases(id) ON DELETE CASCADE,
  case_actor_id uuid REFERENCES corruption_case_actors(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  subsidy_id uuid REFERENCES subsidies(id) ON DELETE CASCADE,
  link_reason text NOT NULL,
  evidence_url text NOT NULL,
  review_status text NOT NULL DEFAULT 'needs_review' CHECK (
    review_status IN ('candidate', 'needs_review', 'reviewed', 'rejected')
  ),
  reviewed_at timestamptz,
  reviewed_by text,
  raw_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    organization_id IS NOT NULL
    OR contract_id IS NOT NULL
    OR subsidy_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS corruption_contract_links_case_idx
  ON corruption_contract_links (case_id);

CREATE INDEX IF NOT EXISTS corruption_contract_links_org_review_idx
  ON corruption_contract_links (organization_id, review_status);

CREATE INDEX IF NOT EXISTS corruption_contract_links_contract_review_idx
  ON corruption_contract_links (contract_id, review_status);

CREATE INDEX IF NOT EXISTS corruption_contract_links_subsidy_review_idx
  ON corruption_contract_links (subsidy_id, review_status);

ALTER TABLE corruption_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE corruption_case_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE corruption_contract_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read corruption cases" ON corruption_cases;
CREATE POLICY "Public read corruption cases"
  ON corruption_cases FOR SELECT USING (source_url IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated read corruption actors" ON corruption_case_actors;
CREATE POLICY "Authenticated read corruption actors"
  ON corruption_case_actors FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read corruption links" ON corruption_contract_links;
CREATE POLICY "Authenticated read corruption links"
  ON corruption_contract_links FOR SELECT TO authenticated USING (true);

GRANT SELECT ON corruption_cases TO anon, authenticated;
GRANT SELECT ON corruption_case_actors TO authenticated;
GRANT SELECT ON corruption_contract_links TO authenticated;

CREATE OR REPLACE VIEW v_corruption_cases_public AS
SELECT
  cc.id,
  cc.source_type,
  cc.source_name,
  cc.external_id,
  cc.title,
  cc.court_body,
  cc.territory,
  cc.offence_category,
  cc.procedural_status,
  cc.procedure_type,
  cc.summary,
  cc.source_url,
  cc.source_published_at,
  cc.last_verified_at,
  count(DISTINCT cca.id)::integer AS reviewed_actor_count,
  count(DISTINCT ccl.id)::integer AS reviewed_link_count
FROM corruption_cases cc
LEFT JOIN corruption_case_actors cca
  ON cca.case_id = cc.id
  AND cca.review_status = 'reviewed'
LEFT JOIN corruption_contract_links ccl
  ON ccl.case_id = cc.id
  AND ccl.review_status = 'reviewed'
WHERE cc.source_url IS NOT NULL
GROUP BY cc.id;

CREATE OR REPLACE VIEW v_corruption_case_actors_public AS
SELECT
  cca.id,
  cca.case_id,
  cc.title AS case_title,
  cc.procedural_status,
  cc.offence_category,
  cc.source_url AS case_source_url,
  cc.last_verified_at,
  cca.actor_type,
  cca.actor_label,
  cca.role,
  cca.politician_id,
  cca.organization_id,
  cca.evidence_url,
  cca.reviewed_at
FROM corruption_case_actors cca
JOIN corruption_cases cc ON cc.id = cca.case_id
WHERE cca.review_status = 'reviewed';

CREATE OR REPLACE VIEW v_corruption_contract_links_public AS
SELECT
  ccl.id,
  ccl.case_id,
  cc.title AS case_title,
  cc.procedural_status,
  cc.offence_category,
  cc.source_url AS case_source_url,
  cc.last_verified_at,
  ccl.case_actor_id,
  cca.actor_label,
  ccl.organization_id,
  ccl.contract_id,
  ccl.subsidy_id,
  ccl.link_reason,
  ccl.evidence_url,
  ccl.reviewed_at
FROM corruption_contract_links ccl
JOIN corruption_cases cc ON cc.id = ccl.case_id
LEFT JOIN corruption_case_actors cca ON cca.id = ccl.case_actor_id
WHERE ccl.review_status = 'reviewed'
  AND (cca.id IS NULL OR cca.review_status = 'reviewed');

GRANT SELECT ON v_corruption_cases_public TO anon, authenticated;
GRANT SELECT ON v_corruption_case_actors_public TO anon, authenticated;
GRANT SELECT ON v_corruption_contract_links_public TO anon, authenticated;

ALTER TABLE organization_counts
  ADD COLUMN IF NOT EXISTS judicial_case_count integer NOT NULL DEFAULT 0;

DROP VIEW IF EXISTS v_organization_public CASCADE;
CREATE OR REPLACE VIEW v_organization_public AS
SELECT
  o.id,
  o.name,
  o.organization_type,
  o.sector,
  o.country,
  o.source_url,
  coalesce(oc.contract_count, 0)::integer AS contract_count,
  coalesce(oc.subsidy_beneficiary_count, 0)::integer AS subsidy_beneficiary_count,
  coalesce(oc.subsidy_granting_count, 0)::integer AS subsidy_granting_count,
  coalesce(oc.revolving_door_count, 0)::integer AS revolving_door_count,
  coalesce(oc.eu_fund_count, 0)::integer AS eu_fund_count,
  coalesce(oc.judicial_case_count, 0)::integer AS judicial_case_count
FROM organizations o
LEFT JOIN organization_counts oc ON oc.id = o.id;

GRANT SELECT ON v_organization_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION refresh_judicial_search_documents()
RETURNS integer AS $$
DECLARE
  inserted_count integer;
BEGIN
  DELETE FROM search_documents WHERE entity_type = 'judicial_case';

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
    'judicial_case',
    c.id::text,
    c.title,
    NULL::text,
    concat_ws(' · ', c.procedural_status, c.court_body, c.territory),
    concat_ws(' ', c.title, c.summary, c.court_body, c.territory, c.offence_category, c.procedure_type, c.source_name),
    concat_ws(' · ', c.offence_category, c.source_name),
    '/corrupcion/' || c.id::text,
    c.source_url,
    c.source_published_at,
    NULL::numeric,
    6,
    jsonb_build_object(
      'source_type', c.source_type,
      'procedural_status', c.procedural_status,
      'last_verified_at', c.last_verified_at
    ),
    setweight(to_tsvector('simple', unaccent(coalesce(c.title, ''))), 'A') ||
      setweight(to_tsvector('simple', unaccent(coalesce(c.offence_category, ''))), 'B') ||
      setweight(to_tsvector('spanish', unaccent(coalesce(c.offence_category, ''))), 'B') ||
      setweight(to_tsvector('simple', unaccent(coalesce(c.summary, ''))), 'C') ||
      setweight(to_tsvector('spanish', unaccent(coalesce(c.summary, ''))), 'C'),
    'judicial-v1',
    now()
  FROM v_corruption_cases_public c;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION refresh_judicial_search_documents() TO authenticated;

SELECT refresh_judicial_search_documents();
