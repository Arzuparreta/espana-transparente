-- Voting statistics aggregated per party for active deputies.
CREATE OR REPLACE VIEW v_party_stats AS
SELECT
  pm.party_id,
  COUNT(DISTINCT pm.politician_id)                                      AS deputy_count,
  COUNT(v.id)                                                           AS total_votes,
  ROUND(AVG(CASE WHEN v.vote = 'No vota' THEN 0.0 ELSE 1.0 END) * 100, 1) AS attendance_pct,
  ROUND(COUNT(CASE WHEN v.vote = 'Sí'         THEN 1 END)::numeric
        / NULLIF(COUNT(v.id), 0) * 100, 1)                             AS pct_yes,
  ROUND(COUNT(CASE WHEN v.vote = 'No'         THEN 1 END)::numeric
        / NULLIF(COUNT(v.id), 0) * 100, 1)                             AS pct_no,
  ROUND(COUNT(CASE WHEN v.vote = 'Abstención' THEN 1 END)::numeric
        / NULLIF(COUNT(v.id), 0) * 100, 1)                             AS pct_abstain,
  ROUND(COUNT(CASE WHEN v.vote = 'No vota'    THEN 1 END)::numeric
        / NULLIF(COUNT(v.id), 0) * 100, 1)                             AS pct_absent
FROM politician_memberships pm
JOIN votes v ON v.politician_id = pm.politician_id
WHERE pm.is_active = true
GROUP BY pm.party_id;

GRANT SELECT ON v_party_stats TO anon, authenticated;
