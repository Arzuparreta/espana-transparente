import { EmptyState } from "@/components/domain/EmptyState"
import { LinkTabs } from "@/components/domain/LinkTabs"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getDeclarationsPage, getDeclarationsRegister, PAGE_SIZE, parsePage } from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Declaraciones económicas",
  description: "Registro de bienes, rentas, actividades e intereses económicos declarados por los diputados del Congreso.",
}

const TIPO_LABELS: Record<string, string> = {
  bienes: "Bienes y rentas",
  actividades: "Actividades",
  intereses: "Intereses económicos",
}

function fmtEuro(value: number | null): string {
  if (!value || value <= 0) return "—"
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
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
}

function sourceHost(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

interface PageProps {
  searchParams?: Promise<{ tipo?: string; page?: string }>
}

export default async function DeclaracionesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tipo = params?.tipo ?? "bienes"
  const page = parsePage(params?.page)

  // Always fetch counts for all tabs (cached — one DB round-trip per tab type per hour).
  // Fetch full data only for the active tab.
  const [register, actividadesPage, interesesPage, bienesCountResult] = await Promise.all([
    tipo === "bienes" ? getDeclarationsRegister() : Promise.resolve([]),
    getDeclarationsPage(tipo === "actividades" ? page : 1, "actividades"),
    getDeclarationsPage(tipo === "intereses" ? page : 1, "intereses_economicos"),
    getDeclarationsPage(1, "bienes_rentas"),
  ])

  const actividades = tipo === "actividades" ? actividadesPage : { declarations: [], total: actividadesPage.total }
  const intereses = tipo === "intereses" ? interesesPage : { declarations: [], total: interesesPage.total }

  const bienesTotal = tipo === "bienes" ? register.length : bienesCountResult.total
  const actividadesTotal = actividadesPage.total
  const interesesTotal = interesesPage.total

  const tabs = [
    { href: "/declaraciones?tipo=bienes", label: TIPO_LABELS.bienes, active: tipo === "bienes", badge: String(bienesTotal) },
    { href: "/declaraciones?tipo=actividades", label: TIPO_LABELS.actividades, active: tipo === "actividades", badge: String(actividadesTotal) },
    { href: "/declaraciones?tipo=intereses", label: TIPO_LABELS.intereses, active: tipo === "intereses", badge: String(interesesTotal) },
  ]

  const totalPages = tipo === "actividades"
    ? Math.max(1, Math.ceil(actividades.total / PAGE_SIZE.declarations))
    : tipo === "intereses"
    ? Math.max(1, Math.ceil(intereses.total / PAGE_SIZE.declarations))
    : 1

  const latestDate = tipo === "bienes"
    ? register.map(r => r.declaration_date).filter(Boolean).sort().at(-1) ?? null
    : tipo === "actividades"
    ? actividades.declarations.map(r => r.declaration_date).filter(Boolean).sort().at(-1) ?? null
    : intereses.declarations.map(r => r.declaration_date).filter(Boolean).sort().at(-1) ?? null

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Declaraciones económicas"
        description="Registro de bienes, rentas, actividades e intereses económicos presentados por los diputados al tomar posesión y al cesar en el cargo."
      />

      <SourceFootnote
        sourceLabel="Congreso de los Diputados"
        sourceHref="https://www.congreso.es"
        latestRecordDate={latestDate}
        coverageLabel={
          tipo === "bienes"
            ? `${bienesTotal} declaraciones de bienes y rentas · ${register.filter(r => r.declared_income != null && r.declared_income > 0).length} con ingresos extraídos por OCR`
            : tipo === "actividades"
            ? `${actividadesTotal} declaraciones de actividades`
            : `${interesesTotal} declaraciones de intereses económicos`
        }
      />

      <LinkTabs tabs={tabs} ariaLabel="Tipo de declaración" scroll={false} />

      {/* ── Bienes y rentas ── */}
      {tipo === "bienes" && (
        register.length === 0 ? (
          <EmptyState title="Sin datos" description="No hay declaraciones de bienes y rentas en la base de datos." />
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Ingresos extraídos por OCR del PDF oficial. Pueden contener errores de reconocimiento.
              Consulta el documento original para verificar los datos.
            </p>
            <div className="overflow-hidden rounded-[2px] border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Diputado/a</th>
                    <th className="hidden px-4 py-2 text-left font-medium sm:table-cell">Fecha</th>
                    <th className="px-4 py-2 text-right font-medium">Ingresos declarados</th>
                    <th className="hidden px-4 py-2 text-right font-medium md:table-cell">Activos mencionados</th>
                    <th className="px-4 py-2 text-right font-medium">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {register.map((row) => {
                    const assetParts: string[] = []
                    if (row.inmuebles_mentioned && row.inmuebles_mentioned > 0)
                      assetParts.push(`${row.inmuebles_mentioned} inm.`)
                    if (row.vehiculos_mentioned && row.vehiculos_mentioned > 0)
                      assetParts.push(`${row.vehiculos_mentioned} veh.`)
                    if (row.financial_assets_mentioned && row.financial_assets_mentioned > 0)
                      assetParts.push(`${row.financial_assets_mentioned} fin.`)

                    return (
                      <tr key={row.id} className="text-sm hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          {row.politician_name ? (
                            <ResponsiveLink
                              href={`/diputados/${row.politician_id}`}
                              className="font-medium underline-offset-2 hover:underline"
                            >
                              {row.politician_name}
                            </ResponsiveLink>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
                          {formatDate(row.declaration_date)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {row.ocr_status === "ok" ? (
                            <span className="font-mono font-medium tabular-nums">
                              {fmtEuro(row.declared_income)}
                            </span>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground/60">
                              OCR pendiente
                            </span>
                          )}
                        </td>
                        <td className="hidden px-4 py-2.5 text-right font-mono text-xs text-muted-foreground md:table-cell">
                          {assetParts.length > 0 ? assetParts.join(" · ") : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {row.source_url ? (
                            <a
                              href={row.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                            >
                              Ver →
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── Actividades ── */}
      {tipo === "actividades" && (
        actividades.declarations.length === 0 ? (
          <EmptyState title="Sin datos" description="No hay declaraciones de actividades en la base de datos." />
        ) : (
          <>
            <ul className="space-y-2">
              {actividades.declarations.map((item) => {
                const activityCount = (item.raw_data?.activity_count as number | undefined) ?? null
                const host = sourceHost(item.source_url)
                return (
                  <li key={item.id}>
                    <div className="flex min-w-0 items-start justify-between gap-4 rounded-[2px] border border-border bg-card px-4 py-3">
                      <div className="min-w-0 space-y-0.5">
                        {item.politician_name ? (
                          <ResponsiveLink
                            href={`/diputados/${item.politician_id}`}
                            className="block min-w-0 truncate text-sm font-medium underline-offset-2 hover:underline"
                          >
                            {item.politician_name}
                          </ResponsiveLink>
                        ) : (
                          <p className="truncate text-sm text-muted-foreground">—</p>
                        )}
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          Documento vigente
                          {activityCount != null ? ` · ${activityCount} actividades` : ""}
                          {host ? ` · ${host}` : ""}
                        </p>
                      </div>
                      {item.source_url ? (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          Ver PDF →
                        </a>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
            <Pagination
              page={page}
              totalPages={totalPages}
              hrefForPage={(p) => `/declaraciones?tipo=actividades&page=${p}`}
            />
          </>
        )
      )}

      {/* ── Intereses económicos ── */}
      {tipo === "intereses" && (
        intereses.declarations.length === 0 ? (
          <EmptyState title="Sin datos" description="No hay declaraciones de intereses económicos en la base de datos." />
        ) : (
          <>
            <ul className="space-y-2">
              {intereses.declarations.map((item) => {
                const host = sourceHost(item.source_url)
                return (
                  <li key={item.id}>
                    <div className="flex min-w-0 items-start justify-between gap-4 rounded-[2px] border border-border bg-card px-4 py-3">
                      <div className="min-w-0 space-y-0.5">
                        {item.politician_name ? (
                          <ResponsiveLink
                            href={`/diputados/${item.politician_id}`}
                            className="block min-w-0 truncate text-sm font-medium underline-offset-2 hover:underline"
                          >
                            {item.politician_name}
                          </ResponsiveLink>
                        ) : (
                          <p className="truncate text-sm text-muted-foreground">—</p>
                        )}
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          {formatDate(item.declaration_date)}
                          {host ? ` · ${host}` : ""}
                        </p>
                      </div>
                      {item.source_url ? (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          Ver PDF →
                        </a>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
            <Pagination
              page={page}
              totalPages={totalPages}
              hrefForPage={(p) => `/declaraciones?tipo=intereses&page=${p}`}
            />
          </>
        )
      )}
    </div>
  )
}
