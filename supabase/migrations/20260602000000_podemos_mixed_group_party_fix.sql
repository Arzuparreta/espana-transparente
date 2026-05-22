-- The Congress active CSV exposes the 23-J electoral coalition as SUMAR for
-- several deputies whose official Congress profile marks them as PODEMOS.
-- Keep the parliamentary group label in politician_memberships.group_parliamentary,
-- but attach the membership to the current political party entity.

INSERT INTO parties (name, acronym, color, logo_url)
VALUES (
  'Podemos',
  'Podemos',
  '#7B2D8B',
  'https://upload.wikimedia.org/wikipedia/commons/4/4e/Logo_de_Podemos_%282022%29.svg'
)
ON CONFLICT (name) DO UPDATE SET
  acronym = EXCLUDED.acronym,
  color = EXCLUDED.color,
  logo_url = COALESCE(EXCLUDED.logo_url, parties.logo_url),
  updated_at = now();

WITH podemos AS (
  SELECT id FROM parties WHERE name = 'Podemos'
),
podemos_deputies AS (
  SELECT p.id AS politician_id
  FROM politicians p
  WHERE p.full_name IN (
    'Belarra Urteaga, Ione',
    'Sánchez Serna, Javier',
    'Santana Perera, Noemí',
    'Velarde Gómez, Martina'
  )
)
UPDATE politician_memberships pm
SET party_id = podemos.id
FROM podemos, podemos_deputies
WHERE pm.politician_id = podemos_deputies.politician_id
  AND pm.chamber = 'congress'
  AND pm.is_active = true;

DELETE FROM power_relationships pr
USING politicians person, parties party
WHERE pr.person_id = person.id
  AND pr.party_id = party.id
  AND pr.relationship_type = 'party_leader'
  AND party.name = 'SUMAR'
  AND person.full_name IN (
    'Belarra Urteaga, Ione',
    'Sánchez Serna, Javier',
    'Santana Perera, Noemí',
    'Velarde Gómez, Martina'
  );

WITH podemos AS (
  SELECT id FROM parties WHERE name = 'Podemos'
),
leader AS (
  SELECT id FROM politicians WHERE full_name = 'Belarra Urteaga, Ione'
),
members AS (
  SELECT id
  FROM politicians
  WHERE full_name IN (
    'Sánchez Serna, Javier',
    'Santana Perera, Noemí',
    'Velarde Gómez, Martina'
  )
)
INSERT INTO power_relationships
  (person_id, superior_id, relationship_type, party_id, description)
SELECT
  members.id,
  leader.id,
  'party_leader',
  podemos.id,
  'Responde ante el/la líder de Podemos'
FROM members, leader, podemos
WHERE NOT EXISTS (
  SELECT 1
  FROM power_relationships existing
  WHERE existing.person_id = members.id
    AND existing.superior_id = leader.id
    AND existing.relationship_type = 'party_leader'
    AND existing.party_id = podemos.id
);

INSERT INTO search_documents (
  entity_type,
  entity_id,
  title,
  subtitle,
  body,
  key_fact,
  route,
  source_url,
  document_date,
  amount,
  weight,
  metadata,
  search_vector,
  corpus_version,
  updated_at,
  display_title
)
SELECT
  'party',
  par.id::text,
  coalesce(par.acronym, par.name),
  par.name,
  concat_ws(' ', par.name, par.acronym),
  par.name,
  '/partidos/' || par.id::text,
  coalesce(par.website, par.wikipedia_url),
  NULL::date,
  NULL::numeric,
  8,
  jsonb_build_object('acronym', par.acronym, 'color', par.color),
  setweight(to_tsvector('simple', unaccent(coalesce(par.acronym, par.name, ''))), 'A') ||
    setweight(to_tsvector('spanish', unaccent(coalesce(par.name, ''))), 'B'),
  'v3',
  now(),
  NULL::text
FROM parties par
WHERE par.name IN ('Podemos', 'SUMAR')
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  body = EXCLUDED.body,
  key_fact = EXCLUDED.key_fact,
  route = EXCLUDED.route,
  source_url = EXCLUDED.source_url,
  document_date = EXCLUDED.document_date,
  amount = EXCLUDED.amount,
  weight = EXCLUDED.weight,
  metadata = EXCLUDED.metadata,
  search_vector = EXCLUDED.search_vector,
  corpus_version = EXCLUDED.corpus_version,
  updated_at = EXCLUDED.updated_at,
  display_title = EXCLUDED.display_title;
