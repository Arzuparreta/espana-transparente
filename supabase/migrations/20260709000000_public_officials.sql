-- Public officials registry: non-parliamentary executive officials
-- (state ministers without a Congress seat, CCAA presidents/consejeros,
-- mayors of major cities) who appear as "responsable político" in
-- responsibility_positions but have politician_id IS NULL.
--
-- Kept deliberately separate from `politicians` (Congress/Senate scope).
-- Source of truth: etl/data/public_officials.yml, loaded by
-- etl/src/congreso/public_officials.py.

CREATE TABLE IF NOT EXISTS public_officials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  aliases text[] DEFAULT '{}',
  administration_level text CHECK (administration_level IN ('state', 'autonomic', 'municipal')),
  political_party text,
  wikidata_qid text,
  photo_url text,
  photo_variants jsonb,
  photo_source text,
  source_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS public_officials_full_name_idx
  ON public_officials (full_name);
CREATE INDEX IF NOT EXISTS idx_public_officials_aliases
  ON public_officials USING gin (aliases);
CREATE INDEX IF NOT EXISTS idx_public_officials_wikidata_qid
  ON public_officials (wikidata_qid) WHERE wikidata_qid IS NOT NULL;

ALTER TABLE public_officials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_officials_public_read" ON public_officials;
CREATE POLICY "public_officials_public_read"
  ON public_officials FOR SELECT USING (true);

GRANT SELECT ON public_officials TO anon, authenticated;

ALTER TABLE responsibility_positions
  ADD COLUMN IF NOT EXISTS official_id uuid REFERENCES public_officials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_responsibility_positions_official
  ON responsibility_positions (official_id);

ALTER TABLE responsibility_positions
  DROP CONSTRAINT IF EXISTS responsibility_positions_politician_xor_official;
ALTER TABLE responsibility_positions
  ADD CONSTRAINT responsibility_positions_politician_xor_official
  CHECK (politician_id IS NULL OR official_id IS NULL);
