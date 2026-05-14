"use client"

import { Card, CardContent } from "@/components/ui/card"
import { SectionTabs } from "@/components/domain/SectionTabs"

interface Contrato {
  id: string
  contract_folder_id: string | null
  title: string
  awarding_body: string | null
  amount: number | null
  status: string | null
  contract_type: string | null
  region: string | null
  date: string | null
  source_url: string | null
}

interface ContratosClientProps {
  contracts: Contrato[]
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

function ContratoCard({ c }: { c: Contrato }) {
  const dateStr = c.date
    ? new Date(c.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
    : null

  return (
    <Card className="bg-card/85">
      <CardContent className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start gap-2">
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(c.status)}`}
            >
              {STATUS_LABELS[c.status ?? ""] ?? c.status ?? "—"}
            </span>
            {c.contract_type ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {c.contract_type}
              </span>
            ) : null}
          </div>
          <div className="text-sm font-medium leading-snug text-balance">{c.title}</div>
          <div className="text-xs text-muted-foreground">
            {c.awarding_body ?? "—"}
            {c.region ? ` · ${c.region}` : ""}
          </div>
          {dateStr ? <div className="text-[11px] text-muted-foreground">{dateStr}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
          <div className="text-base font-semibold tabular-nums">{formatAmount(c.amount)}</div>
          {c.source_url ? (
            <a
              href={c.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Ver expediente →
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function ContratosClient({ contracts }: ContratosClientProps) {
  return (
    <SectionTabs tabs={TYPE_TABS} defaultTab="all">
      {(activeType) => {
        const filtered =
          activeType === "all"
            ? contracts
            : contracts.filter((c) => c.contract_type === activeType)

        return (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {filtered.length} licitaciones · ordenadas por importe
            </div>
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Sin datos. Ejecuta el ETL: <code>PYTHONPATH=src python -m src.contratacion.contratos</code>
                </CardContent>
              </Card>
            ) : (
              filtered.map((c) => <ContratoCard key={c.id} c={c} />)
            )}
          </div>
        )
      }}
    </SectionTabs>
  )
}
