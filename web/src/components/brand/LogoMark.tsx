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
      <path
        d="M16 50V14h32v36H16Z"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path
        d="M27 16c-6 8-8 18-6 30"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <path
        d="M37 16c6 8 8 18 6 30"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <circle cx="32" cy="27.5" r="4.4" fill="hsl(var(--brand-reveal))" />
      <path
        d="M32 35v9"
        stroke="hsl(var(--brand-reveal))"
        strokeLinecap="round"
        strokeWidth="3.4"
      />
    </svg>
  )
}
