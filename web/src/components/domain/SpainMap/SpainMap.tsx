"use client"

import { useCallback, useMemo, useState } from "react"
import { feature as topoFeature } from "topojson-client"
import topoData from "../../../../public/geo/spain.topo.json"
import type { SpainMapCcaa, SelectedCcaa } from "./types"
import { TerritoryPanel } from "../TerritoryPanel"

type Props = {
  data: SpainMapCcaa[]
}

type ColorMode = "none" | "total"

type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type ProjectedPath = {
  d: string
  key: string
  name: string
  ccaaKey?: string
  bounds: Bounds
}

type GeoGeometry = {
  type: "Polygon" | "MultiPolygon"
  coordinates: number[][][] | number[][][][]
}

type GeoFeature = {
  type: "Feature"
  properties: Record<string, string>
  geometry: GeoGeometry
}

type TopoData = {
  objects: {
    ccaa: object
    provinces: object
  }
}

const VIEWBOX_WIDTH = 800
const VIEWBOX_HEIGHT = 600
const CANARIAS_KEY = "CANARIAS"
const MAP_FILL = "#343a35"
const MAP_FILL_MUTED = "#202421"
const MAP_STROKE = "#7b857b"
const MAP_STROKE_MUTED = "#40483f"
const MAP_ACCENT = "#C8FF00"
const MAP_ACCENT_SOFT = "#E4FF73"

const INSET_REGIONS = new Set([CANARIAS_KEY])

function totalAmountColor(amount: number, max: number): string {
  if (max <= 0) return MAP_FILL
  const t = Math.pow(amount / max, 0.42)
  const r = Math.round(0x3a + t * (0xc8 - 0x3a))
  const g = Math.round(0x40 + t * (0xff - 0x40))
  const b = Math.round(0x3a - t * 0x3a)
  return `rgb(${r},${g},${b})`
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

function mergeBounds(bounds: Bounds[]) {
  const merged = emptyBounds()
  for (const item of bounds) {
    includePoint(merged, item.minX, item.minY)
    includePoint(merged, item.maxX, item.maxY)
  }
  return merged
}

function formatPathNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function createMercatorProjector(
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

const mainlandProject = createMercatorProjector(-9.5, 4.4, 35.7, 43.9, 34, 26, 766, 514)
const canariasProject = createMercatorProjector(-18.2, -13.3, 27.5, 29.45, 42, 514, 222, 588)

function ringsForGeometry(geometry: GeoGeometry): number[][][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates as number[][][]]
  return geometry.coordinates as number[][][][]
}

function pathFromGeometry(feature: GeoFeature): { d: string; bounds: Bounds } {
  const project = INSET_REGIONS.has(feature.properties.ccaa_key) ? canariasProject : mainlandProject
  const bounds = emptyBounds()
  const d = ringsForGeometry(feature.geometry)
    .map((polygon) =>
      polygon
        .map((ring) => {
          const points = ring.map((point) => {
            const [x, y] = project(point)
            includePoint(bounds, x, y)
            return `${formatPathNumber(x)},${formatPathNumber(y)}`
          })
          return points.length > 0 ? `M${points.join("L")}Z` : ""
        })
        .join("")
    )
    .join("")

  return { d, bounds }
}

function zoomForBounds(bounds: Bounds | null) {
  if (!bounds) return ""
  const width = Math.max(bounds.maxX - bounds.minX, 1)
  const height = Math.max(bounds.maxY - bounds.minY, 1)
  const scale = Math.min(4.2, Math.max(1.35, Math.min(620 / width, 430 / height)))
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2

  return `translate(${VIEWBOX_WIDTH / 2} ${VIEWBOX_HEIGHT / 2}) scale(${formatPathNumber(scale)}) translate(${-formatPathNumber(cx)} ${-formatPathNumber(cy)})`
}

export function SpainMap({ data }: Props) {
  const [selected, setSelected] = useState<SelectedCcaa | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [layer, setLayer] = useState<"ccaa" | "provinces">("ccaa")
  const [colorMode, setColorMode] = useState<ColorMode>("none")

  const dataByKey = useMemo(() => new Map(data.map((d) => [d.topoKey, d])), [data])
  const maxAmount = useMemo(() => Math.max(...data.map((d) => d.totalAmount), 1), [data])

  const paths = useMemo(() => {
    const topology = topoData as TopoData
    const feature = topoFeature as unknown as (
      topology: TopoData,
      object: object
    ) => { features: GeoFeature[] }
    const ccaaFeatures = feature(topology, topology.objects.ccaa).features
    const provinceFeatures = feature(topology, topology.objects.provinces).features

    return {
      ccaa: ccaaFeatures.map((item) => {
        const projected = pathFromGeometry(item)
        return {
          d: projected.d,
          bounds: projected.bounds,
          key: item.properties.ccaa_key,
          name: item.properties.ccaa_name,
        }
      }),
      provinces: provinceFeatures.map((item) => {
        const projected = pathFromGeometry(item)
        return {
          d: projected.d,
          bounds: projected.bounds,
          key: `${item.properties.ccaa_key}_${item.properties.province_key}`,
          ccaaKey: item.properties.ccaa_key,
          name: item.properties.province_name,
        }
      }),
    } satisfies { ccaa: ProjectedPath[]; provinces: ProjectedPath[] }
  }, [])

  const selectedBounds = useMemo(() => {
    if (!selected) return null
    const provinces = paths.provinces.filter((path) => path.ccaaKey === selected.topoKey)
    if (provinces.length > 0) return mergeBounds(provinces.map((path) => path.bounds))
    return paths.ccaa.find((path) => path.key === selected.topoKey)?.bounds ?? null
  }, [paths, selected])

  const handleCcaaClick = useCallback(
    (topoKey: string) => {
      const ccaaData = dataByKey.get(topoKey)
      if (!ccaaData) return
      setSelected({ ...ccaaData, topoKey })
      setLayer("provinces")
      setColorMode("none")
      setHovered(null)
    },
    [dataByKey]
  )

  const handleBack = useCallback(() => {
    setSelected(null)
    setLayer("ccaa")
    setHovered(null)
  }, [])

  const detailHref = selected ? `/ccaa/${encodeURIComponent(selected.routeKey)}` : null
  const transform = layer === "provinces" ? zoomForBounds(selectedBounds) : ""
  const showTotalLegend = layer === "ccaa" && colorMode === "total"

  return (
    <div className="flex w-full flex-col border border-neutral-800 bg-[#0f0f0f] lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-3 border-b border-neutral-800 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-h-7 items-start gap-2">
            {selected && (
              <>
                <button
                  onClick={handleBack}
                  className="border border-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400 transition-colors hover:text-[#C8FF00]"
                  aria-label="Volver al mapa completo"
                >
                  España
                </button>
                {detailHref && (
                  <a
                    href={detailHref}
                    className="border border-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400 transition-colors hover:text-[#C8FF00]"
                  >
                    Ver ficha
                  </a>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:w-80 sm:items-end">
            <div className="flex overflow-hidden border border-neutral-800">
              <button
                type="button"
                onClick={() => setColorMode("none")}
                className={`px-2 py-1 font-mono text-xs transition-colors ${
                  colorMode === "none" ? "bg-neutral-200 text-neutral-950" : "text-neutral-400 hover:text-neutral-100"
                }`}
              >
                mapa
              </button>
              {layer === "ccaa" && (
                <button
                  type="button"
                  onClick={() => setColorMode("total")}
                  className={`border-l border-neutral-800 px-2 py-1 font-mono text-xs transition-colors ${
                    colorMode === "total" ? "bg-neutral-200 text-neutral-950" : "text-neutral-400 hover:text-neutral-100"
                  }`}
                >
                  gasto
                </button>
              )}
            </div>

            <div className="w-full text-left sm:text-right">
              <p className="font-mono text-xs text-neutral-300">
                {colorMode === "total"
                  ? "Color: importe total registrado por CCAA"
                  : "Mapa: límites territoriales y navegación"}
              </p>
              <p className="mt-1 text-xs leading-4 text-neutral-500">
                {colorMode === "total"
                  ? "Contratos y subvenciones autonómicas disponibles en las fuentes cargadas."
                  : "Los importes aparecen al seleccionar una comunidad autónoma."}
              </p>
              {showTotalLegend && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-neutral-500">menos</span>
                  <div
                    className="h-2 flex-1"
                    style={{ background: `linear-gradient(to right, ${totalAmountColor(0, maxAmount)}, ${MAP_ACCENT})` }}
                  />
                  <span className="font-mono text-[11px] text-neutral-500">más</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="block h-[430px] w-full sm:h-[520px]"
          role="img"
          aria-label="Mapa interactivo de España por comunidades autónomas"
        >
          <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#0f0f0f" />

          <g className="transition-transform duration-500 ease-out" transform={transform}>
            {layer === "ccaa" &&
              paths.ccaa.map((path) => {
                const entry = dataByKey.get(path.key)
                const amount = entry?.totalAmount ?? 0
                const isHovered = hovered === path.key
                const fill = colorMode === "total" ? totalAmountColor(amount, maxAmount) : MAP_FILL
                return (
                  <path
                    key={path.key}
                    d={path.d}
                    fill={isHovered ? MAP_ACCENT : fill}
                    fillRule="evenodd"
                    stroke={isHovered ? MAP_ACCENT_SOFT : MAP_STROKE}
                    strokeWidth={isHovered ? 1.6 : 0.9}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-pointer transition-colors duration-150"
                    onMouseEnter={() => setHovered(path.key)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleCcaaClick(path.key)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${path.name}. Ver provincias y gasto registrado.`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        handleCcaaClick(path.key)
                      }
                    }}
                  />
                )
              })}

            {layer === "provinces" &&
              paths.provinces.map((path) => {
                const isActive = path.ccaaKey === selected?.topoKey
                const isHovered = hovered === path.key
                const fill = isActive ? (isHovered ? MAP_ACCENT : MAP_FILL) : MAP_FILL_MUTED

                return (
                  <path
                    key={path.key}
                    d={path.d}
                    fill={fill}
                    fillOpacity={isActive ? 1 : 0.44}
                    fillRule="evenodd"
                    stroke={isActive ? MAP_STROKE : MAP_STROKE_MUTED}
                    strokeWidth={isActive ? 0.85 : 0.55}
                    vectorEffect="non-scaling-stroke"
                    className={isActive ? "cursor-pointer transition-colors duration-150" : "transition-colors duration-150"}
                    onMouseEnter={() => isActive && setHovered(path.key)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => {
                      if (isActive && detailHref) window.location.href = detailHref
                    }}
                    role={isActive ? "link" : undefined}
                    tabIndex={isActive ? 0 : undefined}
                    aria-label={isActive ? `${path.name}. Abrir ficha de ${selected?.displayName}.` : undefined}
                    onKeyDown={(event) => {
                      if (!isActive || !detailHref) return
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        window.location.href = detailHref
                      }
                    }}
                  />
                )
              })}
          </g>

          <rect x={36} y={508} width={192} height={84} fill="none" stroke="#343434" strokeWidth={0.75} />
          <text x={42} y={520} fontSize={8} fill="#666" fontFamily="monospace">
            Canarias
          </text>
        </svg>

      </div>

      <TerritoryPanel selected={selected} onClose={handleBack} />
    </div>
  )
}
