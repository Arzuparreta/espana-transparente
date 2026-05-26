"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { SpainMapCcaa, SelectedCcaa } from "./types"
import { TerritoryPanel } from "../TerritoryPanel"

type Props = {
  data: SpainMapCcaa[]
}

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

const INSET_REGIONS = new Set([CANARIAS_KEY])

function spendColor(amount: number, max: number): string {
  if (max <= 0 || amount <= 0) return "#202020"
  const t = Math.pow(amount / max, 0.42)
  const r = Math.round(0x22 + t * (0xc8 - 0x22))
  const g = Math.round(0x26 + t * (0xff - 0x26))
  const b = Math.round(0x20 - t * 0x20)
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
  const [paths, setPaths] = useState<{
    ccaa: ProjectedPath[]
    provinces: ProjectedPath[]
  } | null>(null)

  const dataByKey = useMemo(() => new Map(data.map((d) => [d.topoKey, d])), [data])
  const maxAmount = useMemo(() => Math.max(...data.map((d) => d.totalAmount), 1), [data])

  useEffect(() => {
    async function load() {
      const [topojsonClient, topoData] = await Promise.all([
        import("topojson-client"),
        fetch("/geo/spain.topo.json").then((response) => response.json()) as Promise<TopoData>,
      ])
      const { feature } = topojsonClient as unknown as {
        feature: (topology: TopoData, object: object) => { features: GeoFeature[] }
      }

      const ccaaFeatures = feature(topoData, topoData.objects.ccaa).features
      const provinceFeatures = feature(topoData, topoData.objects.provinces).features

      setPaths({
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
      })
    }

    load().catch(console.error)
  }, [])

  const selectedBounds = useMemo(() => {
    if (!selected || !paths) return null
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
      setHovered(null)
    },
    [dataByKey]
  )

  const handleBack = useCallback(() => {
    setSelected(null)
    setLayer("ccaa")
    setHovered(null)
  }, [])

  if (!paths) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center border border-neutral-800 bg-[#0f0f0f]">
        <span className="font-mono text-xs text-neutral-600">cargando mapa...</span>
      </div>
    )
  }

  const detailHref = selected ? `/ccaa/${encodeURIComponent(selected.routeKey)}` : null
  const transform = layer === "provinces" ? zoomForBounds(selectedBounds) : ""

  return (
    <div className="flex w-full flex-col border border-neutral-800 bg-[#0f0f0f] lg:flex-row">
      <div className="relative min-w-0 flex-1">
        {selected && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
            <button
              onClick={handleBack}
              className="border border-neutral-800 bg-[#0f0f0f]/90 px-2 py-1 font-mono text-xs text-neutral-400 transition-colors hover:text-[#C8FF00]"
              aria-label="Volver al mapa completo"
            >
              España
            </button>
            {detailHref && (
              <a
                href={detailHref}
                className="border border-neutral-800 bg-[#0f0f0f]/90 px-2 py-1 font-mono text-xs text-neutral-400 transition-colors hover:text-[#C8FF00]"
              >
                Ver ficha
              </a>
            )}
          </div>
        )}

        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="block h-auto w-full"
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
                return (
                  <path
                    key={path.key}
                    d={path.d}
                    fill={isHovered ? "#C8FF00" : spendColor(amount, maxAmount)}
                    fillRule="evenodd"
                    stroke={isHovered ? "#E4FF73" : "#0f0f0f"}
                    strokeWidth={isHovered ? 1.35 : 0.75}
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
                const parentData = path.ccaaKey ? dataByKey.get(path.ccaaKey) : null
                const fill = isActive
                  ? isHovered
                    ? "#C8FF00"
                    : spendColor(parentData?.totalAmount ?? 0, maxAmount)
                  : "#171717"

                return (
                  <path
                    key={path.key}
                    d={path.d}
                    fill={fill}
                    fillOpacity={isActive ? 0.92 : 0.28}
                    fillRule="evenodd"
                    stroke={isActive ? "#0f0f0f" : "#242424"}
                    strokeWidth={isActive ? 0.85 : 0.5}
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
