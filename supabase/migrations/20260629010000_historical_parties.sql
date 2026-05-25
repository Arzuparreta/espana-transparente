-- Insert historical/defunct parties that appear as actors in corruption cases
-- but no longer have parliamentary representation.
-- These won't appear on /partidos (which filters by active memberships)
-- but their /partidos/[id] pages will show their judicial case connections.
-- ON CONFLICT DO NOTHING is safe: the diputados pipeline never writes these.

INSERT INTO parties (name, acronym, color, wikipedia_url) VALUES
  ('Convergència Democràtica de Catalunya', 'CDC',  '#003082', 'https://es.wikipedia.org/wiki/Convergència_Democràtica_de_Catalunya'),
  ('Convergència i Unió',                   'CiU',  '#003082', 'https://es.wikipedia.org/wiki/Convergència_i_Unió'),
  ('Unió Democràtica de Catalunya',         'UDC',  '#0066cc', 'https://es.wikipedia.org/wiki/Unió_Democràtica_de_Catalunya'),
  ('Iniciativa per Catalunya Verds',        'ICV',  '#4caf50', 'https://es.wikipedia.org/wiki/Iniciativa_per_Catalunya_Verds'),
  ('Izquierda Unida',                       'IU',   '#d32f2f', 'https://es.wikipedia.org/wiki/Izquierda_Unida_(España)'),
  ('Grupo Independiente Liberal',           'GIL',  null,      'https://es.wikipedia.org/wiki/Grupo_Independiente_Liberal'),
  ('Unió Mallorquina',                      'UM',   null,      'https://es.wikipedia.org/wiki/Unió_Mallorquina'),
  ('Partido de Almería',                    'PA',   null,      null),
  ('Partido de Independientes de Lanzarote','PIL',  null,      null),
  ('Unión Cordobesa',                       'UC',   null,      null)
ON CONFLICT (name) DO NOTHING;

-- Back-fill party_id on already-reviewed actors that are now matchable.
-- Each UPDATE matches by exact actor_label so it's idempotent.
UPDATE corruption_case_actors cca
SET party_id = p.id,
    updated_at = now()
FROM parties p
WHERE cca.party_id IS NULL
  AND cca.politician_id IS NULL
  AND cca.organization_id IS NULL
  AND cca.review_status = 'reviewed'
  AND LOWER(cca.actor_label) = LOWER(p.name);
