"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { feature as topoFeature } from "topojson-client"
import { ArrowLeft, ExternalLink, MapPin, Search, X } from "lucide-react"
import topoData from "../../../../public/geo/spain.topo.json"
import type { TerritoryAtlasData } from "@/lib/data/multilevel"
import { formatEuroCompact } from "@/lib/format"
import {
  aggregateTerritoryValues,
  latestCompleteYear,
  metricValue,
  quantileIndex,
  quantileThresholds,
} from "@/lib/territory-atlas"
import {
  getCanonicalCcaaKey,
  PROVINCE_TOPO_TO_KEY,
  type TerritoryDataset,
  type TerritoryMetric,
} from "@/lib/territory-catalog"
import { TerritoryFlag } from "@/components/domain/TerritoryFlag"
import { cn } from "@/lib/utils"

type Props = {
  data: TerritoryAtlasData
  initialDataset: TerritoryDataset
  initialMetric: TerritoryMetric
  initialYear: number | "all" | null
  initialTerritory: string | null
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
type GeoGeometry = { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] }
type GeoFeature = {
  properties: Record<string, string>
  geometry: GeoGeometry
}
type ProjectedPath = {
  key: string
  dataKey: string
  name: string
  ccaaKey?: string
  d: string
  bounds: Bounds
}
type DetailRecord = {
  dataset: "contracts" | "subsidies"
  id: string
  title: string
  counterparty: string | null
  body: string | null
  amount: number
  date: string | null
  sourceUrl: string | null
  territory: string | null
  href: string
}

const WIDTH = 920
const HEIGHT = 690
const COLORS = ["#263028", "#40513c", "#617944", "#8aaa42", "#c8ff00"]
const NO_DATA = "#171b18"
const STROKE = "#849084"
const ACCENT = "#c8ff00"
const TOPOLOGY = topoData as unknown as {
  objects: { ccaa: object; provinces: object }
}

function emptyBounds(): Bounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
}

function includePoint(bounds: Bounds, x: number, y: number) {
  bounds.minX = Math.min(bounds.minX, x)
  bounds.minY = Math.min(bounds.minY, y)
  bounds.maxX = Math.max(bounds.maxX, x)
  bounds.maxY = Math.max(bounds.maxY, y)
}

function formatPathNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function createProjector(
  lonMin: number,
  lonMax: number,
  latMin: number,
  latMax: number,
  left: number,
  top: number,
  right: number,
  bottom: number
) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const mercY = (lat: number) => -Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2))
  const x0 = toRad(lonMin)
  const x1 = toRad(lonMax)
  const y0 = mercY(latMin)
  const y1 = mercY(latMax)
  const width = right - left
  const height = bottom - top
  const scale = Math.min(width / (x1 - x0), height / (y0 - y1)) * 0.96
  const tx = left + (width - scale * (x0 + x1)) / 2
  const ty = top + (height - scale * (y0 + y1)) / 2
  return ([lon, lat]: number[]) => [tx + scale * toRad(lon), ty + scale * mercY(lat)] as const
}

const mainlandProject = createProjector(-9.5, 4.4, 35.7, 43.9, 55, 46, 870, 604)
const canariasProject = createProjector(-18.2, -13.3, 27.5, 29.45, 72, 582, 285, 672)

function ringsForGeometry(geometry: GeoGeometry): number[][][][] {
  return geometry.type === "Polygon"
    ? [geometry.coordinates as number[][][]]
    : (geometry.coordinates as number[][][][])
}

function pathFromGeometry(item: GeoFeature) {
  const project =
    item.properties.ccaa_key === "CANARIAS" ? canariasProject : mainlandProject
  const bounds = emptyBounds()
  const d = ringsForGeometry(item.geometry)
    .map((polygon) =>
      polygon
        .map((ring) => {
          const points = ring.map((point) => {
            const [x, y] = project(point)
            includePoint(bounds, x, y)
            return `${formatPathNumber(x)},${formatPathNumber(y)}`
          })
          return points.length ? `M${points.join("L")}Z` : ""
        })
        .join("")
    )
    .join("")
  return { d, bounds }
}

function mergeBounds(bounds: Bounds[]) {
  const merged = emptyBounds()
  for (const item of bounds) {
    includePoint(merged, item.minX, item.minY)
    includePoint(merged, item.maxX, item.maxY)
  }
  return merged
}

function zoomForBounds(bounds: Bounds | null) {
  if (!bounds) return ""
  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const scale = Math.min(4.5, Math.max(1.3, Math.min(710 / width, 500 / height)))
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  return `translate(${WIDTH / 2} ${HEIGHT / 2}) scale(${formatPathNumber(scale)}) translate(${-formatPathNumber(cx)} ${-formatPathNumber(cy)})`
}

function formatMetric(value: number, metric: TerritoryMetric) {
  if (metric === "records") return Math.round(value).toLocaleString("es-ES")
  if (metric === "per-capita") {
    return `${Math.round(value).toLocaleString("es-ES")} € / hab.`
  }
  return formatEuroCompact(value)
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha"
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function buildUrl(
  dataset: TerritoryDataset,
  metric: TerritoryMetric,
  year: number | "all",
  territory: string | null
) {
  const params = new URLSearchParams()
  params.set("source", dataset)
  params.set("year", String(year))
  params.set("metric", metric)
  if (territory) params.set("territory", territory)
  return `/territorio?${params.toString()}`
}

function ControlButton({
  active,
  children,
  onClick,
  disabled,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-[2px] px-3 text-xs font-semibold transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "cursor-not-allowed opacity-35"
      )}
    >
      {children}
    </button>
  )
}

export function TerritoryAtlas({
  data,
  initialDataset,
  initialMetric,
  initialYear,
  initialTerritory,
}: Props) {
  const defaultYear = latestCompleteYear(data.years, new Date().getFullYear())
  const [dataset, setDataset] = useState(initialDataset)
  const [metric, setMetric] = useState(initialMetric)
  const [year, setYear] = useState<number | "all">(initialYear ?? defaultYear)
  const [selectedKey, setSelectedKey] = useState<string | null>(initialTerritory)
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)
  const [provinceMode, setProvinceMode] = useState(false)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [detailRecords, setDetailRecords] = useState<DetailRecord[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const paths = useMemo(() => {
    const convert = topoFeature as unknown as (
      topology: typeof TOPOLOGY,
      object: object
    ) => { features: GeoFeature[] }
    const ccaa = convert(TOPOLOGY, TOPOLOGY.objects.ccaa).features.map((item) => {
      const projected = pathFromGeometry(item)
      const dataKey = getCanonicalCcaaKey(item.properties.ccaa_key)
      return {
        key: item.properties.ccaa_key,
        dataKey,
        name: item.properties.ccaa_name,
        ...projected,
      }
    })
    const provinces = convert(TOPOLOGY, TOPOLOGY.objects.provinces).features.map((item) => {
      const projected = pathFromGeometry(item)
      return {
        key: item.properties.province_key,
        dataKey: PROVINCE_TOPO_TO_KEY[item.properties.province_key] ?? item.properties.province_key,
        ccaaKey: getCanonicalCcaaKey(item.properties.ccaa_key),
        name: item.properties.province_name,
        ...projected,
      }
    })
    return { ccaa, provinces } satisfies {
      ccaa: ProjectedPath[]
      provinces: ProjectedPath[]
    }
  }, [])

  const ccaaValues = useMemo(
    () =>
      aggregateTerritoryValues({
        territories: data.territories,
        spend: data.spend,
        population: data.population,
        dataset,
        year,
      }),
    [data, dataset, year]
  )
  const provinceValues = useMemo(
    () =>
      selectedKey
        ? aggregateTerritoryValues({
            territories: data.territories,
            spend: data.spend,
            population: data.population,
            dataset: dataset === "subsidies" ? "contracts" : dataset,
            year,
            parentKey: selectedKey,
          })
        : [],
    [data, dataset, selectedKey, year]
  )
  const effectiveMetric =
    provinceMode && metric === "per-capita" ? "amount" : metric
  const visibleValues = provinceMode ? provinceValues : ccaaValues
  const valuesByKey = useMemo(
    () => new Map(visibleValues.map((row) => [row.key, row])),
    [visibleValues]
  )
  const thresholds = useMemo(
    () => quantileThresholds(visibleValues.map((row) => metricValue(row, effectiveMetric))),
    [effectiveMetric, visibleValues]
  )
  const ranked = useMemo(
    () =>
      [...visibleValues].sort(
        (a, b) => metricValue(b, effectiveMetric) - metricValue(a, effectiveMetric)
      ),
    [effectiveMetric, visibleValues]
  )
  const selected =
    ccaaValues.find((row) => row.key === selectedKey) ?? null
  const selectedProvinceValue =
    provinceValues.find((row) => row.key === selectedProvince) ?? null
  const inspected = selectedProvinceValue ?? selected
  const hovered = visibleValues.find((row) => row.key === hoveredKey) ?? null
  const nationalAmount = ccaaValues.reduce((sum, row) => sum + row.amount, 0)
  const nationalRecords = ccaaValues.reduce((sum, row) => sum + row.records, 0)
  const resolvedCoverage = data.coverage
    .filter((row) => dataset === "all" || row.dataset === dataset)
    .reduce(
      (acc, row) => ({
        total: acc.total + row.totalRecords,
        resolved: acc.resolved + row.resolvedRecords,
      }),
      { total: 0, resolved: 0 }
    )
  const selectedBounds = selectedKey
    ? mergeBounds(
        paths.provinces
          .filter((path) => path.ccaaKey === selectedKey)
          .map((path) => path.bounds)
      )
    : null
  const filteredSearch = query.trim()
    ? ccaaValues.filter((row) =>
        row.name.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es"))
      )
    : []

  useEffect(() => {
    window.history.replaceState(
      null,
      "",
      buildUrl(dataset, metric, year, selectedKey)
    )
  }, [dataset, metric, selectedKey, year])

  useEffect(() => {
    if (!selectedKey) {
      setDetailRecords([])
      return
    }
    const controller = new AbortController()
    setDetailLoading(true)
    const params = new URLSearchParams({
      source: dataset,
      year: String(year),
    })
    if (selectedProvince) params.set("province", selectedProvince)
    fetch(`/api/territory/${selectedKey}?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("detail request failed")
        return response.json()
      })
      .then((payload) => setDetailRecords(payload.records ?? []))
      .catch((error) => {
        if (error.name !== "AbortError") setDetailRecords([])
      })
      .finally(() => setDetailLoading(false))
    return () => controller.abort()
  }, [dataset, selectedKey, selectedProvince, year])

  function selectCcaa(key: string) {
    setSelectedKey(key)
    setSelectedProvince(null)
    setProvinceMode(false)
    setHoveredKey(null)
  }

  function clearSelection() {
    setSelectedKey(null)
    setSelectedProvince(null)
    setProvinceMode(false)
  }

  function enterProvinceMode() {
    setProvinceMode(true)
    setSelectedProvince(provinceValues.length === 1 ? provinceValues[0].key : null)
  }

  const activePaths = provinceMode
    ? paths.provinces.filter((path) => path.ccaaKey === selectedKey)
    : paths.ccaa

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-background lg:h-[calc(100dvh-6rem)] lg:min-h-0">
      <header className="border-b border-border bg-card/70 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-black uppercase tracking-[-0.03em] sm:text-3xl">
                Mapa del gasto
              </h1>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:inline">
                Atlas territorial
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Contratos y subvenciones autonómicas registrados en PCSP y BDNS.
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex rounded-[2px] border border-border bg-background p-0.5">
              <ControlButton active={dataset === "contracts"} onClick={() => setDataset("contracts")}>
                Contratos
              </ControlButton>
              <ControlButton active={dataset === "subsidies"} onClick={() => setDataset("subsidies")}>
                Subvenciones
              </ControlButton>
              <ControlButton active={dataset === "all"} onClick={() => setDataset("all")}>
                Ambas
              </ControlButton>
            </div>
            <label className="sr-only" htmlFor="territory-year">Periodo</label>
            <select
              id="territory-year"
              value={year}
              onChange={(event) =>
                setYear(event.target.value === "all" ? "all" : Number(event.target.value))
              }
              className="h-10 rounded-[2px] border border-border bg-background px-3 font-mono text-xs"
            >
              <option value="all">Histórico disponible</option>
              {data.years.map((availableYear) => (
                <option key={availableYear} value={availableYear}>
                  {availableYear}
                  {availableYear === new Date().getFullYear() ? " · parcial" : ""}
                </option>
              ))}
            </select>
            <div className="flex rounded-[2px] border border-border bg-background p-0.5">
              <ControlButton active={metric === "amount"} onClick={() => setMetric("amount")}>
                Importe
              </ControlButton>
              <ControlButton active={metric === "records"} onClick={() => setMetric("records")}>
                Expedientes
              </ControlButton>
              <ControlButton
                active={metric === "per-capita"}
                onClick={() => setMetric("per-capita")}
                disabled={year === "all"}
              >
                €/hab.
              </ControlButton>
            </div>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="order-2 border-t border-border bg-card/35 lg:order-none lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-t-0">
          <div className="sticky top-0 z-10 border-b border-border bg-card p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar comunidad"
                className="h-10 w-full rounded-[2px] border border-border bg-background pl-9 pr-8 text-sm outline-none focus:border-primary"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            {filteredSearch.length > 0 ? (
              <div className="absolute left-3 right-3 top-[58px] z-30 border border-border bg-popover shadow-xl">
                {filteredSearch.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => {
                      selectCcaa(row.key)
                      setQuery("")
                    }}
                    className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                  >
                    <span>{row.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatMetric(metricValue(row, metric), metric)}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {provinceMode ? "Provincias" : "Ranking CCAA"}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {ranked.filter((row) => metricValue(row, effectiveMetric) > 0).length} con datos
            </span>
          </div>
          <ol className="grid max-h-96 grid-cols-1 overflow-y-auto overscroll-contain sm:grid-cols-2 lg:max-h-none lg:block lg:overflow-visible">
            {ranked.map((row, index) => {
              const value = metricValue(row, effectiveMetric)
              const active = (selectedProvince ?? selectedKey) === row.key
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredKey(row.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onClick={() =>
                      provinceMode ? setSelectedProvince(row.key) : selectCcaa(row.key)
                    }
                    className={cn(
                      "grid w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/70 px-3 py-2.5 text-left transition-colors",
                      active ? "bg-primary/10 text-foreground" : "hover:bg-muted/70"
                    )}
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">{index + 1}</span>
                    <span className="truncate text-xs font-medium">{row.name}</span>
                    <span className={cn("font-mono text-[11px]", value > 0 ? "text-foreground" : "text-muted-foreground")}>
                      {value > 0 ? formatMetric(value, effectiveMetric) : "Sin dato"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        <section className="relative order-1 min-h-[54dvh] overflow-hidden bg-[#0c0f0d] lg:order-none lg:min-h-0">
          <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
            {provinceMode ? (
              <button
                type="button"
                onClick={() => {
                  setProvinceMode(false)
                  setSelectedProvince(null)
                }}
                className="inline-flex h-9 items-center gap-2 rounded-[2px] border border-white/15 bg-black/65 px-3 text-xs text-white backdrop-blur hover:border-primary"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                España
              </button>
            ) : null}
            <div className="rounded-[2px] border border-white/10 bg-black/55 px-3 py-2 font-mono text-[10px] text-white/65 backdrop-blur">
              {provinceMode
                ? `${selected?.name ?? ""} · contratos por provincia`
                : `${dataset === "contracts" ? "Contratos" : dataset === "subsidies" ? "Subvenciones" : "Contratos + subvenciones"} · ${year === "all" ? "histórico disponible" : year}`}
            </div>
          </div>

          {hovered ? (
            <div className="pointer-events-none absolute right-3 top-3 z-20 min-w-48 rounded-[2px] border border-white/15 bg-black/75 p-3 text-white shadow-2xl backdrop-blur">
              <div className="text-sm font-semibold">{hovered.name}</div>
              <div className="mt-1 font-mono text-lg text-primary">
                {formatMetric(metricValue(hovered, effectiveMetric), effectiveMetric)}
              </div>
              <div className="mt-1 text-[11px] text-white/55">
                {hovered.records.toLocaleString("es-ES")} expedientes
              </div>
            </div>
          ) : null}

          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-full min-h-[54dvh] w-full lg:min-h-0"
            role="img"
            aria-label={
              provinceMode
                ? `Mapa de contratos por provincias de ${selected?.name}`
                : "Mapa comparativo del gasto autonómico registrado por comunidades autónomas"
            }
          >
            <rect width={WIDTH} height={HEIGHT} fill="#0c0f0d" />
            <g
              className="transition-transform duration-500 ease-out motion-reduce:transition-none"
              transform={provinceMode ? zoomForBounds(selectedBounds) : ""}
            >
              {activePaths.map((path) => {
                const row = valuesByKey.get(path.dataKey)
                const value = row ? metricValue(row, effectiveMetric) : 0
                const bucket = quantileIndex(value, thresholds)
                const selectedPath =
                  (provinceMode ? selectedProvince : selectedKey) === path.dataKey
                const hoveredPath = hoveredKey === path.dataKey
                return (
                  <path
                    key={`${provinceMode ? "province" : "ccaa"}-${path.key}`}
                    d={path.d}
                    fill={bucket < 0 ? NO_DATA : COLORS[bucket]}
                    fillRule="evenodd"
                    stroke={selectedPath || hoveredPath ? ACCENT : STROKE}
                    strokeWidth={selectedPath ? 2.2 : hoveredPath ? 1.7 : 0.85}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-pointer transition-colors duration-150 focus:outline-none"
                    tabIndex={0}
                    role="button"
                    aria-label={`${path.name}: ${value > 0 ? formatMetric(value, effectiveMetric) : "sin datos"}`}
                    onMouseEnter={() => setHoveredKey(path.dataKey)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onFocus={() => setHoveredKey(path.dataKey)}
                    onBlur={() => setHoveredKey(null)}
                    onClick={() =>
                      provinceMode
                        ? setSelectedProvince(path.dataKey)
                        : selectCcaa(path.dataKey)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        if (provinceMode) setSelectedProvince(path.dataKey)
                        else selectCcaa(path.dataKey)
                      }
                    }}
                  />
                )
              })}
            </g>
            {!provinceMode ? (
              <>
                <rect x="62" y="575" width="233" height="102" fill="none" stroke="#3d463f" strokeWidth="0.8" />
                <text x="70" y="590" fill="#879087" fontSize="10" fontFamily="monospace">Canarias</text>
              </>
            ) : null}
          </svg>

          {!provinceMode ? (
            <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-end justify-between gap-3">
              <div className="rounded-[2px] border border-white/10 bg-black/60 p-3 backdrop-blur">
                <div className="mb-2 flex items-center gap-1">
                  <span className="mr-1 font-mono text-[10px] text-white/55">Sin dato</span>
                  <span className="h-2.5 w-5 border border-white/15" style={{ background: NO_DATA }} />
                  {COLORS.map((color) => (
                    <span key={color} className="h-2.5 w-7" style={{ background: color }} />
                  ))}
                </div>
                <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.08em] text-white/45">
                  <span>Menor</span>
                  <span>Mayor</span>
                </div>
              </div>
              <div className="flex gap-2">
                {["CEUTA", "MELILLA"].map((key) => {
                  const row = ccaaValues.find((item) => item.key === key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => selectCcaa(key)}
                      className="rounded-[2px] border border-white/10 bg-black/60 px-3 py-2 text-left text-white backdrop-blur hover:border-primary"
                    >
                      <span className="block text-[11px] font-semibold">{row?.name}</span>
                      <span className="font-mono text-[10px] text-white/55">
                        {row ? formatMetric(metricValue(row, metric), metric) : "Sin dato"}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="order-3 border-t border-border bg-card lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
          {inspected ? (
            <div>
              <div className="flex items-start justify-between gap-3 border-b border-border p-4">
                <div className="flex min-w-0 items-start gap-3">
                  {!selectedProvinceValue && selected ? (
                    <TerritoryFlag
                      territoryName={selected.key}
                      size="lg"
                      className="shrink-0"
                      priority
                    />
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center border border-border bg-muted">
                      <MapPin className="h-4 w-4 text-primary" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {selectedProvinceValue ? "Provincia" : "Comunidad autónoma"}
                    </p>
                    <h2 className="truncate text-lg font-bold">{inspected.name}</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  aria-label="Cerrar detalle"
                  className="p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 border-b border-border">
                <div className="border-r border-border p-4">
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">Importe registrado</p>
                  <p className="mt-1 font-mono text-xl text-primary">{formatEuroCompact(inspected.amount)}</p>
                </div>
                <div className="p-4">
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">Expedientes</p>
                  <p className="mt-1 font-mono text-xl">{inspected.records.toLocaleString("es-ES")}</p>
                </div>
                {!selectedProvinceValue && inspected.perCapita != null ? (
                  <>
                    <div className="border-r border-t border-border p-4">
                      <p className="font-mono text-[10px] uppercase text-muted-foreground">Por habitante</p>
                      <p className="mt-1 font-mono text-base">{formatMetric(inspected.perCapita, "per-capita")}</p>
                    </div>
                    <div className="border-t border-border p-4">
                      <p className="font-mono text-[10px] uppercase text-muted-foreground">Cuota nacional</p>
                      <p className="mt-1 font-mono text-base">
                        {nationalAmount > 0 ? `${((inspected.amount / nationalAmount) * 100).toFixed(1).replace(".", ",")} %` : "—"}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>

              {!provinceMode && !selectedProvinceValue && selected ? (
                <div className="border-b border-border p-4">
                  <button
                    type="button"
                    onClick={enterProvinceMode}
                    disabled={dataset === "subsidies"}
                    className="flex w-full items-center justify-between rounded-[2px] border border-border px-3 py-2 text-sm font-semibold transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span>Ver desglose provincial</span>
                    <span className="font-mono text-[10px] text-muted-foreground">Solo PCSP</span>
                  </button>
                  {dataset === "subsidies" ? (
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      BDNS publica estas concesiones a nivel autonómico, sin provincia reutilizable.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="border-b border-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Mayores expedientes
                  </h3>
                  <span className="font-mono text-[10px] text-muted-foreground">{year}</span>
                </div>
                <div className="mt-3 space-y-3">
                  {detailLoading ? (
                    <p className="text-xs text-muted-foreground">Cargando expedientes…</p>
                  ) : detailRecords.length > 0 ? (
                    detailRecords.map((record) => (
                      <div key={`${record.dataset}-${record.id}`} className="border-l-2 border-border pl-3">
                        <Link href={record.href} className="line-clamp-2 text-xs font-medium leading-5 hover:underline">
                          {record.title}
                        </Link>
                        <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                          <span>{formatDate(record.date)}</span>
                          <span className="text-foreground">{formatEuroCompact(record.amount)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs leading-5 text-muted-foreground">
                      No hay expedientes resolubles para esta selección.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 p-4">
                <Link
                  href={`/territorio/ccaa/${encodeURIComponent(selected?.key ?? "")}`}
                  className="flex items-center justify-between text-xs font-semibold hover:text-primary"
                >
                  Ficha territorial completa
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                {dataset !== "subsidies" ? (
                  <Link
                    href={`/contratos?level=autonomic&territory=${encodeURIComponent(selected?.key ?? "")}${year === "all" ? "" : `&year=${year}`}`}
                    className="flex items-center justify-between text-xs font-semibold hover:text-primary"
                  >
                    Todos los contratos de la selección
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
                {dataset !== "contracts" && !selectedProvinceValue ? (
                  <Link
                    href={`/subvenciones?nivel=AUTONOMICA&territory=${encodeURIComponent(selected?.key ?? "")}${year === "all" ? "" : `&year=${year}`}`}
                    className="flex items-center justify-between text-xs font-semibold hover:text-primary"
                  >
                    Todas las subvenciones de la selección
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Último registro: {formatDate(inspected.latestRecordDate)}. Los importes son registros publicados, no el gasto total ejecutado.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-52 flex-col justify-between p-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  España · {year}
                </p>
                <p className="mt-2 font-mono text-3xl text-primary">
                  {formatEuroCompact(nationalAmount)}
                </p>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  {nationalRecords.toLocaleString("es-ES")} expedientes
                </p>
              </div>
              <div className="space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  Selecciona una comunidad para comparar su peso, ver el importe por habitante y abrir los expedientes que explican la cifra.
                </p>
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Cobertura territorial</span>
                    <span className="font-mono">
                      {resolvedCoverage.total > 0
                        ? `${((resolvedCoverage.resolved / resolvedCoverage.total) * 100).toFixed(1).replace(".", ",")} %`
                        : "—"}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    Fuente: PCSP y BDNS. Población: Eurostat, 1 de enero. El año actual es parcial.
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
