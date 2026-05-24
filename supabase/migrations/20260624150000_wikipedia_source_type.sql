-- Add 'wikipedia' as an allowed source_type for corruption_cases.
-- Wikipedia serves as a discovery/catalog layer; published rows link to official
-- documents (BOE, CENDOJ) referenced in Wikipedia footnotes.

ALTER TABLE corruption_cases
  DROP CONSTRAINT IF EXISTS corruption_cases_source_type_check;

ALTER TABLE corruption_cases
  ADD CONSTRAINT corruption_cases_source_type_check
  CHECK (
    source_type IN (
      'cgpj',
      'cendoj',
      'boe',
      'court_press',
      'institutional_release',
      'wikipedia'
    )
  );
