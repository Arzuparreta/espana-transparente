"use client"

import { ResponsiveLink } from "@/components/navigation/NavigationProgress"

export interface Responsible {
  person_name: string | null
  politician_id: string | null
  ministry: string | null
  government: string | null
  political_party: string | null
}

interface ResponsibleChipProps {
  responsible: Responsible | null
  ministryHref?: string | null
}

export function ResponsibleChip({ responsible, ministryHref }: ResponsibleChipProps) {
  if (!responsible?.person_name) return null

  const name = responsible.person_name

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[11px] leading-none text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-100 dark:ring-emerald-900/60">
      {ministryHref && responsible.ministry ? (
        <ResponsiveLink
          href={ministryHref}
          className="shrink-0 text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
          title={responsible.ministry}
        >
          Responsable:
        </ResponsiveLink>
      ) : (
        <span className="shrink-0 text-emerald-700 dark:text-emerald-300">Responsable:</span>
      )}
      {responsible.politician_id ? (
        <ResponsiveLink
          href={`/diputados/${responsible.politician_id}`}
          className="min-w-0 truncate font-medium underline-offset-2 hover:underline"
        >
          {name}
        </ResponsiveLink>
      ) : (
        <span className="min-w-0 truncate font-medium">{name}</span>
      )}
    </span>
  )
}
