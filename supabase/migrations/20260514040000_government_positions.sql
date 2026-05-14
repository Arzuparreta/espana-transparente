-- Government positions: ministerial roles held by individuals, with date ranges.
-- Allows joining contracts/subsidies to the politically responsible person.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS government_positions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_type        text NOT NULL CHECK (position_type IN (
    'presidente_gobierno', 'vicepresidente', 'ministro'
  )),
  organization_name    text NOT NULL,                 -- e.g. "MINISTERIO DE HACIENDA" (UPPERCASE, no accents)
  organization_aliases text[] DEFAULT '{}',           -- alternate names that appear in source data
  person_name          text NOT NULL,                 -- "Apellidos, Nombre"
  politician_id        uuid REFERENCES politicians(id) ON DELETE SET NULL,
  political_party      text,
  government           text NOT NULL,                 -- "Sánchez III", "Rajoy II", ...
  start_date           date NOT NULL,
  end_date             date,                          -- NULL if currently in office
  source_url           text,
  created_at           timestamptz DEFAULT now(),
  UNIQUE (organization_name, person_name, start_date)
);

CREATE INDEX IF NOT EXISTS idx_gov_org    ON government_positions (organization_name);
CREATE INDEX IF NOT EXISTS idx_gov_dates  ON government_positions (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_gov_person ON government_positions (politician_id);

ALTER TABLE government_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gov_positions_public_read" ON government_positions;
CREATE POLICY "gov_positions_public_read" ON government_positions FOR SELECT USING (true);
