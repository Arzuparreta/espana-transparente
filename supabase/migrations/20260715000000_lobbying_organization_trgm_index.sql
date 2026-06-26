-- Speed up CNMC lobbying group -> organization fuzzy matching.
--
-- etl/src/lobbying/rgi.py prefilters candidates with:
--   lower(organizations.name) % lower(lobbying_groups.name)
-- which requires a trigram GIN expression index to avoid scanning the full
-- organizations table for every unlinked lobbying group.

CREATE INDEX IF NOT EXISTS organizations_lower_name_trgm_idx
  ON organizations USING gin (lower(name) gin_trgm_ops)
  WHERE name IS NOT NULL AND trim(name) <> '';
