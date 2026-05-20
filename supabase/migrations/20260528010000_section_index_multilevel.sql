-- Extend home section index with multilevel landings and declarations.

CREATE OR REPLACE FUNCTION public.get_section_index()
RETURNS TABLE (
  section_key text,
  record_count bigint,
  latest_date date
)
LANGUAGE sql
STABLE
AS $$
  SELECT 'diputados'::text,
         (SELECT COUNT(DISTINCT politician_id)::bigint
            FROM politician_memberships
            WHERE is_active AND chamber = 'congress'),
         NULL::date
  UNION ALL
  SELECT 'senado',
         (SELECT COUNT(DISTINCT politician_id)::bigint
            FROM politician_memberships
            WHERE is_active AND chamber = 'senate'),
         NULL
  UNION ALL
  SELECT 'gobierno',
         (SELECT COUNT(*)::bigint FROM v_gobierno_actual),
         NULL
  UNION ALL
  SELECT 'partidos',
         (SELECT COUNT(*)::bigint FROM parties),
         NULL
  UNION ALL
  SELECT 'instituciones',
         (SELECT COUNT(*)::bigint FROM v_instituciones_actuales),
         NULL
  UNION ALL
  SELECT 'dinero-publico',
         (SELECT COUNT(DISTINCT (year, section_code))::bigint FROM v_program_money_flow),
         (SELECT MAX(latest_record_date)::date FROM v_program_money_flow)
  UNION ALL
  SELECT 'presupuestos',
         (SELECT COUNT(DISTINCT (year, section_code))::bigint FROM v_budget_summary),
         NULL
  UNION ALL
  SELECT 'contratos',
         (SELECT COUNT(*)::bigint FROM contracts),
         (SELECT MAX(date) FROM contracts)
  UNION ALL
  SELECT 'subvenciones',
         (SELECT COUNT(*)::bigint FROM subsidies),
         (SELECT MAX(fecha_concesion) FROM subsidies)
  UNION ALL
  SELECT 'fondos-ue',
         (SELECT COUNT(*)::bigint FROM eu_funds),
         NULL
  UNION ALL
  SELECT 'organizaciones',
         (SELECT COUNT(*)::bigint FROM v_organization_public),
         NULL
  UNION ALL
  SELECT 'ccaa',
         (SELECT COUNT(*)::bigint FROM subsidies WHERE nivel1 = 'AUTONOMICA'),
         (SELECT MAX(fecha_concesion) FROM subsidies WHERE nivel1 = 'AUTONOMICA')
  UNION ALL
  SELECT 'municipios',
         (SELECT COUNT(*)::bigint FROM subsidies WHERE nivel1 = 'LOCAL'),
         (SELECT MAX(fecha_concesion) FROM subsidies WHERE nivel1 = 'LOCAL')
  UNION ALL
  SELECT 'votaciones',
         (SELECT COUNT(*)::bigint FROM voting_sessions WHERE chamber = 'congress'),
         (SELECT MAX(date) FROM voting_sessions WHERE chamber = 'congress')
  UNION ALL
  SELECT 'iniciativas',
         (SELECT COUNT(*)::bigint FROM initiatives),
         NULL
  UNION ALL
  SELECT 'declaraciones',
         (SELECT COUNT(*)::bigint FROM economic_declarations),
         (SELECT MAX(declaration_date) FROM economic_declarations)
  UNION ALL
  SELECT 'indicadores',
         (SELECT COUNT(DISTINCT indicator_code)::bigint FROM economic_indicators),
         NULL
  UNION ALL
  SELECT 'puertas-giratorias',
         (SELECT COUNT(*)::bigint FROM v_revolving_door_public),
         NULL;
$$;
