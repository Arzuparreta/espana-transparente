import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { SubsidyPurposes } from "./SubsidyPurposes"
import { CallPurpose } from "./CallPurpose"
import { decodePurposeGroups } from "@/lib/subsidy-purpose"
vi.mock("next/navigation", () => ({
  usePathname: () => "/ayudas-por-finalidad",
  useRouter: () => ({ prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
it("explains the denominator, missing purpose and instrument boundaries with sourced links", () => {
  const groups = decodePurposeGroups([
    {
      finalidad: null,
      classification: "pending",
      instrumento: "Préstamo",
      grant_count: 2,
      call_count: 1,
      known_amount: null,
      unknown_amount_count: 2,
      negative_amount_count: 0,
    },
  ])
  const html = renderToStaticMarkup(
    <SubsidyPurposes year={2024} groups={groups} error={false} />,
  )
  for (const text of [
    "Sin convocatoria verificada",
    "Desconocido",
    "Préstamo",
    'scope="row"',
    "year=2024",
    "BDNS",
    "no se suman entre sí",
  ])
    expect(html).toContain(text)
})
it("keeps error, empty corpus and invalid URL distinct", () => {
  expect(
    renderToStaticMarkup(
      <SubsidyPurposes year={2024} groups={[]} error={true} />,
    ),
  ).toContain('role="alert"')
  expect(
    renderToStaticMarkup(
      <SubsidyPurposes year={2024} groups={[]} error={false} />,
    ),
  ).toContain("No hay concesiones recopiladas")
  expect(
    renderToStaticMarkup(
      <SubsidyPurposes year={null} groups={[]} error={false} />,
    ),
  ).toContain("no es válido")
})
it("does not publish a comparable amount when the financial instrument is unknown", () => {
  const groups = decodePurposeGroups([{ finalidad: null, classification: "pending", instrumento: null,
    grant_count: 1, call_count: 1, known_amount: 100, unknown_amount_count: 0, negative_amount_count: 0 }])
  expect(renderToStaticMarkup(<SubsidyPurposes year={2024} groups={groups} error={false} />))
    .toContain("No comparable sin instrumento")
})
it("does not infer a missing call's purpose or disguise a call query error", () => {
  expect(
    renderToStaticMarkup(<CallPurpose call={null} error={false} />),
  ).toContain("pendiente de verificación")
  expect(
    renderToStaticMarkup(<CallPurpose call={null} error={true} />),
  ).toContain('role="alert"')
})
