import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { BudgetExecution } from "./BudgetExecution";
import { executionPeriods } from "@/lib/budget-execution";
import { executionFixture } from "@/lib/budget-execution-fixtures";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ejecucion-presupuestaria",
  useRouter: () => ({ prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const data = () => ({ ...executionPeriods(executionFixture()), error: false });
it("publishes the current-budget denominator and financial boundary with source", () => {
  const html = renderToStaticMarkup(<BudgetExecution data={data()} />);
  for (const text of [
    "60 %",
    "66,7 %",
    "presupuesto corriente",
    "IGAE",
    "GTOS 004",
    "Gasto comprometido",
    "liquidación definitiva",
  ]) {
    expect(html).toContain(text);
  }
  expect(html).toContain('name="period"');
  expect(html).toContain("Operaciones financieras y total presupuestario");
});
it("does not silently substitute the available period", () => {
  const html = renderToStaticMarkup(
    <BudgetExecution data={data()} period="2026-12" />,
  );
  expect(html).toContain("period=2025-12");
  expect(html).not.toContain("<table");
});
it("keeps an error distinct from absent coverage", () => {
  expect(
    renderToStaticMarkup(
      <BudgetExecution
        data={{ periods: [], rejectedPeriods: [], error: true }}
      />,
    ),
  ).toContain('role="alert"');
  expect(
    renderToStaticMarkup(
      <BudgetExecution
        data={{ periods: [], rejectedPeriods: [], error: false }}
      />,
    ),
  ).toContain("Todavía no hay");
});
it("shows independent cumulative cuts only through the selected month, with gaps and sources", () => {
  const periods = ["2025-01", "2025-03", "2025-12", "2024-12"]
    .map((period) => ({
      ...data().periods[0],
      period,
      sourceUrl: `https://www.igae.pap.hacienda.gob.es/${period}.xlsx`,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
  const html = renderToStaticMarkup(
    <BudgetExecution
      data={{ periods, rejectedPeriods: [], error: false }}
      period="2025-03"
    />,
  );
  expect(html).toContain("2 de 3 cortes");
  expect(html).toContain(
    'href="https://www.igae.pap.hacienda.gob.es/2025-01.xlsx"',
  );
  expect(html).toContain('aria-current="page"');
  expect(html).not.toContain(
    'href="https://www.igae.pap.hacienda.gob.es/2025-12.xlsx"',
  );
  expect(html).not.toContain(
    'href="https://www.igae.pap.hacienda.gob.es/2024-12.xlsx"',
  );
  expect(html).toContain("No sumes las filas");
});
