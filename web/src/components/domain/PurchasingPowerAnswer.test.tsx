import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { PurchasingPowerAnswer } from "./PurchasingPowerAnswer"
import { purchasingPower } from "@/lib/wage-prices"

const ipc = (year: number, value: number) =>
  Array.from({ length: 12 }, (_, i) => ({ indicator_code: "IPC", period: `${year}-${String(i + 1).padStart(2, "0")}`, value }))
const data = purchasingPower([...ipc(2022, 100), ...ipc(2023, 110), ...ipc(2024, 112),
  { indicator_code: "SALARIO_MEDIO", period: "2022-A", value: 1000 }, { indicator_code: "SALARIO_MEDIO", period: "2023-A", value: 1050 }, { indicator_code: "SALARIO_MEDIO", period: "2024-A", value: 1100 }])

it("answers with wage and price change, the real result, limits and sources", () => {
  const html = renderToStaticMarkup(<PurchasingPowerAnswer data={data} />)
  for (const text of ["En 2024", "ganó", "Una media no describe a cada persona", "bruto", "BCE", "Encuesta Anual de Estructura Salarial", "/distribucion-salarial", "year=2024"])
    expect(html).toContain(text)
  expect(renderToStaticMarkup(<PurchasingPowerAnswer data={data} year="2023" />)).toContain("perdió")
})

it("refuses an unknown year and states missing data without implying no change", () => {
  expect(renderToStaticMarkup(<PurchasingPowerAnswer data={data} year="1990" />)).toContain("No se sustituye")
  expect(renderToStaticMarkup(<PurchasingPowerAnswer data={null} />)).toContain("No significa que no haya cambios")
})
