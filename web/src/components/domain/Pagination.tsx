import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { cn } from "@/lib/utils"

interface PaginationProps {
  page: number
  totalPages: number
  hrefForPage: (page: number) => string
  className?: string
}

export function Pagination({ page, totalPages, hrefForPage, className }: PaginationProps) {
  if (totalPages <= 1) return null

  const previousPage = Math.max(1, page - 1)
  const nextPage = Math.min(totalPages, page + 1)
  const linkClass =
    "inline-flex min-h-11 items-center rounded-full border border-border/70 px-3 py-2 text-sm font-medium transition-colors"

  return (
    <nav
      aria-label="Paginación"
      className={cn("flex min-w-0 items-center justify-between gap-3 border-t border-border/70 pt-4", className)}
    >
      <ResponsiveLink
        href={hrefForPage(previousPage)}
        aria-disabled={page <= 1}
        className={cn(linkClass, page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted")}
      >
        Anterior
      </ResponsiveLink>
      <span className="shrink-0 text-xs text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <ResponsiveLink
        href={hrefForPage(nextPage)}
        aria-disabled={page >= totalPages}
        className={cn(linkClass, page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-muted")}
      >
        Siguiente
      </ResponsiveLink>
    </nav>
  )
}
