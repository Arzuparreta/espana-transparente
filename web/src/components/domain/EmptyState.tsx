import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn("bg-card/80", className)}>
      <CardContent className="flex min-h-32 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description ? (
          <div className="max-w-xl text-sm leading-6 text-muted-foreground">{description}</div>
        ) : null}
        {action ? <div className="pt-2">{action}</div> : null}
      </CardContent>
    </Card>
  )
}
