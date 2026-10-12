-- Internal folder numbers can repeat across contracting authorities.
-- Preserve every UUID and legacy relationship; identify rows during verified source refresh.
ALTER TABLE public.contracts ADD COLUMN source_id text;
ALTER TABLE public.contracts ADD COLUMN published_edition jsonb;
ALTER TABLE public.contracts ADD COLUMN source_updated_at timestamptz;
ALTER TABLE public.contracts ADD COLUMN award_currency text;
ALTER TABLE public.contracts ADD COLUMN result_count integer GENERATED ALWAYS AS (jsonb_array_length(published_edition->'results')) STORED;
ALTER TABLE public.contracts ADD COLUMN lot_count integer GENERATED ALWAYS AS (jsonb_array_length(published_edition->'lots')) STORED;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_source_id_format CHECK (
 source_id IS NULL OR source_id ~ '^https://contrataciondelestado\.es/sindicacion/licitacionesPerfilContratante/[1-9][0-9]{0,19}$'
);
ALTER TABLE public.contracts ADD CONSTRAINT contracts_published_edition_format CHECK (
 published_edition IS NULL OR (
   published_edition->>'version'='pcsp-published-edition-v1'
   AND published_edition->>'source_id'=source_id
   AND jsonb_typeof(published_edition->'results')='array'
   AND jsonb_typeof(published_edition->'lots')='array'
   AND pg_column_size(published_edition)<2000000
 ) IS TRUE
);
ALTER TABLE public.contracts ADD CONSTRAINT contracts_source_id_key UNIQUE(source_id);
ALTER TABLE public.contracts DROP CONSTRAINT contracts_contract_folder_id_key;
CREATE INDEX contracts_folder_number_idx ON public.contracts(contract_folder_id);
CREATE INDEX contracts_legacy_source_url_idx ON public.contracts(md5(source_url)) WHERE source_id IS NULL;
COMMENT ON COLUMN public.contracts.source_id IS 'Official PCSP Atom identity; null means legacy identity not verified.';
COMMENT ON COLUMN public.contracts.published_edition IS 'Latest source edition: project and lot budgets, every TenderResult and original precision/currency. Not payments.';
