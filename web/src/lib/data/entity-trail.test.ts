import { expect, it, vi } from "vitest"
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }))
import { buildPoliticianTrail, PARTY_ROUTED_JUDICIAL_SOURCE } from "./entity-trail"

it("lists only cases where the person is the reviewed actor, never their party's cases", () => {
  const trail = buildPoliticianTrail("p1", "Persona", [
    { source_table: PARTY_ROUTED_JUDICIAL_SOURCE, connected_name: "Caso del partido", connected_route: "/corrupcion/a", connected_type: "judicial_case", connection_meta: "condena_firme" },
    { source_table: "Caso judicial", connected_name: "Caso propio", connected_route: "/corrupcion/b", connected_type: "judicial_case", connection_meta: "sobreseido" },
  ])
  expect(trail.connections.judicial.map((c) => c.label)).toEqual(["Caso propio"])
})
