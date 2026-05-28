-- Phase 0.3: single RPC that returns counts + latest dates for the home "Qué hay
-- aquí" section index. Collapses ~11 per-section round-trips into one call.
-- Anon-callable; reads only from existing public tables and views.

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
  SELECT 'votaciones',
         (SELECT COUNT(*)::bigint FROM voting_sessions),
         (SELECT MAX(date) FROM voting_sessions)
  UNION ALL
  SELECT 'iniciativas',
         (SELECT COUNT(*)::bigint FROM initiatives),
         NULL
  UNION ALL
  SELECT 'indicadores',
         (SELECT COUNT(DISTINCT indicator_code)::bigint FROM economic_indicators),
         NULL
  UNION ALL
  SELECT 'puertas-giratorias',
         (SELECT COUNT(*)::bigint FROM v_revolving_door_public),
         NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_section_index() TO anon, authenticated;
