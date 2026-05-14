import { cn } from "@/lib/utils"

type LogoMarkProps = {
  className?: string
}

export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="32" cy="21" r="7.5" fill="hsl(var(--brand-reveal))" />
      <path
        d="M32 31v20"
        stroke="hsl(var(--brand-reveal))"
        strokeLinecap="round"
        strokeWidth="8"
      />
    </svg>
  )
}
