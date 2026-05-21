-- Organization deduplication: fix corrupted normalized_name values
-- in the EU fund population and merge duplicate orgs that refer to
-- the same real-world entity.
--
-- Root cause: a bug in an earlier version of normalize_organization_name
-- produced corrupted output for many Kohesio beneficiary labels (first
-- letters of words stripped, e.g. "Fundación Plan" → " undacion lan").
-- The current function is correct, but the corrupted data persists.
--
-- 1,464 / 2,962 EU fund orgs are affected. This migration:
--   1. Fixes non-colliding orgs (simple normalized_name UPDATE)
--   2. Merges duplicate orgs (moves eu_funds FKs, deletes duplicate)
--   3. Deduplicates collisions within the corrupted set
--   4. Creates the SQL normalization function for future use
--
-- After this migration, the name-based EU fund cascade views
-- (v_section_eu_fund_summary, v_ministry_top_beneficiaries)
-- will automatically match more organizations.

-- ── SQL mirror of the Python normalize_organization_name function ────────────

CREATE OR REPLACE FUNCTION normalize_org_name_sql(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(unaccent(input)),
        '\y(s\.?a\.?|s\.?l\.?|sa|sl|plc|ltd|inc)\y', '', 'g'
      ),
      '[^a-z0-9]+', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

-- ── Temp table: corrupted orgs with their fixed normalized_name ──────────────

CREATE TEMP TABLE _fix_candidates AS
SELECT
  o.id,
  o.name,
  o.normalized_name AS old_norm,
  normalize_org_name_sql(o.name) AS fixed_norm
FROM organizations o
WHERE o.normalized_name LIKE ' %';

-- 1,464 candidates. Verify: should match the investigation count.
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM _fix_candidates;
  IF n != 1464 THEN
    RAISE WARNING 'Expected 1464 corrupted orgs, found %', n;
  END IF;
END $$;

-- ── Phase 1: Handle orgs that collide with EXISTING clean orgs ───────────────
-- These are the 379 cases where fixed_norm already exists in organizations.
-- 354 are exact-name duplicates; 25 are near-duplicates.
-- Strategy: move all eu_funds FKs to the surviving org, then delete the duplicate.

CREATE TEMP TABLE _merge_into AS
SELECT
  fc.id        AS duplicate_id,
  fc.fixed_norm,
  o2.id        AS survivor_id
FROM _fix_candidates fc
JOIN organizations o2
  ON o2.normalized_name = fc.fixed_norm
 AND o2.id != fc.id;

-- Verify expected count
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM _merge_into;
  RAISE NOTICE 'Merging % duplicate orgs into existing survivors', n;
END $$;

-- Move eu_funds FKs
UPDATE eu_funds
SET beneficiary_organization_id = m.survivor_id
FROM _merge_into m
WHERE eu_funds.beneficiary_organization_id = m.duplicate_id;

-- Delete the duplicates (FKs already moved)
DELETE FROM organizations
USING _merge_into m
WHERE organizations.id = m.duplicate_id;

-- Remove merged rows from fix candidates
DELETE FROM _fix_candidates
USING _merge_into m
WHERE _fix_candidates.id = m.duplicate_id;

-- ── Phase 2: Handle self-collisions within the corrupted set ─────────────────
-- Some corrupted orgs have the same fixed_norm as other corrupted orgs.
-- Pick the one with the most EU fund references as survivor.

CREATE TEMP TABLE _self_dupes AS
SELECT
  fixed_norm,
  array_agg(id ORDER BY id) AS ids,
  count(*) AS n
FROM _fix_candidates
GROUP BY fixed_norm
HAVING count(*) > 1;

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM _self_dupes;
  RAISE NOTICE '% fixed_norm groups have self-collisions within corrupted set', n;
END $$;

-- For each colliding group, keep the first id, merge the rest into it
-- (order by id is deterministic; eu_fund counts are equal for these since
--  they were created from the same batch insert)
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT * FROM _self_dupes LOOP
    -- Keep ids[1], merge ids[2..] into ids[1]
    FOR i IN 2..rec.n LOOP
      UPDATE eu_funds
      SET beneficiary_organization_id = rec.ids[1]
      WHERE beneficiary_organization_id = rec.ids[i];

      DELETE FROM organizations WHERE id = rec.ids[i];
      DELETE FROM _fix_candidates WHERE id = rec.ids[i];
    END LOOP;
  END LOOP;
END $$;

-- ── Phase 3: Fix remaining non-colliding orgs ────────────────────────────────
-- All remaining candidates have unique fixed_norm that doesn't collide.

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM _fix_candidates;
  RAISE NOTICE 'Fixing % remaining corrupted orgs (simple UPDATE)', n;
END $$;

UPDATE organizations o
SET normalized_name = fc.fixed_norm
FROM _fix_candidates fc
WHERE o.id = fc.id;

-- ── Phase 4: Fix orgs whose name was overwritten by ON CONFLICT ──────────────
-- Some orgs have a correct-looking normalized_name that nonetheless doesn't
-- match the recomputed value of their CURRENT name. This happens when:
--   1. First insert created org with name A, normalized to X
--   2. Second insert with name B normalized to X too → ON CONFLICT updated
--      name to B, kept normalized_name as X
--   3. Now name is B, but normalized_name was computed from A
--
-- These are NOT caught by the LIKE ' %' filter but are still wrong.
-- Example: 58 distinct EU fund beneficiaries collapsed to a single org
-- named 'TETRA 5, S.L.U.' with normalized_name 'tetra 5 u'.

CREATE TEMP TABLE _name_mismatches AS
SELECT
  o.id,
  o.name,
  o.normalized_name AS old_norm,
  normalize_org_name_sql(o.name) AS recomputed
FROM organizations o
WHERE o.normalized_name != normalize_org_name_sql(o.name);

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM _name_mismatches;
  RAISE NOTICE 'Name mismatches (org name != recomputed norm): %', n;
END $$;

-- Merge collisions (exact-name duplicates)
CREATE TEMP TABLE _name_merge AS
SELECT
  nm.id          AS duplicate_id,
  nm.recomputed,
  o2.id          AS survivor_id
FROM _name_mismatches nm
JOIN organizations o2
  ON o2.normalized_name = nm.recomputed
 AND o2.id != nm.id;

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM _name_merge;
  RAISE NOTICE 'Name mismatches that collide with existing orgs: %', n;
END $$;

-- Move FKs and delete duplicates
UPDATE eu_funds
SET beneficiary_organization_id = m.survivor_id
FROM _name_merge m
WHERE eu_funds.beneficiary_organization_id = m.duplicate_id;

DELETE FROM organizations
USING _name_merge m
WHERE organizations.id = m.duplicate_id;

DELETE FROM _name_mismatches
USING _name_merge m
WHERE _name_mismatches.id = m.duplicate_id;

-- Fix remaining (no collision)
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM _name_mismatches;
  RAISE NOTICE 'Fixing % remaining name mismatches (simple UPDATE)', n;
END $$;

UPDATE organizations o
SET normalized_name = nm.recomputed
FROM _name_mismatches nm
WHERE o.id = nm.id;

-- ── Cleanup ──────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS _fix_candidates;
DROP TABLE IF EXISTS _merge_into;
DROP TABLE IF EXISTS _self_dupes;
DROP TABLE IF EXISTS _name_mismatches;
DROP TABLE IF EXISTS _name_merge;

-- ── Verify ───────────────────────────────────────────────────────────────────

DO $$
DECLARE
  corrupted_left int;
  name_mismatch_left int;
  total_orgs int;
  eu_fund_orgs int;
BEGIN
  SELECT count(*) INTO corrupted_left
  FROM organizations WHERE normalized_name LIKE ' %';

  SELECT count(*) INTO name_mismatch_left
  FROM organizations WHERE normalized_name != normalize_org_name_sql(name);

  SELECT count(*) INTO total_orgs FROM organizations;
  SELECT count(DISTINCT beneficiary_organization_id) INTO eu_fund_orgs
  FROM eu_funds WHERE beneficiary_organization_id IS NOT NULL;

  RAISE NOTICE 'Corrupted orgs remaining: % (was 1464)', corrupted_left;
  RAISE NOTICE 'Name mismatches remaining: % (was 94)', name_mismatch_left;
  RAISE NOTICE 'Total organizations: %', total_orgs;
  RAISE NOTICE 'EU fund orgs: %', eu_fund_orgs;
END $$;

-- Known remaining issue: the ON CONFLICT (normalized_name) DO UPDATE pattern
-- in the ETL's upsert_organization() causes multiple distinct entities that
-- normalize to the same string to collapse into a single org row. The most
-- prominent case is 'tetra 5 u' (58 beneficiaries). Fixing this requires
-- changing the upsert strategy in the Python ETL and re-running the org
-- linking. For now the cascade uses name-based matching (not org_id), so
-- the cascade data is unaffected.
