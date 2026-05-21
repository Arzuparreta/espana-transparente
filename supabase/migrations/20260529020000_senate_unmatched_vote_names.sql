-- Audit unmatched Senate nominal-vote names so match-quality work is repeatable.

CREATE TABLE IF NOT EXISTS senate_vote_unmatched_names (
  normalized_name text NOT NULL,
  name text NOT NULL,
  parliamentary_group text NOT NULL DEFAULT '',
  first_seen_session integer,
  last_seen_session integer,
  vote_rows integer NOT NULL DEFAULT 0,
  seen_vote_keys text[] NOT NULL DEFAULT '{}',
  sample_source_url text,
  sample_raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (normalized_name, parliamentary_group)
);

CREATE INDEX IF NOT EXISTS idx_senate_vote_unmatched_names_rows
  ON senate_vote_unmatched_names (vote_rows DESC);

CREATE INDEX IF NOT EXISTS idx_senate_vote_unmatched_names_group
  ON senate_vote_unmatched_names (parliamentary_group);

ALTER TABLE senate_vote_unmatched_names ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read senate unmatched vote names" ON senate_vote_unmatched_names;
CREATE POLICY "Public read senate unmatched vote names"
  ON senate_vote_unmatched_names FOR SELECT USING (true);

GRANT SELECT ON senate_vote_unmatched_names TO anon, authenticated;
