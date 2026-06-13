-- Canonical territorial model for /territorio.
-- Raw source labels remain untouched in contracts.region and subsidies.nivel2.

CREATE TABLE IF NOT EXISTS territory_catalog (
  territory_key text PRIMARY KEY,
  territory_name text NOT NULL,
  territory_type text NOT NULL CHECK (territory_type IN ('ccaa', 'province')),
  parent_key text REFERENCES territory_catalog(territory_key),
  nuts_code text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS territory_aliases (
  alias_key text PRIMARY KEY,
  territory_key text NOT NULL REFERENCES territory_catalog(territory_key),
  source_note text
);

CREATE TABLE IF NOT EXISTS territory_population (
  territory_key text NOT NULL REFERENCES territory_catalog(territory_key),
  year integer NOT NULL CHECK (year BETWEEN 1990 AND 2100),
  population bigint NOT NULL CHECK (population > 0),
  source_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (territory_key, year)
);

INSERT INTO territory_catalog
  (territory_key, territory_name, territory_type, parent_key, nuts_code, sort_order)
VALUES
  ('ANDALUCIA', 'Andalucía', 'ccaa', NULL, 'ES61', 1),
  ('ARAGON', 'Aragón', 'ccaa', NULL, 'ES24', 2),
  ('ASTURIAS', 'Asturias', 'ccaa', NULL, 'ES12', 3),
  ('ILLES_BALEARS', 'Illes Balears', 'ccaa', NULL, 'ES53', 4),
  ('CANARIAS', 'Canarias', 'ccaa', NULL, 'ES70', 5),
  ('CANTABRIA', 'Cantabria', 'ccaa', NULL, 'ES13', 6),
  ('CASTILLA_Y_LEON', 'Castilla y León', 'ccaa', NULL, 'ES41', 7),
  ('CASTILLA_LA_MANCHA', 'Castilla-La Mancha', 'ccaa', NULL, 'ES42', 8),
  ('CATALUNYA', 'Cataluña', 'ccaa', NULL, 'ES51', 9),
  ('COMUNITAT_VALENCIANA', 'Comunitat Valenciana', 'ccaa', NULL, 'ES52', 10),
  ('EXTREMADURA', 'Extremadura', 'ccaa', NULL, 'ES43', 11),
  ('GALICIA', 'Galicia', 'ccaa', NULL, 'ES11', 12),
  ('MADRID', 'Madrid', 'ccaa', NULL, 'ES30', 13),
  ('MURCIA', 'Murcia', 'ccaa', NULL, 'ES62', 14),
  ('NAVARRA', 'Navarra', 'ccaa', NULL, 'ES22', 15),
  ('PAIS_VASCO', 'País Vasco', 'ccaa', NULL, 'ES21', 16),
  ('LA_RIOJA', 'La Rioja', 'ccaa', NULL, 'ES23', 17),
  ('CEUTA', 'Ceuta', 'ccaa', NULL, 'ES63', 18),
  ('MELILLA', 'Melilla', 'ccaa', NULL, 'ES64', 19)
ON CONFLICT (territory_key) DO UPDATE SET
  territory_name = EXCLUDED.territory_name,
  nuts_code = EXCLUDED.nuts_code,
  sort_order = EXCLUDED.sort_order;

INSERT INTO territory_catalog
  (territory_key, territory_name, territory_type, parent_key, sort_order)
VALUES
  ('ALMERIA', 'Almería', 'province', 'ANDALUCIA', 1),
  ('CADIZ', 'Cádiz', 'province', 'ANDALUCIA', 2),
  ('CORDOBA', 'Córdoba', 'province', 'ANDALUCIA', 3),
  ('GRANADA', 'Granada', 'province', 'ANDALUCIA', 4),
  ('HUELVA', 'Huelva', 'province', 'ANDALUCIA', 5),
  ('JAEN', 'Jaén', 'province', 'ANDALUCIA', 6),
  ('MALAGA', 'Málaga', 'province', 'ANDALUCIA', 7),
  ('SEVILLA', 'Sevilla', 'province', 'ANDALUCIA', 8),
  ('HUESCA', 'Huesca', 'province', 'ARAGON', 9),
  ('TERUEL', 'Teruel', 'province', 'ARAGON', 10),
  ('ZARAGOZA', 'Zaragoza', 'province', 'ARAGON', 11),
  ('ASTURIAS_PROVINCE', 'Asturias', 'province', 'ASTURIAS', 12),
  ('ILLES_BALEARS_PROVINCE', 'Illes Balears', 'province', 'ILLES_BALEARS', 13),
  ('LAS_PALMAS', 'Las Palmas', 'province', 'CANARIAS', 14),
  ('SANTA_CRUZ_DE_TENERIFE', 'Santa Cruz de Tenerife', 'province', 'CANARIAS', 15),
  ('CANTABRIA_PROVINCE', 'Cantabria', 'province', 'CANTABRIA', 16),
  ('AVILA', 'Ávila', 'province', 'CASTILLA_Y_LEON', 17),
  ('BURGOS', 'Burgos', 'province', 'CASTILLA_Y_LEON', 18),
  ('LEON', 'León', 'province', 'CASTILLA_Y_LEON', 19),
  ('PALENCIA', 'Palencia', 'province', 'CASTILLA_Y_LEON', 20),
  ('SALAMANCA', 'Salamanca', 'province', 'CASTILLA_Y_LEON', 21),
  ('SEGOVIA', 'Segovia', 'province', 'CASTILLA_Y_LEON', 22),
  ('SORIA', 'Soria', 'province', 'CASTILLA_Y_LEON', 23),
  ('VALLADOLID', 'Valladolid', 'province', 'CASTILLA_Y_LEON', 24),
  ('ZAMORA', 'Zamora', 'province', 'CASTILLA_Y_LEON', 25),
  ('ALBACETE', 'Albacete', 'province', 'CASTILLA_LA_MANCHA', 26),
  ('CIUDAD_REAL', 'Ciudad Real', 'province', 'CASTILLA_LA_MANCHA', 27),
  ('CUENCA', 'Cuenca', 'province', 'CASTILLA_LA_MANCHA', 28),
  ('GUADALAJARA', 'Guadalajara', 'province', 'CASTILLA_LA_MANCHA', 29),
  ('TOLEDO', 'Toledo', 'province', 'CASTILLA_LA_MANCHA', 30),
  ('BARCELONA', 'Barcelona', 'province', 'CATALUNYA', 31),
  ('GIRONA', 'Girona', 'province', 'CATALUNYA', 32),
  ('LLEIDA', 'Lleida', 'province', 'CATALUNYA', 33),
  ('TARRAGONA', 'Tarragona', 'province', 'CATALUNYA', 34),
  ('ALICANTE', 'Alicante/Alacant', 'province', 'COMUNITAT_VALENCIANA', 35),
  ('CASTELLON', 'Castellón/Castelló', 'province', 'COMUNITAT_VALENCIANA', 36),
  ('VALENCIA', 'Valencia/València', 'province', 'COMUNITAT_VALENCIANA', 37),
  ('BADAJOZ', 'Badajoz', 'province', 'EXTREMADURA', 38),
  ('CACERES', 'Cáceres', 'province', 'EXTREMADURA', 39),
  ('A_CORUNA', 'A Coruña', 'province', 'GALICIA', 40),
  ('LUGO', 'Lugo', 'province', 'GALICIA', 41),
  ('OURENSE', 'Ourense', 'province', 'GALICIA', 42),
  ('PONTEVEDRA', 'Pontevedra', 'province', 'GALICIA', 43),
  ('MADRID_PROVINCE', 'Madrid', 'province', 'MADRID', 44),
  ('MURCIA_PROVINCE', 'Murcia', 'province', 'MURCIA', 45),
  ('NAVARRA_PROVINCE', 'Navarra', 'province', 'NAVARRA', 46),
  ('ALAVA', 'Álava', 'province', 'PAIS_VASCO', 47),
  ('BIZKAIA', 'Bizkaia', 'province', 'PAIS_VASCO', 48),
  ('GIPUZKOA', 'Gipuzkoa', 'province', 'PAIS_VASCO', 49),
  ('LA_RIOJA_PROVINCE', 'La Rioja', 'province', 'LA_RIOJA', 50),
  ('CEUTA_PROVINCE', 'Ceuta', 'province', 'CEUTA', 51),
  ('MELILLA_PROVINCE', 'Melilla', 'province', 'MELILLA', 52)
ON CONFLICT (territory_key) DO UPDATE SET
  territory_name = EXCLUDED.territory_name,
  parent_key = EXCLUDED.parent_key,
  sort_order = EXCLUDED.sort_order;

-- CCAA labels. Province labels below deliberately take precedence for PCSP.
INSERT INTO territory_aliases (alias_key, territory_key, source_note)
VALUES
  ('ANDALUCIA', 'ANDALUCIA', 'ccaa'),
  ('ARAGON', 'ARAGON', 'ccaa'),
  ('ARAGONESA', 'ARAGON', 'ccaa'),
  ('ASTURIAS', 'ASTURIAS', 'ccaa'),
  ('PRINCIPADO DE ASTURIAS', 'ASTURIAS', 'ccaa'),
  ('EL PRINCIPADO DE ASTURIAS', 'ASTURIAS', 'ccaa'),
  ('BALEARES', 'ILLES_BALEARS', 'ccaa'),
  ('ILLES BALEARS', 'ILLES_BALEARS', 'ccaa'),
  ('ISLAS BALEARES', 'ILLES_BALEARS', 'ccaa'),
  ('CANARIAS', 'CANARIAS', 'ccaa'),
  ('ISLAS CANARIAS', 'CANARIAS', 'ccaa'),
  ('CANTABRIA', 'CANTABRIA', 'ccaa'),
  ('CASTILLA Y LEON', 'CASTILLA_Y_LEON', 'ccaa'),
  ('CASTILLA LEON', 'CASTILLA_Y_LEON', 'ccaa'),
  ('CASTILLA-LA MANCHA', 'CASTILLA_LA_MANCHA', 'ccaa'),
  ('CASTILLA LA MANCHA', 'CASTILLA_LA_MANCHA', 'ccaa'),
  ('CATALUNA', 'CATALUNYA', 'ccaa'),
  ('CATALUNYA', 'CATALUNYA', 'ccaa'),
  ('COMUNITAT VALENCIANA', 'COMUNITAT_VALENCIANA', 'ccaa'),
  ('COMUNIDAD VALENCIANA', 'COMUNITAT_VALENCIANA', 'ccaa'),
  ('EXTREMADURA', 'EXTREMADURA', 'ccaa'),
  ('GALICIA', 'GALICIA', 'ccaa'),
  ('COMUNIDAD DE MADRID', 'MADRID', 'ccaa'),
  ('REGION DE MURCIA', 'MURCIA', 'ccaa'),
  ('COMUNIDAD FORAL DE NAVARRA', 'NAVARRA', 'ccaa'),
  ('PAIS VASCO', 'PAIS_VASCO', 'ccaa'),
  ('EUSKADI', 'PAIS_VASCO', 'ccaa'),
  ('LA RIOJA', 'LA_RIOJA', 'ccaa'),
  ('CIUDAD AUTONOMA DE CEUTA', 'CEUTA', 'ccaa'),
  ('CIUDAD DE CEUTA', 'CEUTA', 'ccaa'),
  ('CIUDAD AUTONOMA DE MELILLA', 'MELILLA', 'ccaa')
ON CONFLICT (alias_key) DO UPDATE SET
  territory_key = EXCLUDED.territory_key,
  source_note = EXCLUDED.source_note;

INSERT INTO territory_aliases (alias_key, territory_key, source_note)
VALUES
  ('ALMERIA', 'ALMERIA', 'province'), ('CADIZ', 'CADIZ', 'province'),
  ('CORDOBA', 'CORDOBA', 'province'), ('GRANADA', 'GRANADA', 'province'),
  ('HUELVA', 'HUELVA', 'province'), ('JAEN', 'JAEN', 'province'),
  ('MALAGA', 'MALAGA', 'province'), ('SEVILLA', 'SEVILLA', 'province'),
  ('HUESCA', 'HUESCA', 'province'), ('TERUEL', 'TERUEL', 'province'),
  ('ZARAGOZA', 'ZARAGOZA', 'province'), ('OVIEDO', 'ASTURIAS_PROVINCE', 'province'),
  ('MALLORCA', 'ILLES_BALEARS_PROVINCE', 'island'),
  ('MENORCA', 'ILLES_BALEARS_PROVINCE', 'island'),
  ('EIVISSA Y FORMENTERA', 'ILLES_BALEARS_PROVINCE', 'island'),
  ('LAS PALMAS', 'LAS_PALMAS', 'province'), ('PALMAS, LAS', 'LAS_PALMAS', 'province'),
  ('GRAN CANARIA', 'LAS_PALMAS', 'island'), ('LANZAROTE', 'LAS_PALMAS', 'island'),
  ('FUERTEVENTURA', 'LAS_PALMAS', 'island'),
  ('SANTA CRUZ DE TENERIFE', 'SANTA_CRUZ_DE_TENERIFE', 'province'),
  ('TENERIFE', 'SANTA_CRUZ_DE_TENERIFE', 'island'),
  ('LA PALMA', 'SANTA_CRUZ_DE_TENERIFE', 'island'),
  ('LA GOMERA', 'SANTA_CRUZ_DE_TENERIFE', 'island'),
  ('EL HIERRO', 'SANTA_CRUZ_DE_TENERIFE', 'island'),
  ('AVILA', 'AVILA', 'province'), ('BURGOS', 'BURGOS', 'province'),
  ('LEON', 'LEON', 'province'), ('PALENCIA', 'PALENCIA', 'province'),
  ('SALAMANCA', 'SALAMANCA', 'province'), ('SEGOVIA', 'SEGOVIA', 'province'),
  ('SORIA', 'SORIA', 'province'), ('VALLADOLID', 'VALLADOLID', 'province'),
  ('ZAMORA', 'ZAMORA', 'province'), ('ALBACETE', 'ALBACETE', 'province'),
  ('CIUDAD REAL', 'CIUDAD_REAL', 'province'), ('CIUDADREAL', 'CIUDAD_REAL', 'province'),
  ('CUENCA', 'CUENCA', 'province'), ('GUADALAJARA', 'GUADALAJARA', 'province'),
  ('TOLEDO', 'TOLEDO', 'province'), ('BARCELONA', 'BARCELONA', 'province'),
  ('GIRONA', 'GIRONA', 'province'), ('GERONA', 'GIRONA', 'province'),
  ('LLEIDA', 'LLEIDA', 'province'), ('LERIDA', 'LLEIDA', 'province'),
  ('TARRAGONA', 'TARRAGONA', 'province'),
  ('ALICANTE', 'ALICANTE', 'province'), ('ALICANTE/ALACANT', 'ALICANTE', 'province'),
  ('ALICANTE / ALACANT', 'ALICANTE', 'province'), ('ALACANT/ALICANTE', 'ALICANTE', 'province'),
  ('CASTELLON', 'CASTELLON', 'province'), ('CASTELLON/CASTELLO', 'CASTELLON', 'province'),
  ('CASTELLON / CASTELLO', 'CASTELLON', 'province'), ('CASTELLO/CASTELLON', 'CASTELLON', 'province'),
  ('VALENCIA', 'VALENCIA', 'province'), ('VALENCIA/VALENCIA', 'VALENCIA', 'province'),
  ('VALENCIA / VALENCIA', 'VALENCIA', 'province'), ('VALENCIA (VALENCIA)', 'VALENCIA', 'province'),
  ('BADAJOZ', 'BADAJOZ', 'province'), ('CACERES', 'CACERES', 'province'),
  ('A CORUNA', 'A_CORUNA', 'province'), ('LA CORUNA', 'A_CORUNA', 'province'),
  ('CORUNA, A', 'A_CORUNA', 'province'), ('LUGO', 'LUGO', 'province'),
  ('OURENSE', 'OURENSE', 'province'), ('OURENSE (ORENSE)', 'OURENSE', 'province'),
  ('ORENSE', 'OURENSE', 'province'), ('PONTEVEDRA', 'PONTEVEDRA', 'province'),
  ('MADRID', 'MADRID_PROVINCE', 'province'), ('MURCIA', 'MURCIA_PROVINCE', 'province'),
  ('NAVARRA', 'NAVARRA_PROVINCE', 'province'),
  ('ALAVA', 'ALAVA', 'province'), ('ARABA / ALAVA', 'ALAVA', 'province'),
  ('ARABA/ALAVA', 'ALAVA', 'province'), ('BIZKAIA', 'BIZKAIA', 'province'),
  ('VIZCAYA', 'BIZKAIA', 'province'), ('GIPUZKOA', 'GIPUZKOA', 'province'),
  ('GUIPUZCOA', 'GIPUZKOA', 'province'), ('RIOJA, LA', 'LA_RIOJA_PROVINCE', 'province'),
  ('CEUTA', 'CEUTA_PROVINCE', 'province'), ('MELILLA', 'MELILLA_PROVINCE', 'province')
ON CONFLICT (alias_key) DO UPDATE SET
  territory_key = EXCLUDED.territory_key,
  source_note = EXCLUDED.source_note;

CREATE OR REPLACE FUNCTION canonical_territory_alias(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    trim(
      regexp_replace(
        regexp_replace(
          upper(unaccent(coalesce(input, ''))),
          '\s*/\s*',
          '/',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  )
$$;

ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS ccaa_key text REFERENCES territory_catalog(territory_key),
  ADD COLUMN IF NOT EXISTS province_key text REFERENCES territory_catalog(territory_key);

ALTER TABLE subsidies
  ADD COLUMN IF NOT EXISTS ccaa_key text REFERENCES territory_catalog(territory_key),
  ADD COLUMN IF NOT EXISTS province_key text REFERENCES territory_catalog(territory_key);

CREATE OR REPLACE FUNCTION assign_canonical_territory()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolved territory_catalog%ROWTYPE;
  raw_value text;
BEGIN
  raw_value := CASE
    WHEN TG_TABLE_NAME = 'contracts' THEN NEW.region
    ELSE NEW.nivel2
  END;

  SELECT tc.*
  INTO resolved
  FROM territory_aliases ta
  JOIN territory_catalog tc ON tc.territory_key = ta.territory_key
  WHERE ta.alias_key = canonical_territory_alias(raw_value);

  IF NOT FOUND THEN
    NEW.ccaa_key := NULL;
    NEW.province_key := NULL;
    RETURN NEW;
  END IF;

  IF resolved.territory_type = 'province' THEN
    NEW.ccaa_key := resolved.parent_key;
    NEW.province_key := CASE WHEN TG_TABLE_NAME = 'contracts' THEN resolved.territory_key END;
  ELSE
    NEW.ccaa_key := resolved.territory_key;
    NEW.province_key := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contracts_assign_canonical_territory ON contracts;
CREATE TRIGGER contracts_assign_canonical_territory
BEFORE INSERT OR UPDATE OF region, administration_level ON contracts
FOR EACH ROW EXECUTE FUNCTION assign_canonical_territory();

DROP TRIGGER IF EXISTS subsidies_assign_canonical_territory ON subsidies;
CREATE TRIGGER subsidies_assign_canonical_territory
BEFORE INSERT OR UPDATE OF nivel2, administration_level ON subsidies
FOR EACH ROW EXECUTE FUNCTION assign_canonical_territory();

UPDATE contracts c
SET
  ccaa_key = CASE WHEN tc.territory_type = 'province' THEN tc.parent_key ELSE tc.territory_key END,
  province_key = CASE WHEN tc.territory_type = 'province' THEN tc.territory_key END
FROM territory_aliases ta
JOIN territory_catalog tc ON tc.territory_key = ta.territory_key
WHERE c.administration_level = 'autonomic'
  AND ta.alias_key = canonical_territory_alias(c.region);

UPDATE subsidies s
SET
  ccaa_key = CASE WHEN tc.territory_type = 'province' THEN tc.parent_key ELSE tc.territory_key END,
  province_key = NULL
FROM territory_aliases ta
JOIN territory_catalog tc ON tc.territory_key = ta.territory_key
WHERE s.administration_level = 'autonomic'
  AND ta.alias_key = canonical_territory_alias(s.nivel2);

CREATE INDEX IF NOT EXISTS contracts_ccaa_year_idx ON contracts (ccaa_key, date);
CREATE INDEX IF NOT EXISTS contracts_province_year_idx ON contracts (province_key, date);
CREATE INDEX IF NOT EXISTS subsidies_ccaa_year_idx ON subsidies (ccaa_key, fecha_concesion);

DROP MATERIALIZED VIEW IF EXISTS v_territory_spend_yearly;
CREATE MATERIALIZED VIEW v_territory_spend_yearly AS
WITH source_rows AS (
  SELECT
    'contracts'::text AS dataset,
    c.id,
    c.date AS record_date,
    c.amount::numeric AS amount,
    c.region AS raw_territory,
    c.ccaa_key,
    c.province_key
  FROM contracts c
  WHERE c.administration_level = 'autonomic'

  UNION ALL

  SELECT
    'subsidies'::text AS dataset,
    s.id,
    s.fecha_concesion AS record_date,
    s.importe::numeric AS amount,
    s.nivel2 AS raw_territory,
    s.ccaa_key,
    NULL::text AS province_key
  FROM subsidies s
  WHERE s.administration_level = 'autonomic'
)
SELECT
  dataset,
  extract(year FROM record_date)::integer AS year,
  ccaa_key,
  province_key,
  count(*)::bigint AS record_count,
  coalesce(sum(amount), 0)::numeric AS total_amount,
  max(record_date) AS latest_record_date
FROM source_rows
WHERE ccaa_key IS NOT NULL
GROUP BY dataset, extract(year FROM record_date)::integer, ccaa_key, province_key;

CREATE UNIQUE INDEX v_territory_spend_yearly_identity_idx
  ON v_territory_spend_yearly
  (dataset, year, ccaa_key, coalesce(province_key, ''));
CREATE INDEX v_territory_spend_yearly_ccaa_idx
  ON v_territory_spend_yearly (ccaa_key, year, dataset);

CREATE OR REPLACE VIEW v_territory_spend_coverage
WITH (security_invoker = true) AS
WITH source_rows AS (
  SELECT 'contracts'::text AS dataset, c.ccaa_key
  FROM contracts c WHERE c.administration_level = 'autonomic'
  UNION ALL
  SELECT 'subsidies'::text AS dataset, s.ccaa_key
  FROM subsidies s WHERE s.administration_level = 'autonomic'
)
SELECT
  source_rows.dataset,
  count(*)::bigint AS total_records,
  count(*) FILTER (WHERE source_rows.ccaa_key IS NOT NULL)::bigint AS resolved_records,
  count(*) FILTER (WHERE source_rows.ccaa_key IS NULL)::bigint AS unresolved_records
FROM source_rows
GROUP BY source_rows.dataset;

CREATE OR REPLACE FUNCTION refresh_territory_atlas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW v_territory_spend_yearly;
END;
$$;

ALTER TABLE territory_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE territory_population ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "territory_catalog_public_read" ON territory_catalog;
CREATE POLICY "territory_catalog_public_read" ON territory_catalog FOR SELECT USING (true);
DROP POLICY IF EXISTS "territory_aliases_public_read" ON territory_aliases;
CREATE POLICY "territory_aliases_public_read" ON territory_aliases FOR SELECT USING (true);
DROP POLICY IF EXISTS "territory_population_public_read" ON territory_population;
CREATE POLICY "territory_population_public_read" ON territory_population FOR SELECT USING (true);

GRANT SELECT ON territory_catalog, territory_aliases, territory_population,
  v_territory_spend_yearly, v_territory_spend_coverage TO anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_territory_atlas() TO authenticated;
