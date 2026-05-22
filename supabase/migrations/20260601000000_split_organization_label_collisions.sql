-- Split organization rows that were collapsed by normalized-name upserts.
--
-- Organization normalized names are match keys, not real-world identities.
-- Older ETL paths used ON CONFLICT (normalized_name) DO UPDATE SET name = ...,
-- so distinct source labels that shared a normalized output could overwrite one
-- another and keep all eu_funds rows pointing at a single organization page.

CREATE OR REPLACE FUNCTION organization_collision_key_sql(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT normalize_org_name_sql(input) || ' ' || substr(md5(lower(trim(input))), 1, 16)
$$;

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

-- Use DISTINCT ON to avoid "ON CONFLICT DO UPDATE cannot affect row a second time"
-- when two source labels resolve to the same collision key (e.g. same label string
-- appearing under different old_org_ids, or case-only variants).
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
BEGIN
  SELECT count(*) INTO split_labels
  FROM _eu_fund_org_label_splits
  WHERE target_normalized_name != old_normalized_name;

  SELECT count(DISTINCT target_normalized_name) INTO split_orgs
  FROM _eu_fund_org_label_splits;

  RAISE NOTICE 'EU fund organization labels split: %', split_labels;
  RAISE NOTICE 'EU fund organization target orgs: %', split_orgs;
END $$;

DROP TABLE IF EXISTS _eu_fund_org_label_splits;
