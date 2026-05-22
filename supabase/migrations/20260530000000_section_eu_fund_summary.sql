-- Phase: EU fund beneficiaries in the /dinero-publico cascade.
--
-- Problem: organization_id from contracts/subsidies rarely matches
-- eu_funds.beneficiary_organization_id because the two ingestion pipelines
-- produce different normalized_name strings for the same real-world entity.
-- A full org dedup is planned but not yet executed.
--
-- Solution: match by beneficiary/contractor NAME directly against
-- eu_funds.label, using unaccent+lower+strip-NIF normalization.
-- This catches universities, research centers, public health services,
-- and large foundations that appear in both datasets with recognisable names.
--
-- The normalized form strips:
--   - NIF prefix (letter + 7-8 digits + optional letter + space)
--   - Accents
--   - Non-alphanumeric chars → single space
--   - Leading/trailing space
--
-- Coverage is partial (~30 matches across subsidies, fewer for contracts)
-- but these are the high-value institutional beneficiaries where EU fund
-- traceability matters most. Coverage will increase after org dedup.

-- ── Normalization helper ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION normalize_beneficiary_name(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      lower(unaccent(input)),
      '^[a-z][0-9]{7,8}[a-z]? ',
      ''
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  ));
$$;

-- ── Per-section EU fund aggregation (name-based) ─────────────────────────────

CREATE OR REPLACE VIEW v_section_eu_fund_summary AS
WITH eu_normalized AS (
  SELECT DISTINCT
    normalize_beneficiary_name(label) AS norm_name,
    id,
    eu_budget,
    total_budget
  FROM eu_funds
  WHERE label IS NOT NULL
    AND normalize_beneficiary_name(label) <> ''
),
subsidy_sections AS (
  SELECT DISTINCT
    ministry_normalized,
    normalize_beneficiary_name(beneficiario) AS norm_name
  FROM subsidies
  WHERE ministry_normalized IS NOT NULL
    AND beneficiario IS NOT NULL
    AND trim(beneficiario) <> ''
),
contract_sections AS (
  SELECT DISTINCT
    ministry_normalized,
    normalize_beneficiary_name(contractor) AS norm_name
  FROM contracts
  WHERE ministry_normalized IS NOT NULL
    AND contractor IS NOT NULL
    AND trim(contractor) <> ''
),
all_sections AS (
  SELECT ministry_normalized, norm_name FROM subsidy_sections
  UNION
  SELECT ministry_normalized, norm_name FROM contract_sections
)
SELECT
  s.ministry_normalized,
  COUNT(DISTINCT e.id)::integer             AS eu_fund_count,
  COALESCE(SUM(e.eu_budget), 0)            AS eu_fund_total,
  COALESCE(SUM(e.total_budget), 0)         AS eu_fund_total_with_cofinancing,
  COUNT(DISTINCT s.norm_name)::integer      AS orgs_with_eu_funds
FROM all_sections s
JOIN eu_normalized e ON s.norm_name = e.norm_name
GROUP BY s.ministry_normalized;

GRANT SELECT ON v_section_eu_fund_summary TO anon, authenticated;

-- ── Extend v_ministry_top_beneficiaries with name-based EU fund data ──────────

CREATE OR REPLACE VIEW v_ministry_top_beneficiaries AS
WITH contracts_with_ministry AS (
  SELECT
    COALESCE(c.ministry_normalized, r.ministry) AS ministry_normalized,
    c.contractor                                 AS name,
    c.amount,
    c.contractor_organization_id                 AS organization_id
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
),
-- Name-based EU fund join (replaces the broken org_id-based join)
eu_by_name AS (
  SELECT
    normalize_beneficiary_name(label) AS norm_name,
    SUM(eu_budget)                    AS eu_fund_total,
    COUNT(*)::integer                 AS eu_fund_project_count
  FROM eu_funds
  WHERE label IS NOT NULL
  GROUP BY normalize_beneficiary_name(label)
)
SELECT
  b.ministry_normalized,
  b.name,
  b.source_type,
  b.record_count,
  b.total_amount,
  b.organization_id,
  e.eu_fund_total,
  e.eu_fund_project_count
FROM all_beneficiaries b
LEFT JOIN eu_by_name e
  ON e.norm_name = normalize_beneficiary_name(b.name);

GRANT SELECT ON v_ministry_top_beneficiaries TO anon, authenticated;

-- ── Cleanup: old org_id-based v_organization_eu_funds is still useful for
--    organization pages; keep it. The new cascade views use name matching. ─────
