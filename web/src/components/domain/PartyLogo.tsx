"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const SIZE_PX = { sm: 20, md: 32, lg: 40 } as const

interface PartyLogoProps {
  src?: string | null
  color?: string | null
  acronym: string
  size?: keyof typeof SIZE_PX
  className?: string
}

export function PartyLogo({ src, color, acronym, size = "md", className }: PartyLogoProps) {
  const [failed, setFailed] = useState(false)
  const px = SIZE_PX[size]

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={acronym}
        width={px}
        height={px}
        onError={() => setFailed(true)}
        className={cn("shrink-0 object-contain", className)}
        style={{ width: px, height: px }}
      />
    )
  }

  return (
    <div
      aria-label={acronym}
      className={cn("shrink-0 rounded-full border border-border/40", className)}
      style={{ backgroundColor: color ?? undefined, width: px, height: px }}
    />
  )
}
