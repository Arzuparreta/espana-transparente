import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { ContratosClient } from "@/components/contratos/ContratosClient"
import { PAGE_SIZE, getContractPage, parsePage } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  searchParams?: {
    page?: string
    type?: string
  }
}

export default async function ContratosPage({ searchParams }: PageProps) {
  const page = parsePage(searchParams?.page)
  const requestedType = searchParams?.type || "all"
  const activeType = ["all", "Servicios", "Obras", "Suministros"].includes(requestedType)
    ? requestedType
    : "all"
  const { contracts, total, statsRows } = await getContractPage(page, activeType)

  const totalAmount = statsRows.reduce((sum, c) => sum + (c.amount ?? 0), 0)
  const formatted =
    totalAmount >= 1_000_000_000
      ? `${(totalAmount / 1_000_000_000).toFixed(1)}B €`
      : `${(totalAmount / 1_000_000).toFixed(0)}M €`

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Contratos públicos"
        description="Licitaciones publicadas en la Plataforma de Contratación del Sector Público (PCSP). Ordenadas por importe sin IVA."
      />

      {statsRows.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{total}</div>
            <div className="text-xs text-muted-foreground">Licitaciones</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{formatted}</div>
            <div className="text-xs text-muted-foreground">Importe total</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">
              {new Set(statsRows.map((c) => c.awarding_body)).size}
            </div>
            <div className="text-xs text-muted-foreground">Organismos</div>
          </div>
        </div>
      ) : null}

      <ContratosClient
        activeType={activeType}
        contracts={contracts}
        page={page}
        total={total}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE.contracts))}
      />

      <InfoPanel title="Fuente">
        Fuente: Plataforma de Contratación del Sector Público (PCSP) · Ministerio de Hacienda.
        Datos actualizados mensualmente. Solo se muestran licitaciones cuyo importe supera el umbral de publicación.
      </InfoPanel>
    </div>
  )
}
