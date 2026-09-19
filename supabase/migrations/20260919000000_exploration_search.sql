-- Paginated discovery keeps intent as ranking only; explicit filters define scope.
CREATE OR REPLACE FUNCTION public.search_documents_page(
  query_text text, entity_types text[] DEFAULT NULL, year_filter integer DEFAULT NULL,
  page_number integer DEFAULT 1, page_size integer DEFAULT 24
) RETURNS jsonb LANGUAGE sql STABLE SET search_path = public SET statement_timeout = '8s' AS $$
WITH input AS (
  SELECT _search_normalize_query(query_text) AS text, _build_search_query(_search_normalize_query(query_text)) AS q
), matched AS (
  SELECT sd.*, _search_document_score(sd.display_title,sd.title,sd.search_vector,input.text,input.q,sd.entity_type,sd.weight,_search_query_intent(query_text)) AS score,
    row_number() OVER (PARTITION BY sd.entity_type, CASE WHEN sd.entity_type='budget_program' THEN coalesce(sd.route,sd.entity_id) ELSE sd.entity_id END ORDER BY sd.document_date DESC NULLS LAST,sd.document_id) AS duplicate
  FROM public.search_documents sd CROSS JOIN input
  WHERE length(trim(query_text)) >= 2 AND input.text IS NOT NULL
    AND (entity_types IS NULL OR sd.entity_type=ANY(entity_types))
    AND (year_filter IS NULL OR extract(year FROM sd.document_date)=year_filter OR sd.metadata->>'year'=year_filter::text)
    AND (sd.search_vector @@ input.q OR EXISTS (
      SELECT 1 FROM public.search_aliases sa WHERE sa.entity_type=sd.entity_type AND sa.entity_id=sd.entity_id
        AND lower(unaccent(sa.alias))=input.text
    ))
), unique_rows AS (SELECT * FROM matched WHERE duplicate=1), page AS (
  SELECT entity_type,entity_id AS id,coalesce(display_title,title) AS title,subtitle,
    coalesce(route,source_url,'') AS url,key_fact,document_date,amount,source_url,metadata,score AS rank
  FROM unique_rows ORDER BY score DESC,document_date DESC NULLS LAST,entity_type,entity_id
  LIMIT greatest(1,least(page_size,100)) OFFSET ((greatest(1,least(page_number,10000))-1)::bigint * greatest(1,least(page_size,100)))
)
SELECT jsonb_build_object('results',coalesce((SELECT jsonb_agg(page) FROM page),'[]'::jsonb),'total',(SELECT count(*) FROM unique_rows));
$$;
GRANT EXECUTE ON FUNCTION public.search_documents_page(text,text[],integer,integer,integer) TO anon,authenticated;
CREATE INDEX IF NOT EXISTS contracts_contractor_org_explore_idx ON public.contracts(contractor_organization_id);
CREATE INDEX IF NOT EXISTS contracts_awarding_org_explore_idx ON public.contracts(awarding_body_organization_id);
