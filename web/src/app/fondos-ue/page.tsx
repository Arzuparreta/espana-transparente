import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import {
  PAGE_SIZE,
  getEtlLastFinished,
  getEuFundsPage,
  getEuFundsSummary,
  parsePage,
  type EuFundRow,
} from "@/lib/data"
import { formatEuroCompact } from "@/lib/format"

export const revalidate = 86400

export const metadata = {
  title: "Fondos UE",
  description: "Beneficiarios españoles de los Fondos Estructurales y de Inversión Europeos 2014-2027, según Kohesio.",
}

interface PageProps {
  searchParams?: Promise<{ page?: string }>
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
        <span className="mt-0.5 w-7 shrink-0 text-right font-mono text-xs text-muted-foreground">
          {rank}
        </span>
        <div className="min-w-0">
          {kohesioId ? (
            <ResponsiveLink
              href={`/fondos-ue/${encodeURIComponent(kohesioId)}`}
              className="block truncate font-medium leading-snug underline-offset-2 hover:underline"
            >
              {fund.label}
            </ResponsiveLink>
          ) : (
            <p className="truncate font-medium leading-snug">{fund.label}</p>
          )}
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {fund.number_projects != null ? `${fund.number_projects.toLocaleString("es-ES")} proyectos` : "—"}
            {fund.cofinancing_rate != null
              ? ` · ${Number(fund.cofinancing_rate).toFixed(1)} % cofinanciación UE`
              : ""}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="font-mono text-sm font-semibold">{formatEuroCompact(fund.eu_budget)}</p>
          {fund.total_budget != null && fund.eu_budget != null && (
            <p className="font-mono text-xs text-muted-foreground">
              total {formatEuroCompact(fund.total_budget)}
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
  const page = parsePage((await searchParams)?.page)
  const [{ funds, total }, summary, lastChecked] = await Promise.all([
    getEuFundsPage(page),
    getEuFundsSummary(),
    getEtlLastFinished(["kohesio"]),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.euFunds))
  const offset = (page - 1) * PAGE_SIZE.euFunds

  return (
    <div className="ui-page">
      <PageHeader
        title="¿Qué beneficiarios figuran en Kohesio?"
        description="Beneficiarios españoles registrados en Kohesio y presupuesto UE asociado a sus proyectos. Cobertura plurianual de cohesión 2014-2027: no es el total de fondos europeos ni acredita importes pagados."
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

      <p className="text-sm leading-6 text-muted-foreground">
        Los importes agregan el presupuesto UE registrado para los beneficiarios disponibles en el portal,
        sin selección anual ni certificación de pagos. No representan el MRR/PRTR ni el conjunto de la PAC.
        El presupuesto total incluye cofinanciación nacional: no se añade al presupuesto UE como otro flujo.
      </p>

      {summary && (
        <StatGrid
          items={[
            {
              label: "Beneficiarios",
              value: Number(summary.beneficiary_count).toLocaleString("es-ES"),
            },
            {
              label: "Presupuesto UE · Kohesio",
              value: formatEuroCompact(Number(summary.total_eu_budget)),
            },
            {
              label: "Proyectos registrados",
              value: Number(summary.total_projects).toLocaleString("es-ES"),
            },
            {
              label: "Cofinanciación media",
              value: summary.avg_cofinancing_rate != null
                ? `${Number(summary.avg_cofinancing_rate).toFixed(1)} %`
                : "—",
            },
          ]}
        />
      )}

      {funds.length === 0 ? (
        <EmptyState
          title="Sin datos"
          description="No hay beneficiarios disponibles en esta página. Consulta la cobertura y el estado de la fuente."
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
