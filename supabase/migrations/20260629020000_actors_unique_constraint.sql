-- Add the deduplication constraint that the wikipedia scraper's
-- ON CONFLICT DO NOTHING was always assuming but never enforcing.
-- Zero duplicate rows exist, so this is safe to apply directly.

ALTER TABLE corruption_case_actors
  ADD CONSTRAINT corruption_case_actors_case_label_key
  UNIQUE (case_id, actor_label);
