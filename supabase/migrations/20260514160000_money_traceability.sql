CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS awarding_body_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE subsidies
  ADD COLUMN IF NOT EXISTS beneficiary_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS granting_body_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_awarding_body_organization_id_fkey'
  ) THEN
    ALTER TABLE contracts
      ADD CONSTRAINT contracts_awarding_body_organization_id_fkey
      FOREIGN KEY (awarding_body_organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subsidies_beneficiary_organization_id_fkey'
  ) THEN
    ALTER TABLE subsidies
      ADD CONSTRAINT subsidies_beneficiary_organization_id_fkey
      FOREIGN KEY (beneficiary_organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subsidies_granting_body_organization_id_fkey'
  ) THEN
    ALTER TABLE subsidies
      ADD CONSTRAINT subsidies_granting_body_organization_id_fkey
      FOREIGN KEY (granting_body_organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contracts_awarding_org ON contracts (awarding_body_organization_id);
CREATE INDEX IF NOT EXISTS idx_subsidies_beneficiary_org ON subsidies (beneficiary_organization_id);
CREATE INDEX IF NOT EXISTS idx_subsidies_granting_org ON subsidies (granting_body_organization_id);

CREATE OR REPLACE VIEW v_government_position_lookup
WITH (security_invoker = true) AS
SELECT DISTINCT
  gp.id AS position_id,
  gp.person_name,
  gp.politician_id,
  gp.organization_name AS ministry,
  gp.position_type,
  gp.government,
  gp.political_party,
  gp.start_date,
  gp.end_date,
  upper(unaccent(trim(name_entry.lookup_name))) AS lookup_name
FROM government_positions gp
CROSS JOIN LATERAL (
  SELECT gp.organization_name AS lookup_name
  UNION
  SELECT alias
  FROM unnest(coalesce(gp.organization_aliases, '{}'::text[])) AS alias
) AS name_entry;

CREATE OR REPLACE VIEW v_subsidy_responsibility_candidates
WITH (security_invoker = true) AS
SELECT
  s.id AS subsidy_id,
  gp.position_id,
  gp.person_name,
  gp.politician_id,
  gp.ministry,
  gp.position_type,
  gp.government,
  gp.political_party,
  gp.start_date,
  gp.end_date,
  CASE gp.position_type
    WHEN 'ministro' THEN 0
    WHEN 'vicepresidente' THEN 1
    ELSE 2
  END AS position_rank
FROM subsidies s
JOIN v_government_position_lookup gp
  ON gp.lookup_name = upper(unaccent(s.ministry_normalized))
 AND s.fecha_concesion BETWEEN gp.start_date AND coalesce(gp.end_date, current_date)
WHERE s.ministry_normalized IS NOT NULL;

CREATE OR REPLACE VIEW v_contract_responsibility_candidates
WITH (security_invoker = true) AS
SELECT
  c.id AS contract_id,
  gp.position_id,
  gp.person_name,
  gp.politician_id,
  gp.ministry,
  gp.position_type,
  gp.government,
  gp.political_party,
  gp.start_date,
  gp.end_date,
  CASE gp.position_type
    WHEN 'ministro' THEN 0
    WHEN 'vicepresidente' THEN 1
    ELSE 2
  END AS position_rank
FROM contracts c
JOIN v_government_position_lookup gp
  ON gp.lookup_name = upper(unaccent(c.ministry_normalized))
 AND c.date BETWEEN gp.start_date AND coalesce(gp.end_date, current_date)
WHERE c.ministry_normalized IS NOT NULL;

CREATE OR REPLACE VIEW v_subsidy_responsibility
WITH (security_invoker = true) AS
SELECT
  ranked.subsidy_id,
  ranked.position_id,
  ranked.person_name,
  ranked.politician_id,
  ranked.ministry,
  ranked.position_type,
  ranked.government,
  ranked.political_party
FROM (
  SELECT
    candidate.*,
    row_number() OVER (
      PARTITION BY candidate.subsidy_id
      ORDER BY candidate.position_rank, candidate.start_date DESC, candidate.position_id
    ) AS row_num
  FROM v_subsidy_responsibility_candidates candidate
) ranked
WHERE ranked.row_num = 1;

CREATE OR REPLACE VIEW v_contract_responsibility
WITH (security_invoker = true) AS
SELECT
  ranked.contract_id,
  ranked.position_id,
  ranked.person_name,
  ranked.politician_id,
  ranked.ministry,
  ranked.position_type,
  ranked.government,
  ranked.political_party
FROM (
  SELECT
    candidate.*,
    row_number() OVER (
      PARTITION BY candidate.contract_id
      ORDER BY candidate.position_rank, candidate.start_date DESC, candidate.position_id
    ) AS row_num
  FROM v_contract_responsibility_candidates candidate
) ranked
WHERE ranked.row_num = 1;

CREATE OR REPLACE VIEW v_subsidy_responsibility_conflicts
WITH (security_invoker = true) AS
SELECT
  subsidy_id,
  count(*)::integer AS candidate_count,
  array_agg(person_name ORDER BY position_rank, start_date DESC, position_id) AS candidate_people
FROM v_subsidy_responsibility_candidates
GROUP BY subsidy_id
HAVING count(*) > 1;

CREATE OR REPLACE VIEW v_contract_responsibility_conflicts
WITH (security_invoker = true) AS
SELECT
  contract_id,
  count(*)::integer AS candidate_count,
  array_agg(person_name ORDER BY position_rank, start_date DESC, position_id) AS candidate_people
FROM v_contract_responsibility_candidates
GROUP BY contract_id
HAVING count(*) > 1;

CREATE OR REPLACE VIEW v_responsibility_coverage
WITH (security_invoker = true) AS
SELECT
  'subsidies'::text AS dataset,
  count(*)::integer AS total_rows,
  count(*) FILTER (WHERE s.ministry_normalized IS NOT NULL)::integer AS rows_with_ministry,
  count(*) FILTER (WHERE sr.subsidy_id IS NOT NULL)::integer AS matched_rows,
  count(*) FILTER (
    WHERE s.ministry_normalized IS NOT NULL
      AND sr.subsidy_id IS NULL
  )::integer AS unmatched_rows,
  count(*) FILTER (WHERE sc.subsidy_id IS NOT NULL)::integer AS conflict_rows
FROM subsidies s
LEFT JOIN v_subsidy_responsibility sr ON sr.subsidy_id = s.id
LEFT JOIN v_subsidy_responsibility_conflicts sc ON sc.subsidy_id = s.id
UNION ALL
SELECT
  'contracts'::text AS dataset,
  count(*)::integer AS total_rows,
  count(*) FILTER (WHERE c.ministry_normalized IS NOT NULL)::integer AS rows_with_ministry,
  count(*) FILTER (WHERE cr.contract_id IS NOT NULL)::integer AS matched_rows,
  count(*) FILTER (
    WHERE c.ministry_normalized IS NOT NULL
      AND cr.contract_id IS NULL
  )::integer AS unmatched_rows,
  count(*) FILTER (WHERE cc.contract_id IS NOT NULL)::integer AS conflict_rows
FROM contracts c
LEFT JOIN v_contract_responsibility cr ON cr.contract_id = c.id
LEFT JOIN v_contract_responsibility_conflicts cc ON cc.contract_id = c.id;

CREATE OR REPLACE VIEW v_organization_public AS
SELECT
  o.id,
  o.name,
  o.organization_type,
  o.sector,
  o.country,
  o.source_url,
  count(DISTINCT c.id)::integer AS contract_count,
  count(DISTINCT sb.id)::integer AS subsidy_beneficiary_count,
  count(DISTINCT sg.id)::integer AS subsidy_granting_count,
  count(DISTINCT rd.id)::integer AS revolving_door_count
FROM organizations o
LEFT JOIN contracts c ON c.awarding_body_organization_id = o.id
LEFT JOIN subsidies sb ON sb.beneficiary_organization_id = o.id
LEFT JOIN subsidies sg ON sg.granting_body_organization_id = o.id
LEFT JOIN revolving_door rd ON rd.organization_id = o.id AND rd.verification_status = 'verified'
GROUP BY o.id;

GRANT SELECT ON v_government_position_lookup TO anon, authenticated;
GRANT SELECT ON v_subsidy_responsibility_candidates TO authenticated;
GRANT SELECT ON v_contract_responsibility_candidates TO authenticated;
GRANT SELECT ON v_subsidy_responsibility TO anon, authenticated;
GRANT SELECT ON v_contract_responsibility TO anon, authenticated;
GRANT SELECT ON v_subsidy_responsibility_conflicts TO authenticated;
GRANT SELECT ON v_contract_responsibility_conflicts TO authenticated;
GRANT SELECT ON v_responsibility_coverage TO authenticated;
GRANT SELECT ON v_organization_public TO anon, authenticated;
