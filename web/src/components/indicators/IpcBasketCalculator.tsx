"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import {
  computeBasketInflation,
  DEFAULT_BASKET_WEIGHTS,
  getAvailableYears,
  type SubgroupSeries,
} from "@/lib/ipc-basket"

interface IpcBasketCalculatorProps {
  series: SubgroupSeries[]
  className?: string
}

const percentFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const LABELS: Record<string, string> = {
  IPC_ALIMENTOS: "Alimentos",
  IPC_BEBIDAS_TABACO: "Bebidas y tabaco",
  IPC_VESTIDO: "Vestido",
  IPC_VIVIENDA: "Vivienda y suministros",
  IPC_HOGAR: "Hogar",
  IPC_SANIDAD: "Sanidad",
  IPC_TRANSPORTE: "Transporte",
  IPC_COMUNICACIONES: "Comunicaciones",
  IPC_OCIO: "Ocio y cultura",
  IPC_ENSENANZA: "Enseñanza",
  IPC_RESTAURANTES: "Restaurantes",
  IPC_SEGUROS: "Seguros",
  IPC_DIVERSOS: "Otros",
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${percentFormatter.format(value)} %`
}

export function IpcBasketCalculator({ series, className }: IpcBasketCalculatorProps) {
  const availableYears = useMemo(() => getAvailableYears(series), [series])
  const latestYear = availableYears[availableYears.length - 1] ?? ""
  const defaultRefYear = availableYears.length > 1 ? availableYears[availableYears.length - 2] : latestYear

  const [weights, setWeights] = useState<Record<string, number>>({ ...DEFAULT_BASKET_WEIGHTS })
  const [refYear, setRefYear] = useState<string>(defaultRefYear)

  const result = useMemo(() => {
    return computeBasketInflation(series, weights, refYear)
  }, [series, weights, refYear])

  function updateWeight(code: string, value: number) {
    setWeights((prev) => ({ ...prev, [code]: value }))
  }

  function resetToDefault() {
    setWeights({ ...DEFAULT_BASKET_WEIGHTS })
  }

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)

  if (series.length < 2 || !result) {
    return null
  }

  return (
    <div className={cn("space-y-5 rounded-[2px] border border-border bg-card px-4 py-5 sm:px-6", className)}>
      <div className="space-y-1">
        <h3 className="font-display text-lg font-semibold tracking-tight">Tu cesta de la compra</h3>
        <p className="text-sm leading-5 text-muted-foreground">
          Ajusta el peso de cada categoría en tu gasto habitual. La calculadora compara la inflación
          acumulada de tu cesta personalizada con la del IPC general desde el año que elijas.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <label className="shrink-0 text-sm font-medium text-muted-foreground">Desde</label>
          <select
            value={refYear}
            onChange={(e) => setRefYear(e.target.value)}
            className="rounded-[2px] border border-border bg-background px-2 py-1 text-sm outline-none"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={resetToDefault}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Restablecer cesta tipo del INE
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Object.keys(DEFAULT_BASKET_WEIGHTS).map((code) => (
          <div key={code} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor={`slider-${code}`} className="text-muted-foreground">
                {LABELS[code] ?? code}
              </label>
              <span className="font-mono text-xs tabular-nums">{weights[code]?.toFixed(1) ?? "0.0"}%</span>
            </div>
            <input
              id={`slider-${code}`}
              type="range"
              min={0}
              max={100}
              step={0.5}
              value={weights[code] ?? 0}
              onChange={(e) => updateWeight(code, Number(e.target.value))}
              className="w-full accent-foreground"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-[2px] border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span>Peso total</span>
        <span
          className={cn(
            "font-mono font-medium tabular-nums",
            Math.abs(totalWeight - 100) < 0.1 ? "text-green-500" : "text-accent"
          )}
        >
          {totalWeight.toFixed(1)}%
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[2px] border border-border bg-background/60 px-3 py-3 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">Tu cesta</div>
          <div
            className={cn(
              "mt-1 font-mono text-3xl font-medium tracking-tight",
              result.basketInflation > result.generalInflation ? "text-accent" : "text-green-500"
            )}
          >
            {formatPercent(result.basketInflation)}
          </div>
        </div>
        <div className="rounded-[2px] border border-border bg-background/60 px-3 py-3 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">IPC general</div>
          <div className="mt-1 font-mono text-3xl font-medium tracking-tight">
            {formatPercent(result.generalInflation)}
          </div>
        </div>
        <div className="rounded-[2px] border border-border bg-background/60 px-3 py-3 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">Diferencia</div>
          <div
            className={cn(
              "mt-1 font-mono text-3xl font-medium tracking-tight",
              result.gap > 0 ? "text-accent" : result.gap < 0 ? "text-green-500" : "text-foreground"
            )}
          >
            {formatPercent(result.gap)}
          </div>
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
          Ver desglose por categoría
        </summary>
        <div className="mt-3 overflow-hidden rounded-[2px] border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Categoría</th>
                <th className="px-3 py-2 text-right font-medium">Peso</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Inflación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {result.subgroupResults.map((sg) => (
                <tr key={sg.code} className={sg.weight > 0 ? "" : "text-muted-foreground/60"}>
                  <td className="px-3 py-2">{LABELS[sg.code] ?? sg.name}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{sg.weight.toFixed(1)}%</td>
                  <td className="hidden px-3 py-2 text-right font-mono tabular-nums sm:table-cell">
                    {sg.weight > 0 ? formatPercent(sg.inflation) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
