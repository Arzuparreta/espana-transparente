import type { AnchorHTMLAttributes, ReactNode } from "react"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { cn } from "@/lib/utils"

export type EntityKind =
  | "politician"
  | "party"
  | "organization"
  | "voting-session"
  | "contract"
  | "grant"
  | "ministry"
  | "initiative"

const HREF_BY_KIND: Record<EntityKind, (id: string | number) => string> = {
  politician: (id) => `/diputados/${id}`,
  party: (id) => `/partidos/${id}`,
  organization: (id) => `/organizaciones/${id}`,
  "voting-session": (id) => `/votaciones/${id}`,
  contract: (id) => `/contratos/${id}`,
  grant: (id) => `/subvenciones/${id}`,
  ministry: (id) => `/ministerios/${id}`,
  initiative: (id) => `/iniciativas/${id}`,
}

type EntityLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "id"> & {
  kind: EntityKind
  id: string | number | null | undefined
  children: ReactNode
  prefetch?: boolean
}

export function EntityLink({ kind, id, children, className, prefetch, ...props }: EntityLinkProps) {
  if (id === null || id === undefined || id === "") {
    return <span className={className}>{children}</span>
  }

  return (
    <ResponsiveLink href={HREF_BY_KIND[kind](id)} prefetch={prefetch} className={cn(className)} {...props}>
      {children}
    </ResponsiveLink>
  )
}
