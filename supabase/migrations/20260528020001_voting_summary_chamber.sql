-- Rebuild voting summary after voting_sessions.chamber exists.
-- Divergence and party grouping must use the membership for the same chamber.

DROP VIEW IF EXISTS v_voting_session_summary;

CREATE OR REPLACE VIEW v_voting_session_summary AS
WITH party_vote_counts AS (
  SELECT
    v.voting_session_id,
    pm.party_id,
    v.vote,
    COUNT(*) AS vote_count
  FROM votes v
  JOIN voting_sessions vs ON vs.id = v.voting_session_id
  JOIN politician_memberships pm
    ON pm.politician_id = v.politician_id
   AND pm.is_active = true
   AND pm.chamber = vs.chamber
  WHERE v.vote != 'No vota'
    AND pm.party_id IS NOT NULL
  GROUP BY v.voting_session_id, pm.party_id, v.vote
),
party_majority AS (
  SELECT voting_session_id, party_id, vote AS majority_vote
  FROM (
    SELECT
      pvc.*,
      ROW_NUMBER() OVER (
        PARTITION BY pvc.voting_session_id, pvc.party_id
        ORDER BY pvc.vote_count DESC, pvc.vote
      ) AS rank
    FROM party_vote_counts pvc
  ) ranked
  WHERE rank = 1
),
session_divergences AS (
  SELECT
    v.voting_session_id,
    COUNT(*) FILTER (
      WHERE v.vote != 'No vota'
        AND v.vote != pmj.majority_vote
    ) AS divergence_count
  FROM votes v
  JOIN voting_sessions vs ON vs.id = v.voting_session_id
  JOIN politician_memberships pm
    ON pm.politician_id = v.politician_id
   AND pm.is_active = true
   AND pm.chamber = vs.chamber
  JOIN party_majority pmj
    ON pmj.voting_session_id = v.voting_session_id
   AND pmj.party_id = pm.party_id
  GROUP BY v.voting_session_id
),
session_counts AS (
  SELECT
    voting_session_id,
    COUNT(*) AS vote_count,
    COUNT(*) FILTER (WHERE vote = 'Sí') AS votes_yes,
    COUNT(*) FILTER (WHERE vote = 'No') AS votes_no,
    COUNT(*) FILTER (WHERE vote = 'Abstención') AS votes_abstain,
    COUNT(*) FILTER (WHERE vote = 'No vota') AS votes_no_vote
  FROM votes
  GROUP BY voting_session_id
)
SELECT
  vs.id,
  vs.legislature_id,
  vs.session_number,
  vs.chamber,
  vs.date,
  vs.title,
  vs.initiative_number,
  vs.initiative_type,
  vs.votacion_number,
  COALESCE(sc.vote_count, 0)::integer AS vote_count,
  COALESCE(sc.vote_count, 0)::integer AS total_votes,
  COALESCE(sc.votes_yes, 0)::integer AS votes_yes,
  COALESCE(sc.votes_no, 0)::integer AS votes_no,
  COALESCE(sc.votes_abstain, 0)::integer AS votes_abstain,
  COALESCE(sc.votes_no_vote, 0)::integer AS votes_no_vote,
  COALESCE(sd.divergence_count, 0)::integer AS divergence_count,
  vs.created_at
FROM voting_sessions vs
LEFT JOIN session_counts sc ON sc.voting_session_id = vs.id
LEFT JOIN session_divergences sd ON sd.voting_session_id = vs.id;

GRANT SELECT ON v_voting_session_summary TO anon, authenticated;
