-- Fixes needed for clean bootstrap from an empty database.
-- Applied 2026-05-28 during self-hosted recovery.

-- 1. Fix refresh_vote_divergences_cache: use DISTINCT ON to prevent duplicates
--    from get_divergences() joining to multiple voting_sessions with same title+date.
CREATE OR REPLACE FUNCTION refresh_vote_divergences_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  DELETE FROM vote_divergences_cache;
  INSERT INTO vote_divergences_cache (full_name, acronym, voted, party_voted, initiative, date)
  SELECT DISTINCT ON (full_name, initiative, date)
    full_name, acronym, voted, party_voted, initiative, date
  FROM get_divergences();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 2. Fix refresh_search_person_aliases: truncate alias values to avoid
--    exceeding btree index max row size (2704 bytes).
CREATE OR REPLACE FUNCTION public.refresh_search_person_aliases()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO search_aliases (alias, canonical, entity_type, entity_id, weight, source)
  SELECT DISTINCT
    left(alias_value, 500),
    coalesce(sd.display_title, sd.title),
    sd.entity_type,
    sd.entity_id,
    8,
    'generated'
  FROM search_documents sd
  CROSS JOIN LATERAL (
    SELECT unnest(
      array_remove(
        ARRAY[
          lower(unaccent(coalesce(sd.display_title, sd.title))),
          lower(unaccent((string_to_array(coalesce(sd.display_title, sd.title), ' '))[1])),
          CASE
            WHEN array_length(string_to_array(coalesce(sd.display_title, sd.title), ' '), 1) >= 2 THEN
              lower(unaccent(
                (string_to_array(coalesce(sd.display_title, sd.title), ' '))[1]
                || ' '
                || (string_to_array(coalesce(sd.display_title, sd.title), ' '))[
                  array_length(string_to_array(coalesce(sd.display_title, sd.title), ' '), 1)
                ]
              ))
            ELSE NULL
          END
        ],
        NULL
      )
    ) AS alias_value
  ) aliases
  WHERE sd.entity_type IN ('politician', 'senator', 'government_position', 'institution', 'revolving_door')
    AND length(alias_value) >= 2
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
