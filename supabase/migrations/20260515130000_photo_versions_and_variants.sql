-- Photo versioning and immutable responsive variants.

CREATE TABLE IF NOT EXISTS politician_photo_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id uuid NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_priority integer NOT NULL,
  source_url text,
  source_etag text,
  source_last_modified text,
  content_sha256 text NOT NULL,
  perceptual_hash text NOT NULL,
  variants jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'rejected')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  promoted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS politician_photo_versions_unique_candidate_idx
  ON politician_photo_versions (politician_id, source, content_sha256);

CREATE INDEX IF NOT EXISTS politician_photo_versions_active_idx
  ON politician_photo_versions (politician_id, is_active, created_at DESC);

ALTER TABLE politicians
  ADD COLUMN IF NOT EXISTS photo_variants jsonb,
  ADD COLUMN IF NOT EXISTS photo_version_id uuid REFERENCES politician_photo_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS politicians_photo_version_id_idx
  ON politicians (photo_version_id)
  WHERE photo_version_id IS NOT NULL;
