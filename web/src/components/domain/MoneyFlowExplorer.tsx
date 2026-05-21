"use client"

import { ArrowDownUp, Building2, CircleDollarSign, Landmark, Search, Users } from "lucide-react"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { MoneyFlowSection, TopBeneficiary } from "@/lib/data/money-flow"

type FlowFilter = "all" | "contracts" | "subsidies" | "eu" | "no-cross"
type FlowSort = "credit" | "section" | "contracts" | "subsidies"

interface MoneyFlowExplorerProps {
  year: number
  sections: MoneyFlowSection[]
  initialSectionCode?: string | null
  initialProgramCode?: string | null
}

interface StoredState {
  sectionCode?: string
  programCode?: string
  query?: string
  filter?: FlowFilter
  sort?: FlowSort
  scrollY?: number
}

const STORAGE_PREFIX = "espana-transparente.money-flow"

const FILTERS: Array<{ value: FlowFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "contracts", label: "Con contratos" },
  { value: "subsidies", label: "Con subvenciones" },
  { value: "eu", label: "Con fondos UE" },
  { value: "no-cross", label: "Sin cruce" },
]

const SORTS: Array<{ value: FlowSort; label: string }> = [
  { value: "credit", label: "Crédito" },
  { value: "section", label: "Sección" },
  { value: "contracts", label: "Contratos" },
  { value: "subsidies", label: "Subvenciones" },
]

function formatAmount(value: number | null | undefined): string {
  if (value == null || value === 0) return "-"
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M €`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K €`
  return `${Math.round(value)} €`
}

function formatDate(value: string | null): string {
  if (!value) return "-"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function isFlowFilter(value: unknown): value is FlowFilter {
  return FILTERS.some((filter) => filter.value === value)
}

function isFlowSort(value: unknown): value is FlowSort {
  return SORTS.some((sort) => sort.value === value)
}

function storageKey(year: number) {
  return `${STORAGE_PREFIX}.${year}`
}

function readStoredState(year: number): StoredState | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(year))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredState
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

function buildHref(year: number, sectionCode: string, programCode?: string | null) {
  const params = new URLSearchParams({ year: String(year), section: sectionCode })
  if (programCode) params.set("program", programCode)
  return `/dinero-publico?${params.toString()}#${programCode ? `program-${programCode}` : `section-${sectionCode}`}`
}

function getStickyHeaderOffset(): number {
  const header = document.querySelector("body > header")
  if (!header) return 16

  const styles = window.getComputedStyle(header)
  if (styles.position !== "sticky" && styles.position !== "fixed") return 16

  const top = Number.parseFloat(styles.top || "0")
  const rect = header.getBoundingClientRect()
  const visibleAtTop = rect.top <= Math.max(0, top) + 1

  return visibleAtTop ? rect.height + 16 : 16
}

function scrollToElementStart(target: HTMLElement, behavior: ScrollBehavior = "auto") {
  const top = target.getBoundingClientRect().top + window.scrollY - getStickyHeaderOffset()
  window.scrollTo({ top: Math.max(0, top), behavior })
}

function BeneficiaryList({ items, label }: { items: TopBeneficiary[]; label: string }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">
        {label}
      </div>
      <ul className="space-y-1">
        {items.map((b, i) => (
          <li
            key={`${b.name}-${i}`}
            className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border/30 py-1 last:border-0"
          >
            <div className="flex min-w-0 flex-col">
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
              {b.eu_fund_total != null && b.eu_fund_total > 0 ? (
                <span className="text-[10px] font-mono text-muted-foreground/60">
                  +{formatAmount(b.eu_fund_total)} en fondos UE
                </span>
              ) : null}
            </div>
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {formatAmount(b.total_amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Landmark
}) {
  return (
    <div className="min-w-0 rounded-[2px] border border-border/60 bg-background/55 px-3 py-2">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-muted-foreground">
        <Icon className="size-3" aria-hidden />
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-sm tabular-nums">{value}</div>
    </div>
  )
}

function SectionDetail({
  year,
  section,
  activeProgramCode,
  onProgramSelect,
  anchorPrefix = "",
}: {
  year: number
  section: MoneyFlowSection
  activeProgramCode: string | null
  onProgramSelect: (programCode: string) => void
  anchorPrefix?: string
}) {
  const ministryFilter = section.ministry_normalized
    ? encodeURIComponent(section.ministry_normalized)
    : null

  const programs = section.programs
    .slice()
    .sort((a, b) => (b.total_credit_initial ?? 0) - (a.total_credit_initial ?? 0))

  return (
    <article
      id={`${anchorPrefix}section-${section.section_code}`}
      className="min-w-0 rounded-[2px] border border-border bg-card"
    >
      <div className="border-b border-border/60 px-4 py-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="font-mono text-xs text-muted-foreground">Sección {section.section_code}</div>
            <h2 className="mt-1 text-lg font-semibold leading-snug">{section.section_name}</h2>
            <div className="mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">{section.ministry_normalized ?? "Sin ministerio asignado"}</span>
              <span>{section.minister_name ?? "Responsable sin resolver"}</span>
            </div>
          </div>
          <div className="shrink-0 font-mono text-xl font-semibold tabular-nums">
            {formatAmount(section.total_credit_initial)}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Programas" value={section.programs.length.toLocaleString("es-ES")} icon={Landmark} />
          <Metric label="Contratos" value={`${section.contract_count.toLocaleString("es-ES")} · ${formatAmount(section.contract_total)}`} icon={Building2} />
          <Metric label="Subvenciones" value={`${section.subsidy_count.toLocaleString("es-ES")} · ${formatAmount(section.subsidy_total)}`} icon={CircleDollarSign} />
          <Metric
            label="Fondos UE"
            value={
              section.eu_fund_summary
                ? `${section.eu_fund_summary.orgs_with_eu_funds.toLocaleString("es-ES")} org. · ${formatAmount(section.eu_fund_summary.eu_fund_total)}`
                : "-"
            }
            icon={Users}
          />
          <Metric label="Último dato" value={formatDate(section.latest_record_date)} icon={ArrowDownUp} />
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-mono text-[10px] uppercase text-muted-foreground">
              Programas presupuestarios
            </h3>
            <ResponsiveLink
              href={`/presupuestos/${section.section_code}?year=${year}`}
              className="shrink-0 text-xs underline-offset-2 hover:underline"
            >
              Ver sección
            </ResponsiveLink>
          </div>
          <ul className="divide-y divide-border/40 rounded-[2px] border border-border/60">
            {programs.map((p) => {
              const isActive = p.program_code === activeProgramCode
              return (
                <li
                  key={p.program_code}
                  id={`${anchorPrefix}program-${p.program_code}`}
                  className={cn(
                    "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2",
                    isActive ? "bg-muted/50" : null
                  )}
                >
                  <ResponsiveLink
                    href={`/presupuestos/${section.section_code}/${p.program_code}?year=${year}`}
                    onClick={() => onProgramSelect(p.program_code)}
                    className="flex min-w-0 items-baseline gap-3 text-sm underline-offset-2 hover:underline"
                  >
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {p.program_code}
                    </span>
                    <span className="min-w-0 truncate">{p.program_name ?? "-"}</span>
                  </ResponsiveLink>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {formatAmount(p.total_credit_initial)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[2px] border border-border/70 bg-background/60 px-3 py-3">
            <div className="font-mono text-[10px] uppercase text-muted-foreground">
              Contratos asociados
            </div>
            <div className="mt-1 font-mono text-sm tabular-nums">
              {section.contract_count === 0
                ? "Sin datos"
                : `${section.contract_count.toLocaleString("es-ES")} · ${formatAmount(section.contract_total)}`}
            </div>
            {section.contract_count > 0 && ministryFilter ? (
              <ResponsiveLink
                href={`/contratos?ministry=${ministryFilter}`}
                className="mt-1 inline-flex text-xs underline-offset-2 hover:underline"
              >
                Ver contratos
              </ResponsiveLink>
            ) : null}
          </div>

          <div className="rounded-[2px] border border-border/70 bg-background/60 px-3 py-3">
            <div className="font-mono text-[10px] uppercase text-muted-foreground">
              Subvenciones asociadas
            </div>
            <div className="mt-1 font-mono text-sm tabular-nums">
              {section.subsidy_count === 0
                ? "Sin datos"
                : `${section.subsidy_count.toLocaleString("es-ES")} · ${formatAmount(section.subsidy_total)}`}
            </div>
            {section.subsidy_count > 0 && ministryFilter ? (
              <ResponsiveLink
                href={`/subvenciones?ministry=${ministryFilter}`}
                className="mt-1 inline-flex text-xs underline-offset-2 hover:underline"
              >
                Ver subvenciones
              </ResponsiveLink>
            ) : null}
          </div>
        </section>

        {section.eu_fund_summary && section.eu_fund_summary.eu_fund_count > 0 ? (
          <section className="rounded-[2px] border border-border/70 bg-background/60 px-3 py-3">
            <div className="font-mono text-[10px] uppercase text-muted-foreground">
              Fondos UE vinculados a estas organizaciones
            </div>
            <div className="mt-1 font-mono text-sm tabular-nums">
              {section.eu_fund_summary.orgs_with_eu_funds.toLocaleString("es-ES")} organizaciones · {formatAmount(section.eu_fund_summary.eu_fund_total)}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              {section.eu_fund_summary.eu_fund_count.toLocaleString("es-ES")} fondos · Total con cofinanciación: {formatAmount(section.eu_fund_summary.eu_fund_total_with_cofinancing)}
            </p>
            <ResponsiveLink
              href="/fondos-ue"
              className="mt-1 inline-flex text-xs underline-offset-2 hover:underline"
            >
              Ver fondos UE
            </ResponsiveLink>
          </section>
        ) : null}

        {(section.top_contractors.length > 0 || section.top_subsidy_beneficiaries.length > 0) ? (
          <section className="space-y-4 rounded-[2px] border border-border/50 bg-background/40 px-3 py-3">
            <div className="font-mono text-[10px] uppercase text-muted-foreground">
              Principales beneficiarios
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <BeneficiaryList items={section.top_contractors} label="Contratos adjudicados a" />
              <BeneficiaryList items={section.top_subsidy_beneficiaries} label="Subvenciones concedidas a" />
            </div>
          </section>
        ) : null}
      </div>
    </article>
  )
}

export function MoneyFlowExplorer({
  year,
  sections,
  initialSectionCode,
  initialProgramCode,
}: MoneyFlowExplorerProps) {
  const firstSectionCode = sections[0]?.section_code ?? ""
  const [activeSectionCode, setActiveSectionCode] = useState(initialSectionCode ?? firstSectionCode)
  const [activeProgramCode, setActiveProgramCode] = useState(initialProgramCode ?? null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FlowFilter>("all")
  const [sort, setSort] = useState<FlowSort>("credit")
  const restoredRef = useRef(false)

  useEffect(() => {
    const stored = readStoredState(year)
    if (!initialSectionCode && stored?.sectionCode) setActiveSectionCode(stored.sectionCode)
    if (!initialProgramCode && stored?.programCode) setActiveProgramCode(stored.programCode)
    if (stored?.query) setQuery(stored.query)
    if (isFlowFilter(stored?.filter)) setFilter(stored.filter)
    if (isFlowSort(stored?.sort)) setSort(stored.sort)

    requestAnimationFrame(() => {
      const anchorPrefix = window.matchMedia("(min-width: 1024px)").matches ? "" : "mobile-"
      const targetId = initialProgramCode
        ? `${anchorPrefix}program-${initialProgramCode}`
        : initialSectionCode
          ? `${anchorPrefix}section-${initialSectionCode}`
          : null
      const target = targetId ? document.getElementById(targetId) : null
      if (target) {
        scrollToElementStart(target)
      } else if (!initialSectionCode && stored?.scrollY) {
        window.scrollTo({ top: stored.scrollY })
      }
      restoredRef.current = true
    })
  }, [initialProgramCode, initialSectionCode, year])

  const filteredSections = useMemo(() => {
    const normalizedQuery = normalize(query)
    return sections
      .filter((section) => {
        if (filter === "contracts" && section.contract_count === 0) return false
        if (filter === "subsidies" && section.subsidy_count === 0) return false
        if (filter === "eu" && !(section.eu_fund_summary && section.eu_fund_summary.eu_fund_count > 0)) return false
        if (
          filter === "no-cross" &&
          (section.contract_count > 0 ||
            section.subsidy_count > 0 ||
            (section.eu_fund_summary && section.eu_fund_summary.eu_fund_count > 0))
        ) {
          return false
        }
        if (!normalizedQuery) return true
        const haystack = normalize([
          section.section_code,
          section.section_name,
          section.ministry_normalized,
          section.minister_name,
          ...section.programs.flatMap((p) => [p.program_code, p.program_name]),
        ].join(" "))
        return haystack.includes(normalizedQuery)
      })
      .sort((a, b) => {
        if (sort === "section") return a.section_code.localeCompare(b.section_code, "es")
        if (sort === "contracts") return b.contract_total - a.contract_total
        if (sort === "subsidies") return b.subsidy_total - a.subsidy_total
        return b.total_credit_initial - a.total_credit_initial
      })
  }, [filter, query, sections, sort])

  const activeSection =
    sections.find((section) => section.section_code === activeSectionCode) ??
    filteredSections[0] ??
    sections[0]

  useEffect(() => {
    if (
      filteredSections.length > 0 &&
      !filteredSections.some((section) => section.section_code === activeSectionCode)
    ) {
      setActiveSectionCode(filteredSections[0].section_code)
      setActiveProgramCode(null)
    }
  }, [activeSectionCode, filteredSections])

  useEffect(() => {
    if (!activeSection) return
    const href = buildHref(year, activeSection.section_code, activeProgramCode)
    window.history.replaceState(window.history.state, "", href)
  }, [activeProgramCode, activeSection, year])

  useEffect(() => {
    if (!activeSection) return
    const writeState = () => {
      try {
        window.sessionStorage.setItem(
          storageKey(year),
          JSON.stringify({
            sectionCode: activeSection.section_code,
            programCode: activeProgramCode ?? undefined,
            query,
            filter,
            sort,
            scrollY: window.scrollY,
          } satisfies StoredState)
        )
      } catch {
        // Session persistence is an enhancement; blocked storage should not affect browsing.
      }
    }

    writeState()
    window.addEventListener("pagehide", writeState)
    return () => {
      writeState()
      window.removeEventListener("pagehide", writeState)
    }
  }, [activeProgramCode, activeSection, filter, query, sort, year])

  function selectSection(sectionCode: string) {
    setActiveSectionCode(sectionCode)
    setActiveProgramCode(null)
    if (restoredRef.current) {
      requestAnimationFrame(() => {
        const anchorPrefix = window.matchMedia("(min-width: 1024px)").matches ? "" : "mobile-"
        const target = document.getElementById(`${anchorPrefix}section-${sectionCode}`)
        if (target) scrollToElementStart(target, "smooth")
      })
    }
  }

  function selectProgram(programCode: string) {
    setActiveProgramCode(programCode)
  }

  if (!activeSection) return null

  return (
    <section className="space-y-4">
      <div className="rounded-[2px] border border-border bg-card px-3 py-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <label className="relative block min-w-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar sección, ministerio, responsable o programa"
              className="h-10 pl-8"
            />
          </label>
          <div className="flex min-w-0 gap-1 overflow-x-auto pb-1 lg:pb-0">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center rounded-[2px] border px-2.5 text-xs transition-colors",
                  filter === item.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ArrowDownUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as FlowSort)}
              className="h-9 rounded-[2px] border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label="Orden"
            >
              {SORTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2 font-mono text-[11px] text-muted-foreground">
          {filteredSections.length.toLocaleString("es-ES")} de {sections.length.toLocaleString("es-ES")} secciones
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <div className="max-h-none space-y-2 overflow-visible lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto lg:pr-1">
            {filteredSections.length === 0 ? (
              <div className="rounded-[2px] border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                Sin secciones para este filtro.
              </div>
            ) : (
              filteredSections.map((section) => {
                const selected = section.section_code === activeSection.section_code
                return (
                  <Fragment key={section.section_code}>
                    <button
                      type="button"
                      onClick={() => selectSection(section.section_code)}
                      className={cn(
                        "w-full rounded-[2px] border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-foreground/50 bg-card"
                          : "border-border/70 bg-card/55 hover:border-foreground/25"
                      )}
                      aria-current={selected ? "true" : undefined}
                    >
                      <span className="flex min-w-0 items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            {section.section_code}
                          </span>
                          <span className="min-w-0 truncate text-sm font-medium">
                            {section.section_name}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                          {formatAmount(section.total_credit_initial)}
                        </span>
                      </span>
                      <span className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                        <span>{section.programs.length} programas</span>
                        <span>{section.contract_count} contratos</span>
                        <span>{section.subsidy_count} subvenciones</span>
                      </span>
                    </button>
                    {selected ? (
                      <div className="lg:hidden">
                        <SectionDetail
                          year={year}
                          section={activeSection}
                          activeProgramCode={activeProgramCode}
                          onProgramSelect={selectProgram}
                          anchorPrefix="mobile-"
                        />
                      </div>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </div>
        </aside>

        <div className="hidden min-w-0 lg:block">
          <SectionDetail
            year={year}
            section={activeSection}
            activeProgramCode={activeProgramCode}
            onProgramSelect={selectProgram}
          />
        </div>
      </div>
    </section>
  )
}
