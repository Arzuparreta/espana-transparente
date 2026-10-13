-- Small public snapshot: the expensive historical aggregation is performed by
-- ETL, never by a visitor. Keep the existing source view and its exact semantics.
SET LOCAL statement_timeout = '10min';
SET LOCAL search_path = public, extensions;
-- Materialized-view population uses a restricted search path. Bind the
-- existing normalizer's dependency explicitly without changing its algorithm.
CREATE OR REPLACE FUNCTION public.normalize_beneficiary_name(input text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(regexp_replace(lower(public.unaccent(input)),
    '^[a-z][0-9]{7,8}[a-z]? ', ''), '[^a-z0-9]+', ' ', 'g'));
$$;
CREATE OR REPLACE FUNCTION public.normalize_money_text(input text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(trim(regexp_replace(upper(public.unaccent(coalesce(input, ''))), '\s+', ' ', 'g')), '');
$$;
CREATE MATERIALIZED VIEW public.mv_ministry_top_beneficiaries AS
  SELECT source.*, now() AS refreshed_at FROM public.v_ministry_top_beneficiaries source;
CREATE UNIQUE INDEX mv_ministry_top_beneficiaries_key
  ON public.mv_ministry_top_beneficiaries(ministry_normalized, source_type, name);
GRANT SELECT ON public.mv_ministry_top_beneficiaries TO anon, authenticated;
CREATE MATERIALIZED VIEW public.mv_section_eu_fund_summary AS
  SELECT source.*, now() AS refreshed_at FROM public.v_section_eu_fund_summary source;
CREATE UNIQUE INDEX mv_section_eu_fund_summary_key ON public.mv_section_eu_fund_summary(ministry_normalized);
GRANT SELECT ON public.mv_section_eu_fund_summary TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.refresh_ministry_beneficiaries_cache()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE n integer;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_ministry_top_beneficiaries;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_section_eu_fund_summary;
  SELECT count(*)::integer INTO n FROM public.mv_ministry_top_beneficiaries;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_ministry_beneficiaries_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_ministry_beneficiaries_cache() TO service_role;

-- The Senate index needs two counts, not party majorities and divergences for
-- the entire votes corpus. Use its indexed session join without the summary view.
CREATE OR REPLACE FUNCTION public.get_senate_nominal_vote_stats()
RETURNS TABLE (sessions_with_votes bigint, vote_rows bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT count(DISTINCT v.voting_session_id), count(*)
  FROM public.votes v JOIN public.voting_sessions s ON s.id=v.voting_session_id
  WHERE s.chamber='senate';
$$;
REVOKE ALL ON FUNCTION public.get_senate_nominal_vote_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_senate_nominal_vote_stats() TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
