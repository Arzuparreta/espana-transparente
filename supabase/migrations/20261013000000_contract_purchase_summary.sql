-- What is bought and how competitive was each published award?
-- Aggregate of PCSP records by award year, administration level and CPV division.
-- Budgets are project tender budgets excluding VAT: not awarded amounts, not payments.

CREATE OR REPLACE FUNCTION public.safe_iso_date(value text) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF value IS NULL OR left(value, 10) !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN NULL; END IF;
  RETURN left(value, 10)::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

CREATE TABLE public.contract_purchase_summary (
  award_year integer NOT NULL CHECK (award_year BETWEEN 2012 AND 2100),
  administration_level text NOT NULL CHECK (administration_level IN ('state', 'autonomic', 'municipal', 'unknown')),
  cpv_division text NOT NULL CHECK (cpv_division ~ '^[0-9]{2}$' OR cpv_division = 'none'),
  -- Expedientes whose earliest published award falls in the year.
  expedientes integer NOT NULL CHECK (expedientes >= 0),
  expedientes_verified integer NOT NULL CHECK (expedientes_verified BETWEEN 0 AND expedientes),
  budget_eur numeric(20, 2) NOT NULL CHECK (budget_eur >= 0),
  budget_missing integer NOT NULL CHECK (budget_missing BETWEEN 0 AND expedientes),
  -- Published award results in the year: one per lot/result in verified editions,
  -- only the first published result in legacy rows.
  results integer NOT NULL CHECK (results >= 0),
  results_legacy integer NOT NULL CHECK (results_legacy BETWEEN 0 AND results),
  results_one_offer integer NOT NULL CHECK (results_one_offer >= 0),
  results_two_to_four integer NOT NULL CHECK (results_two_to_four >= 0),
  results_five_plus integer NOT NULL CHECK (results_five_plus >= 0),
  results_offers_unknown integer NOT NULL CHECK (results_offers_unknown >= 0),
  CHECK (results_one_offer + results_two_to_four + results_five_plus + results_offers_unknown = results),
  PRIMARY KEY (award_year, administration_level, cpv_division)
);

CREATE TABLE public.contract_purchase_coverage (
  scope text PRIMARY KEY CHECK (scope = 'pcsp-643'),
  refreshed_at timestamptz NOT NULL,
  version text NOT NULL CHECK (version = 'contract-purchases-v1'),
  source_rows integer NOT NULL,
  annulled_excluded integer NOT NULL,
  superseded_legacy_excluded integer NOT NULL,
  without_award_evidence integer NOT NULL,
  invalid_award_date integer NOT NULL,
  latest_award_date date,
  years integer[] NOT NULL
);

ALTER TABLE public.contract_purchase_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_purchase_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY contract_purchase_summary_read ON public.contract_purchase_summary FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY contract_purchase_summary_service ON public.contract_purchase_summary FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY contract_purchase_coverage_read ON public.contract_purchase_coverage FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY contract_purchase_coverage_service ON public.contract_purchase_coverage FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON public.contract_purchase_summary, public.contract_purchase_coverage TO anon, authenticated;
GRANT ALL ON public.contract_purchase_summary, public.contract_purchase_coverage TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_contract_purchase_summary() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  written integer;
BEGIN
  DROP TABLE IF EXISTS pg_temp._cps_base, pg_temp._cps_results;
  CREATE TEMP TABLE _cps_base ON COMMIT DROP AS
  SELECT c.id, c.source_id, c.published_edition, c.award_date, c.contractor, c.award_amount,
         c.received_tender_quantity, c.amount, c.currency, c.status,
         CASE WHEN c.administration_level IN ('state', 'autonomic', 'municipal') THEN c.administration_level ELSE 'unknown' END AS lvl,
         COALESCE(left(c.cpv_code, 2), 'none') AS division,
         -- A legacy row is superseded when a verified edition of the same folder and body exists.
         (c.source_id IS NULL AND c.contract_folder_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.contracts v
            WHERE v.source_id IS NOT NULL AND v.contract_folder_id = c.contract_folder_id
              AND v.awarding_body IS NOT DISTINCT FROM c.awarding_body)) AS superseded
  FROM public.contracts c;

  CREATE TEMP TABLE _cps_results ON COMMIT DROP AS
  SELECT b.id, false AS legacy, public.safe_iso_date(r->>'award_date') AS award_on,
         CASE WHEN (r->>'received_tenders') ~ '^\d{1,9}$' THEN (r->>'received_tenders')::integer END AS offers
  FROM _cps_base b CROSS JOIN LATERAL jsonb_array_elements(b.published_edition->'results') r
  WHERE b.status IS DISTINCT FROM 'ANUL' AND NOT b.superseded AND b.published_edition IS NOT NULL
    AND (r->>'contractor' IS NOT NULL OR r#>>'{award_excluding_tax,value}' IS NOT NULL)
  UNION ALL
  SELECT b.id, true, b.award_date, b.received_tender_quantity
  FROM _cps_base b
  WHERE b.status IS DISTINCT FROM 'ANUL' AND NOT b.superseded AND b.published_edition IS NULL
    AND (b.contractor IS NOT NULL OR b.award_amount IS NOT NULL);

  DELETE FROM public.contract_purchase_summary;

  WITH valid AS (
    SELECT r.*, extract(year FROM r.award_on)::integer AS y
    FROM _cps_results r
    WHERE r.award_on BETWEEN DATE '2012-01-01' AND current_date
  ), expediente AS (
    SELECT b.id, b.lvl, b.division, min(v.y) AS y, (b.source_id IS NOT NULL) AS verified,
           CASE WHEN b.currency = 'EUR' AND b.amount >= 0 THEN b.amount END AS budget
    FROM valid v JOIN _cps_base b ON b.id = v.id
    GROUP BY b.id, b.lvl, b.division, b.source_id, b.currency, b.amount
  ), by_expediente AS (
    SELECT y, lvl, division, count(*) AS expedientes, count(*) FILTER (WHERE verified) AS verified,
           COALESCE(sum(budget), 0) AS budget_eur, count(*) FILTER (WHERE budget IS NULL) AS budget_missing
    FROM expediente GROUP BY 1, 2, 3
  ), by_result AS (
    SELECT v.y, b.lvl, b.division, count(*) AS results, count(*) FILTER (WHERE v.legacy) AS legacy,
           count(*) FILTER (WHERE v.offers = 1) AS one_offer,
           count(*) FILTER (WHERE v.offers BETWEEN 2 AND 4) AS two_to_four,
           count(*) FILTER (WHERE v.offers >= 5) AS five_plus,
           count(*) FILTER (WHERE v.offers IS NULL OR v.offers = 0) AS unknown
    FROM valid v JOIN _cps_base b ON b.id = v.id GROUP BY 1, 2, 3
  )
  INSERT INTO public.contract_purchase_summary
  SELECT COALESCE(e.y, r.y), COALESCE(e.lvl, r.lvl), COALESCE(e.division, r.division),
         COALESCE(e.expedientes, 0), COALESCE(e.verified, 0), COALESCE(e.budget_eur, 0), COALESCE(e.budget_missing, 0),
         COALESCE(r.results, 0), COALESCE(r.legacy, 0), COALESCE(r.one_offer, 0), COALESCE(r.two_to_four, 0),
         COALESCE(r.five_plus, 0), COALESCE(r.unknown, 0)
  FROM by_expediente e FULL OUTER JOIN by_result r ON r.y = e.y AND r.lvl = e.lvl AND r.division = e.division;
  GET DIAGNOSTICS written = ROW_COUNT;

  INSERT INTO public.contract_purchase_coverage AS c
    (scope, refreshed_at, version, source_rows, annulled_excluded, superseded_legacy_excluded,
     without_award_evidence, invalid_award_date, latest_award_date, years)
  SELECT 'pcsp-643', now(), 'contract-purchases-v1',
         (SELECT count(*) FROM _cps_base),
         (SELECT count(*) FROM _cps_base WHERE status = 'ANUL'),
         (SELECT count(*) FROM _cps_base WHERE superseded AND status IS DISTINCT FROM 'ANUL'),
         (SELECT count(*) FROM _cps_base b WHERE b.status IS DISTINCT FROM 'ANUL' AND NOT b.superseded
            AND NOT EXISTS (SELECT 1 FROM _cps_results r WHERE r.id = b.id)),
         (SELECT count(*) FROM _cps_results WHERE award_on IS NULL OR award_on NOT BETWEEN DATE '2012-01-01' AND current_date),
         (SELECT max(award_on) FROM _cps_results WHERE award_on <= current_date),
         COALESCE((SELECT array_agg(DISTINCT award_year ORDER BY award_year) FROM public.contract_purchase_summary), '{}')
  ON CONFLICT (scope) DO UPDATE SET
    refreshed_at = EXCLUDED.refreshed_at, version = EXCLUDED.version, source_rows = EXCLUDED.source_rows,
    annulled_excluded = EXCLUDED.annulled_excluded, superseded_legacy_excluded = EXCLUDED.superseded_legacy_excluded,
    without_award_evidence = EXCLUDED.without_award_evidence, invalid_award_date = EXCLUDED.invalid_award_date,
    latest_award_date = EXCLUDED.latest_award_date, years = EXCLUDED.years;

  RETURN written;
END $$;

REVOKE ALL ON FUNCTION public.refresh_contract_purchase_summary() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.contract_purchase_summary IS
  'PCSP awards by year/level/CPV division. budget_eur = project tender budget excl. VAT of awarded expedientes, not award or payment. Legacy rows contribute only their first published result.';
