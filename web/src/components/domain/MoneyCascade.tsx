import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import type { MoneyFlowSection, TopBeneficiary } from "@/lib/data/money-flow"

interface MoneyCascadeProps {
  year: number
  sections: MoneyFlowSection[]
  initialOpenSectionCode?: string | null
}

function formatAmount(value: number | null | undefined): string {
  if (value == null || value === 0) return "—"
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M €`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K €`
  return `${Math.round(value)} €`
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function BeneficiaryList({ items, label }: { items: TopBeneficiary[]; label: string }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <ul className="space-y-1">
        {items.map((b, i) => (
          <li key={i} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/30 py-1 last:border-0">
            {b.organization_id ? (
              <ResponsiveLink
                href={`/organizaciones/${b.organization_id}`}
                className="min-w-0 truncate text-xs text-foreground/80 underline-offset-2 hover:underline"
              >
                {b.name}
              </ResponsiveLink>
            ) : (
              <span className="min-w-0 truncate text-xs text-foreground/80">{b.name}</span>
            )}
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {formatAmount(b.total_amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MoneyCascade({ year, sections, initialOpenSectionCode }: MoneyCascadeProps) {
  return (
    <ul className="space-y-2">
      {sections.map((section) => {
        const open = section.section_code === initialOpenSectionCode
        const ministryFilter = section.ministry_normalized
          ? encodeURIComponent(section.ministry_normalized)
          : null

        return (
          <li key={section.section_code} id={`section-${section.section_code}`}>
            <details
              open={open || undefined}
              className="group rounded-[2px] border border-border bg-card transition-colors open:border-foreground/30"
            >
              <summary className="flex min-w-0 cursor-pointer list-none items-baseline justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {section.section_code}
                  </span>
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {section.section_name}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
                  {formatAmount(section.total_credit_initial)}
                </span>
              </summary>

              <div className="space-y-4 border-t border-border/60 px-4 py-4 sm:px-6">
                <dl className="grid gap-y-2 gap-x-6 text-sm sm:grid-cols-2">
                  <div className="flex items-baseline gap-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Ministerio
                    </dt>
                    <dd className="min-w-0 truncate">
                      {section.ministry_normalized ?? "Sin ministerio asignado"}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Responsable
                    </dt>
                    <dd className="min-w-0 truncate">
                      {section.minister_person_id && section.minister_name ? (
                        <ResponsiveLink
                          href={`/ministerios/${section.minister_person_id}`}
                          className="underline-offset-2 hover:underline"
                        >
                          {section.minister_name}
                        </ResponsiveLink>
                      ) : (
                        section.minister_name ?? "Sin resolver"
                      )}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Programas
                    </dt>
                    <dd className="font-mono tabular-nums">{section.programs.length}</dd>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Último dato downstream
                    </dt>
                    <dd className="font-mono tabular-nums">
                      {formatDate(section.latest_record_date)}
                    </dd>
                  </div>
                </dl>

                <section className="space-y-2">
                  <h4 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Programas presupuestarios
                  </h4>
                  <ul className="space-y-1">
                    {section.programs
                      .slice()
                      .sort((a, b) => (b.total_credit_initial ?? 0) - (a.total_credit_initial ?? 0))
                      .map((p) => (
                        <li
                          key={p.program_code}
                          id={`program-${p.program_code}`}
                          className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/40 py-1.5 last:border-0"
                        >
                          <ResponsiveLink
                            href={`/presupuestos/${section.section_code}/${p.program_code}`}
                            className="flex min-w-0 items-baseline gap-3 text-sm underline-offset-2 hover:underline"
                          >
                            <span className="shrink-0 font-mono text-xs text-muted-foreground">
                              {p.program_code}
                            </span>
                            <span className="min-w-0 truncate">{p.program_name ?? "—"}</span>
                          </ResponsiveLink>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                            {formatAmount(p.total_credit_initial)}
                          </span>
                        </li>
                      ))}
                  </ul>
                </section>

                <section className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[2px] border border-border/70 bg-background/60 px-3 py-3">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Contratos asociados
                    </div>
                    {section.contract_count === 0 ? (
                      <div className="mt-1 text-xs text-muted-foreground">Sin datos</div>
                    ) : (
                      <>
                        <div className="mt-1 font-mono text-sm tabular-nums">
                          {section.contract_count.toLocaleString("es-ES")} · {formatAmount(section.contract_total)}
                        </div>
                        {ministryFilter ? (
                          <ResponsiveLink
                            href={`/contratos?ministry=${ministryFilter}`}
                            className="mt-1 inline-flex text-xs underline-offset-2 hover:underline"
                          >
                            Ver contratos →
                          </ResponsiveLink>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="rounded-[2px] border border-border/70 bg-background/60 px-3 py-3">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Subvenciones asociadas
                    </div>
                    {section.subsidy_count === 0 ? (
                      <div className="mt-1 text-xs text-muted-foreground">Sin datos</div>
                    ) : (
                      <>
                        <div className="mt-1 font-mono text-sm tabular-nums">
                          {section.subsidy_count.toLocaleString("es-ES")} · {formatAmount(section.subsidy_total)}
                        </div>
                        {ministryFilter ? (
                          <ResponsiveLink
                            href={`/subvenciones?ministry=${ministryFilter}`}
                            className="mt-1 inline-flex text-xs underline-offset-2 hover:underline"
                          >
                            Ver subvenciones →
                          </ResponsiveLink>
                        ) : null}
                      </>
                    )}
                  </div>
                </section>

                {(section.top_contractors.length > 0 || section.top_subsidy_beneficiaries.length > 0) && (
                  <section className="space-y-4 rounded-[2px] border border-border/50 bg-background/40 px-3 py-3">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Principales beneficiarios
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <BeneficiaryList items={section.top_contractors} label="Contratos adjudicados a" />
                      <BeneficiaryList items={section.top_subsidy_beneficiaries} label="Subvenciones concedidas a" />
                    </div>
                  </section>
                )}

                <div className="flex flex-wrap items-baseline gap-4 text-xs text-muted-foreground">
                  <ResponsiveLink
                    href={`/presupuestos/${section.section_code}?year=${year}`}
                    className="underline-offset-2 hover:underline"
                  >
                    Ver sección {section.section_code} en Presupuestos →
                  </ResponsiveLink>
                </div>
              </div>
            </details>
          </li>
        )
      })}
    </ul>
  )
}
