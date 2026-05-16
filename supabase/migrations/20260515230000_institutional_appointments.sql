-- Tabla de nombramientos políticos en organismos institucionales:
-- TC (Tribunal Constitucional), CGPJ, RTVE, SEPI.
-- Fuente de verdad: etl/data/instituciones_nombramientos.yml

CREATE TABLE IF NOT EXISTS institutional_appointments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution      text        NOT NULL CHECK (institution IN ('TC','CGPJ','RTVE','SEPI')),
  position_title   text        NOT NULL,
  person_name      text        NOT NULL,
  politician_id    uuid        REFERENCES politicians(id),
  political_party  text,
  nominating_body  text,       -- Congreso, Senado, CGPJ, Gobierno
  appointment_date date,
  end_date         date,
  source_url       text,
  raw_data         jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ia_person_institution
  ON institutional_appointments (lower(person_name), institution, COALESCE(appointment_date, '1900-01-01'));

CREATE INDEX IF NOT EXISTS idx_ia_institution ON institutional_appointments (institution);
CREATE INDEX IF NOT EXISTS idx_ia_active      ON institutional_appointments (institution, end_date);
CREATE INDEX IF NOT EXISTS idx_ia_politician  ON institutional_appointments (politician_id) WHERE politician_id IS NOT NULL;

-- Vista pública para el frontend
CREATE OR REPLACE VIEW v_instituciones_actuales AS
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
  -- politician link (fuzzy match pre-computed by ETL into politician_id)
  ia.politician_id,
  p.photo_url,
  p.photo_variants,
  -- party color token
  COALESCE(pr_abbr.color, pr_name.color) AS party_color,
  -- revolving-door cross-link
  EXISTS (
    SELECT 1
    FROM revolving_door rd
    WHERE lower(unaccent(rd.person_name)) % lower(unaccent(ia.person_name))
      AND rd.verification_status = 'verified'
  ) AS has_revolving_door
FROM institutional_appointments ia
LEFT JOIN politicians p ON p.id = ia.politician_id
LEFT JOIN parties pr_abbr
  ON lower(pr_abbr.acronym) = lower(ia.political_party)
LEFT JOIN parties pr_name
  ON lower(pr_name.name) = lower(ia.political_party)
WHERE ia.end_date IS NULL OR ia.end_date >= CURRENT_DATE
ORDER BY ia.institution, ia.appointment_date;

GRANT SELECT ON v_instituciones_actuales TO anon, authenticated;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION _set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ia_updated_at'
  ) THEN
    CREATE TRIGGER trg_ia_updated_at
    BEFORE UPDATE ON institutional_appointments
    FOR EACH ROW EXECUTE FUNCTION _set_updated_at();
  END IF;
END $$;
