"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface RevealSectionProps {
  children: React.ReactNode
  className?: string
  /** Stagger the entrance by this many ms after it scrolls into view. */
  delayMs?: number
}

// Calm-sectioned scroll reveal: fades + rises 12px when scrolled into view.
// "pre" state = no animation classes, content visible from SSR (fixes blank flash on load).
// Above-fold elements: pre → visible (no visual change, skips the animation).
// Below-fold elements: pre → hidden (instant snap, below viewport so never seen),
//   then hidden → visible on scroll (transition fires here).
// prefers-reduced-motion: stays in "pre" state, content always visible.
export function RevealSection({ children, className, delayMs = 0 }: RevealSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<"pre" | "hidden" | "visible">("pre")

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.92) {
      // Already in or very near viewport — mark visible, skip animation.
      setState("visible")
      return
    }

    // Below fold: hide immediately. No transition fires because "pre" had none.
    setState("hidden")

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (delayMs) {
              window.setTimeout(() => setState("visible"), delayMs)
            } else {
              setState("visible")
            }
            observer.disconnect()
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [delayMs])

  return (
    <div
      ref={ref}
      className={cn(
        "reveal-section",
        state === "hidden" && "translate-y-3 opacity-0 transition-all duration-700 ease-out",
        state === "visible" && "translate-y-0 opacity-100 transition-all duration-700 ease-out",
        className
      )}
    >
      {children}
    </div>
  )
}
