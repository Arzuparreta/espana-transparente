import { expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { IndividualVotes } from "./IndividualVotes"
it("does not render hundreds of hidden rows before the user opens individual votes", () => {
  const rows = Array.from({ length: 350 }, (_, n) => ({ name: `Person ${n}`, vote: "Sí", politicianId: String(n), party: "A", partyId: null, color: "#000" }))
  const html = renderToStaticMarkup(<IndividualVotes rows={rows} chamber="congress" />)
  expect(html).toContain("Ver voto individual de cada")
  expect(html).not.toContain("Person 349")
  expect(html).not.toContain("href=")
})
