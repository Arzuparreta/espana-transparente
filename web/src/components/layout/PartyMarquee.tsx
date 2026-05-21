import { PartyBadge } from "@/components/domain/PartyBadge"

interface PartyMarqueeProps {
  parties: { acronym: string; color: string | null }[]
}

export function PartyMarquee({ parties }: PartyMarqueeProps) {
  if (parties.length === 0) return null

  return (
    <div className="mt-6">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
        Grupos parlamentarios indexados
      </p>
      <div className="flex flex-wrap gap-2">
        {parties.map((p) => (
          <PartyBadge
            key={p.acronym}
            acronym={p.acronym}
            color={p.color}
            className="px-2.5 py-1 text-xs"
          />
        ))}
      </div>
    </div>
  )
}
