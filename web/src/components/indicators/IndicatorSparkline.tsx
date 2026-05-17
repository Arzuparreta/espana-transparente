import { cn } from "@/lib/utils"

interface IndicatorPoint {
  period: string
  value: number
}

interface IndicatorSparklineProps {
  points: IndicatorPoint[]
  className?: string
}

function buildPath(points: IndicatorPoint[]) {
  if (points.length === 0) return ""

  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = points.length > 1 ? 100 / (points.length - 1) : 100

  return points
    .map((point, index) => {
      const x = index * step
      const y = 34 - ((point.value - min) / range) * 28
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
}

export function IndicatorSparkline({ points, className }: IndicatorSparklineProps) {
  const visiblePoints = points.slice(-36)
  const path = buildPath(visiblePoints)

  if (!path) {
    return <div className={cn("h-10 w-full rounded bg-muted/50", className)} />
  }

  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className={cn("h-10 w-full overflow-visible", className)}
      aria-hidden="true"
    >
      <path d={`${path} L 100 40 L 0 40 Z`} fill="currentColor" opacity="0.08" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
