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
// prefers-reduced-motion renders the content immediately with no transform.
export function RevealSection({ children, className, delayMs = 0 }: RevealSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (delayMs) {
              window.setTimeout(() => setVisible(true), delayMs)
            } else {
              setVisible(true)
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
        "reveal-section transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:transform-none",
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        className
      )}
    >
      {children}
    </div>
  )
}
