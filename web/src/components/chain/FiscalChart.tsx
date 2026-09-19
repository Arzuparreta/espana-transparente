"use client"
import { useId, useRef } from "react"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import {
  FISCAL_SERIES,
  fiscalNumber,
  type FiscalCode,
  type FiscalYear,
} from "@/lib/fiscal"
interface Props {
  title: string
  years: FiscalYear[]
  codes: FiscalCode[]
  lastChecked: string | null
}
const COLORS = ["#3977cd", "#c45736", "#6c994a"]
export function FiscalChart({ title, years, codes, lastChecked }: Props) {
  const id = useId()
  const svg = useRef<SVGSVGElement>(null)
  const numbers = years.flatMap((y) => codes.map((code) => y.values[code]))
  const low = Math.min(0, ...numbers),
    high = Math.max(1, ...numbers),
    span = high - low || 1
  const x = (i: number) =>
    80 +
    ((years[i].year - years[0].year) /
      Math.max(1, years.at(-1)!.year - years[0].year)) *
      660
  const y = (v: number) => 245 - ((v - low) / span) * 175
  function download() {
    if (!svg.current) return
    const blob = new Blob(
      [new XMLSerializer().serializeToString(svg.current)],
      { type: "image/svg+xml;charset=utf-8" },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cuentas-publicas-${codes.join("-").toLowerCase()}-${years[0]?.year}-${years.at(-1)?.year}.svg`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="space-y-3">
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label={`Gráfico: ${title}`}
      >
        <svg
          ref={svg}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 820 365"
          role="img"
          aria-labelledby={id}
          className="h-auto w-full min-w-[560px] rounded border border-border bg-white"
        >
          <title
            id={id}
          >{`${title}. Millones de euros. ${years[0]?.year} a ${years.at(-1)?.year}. Tabla disponible debajo.`}</title>
          <rect width="820" height="365" fill="#fff" />
          <text x="24" y="27" fill="#222" fontSize="16" fontFamily="sans-serif">
            {title}
          </text>
          <text x="24" y="49" fill="#555" fontSize="12" fontFamily="sans-serif">
            Millones de euros corrientes · España · conjunto de las AA. PP.
          </text>
          {[low, (low + high) / 2, high].map((v, i) => (
            <g key={i}>
              <line x1="80" x2="740" y1={y(v)} y2={y(v)} stroke="#ddd" />
              <text
                x="73"
                y={y(v) + 4}
                textAnchor="end"
                fill="#555"
                fontSize="10"
              >
                {Math.round(v).toLocaleString("es-ES")}
              </text>
            </g>
          ))}
          {codes.map((code, j) => (
            <g key={code}>
              {years
                .slice(1)
                .map((row, i) =>
                  row.year === years[i].year + 1 ? (
                    <line
                      key={row.year}
                      x1={x(i)}
                      x2={x(i + 1)}
                      y1={y(years[i].values[code])}
                      y2={y(row.values[code])}
                      stroke={COLORS[j]}
                      strokeWidth="3"
                      strokeDasharray={j === 1 ? "7 3" : undefined}
                    />
                  ) : null,
                )}
              {years.map((row, i) => (
                <circle
                  key={row.year}
                  cx={x(i)}
                  cy={y(row.values[code])}
                  r="3"
                  fill={COLORS[j]}
                >
                  <title>{`${row.year}: ${fiscalNumber(row.values[code])} millones EUR`}</title>
                </circle>
              ))}
              <text
                x="24"
                y={290 + j * 17}
                fill={COLORS[j]}
                fontSize="11"
                fontFamily="sans-serif"
              >
                {FISCAL_SERIES[code]}
              </text>
            </g>
          ))}
          {years
            .filter((_, i) => i === 0 || i === years.length - 1 || i % 2 === 0)
            .map((row) => (
              <text
                key={row.year}
                x={x(years.indexOf(row))}
                y="264"
                textAnchor="middle"
                fill="#555"
                fontSize="11"
              >
                {row.year}
              </text>
            ))}
          <text
            x="24"
            y="344"
            fill="#555"
            fontSize="10"
            fontFamily="sans-serif"
          >
            Fuente: Eurostat ·{" "}
            {codes.includes("DEUDA_PUBLICA")
              ? "gov_10dd_edpt1"
              : "gov_10a_main"}{" "}
            · S13 · MIO_EUR · {years[0]?.year}–{years.at(-1)?.year}
          </text>
          <text x="24" y="358" fill="#555" fontSize="9">
            {years.some((row) => row.provisional)
              ? "Incluye observaciones provisionales. "
              : ""}
            Consulta: {lastChecked?.slice(0, 10) ?? "fecha no disponible"} ·
            spaintransparencia.info
          </text>
        </svg>
      </div>
      <button
        type="button"
        onClick={download}
        className="text-sm underline underline-offset-4"
      >
        Descargar gráfico con fuente (SVG)
      </button>
      <details className="rounded border border-border p-3">
        <summary className="cursor-pointer text-sm">Ver tabla de datos</summary>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">{title}, millones de euros</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2 text-left">
                  Año
                </th>
                {codes.map((code) => (
                  <th scope="col" key={code} className="p-2 text-right">
                    {FISCAL_SERIES[code]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((row) => (
                <tr key={row.year}>
                  <th scope="row" className="p-2 text-left">
                    {row.year}
                    {row.provisional ? " (provisional)" : ""}
                  </th>
                  {codes.map((code) => (
                    <td key={code} className="p-2 text-right tabular-nums">
                      {fiscalNumber(row.values[code])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <SourceFootnote
        sourceLabel="Eurostat · SEC 2010 · AA. PP. (S13)"
        sourceHref={
          codes.includes("DEUDA_PUBLICA")
            ? "https://ec.europa.eu/eurostat/databrowser/view/gov_10dd_edpt1/default/table"
            : "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/default/table"
        }
        lastChecked={lastChecked}
        coverageLabel={`${years[0]?.year}–${years.at(-1)?.year} · millones de euros corrientes`}
      />
    </div>
  )
}
