-- Habilita RLS en tablas públicas que se quedaron sin él.
-- Sin ENABLE ROW LEVEL SECURITY, los GRANT SELECT a `anon` no entran en efecto
-- bajo políticas de PostgREST; el cliente publishable no puede leer estas tablas
-- de forma reproducible. Patrón replicado del initial_schema.sql original.

-- eu_funds (migración 20260521000000)
ALTER TABLE eu_funds ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'eu_funds' AND policyname = 'Public read access'
  ) THEN
    CREATE POLICY "Public read access" ON eu_funds FOR SELECT USING (true);
  END IF;
END $$;

-- institutional_appointments (migración 20260515230000)
ALTER TABLE institutional_appointments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'institutional_appointments' AND policyname = 'Public read access'
  ) THEN
    CREATE POLICY "Public read access" ON institutional_appointments FOR SELECT USING (true);
  END IF;
END $$;
