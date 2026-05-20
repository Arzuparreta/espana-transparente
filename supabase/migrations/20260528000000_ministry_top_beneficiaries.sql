-- Top contractors and subsidy beneficiaries per ministry_normalized.
-- Used by /dinero-publico to surface downstream org recipients in the cascade.
-- Capped at 5 per ministry per source type to keep queries fast and the UI concise.
CREATE OR REPLACE VIEW v_ministry_top_beneficiaries AS
WITH contractor_agg AS (
  SELECT
    ministry_normalized,
    contractor                        AS name,
    'contract'::text                  AS source_type,
    COUNT(*)::integer                 AS record_count,
    COALESCE(SUM(amount), 0)          AS total_amount,
    ROW_NUMBER() OVER (
      PARTITION BY ministry_normalized
      ORDER BY COALESCE(SUM(amount), 0) DESC NULLS LAST
    )                                 AS rnk
  FROM contracts
  WHERE ministry_normalized IS NOT NULL
    AND contractor IS NOT NULL
    AND trim(contractor) <> ''
  GROUP BY ministry_normalized, contractor
),
subsidy_agg AS (
  SELECT
    ministry_normalized,
    beneficiario                      AS name,
    'subsidy'::text                   AS source_type,
    COUNT(*)::integer                 AS record_count,
    COALESCE(SUM(importe), 0)         AS total_amount,
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
SELECT ministry_normalized, name, source_type, record_count, total_amount
FROM contractor_agg WHERE rnk <= 5
UNION ALL
SELECT ministry_normalized, name, source_type, record_count, total_amount
FROM subsidy_agg WHERE rnk <= 5;

GRANT SELECT ON v_ministry_top_beneficiaries TO anon, authenticated;
