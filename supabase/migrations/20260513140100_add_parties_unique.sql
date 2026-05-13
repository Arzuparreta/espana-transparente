DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parties_name_key'
  ) THEN
    ALTER TABLE parties ADD CONSTRAINT parties_name_key UNIQUE (name);
  END IF;
END $$;
