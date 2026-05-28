-- BDNS records with nivel1='AUTONOMICA' and nivel2='España' are pan-Spain grants
-- with no meaningful CCAA. Reclassify them as state-level so they don't appear
-- as a fake autonomous community in the /ccaa territory listing.
UPDATE subsidies
SET administration_level = 'state'
WHERE nivel1 = 'AUTONOMICA'
  AND lower(btrim(coalesce(nivel2, ''))) IN ('españa', 'espana', '');
