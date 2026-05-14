-- Añade cod_parlamentario como columna explícita en politicians.
-- Antes se infería desde photo_url (https://congreso.es/img/diputados/<cod>.jpg),
-- pero fotos.py (Wikidata) sobreescribe photo_url y el cod se perdía.
-- declaraciones.py lo usa para descargar PDFs de bienes/intereses económicos.

ALTER TABLE politicians
  ADD COLUMN IF NOT EXISTS cod_parlamentario text;

CREATE UNIQUE INDEX IF NOT EXISTS politicians_cod_parlamentario_idx
  ON politicians (cod_parlamentario)
  WHERE cod_parlamentario IS NOT NULL;

-- Backfill desde photo_url para filas que aún tengan la URL del Congreso.
UPDATE politicians
SET cod_parlamentario = (
  regexp_match(photo_url, '/diputados/(\d+)\.jpg')
)[1]
WHERE cod_parlamentario IS NULL
  AND photo_url LIKE '%congreso.es%/diputados/%.jpg';
