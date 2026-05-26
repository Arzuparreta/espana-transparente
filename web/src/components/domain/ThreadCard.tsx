import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import type { ThreadConfig } from "@/lib/thread-config"

interface ThreadCardProps {
  thread: ThreadConfig
}

export function ThreadCard({ thread }: ThreadCardProps) {
  return (
    <div className="relative rounded-[2px] border border-border bg-card p-5 transition-colors hover:border-foreground/30">
      <h2 className="font-display text-2xl font-black uppercase tracking-[-0.02em] sm:text-3xl">
        {thread.label}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{thread.question}</p>
      <p className="mt-4 font-mono text-xs text-muted-foreground/70">
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
