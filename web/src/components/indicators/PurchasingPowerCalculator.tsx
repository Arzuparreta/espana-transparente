"use client"

import { useId, useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  computePurchasingPower,
  sortIndexAscending,
  type IndexPoint,
} from "@/lib/purchasing-power"

interface PurchasingPowerCalculatorProps {
  /** IPC general-index series (base 2025 = 100), any order. */
  series: IndexPoint[]
  className?: string
}

const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${percentFormatter.format(value)} %`
}

function yearOf(period: string): string {
  return period.slice(0, 4)
}

/**
 * Citizen-facing tool: "¿cuánto vale hoy el dinero de antes?" Adjusts an amount
 * across years using the official IPC general index. All numbers in Geist Mono
 * per DESIGN.md; factual labels only (see AGENTS.md). 100 % client-side.
 */
export function PurchasingPowerCalculator({
  series,
  className,
}: PurchasingPowerCalculatorProps) {
  const sorted = useMemo(() => sortIndexAscending(series), [series])

  // One selectable entry per year, using the earliest month available in that
  // year. Citizens think in years, not months.
  const yearOptions = useMemo(() => {
    const byYear = new Map<string, string>()
    for (const point of sorted) {
      const year = yearOf(point.period)
      if (!byYear.has(year)) byYear.set(year, point.period)
    }
    return Array.from(byYear.entries()).map(([year, period]) => ({ year, period }))
  }, [sorted])

  const latestPeriod = sorted.length > 0 ? sorted[sorted.length - 1].period : null
  const amountId = useId()
  const yearId = useId()

  const [amount, setAmount] = useState<string>("1000")
  const [fromPeriod, setFromPeriod] = useState<string>(
    yearOptions.length > 0 ? yearOptions[0].period : "",
  )

  const result = useMemo(() => {
    const parsed = Number(amount.replace(/\./g, "").replace(",", "."))
    return computePurchasingPower(sorted, parsed, fromPeriod)
  }, [amount, fromPeriod, sorted])

  if (yearOptions.length < 2 || !latestPeriod) return null

  const toYear = yearOf(latestPeriod)
  const fromYear = yearOf(fromPeriod)

  return (
    <section
      aria-label="Calculadora de poder adquisitivo"
      className={cn(
        "rounded-[2px] border border-border bg-card p-4 sm:p-5",
        className,
      )}
    >
      <header className="mb-4 space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Calculadora
        </p>
        <h2 className="font-display text-xl font-black uppercase tracking-[-0.01em] sm:text-2xl">
          ¿Cuánto vale hoy el dinero de antes?
        </h2>
        <p className="text-sm leading-6 text-muted-foreground text-pretty">
          Ajusta un importe de un año anterior a euros de hoy con el IPC general.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label
            htmlFor={amountId}
            className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
          >
            Importe (€)
          </label>
          <Input
            id={amountId}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-mono"
            aria-label="Importe en euros"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label
            htmlFor={yearId}
            className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
          >
            Año
          </label>
          <select
            id={yearId}
            value={fromPeriod}
            onChange={(e) => setFromPeriod(e.target.value)}
            className="h-8 w-full rounded border border-input bg-transparent px-2.5 py-1 font-mono text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30"
          >
            {yearOptions.map((opt) => (
              <option key={opt.period} value={opt.period}>
                {opt.year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {result ? (
        <div className="mt-5 space-y-4">
          <p className="text-pretty text-base leading-7 sm:text-lg">
            <span className="font-mono">{euroFormatter.format(result.amount)}</span>{" "}
            de {fromYear} equivalen hoy a{" "}
            <span
              className="font-mono text-2xl font-medium sm:text-3xl"
              style={{ color: "hsl(var(--brand-signal))" }}
            >
              {euroFormatter.format(result.equivalent)}
            </span>{" "}
            <span className="text-muted-foreground">({toYear}).</span>
          </p>

          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Inflación acumulada"
              value={formatPercent(result.accumulatedInflationPct)}
              hint={`${fromYear} → ${toYear}`}
            />
            <Stat
              label="Inflación media anual"
              value={
                result.annualizedInflationPct != null
                  ? formatPercent(result.annualizedInflationPct)
                  : "—"
              }
              hint="Equivalente anualizado"
            />
            <Stat
              label="Poder de compra perdido"
              value={euroFormatter.format(result.purchasingPowerLost)}
              hint={`${euroFormatter.format(
                result.amount,
              )} guardados comprarían hoy ${euroFormatter.format(
                result.realValueOfKeptMoney,
              )}`}
            />
          </dl>
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          Introduce un importe válido para ver el resultado.
        </p>
      )}

      <p className="mt-5 border-t border-border/60 pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
        Fuente: INE · IPC índice general (base 2025 = 100)
      </p>
    </section>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-[2px] border border-border bg-background/60 px-3 py-3">
      <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words font-mono text-2xl font-medium tracking-tight">
        {value}
      </dd>
      <p className="mt-1 text-xs leading-5 text-muted-foreground text-pretty">{hint}</p>
    </div>
  )
}
