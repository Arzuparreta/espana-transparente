"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EconomicDeclaration } from "@/types"

const TYPE_LABELS: Record<string, string> = {
  actividades: "Declaración de Actividades",
  bienes_rentas: "Declaraciones de bienes y rentas",
  intereses_economicos: "Declaraciones de intereses económicos",
}

const TYPE_FALLBACK = "Declaraciones"

interface Props {
  declarations: EconomicDeclaration[]
}

function formatDate(value: string | undefined) {
  if (!value) return null
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function getType(declaration: EconomicDeclaration): string {
  const raw = declaration.raw_data as { type?: string } | undefined
  return raw?.type || "otros"
}

function sourceHost(url: string | undefined) {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function fmtEuro(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function OcrExtract({ data }: { data: Record<string, unknown> }) {
  const [showOcr, setShowOcr] = useState(false)
  const incomes = data.incomes as Array<{ source: string; amount: number }> | undefined
  const totalIncome = data.total_income as number | undefined
  const irpfPaid = data.irpf_paid as number | undefined
  const inmuebles = data.inmuebles_mentioned as number | undefined
  const vehiculos = data.vehiculos_mentioned as number | undefined
  const financial = data.financial_assets_mentioned as number | undefined
  const ocrText = data.ocr_text as string | undefined
  const ocrProcessed = data.ocr_processed_at as string | undefined

  const hasExtract = totalIncome != null || irpfPaid != null || (incomes && incomes.length > 0)
  const hasAssets = inmuebles != null || vehiculos != null || financial != null

  if (!hasExtract && !hasAssets && !ocrText) return null

  return (
    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
      {/* Income summary */}
      {hasExtract && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {totalIncome != null && totalIncome > 0 && (
            <div className="rounded border border-border bg-background/60 px-2 py-2">
              <div className="text-xs text-muted-foreground">Ingresos totales</div>
              <div className="font-mono font-medium">{fmtEuro(totalIncome)}</div>
            </div>
          )}
          {irpfPaid != null && irpfPaid > 0 && (
            <div className="rounded border border-border bg-background/60 px-2 py-2">
              <div className="text-xs text-muted-foreground">IRPF pagado</div>
              <div className="font-mono font-medium">{fmtEuro(irpfPaid)}</div>
            </div>
          )}
        </div>
      )}

      {/* Income sources */}
      {incomes && incomes.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Fuentes de ingresos ({incomes.length})
          </summary>
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
            {incomes.map((inc, i) => (
              <div key={i} className="flex justify-between gap-2 border-b border-muted/30 py-1 text-xs">
                <span className="text-muted-foreground truncate max-w-[70%]">{inc.source}</span>
                <span className="font-mono shrink-0">{fmtEuro(inc.amount)}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Asset mentions */}
      {hasAssets && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {inmuebles != null && inmuebles > 0 && (
            <span className="rounded bg-muted/50 px-2 py-0.5">🏠 {inmuebles} inmuebles</span>
          )}
          {vehiculos != null && vehiculos > 0 && (
            <span className="rounded bg-muted/50 px-2 py-0.5">🚗 {vehiculos} vehículos</span>
          )}
          {financial != null && financial > 0 && (
            <span className="rounded bg-muted/50 px-2 py-0.5">💰 {financial} refs. financieras</span>
          )}
        </div>
      )}

      {/* OCR text (collapsible) */}
      {ocrText && (
        <details className="text-sm">
          <summary
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => setShowOcr(!showOcr)}
          >
            Texto OCR{ocrProcessed ? ` (procesado ${new Date(ocrProcessed).toLocaleDateString("es-ES")})` : ""}
          </summary>
          {showOcr && (
            <pre className="mt-2 max-h-64 overflow-y-auto rounded border border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
              {ocrText.slice(0, 4000)}
              {ocrText.length > 4000 && "\n\n[... texto truncado, ver PDF original para contenido completo]"}
            </pre>
          )}
        </details>
      )}
    </div>
  )
}

export function EconomicDeclarationList({ declarations }: Props) {
  if (declarations.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">
            No consta declaración publicada en este momento.
          </p>
        </CardContent>
      </Card>
    )
  }

  const grouped = new Map<string, EconomicDeclaration[]>()
  for (const declaration of declarations) {
    const type = getType(declaration)
    const list = grouped.get(type) ?? []
    list.push(declaration)
    grouped.set(type, list)
  }

  Array.from(grouped.values()).forEach((list) =>
    list.sort((a, b) =>
      (b.declaration_date || "").localeCompare(a.declaration_date || ""),
    ),
  )

  const known = ["actividades", "bienes_rentas", "intereses_economicos"]
  const orderedKeys = [
    ...known.filter((k) => grouped.has(k)),
    ...Array.from(grouped.keys()).filter((k) => !known.includes(k)),
  ]

  return (
    <div className="space-y-4">
      {orderedKeys.map((type) => (
        <Card key={type}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              {TYPE_LABELS[type] || TYPE_FALLBACK}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-3">
              {grouped.get(type)!.map((declaration) => {
                const date = formatDate(declaration.declaration_date)
                const host = sourceHost(declaration.source_url)
                const isActividades = type === "actividades"
                const rawData = (declaration.raw_data || {}) as Record<string, unknown>
                return (
                  <li key={declaration.id} className="space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-sm text-foreground font-medium">
                        {isActividades ? "Documento vigente" : (date || "Sin fecha")}
                      </span>
                      {declaration.source_url ? (
                        <a
                          href={declaration.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Documento oficial{host ? ` · ${host}` : ""}
                        </a>
                      ) : null}
                    </div>
                    <OcrExtract data={rawData} />
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
