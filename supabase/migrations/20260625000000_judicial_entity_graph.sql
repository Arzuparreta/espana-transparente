-- Connects judicial accountability data into the unified entity graph.
-- Steps 1-2-4: party matching, entity_trail judicial + lobbying + BORME for orgs.

-- ── 1. Add party_id to corruption_case_actors ────────────────────

ALTER TABLE corruption_case_actors
  ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES parties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS corruption_case_actors_party_review_idx
  ON corruption_case_actors (party_id, review_status);

-- ── 2. Backfill: match reviewed actors against parties ────────────

-- For each reviewed actor without org/party/politician link,
-- try fuzzy matching against the parties table.
-- We use a similarity threshold appropriate for political party names.
DO $$
DECLARE
  rec record;
  matched_id uuid;
BEGIN
  FOR rec IN
    SELECT id, actor_label
    FROM corruption_case_actors
    WHERE review_status = 'reviewed'
      AND organization_id IS NULL
      AND politician_id IS NULL
      AND party_id IS NULL
  LOOP
    -- Try exact match on party name first (case insensitive)
    SELECT id INTO matched_id
    FROM parties
    WHERE LOWER(name) = LOWER(rec.actor_label)
       OR LOWER(acronym) = LOWER(rec.actor_label)
    LIMIT 1;

    -- If not found, try similarity
    IF matched_id IS NULL THEN
      SELECT id INTO matched_id
      FROM parties
      WHERE SIMILARITY(LOWER(name), LOWER(rec.actor_label)) >= 0.6
         OR SIMILARITY(LOWER(acronym), LOWER(rec.actor_label)) >= 0.6
      ORDER BY
        GREATEST(
          SIMILARITY(LOWER(name), LOWER(rec.actor_label)),
          SIMILARITY(LOWER(acronym), LOWER(rec.actor_label))
        ) DESC
      LIMIT 1;
    END IF;

    IF matched_id IS NOT NULL THEN
      UPDATE corruption_case_actors
      SET party_id = matched_id,
          match_confidence = 0.85,
          match_method = 'fuzzy_party',
          updated_at = now()
      WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;

-- ── 3. Update entity_trail function ────────────────────────────

CREATE OR REPLACE FUNCTION get_entity_trail(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS TABLE (
  source_table text,
  connected_name text,
  connected_route text,
  connected_type text,
  connection_meta text
) AS $$
BEGIN
  IF p_entity_type = 'organization' THEN
    -- ── People connected to this organization ──────────────────────

    -- SEPI / institutional appointments
    RETURN QUERY
    SELECT
      'SEPI / cargo institucional'::text,
      ia.person_name::text,
      '/diputados/' || ia.politician_id::text,
      'politician'::text,
      COALESCE(ia.position_title, 'Cargo')::text
    FROM institutional_appointments ia
    JOIN organizations o ON o.name ILIKE '%' ||
      CASE ia.institution
        WHEN 'SEPI-NAVANTIA' THEN 'Navantia'
        WHEN 'SEPI-CORREOS' THEN 'Correos'
        WHEN 'SEPI-TRAGSA' THEN 'Tragsa'
        WHEN 'SEPI-MERCASA' THEN 'Mercasa'
        WHEN 'SEPI-HUNOSA' THEN 'Hunosa'
        WHEN 'SEPI-ENUSA' THEN 'Enusa'
        WHEN 'SEPI-ENSA' THEN 'Ensa'
        WHEN 'SEPI-SEPIDES' THEN 'Sepides'
        WHEN 'SEPI-EFE' THEN 'Agencia EFE'
        WHEN 'SEPI-CETARSA' THEN 'Cetarsa'
        WHEN 'SEPI-MAYASA' THEN 'Mayasa'
        WHEN 'SEPI-SAECA' THEN 'Saeca'
        ELSE ia.institution
      END || '%'
    WHERE o.id = p_entity_id
      AND ia.politician_id IS NOT NULL
    LIMIT 20;

    -- Revolving door
    RETURN QUERY
    SELECT
      'Puerta giratoria'::text,
      rd.person_name::text,
      '/diputados/' || rd.person_id::text,
      'politician'::text,
      COALESCE(rd.public_role || ' → ' || rd.private_role, rd.public_role)::text
    FROM revolving_door rd
    WHERE rd.organization_id = p_entity_id
      AND rd.person_id IS NOT NULL
      AND rd.person_name IS NOT NULL
      AND rd.verification_status = 'verified'
    LIMIT 20;

    -- BORME officers (people directing this company)
    RETURN QUERY
    SELECT
      'BORME / administrador'::text,
      bo.person_name::text,
      CASE WHEN bpm.politician_id IS NOT NULL
        THEN '/diputados/' || bpm.politician_id::text
        ELSE ''
      END,
      'politician'::text,
      COALESCE(bo.role, 'Administrador')::text
    FROM borme_officers bo
    LEFT JOIN borme_politician_matches bpm
      ON bpm.borme_officer_id = bo.id AND bpm.reviewed = true
    WHERE bo.organization_id = p_entity_id
    LIMIT 20;

    -- ── Organizations connected to this organization ──────────────

    -- Contract counterparties
    RETURN QUERY
    WITH org_contracts AS (
      SELECT contractor_organization_id AS counterparty_id, 'Contratista'::text AS rel
      FROM contracts
      WHERE awarding_body_organization_id = p_entity_id
        AND contractor_organization_id IS NOT NULL
      UNION ALL
      SELECT awarding_body_organization_id AS counterparty_id, 'Órgano contratante'::text AS rel
      FROM contracts
      WHERE contractor_organization_id = p_entity_id
        AND awarding_body_organization_id IS NOT NULL
    ),
    grouped AS (
      SELECT counterparty_id, rel, count(*) AS n
      FROM org_contracts
      WHERE counterparty_id != p_entity_id
      GROUP BY counterparty_id, rel
    )
    SELECT
      ('Contratos — ' || g.rel)::text,
      o.name::text,
      '/organizaciones/' || o.id::text,
      'organization'::text,
      (g.n || ' contratos')::text
    FROM grouped g
    JOIN organizations o ON o.id = g.counterparty_id
    ORDER BY g.n DESC
    LIMIT 10;

    -- Subsidy counterparties
    RETURN QUERY
    WITH org_subsidies AS (
      SELECT granting_body_organization_id AS counterparty_id, 'Órgano concedente'::text AS rel
      FROM subsidies
      WHERE beneficiary_organization_id = p_entity_id
        AND granting_body_organization_id IS NOT NULL
      UNION ALL
      SELECT beneficiary_organization_id AS counterparty_id, 'Beneficiaria'::text AS rel
      FROM subsidies
      WHERE granting_body_organization_id = p_entity_id
        AND beneficiary_organization_id IS NOT NULL
    ),
    grouped AS (
      SELECT counterparty_id, rel, count(*) AS n
      FROM org_subsidies
      WHERE counterparty_id != p_entity_id
      GROUP BY counterparty_id, rel
    )
    SELECT
      ('Subvenciones — ' || g.rel)::text,
      o.name::text,
      '/organizaciones/' || o.id::text,
      'organization'::text,
      (g.n || ' subvenciones')::text
    FROM grouped g
    JOIN organizations o ON o.id = g.counterparty_id
    ORDER BY g.n DESC
    LIMIT 10;

    -- ── Judicial cases where this org is directly implicated ─────

    RETURN QUERY
    SELECT
      'Caso judicial'::text,
      cc.title::text,
      '/corrupcion/' || cc.id::text,
      'judicial_case'::text,
      cc.procedural_status::text
    FROM corruption_case_actors cca
    JOIN corruption_cases cc ON cc.id = cca.case_id
    WHERE cca.organization_id = p_entity_id
      AND cca.review_status = 'reviewed'
    ORDER BY cc.source_published_at DESC NULLS LAST
    LIMIT 20;

    -- ── Lobbying groups linked to this organization ──────────────

    RETURN QUERY
    SELECT
      'Lobbying / grupo de interés'::text,
      lg.name::text,
      ''::text,  -- no dedicated lobbying page yet
      'organization'::text,
      COALESCE(lg.category, 'Grupo de interés')::text
    FROM lobbying_organization_links lol
    JOIN lobbying_groups lg ON lg.id = lol.lobbying_group_id
    WHERE lol.organization_id = p_entity_id
      AND lol.reviewed = true
    LIMIT 20;

  ELSIF p_entity_type = 'politician' THEN
    -- ── People connected to this politician ────────────────────────

    -- Power relationships (superiors)
    RETURN QUERY
    SELECT
      'Relación de poder — superior'::text,
      sup.full_name::text,
      '/diputados/' || sup.id::text,
      'politician'::text,
      pr.relationship_type::text
    FROM power_relationships pr
    JOIN politicians sup ON sup.id = pr.superior_id
    WHERE pr.person_id = p_entity_id
      AND pr.superior_id IS NOT NULL
    LIMIT 20;

    -- Power relationships (subordinates)
    RETURN QUERY
    SELECT
      'Relación de poder — subordinado'::text,
      sub.full_name::text,
      '/diputados/' || sub.id::text,
      'politician'::text,
      pr.relationship_type::text
    FROM power_relationships pr
    JOIN politicians sub ON sub.id = pr.person_id
    WHERE pr.superior_id = p_entity_id
    LIMIT 20;

    -- ── Organizations connected to this politician ─────────────────

    -- SEPI / institutional appointments
    RETURN QUERY
    SELECT
      'Cargo institucional'::text,
      o.name::text,
      '/organizaciones/' || o.id::text,
      'organization'::text,
      COALESCE(ia.position_title, 'Cargo')::text
    FROM institutional_appointments ia
    JOIN organizations o ON o.name ILIKE '%' ||
      CASE ia.institution
        WHEN 'SEPI-NAVANTIA' THEN 'Navantia'
        WHEN 'SEPI-CORREOS' THEN 'Correos'
        WHEN 'SEPI-TRAGSA' THEN 'Tragsa'
        WHEN 'SEPI-MERCASA' THEN 'Mercasa'
        WHEN 'SEPI-HUNOSA' THEN 'Hunosa'
        WHEN 'SEPI-ENUSA' THEN 'Enusa'
        WHEN 'SEPI-ENSA' THEN 'Ensa'
        WHEN 'SEPI-SEPIDES' THEN 'Sepides'
        WHEN 'SEPI-EFE' THEN 'Agencia EFE'
        WHEN 'SEPI-CETARSA' THEN 'Cetarsa'
        WHEN 'SEPI-MAYASA' THEN 'Mayasa'
        WHEN 'SEPI-SAECA' THEN 'Saeca'
        ELSE ia.institution
      END || '%'
    WHERE ia.politician_id = p_entity_id
    LIMIT 20;

    -- Revolving door organizations
    RETURN QUERY
    SELECT
      'Puerta giratoria'::text,
      COALESCE(o.name, rd.private_organization)::text,
      CASE WHEN o.id IS NOT NULL THEN '/organizaciones/' || o.id::text ELSE '' END,
      'organization'::text,
      COALESCE(rd.public_role || ' → ' || rd.private_role, rd.public_role)::text
    FROM revolving_door rd
    LEFT JOIN organizations o ON o.id = rd.organization_id
    WHERE rd.person_id = p_entity_id
      AND rd.verification_status = 'verified'
    LIMIT 20;

    -- BORME directorships
    RETURN QUERY
    SELECT
      'BORME / administrador'::text,
      o.name::text,
      '/organizaciones/' || o.id::text,
      'organization'::text,
      COALESCE(bo.role, 'Administrador')::text
    FROM borme_politician_matches bpm
    JOIN borme_officers bo ON bo.id = bpm.borme_officer_id
    JOIN organizations o ON o.id = bo.organization_id
    WHERE bpm.politician_id = p_entity_id
      AND bpm.reviewed = true
    LIMIT 20;

    -- Government ministry/department
    RETURN QUERY
    SELECT
      'Gobierno / ministerio'::text,
      gp.organization_name::text,
      CASE WHEN o.id IS NOT NULL THEN '/organizaciones/' || o.id::text ELSE '' END,
      'organization'::text,
      COALESCE(gp.position_type, 'Cargo')::text
    FROM government_positions gp
    LEFT JOIN organizations o ON o.name ILIKE '%' || gp.organization_name || '%'
       OR SIMILARITY(LOWER(o.name), LOWER(gp.organization_name)) >= 0.85
    WHERE gp.politician_id = p_entity_id
    LIMIT 10;

    -- ── Judicial cases linked to this politician's party ──────────

    RETURN QUERY
    SELECT
      'Caso judicial — vía partido'::text,
      cc.title::text,
      '/corrupcion/' || cc.id::text,
      'judicial_case'::text,
      cc.procedural_status::text
    FROM corruption_case_actors cca
    JOIN corruption_cases cc ON cc.id = cca.case_id
    JOIN politician_memberships pm ON pm.party_id = cca.party_id
    WHERE pm.politician_id = p_entity_id
      AND pm.is_active = true
      AND cca.review_status = 'reviewed'
      AND cca.party_id IS NOT NULL
    ORDER BY cc.source_published_at DESC NULLS LAST
    LIMIT 20;

  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_entity_trail(text, uuid) TO anon, authenticated;
