-- Fix: deduplicate target_normalized_name before INSERT to avoid
-- "ON CONFLICT DO UPDATE command cannot affect row a second time"
-- when multiple source labels resolve to the same collision key.

-- Recreate the temp table with the data we need
CREATE TEMP TABLE _eu_fund_org_label_splits AS
WITH shared_orgs AS (
  SELECT beneficiary_organization_id AS old_org_id
  FROM eu_funds
  WHERE beneficiary_organization_id IS NOT NULL
    AND label IS NOT NULL
    AND trim(label) <> ''
  GROUP BY beneficiary_organization_id
  HAVING count(DISTINCT label) > 1
),
distinct_labels AS (
  SELECT DISTINCT
    e.beneficiary_organization_id AS old_org_id,
    trim(e.label) AS label
  FROM eu_funds e
  JOIN shared_orgs s ON s.old_org_id = e.beneficiary_organization_id
  WHERE e.label IS NOT NULL
    AND trim(e.label) <> ''
)
SELECT
  dl.old_org_id,
  dl.label,
  o.normalized_name AS old_normalized_name,
  CASE
    WHEN lower(trim(o.name)) = lower(dl.label) THEN o.normalized_name
    ELSE organization_collision_key_sql(dl.label)
  END AS target_normalized_name,
  coalesce(o.organization_type, 'other') AS organization_type,
  o.sector,
  o.country,
  coalesce(o.source_url, 'https://kohesio.ec.europa.eu/en/beneficiaries') AS source_url
FROM distinct_labels dl
JOIN organizations o ON o.id = dl.old_org_id
WHERE normalize_org_name_sql(dl.label) IS NOT NULL;

-- Insert new org rows, one per distinct target_normalized_name.
-- When multiple source labels map to the same collision key, keep the first
-- (the UPDATE below will rewire all matching eu_funds rows to the same org).
INSERT INTO organizations (name, normalized_name, organization_type, sector, country, source_url)
SELECT DISTINCT ON (target_normalized_name)
  label,
  target_normalized_name,
  organization_type,
  sector,
  country,
  source_url
FROM _eu_fund_org_label_splits
WHERE target_normalized_name != old_normalized_name
ORDER BY target_normalized_name, old_org_id, label
ON CONFLICT (normalized_name) DO UPDATE SET
  organization_type = CASE
    WHEN organizations.organization_type = 'other' THEN EXCLUDED.organization_type
    ELSE organizations.organization_type
  END,
  sector = coalesce(EXCLUDED.sector, organizations.sector),
  source_url = coalesce(EXCLUDED.source_url, organizations.source_url),
  updated_at = now();

-- Rewire eu_funds to the new (or existing) org rows
UPDATE eu_funds e
SET beneficiary_organization_id = o.id
FROM _eu_fund_org_label_splits s
JOIN organizations o ON o.normalized_name = s.target_normalized_name
WHERE e.beneficiary_organization_id = s.old_org_id
  AND trim(e.label) = s.label
  AND e.beneficiary_organization_id != o.id;

DO $$
DECLARE
  split_labels int;
  split_orgs int;
  rewired int;
BEGIN
  SELECT count(*) INTO split_labels
  FROM _eu_fund_org_label_splits
  WHERE target_normalized_name != old_normalized_name;

  SELECT count(DISTINCT target_normalized_name) INTO split_orgs
  FROM _eu_fund_org_label_splits
  WHERE target_normalized_name != old_normalized_name;

  -- Count how many eu_funds rows were actually re-pointed
  SELECT count(*) INTO rewired
  FROM _eu_fund_org_label_splits s
  JOIN organizations o ON o.normalized_name = s.target_normalized_name
  JOIN eu_funds e ON e.beneficiary_organization_id = o.id
    AND trim(e.label) = s.label
  WHERE s.target_normalized_name != s.old_normalized_name;

  RAISE NOTICE 'EU fund org labels needing split: %', split_labels;
  RAISE NOTICE 'Target orgs to create: %', split_orgs;
  RAISE NOTICE 'EU fund rows now pointing at correct org via new normalized_name: %', rewired;
END $$;

DROP TABLE IF EXISTS _eu_fund_org_label_splits;
