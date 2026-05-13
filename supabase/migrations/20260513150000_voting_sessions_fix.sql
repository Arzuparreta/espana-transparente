ALTER TABLE voting_sessions ADD COLUMN IF NOT EXISTS votacion_number integer DEFAULT 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'voting_sessions_unique') THEN
    ALTER TABLE voting_sessions DROP CONSTRAINT voting_sessions_unique;
  END IF;
END $$;

ALTER TABLE voting_sessions ADD CONSTRAINT voting_sessions_unique UNIQUE (session_number, date, legislature_id, votacion_number);
