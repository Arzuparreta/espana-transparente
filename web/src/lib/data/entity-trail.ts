/**
 * EntityTrail data layer — cross-entity connections for the "follow the money" cascade.
 *
 * For any entity (organization or politician), returns related entities grouped
 * by connection type. Each connected entity has a route so the user can continue
 * the trail (org → person → org → ...).
 */

import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR } from "./shared"
import { JUDICIAL_STATUS_LABEL, type JudicialStatus } from "./judicial"

function judicialMeta(status: string | null): string | null {
  if (!status) return null
  return JUDICIAL_STATUS_LABEL[status as JudicialStatus] ?? status
}

export interface TrailConnection {
  /** Display label for the connected entity. */
  label: string
  /** Route to the connected entity's page. */
  route: string
  /** Connection type: how this entity relates. */
  connection: string
  /** Optional metadata (date, amount, role). */
  meta: string | null
}

export interface EntityTrail {
  /** The entity this trail is about. */
  entity_type: "organization" | "politician" | "party"
  entity_id: string

  /** Connections grouped by dimension. */
  connections: {
    /** People (politicians) connected to this organization. */
    people: TrailConnection[]
    /** Organizations connected to this person/org. */
    organizations: TrailConnection[]
    /** Judicial cases linked to this entity or its party. */
    judicial: TrailConnection[]
  }
}

function buildOrganizationTrail(
  orgId: string,
  orgName: string,
  rows: Record<string, unknown>[],
): EntityTrail {
  const people: TrailConnection[] = []
  const organizations: TrailConnection[] = []
  const judicial: TrailConnection[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const source = row.source_table as string
    const connLabel = row.connected_name as string | null
    const connRoute = row.connected_route as string | null
    const connType = row.connected_type as string | null
    const meta = row.connection_meta as string | null

    if (!connLabel || !connRoute) continue
    const key = `${connType}:${connRoute}`
    if (seen.has(key)) continue
    seen.add(key)

    const connection: TrailConnection = {
      label: connLabel,
      route: connRoute,
      connection: source,
      meta,
    }

    if (connType === "politician") {
      people.push(connection)
    } else if (connType === "organization") {
      // Don't link to self
      if (connRoute !== `/organizaciones/${orgId}`) {
        organizations.push(connection)
      }
    } else if (connType === "judicial_case") {
      judicial.push({ ...connection, meta: judicialMeta(meta) })
    }
  }

  return {
    entity_type: "organization",
    entity_id: orgId,
    connections: { people, organizations, judicial },
  }
}

function buildPoliticianTrail(
  polId: string,
  polName: string,
  rows: Record<string, unknown>[],
): EntityTrail {
  const people: TrailConnection[] = []
  const organizations: TrailConnection[] = []
  const judicial: TrailConnection[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const source = row.source_table as string
    const connLabel = row.connected_name as string | null
    const connRoute = row.connected_route as string | null
    const connType = row.connected_type as string | null
    const meta = row.connection_meta as string | null

    if (!connLabel || !connRoute) continue
    const key = `${connType}:${connRoute}`
    if (seen.has(key)) continue
    seen.add(key)

    const connection: TrailConnection = {
      label: connLabel,
      route: connRoute,
      connection: source,
      meta,
    }

    if (connType === "politician") {
      if (connRoute !== `/diputados/${polId}`) {
        people.push(connection)
      }
    } else if (connType === "organization") {
      organizations.push(connection)
    } else if (connType === "judicial_case") {
      judicial.push({ ...connection, meta: judicialMeta(meta) })
    }
  }

  return {
    entity_type: "politician",
    entity_id: polId,
    connections: { people, organizations, judicial },
  }
}

function buildPartyTrail(partyId: string, rows: Record<string, unknown>[]): EntityTrail {
  const judicial: TrailConnection[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const source = row.source_table as string
    const connLabel = row.connected_name as string | null
    const connRoute = row.connected_route as string | null
    const connType = row.connected_type as string | null
    const meta = row.connection_meta as string | null

    if (!connLabel || !connRoute) continue
    const key = `${connType}:${connRoute}`
    if (seen.has(key)) continue
    seen.add(key)

    if (connType === "judicial_case") {
      judicial.push({ label: connLabel, route: connRoute, connection: source, meta: judicialMeta(meta) })
    }
  }

  return {
    entity_type: "party",
    entity_id: partyId,
    connections: { people: [], organizations: [], judicial },
  }
}

export const getEntityTrail = unstable_cache(
  async (entityType: "organization" | "politician" | "party", entityId: string): Promise<EntityTrail> => {
    // Query the entity_trail SQL function (or inline the logic)
    const { data, error } = await supabase.rpc("get_entity_trail", {
      p_entity_type: entityType,
      p_entity_id: entityId,
    })

    if (error || !data) {
      // Fallback: return empty trail
      return {
        entity_type: entityType,
        entity_id: entityId,
        connections: { people: [], organizations: [], judicial: [] },
      }
    }

    const rows = data as Record<string, unknown>[]
    if (entityType === "organization") return buildOrganizationTrail(entityId, "", rows)
    if (entityType === "party") return buildPartyTrail(entityId, rows)
    return buildPoliticianTrail(entityId, "", rows)
  },
  ["entity-trail"],
  { revalidate: HOUR },
)
