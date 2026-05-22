-- Extend institutional_appointments institution constraint to include
-- SEPI majority-owned subsidiary boards (Phase B — SEPI data closure).
-- Boards sourced from sepi.es/sites/default/files PDFs, updated 2025-03 to 2025-12.

ALTER TABLE institutional_appointments
  DROP CONSTRAINT IF EXISTS institutional_appointments_institution_check;

ALTER TABLE institutional_appointments
  ADD CONSTRAINT institutional_appointments_institution_check
  CHECK (institution = ANY (ARRAY[
    'TC', 'CGPJ', 'RTVE', 'SEPI',
    'SEPI-NAVANTIA',
    'SEPI-CORREOS',
    'SEPI-TRAGSA',
    'SEPI-MERCASA',
    'SEPI-HUNOSA',
    'SEPI-ENUSA',
    'SEPI-ENSA',
    'SEPI-SEPIDES',
    'SEPI-EFE',
    'SEPI-CETARSA',
    'SEPI-MAYASA',
    'SEPI-SAECA'
  ]::text[]));
