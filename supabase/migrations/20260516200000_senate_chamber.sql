-- Add senate_id to politicians and chamber to politician_memberships.
-- Enables senators alongside deputies in the same schema.

ALTER TABLE politicians
  ADD COLUMN IF NOT EXISTS senate_id text;

CREATE UNIQUE INDEX IF NOT EXISTS politicians_senate_id_idx
  ON politicians (senate_id)
  WHERE senate_id IS NOT NULL;

-- Add chamber column with default 'congress' so existing rows are unaffected.
ALTER TABLE politician_memberships
  ADD COLUMN IF NOT EXISTS chamber text NOT NULL DEFAULT 'congress'
  CHECK (chamber IN ('congress', 'senate'));

-- Replace the old UNIQUE(politician_id, legislature_id) with a per-chamber constraint.
ALTER TABLE politician_memberships
  DROP CONSTRAINT IF EXISTS politician_memberships_politician_id_legislature_id_key;

ALTER TABLE politician_memberships
  ADD CONSTRAINT politician_memberships_unique_chamber
  UNIQUE (politician_id, legislature_id, chamber);

-- Index for filtering by chamber
CREATE INDEX IF NOT EXISTS politician_memberships_chamber_idx
  ON politician_memberships (chamber, legislature_id);
