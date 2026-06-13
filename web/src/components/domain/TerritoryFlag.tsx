import Image from "next/image"
import { cn } from "@/lib/utils"
import { getTerritoryFlag } from "@/lib/territory-flags"

type TerritoryFlagProps = {
  territoryName: string
  className?: string
  size?: "sm" | "lg"
  priority?: boolean
}

export function TerritoryFlag({
  territoryName,
  className,
  size = "sm",
  priority = false,
}: TerritoryFlagProps) {
  const flag = getTerritoryFlag(territoryName)
  if (!flag) return null

  return (
    <span
      className={cn(
        "inline-flex overflow-hidden rounded-[2px] border border-border bg-muted shadow-sm",
        size === "lg" ? "h-16 w-24 sm:h-20 sm:w-32" : "h-9 w-12",
        className
      )}
    >
      <Image
        src={flag.src}
        alt={flag.alt}
        width={128}
        height={80}
        className="h-full w-full object-cover"
        unoptimized
        priority={priority}
      />
    </span>
  )
}
