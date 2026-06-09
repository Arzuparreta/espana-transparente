-- BOE appointments cover arbitrary public bodies. A later SEPI migration
-- accidentally restored the old closed institution list and blocked valid
-- appointments such as the Consejo General del Poder Judicial.

ALTER TABLE institutional_appointments
  DROP CONSTRAINT IF EXISTS institutional_appointments_institution_check;
