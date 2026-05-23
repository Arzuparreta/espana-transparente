-- Link contract awardees to organizations so public-money cascades and
-- organization pages can navigate from text beneficiaries to records.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION normalize_organization_name_sql(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    trim(
      regexp_replace(
        regexp_replace(
          lower(unaccent(coalesce(input, ''))),
          '\m(s\.?a\.?|s\.?l\.?|sa|sl|plc|ltd|inc)\M',
          '',
          'g'
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      )
    ),
    ''
  )
$$;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS contractor_organization_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contracts_contractor_organization_id_fkey'
  ) THEN
    ALTER TABLE contracts
      ADD CONSTRAINT contracts_contractor_organization_id_fkey
      FOREIGN KEY (contractor_organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contracts_contractor_org ON contracts (contractor_organization_id);

WITH distinct_contractors AS (
  SELECT DISTINCT ON (normalize_organization_name_sql(contractor))
    contractor AS name,
    normalize_organization_name_sql(contractor) AS normalized_name,
    source_url
  FROM contracts
  WHERE contractor IS NOT NULL
    AND trim(contractor) <> ''
    AND normalize_organization_name_sql(contractor) IS NOT NULL
  ORDER BY normalize_organization_name_sql(contractor), source_url DESC NULLS LAST, contractor
)
INSERT INTO organizations (name, normalized_name, organization_type, source_url)
SELECT name, normalized_name, 'company', source_url
FROM distinct_contractors
ON CONFLICT (normalized_name) DO UPDATE SET
  name = EXCLUDED.name,
  organization_type = CASE
    WHEN organizations.organization_type = 'other' THEN EXCLUDED.organization_type
    ELSE organizations.organization_type
  END,
  source_url = coalesce(EXCLUDED.source_url, organizations.source_url),
  updated_at = now();

UPDATE contracts c
SET contractor_organization_id = o.id
FROM organizations o
WHERE c.contractor_organization_id IS NULL
  AND normalize_organization_name_sql(c.contractor) = o.normalized_name;

DROP VIEW IF EXISTS v_ministry_top_beneficiaries CASCADE;
CREATE OR REPLACE VIEW v_ministry_top_beneficiaries AS
WITH contracts_with_ministry AS (
  SELECT
    COALESCE(c.ministry_normalized, r.ministry) AS ministry_normalized,
    c.contractor                                AS name,
    c.amount,
    c.contractor_organization_id                AS organization_id
  FROM contracts c
  LEFT JOIN v_contract_responsibility r
         ON r.contract_id = c.id
        AND r.administration_level = 'state'
        AND r.ministry IS NOT NULL
  WHERE COALESCE(c.ministry_normalized, r.ministry) IS NOT NULL
    AND c.contractor IS NOT NULL
    AND trim(c.contractor) <> ''
),
contractor_agg AS (
  SELECT
    ministry_normalized,
    name,
    'contract'::text                 AS source_type,
    COUNT(*)::integer                AS record_count,
    COALESCE(SUM(amount), 0)         AS total_amount,
    (array_agg(organization_id ORDER BY organization_id)
      FILTER (WHERE organization_id IS NOT NULL))[1] AS organization_id,
    ROW_NUMBER() OVER (
      PARTITION BY ministry_normalized
      ORDER BY COALESCE(SUM(amount), 0) DESC NULLS LAST
    )                                AS rnk
  FROM contracts_with_ministry
  GROUP BY ministry_normalized, name
),
subsidy_agg AS (
  SELECT
    ministry_normalized,
    beneficiario                     AS name,
    'subsidy'::text                  AS source_type,
    COUNT(*)::integer                AS record_count,
    COALESCE(SUM(importe), 0)        AS total_amount,
    (array_agg(beneficiary_organization_id ORDER BY beneficiary_organization_id)
      FILTER (WHERE beneficiary_organization_id IS NOT NULL))[1] AS organization_id,
    ROW_NUMBER() OVER (
      PARTITION BY ministry_normalized
      ORDER BY COALESCE(SUM(importe), 0) DESC NULLS LAST
    )                                AS rnk
  FROM subsidies
  WHERE ministry_normalized IS NOT NULL
    AND beneficiario IS NOT NULL
    AND trim(beneficiario) <> ''
  GROUP BY ministry_normalized, beneficiario
)
SELECT ministry_normalized, name, source_type, record_count, total_amount, organization_id
FROM contractor_agg WHERE rnk <= 5
UNION ALL
SELECT ministry_normalized, name, source_type, record_count, total_amount, organization_id
FROM subsidy_agg WHERE rnk <= 5;

DROP VIEW IF EXISTS v_organization_public CASCADE;
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
LEFT JOIN contracts c
  ON c.awarding_body_organization_id = o.id
  OR c.contractor_organization_id = o.id
LEFT JOIN subsidies sb ON sb.beneficiary_organization_id = o.id
LEFT JOIN subsidies sg ON sg.granting_body_organization_id = o.id
LEFT JOIN revolving_door rd ON rd.organization_id = o.id AND rd.verification_status = 'verified'
GROUP BY o.id;

GRANT SELECT ON v_ministry_top_beneficiaries TO anon, authenticated;
GRANT SELECT ON v_organization_public TO anon, authenticated;
