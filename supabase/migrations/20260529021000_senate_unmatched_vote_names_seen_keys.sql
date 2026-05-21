-- Make unmatched Senate vote-name accounting idempotent across ETL reruns.

ALTER TABLE senate_vote_unmatched_names
  ADD COLUMN IF NOT EXISTS seen_vote_keys text[] NOT NULL DEFAULT '{}';
