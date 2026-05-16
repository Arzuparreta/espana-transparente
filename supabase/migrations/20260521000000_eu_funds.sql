-- EU funds beneficiaries from Kohesio (EC ESIF 2014-2027)
CREATE TABLE IF NOT EXISTS eu_funds (
  id               TEXT        PRIMARY KEY,  -- Kohesio entity URI
  label            TEXT        NOT NULL,
  eu_budget        NUMERIC(18, 2),
  total_budget     NUMERIC(18, 2),
  cofinancing_rate NUMERIC(5,  2),
  number_projects  INTEGER,
  wikidata_link    TEXT,
  country_code     TEXT        NOT NULL DEFAULT 'ES',
  ingested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eu_funds_eu_budget_idx
  ON eu_funds (eu_budget DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS eu_funds_label_trgm_idx
  ON eu_funds USING gin (label gin_trgm_ops);

-- Summary view: totals
CREATE OR REPLACE VIEW v_eu_funds_summary AS
SELECT
  COUNT(*)                    AS beneficiary_count,
  SUM(eu_budget)              AS total_eu_budget,
  SUM(total_budget)           AS total_budget,
  AVG(cofinancing_rate)       AS avg_cofinancing_rate,
  SUM(number_projects)        AS total_projects
FROM eu_funds
WHERE country_code = 'ES';

GRANT SELECT ON eu_funds TO anon, authenticated;
GRANT SELECT ON v_eu_funds_summary TO anon, authenticated;
