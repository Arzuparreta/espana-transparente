-- The summary view aggregates the whole votes corpus even for a small id list.
-- Scope votes before grouping/window functions, preserving its chamber-specific
-- membership, majority tie-break and divergence semantics.
CREATE OR REPLACE FUNCTION public.get_voting_session_tallies(p_session_ids uuid[])
RETURNS TABLE (
  id uuid, vote_count integer, votes_yes integer, votes_no integer,
  votes_abstain integer, divergence_count integer
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF cardinality(p_session_ids) > 100 THEN
    RAISE EXCEPTION 'At most 100 voting sessions per request' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH scoped_sessions AS MATERIALIZED (
    SELECT vs.id, vs.chamber FROM public.voting_sessions vs
    WHERE vs.id = ANY(p_session_ids)
  ), scoped_votes AS MATERIALIZED (
    SELECT v.voting_session_id, v.politician_id, v.vote, s.chamber
    FROM scoped_sessions s
    JOIN public.votes v ON v.voting_session_id = s.id
  ), party_votes AS MATERIALIZED (
    SELECT v.voting_session_id, pm.party_id, v.vote
    FROM scoped_votes v
    JOIN public.politician_memberships pm
      ON pm.politician_id = v.politician_id
     AND pm.is_active = true AND pm.chamber = v.chamber
    WHERE pm.party_id IS NOT NULL AND v.vote != 'No vota'
  ), party_counts AS (
    SELECT pv.voting_session_id, pv.party_id, pv.vote, count(*) AS n
    FROM party_votes pv GROUP BY pv.voting_session_id, pv.party_id, pv.vote
  ), majority AS (
    SELECT ranked.voting_session_id, ranked.party_id, ranked.vote
    FROM (
      SELECT pc.*, row_number() OVER (
        PARTITION BY pc.voting_session_id, pc.party_id
        ORDER BY pc.n DESC, pc.vote
      ) AS ranking FROM party_counts pc
    ) ranked WHERE ranked.ranking = 1
  ), divergences AS (
    SELECT pv.voting_session_id,
      count(*) FILTER (WHERE pv.vote != m.vote)::integer AS n
    FROM party_votes pv JOIN majority m
      ON m.voting_session_id = pv.voting_session_id AND m.party_id = pv.party_id
    GROUP BY pv.voting_session_id
  ), counts AS (
    SELECT v.voting_session_id, count(*)::integer AS n,
      count(*) FILTER (WHERE v.vote = 'Sí')::integer AS yes_n,
      count(*) FILTER (WHERE v.vote = 'No')::integer AS no_n,
      count(*) FILTER (WHERE v.vote = 'Abstención')::integer AS abstain_n
    FROM scoped_votes v GROUP BY v.voting_session_id
  )
  SELECT s.id, coalesce(c.n, 0), coalesce(c.yes_n, 0), coalesce(c.no_n, 0),
    coalesce(c.abstain_n, 0), coalesce(d.n, 0)
  FROM scoped_sessions s LEFT JOIN counts c ON c.voting_session_id = s.id
  LEFT JOIN divergences d ON d.voting_session_id = s.id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_voting_session_tallies(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_voting_session_tallies(uuid[]) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
