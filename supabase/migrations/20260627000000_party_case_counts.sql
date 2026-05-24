-- Aggregate judicial case counts per party, readable by anon.
--
-- corruption_case_actors is restricted to authenticated; SECURITY DEFINER
-- lets the anon role call this without bypassing RLS on the detail table.

CREATE OR REPLACE FUNCTION get_party_case_counts()
RETURNS TABLE (party_id uuid, case_count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cca.party_id,
    count(DISTINCT cca.case_id)::bigint AS case_count
  FROM corruption_case_actors cca
  WHERE cca.party_id IS NOT NULL
    AND cca.review_status = 'reviewed'
  GROUP BY cca.party_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_party_case_counts() TO anon, authenticated;
