-- ME-5: extend search_global with subsidies and initiatives.
-- Also fix contracts URL to link directly to contract detail page.

CREATE OR REPLACE FUNCTION search_global(query_text text, max_per_type int DEFAULT 5)
RETURNS TABLE (
  entity_type text,
  id          uuid,
  title       text,
  subtitle    text,
  url         text
) AS $$
DECLARE
  ts_q tsquery;
BEGIN
  ts_q := _build_search_query(query_text);
  IF ts_q IS NULL THEN RETURN; END IF;

  RETURN QUERY

  -- Politicians — match on full_name
  SELECT * FROM (
    SELECT
      'politician'::text,
      p.id,
      p.full_name,
      coalesce(par.acronym, 'Sin partido')::text,
      ('/diputados/' || p.id::text)
    FROM politicians p
    LEFT JOIN politician_memberships pm
      ON pm.politician_id = p.id AND pm.is_active = true
    LEFT JOIN parties par ON par.id = pm.party_id
    WHERE to_tsvector('simple', unaccent(p.full_name)) @@ ts_q
    LIMIT max_per_type
  ) _pol

  UNION ALL

  -- Organizations — match on name
  SELECT * FROM (
    SELECT
      'organization'::text,
      o.id,
      o.name,
      coalesce(o.sector, '')::text,
      ('/organizaciones/' || o.id::text)
    FROM organizations o
    WHERE to_tsvector('simple', unaccent(o.name)) @@ ts_q
    LIMIT max_per_type
  ) _org

  UNION ALL

  -- Voting sessions — match on title (Spanish stemming)
  SELECT * FROM (
    SELECT
      'voting_session'::text,
      vs.id,
      vs.title,
      coalesce(to_char(vs.date, 'DD/MM/YYYY'), '')::text,
      ('/votaciones/' || vs.id::text)
    FROM voting_sessions vs
    WHERE to_tsvector('spanish', unaccent(vs.title)) @@ ts_q
    ORDER BY vs.date DESC
    LIMIT max_per_type
  ) _vs

  UNION ALL

  -- Contracts — match on title, link to detail page
  SELECT * FROM (
    SELECT
      'contract'::text,
      c.id,
      c.title,
      coalesce(c.awarding_body_normalized, c.awarding_body, '')::text,
      ('/contratos/' || c.id::text)
    FROM contracts c
    WHERE to_tsvector('spanish', unaccent(c.title)) @@ ts_q
    ORDER BY c.date DESC NULLS LAST
    LIMIT max_per_type
  ) _con

  UNION ALL

  -- Revolving door — match on person name or private organization
  SELECT * FROM (
    SELECT
      'revolving_door'::text,
      rd.id,
      rd.person_name,
      (coalesce(rd.public_role, '') || ' → ' || coalesce(rd.private_organization, ''))::text,
      '/puertas-giratorias'
    FROM revolving_door rd
    WHERE to_tsvector('simple', unaccent(
      rd.person_name || ' ' || coalesce(rd.private_organization, '')
    )) @@ ts_q
    LIMIT max_per_type
  ) _rd

  UNION ALL

  -- Subsidies — match on beneficiario
  SELECT * FROM (
    SELECT
      'subsidy'::text,
      s.id,
      coalesce(s.beneficiario, s.convocatoria, '—'),
      coalesce(s.nivel3, s.nivel2, s.nivel1, '')::text,
      '/subvenciones'
    FROM subsidies s
    WHERE to_tsvector('simple', unaccent(coalesce(s.beneficiario, ''))) @@ ts_q
    ORDER BY s.importe DESC NULLS LAST
    LIMIT max_per_type
  ) _sub

  UNION ALL

  -- Initiatives — match on title
  SELECT * FROM (
    SELECT
      'initiative'::text,
      i.id,
      coalesce(i.title, i.number),
      coalesce(i.proposer_group, i.type, '')::text,
      ('/iniciativas/' || i.id::text)
    FROM initiatives i
    WHERE i.title IS NOT NULL
      AND to_tsvector('spanish', unaccent(i.title)) @@ ts_q
    LIMIT max_per_type
  ) _ini;

END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION search_global(text, int) TO anon, authenticated;
