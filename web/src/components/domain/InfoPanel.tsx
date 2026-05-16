import type { ReactNode } from "react"

interface InfoPanelProps {
  title: string
  children: ReactNode
}

export function InfoPanel({ title, children }: InfoPanelProps) {
  return (
    <div className="flex flex-wrap gap-x-2 rounded-md border border-border/40 bg-muted/30 px-4 py-2.5 text-sm leading-6 text-muted-foreground">
      <span className="shrink-0 font-medium text-foreground/60">{title}:</span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}
