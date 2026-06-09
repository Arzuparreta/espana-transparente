-- Preserve human review decisions so rejected links are auditable and can be
-- backed up. The existing `reviewed` boolean remains for public-query
-- compatibility; public surfaces still expose only reviewed=true rows.

ALTER TABLE lobbying_organization_links
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'needs_review'
    CHECK (review_status IN ('needs_review', 'reviewed', 'rejected')),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by text;

UPDATE lobbying_organization_links
SET review_status = CASE WHEN reviewed THEN 'reviewed' ELSE 'needs_review' END
WHERE review_status = 'needs_review';

ALTER TABLE borme_politician_matches
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'needs_review'
    CHECK (review_status IN ('needs_review', 'reviewed', 'rejected')),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by text;

UPDATE borme_politician_matches
SET review_status = CASE WHEN reviewed THEN 'reviewed' ELSE 'needs_review' END
WHERE review_status = 'needs_review';

CREATE INDEX IF NOT EXISTS lobbying_org_links_review_status_idx
  ON lobbying_organization_links (review_status);

CREATE INDEX IF NOT EXISTS borme_matches_review_status_idx
  ON borme_politician_matches (review_status);
