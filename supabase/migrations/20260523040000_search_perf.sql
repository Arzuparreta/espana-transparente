-- Search performance indexes and ops notes.

CREATE INDEX IF NOT EXISTS search_documents_display_title_trgm_idx
  ON search_documents USING gin (display_title gin_trgm_ops)
  WHERE display_title IS NOT NULL;

COMMENT ON FUNCTION search_documents IS
  'Two-stage full search over search_documents. After deploy: npx supabase db push, then PYTHONPATH=src python -m common.search_refresh';
