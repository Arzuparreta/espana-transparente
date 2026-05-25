-- Extiende institutional_appointments para cubrir cualquier organismo público,
-- no solo TC/CGPJ/RTVE/SEPI. La fuente de verdad para estos nuevos registros
-- es el pipeline etl/src/public_bodies/boe_nombramientos.py (BOE open data API).

-- 1. Quitar el CHECK hardcoded — institution pasa a ser texto libre normalizado
ALTER TABLE institutional_appointments
  DROP CONSTRAINT IF EXISTS institutional_appointments_institution_check;

-- 2. FK opcional a organizations para organismos que ya estén en nuestra tabla
ALTER TABLE institutional_appointments
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_ia_organization
  ON institutional_appointments (organization_id)
  WHERE organization_id IS NOT NULL;

-- 3. Regenerar la vista para incluir el enlace a organizations
-- CREATE OR REPLACE no puede reordenar columnas; usamos DROP + CREATE
DROP VIEW IF EXISTS v_instituciones_actuales;

CREATE VIEW v_instituciones_actuales AS
SELECT
  ia.id,
  ia.institution,
  ia.position_title,
  ia.person_name,
  ia.political_party,
  ia.nominating_body,
  ia.appointment_date,
  ia.end_date,
  ia.source_url,
  ia.raw_data,
  ia.politician_id,
  p.photo_url,
  p.photo_variants,
  COALESCE(pr_abbr.color, pr_name.color) AS party_color,
  EXISTS (
    SELECT 1
    FROM revolving_door rd
    WHERE lower(unaccent(rd.person_name)) % lower(unaccent(ia.person_name))
      AND rd.verification_status = 'verified'
  ) AS has_revolving_door,
  -- nuevas columnas al final para compatibilidad con CREATE OR REPLACE
  ia.organization_id,
  o.name AS organization_name
FROM institutional_appointments ia
LEFT JOIN politicians p ON p.id = ia.politician_id
LEFT JOIN organizations o ON o.id = ia.organization_id
LEFT JOIN parties pr_abbr
  ON lower(pr_abbr.acronym) = lower(ia.political_party)
LEFT JOIN parties pr_name
  ON lower(pr_name.name) = lower(ia.political_party)
WHERE ia.end_date IS NULL OR ia.end_date >= CURRENT_DATE
ORDER BY ia.institution, ia.appointment_date;

GRANT SELECT ON v_instituciones_actuales TO anon, authenticated;
