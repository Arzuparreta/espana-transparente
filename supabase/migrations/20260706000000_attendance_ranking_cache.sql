-- Cache deputy attendance ranking for the public attendance page.
-- The raw view groups hundreds of thousands of votes on every request, which
-- is too slow for filtered ranking pages on the hosted free tier.

DROP MATERIALIZED VIEW IF EXISTS v_attendance_ranking;

CREATE MATERIALIZED VIEW v_attendance_ranking AS
WITH session_attendance AS (
  SELECT
    v.politician_id,
    vs.legislature_id,
    vs.session_number,
    MIN(vs.date) AS session_date,
    BOOL_OR(v.vote != 'No vota') AS was_present
  FROM votes v
  JOIN voting_sessions vs ON vs.id = v.voting_session_id
  WHERE vs.chamber = 'congress'
  GROUP BY v.politician_id, vs.legislature_id, vs.session_number
),
current_membership AS (
  SELECT DISTINCT ON (pm.politician_id, pm.legislature_id)
    pm.politician_id,
    pm.legislature_id,
    par.acronym AS party_acronym,
    par.color AS party_color
  FROM politician_memberships pm
  LEFT JOIN parties par ON par.id = pm.party_id
  WHERE pm.is_active = true
    AND pm.chamber = 'congress'
  ORDER BY pm.politician_id, pm.legislature_id, pm.start_date DESC NULLS LAST, pm.id DESC
)
SELECT
  p.id AS politician_id,
  p.full_name,
  p.photo_url,
  p.photo_variants,
  cm.party_acronym,
  cm.party_color,
  sa.legislature_id,
  COUNT(*)::integer AS total_sessions,
  SUM(CASE WHEN sa.was_present THEN 1 ELSE 0 END)::integer AS sessions_present,
  ROUND(
    SUM(CASE WHEN sa.was_present THEN 1 ELSE 0 END)::numeric /
    NULLIF(COUNT(*), 0) * 100,
    1
  ) AS attendance_pct
FROM session_attendance sa
JOIN politicians p ON p.id = sa.politician_id
JOIN current_membership cm
  ON cm.politician_id = sa.politician_id
 AND cm.legislature_id = sa.legislature_id
GROUP BY
  p.id,
  p.full_name,
  p.photo_url,
  p.photo_variants,
  cm.party_acronym,
  cm.party_color,
  sa.legislature_id;

CREATE UNIQUE INDEX v_attendance_ranking_politician_idx
  ON v_attendance_ranking (politician_id, legislature_id);

CREATE INDEX v_attendance_ranking_party_idx
  ON v_attendance_ranking (party_acronym);

CREATE INDEX v_attendance_ranking_order_idx
  ON v_attendance_ranking (attendance_pct DESC, sessions_present DESC);

GRANT SELECT ON v_attendance_ranking TO anon, authenticated;

CREATE OR REPLACE FUNCTION refresh_attendance_ranking()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_count integer;
BEGIN
  REFRESH MATERIALIZED VIEW v_attendance_ranking;
  SELECT COUNT(*) INTO row_count FROM v_attendance_ranking;
  RETURN row_count;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_attendance_ranking() TO authenticated;
