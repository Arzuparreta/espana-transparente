-- Phase 5: distinguish Congress vs Senate voting sessions.
-- Existing rows remain congress; Senate ETL sets chamber = 'senate'.

ALTER TABLE voting_sessions
  ADD COLUMN IF NOT EXISTS chamber text NOT NULL DEFAULT 'congress'
  CHECK (chamber IN ('congress', 'senate'));

CREATE INDEX IF NOT EXISTS voting_sessions_chamber_date_idx
  ON voting_sessions (chamber, date DESC);

-- Allow the same session_number/date for different chambers.
ALTER TABLE voting_sessions DROP CONSTRAINT IF EXISTS voting_sessions_unique;
ALTER TABLE voting_sessions
  ADD CONSTRAINT voting_sessions_unique
  UNIQUE (session_number, date, legislature_id, votacion_number, chamber);
