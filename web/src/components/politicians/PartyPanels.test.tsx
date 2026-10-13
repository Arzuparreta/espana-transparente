import { expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { PartyPanels } from "./PartyPanels"

const state = vi.hoisted(() => ({ tab: "" }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/partidos/example",
  useSearchParams: () => new URLSearchParams(state.tab ? { tab: state.tab } : {}),
  useRouter: () => ({ prefetch: vi.fn() }),
}))
const members = Array.from({ length: 139 }, (_, n) => ({ id: String(n), name: `Member ${n}`, constituency: "Madrid", group: "Grupo" }))
const sessions = [{ id: "vote", title: "Session example", date: "2026-01-01", divergence_count: 0, partyVotes: { "Sí": 2, "No": 1, "Abstención": 1 } }]

it("bounds initial member rendering and leaves inactive panel markup out", () => {
  state.tab = ""
  const html = renderToStaticMarkup(<PartyPanels members={members} sessions={sessions} cases={[]} />)
  expect(html).toContain("Member 29")
  expect(html).not.toContain("Member 30")
  expect(html).toContain("Mostrar más diputados")
  expect(html).toContain("139")
  expect(html).not.toContain("Session example")
})

it("honors a direct voting-tab URL and preserves all vote percentages", () => {
  state.tab = "votaciones"
  const html = renderToStaticMarkup(<PartyPanels members={members} sessions={sessions} cases={[]} />)
  expect(html).toContain("Session example")
  expect(html).toContain("50")
  expect(html).toContain("% favor")
  expect(html).toContain("% contra")
  expect(html).toContain("% abs")
  expect(html).not.toContain("Member 29")
})
