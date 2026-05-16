-- Normalize Congress memberships so `party_id` points to the political party
-- and `group_parliamentary` keeps the parliamentary group label.

UPDATE politician_memberships pm
SET group_parliamentary = NULLIF(p.raw_data->>'grupo', '')
FROM politicians p
WHERE pm.politician_id = p.id
  AND pm.chamber = 'congress'
  AND NULLIF(p.raw_data->>'grupo', '') IS NOT NULL;

WITH congress_party_targets AS (
  SELECT DISTINCT
    pm.id AS membership_id,
    CASE COALESCE(par.acronym, '')
      WHEN 'PP' THEN 'Partido Popular'
      WHEN 'PSOE' THEN 'Partido Socialista Obrero Español'
      WHEN 'VOX' THEN 'VOX'
      WHEN 'SUMAR' THEN 'SUMAR'
      WHEN 'ERC' THEN 'Esquerra Republicana de Catalunya'
      WHEN 'JUNTS' THEN 'Junts per Catalunya'
      WHEN 'EH Bildu' THEN 'EH Bildu'
      WHEN 'EAJ-PNV' THEN 'Partido Nacionalista Vasco'
      WHEN 'UPN' THEN 'Unión del Pueblo Navarro'
      WHEN 'CCa' THEN 'Coalición Canaria'
      WHEN 'BNG' THEN 'Bloque Nacionalista Galego'
      WHEN 'Podemos' THEN 'Podemos'
      WHEN 'Ciudadanos' THEN 'Ciudadanos'
      WHEN 'PRC' THEN 'Partido Regionalista de Cantabria'
      ELSE COALESCE(NULLIF(p.raw_data->>'formacion', ''), par.name)
    END AS canonical_name,
    COALESCE(par.acronym, NULLIF(p.raw_data->>'formacion', '')) AS canonical_acronym,
    COALESCE(par.color, '#718096') AS canonical_color
  FROM politician_memberships pm
  JOIN politicians p ON p.id = pm.politician_id
  LEFT JOIN parties par ON par.id = pm.party_id
  WHERE pm.chamber = 'congress'
    AND pm.party_id IS NOT NULL
),
upserted_parties AS (
  INSERT INTO parties (name, acronym, color)
  SELECT DISTINCT canonical_name, canonical_acronym, canonical_color
  FROM congress_party_targets
  WHERE canonical_name IS NOT NULL
  ON CONFLICT (name) DO UPDATE SET
    acronym = EXCLUDED.acronym,
    color = EXCLUDED.color
  RETURNING id, name
)
UPDATE politician_memberships pm
SET party_id = canonical.id
FROM congress_party_targets target
JOIN parties canonical ON canonical.name = target.canonical_name
WHERE pm.id = target.membership_id
  AND target.canonical_name IS NOT NULL;

DELETE FROM parties p
WHERE p.name ~* '^Grupo Parlamentario'
  AND NOT EXISTS (
    SELECT 1
    FROM politician_memberships pm
    WHERE pm.party_id = p.id
  );
