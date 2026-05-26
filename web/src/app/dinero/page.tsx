import { ThreadLanding, ThreadAnchorCard } from "@/components/domain/ThreadLanding"
import { getSectionIndex, getTopContractOfMonth, getEuFundsSummary, getMoneyDataOverview } from "@/lib/data"
import { getThread } from "@/lib/thread-config"

export const revalidate = 3600

export const metadata = {
  title: "Dinero",
  description: "Presupuestos, contratos, subvenciones y fondos europeos conectados por fuente pública.",
}

function formatAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Sin dato"
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function windowLabel(days: 30 | 60 | 90 | null): string {
  if (days === 30) return "últimos 30 días"
  if (days === 60) return "últimos 60 días"
  if (days === 90) return "últimos 90 días"
  return "histórico"
}

export default async function DineroThreadPage() {
  const thread = getThread("dinero")
  const [sectionIndex, topContract, euSummary, overview] = await Promise.all([
    getSectionIndex(),
    getTopContractOfMonth(),
    getEuFundsSummary(),
    getMoneyDataOverview(),
  ])
  const totalMoneyRows = overview.coverage.reduce((sum, row) => sum + Number(row.total_rows ?? 0), 0)

  return (
    <ThreadLanding
      thread={thread}
      sectionIndex={sectionIndex}
      anchors={
        <>
          {totalMoneyRows > 0 ? (
            <ThreadAnchorCard
              label="Registros de gasto"
              value={totalMoneyRows.toLocaleString("es-ES")}
              description="Contratos, subvenciones y fondos europeos normalizados para consulta transversal."
              href="/dinero-publico"
              linkLabel="Ver trazabilidad →"
            />
          ) : null}
          {topContract?.amount != null ? (
            <ThreadAnchorCard
              label={`Mayor contrato · ${windowLabel(topContract.windowDays)}`}
              value={formatAmount(topContract.amount)}
              description={
                <>
                  <span className="line-clamp-2 font-medium">
                    {topContract.title}
                  </span>
                  {topContract.awarding_body ? (
                    <span className="mt-1 block text-xs line-clamp-1">
                      {topContract.awarding_body}
                    </span>
                  ) : null}
                </>
              }
              href={`/contratos/${topContract.id}`}
              linkLabel="Ver contrato →"
            />
          ) : null}
          {euSummary ? (
            <ThreadAnchorCard
              label="Fondos europeos"
              value={formatAmount(Number(euSummary.total_eu_budget))}
              description={`${Number(euSummary.beneficiary_count).toLocaleString("es-ES")} beneficiarios españoles en Kohesio.`}
              source="Fuente: Comisión Europea · Kohesio."
              href="/fondos-ue"
              linkLabel="Ver fondos UE →"
            />
          ) : null}
        </>
      }
    />
  )
}
