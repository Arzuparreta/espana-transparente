-- Election results table for dynamic /distorsion page.
-- Curated from Ministerio del Interior (infoelectoral.interior.gob.es).

CREATE TABLE IF NOT EXISTS election_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_date date NOT NULL,
  party text NOT NULL,
  party_short_name text NOT NULL,
  votes bigint NOT NULL,
  seats int NOT NULL,
  pct_vote numeric(5,2) NOT NULL,
  color text NOT NULL,
  total_seats int NOT NULL,
  participation_pct numeric(4,1) NOT NULL,
  UNIQUE (election_date, party)
);

CREATE INDEX IF NOT EXISTS election_results_date_idx ON election_results (election_date);

ALTER TABLE election_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read election results" ON election_results;
CREATE POLICY "Public read election results"
  ON election_results FOR SELECT USING (true);

GRANT SELECT ON election_results TO anon, authenticated;

CREATE TABLE IF NOT EXISTS election_provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_date date NOT NULL,
  province_name text NOT NULL,
  seats int NOT NULL,
  effective_threshold numeric(4,1) NOT NULL,
  description text NOT NULL,
  UNIQUE (election_date, province_name)
);

CREATE INDEX IF NOT EXISTS election_provinces_date_idx ON election_provinces (election_date);

ALTER TABLE election_provinces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read election provinces" ON election_provinces;
CREATE POLICY "Public read election provinces"
  ON election_provinces FOR SELECT USING (true);

GRANT SELECT ON election_provinces TO anon, authenticated;
