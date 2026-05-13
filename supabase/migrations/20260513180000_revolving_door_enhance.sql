-- Make person_id nullable to support historical cases
ALTER TABLE revolving_door ALTER COLUMN person_id DROP NOT NULL;
ALTER TABLE revolving_door ADD COLUMN IF NOT EXISTS person_name text;
ALTER TABLE revolving_door ADD COLUMN IF NOT EXISTS political_party text;
