SET LOCAL statement_timeout = '5min';
-- Preserve the existing public statistics; move the full-history aggregation
-- into the pipeline rather than the critical path of a party navigation.
CREATE MATERIALIZED VIEW public.mv_party_stats AS SELECT * FROM public.v_party_stats;
CREATE UNIQUE INDEX mv_party_stats_key ON public.mv_party_stats(party_id);
GRANT SELECT ON public.mv_party_stats TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.refresh_party_stats_cache()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_party_stats;
  SELECT count(*)::integer INTO n FROM public.mv_party_stats;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_party_stats_cache() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_party_stats_cache() TO service_role;

-- Aggregation avoids PostgREST's 1,000-row cap when 30 sessions contain more
-- than 1,000 individual party votes. DISTINCT memberships preserves IN semantics.
CREATE OR REPLACE FUNCTION public.get_party_voting_tallies(p_party_id uuid,p_session_ids uuid[])
RETURNS TABLE(voting_session_id uuid,vote text,vote_count bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
BEGIN
  IF cardinality(p_session_ids)>100 THEN
    RAISE EXCEPTION 'At most 100 voting sessions per request' USING ERRCODE='22023';
  END IF;
  RETURN QUERY
  WITH members AS MATERIALIZED (
    SELECT DISTINCT pm.politician_id FROM public.politician_memberships pm
    WHERE pm.party_id=p_party_id AND pm.is_active AND pm.chamber='congress'
  )
  SELECT v.voting_session_id,v.vote::text,count(*)
  FROM public.votes v JOIN members m ON m.politician_id=v.politician_id
  WHERE v.voting_session_id=ANY(p_session_ids)
  GROUP BY v.voting_session_id,v.vote;
END;
$$;
REVOKE ALL ON FUNCTION public.get_party_voting_tallies(uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_party_voting_tallies(uuid,uuid[]) TO anon,authenticated,service_role;

-- The daily cache already stores the exact get_divergences() output. Reuse it
-- with the same name/title/date matching as the old function instead of scanning
-- one million votes on every uncached person profile.
CREATE OR REPLACE FUNCTION public.get_politician_divergences(p_politician_id uuid)
RETURNS TABLE(voting_session_id uuid,voted text,party_voted text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT vs.id,d.voted,d.party_voted
  FROM public.politicians p JOIN public.vote_divergences_cache d ON d.full_name=p.full_name
  JOIN public.voting_sessions vs ON vs.title=d.initiative AND vs.date=d.date
  WHERE p.id=p_politician_id;
$$;
NOTIFY pgrst,'reload schema';
