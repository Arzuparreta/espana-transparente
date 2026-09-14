-- Keep freshness based on completed verification while a new run is in progress.
CREATE OR REPLACE VIEW v_etl_pipeline_status AS
SELECT DISTINCT ON (pipeline)
  pipeline, status AS last_status, finished_at AS last_finished_at,
  rows_inserted AS last_rows_inserted, rows_updated AS last_rows_updated,
  error_summary AS last_error_summary
FROM etl_runs
WHERE status <> 'running'
ORDER BY pipeline, started_at DESC, id DESC;
GRANT SELECT ON v_etl_pipeline_status TO anon, authenticated;
