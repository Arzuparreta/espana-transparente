-- Run against a disposable database with the search schema and migration loaded.
BEGIN;
INSERT INTO search_documents(entity_type,entity_id,title,route,document_date,search_vector)
SELECT CASE WHEN n%2=0 THEN 'contract' ELSE 'organization' END,'exploration-test-'||n,
  'Explorationfixture Madrid '||n,'/fixture/'||n,CASE WHEN n=50 THEN NULL ELSE '2024-01-01'::date END,
  to_tsvector('simple','Explorationfixture Madrid') FROM generate_series(1,50) n;
DO $$
DECLARE first_page jsonb; second_page jsonb; filtered jsonb;
BEGIN
  first_page:=search_documents_page('Explorationfixture',NULL,NULL,1,24);
  second_page:=search_documents_page('Explorationfixture',NULL,NULL,2,24);
  IF (first_page->>'total')::int<>50 OR jsonb_array_length(first_page->'results')<>24 THEN RAISE EXCEPTION 'Incorrect count/page'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(first_page->'results') a JOIN jsonb_array_elements(second_page->'results') b ON a->>'id'=b->>'id') THEN RAISE EXCEPTION 'Pages overlap'; END IF;
  filtered:=search_documents_page('Explorationfixture',ARRAY['contract'],2024,1,24);
  IF (filtered->>'total')::int<>24 THEN RAISE EXCEPTION 'Type/year filter mismatch'; END IF;
  IF first_page<>search_documents_page('Explorationfixture',NULL,NULL,1,24) THEN RAISE EXCEPTION 'Unstable ordering'; END IF;
END $$;
ROLLBACK;
