"use client"

import { useEffect } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { PageHeader } from "@/components/domain/PageHeader"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Algo ha fallado"
        description="No hemos podido cargar esta página. Es probable que sea un problema temporal de la base de datos pública o de una fuente externa."
      />
      <div className="rounded-[2px] border border-border bg-card px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={reset}>Reintentar</Button>
          <ResponsiveLink href="/" className={buttonVariants({ variant: "outline" })}>
            Volver al inicio
          </ResponsiveLink>
          {error.digest ? (
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              ref: {error.digest}
            </code>
          ) : null}
        </div>
      </div>
    </div>
  )
}
