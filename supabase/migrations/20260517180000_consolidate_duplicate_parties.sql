-- Migration: consolidate duplicate party entries per acronym
-- Strategy: keep the party_id with the most politician_memberships as canonical.
-- Remap all FK references (politician_memberships, power_relationships) then delete duplicates.

BEGIN;

-- Step 1: build canonical mapping (acronym → canonical party_id with most memberships)
CREATE TEMP TABLE party_canonical AS
SELECT DISTINCT ON (p.acronym)
    p.acronym,
    p.id AS canonical_id
FROM parties p
LEFT JOIN politician_memberships pm ON pm.party_id = p.id
GROUP BY p.id, p.acronym
ORDER BY p.acronym, COUNT(pm.id) DESC;

-- Step 2: remap politician_memberships
UPDATE politician_memberships pm
SET party_id = pc.canonical_id
FROM party_canonical pc
JOIN parties p ON p.acronym = pc.acronym
WHERE pm.party_id = p.id
  AND pm.party_id <> pc.canonical_id;

-- Step 3: remap power_relationships
UPDATE power_relationships pr
SET party_id = pc.canonical_id
FROM party_canonical pc
JOIN parties p ON p.acronym = pc.acronym
WHERE pr.party_id = p.id
  AND pr.party_id <> pc.canonical_id;

-- Step 4: delete non-canonical duplicate party rows
DELETE FROM parties
WHERE id IN (
    SELECT p.id
    FROM parties p
    JOIN party_canonical pc ON pc.acronym = p.acronym
    WHERE p.id <> pc.canonical_id
);

-- Step 5: verify — should have one row per acronym
-- SELECT acronym, COUNT(*) FROM parties GROUP BY acronym HAVING COUNT(*) > 1;

COMMIT;
