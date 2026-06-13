"use client"

import { useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { SourceFootnote, type SourceFootnoteProps } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { formatAnnualValue, type AnnualPoint, type AnnualValueFormat } from "@/lib/annual-series"
import { cn } from "@/lib/utils"

/**
 * Reusable annual-series chart for the chain ("la Cadena"). First component
 * of components/chain/ — everything in this directory must carry a visible
 * SourceFootnote (enforced as an audit rule in Hito 4b; here it is already
 * required by props). All aggregation happens in lib/annual-series.ts; this
 * component only renders pre-computed points, so the Hito 3 swap to a
 * server-renderable SVG (Observable Plot / Satori) can replace the recharts
 * internals without touching any call site.
 */

export interface AnnualChartSeries {
  id: string
  label: string
  /** Pre-computed in lib/annual-series.ts, ascending by year. */
  points: AnnualPoint[]
  /** Line emphasis: primary = solid foreground, secondary = muted dashed. */
  role?: "primary" | "secondary"
}

export interface AnnualSeriesChartProps {
  title: string
  /** Methodological note, e.g. "Variación de medias anuales; solo años completos". */
  subtitle?: string
  /** bars: exactly 1 series, supports negative values; lines: 1-2 series. */
  kind: "bars" | "lines"
  series: AnnualChartSeries[]
  /** Declarative — serializable across the RSC boundary. */
  valueFormat: AnnualValueFormat
  unitLabel: string
  /**
   * Latest bar/point rendered in the signal token (highlighted evidence per
   * DESIGN.md). In-page this resolves via hsl(var(--accent)); the Hito 3
   * Satori renderer will need the raw hex #C8FF00 instead.
   */
  highlightLatest?: boolean
  detailHref?: string
  /** Required: every chain chart states its official source on-screen. */
  source: SourceFootnoteProps
  className?: string
}

const SIGNAL_FILL = "hsl(var(--accent))"

function formatAxisValue(value: number, format: AnnualValueFormat): string {
  switch (format) {
    case "percent":
      return value.toLocaleString("es-ES", { maximumFractionDigits: 1 })
    case "eurosYear":
      return value.toLocaleString("es-ES", { maximumFractionDigits: 0 })
    case "millionsEurBn":
      return (value / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })
    case "plain":
      return value.toLocaleString("es-ES", { maximumFractionDigits: 1 })
  }
}

interface TooltipEntry {
  dataKey?: unknown
  value?: unknown
}

export function AnnualSeriesChart({
  title,
  subtitle,
  kind,
  series,
  valueFormat,
  unitLabel,
  highlightLatest = false,
  detailHref,
  source,
  className,
}: AnnualSeriesChartProps) {
  // recharts only renders after client hydration. Show a static placeholder
  // first so the fixed-height chart slot is never an empty void on load.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const primary = series.find((s) => s.role !== "secondary") ?? series[0]
  const secondary = series.find((s) => s !== primary && s.role === "secondary")

  if (!primary || primary.points.length < 2) return null

  const latest = primary.points[primary.points.length - 1]
  const latestSecondary = secondary?.points.find((p) => p.year === latest.year)

  const labelBySeries = new Map(series.map((s) => [s.id, s.label]))

  const renderTooltip = ({
    active,
    label,
    payload,
  }: {
    active?: boolean
    label?: unknown
    payload?: ReadonlyArray<TooltipEntry>
  }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-[2px] border border-border bg-background px-3 py-2 font-mono text-xs text-foreground chart-tooltip-touch-offset">
        <div className="text-muted-foreground">{String(label)}</div>
        {payload.map((entry) => (
          <div key={String(entry.dataKey)}>
            {labelBySeries.has(String(entry.dataKey))
              ? `${labelBySeries.get(String(entry.dataKey))} · `
              : ""}
            {formatAnnualValue(Number(entry.value), valueFormat)}
          </div>
        ))}
      </div>
    )
  }

  const axisProps = {
    tickLine: false,
    axisLine: false,
    tick: { fontSize: 12, fill: "currentColor" },
  }

  let chart: React.ReactNode = null

  if (kind === "bars") {
    chart = (
      <BarChart data={primary.points} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
        <XAxis dataKey="year" {...axisProps} minTickGap={20} tickMargin={8} interval="preserveStartEnd" />
        <YAxis
          {...axisProps}
          width={56}
          domain={["auto", "auto"]}
          tickFormatter={(value: number) => formatAxisValue(value, valueFormat)}
        />
        <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.35} />
        <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.06 }} content={renderTooltip} />
        <Bar dataKey="value" name={primary.id} isAnimationActive={false}>
          {primary.points.map((point, index) => (
            <Cell
              key={point.year}
              fill={
                highlightLatest && index === primary.points.length - 1
                  ? SIGNAL_FILL
                  : "currentColor"
              }
              fillOpacity={
                highlightLatest && index === primary.points.length - 1 ? 1 : 0.55
              }
            />
          ))}
        </Bar>
      </BarChart>
    )
  } else {
    const years = Array.from(
      new Set(series.flatMap((s) => s.points.map((p) => p.year)))
    ).sort((a, b) => a - b)
    const valueByYear = series.map(
      (s) => new Map(s.points.map((p) => [p.year, p.value]))
    )
    const data = years.map((year) => {
      const row: Record<string, number | undefined> & { year: number } = { year }
      series.forEach((s, i) => {
        row[s.id] = valueByYear[i].get(year)
      })
      return row
    })

    chart = (
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
        <XAxis dataKey="year" {...axisProps} minTickGap={20} tickMargin={8} interval="preserveStartEnd" />
        <YAxis
          {...axisProps}
          width={56}
          domain={["auto", "auto"]}
          tickFormatter={(value: number) => formatAxisValue(value, valueFormat)}
        />
        <Tooltip cursor={{ stroke: "currentColor", strokeOpacity: 0.16 }} content={renderTooltip} />
        {secondary ? (
          <Line
            type="monotone"
            dataKey={secondary.id}
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        ) : null}
        <Line
          type="monotone"
          dataKey={primary.id}
          stroke={highlightLatest ? SIGNAL_FILL : "currentColor"}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 3 }}
          isAnimationActive={false}
        />
      </LineChart>
    )
  }

  return (
    <section className={cn("rounded-[2px] border border-border bg-card p-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-6 text-balance">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground text-pretty">{subtitle}</p>
          ) : null}
        </div>
        <div className="shrink-0 sm:text-right">
          <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
            {latest.year}
          </div>
          <div data-value className="mt-1 font-mono text-3xl font-medium tracking-tight sm:text-4xl">
            {formatAnnualValue(latest.value, valueFormat)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{unitLabel}</div>
        </div>
      </div>

      {secondary ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-5"
              style={{ backgroundColor: highlightLatest ? SIGNAL_FILL : "currentColor" }}
            />
            {primary.label}
            {latestSecondary !== undefined ? null : ` (hasta ${latest.year})`}
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-5 border-t border-dashed border-current opacity-60"
            />
            {secondary.label}
            {latestSecondary !== undefined ? (
              <span className="text-foreground/80">
                {formatAnnualValue(latestSecondary.value, valueFormat)}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <div className="mt-4 h-[250px] w-full text-foreground md:h-[300px]">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            {chart as React.ReactElement}
          </ResponsiveContainer>
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-end gap-1.5 border-b border-border/60 px-1 pb-px"
          >
            {primary.points.map((point, index) => (
              <div
                key={point.year}
                className="flex-1 rounded-t-[1px] bg-muted"
                style={{
                  height: `${20 + ((index * 37) % 70)}%`,
                  opacity:
                    highlightLatest && index === primary.points.length - 1 ? 0.5 : 0.3,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {detailHref ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="min-w-0" />
          <ResponsiveLink
            href={detailHref}
            className="inline-flex shrink-0 items-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Ver serie completa →
          </ResponsiveLink>
        </div>
      ) : null}

      <SourceFootnote {...source} className="mt-3 bg-background/60" />
    </section>
  )
}
