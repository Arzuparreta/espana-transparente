-- Returns the voting sessions where a specific deputy voted against their group majority.
-- Used in the politician profile to mark divergent votes.

CREATE OR REPLACE FUNCTION get_politician_divergences(p_politician_id uuid)
RETURNS TABLE (
  voting_session_id uuid,
  voted            text,
  party_voted      text
) AS $$
DECLARE
  v_full_name text;
BEGIN
  SELECT full_name INTO v_full_name FROM politicians WHERE id = p_politician_id;
  IF v_full_name IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    vs.id,
    d.voted,
    d.party_voted
  FROM get_divergences() d
  JOIN voting_sessions vs ON vs.title = d.initiative AND vs.date = d.date
  WHERE d.full_name = v_full_name;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_politician_divergences(uuid) TO anon, authenticated;
