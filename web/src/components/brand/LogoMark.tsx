import { cn } from "@/lib/utils"

type LogoMarkProps = {
  className?: string
  variant?: "default" | "accent" | "inverse"
}

export function LogoMark({ className, variant = "default" }: LogoMarkProps) {
  const baseFill = {
    default: "hsl(var(--brand-ink))",
    accent: "hsl(var(--brand-ink))",
    inverse: "hsl(var(--primary-foreground))",
  }[variant]
  const apexFill = variant === "accent" ? "hsl(var(--brand-signal))" : baseFill

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon points="14 22 86 22 80.71 30.82 19.29 30.82" fill={baseFill} />
      <polygon points="21.68 34.79 78.32 34.79 73.03 43.62 26.97 43.62" fill={baseFill} />
      <polygon points="29.35 47.59 70.65 47.59 65.35 56.41 34.65 56.41" fill={baseFill} />
      <polygon points="37.03 60.38 62.97 60.38 57.68 69.21 42.32 69.21" fill={baseFill} />
      <polygon points="44.71 73.18 55.29 73.18 50 82 50 82" fill={apexFill} />
    </svg>
  )
}
