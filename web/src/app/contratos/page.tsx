import { supabase } from "@/lib/supabase/client"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { ContratosClient } from "@/components/contratos/ContratosClient"

export const revalidate = 3600

export default async function ContratosPage() {
  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, contract_folder_id, title, awarding_body, amount, status, contract_type, region, date, source_url")
    .order("amount", { ascending: false, nullsFirst: false })
    .limit(500)

  const rows = contracts ?? []

  const totalAmount = rows.reduce((sum, c) => sum + (c.amount ?? 0), 0)
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

      {rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{rows.length}</div>
            <div className="text-xs text-muted-foreground">Licitaciones</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{formatted}</div>
            <div className="text-xs text-muted-foreground">Importe total</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">
              {new Set(rows.map((c) => c.awarding_body)).size}
            </div>
            <div className="text-xs text-muted-foreground">Organismos</div>
          </div>
        </div>
      ) : null}

      <ContratosClient contracts={rows} />

      <InfoPanel title="Fuente">
        Fuente: Plataforma de Contratación del Sector Público (PCSP) · Ministerio de Hacienda.
        Datos actualizados mensualmente. Solo se muestran licitaciones cuyo importe supera el umbral de publicación.
      </InfoPanel>
    </div>
  )
}
