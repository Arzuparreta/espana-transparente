ALTER TABLE parties ADD CONSTRAINT IF NOT EXISTS parties_name_key UNIQUE (name);
