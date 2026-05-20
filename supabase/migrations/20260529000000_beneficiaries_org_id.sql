-- Add organization_id to v_ministry_top_beneficiaries.
-- Subsidy beneficiaries already have beneficiary_organization_id populated by the ETL.
-- Contractor rows keep organization_id NULL (no contractor FK exists yet).
CREATE OR REPLACE VIEW v_ministry_top_beneficiaries AS
WITH contracts_with_ministry AS (
  SELECT
    COALESCE(c.ministry_normalized, r.ministry) AS ministry_normalized,
    c.contractor                                 AS name,
    c.amount,
    NULL::uuid                                   AS organization_id
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
    'contract'::text                  AS source_type,
    COUNT(*)::integer                 AS record_count,
    COALESCE(SUM(amount), 0)          AS total_amount,
    NULL::uuid                        AS organization_id,
    ROW_NUMBER() OVER (
      PARTITION BY ministry_normalized
      ORDER BY COALESCE(SUM(amount), 0) DESC NULLS LAST
    )                                 AS rnk
  FROM contracts_with_ministry
  GROUP BY ministry_normalized, name
),
subsidy_agg AS (
  SELECT
    ministry_normalized,
    beneficiario                      AS name,
    'subsidy'::text                   AS source_type,
    COUNT(*)::integer                 AS record_count,
    COALESCE(SUM(importe), 0)         AS total_amount,
    (array_agg(beneficiary_organization_id ORDER BY beneficiary_organization_id)
      FILTER (WHERE beneficiary_organization_id IS NOT NULL))[1] AS organization_id,
    ROW_NUMBER() OVER (
      PARTITION BY ministry_normalized
      ORDER BY COALESCE(SUM(importe), 0) DESC NULLS LAST
    )                                 AS rnk
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

GRANT SELECT ON v_ministry_top_beneficiaries TO anon, authenticated;
