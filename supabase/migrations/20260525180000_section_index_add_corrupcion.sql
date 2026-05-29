-- Add 'corrupcion' to section_index_cache refresh so the Procesos judiciales
-- card on /personas shows a count badge.

CREATE OR REPLACE FUNCTION public.refresh_section_index()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM section_index_cache;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'diputados', COUNT(DISTINCT politician_id), NULL
  FROM politician_memberships WHERE is_active AND chamber = 'congress';

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'senado', COUNT(DISTINCT politician_id), NULL
  FROM politician_memberships WHERE is_active AND chamber = 'senate';

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'gobierno', COUNT(*), NULL FROM v_gobierno_actual;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'partidos', COUNT(*), NULL FROM parties;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'instituciones', COUNT(*), NULL FROM v_instituciones_actuales;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'presupuestos', COUNT(DISTINCT (year, section_code)), NULL FROM budget_lines;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'contratos', COUNT(*), MAX(date) FROM contracts;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'subvenciones', COUNT(*), MAX(fecha_concesion) FROM subsidies;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'fondos-ue', COUNT(*), NULL FROM eu_funds;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'organizaciones', COUNT(*), NULL FROM organizations;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'votaciones', COUNT(*), MAX(date)
  FROM voting_sessions WHERE chamber = 'congress';

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'iniciativas', COUNT(*), NULL FROM initiatives;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'declaraciones', COUNT(*), MAX(declaration_date) FROM economic_declarations;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'indicadores', COUNT(DISTINCT indicator_code), NULL FROM economic_indicators;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'puertas-giratorias', COUNT(*), NULL
  FROM revolving_door WHERE verification_status = 'verified';

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'dinero-publico', COUNT(*), NULL FROM budget_lines;

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'ccaa', COUNT(*), MAX(fecha_concesion)
  FROM subsidies WHERE nivel1 = 'AUTONOMICA';

  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'municipios', COUNT(*), MAX(fecha_concesion)
  FROM subsidies WHERE nivel1 = 'LOCAL';

  -- Judicial cases (added for Procesos judiciales card on /personas)
  INSERT INTO section_index_cache (section_key, record_count, latest_date)
  SELECT 'corrupcion', COUNT(*), MAX(source_published_at) FROM corruption_cases;

END;
$$;
