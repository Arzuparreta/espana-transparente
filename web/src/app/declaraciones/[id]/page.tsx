import { notFound } from "next/navigation"
import { getDeclarationById } from "@/lib/data"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const decl = await getDeclarationById(id)
  if (!decl) return { title: "Declaración no encontrada" }
  return {
    title: `Declaración de ${decl.politician_name ?? "diputado/a"}`,
    description: `Declaración ${decl.type ?? ""} de ${decl.politician_name ?? ""} - ${decl.declaration_date ?? ""}`,
  }
}

function fmtEuro(value: number | null): string {
  if (value == null || value <= 0) return "—"
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null): string {
  if (!value) return "Documento vigente"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "Documento vigente"
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
}

function sourceHost(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

const TYPE_LABELS: Record<string, string> = {
  bienes_rentas: "Bienes y rentas",
  actividades: "Actividades",
  intereses_economicos: "Intereses económicos",
}

export default async function DeclarationDetailPage({ params }: PageProps) {
  const { id } = await params
  const decl = await getDeclarationById(id)

  if (!decl) notFound()

  const typeLabel = TYPE_LABELS[decl.type ?? ""] ?? decl.type ?? "Declaración"
  const host = sourceHost(decl.source_url)
  const rawData = decl.raw_data as Record<string, unknown> ?? {}

  return (
    <div className="space-y-6 sm:space-y-8">
      <ContextTrail
        section={{ href: "/declaraciones", label: "Declaraciones" }}
        current={decl.politician_name ? `${typeLabel} · ${decl.politician_name}` : typeLabel}
        fallbackHref="/declaraciones"
        fallbackLabel="Volver a Declaraciones"
      />

      <PageHeader
        title={`${typeLabel}`}
        description={
          decl.politician_name
            ? `Presentada por ${decl.politician_name}`
            : undefined
        }
      />

      <SourceFootnote
        sourceLabel="Congreso de los Diputados"
        latestRecordDate={decl.declaration_date}
        coverageLabel={typeLabel}
      />

      {/* ── Meta card ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Datos de la declaración</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Fecha</dt>
              <dd className="mt-0.5 font-medium">{formatDate(decl.declaration_date)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</dt>
              <dd className="mt-0.5 font-medium">{typeLabel}</dd>
            </div>
            {decl.ocr_status && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Estado OCR</dt>
                <dd className="mt-0.5 font-mono text-xs">{decl.ocr_status}</dd>
              </div>
            )}
          </dl>

          {decl.source_url && (
            <div className="mt-4">
              <a
                href={decl.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Documento oficial{host ? ` · ${host}` : ""}
                →
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Bienes y rentas ── */}
      {decl.type === "bienes_rentas" && (
        <>
          {(decl.declared_income != null || decl.irpf_paid != null) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Ingresos declarados</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {decl.declared_income != null && decl.declared_income > 0 && (
                    <div className="rounded-[2px] border border-border bg-background/60 px-3 py-2.5">
                      <div className="text-xs text-muted-foreground">Ingresos totales</div>
                      <div className="mt-0.5 font-mono text-lg font-medium tabular-nums">
                        {fmtEuro(decl.declared_income)}
                      </div>
                    </div>
                  )}
                  {decl.irpf_paid != null && decl.irpf_paid > 0 && (
                    <div className="rounded-[2px] border border-border bg-background/60 px-3 py-2.5">
                      <div className="text-xs text-muted-foreground">IRPF pagado</div>
                      <div className="mt-0.5 font-mono text-lg font-medium tabular-nums">
                        {fmtEuro(decl.irpf_paid)}
                      </div>
                    </div>
                  )}
                </div>

                {(decl.inmuebles_mentioned != null || decl.vehiculos_mentioned != null || decl.financial_assets_mentioned != null) && (
                  <>
                    <div className="border-t border-border my-4" />
                    <div className="flex flex-wrap gap-2">
                      {decl.inmuebles_mentioned != null && decl.inmuebles_mentioned > 0 && (
                        <span className="rounded bg-muted/50 px-2.5 py-1 text-xs font-medium">
                          🏠 {decl.inmuebles_mentioned} inmuebles
                        </span>
                      )}
                      {decl.vehiculos_mentioned != null && decl.vehiculos_mentioned > 0 && (
                        <span className="rounded bg-muted/50 px-2.5 py-1 text-xs font-medium">
                          🚗 {decl.vehiculos_mentioned} vehículos
                        </span>
                      )}
                      {decl.financial_assets_mentioned != null && decl.financial_assets_mentioned > 0 && (
                        <span className="rounded bg-muted/50 px-2.5 py-1 text-xs font-medium">
                          💰 {decl.financial_assets_mentioned} activos financieros
                        </span>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* OCR text */}
          {!!rawData.ocr_text && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Texto extraído (OCR)</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="mb-3 text-xs text-muted-foreground">
                  Texto reconocido automáticamente del PDF. Puede contener errores.
                </p>
                <pre className="max-h-64 overflow-y-auto rounded-[2px] border border-border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                  {String(rawData.ocr_text).slice(0, 4000)}
                  {String(rawData.ocr_text).length > 4000 && "\n\n[... texto truncado, ver documento oficial para contenido completo]"}
                </pre>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Actividades ── */}
      {decl.type === "actividades" && !!rawData.activities && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Actividades declaradas</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {Array.isArray(rawData.activities) && (rawData.activities as unknown[]).length > 0 ? (
              <ul className="space-y-3">
                {(rawData.activities as Array<Record<string, unknown>>).map((act, i) => (
                  <li key={i} className="border-l-2 border-muted/50 pl-3">
                    {!!act.employer && <div className="font-medium">{String(act.employer)}</div>}
                    {!!act.description && <div className="mt-0.5 text-sm text-muted-foreground">{String(act.description)}</div>}
                    {(!!act.sector || !!act.period) && (
                      <div className="mt-0.5 flex gap-2 text-xs text-muted-foreground/70">
                        {!!act.sector && <span>{String(act.sector)}</span>}
                        {!!act.period && <span>{String(act.period)}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos de actividades disponibles.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Intereses económicos ── */}
      {decl.type === "intereses_economicos" && !!rawData.activities && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Intereses económicos</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {Array.isArray(rawData.activities) && (rawData.activities as unknown[]).length > 0 ? (
              <ul className="space-y-3">
                {(rawData.activities as Array<Record<string, unknown>>).map((act, i) => (
                  <li key={i} className="border-l-2 border-muted/50 pl-3">
                    {!!act.employer && <div className="font-medium">{String(act.employer)}</div>}
                    {!!act.description && <div className="mt-0.5 text-sm text-muted-foreground">{String(act.description)}</div>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos de intereses económicos disponibles.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Navigation ── */}
      {decl.politician_id && (
        <div className="flex gap-3">
          <ResponsiveLink
            href={`/diputados/${decl.politician_id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Ver ficha del/de la diputado/a →
          </ResponsiveLink>
        </div>
      )}
    </div>
  )
}
