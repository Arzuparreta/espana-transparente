import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { cn } from "@/lib/utils"

interface PaginationProps {
  page: number
  totalPages: number
  hrefForPage: (page: number) => string
  className?: string
  label?: string
}

export function Pagination({ page, totalPages, hrefForPage, className, label = "Paginación" }: PaginationProps) {
  if (totalPages <= 1) return null

  const previousPage = Math.max(1, page - 1)
  const nextPage = Math.min(totalPages, page + 1)
  const linkClass =
    "inline-flex min-h-11 items-center rounded-[2px] border border-border/70 px-3 py-2 text-sm font-medium transition-colors"
  const edgeClass = "hidden sm:inline-flex"

  return (
    <nav
      aria-label={label}
      className={cn("flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4", className)}
    >
      <div className="flex min-w-0 items-center gap-2">
        <ResponsiveLink
          href={hrefForPage(1)}
          aria-disabled={page <= 1}
          className={cn(linkClass, edgeClass, page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted")}
        >
          Primera
        </ResponsiveLink>
        <ResponsiveLink
          href={hrefForPage(previousPage)}
          aria-disabled={page <= 1}
          rel="prev"
          className={cn(linkClass, page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted")}
        >
          Anterior
        </ResponsiveLink>
      </div>
      <span className="shrink-0 rounded-[2px] border border-border/60 bg-card px-3 py-2 text-xs text-muted-foreground">
        Página <span className="font-mono text-foreground">{page}</span> de{" "}
        <span className="font-mono text-foreground">{totalPages}</span>
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <ResponsiveLink
          href={hrefForPage(nextPage)}
          aria-disabled={page >= totalPages}
          rel="next"
          className={cn(linkClass, page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-muted")}
        >
          Siguiente
        </ResponsiveLink>
        <ResponsiveLink
          href={hrefForPage(totalPages)}
          aria-disabled={page >= totalPages}
          className={cn(linkClass, edgeClass, page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-muted")}
        >
          Última
        </ResponsiveLink>
      </div>
    </nav>
  )
}
