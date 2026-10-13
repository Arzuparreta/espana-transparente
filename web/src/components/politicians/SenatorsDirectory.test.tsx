import { expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { SenatorsDirectory } from "./SenatorsDirectory"
vi.mock("next/navigation", () => ({ useRouter: () => ({ prefetch: vi.fn() }) }))
it("bounds the initial directory while preserving all senators as searchable input", () => {
  const senators = Array.from({ length: 73 }, (_, n) => ({
    id: String(n), full_name: `Senator ${n}`, first_name: "A", last_name: "B", photo_url: null, senate_id: null,
    politician_memberships: [{ id: String(n), constituency: "Madrid", group_parliamentary: null, is_active: true, raw_data: null, party: null }],
  }))
  const html = renderToStaticMarkup(<SenatorsDirectory senators={senators} />)
  expect(html).toContain("Senator 35")
  expect(html).not.toContain("Senator 36")
  expect(html).toContain("Mostrar más senadores")
  expect(html).toContain("Filtrar senadores")
})
