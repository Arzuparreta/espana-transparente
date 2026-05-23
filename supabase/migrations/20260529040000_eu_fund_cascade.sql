-- Surface EU fund data in the public-money cascade through organizations.
-- EU funds are keyed by beneficiary, not ministry, so the defensible route
-- is: cascade → organization page → EU fund detail. This migration creates
-- the organization-level EU fund aggregate and enriches the cascade views.

-- ── Organization-level EU fund aggregate ─────────────────────────────────────

DROP VIEW IF EXISTS v_organization_eu_funds CASCADE;
CREATE OR REPLACE VIEW v_organization_eu_funds AS
SELECT
  beneficiary_organization_id                              AS organization_id,
  COUNT(*)::integer                                        AS eu_fund_count,
  COALESCE(SUM(eu_budget), 0)                              AS total_eu_budget,
  COALESCE(SUM(total_budget), 0)                           AS total_eu_budget_with_cofinancing,
  ROUND(AVG(cofinancing_rate) FILTER (WHERE cofinancing_rate IS NOT NULL), 2) AS avg_cofinancing_rate,
  COALESCE(SUM(number_projects), 0)                        AS total_projects
FROM eu_funds
WHERE beneficiary_organization_id IS NOT NULL
GROUP BY beneficiary_organization_id;

GRANT SELECT ON v_organization_eu_funds TO anon, authenticated;

-- ── Cascade beneficiaries with EU fund context ───────────────────────────────

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
),
all_beneficiaries AS (
  SELECT ministry_normalized, name, source_type, record_count, total_amount, organization_id
  FROM contractor_agg WHERE rnk <= 5
  UNION ALL
  SELECT ministry_normalized, name, source_type, record_count, total_amount, organization_id
  FROM subsidy_agg WHERE rnk <= 5
)
SELECT
  b.ministry_normalized,
  b.name,
  b.source_type,
  b.record_count,
  b.total_amount,
  b.organization_id,
  ef.total_eu_budget     AS eu_fund_total,
  ef.eu_fund_count       AS eu_fund_project_count
FROM all_beneficiaries b
LEFT JOIN v_organization_eu_funds ef ON ef.organization_id = b.organization_id;

GRANT SELECT ON v_ministry_top_beneficiaries TO anon, authenticated;

-- ── Organization public profile with EU fund count ───────────────────────────

DROP VIEW IF EXISTS v_organization_public CASCADE;
CREATE OR REPLACE VIEW v_organization_public AS
SELECT
  o.id,
  o.name,
  o.organization_type,
  o.sector,
  o.country,
  o.source_url,
  count(DISTINCT c.id)::integer  AS contract_count,
  count(DISTINCT sb.id)::integer AS subsidy_beneficiary_count,
  count(DISTINCT sg.id)::integer AS subsidy_granting_count,
  count(DISTINCT rd.id)::integer AS revolving_door_count,
  count(DISTINCT ef.id)::integer AS eu_fund_count
FROM organizations o
LEFT JOIN contracts c
  ON c.awarding_body_organization_id = o.id
  OR c.contractor_organization_id = o.id
LEFT JOIN subsidies sb ON sb.beneficiary_organization_id = o.id
LEFT JOIN subsidies sg ON sg.granting_body_organization_id = o.id
LEFT JOIN revolving_door rd ON rd.organization_id = o.id AND rd.verification_status = 'verified'
LEFT JOIN eu_funds ef ON ef.beneficiary_organization_id = o.id
GROUP BY o.id;

GRANT SELECT ON v_organization_public TO anon, authenticated;
