"use client"

import { useEffect } from "react"

/**
 * Scrolls to and highlights a #person-{id} anchor on /puertas-giratorias
 * after client hydration.
 */
export function RevolvingDoorHashFocus() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "")
    if (!hash.startsWith("person-")) return

    const target = document.getElementById(hash)
    if (!target) return

    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" })
      target.classList.add("rd-highlight")
      target.addEventListener("animationend", () => target.classList.remove("rd-highlight"), { once: true })
    })
  }, [])

  return null
}
