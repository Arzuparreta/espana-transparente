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
  anchors?: ReactNode
  children?: ReactNode
}

export function ThreadLanding({ thread, sectionIndex, anchors, children }: ThreadLandingProps) {
  const sectionFacts = new Map(
    sectionIndex.map((row) => [
      row.section_key,
      { count: row.record_count, latestDate: row.latest_date },
    ])
  )

  return (
    <div className="ui-page-wide space-y-6">
      <PageHeader
        title={thread.label}
        eyebrow={
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {thread.question}
          </span>
        }
        description={thread.description}
      />

      <RevealSection>
        <nav aria-label="Datos disponibles" className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Datos disponibles
          </p>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))]">
            {thread.sources.map((source) => {
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
                  icon={source.countKey ? sectionIconForKey(source.countKey) : null}
                />
              )
            })}
          </div>
        </nav>
      </RevealSection>

      {anchors ? (
        <RevealSection>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Resumen
          </p>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
            {anchors}
          </div>
        </RevealSection>
      ) : null}

      {children}
    </div>
  )
}

export function ThreadAnchorCard(props: Parameters<typeof AnchorCard>[0]) {
  return <AnchorCard variant="compact" {...props} />
}
