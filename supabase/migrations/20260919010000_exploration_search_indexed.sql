-- Compact search projection: avoid reading large document bodies for every match.
-- A trigger keeps inserts, updates and deletes atomic with the source corpus.
CREATE TABLE IF NOT EXISTS public.search_page_index (
 document_id uuid PRIMARY KEY REFERENCES public.search_documents(document_id) ON DELETE CASCADE,
 entity_type text NOT NULL, entity_id text NOT NULL, document_date date,
 route text, metadata_year text, normalized_title text, weight integer,
 search_vector tsvector
);
CREATE OR REPLACE FUNCTION public.sync_search_page_index() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 INSERT INTO public.search_page_index
 VALUES (NEW.document_id,NEW.entity_type,NEW.entity_id,NEW.document_date,NEW.route,
 NEW.metadata->>'year',lower(unaccent(coalesce(NEW.display_title,NEW.title))),NEW.weight,strip(NEW.search_vector))
 ON CONFLICT (document_id) DO UPDATE SET
 entity_type=EXCLUDED.entity_type,entity_id=EXCLUDED.entity_id,document_date=EXCLUDED.document_date,
 route=EXCLUDED.route,metadata_year=EXCLUDED.metadata_year,normalized_title=EXCLUDED.normalized_title,
 weight=EXCLUDED.weight,search_vector=EXCLUDED.search_vector;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS search_page_index_sync ON public.search_documents;
CREATE TRIGGER search_page_index_sync AFTER INSERT OR UPDATE ON public.search_documents
FOR EACH ROW EXECUTE FUNCTION public.sync_search_page_index();
INSERT INTO public.search_page_index
SELECT document_id,entity_type,entity_id,document_date,route,metadata->>'year',
 lower(unaccent(coalesce(display_title,title))),weight,strip(search_vector)
FROM public.search_documents d
WHERE NOT EXISTS (SELECT 1 FROM public.search_page_index i WHERE i.document_id=d.document_id)
ON CONFLICT (document_id) DO NOTHING;
CREATE INDEX IF NOT EXISTS search_page_index_vector_idx ON public.search_page_index USING gin(search_vector);
CREATE INDEX IF NOT EXISTS search_page_index_entity_idx ON public.search_page_index(entity_type,entity_id);
ALTER TABLE public.search_page_index ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS search_page_index_public_read ON public.search_page_index;
CREATE POLICY search_page_index_public_read ON public.search_page_index FOR SELECT TO anon,authenticated USING(true);
GRANT SELECT ON public.search_page_index TO anon,authenticated;
GRANT ALL ON public.search_page_index TO service_role;
ANALYZE public.search_page_index;

-- Split alias and full-text candidates so the GIN index remains usable on the production corpus.
-- Paginated discovery keeps intent as ranking only; explicit filters define scope.
CREATE OR REPLACE FUNCTION public.search_documents_page(
  query_text text, entity_types text[] DEFAULT NULL, year_filter integer DEFAULT NULL,
  page_number integer DEFAULT 1, page_size integer DEFAULT 24
) RETURNS jsonb LANGUAGE sql STABLE SET search_path = public SET statement_timeout = '8s' SET work_mem = '64MB' SET effective_io_concurrency = '200' AS $$
WITH input AS (
  SELECT _search_normalize_query(query_text) AS text, _build_search_query(_search_normalize_query(query_text)) AS q, _search_query_intent(query_text) AS intent
  WHERE length(trim(query_text)) >= 2
), candidates AS MATERIALIZED (
  SELECT sd.document_id, sd.entity_type, sd.entity_id, sd.document_date, sd.route,
    (CASE WHEN sd.normalized_title = input.text THEN 3.0 WHEN sd.normalized_title LIKE input.text || '%' THEN 1.5 ELSE 0.0 END + coalesce(sd.weight,1)::real / 10 + _search_entity_type_boost(sd.entity_type,input.intent)) AS score FROM public.search_page_index sd CROSS JOIN input
  WHERE sd.search_vector @@ input.q
    AND (entity_types IS NULL OR sd.entity_type=ANY(entity_types))
    AND (year_filter IS NULL OR extract(year FROM sd.document_date)=year_filter OR sd.metadata_year=year_filter::text)
  UNION ALL
  SELECT sd.document_id, sd.entity_type, sd.entity_id, sd.document_date, sd.route,
    (CASE WHEN sd.normalized_title = input.text THEN 3.0 WHEN sd.normalized_title LIKE input.text || '%' THEN 1.5 ELSE 0.0 END + coalesce(sd.weight,1)::real / 10 + _search_entity_type_boost(sd.entity_type,input.intent)) AS score FROM public.search_aliases sa
  JOIN public.search_page_index sd ON sd.entity_type=sa.entity_type AND sd.entity_id=sa.entity_id
  CROSS JOIN input WHERE lower(unaccent(sa.alias))=input.text
    AND NOT coalesce(sd.search_vector @@ input.q, false)
    AND (entity_types IS NULL OR sd.entity_type=ANY(entity_types))
    AND (year_filter IS NULL OR extract(year FROM sd.document_date)=year_filter OR sd.metadata_year=year_filter::text)
), matched AS (
  SELECT sd.*,
    row_number() OVER (PARTITION BY sd.entity_type, CASE WHEN sd.entity_type='budget_program' THEN coalesce(sd.route,sd.entity_id) ELSE sd.entity_id END ORDER BY sd.document_date DESC NULLS LAST,sd.document_id) AS duplicate
  FROM candidates sd

), unique_rows AS (SELECT * FROM matched WHERE duplicate=1), page AS (
  SELECT * FROM unique_rows ORDER BY score DESC,document_date DESC NULLS LAST,entity_type,entity_id
  LIMIT greatest(1,least(page_size,100)) OFFSET ((greatest(1,least(page_number,10000))-1)::bigint * greatest(1,least(page_size,100)))
), result AS (
 SELECT sd.entity_type,sd.entity_id AS id,coalesce(sd.display_title,sd.title) AS title,sd.subtitle,
 coalesce(sd.route,sd.source_url,'') AS url,sd.key_fact,sd.document_date,sd.amount,sd.source_url,sd.metadata,page.score AS rank
 FROM page JOIN public.search_documents sd USING(document_id)
 ORDER BY page.score DESC,page.document_date DESC NULLS LAST,page.entity_type,page.entity_id
)
SELECT jsonb_build_object('results',coalesce((SELECT jsonb_agg(result) FROM result),'[]'::jsonb),'total',(SELECT count(*) FROM unique_rows));
$$;
GRANT EXECUTE ON FUNCTION public.search_documents_page(text,text[],integer,integer,integer) TO anon,authenticated;
