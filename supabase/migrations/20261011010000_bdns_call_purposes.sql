-- Public descriptors, one row per official call code. No beneficiary data.
CREATE TABLE public.bdns_calls (
  numero_convocatoria text PRIMARY KEY CHECK (numero_convocatoria ~ '^[0-9]{1,20}$'),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 2000),
  finalidad text CHECK (length(finalidad) BETWEEN 1 AND 512),
  tipo_convocatoria text CHECK (length(tipo_convocatoria) BETWEEN 1 AND 256),
  source_url text NOT NULL,
  checked_at timestamptz NOT NULL,
  mapping_version text NOT NULL DEFAULT 'bdns-finalidad-description-v1'
    CHECK (mapping_version='bdns-finalidad-description-v1')
);
ALTER TABLE public.bdns_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY bdns_calls_read ON public.bdns_calls FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.bdns_calls TO anon, authenticated;
GRANT ALL ON public.bdns_calls TO service_role;

-- Each grant joins at most one call. Never multiply concessions by call instruments.
-- Group amounts by the instrument of the concession, not by call budget/instrument.
CREATE FUNCTION public.subsidy_purpose_year(p_year integer)
RETURNS TABLE(finalidad text, classification text, instrumento text,
  grant_count bigint, call_count bigint, known_amount numeric,
  unknown_amount_count bigint, negative_amount_count bigint, last_checked timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT c.finalidad,
    CASE WHEN c.numero_convocatoria IS NULL THEN 'pending'
         WHEN c.finalidad IS NULL THEN 'not_published' ELSE 'classified' END,
    nullif(btrim(s.instrumento), ''), count(*), count(DISTINCT s.numero_convocatoria),
    sum(s.importe) FILTER (WHERE s.importe >= 0 AND s.importe < 'Infinity'::numeric),
    count(*) FILTER (WHERE s.importe IS NULL OR s.importe IN ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
    count(*) FILTER (WHERE s.importe < 0 AND s.importe > '-Infinity'::numeric),
    min(c.checked_at)
  FROM subsidies s LEFT JOIN bdns_calls c USING (numero_convocatoria)
  WHERE p_year BETWEEN 2014 AND 2100
    AND s.fecha_concesion >= make_date(p_year,1,1)
    AND s.fecha_concesion < make_date(p_year+1,1,1)
  GROUP BY c.finalidad,
    CASE WHEN c.numero_convocatoria IS NULL THEN 'pending'
         WHEN c.finalidad IS NULL THEN 'not_published' ELSE 'classified' END,
    nullif(btrim(s.instrumento), '')
  ORDER BY 3 NULLS LAST, 1 NULLS LAST, 2
$$;
REVOKE ALL ON FUNCTION public.subsidy_purpose_year(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subsidy_purpose_year(integer) TO anon, authenticated, service_role;

-- Two public call descriptors verified against the official endpoint on 2026-10-11.
INSERT INTO bdns_calls (numero_convocatoria,title,finalidad,tipo_convocatoria,source_url,checked_at) VALUES
('612093','Resolución de la entidad pública empresarial red.es, M.P. por la que se convocan las ayudas destinadas a la digitalización de empresas del segmento I en el marco de la agenda España digital 2025, Programa Kit Digital','Comercio, Turismo y Pymes','Concesión directa - canónica','https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/612093','2026-10-11T21:20:54.790822+00:00'),
('877378','Ayudas a los Seguros para las estructuras, coberturas e instalaciones de invernaderos, umbráculos y túneles.','Agricultura, Pesca y Alimentación','Concurrencia competitiva - canónica','https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/877378','2026-10-11T21:20:54.890532+00:00');
INSERT INTO etl_runs (pipeline,chunk_key,status,rows_read,rows_inserted,finished_at) VALUES ('bdns.convocatorias','initial-official-calls-2026-10-11','succeeded',2,2,now());
