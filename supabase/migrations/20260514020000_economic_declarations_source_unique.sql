-- Make source_url uniquely identify an economic declaration row so the ETL
-- can upsert with ON CONFLICT (source_url). Multiple NULL source_urls remain
-- allowed for legacy/manual entries.

CREATE UNIQUE INDEX IF NOT EXISTS economic_declarations_source_url_uniq
  ON economic_declarations (source_url)
  WHERE source_url IS NOT NULL;

-- Frequent lookup pattern in the ETL: "have we already ingested this PDF?".
-- Also useful when joining a politician page back to its declarations.
CREATE INDEX IF NOT EXISTS economic_declarations_politician_date_idx
  ON economic_declarations (politician_id, declaration_date DESC);
