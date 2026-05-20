"use client"

import { useEffect } from "react"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Admin error:", error)
  }, [error])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-red-400">Error en el panel</h1>
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
        <p className="font-mono text-[13px] leading-relaxed text-red-300/80">
          {error.message || "Error desconocido"}
        </p>
        {error.digest && (
          <code className="mt-2 block font-mono text-[11px] text-[#999992]">
            ref: {error.digest}
          </code>
        )}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-[#2A2A27] bg-[#141412] px-4 py-2 font-mono text-[12px] uppercase tracking-[0.08em] text-[#EEEDE9] transition-colors hover:border-[#C8FF00]"
        >
          Reintentar
        </button>
        <a
          href="/admin"
          className="rounded-xl border border-[#2A2A27] bg-[#141412] px-4 py-2 font-mono text-[12px] uppercase tracking-[0.08em] text-[#999992] transition-colors hover:border-[#C8FF00]"
        >
          Volver al panel
        </a>
      </div>
    </div>
  )
}
