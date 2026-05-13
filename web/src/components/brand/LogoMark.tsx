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
        d="M14 51V17c0-2.2 1.8-4 4-4h32v38H14Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M45 13C39 24 33 38 22 51"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M24 24 36 33 27 43"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.7"
      />
      <circle cx="24" cy="24" r="4.1" fill="hsl(var(--brand-reveal))" />
      <circle cx="36" cy="33" r="4.1" fill="hsl(var(--brand-reveal))" />
      <circle cx="27" cy="43" r="4.1" fill="hsl(var(--brand-reveal))" />
    </svg>
  )
}
