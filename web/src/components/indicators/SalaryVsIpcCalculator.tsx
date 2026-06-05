"use client"

import { useId, useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  computeSalaryVsIpc,
  extractYearIpcPoints,
  getAvailableYears,
  type IndexPoint,
} from "@/lib/salary-vs-ipc"

interface SalaryVsIpcCalculatorProps {
  /** IPC general-index series (base 2025 = 100), any order. */
  series: IndexPoint[]
  className?: string
}

const euroFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

const euroFormatterDecimals = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${percentFormatter.format(value)} %`
}

/**
 * Citizen-facing tool: "Tu salario vs la inflación".
 * Compares a salary from a past year to today's purchasing power using the
 * official IPC general index. All numbers in Geist Mono; factual labels only.
 * 100 % client-side.
 */
export function SalaryVsIpcCalculator({
  series,
  className,
}: SalaryVsIpcCalculatorProps) {
  const sorted = useMemo(() => extractYearIpcPoints(series), [series])
  const yearOptions = useMemo(() => getAvailableYears(series), [series])

  const latestYear =
    sorted.length > 0 ? sorted[sorted.length - 1].year : null

  const salaryId = useId()
  const freqId = useId()
  const yearId = useId()
  const currentId = useId()
  const currentFreqId = useId()

  const [salary, setSalary] = useState<string>("20000")
  const [frequency, setFrequency] = useState<"monthly" | "annual">("annual")
  const [fromYear, setFromYear] = useState<string>(
    yearOptions.length > 0 ? yearOptions[0] : "",
  )
  const [currentSalary, setCurrentSalary] = useState<string>("")
  const [currentFrequency, setCurrentFrequency] = useState<"monthly" | "annual">(
    "annual",
  )

  const result = useMemo(() => {
    const parsed = Number(salary.replace(/\./g, "").replace(",", "."))
    const parsedCurrent =
      currentSalary.trim() === ""
        ? undefined
        : Number(currentSalary.replace(/\./g, "").replace(",", "."))
    return computeSalaryVsIpc(
      parsed,
      frequency,
      fromYear,
      latestYear ?? undefined,
      series,
      parsedCurrent,
      currentFrequency,
    )
  }, [salary, frequency, fromYear, latestYear, series, currentSalary, currentFrequency])

  if (yearOptions.length < 2 || !latestYear) return null

  return (
    <section
      aria-label="Calculadora de salario e inflación"
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
          Tu salario vs la inflación
        </h2>
        <p className="text-sm leading-6 text-muted-foreground text-pretty">
          Compara cuánto has ganado o perdido en poder adquisitivo respecto a un
          año anterior.
        </p>
      </header>

      <div className="space-y-3">
        {/* Reference salary */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label
              htmlFor={salaryId}
              className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
            >
              Salario de referencia (€)
            </label>
            <Input
              id={salaryId}
              inputMode="decimal"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="font-mono"
              aria-label="Salario de referencia en euros"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label
              htmlFor={freqId}
              className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
            >
              Frecuencia
            </label>
            <select
              id={freqId}
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as "monthly" | "annual")
              }
              className="h-8 w-full rounded border border-input bg-transparent px-2.5 py-1 font-mono text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30"
            >
              <option value="annual">Anual</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>
          <div className="min-w-0 flex-1">
            <label
              htmlFor={yearId}
              className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
            >
              Año de referencia
            </label>
            <select
              id={yearId}
              value={fromYear}
              onChange={(e) => setFromYear(e.target.value)}
              className="h-8 w-full rounded border border-input bg-transparent px-2.5 py-1 font-mono text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Current salary (optional) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label
              htmlFor={currentId}
              className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
            >
              Salario actual (opcional)
            </label>
            <Input
              id={currentId}
              inputMode="decimal"
              value={currentSalary}
              onChange={(e) => setCurrentSalary(e.target.value)}
              className="font-mono"
              aria-label="Salario actual en euros"
              placeholder="Ej: 25000"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label
              htmlFor={currentFreqId}
              className="mb-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
            >
              Frecuencia
            </label>
            <select
              id={currentFreqId}
              value={currentFrequency}
              onChange={(e) =>
                setCurrentFrequency(e.target.value as "monthly" | "annual")
              }
              className="h-8 w-full rounded border border-input bg-transparent px-2.5 py-1 font-mono text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-input/30"
            >
              <option value="annual">Anual</option>
              <option value="monthly">Mensual</option>
            </select>
          </div>
        </div>
      </div>

      {result ? (
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <p className="text-pretty text-base leading-7 sm:text-lg">
              Un salario de{" "}
              <span className="font-mono">
                {result.inputFrequency === "monthly"
                  ? euroFormatterDecimals.format(result.inputSalary)
                  : euroFormatter.format(result.inputSalary)}
                {result.inputFrequency === "monthly" ? "/mes" : "/año"}
              </span>{" "}
              en {result.fromYear}, hoy debería ser{" "}
              <span
                className="font-mono text-2xl font-medium sm:text-3xl"
                style={{ color: "hsl(var(--brand-signal))" }}
              >
                {euroFormatterDecimals.format(result.equivalentMonthly)}
                /mes
              </span>{" "}
              <span className="text-muted-foreground">
                ({euroFormatter.format(result.equivalentAnnual)}/año)
              </span>
              .
            </p>

            {result.gapAnnual != null && (
              <p className="text-pretty text-base leading-7 sm:text-lg">
                Tú cobras{" "}
                <span className="font-mono">
                   {currentFrequency === "monthly"
                    ? euroFormatterDecimals.format(
                        result.currentAnnual != null ? result.currentAnnual / 12 : 0,
                      )
                    : euroFormatter.format(result.currentAnnual ?? 0)}
                  {currentFrequency === "monthly" ? "/mes" : "/año"}
                </span>
                .{" "}
                {result.gapAnnual < 0 ? (
                  <>
                    Pierdes{" "}
                    <span
                      className="font-mono text-xl font-medium"
                      style={{ color: "hsl(var(--brand-signal))" }}
                    >
                      {euroFormatter.format(Math.abs(result.gapAnnual))}/año
                    </span>{" "}
                    de poder adquisitivo ({formatPercent(result.gapPct ?? 0)}).
                  </>
                ) : (
                  <>
                    Ganas{" "}
                    <span className="font-mono text-xl font-medium">
                      {euroFormatter.format(result.gapAnnual)}/año
                    </span>{" "}
                    sobre la inflación ({formatPercent(result.gapPct ?? 0)}).
                  </>
                )}
              </p>
            )}
          </div>

          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Inflación acumulada"
              value={formatPercent(result.accumulatedInflationPct)}
              hint={`${result.fromYear} → ${result.toYear}`}
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
              label={
                result.gapAnnual != null && result.gapAnnual < 0
                  ? "Poder adquisitivo perdido"
                  : "Poder adquisitivo ganado"
              }
              value={
                result.gapAnnual != null
                  ? euroFormatter.format(Math.abs(result.gapAnnual))
                  : "—"
              }
              hint={
                result.gapAnnual != null && result.gapAnnual < 0
                  ? `Tu salario actual compra lo que ${euroFormatter.format(
                      result.realValueOfCurrentSalary ?? 0,
                    )} compraba en ${result.fromYear}`
                  : "Tu salario actual supera la inflación acumulada"
              }
            />
          </dl>
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          Introduce un salario válido para ver el resultado.
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
      <p className="mt-1 text-xs leading-5 text-muted-foreground text-pretty">
        {hint}
      </p>
    </div>
  )
}
