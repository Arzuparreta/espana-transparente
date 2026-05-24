-- EntityTrail RPC: cross-entity connections for the "follow the money" cascade.
--
-- Returns rows with:
--   source_table       — which table the connection comes from
--   connected_name     — display name of the connected entity
--   connected_route    — route to the connected entity's page
--   connected_type     — 'politician' or 'organization'
--   connection_meta    — optional metadata (role, date, amount)

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

    -- SEPI / institutional appointments (matched by institution name)
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

    -- Revolving door: people who came from/went to this org
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

    -- ── Organizations connected to this organization ──────────────

    -- Contract counterparties (organizations that contract with this one)
    RETURN QUERY
    WITH org_contracts AS (
      -- As awarding body: who are the contractors?
      SELECT contractor_organization_id AS counterparty_id, 'Contratista'::text AS rel
      FROM contracts
      WHERE awarding_body_organization_id = p_entity_id
        AND contractor_organization_id IS NOT NULL
      UNION ALL
      -- As contractor: who are the awarding bodies?
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

    -- Government ministry/department (joined via organization name)
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

  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_entity_trail(text, uuid) TO anon, authenticated;
