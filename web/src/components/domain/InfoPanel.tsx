import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface InfoPanelProps {
  title: string
  children: ReactNode
}

export function InfoPanel({ title, children }: InfoPanelProps) {
  return (
    <Card className="bg-card/80">
      <CardHeader className="border-b border-border/60">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-4 text-sm leading-6 text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  )
}
