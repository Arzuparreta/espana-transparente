-- TASA_PARO moves from the annual EPA series (EPA667825) to the quarterly one
-- (EPA423474), matching PARADOS and PIB and matching what the site already
-- tells readers ("La publica trimestralmente el INE a través de la EPA").
--
-- The annual points must go: economic_indicators is keyed on
-- (indicator_code, period), so re-running the pipeline would leave one series
-- mixing '2025-A' with '2026-T2' and chart a step that never happened. The
-- quarterly series carries the same history back to 2002, so nothing is lost —
-- the next ine.indicadores_ampliados run repopulates it.

DELETE FROM economic_indicators
WHERE indicator_code = 'TASA_PARO'
  AND period LIKE '%-A';
