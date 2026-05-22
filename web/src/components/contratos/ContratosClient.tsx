"use client"

import { EmptyState } from "@/components/domain/EmptyState"
import { FilterChip } from "@/components/domain/FilterChip"
import { LinkTabs } from "@/components/domain/LinkTabs"
import { Pagination } from "@/components/domain/Pagination"
import { Card, CardContent } from "@/components/ui/card"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { ResponsibleChip, type Responsible } from "@/components/domain/ResponsibleChip"

interface Contrato {
  id: string
  contract_folder_id: string | null
  title: string
  awarding_body: string | null
  awarding_body_organization_id: string | null
  amount: number | null
  status: string | null
  contract_type: string | null
  region: string | null
  date: string | null
  responsible: Responsible | null
  source_url: string | null
  contractor_nif: string | null
  contractor_is_sme: boolean | null
  contractor_is_ute: boolean | null
  award_amount: number | null
  award_amount_with_taxes: number | null
  award_date: string | null
  contract_number: string | null
  received_tender_quantity: number | null
}

const LEVEL_LABELS: Record<string, string> = {
  state: "Estatal",
  autonomic: "Autonómico",
  municipal: "Municipal",
}

interface ContratosClientProps {
  activeType: string
  activeMinistry?: string | null
  activeLevel?: string | null
  contracts: Contrato[]
  page: number
  total: number
  totalPages: number
}

const STATUS_LABELS: Record<string, string> = {
  PUB: "Publicada",
  ADJ: "Adjudicada",
  RES: "Resuelta",
  ANU: "Anulada",
  PRE: "En preparación",
  EV: "En evaluación",
  INI: "Iniciada",
}

const STATUS_VARIANT: Record<string, string> = {
  PUB: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ADJ: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  RES: "bg-muted text-muted-foreground",
  ANU: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  PRE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
}

function formatAmount(eur: number | null): string {
  if (eur == null) return "—"
  if (eur >= 1_000_000) return `${(eur / 1_000_000).toFixed(1)}M €`
  if (eur >= 1_000) return `${Math.round(eur / 1_000)}K €`
  return `${Math.round(eur)} €`
}

function statusClass(status: string | null): string {
  return STATUS_VARIANT[status ?? ""] ?? "bg-muted text-muted-foreground"
}

const TYPE_TABS = [
  { value: "all", label: "Todos" },
  { value: "Servicios", label: "Servicios" },
  { value: "Obras", label: "Obras" },
  { value: "Suministros", label: "Suministros" },
]

function ContratoCard({ c, activeMinistry }: { c: Contrato; activeMinistry?: string | null }) {
  const dateStr = c.date
    ? new Date(c.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
    : null

  const tenderCount = c.received_tender_quantity

  return (
    <Card className="transition-colors hover:bg-card">
      <ResponsiveLink href={`/contratos/${c.id}`}>
      <CardContent className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start gap-2">
            <span
              className={`shrink-0 rounded-[2px] px-2 py-0.5 text-xs font-medium ${statusClass(c.status)}`}
            >
              {STATUS_LABELS[c.status ?? ""] ?? c.status ?? "—"}
            </span>
            {c.contract_type ? (
              <span className="rounded-[2px] bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {c.contract_type}
              </span>
            ) : null}
            {c.contractor_is_sme && (
              <span className="rounded-[2px] border border-accent/35 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
                PYME
              </span>
            )}
            {tenderCount != null && tenderCount <= 2 && (
              <span className="rounded-[2px] border border-red-500/30 bg-red-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-red-400">
                {tenderCount} oferta{tenderCount !== 1 ? "s" : ""}
              </span>
            )}
            <ResponsibleChip
              responsible={c.responsible}
              ministryHref={c.responsible?.ministry && !activeMinistry ? `/contratos?ministry=${encodeURIComponent(c.responsible.ministry)}` : null}
            />
          </div>
          <div className="text-sm font-medium leading-snug text-balance">{c.title}</div>
          <div className="text-xs text-muted-foreground">
            {c.awarding_body_organization_id ? (
              <ResponsiveLink
                href={`/organizaciones/${c.awarding_body_organization_id}`}
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                {c.awarding_body ?? "—"}
              </ResponsiveLink>
            ) : (
              c.awarding_body ?? "—"
            )}
            {c.region ? ` · ${c.region}` : ""}
            {tenderCount != null && tenderCount >= 3 ? ` · ${tenderCount} ofertas` : ""}
          </div>
          {dateStr ? <div className="text-xs text-muted-foreground">{dateStr}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
          <div className="text-base font-semibold tabular-nums">{formatAmount(c.amount)}</div>
          {c.source_url ? (
            <a
              href={c.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Ver expediente →
            </a>
          ) : null}
        </div>
      </CardContent>
      </ResponsiveLink>
    </Card>
  )
}

function contractsHref(
  type: string,
  page = 1,
  ministry?: string | null,
  level?: string | null
) {
  const params = new URLSearchParams()
  if (type !== "all") params.set("type", type)
  if (page > 1) params.set("page", String(page))
  if (ministry) params.set("ministry", ministry)
  if (level) params.set("level", level)
  const query = params.toString()
  return query ? `/contratos?${query}` : "/contratos"
}

export function ContratosClient({
  activeType,
  activeMinistry,
  activeLevel,
  contracts,
  page,
  total,
  totalPages,
}: ContratosClientProps) {
  const clearLevelHref = contractsHref(activeType, 1, activeMinistry, null)
  const clearMinistryHref = contractsHref(activeType, 1, null, activeLevel)

  return (
    <div className="space-y-6">
      <LinkTabs
        ariaLabel="Tipo de contrato"
        scroll={false}
        tabs={TYPE_TABS.map((tab) => ({
          href: contractsHref(tab.value, 1, activeMinistry, activeLevel),
          label: tab.label,
          active: activeType === tab.value,
        }))}
      />

      {activeMinistry && (
        <FilterChip
          label="Ministerio"
          value={activeMinistry}
          clearHref={clearMinistryHref}
        />
      )}

      {activeLevel && (
        <FilterChip
          label="Nivel"
          value={LEVEL_LABELS[activeLevel] ?? activeLevel}
          clearHref={clearLevelHref}
        />
      )}

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          {total} licitaciones · ordenadas por importe
        </div>
        {contracts.length === 0 ? (
          <EmptyState
            title="Sin licitaciones"
            description="No hay contratos con estos filtros en la muestra actual."
            action={
              <ResponsiveLink
                href="/estado-datos"
                className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Ver estado de los datos →
              </ResponsiveLink>
            }
          />
        ) : (
          contracts.map((c) => <ContratoCard key={c.id} c={c} activeMinistry={activeMinistry} />)
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefForPage={(nextPage) => contractsHref(activeType, nextPage, activeMinistry, activeLevel)}
      />
    </div>
  )
}
