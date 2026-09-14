-- Source timestamps allow incremental full-corpus indexing without truncation.
ALTER TABLE subsidies ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
