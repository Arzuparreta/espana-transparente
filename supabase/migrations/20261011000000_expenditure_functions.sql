-- Bounded, recoverable Eurostat snapshot: 11 observations/year/sector.
-- Sector is part of the key; future subsectors cannot overwrite S13.
CREATE TABLE public.expenditure_functions (
  geo text NOT NULL CHECK (geo = 'ES'),
  sector text NOT NULL CHECK (sector IN ('S13', 'S1311', 'S1312', 'S1313', 'S1314')),
  year integer NOT NULL CHECK (year BETWEEN 2016 AND 2100),
  function_code text NOT NULL CHECK (function_code IN
    ('TOTAL','GF01','GF02','GF03','GF04','GF05','GF06','GF07','GF08','GF09','GF10')),
  value numeric(18,3) NOT NULL CHECK (value >= 0 AND value <> 'NaN'::numeric),
  unit text NOT NULL CHECK (unit = 'MIO_EUR'),
  raw_data jsonb NOT NULL,
  PRIMARY KEY (geo, sector, year, function_code)
);
COMMENT ON TABLE public.expenditure_functions IS
  'Eurostat gov_10a_exp, TE, annual COFOG level I; TOTAL is denominator, not another category. Recoverable via ine.cofog.';
ALTER TABLE public.expenditure_functions ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenditure_functions_read ON public.expenditure_functions
  FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.expenditure_functions TO anon, authenticated;
GRANT ALL ON public.expenditure_functions TO service_role;

-- Initial public-source snapshot validated against gov_10a_main on 2026-10-11.
-- Makes the first deployment readable before the next weekly ETL; 99 rows.
-- TOTAL is the denominator. Divisions GF01..GF10 reconcile for every year.
WITH seed(year, function_code, value, flag, accounts_flag) AS (VALUES
  (2016, 'TOTAL', 472717.0, '', ''),
  (2016, 'GF01', 68317.0, '', ''),
  (2016, 'GF02', 10889.0, '', ''),
  (2016, 'GF03', 21215.0, '', ''),
  (2016, 'GF04', 43174.0, '', ''),
  (2016, 'GF05', 9492.0, '', ''),
  (2016, 'GF06', 4876.0, '', ''),
  (2016, 'GF07', 67713.0, '', ''),
  (2016, 'GF08', 12334.0, '', ''),
  (2016, 'GF09', 45328.0, '', ''),
  (2016, 'GF10', 189379.0, '', ''),
  (2017, 'TOTAL', 479908.0, '', ''),
  (2017, 'GF01', 64641.0, '', ''),
  (2017, 'GF02', 10373.0, '', ''),
  (2017, 'GF03', 21262.0, '', ''),
  (2017, 'GF04', 46256.0, '', ''),
  (2017, 'GF05', 9924.0, '', ''),
  (2017, 'GF06', 5031.0, '', ''),
  (2017, 'GF07', 69298.0, '', ''),
  (2017, 'GF08', 12811.0, '', ''),
  (2017, 'GF09', 46442.0, '', ''),
  (2017, 'GF10', 193870.0, '', ''),
  (2018, 'TOTAL', 503193.0, '', ''),
  (2018, 'GF01', 67520.0, '', ''),
  (2018, 'GF02', 10287.0, '', ''),
  (2018, 'GF03', 21542.0, '', ''),
  (2018, 'GF04', 51532.0, '', ''),
  (2018, 'GF05', 10258.0, '', ''),
  (2018, 'GF06', 5130.0, '', ''),
  (2018, 'GF07', 72146.0, '', ''),
  (2018, 'GF08', 13544.0, '', ''),
  (2018, 'GF09', 47764.0, '', ''),
  (2018, 'GF10', 203470.0, '', ''),
  (2019, 'TOTAL', 526769.0, '', ''),
  (2019, 'GF01', 67671.0, '', ''),
  (2019, 'GF02', 10537.0, '', ''),
  (2019, 'GF03', 22685.0, '', ''),
  (2019, 'GF04', 52761.0, '', ''),
  (2019, 'GF05', 10803.0, '', ''),
  (2019, 'GF06', 5190.0, '', ''),
  (2019, 'GF07', 75917.0, '', ''),
  (2019, 'GF08', 14420.0, '', ''),
  (2019, 'GF09', 50052.0, '', ''),
  (2019, 'GF10', 216733.0, '', ''),
  (2020, 'TOTAL', 580164.0, '', ''),
  (2020, 'GF01', 66059.0, '', ''),
  (2020, 'GF02', 10549.0, '', ''),
  (2020, 'GF03', 23458.0, '', ''),
  (2020, 'GF04', 65789.0, '', ''),
  (2020, 'GF05', 10785.0, '', ''),
  (2020, 'GF06', 5149.0, '', ''),
  (2020, 'GF07', 85545.0, '', ''),
  (2020, 'GF08', 13382.0, '', ''),
  (2020, 'GF09', 52003.0, '', ''),
  (2020, 'GF10', 247445.0, '', ''),
  (2021, 'TOTAL', 611124.0, '', ''),
  (2021, 'GF01', 70976.0, '', ''),
  (2021, 'GF02', 11716.0, '', ''),
  (2021, 'GF03', 24540.0, '', ''),
  (2021, 'GF04', 78943.0, '', ''),
  (2021, 'GF05', 11465.0, '', ''),
  (2021, 'GF06', 5780.0, '', ''),
  (2021, 'GF07', 88541.0, '', ''),
  (2021, 'GF08', 14607.0, '', ''),
  (2021, 'GF09', 55885.0, '', ''),
  (2021, 'GF10', 248671.0, '', ''),
  (2022, 'TOTAL', 637117.0, '', ''),
  (2022, 'GF01', 77818.0, '', ''),
  (2022, 'GF02', 15347.0, '', ''),
  (2022, 'GF03', 25798.0, '', ''),
  (2022, 'GF04', 77131.0, '', ''),
  (2022, 'GF05', 13335.0, '', ''),
  (2022, 'GF06', 6461.0, '', ''),
  (2022, 'GF07', 93327.0, '', ''),
  (2022, 'GF08', 17120.0, '', ''),
  (2022, 'GF09', 58669.0, '', ''),
  (2022, 'GF10', 252111.0, '', ''),
  (2023, 'TOTAL', 680225.0, '', ''),
  (2023, 'GF01', 84425.0, '', ''),
  (2023, 'GF02', 14008.0, '', ''),
  (2023, 'GF03', 27414.0, '', ''),
  (2023, 'GF04', 74851.0, '', ''),
  (2023, 'GF05', 14579.0, '', ''),
  (2023, 'GF06', 7821.0, '', ''),
  (2023, 'GF07', 98630.0, '', ''),
  (2023, 'GF08', 18638.0, '', ''),
  (2023, 'GF09', 62532.0, '', ''),
  (2023, 'GF10', 277327.0, '', ''),
  (2024, 'TOTAL', 725001.0, 'p', ''),
  (2024, 'GF01', 92551.0, 'p', ''),
  (2024, 'GF02', 14233.0, 'p', ''),
  (2024, 'GF03', 28628.0, 'p', ''),
  (2024, 'GF04', 80908.0, 'p', ''),
  (2024, 'GF05', 15539.0, 'p', ''),
  (2024, 'GF06', 7613.0, 'p', ''),
  (2024, 'GF07', 102942.0, 'p', ''),
  (2024, 'GF08', 19193.0, 'p', ''),
  (2024, 'GF09', 65862.0, 'p', ''),
  (2024, 'GF10', 297532.0, 'p', '')), totals AS (
  SELECT year, value FROM seed WHERE function_code='TOTAL'
)
INSERT INTO public.expenditure_functions (geo,sector,year,function_code,value,unit,raw_data)
SELECT 'ES','S13',s.year,s.function_code,s.value,'MIO_EUR',
  '{"source": "Eurostat", "dataset": "gov_10a_exp", "source_url": "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10a_exp?geo=ES&sector=S13&unit=MIO_EUR&freq=A&na_item=TE&sinceTimePeriod=2016", "frequency": "A", "na_item": "TE", "mapping_version": "cofog-level1-v1", "retrieved_at": "2026-10-11T20:45:18.670696+00:00", "source_updated": "2026-09-16T23:00:00+0200", "accounts_updated": "2026-07-21T11:00:00+0200"}'::jsonb || jsonb_build_object(
    'flags', CASE WHEN s.flag='' THEN '[]'::jsonb ELSE jsonb_build_array(s.flag) END,
    'accounts_flags', CASE WHEN s.accounts_flag='' THEN '[]'::jsonb ELSE jsonb_build_array(s.accounts_flag) END,
    'accounts_total', t.value::text, 'reconciliation_residual', '0.0')
FROM seed s JOIN totals t USING (year);

-- This is an actual initial ingestion of a validated official snapshot,
-- distinguished from subsequent live fetches in the run's chunk_key.
INSERT INTO public.etl_runs (pipeline, chunk_key, status, rows_read, rows_inserted, finished_at)
VALUES ('ine.cofog', 'initial-official-snapshot-2026-10-11', 'succeeded', 99, 99, now());
