-- Fix assign_canonical_territory(): PL/pgSQL initializes every branch of a
-- CASE expression against the actual NEW record, so a single shared function
-- referencing both NEW.region (contracts) and NEW.nivel2 (subsidies) fails
-- with "record \"new\" has no field ..." on every insert/update of either
-- table. Split into one function per table, each touching only its own columns.

CREATE OR REPLACE FUNCTION assign_canonical_territory_contracts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolved territory_catalog%ROWTYPE;
BEGIN
  SELECT tc.*
  INTO resolved
  FROM territory_aliases ta
  JOIN territory_catalog tc ON tc.territory_key = ta.territory_key
  WHERE ta.alias_key = canonical_territory_alias(NEW.region);

  IF NOT FOUND THEN
    NEW.ccaa_key := NULL;
    NEW.province_key := NULL;
    RETURN NEW;
  END IF;

  IF resolved.territory_type = 'province' THEN
    NEW.ccaa_key := resolved.parent_key;
    NEW.province_key := resolved.territory_key;
  ELSE
    NEW.ccaa_key := resolved.territory_key;
    NEW.province_key := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION assign_canonical_territory_subsidies()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolved territory_catalog%ROWTYPE;
BEGIN
  SELECT tc.*
  INTO resolved
  FROM territory_aliases ta
  JOIN territory_catalog tc ON tc.territory_key = ta.territory_key
  WHERE ta.alias_key = canonical_territory_alias(NEW.nivel2);

  IF NOT FOUND THEN
    NEW.ccaa_key := NULL;
    NEW.province_key := NULL;
    RETURN NEW;
  END IF;

  IF resolved.territory_type = 'province' THEN
    NEW.ccaa_key := resolved.parent_key;
  ELSE
    NEW.ccaa_key := resolved.territory_key;
  END IF;
  NEW.province_key := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contracts_assign_canonical_territory ON contracts;
CREATE TRIGGER contracts_assign_canonical_territory
BEFORE INSERT OR UPDATE OF region, administration_level ON contracts
FOR EACH ROW EXECUTE FUNCTION assign_canonical_territory_contracts();

DROP TRIGGER IF EXISTS subsidies_assign_canonical_territory ON subsidies;
CREATE TRIGGER subsidies_assign_canonical_territory
BEFORE INSERT OR UPDATE OF nivel2, administration_level ON subsidies
FOR EACH ROW EXECUTE FUNCTION assign_canonical_territory_subsidies();

DROP FUNCTION IF EXISTS assign_canonical_territory();
