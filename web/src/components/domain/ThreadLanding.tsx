import { AnchorCard } from "@/components/domain/AnchorCard"
import { PageHeader } from "@/components/domain/PageHeader"
import { SectionIndexCard } from "@/components/domain/SectionIndexCard"
import { RevealSection } from "@/components/layout/RevealSection"
import { sectionIconForKey } from "@/components/brand/SectionIcon"
import type { ReactNode } from "react"
import type { SectionIndexRow } from "@/lib/data"
import type { ThreadConfig } from "@/lib/thread-config"

interface ThreadLandingProps {
  thread: ThreadConfig
  sectionIndex: SectionIndexRow[]
  /** Live-data anchor cards; empty entries are omitted from the grid. */
  anchors?: ReactNode[]
  /** Optional featured module (e.g. an interactive tool) shown after navigation content. */
  feature?: ReactNode
  /** Local navigation between consolidated views inside the thread. */
  navigation?: ReactNode
  children?: ReactNode
}

interface GridClasses {
  gridCols: string
  loneLastCardClass: string
}

/**
 * Grid column classes for a row of `count` cards. A 3-column layout leaves an
 * unbalanced, non-full-width orphan or gap unless count is a multiple of 3,
 * so other counts fall back to 2 columns, with an odd last card spanning
 * both columns to fill the final row.
 */
function anchorGridClass(count: number): GridClasses {
  if (count <= 1) return { gridCols: "", loneLastCardClass: "" }
  if (count === 2) return { gridCols: "sm:grid-cols-2", loneLastCardClass: "" }
  if (count % 3 === 0) return { gridCols: "sm:grid-cols-2 lg:grid-cols-3", loneLastCardClass: "" }
  if (count % 2 === 1) return { gridCols: "sm:grid-cols-2", loneLastCardClass: "sm:[&>*:last-child]:col-span-2" }
  return { gridCols: "sm:grid-cols-2", loneLastCardClass: "" }
}

function sourceGridClass(count: number): GridClasses {
  if (count <= 1) return { gridCols: "", loneLastCardClass: "" }
  if (count === 2) return { gridCols: "md:grid-cols-2", loneLastCardClass: "" }
  if (count % 3 === 0) return { gridCols: "md:grid-cols-2 xl:grid-cols-3", loneLastCardClass: "" }
  if (count % 2 === 1) return { gridCols: "md:grid-cols-2", loneLastCardClass: "md:[&>*:last-child]:col-span-2" }
  return { gridCols: "md:grid-cols-2", loneLastCardClass: "" }
}

export function ThreadLanding({
  thread,
  sectionIndex,
  anchors,
  feature,
  navigation,
  children,
}: ThreadLandingProps) {
  const visibleAnchors = (anchors ?? []).filter(Boolean)
  const hasAnchors = visibleAnchors.length > 0
  const sectionFacts = new Map(
    sectionIndex.map((row) => [
      row.section_key,
      { count: row.record_count, latestDate: row.latest_date },
    ])
  )

  const sourceGroups = Array.from(
    thread.sources.reduce((groups, source) => {
      const key = source.section?.trim() || ""
      const group = groups.get(key)
      if (group) {
        group.push(source)
      } else {
        groups.set(key, [source])
      }
      return groups
    }, new Map<string, typeof thread.sources>())
  )

  return (
    <div className="ui-page-wide space-y-8">
      <PageHeader
        title={thread.label}
        eyebrow={
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {thread.question}
          </span>
        }
        description={thread.description}
      />

      {navigation ? <RevealSection>{navigation}</RevealSection> : null}

      <RevealSection>
        <nav
          aria-label="Datos disponibles"
          className="space-y-3"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Datos disponibles
          </p>
          <div className="space-y-6">
            {sourceGroups.map(([sectionLabel, sources], groupIndex) => {
              const sourceCount = sources.length
              const { gridCols: sourceGridCols, loneLastCardClass } = sourceGridClass(sourceCount)

              return (
                <section
                  key={sectionLabel || "default"}
                  className={groupIndex > 0 ? "space-y-3 border-t border-border/60 pt-6" : "space-y-3"}
                >
                  {sectionLabel ? (
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
                      {sectionLabel}
                    </p>
                  ) : null}
                  <div className={`grid gap-3 ${sourceGridCols} ${loneLastCardClass}`.trim()}>
                    {sources.map((source) => {
                      const facts = source.countKey ? sectionFacts.get(source.countKey) : null
                      return (
                        <SectionIndexCard
                          key={source.href}
                          href={source.href}
                          label={source.label}
                          description={source.description}
                          count={facts?.count ?? null}
                          countUnit={source.countUnit}
                          latestDate={facts?.latestDate ?? null}
                          icon={source.icon ?? (source.countKey ? sectionIconForKey(source.countKey) : null)}
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </nav>
      </RevealSection>

      {hasAnchors ? (
        <RevealSection>
          <section aria-label="En cifras" className="space-y-3 border-t border-border pt-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              En cifras
            </p>
            {(() => {
              const { gridCols, loneLastCardClass } = anchorGridClass(visibleAnchors.length)
              return (
                <div className={`grid gap-3 ${gridCols} ${loneLastCardClass}`.trim()}>
                  {visibleAnchors}
                </div>
              )
            })()}
          </section>
        </RevealSection>
      ) : null}

      {feature ? <RevealSection>{feature}</RevealSection> : null}

      {children}
    </div>
  )
}

export function ThreadAnchorCard(props: Parameters<typeof AnchorCard>[0]) {
  return <AnchorCard variant="compact" {...props} />
}
