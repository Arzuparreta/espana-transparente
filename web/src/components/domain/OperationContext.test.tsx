import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { OperationContext } from "./OperationContext"

it("identifies concessions and dates without equating them with payments", () => {
  const html = renderToStaticMarkup(<OperationContext kind="subvenciones" total={0} year={2024} />)
  expect(html).toContain("0</span> concesiones en esta consulta")
  expect(html).toContain("fecha de concesión; no fecha de pago")
  expect(html).toContain("no incluye beneficiarios individuales")
})
it("labels unfiltered historical scope and the territorial limit", () => {
  const html = renderToStaticMarkup(<OperationContext kind="contratos" total={1} year={null} />)
  expect(html).toContain("Todo el histórico disponible")
  expect(html).toContain("no acredita dónde se presta el servicio")
})
