-- Migration: remove duplicate power_relationships rows and prevent future ones
-- Cause: ETL re-runs inserted exact duplicates because ON CONFLICT DO NOTHING had
-- no matching unique constraint to infer, so it never triggered.

BEGIN;

-- Step 1: delete duplicates, keeping the oldest row per relationship
DELETE FROM power_relationships pr
USING power_relationships keep
WHERE pr.id <> keep.id
  AND pr.person_id = keep.person_id
  AND pr.relationship_type = keep.relationship_type
  AND pr.superior_id IS NOT DISTINCT FROM keep.superior_id
  AND pr.party_id IS NOT DISTINCT FROM keep.party_id
  AND (pr.created_at, pr.id) > (keep.created_at, keep.id);

-- Step 2: prevent future duplicates
ALTER TABLE power_relationships
  ADD CONSTRAINT power_relationships_unique
  UNIQUE (person_id, superior_id, relationship_type, party_id);

COMMIT;
