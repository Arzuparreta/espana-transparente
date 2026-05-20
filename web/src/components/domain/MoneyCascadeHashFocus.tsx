"use client"

import { useEffect } from "react"

/**
 * Opens disclosure ancestors and scrolls to #section-* or #program-* anchors
 * on /dinero-publico after client hydration.
 */
export function MoneyCascadeHashFocus() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "")
    if (!hash) return

    const target = document.getElementById(hash)
    if (!target) return

    let node: HTMLElement | null = target
    while (node) {
      if (node instanceof HTMLDetailsElement) {
        node.open = true
      }
      node = node.parentElement
    }

    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start", behavior: "smooth" })
    })
  }, [])

  return null
}
