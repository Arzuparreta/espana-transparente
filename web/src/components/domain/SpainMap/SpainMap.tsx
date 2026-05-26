"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import type { SpainMapCcaa, SelectedCcaa } from "./types"
import { TerritoryPanel } from "../TerritoryPanel"

type Props = {
  data: SpainMapCcaa[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TopoData = any

// Acid green at various opacities for choropleth
function spendColor(amount: number, max: number): string {
  if (max === 0 || amount === 0) return "#1a1a1a"
  const t = Math.pow(amount / max, 0.4) // sqrt-ish scale for better visual spread
  const r = Math.round(0x1a + t * (0xc8 - 0x1a))
  const g = Math.round(0x1a + t * (0xff - 0x1a))
  const b = Math.round(0x1a + t * (0x00 - 0x1a))
  return `rgb(${r},${g},${b})`
}

export function SpainMap({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selected, setSelected] = useState<SelectedCcaa | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [layer, setLayer] = useState<"ccaa" | "provinces">("ccaa")
  const [paths, setPaths] = useState<{
    ccaa: Array<{ d: string; key: string; name: string }>
    provinces: Array<{ d: string; key: string; provKey: string; ccaaKey: string }>
    borders: string
    provBorders: string
  } | null>(null)
  const [zoomTransform, setZoomTransform] = useState("")

  const dataByKey = useMemo(() => new Map(data.map((d) => [d.topoKey, d])), [data])
  const maxAmount = useMemo(() => Math.max(...data.map((d) => d.totalAmount), 1), [data])

  // Load and compute paths after mount (d3-geo + topojson are client-only)
  useEffect(() => {
    async function load() {
      const [
        { feature, mesh },
        { geoMercator, geoPath },
        topoData,
      ] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        import("topojson-client") as Promise<any>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        import("d3-geo") as Promise<any>,
        fetch("/geo/spain.topo.json").then((r) => r.json()) as Promise<TopoData>,
      ])

      // Continental CCAA (exclude Canarias, Ceuta, Melilla from main projection)
      const CANARIAS_KEY = "CANARIAS"
      const ENCLAVES = new Set(["CEUTA", "MELILLA"])

      type GeoFeat = { type: string; properties: Record<string, string>; geometry: object }
      const allCcaaFeatures: GeoFeat[] = feature(topoData, topoData.objects.ccaa).features
      const allProvFeatures: GeoFeat[] = feature(topoData, topoData.objects.provinces).features

      const continentalCcaa = allCcaaFeatures.filter(
        (f) => f.properties.ccaa_key !== CANARIAS_KEY && !ENCLAVES.has(f.properties.ccaa_key)
      )
      const canariasFeatures = allCcaaFeatures.filter((f) => f.properties.ccaa_key === CANARIAS_KEY)
      const enclaveFeatures = allCcaaFeatures.filter((f) => ENCLAVES.has(f.properties.ccaa_key))

      const continentalProv = allProvFeatures.filter(
        (f) => f.properties.ccaa_key !== CANARIAS_KEY && !ENCLAVES.has(f.properties.ccaa_key)
      )
      const canariasProvFeatures = allProvFeatures.filter((f) => f.properties.ccaa_key === CANARIAS_KEY)

      // fitExtent is broken for these features because d3-geo's antimeridian preclip
      // injects world-spanning background arcs into the bounds stream, making scale ~76
      // instead of the correct ~2700. Compute scale/translate manually from geo extent.
      function mercatorFit(
        lonMin: number, lonMax: number, latMin: number, latMax: number,
        left: number, top: number, right: number, bottom: number
      ) {
        const toRad = (d: number) => d * Math.PI / 180
        const mercY = (lat: number) => -Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2))
        const x0 = toRad(lonMin), x1 = toRad(lonMax)
        const y0 = mercY(latMin), y1 = mercY(latMax)
        const w = right - left, h = bottom - top
        const scale = Math.min(w / (x1 - x0), h / (y0 - y1)) * 0.95
        const tx = left + (w - scale * (x0 + x1)) / 2
        const ty = top + (h - scale * (y0 + y1)) / 2
        return geoMercator().scale(scale).translate([tx, ty])
      }

      // Mainland: continental Spain + enclaves, fit into [10,10]→[780,490]
      // clipExtent is required to prevent d3-geo from prepending a world-spanning
      // background rectangle that would invert the fill rule for all polygons.
      const mainProj = mercatorFit(-9.251, 4.303, 36.006, 43.732, 10, 10, 780, 490)
        .clipExtent([[0, 0], [800, 600]])

      // Canarias inset: fit into [12,504]→[196,590]
      const canariasProj = mercatorFit(-18.003, -13.482, 27.734, 29.240, 12, 504, 196, 590)
        .clipExtent([[12, 504], [196, 590]])

      const mainPath = geoPath(mainProj)
      const canariasPath = geoPath(canariasProj)

      // geoPath with clipExtent prepends a viewport-rect subpath (M...L...Z) to every
      // polygon feature. Strip it by taking everything after the first Z so the polygon
      // subpaths fill correctly with SVG's non-zero fill rule.
      function stripViewportRect(raw: string): string {
        const z = raw.indexOf("Z")
        return z === -1 ? raw : raw.slice(z + 1)
      }

      // Build CCAA paths
      const ccaaPaths = [
        ...continentalCcaa.map((f) => ({
          d: stripViewportRect(mainPath(f) ?? ""),
          key: f.properties.ccaa_key,
          name: f.properties.ccaa_name,
          isInset: false,
        })),
        ...canariasFeatures.map((f) => ({
          d: stripViewportRect(canariasPath(f) ?? ""),
          key: f.properties.ccaa_key,
          name: f.properties.ccaa_name,
          isInset: true,
        })),
        ...enclaveFeatures.map((f) => ({
          d: stripViewportRect(mainPath(f) ?? ""),
          key: f.properties.ccaa_key,
          name: f.properties.ccaa_name,
          isInset: false,
        })),
      ]

      // Build province paths
      const provPaths = [
        ...continentalProv.map((f) => ({
          d: stripViewportRect(mainPath(f) ?? ""),
          key: `${f.properties.ccaa_key}_${f.properties.province_key}`,
          provKey: f.properties.province_key,
          ccaaKey: f.properties.ccaa_key,
          isInset: false,
        })),
        ...canariasProvFeatures.map((f) => ({
          d: stripViewportRect(canariasPath(f) ?? ""),
          key: `${f.properties.ccaa_key}_${f.properties.province_key}`,
          provKey: f.properties.province_key,
          ccaaKey: f.properties.ccaa_key,
          isInset: true,
        })),
      ]

      // Border meshes — LineString, no viewport rect prefix, no stripping needed
      const bordersGeo = mesh(topoData, topoData.objects.ccaa, (a: object, b: object) => a !== b)
      const borders = mainPath(bordersGeo) ?? ""

      const provBordersGeo = mesh(topoData, topoData.objects.provinces, (a: object, b: object) => a !== b)
      const provBorders = mainPath(provBordersGeo) ?? ""

      setPaths({ ccaa: ccaaPaths as typeof ccaaPaths, provinces: provPaths as typeof provPaths, borders, provBorders })
    }
    load().catch(console.error)
  }, [])


  const handleCcaaClick = useCallback(
    (topoKey: string) => {
      const ccaaData = dataByKey.get(topoKey)
      if (!ccaaData) return
      const entry = { ...ccaaData, topoKey }
      setSelected(entry)
      setLayer("provinces")
      // Compute zoom: find the bounding box of the selected CCAA paths
      // For simplicity, we animate the SVG viewBox to focus on that region
    },
    [dataByKey]
  )

  const handleBack = useCallback(() => {
    setSelected(null)
    setLayer("ccaa")
    setZoomTransform("")
  }, [])

  if (!paths) {
    return (
      <div className="w-full aspect-[4/3] flex items-center justify-center bg-[#0f0f0f]">
        <span className="text-xs text-neutral-600 font-mono">cargando mapa…</span>
      </div>
    )
  }

  const viewBox = "0 0 800 600"

  return (
    <div className="w-full flex flex-col lg:flex-row gap-0 bg-[#0f0f0f] border border-neutral-800">
      {/* Map SVG */}
      <div className="relative flex-1 min-w-0">
        {selected && (
          <button
            onClick={handleBack}
            className="absolute top-3 left-3 z-10 text-xs font-mono text-neutral-400 hover:text-[#C8FF00] transition-colors flex items-center gap-1 bg-[#0f0f0f]/80 px-2 py-1 border border-neutral-800"
            aria-label="Volver al mapa completo"
          >
            ← España
          </button>
        )}
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className="w-full h-auto block"
          role="img"
          aria-label="Mapa interactivo de España por comunidades autónomas"
        >
          <g style={{ transition: "transform 400ms ease-out" }} transform={zoomTransform}>
            {/* CCAA layer */}
            {layer === "ccaa" &&
              paths.ccaa.map((p) => {
                if (!p.d) return null
                const d = dataByKey.get(p.key)
                const amount = d?.totalAmount ?? 0
                const fill = spendColor(amount, maxAmount)
                const isHov = hovered === p.key
                return (
                  <path
                    key={p.key}
                    d={p.d}
                    fill={isHov ? "#C8FF00" : fill}
                    fillOpacity={isHov ? 0.85 : 1}
                    stroke="none"
                    strokeWidth={0}
                    style={{ cursor: "pointer", transition: "fill 150ms, fill-opacity 150ms" }}
                    onMouseEnter={() => setHovered(p.key)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleCcaaClick(p.key)}
                    aria-label={`${p.name} — click para ver detalle`}
                    role="button"
                  />
                )
              })}

            {/* Province layer (shown when a CCAA is selected) */}
            {layer === "provinces" &&
              paths.provinces.map((p) => {
                if (!p.d) return null
                const isActive = p.ccaaKey === selected?.topoKey
                const isHov = hovered === p.key
                const parentData = dataByKey.get(p.ccaaKey)
                const fill = isActive
                  ? isHov
                    ? "#C8FF00"
                    : spendColor(parentData?.totalAmount ?? 0, maxAmount)
                  : "#111111"
                return (
                  <path
                    key={p.key}
                    d={p.d}
                    fill={fill}
                    fillOpacity={isActive ? (isHov ? 0.9 : 0.75) : 0.35}
                    stroke="#0f0f0f"
                    strokeWidth={0.5}
                    style={{
                      cursor: isActive ? "pointer" : "default",
                      transition: "fill 150ms, fill-opacity 150ms",
                    }}
                    onMouseEnter={() => isActive && setHovered(p.key)}
                    onMouseLeave={() => setHovered(null)}
                  />
                )
              })}

            {/* CCAA border mesh overlay */}
            {layer === "ccaa" && (
              <path d={paths.borders ?? ""} fill="none" stroke="#0a0a0a" strokeWidth={0.8} />
            )}
            {/* CCAA borders in province view for context */}
            {layer === "provinces" && paths.borders && (
              <path d={paths.borders} fill="none" stroke="#222" strokeWidth={1} />
            )}
          </g>

          {/* Canarias inset box */}
          <rect x={8} y={498} width={196} height={96} fill="none" stroke="#333" strokeWidth={0.5} />
          <text x={12} y={508} fontSize={7} fill="#555" fontFamily="var(--font-mono, monospace)">
            Islas Canarias
          </text>
        </svg>
      </div>

      {/* Territory panel */}
      <TerritoryPanel
        selected={selected}
        onClose={handleBack}
      />
    </div>
  )
}
