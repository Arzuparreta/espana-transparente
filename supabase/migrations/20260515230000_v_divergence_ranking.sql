-- Ranking of deputies by number of votes diverging from their parliamentary group.
-- Excludes "No vota" (absences). Joins with politicians to get the id for linking.

CREATE OR REPLACE VIEW v_divergence_ranking AS
SELECT
  p.id            AS politician_id,
  d.full_name,
  p.photo_url,
  p.photo_variants,
  d.acronym       AS party_acronym,
  par.color       AS party_color,
  COUNT(*)        AS divergence_count
FROM get_divergences() d
JOIN politicians p
  ON lower(unaccent(p.full_name)) = lower(unaccent(d.full_name))
LEFT JOIN politician_memberships pm
  ON pm.politician_id = p.id AND pm.is_active = true
LEFT JOIN parties par
  ON par.id = pm.party_id
GROUP BY p.id, d.full_name, p.photo_url, p.photo_variants, d.acronym, par.color
ORDER BY divergence_count DESC;

GRANT SELECT ON v_divergence_ranking TO anon, authenticated;
