"use client"

import { useEffect, useRef, useState } from "react"
import { PartyBadge } from "@/components/domain/PartyBadge"

interface PartyMarqueeProps {
  parties: { acronym: string; color: string | null }[]
}

export function PartyMarquee({ parties }: PartyMarqueeProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "100px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div
      ref={wrapperRef}
      className="marquee-mask relative mt-6 overflow-hidden"
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-card via-card/80 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-card via-card/80 to-transparent" />
      <div
        className={`flex w-max animate-marquee items-center gap-3 py-2 ${visible ? "" : "marquee-paused"}`}
      >
        {Array.from({ length: 2 }, (_, i) =>
          parties.map((p) => (
            <PartyBadge
              key={`${p.acronym}-${i}`}
              acronym={p.acronym}
              color={p.color}
              className="px-3 py-1 text-xs"
            />
          ))
        )}
      </div>
    </div>
  )
}
