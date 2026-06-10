-- Expose party color on the public revolving-door view so the
-- /puertas-giratorias page can render the standard PartyBadge with
-- the same per-party color used in Senado, Gobierno, Instituciones,
-- Contratos, Subvenciones and Votaciones. Without this, the badge
-- falls back to the neutral slate tone (FALLBACK_PARTY_COLOR) and
-- looks visually inconsistent with the rest of the site.
--
-- The match mirrors the existing convention in
-- 20260515230000_institutional_appointments.sql and
-- 20260526000000_public_body_appointments.sql: try by acronym first,
-- then by full party name, both case-insensitive.
--
-- Implementation note: CREATE OR REPLACE VIEW preserves the original
-- column NAMES at each position. We must keep the existing column
-- order (party_color is appended at the end), otherwise PostgreSQL
-- raises 42P16 (cannot change name of view column "public_role" to
-- "party_color"). The TypeScript query uses explicit column lists
-- and is unaffected by the trailing position.

CREATE OR REPLACE VIEW v_revolving_door_public AS
SELECT
  rd.id,
  rd.person_id,
  coalesce(rd.person_name, p.full_name) AS person_name,
  rd.political_party,
  rd.public_role,
  rd.public_organization,
  rd.public_exit_date,
  rd.private_role,
  rd.private_organization,
  rd.organization_id,
  o.sector AS organization_sector,
  coalesce(rd.sector, o.sector) AS sector,
  rd.start_date,
  rd.private_start_date,
  rd.authorization_date,
  rd.cooling_off_months,
  rd.primary_source_url,
  rd.source_url,
  rd.verification_status,
  rd.verification_method,
  rd.verified_at,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source_type', rds.source_type,
        'source_name', rds.source_name,
        'source_url', rds.source_url,
        'title', rds.title,
        'published_at', rds.published_at,
        'evidence_text', rds.evidence_text
      )
      ORDER BY
        CASE rds.source_type WHEN 'primary' THEN 0 WHEN 'secondary' THEN 1 ELSE 2 END,
        rds.published_at DESC NULLS LAST
    ) FILTER (WHERE rds.id IS NOT NULL),
    '[]'::jsonb
  ) AS sources,
  COALESCE(pr_abbr.color, pr_name.color) AS party_color
FROM revolving_door rd
LEFT JOIN politicians p ON p.id = rd.person_id
LEFT JOIN organizations o ON o.id = rd.organization_id
LEFT JOIN parties pr_abbr
  ON lower(pr_abbr.acronym) = lower(rd.political_party)
LEFT JOIN parties pr_name
  ON lower(pr_name.name) = lower(rd.political_party)
LEFT JOIN revolving_door_sources rds ON rds.revolving_door_id = rd.id
WHERE rd.verification_status = 'verified'
GROUP BY rd.id, p.full_name, o.sector, pr_abbr.color, pr_name.color;

GRANT SELECT ON v_revolving_door_public TO anon, authenticated;
