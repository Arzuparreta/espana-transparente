import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import type { ThreadConfig } from "@/lib/thread-config"

export interface SectionCount {
  count: number | null
  unit?: string
}

interface ThreadCardProps {
  thread: ThreadConfig
  /** Map of section_key → count data from section_index_cache. */
  counts?: Map<string, SectionCount> | null
}

const MAX_COUNT_LINES = 4

/** Formats a number for display in the card counts. */
function fmt(n: number): string {
  return n.toLocaleString("es-ES")
}

/**
 * Picks up to MAX_COUNT_LINES sources that have a countKey with live data,
 * returning { label, formattedCount } tuples for rendering.
 */
function pickCounts(
  thread: ThreadConfig,
  countsMap: Map<string, SectionCount> | null | undefined
): { label: string; value: string }[] {
  if (!countsMap) return []
  const result: { label: string; value: string }[] = []
  for (const source of thread.sources) {
    if (!source.countKey) continue
    const sc = countsMap.get(source.countKey)
    if (!sc || sc.count == null || sc.count === 0) continue
    result.push({ label: source.label, value: fmt(sc.count) })
    if (result.length >= MAX_COUNT_LINES) break
  }
  return result
}

export function ThreadCard({ thread, counts }: ThreadCardProps) {
  const countLines = pickCounts(thread, counts)

  return (
    <div className="relative flex flex-col rounded-[2px] border border-border bg-card p-5 transition-colors hover:border-foreground/30">
      <h2 className="font-display text-2xl font-black uppercase tracking-[-0.02em] sm:text-3xl">
        {thread.label}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{thread.question}</p>

      {countLines.length > 0 ? (
        <ul className="mt-4 space-y-0.5" aria-label={`Cifras destacadas de ${thread.label}`}>
          {countLines.map((line) => (
            <li key={line.label} className="font-mono text-xs text-muted-foreground/80">
              <span className="tabular-nums text-foreground/90">{line.value}</span>{" "}
              {line.label}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-auto pt-3 font-mono text-xs text-muted-foreground/70">
        {thread.sources.length} fuentes →
      </p>
      <ResponsiveLink
        href={thread.href}
        className="absolute inset-0 rounded-[2px]"
        aria-label={`${thread.label}: ${thread.question}`}
      />
    </div>
  )
}
