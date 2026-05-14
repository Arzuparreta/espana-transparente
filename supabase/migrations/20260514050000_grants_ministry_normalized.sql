-- Normalized ministry name for fast joins with government_positions.
-- Stores the ministry in UPPERCASE without accents (e.g. "MINISTERIO DE HACIENDA").
ALTER TABLE subsidies  ADD COLUMN IF NOT EXISTS ministry_normalized text;
ALTER TABLE contracts  ADD COLUMN IF NOT EXISTS ministry_normalized text;

CREATE INDEX IF NOT EXISTS idx_subsidies_ministry ON subsidies (ministry_normalized);
CREATE INDEX IF NOT EXISTS idx_contracts_ministry ON contracts (ministry_normalized);
