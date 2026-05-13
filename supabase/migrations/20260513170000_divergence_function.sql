CREATE OR REPLACE FUNCTION get_divergences()
RETURNS TABLE(
  full_name text,
  acronym text,
  voted text,
  party_voted text,
  initiative text,
  date date
) AS $$
BEGIN
  RETURN QUERY
  WITH party_majority AS (
    SELECT 
      v.voting_session_id,
      pm.party_id,
      mode() WITHIN GROUP (ORDER BY v.vote) as majority_vote
    FROM votes v
    JOIN politician_memberships pm ON pm.politician_id = v.politician_id AND pm.is_active = true
    GROUP BY v.voting_session_id, pm.party_id
  )
  SELECT 
    pol.full_name,
    par.acronym,
    v.vote,
    pj.majority_vote,
    vs.title,
    vs.date
  FROM votes v
  JOIN politician_memberships pm ON pm.politician_id = v.politician_id AND pm.is_active = true
  JOIN party_majority pj ON pj.voting_session_id = v.voting_session_id AND pj.party_id = pm.party_id
  JOIN politicians pol ON pol.id = v.politician_id
  JOIN parties par ON par.id = pm.party_id
  JOIN voting_sessions vs ON vs.id = v.voting_session_id
  WHERE v.vote != pj.majority_vote
    AND v.vote IN ('Sí', 'No', 'Abstención')
    AND pj.majority_vote IN ('Sí', 'No', 'Abstención')
  ORDER BY vs.date DESC, pol.full_name;
END;
$$ LANGUAGE plpgsql STABLE;
