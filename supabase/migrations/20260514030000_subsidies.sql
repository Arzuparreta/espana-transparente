-- Subsidies from BDNS (Base de Datos Nacional de Subvenciones)
-- Source: https://www.infosubvenciones.es — API pública de concesiones
CREATE TABLE subsidies (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  bdns_id          bigint  UNIQUE NOT NULL,          -- id from BDNS API
  cod_concesion    text    UNIQUE,                   -- e.g. "SB151377181"
  fecha_concesion  date,
  beneficiario     text,                             -- anonymized for individuals
  instrumento      text,                             -- e.g. "SUBVENCIÓN y ENTREGA DINERARIA..."
  importe          numeric,
  convocatoria     text,                             -- call title
  numero_convocatoria text,
  nivel1           text,                             -- AUTONOMICA / LOCAL / ESTATAL
  nivel2           text,                             -- e.g. "COMUNIDAD FORAL DE NAVARRA"
  nivel3           text,                             -- granting body / órgano concedente
  source_url       text,                             -- urlBR from API
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX subsidies_importe_idx        ON subsidies (importe DESC NULLS LAST);
CREATE INDEX subsidies_fecha_idx          ON subsidies (fecha_concesion DESC);
CREATE INDEX subsidies_nivel1_idx         ON subsidies (nivel1);
CREATE INDEX subsidies_nivel3_idx         ON subsidies (nivel3);
CREATE INDEX subsidies_beneficiario_trgm  ON subsidies USING gin (beneficiario gin_trgm_ops);

ALTER TABLE subsidies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subsidies_public_read" ON subsidies FOR SELECT USING (true);
