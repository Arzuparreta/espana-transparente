ALTER TABLE voting_sessions ADD COLUMN IF NOT EXISTS votacion_number integer DEFAULT 1;
ALTER TABLE voting_sessions DROP CONSTRAINT IF EXISTS voting_sessions_unique;
ALTER TABLE voting_sessions ADD CONSTRAINT voting_sessions_unique UNIQUE (session_number, date, legislature_id, votacion_number);
