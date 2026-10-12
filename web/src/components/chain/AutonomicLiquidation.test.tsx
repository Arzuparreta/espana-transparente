import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AutonomicLiquidation } from "./AutonomicLiquidation";
import { liquidationData } from "@/lib/autonomic-liquidation";
import { liquidationFixture } from "@/lib/autonomic-liquidation-fixtures";
vi.mock("next/navigation", () => ({
  usePathname: () => "/liquidacion-autonomica",
  useRouter: () => ({ prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const data = () => ({ ...liquidationData(liquidationFixture()), error: false });
it("explains comparative scope and phases with sources for each administration", () => {
  const html = renderToStaticMarkup(<AutonomicLiquidation data={data()} />);
  for (const text of [
    "17 comunidades",
    "régimen foral",
    "Crédito inicial",
    "Pago líquido",
    "sin total agregado",
    "no se suman",
    "Fuente Hacienda Andalucía",
    "year=2024&amp;territory=ANDALUCIA",
  ])
    expect(html).toContain(text);
});
it("shows a selected administration with defined denominators and no silent fallback", () => {
  const html = renderToStaticMarkup(
    <AutonomicLiquidation data={data()} territory="ANDALUCIA" year="2024" />,
  );
  expect(html).toContain("66,7 %");
  expect(html).toContain("75 %");
  expect(html).toContain('name="territory"');
  expect(html).toContain("Capítulos presupuestarios");
  expect(
    renderToStaticMarkup(
      <AutonomicLiquidation data={data()} territory="ANDALUCIA" year="2025" />,
    ),
  ).not.toContain("<table");
});
it("keeps consultation failure distinct from unavailable coverage", () => {
  expect(
    renderToStaticMarkup(
      <AutonomicLiquidation
        data={{ regions: [], rejected: [], error: true }}
      />,
    ),
  ).toContain('role="alert"');
  expect(
    renderToStaticMarkup(
      <AutonomicLiquidation
        data={{ regions: [], rejected: [], error: false }}
      />,
    ),
  ).toContain('role="status"');
});
