"use client"

import { useState, useCallback } from "react"
import { Link2, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface CopyLinkButtonProps {
  url: string
  label?: string
  className?: string
}

/**
 * Copies a URL to the clipboard and shows a checkmark for 1.5s.
 * Used on indicator cards and detail pages for shareable deep links.
 */
export function CopyLinkButton({
  url,
  label = "Copiar enlace",
  className,
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        new URL(url, window.location.origin).toString(),
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API may fail in insecure contexts; silently ignore.
    }
  }, [url])

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Enlace copiado" : label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold",
        "text-muted-foreground transition-colors hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
          <span>Copiado</span>
        </>
      ) : (
        <>
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </button>
  )
}
