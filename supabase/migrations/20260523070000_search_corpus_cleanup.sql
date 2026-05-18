-- Remove stale government_position rows superseded by corpus v2 rules.

DELETE FROM search_documents gp
WHERE gp.entity_type = 'government_position'
  AND (
    gp.display_title IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM government_positions pos
      WHERE pos.id::text = gp.entity_id
        AND (pos.end_date IS NULL OR pos.end_date >= current_date)
    )
  );

SELECT refresh_search_documents();
SELECT refresh_search_person_aliases();
