-- Call codes for which the BDNS API answers 204 (no published descriptor).
-- Lets the enrichment skip them for a while instead of retrying them first on every run.
CREATE TABLE public.bdns_call_misses (
  numero_convocatoria text PRIMARY KEY CHECK (numero_convocatoria ~ '^[0-9]{1,20}$'),
  checked_at timestamptz NOT NULL
);
ALTER TABLE public.bdns_call_misses ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.bdns_call_misses TO service_role;
