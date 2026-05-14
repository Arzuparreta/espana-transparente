import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { SubvencionesClient } from "@/components/subvenciones/SubvencionesClient"
import { PAGE_SIZE_SUBSIDIES, getSubvencionPage, parsePage } from "@/lib/data"

export const revalidate = 3600

const VALID_NIVELES = ["all", "ESTADO", "AUTONOMICA", "LOCAL"]

interface PageProps {
  searchParams?: {
    page?: string
    nivel?: string
  }
}

export default async function SubvencionesPage({ searchParams }: PageProps) {
  const page = parsePage(searchParams?.page)
  const requestedNivel = searchParams?.nivel || "all"
  const activeNivel = VALID_NIVELES.includes(requestedNivel) ? requestedNivel : "all"

  const { subsidies, total, statsRows } = await getSubvencionPage(page, activeNivel)

  const totalAmount = statsRows.reduce((sum, s) => sum + ((s as { importe?: number }).importe ?? 0), 0)
  const formatted =
    totalAmount >= 1_000_000_000
      ? `${(totalAmount / 1_000_000_000).toFixed(1)}B €`
      : `${(totalAmount / 1_000_000).toFixed(0)}M €`

  const uniqueOrganos = new Set(statsRows.map((s) => (s as { nivel3?: string }).nivel3).filter(Boolean)).size

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Subvenciones"
        description="Concesiones publicadas en la Base de Datos Nacional de Subvenciones (BDNS). Solo organizaciones — beneficiarios individuales están anonimizados en la fuente."
      />

      {statsRows.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{statsRows.length.toLocaleString("es-ES")}</div>
            <div className="text-xs text-muted-foreground">Concesiones (muestra)</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{formatted}</div>
            <div className="text-xs text-muted-foreground">Importe total muestra</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{uniqueOrganos}</div>
            <div className="text-xs text-muted-foreground">Organismos</div>
          </div>
        </div>
      ) : null}

      <SubvencionesClient
        activeNivel={activeNivel}
        subsidies={subsidies}
        page={page}
        total={total}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE_SUBSIDIES))}
      />

      <InfoPanel title="Fuente">
        Fuente: Base de Datos Nacional de Subvenciones (BDNS) · Intervención General de la Administración del Estado (IGAE).
        API pública en infosubvenciones.es. Solo se muestran concesiones a organizaciones; los beneficiarios individuales
        están anonimizados en la fuente original y no se almacenan.
      </InfoPanel>
    </div>
  )
}
