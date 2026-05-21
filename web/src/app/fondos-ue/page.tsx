import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import {
  PAGE_SIZE,
  getEtlLastFinished,
  getEuFundsPage,
  getEuFundsSummary,
  parsePage,
  type EuFundRow,
} from "@/lib/data"

export const revalidate = 3600 * 24

export const metadata = {
  title: "Fondos UE",
  description: "Beneficiarios españoles de los Fondos Estructurales y de Inversión Europeos 2014-2027, según Kohesio.",
}

interface PageProps {
  searchParams?: { page?: string }
}

function formatEuros(amount: number | null): string {
  if (amount == null) return "—"
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2).replace(".", ",")} mil M €`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} M €`
  return `${amount.toLocaleString("es-ES")} €`
}

function BeneficiaryRow({ fund, rank }: { fund: EuFundRow; rank: number }) {
  const kohesioId = fund.id.split("/").at(-1) ?? ""
  const kohesioUrl = `https://kohesio.ec.europa.eu/en/beneficiaries/${kohesioId}`

  return (
    <div
      data-slot="card"
      className="flex min-w-0 items-start justify-between gap-4 rounded-[2px] border bg-card p-4 transition-colors hover:border-foreground/40"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 w-7 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {rank}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium leading-snug">{fund.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {fund.number_projects != null ? `${fund.number_projects.toLocaleString("es-ES")} proyectos` : "—"}
            {fund.cofinancing_rate != null
              ? ` · ${Number(fund.cofinancing_rate).toFixed(1)} % cofinanciación UE`
              : ""}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">{formatEuros(fund.eu_budget)}</p>
          {fund.total_budget && fund.eu_budget && (
            <p className="text-xs text-muted-foreground tabular-nums">
              total {formatEuros(fund.total_budget)}
            </p>
          )}
        </div>
        <a
          href={kohesioUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-[2px] border border-border/60 bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          title="Ver en Kohesio"
        >
          Kohesio →
        </a>
      </div>
    </div>
  )
}

export default async function FondosUEPage({ searchParams }: PageProps) {
  const page = parsePage(searchParams?.page)
  const [{ funds, total }, summary, lastChecked] = await Promise.all([
    getEuFundsPage(page),
    getEuFundsSummary(),
    getEtlLastFinished(["kohesio"]),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.euFunds))
  const offset = (page - 1) * PAGE_SIZE.euFunds

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Fondos europeos"
        description="Dinero que llega desde la Unión Europea y se reparte en España: quién lo recibe y para qué. Periodo 2014-2027. Fuente: Kohesio, portal oficial de la Comisión Europea."
      />

      <SourceFootnote
        sourceLabel="Kohesio · Comisión Europea"
        sourceHref="https://kohesio.ec.europa.eu"
        lastChecked={lastChecked}
        coverageLabel={
          summary
            ? `${Number(summary.beneficiary_count).toLocaleString("es-ES")} beneficiarios · 2014–2027`
            : "2014–2027"
        }
      />

      {summary && (
        <StatGrid
          items={[
            {
              label: "Beneficiarios",
              value: Number(summary.beneficiary_count).toLocaleString("es-ES"),
            },
            {
              label: "Fondos UE a España",
              value: formatEuros(Number(summary.total_eu_budget)),
            },
            {
              label: "Proyectos totales",
              value: Number(summary.total_projects).toLocaleString("es-ES"),
            },
            {
              label: "Cofinanciación media",
              value: summary.avg_cofinancing_rate
                ? `${Number(summary.avg_cofinancing_rate).toFixed(1)} %`
                : "—",
            },
          ]}
        />
      )}

      {funds.length === 0 ? (
        <EmptyState
          title="Sin datos"
          description="El ETL de Kohesio aún no ha ejecutado."
        />
      ) : (
        <div className="space-y-2">
          {funds.map((fund, i) => (
            <BeneficiaryRow key={fund.id} fund={fund} rank={offset + i + 1} />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} hrefForPage={(p) => `?page=${p}`} />

      <InfoPanel title="Fuente">
        Datos extraídos de{" "}
        <a
          href="https://kohesio.ec.europa.eu"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Kohesio
        </a>
        , portal oficial de la Comisión Europea para los fondos estructurales ESIF 2014-2027.
        Incluye FEDER, FSE, Fondo de Cohesión, FEADER y FEMP. Los importes son la contribución
        de la UE; el presupuesto total incluye la cofinanciación nacional. Los datos se
        actualizan semanalmente desde la API pública de Kohesio.
      </InfoPanel>
    </div>
  )
}
