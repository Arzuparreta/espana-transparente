-- Generated person aliases from search corpus display names.

CREATE OR REPLACE FUNCTION refresh_search_person_aliases()
RETURNS integer AS $$
DECLARE
  inserted_count integer;
BEGIN
  DELETE FROM search_aliases WHERE source = 'generated';

  INSERT INTO search_aliases (alias, canonical, entity_type, entity_id, weight, source)
  SELECT DISTINCT
    alias_value,
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

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION refresh_search_person_aliases() TO authenticated;

SELECT refresh_search_person_aliases();
