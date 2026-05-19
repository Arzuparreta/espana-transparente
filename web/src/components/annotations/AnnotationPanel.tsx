"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth/AuthContext"

interface Annotation {
  id: string
  body: string
  created_at: string
  user_id: string
}

interface AnnotationPanelProps {
  entityType: string
  entityId: string
}

export function AnnotationPanel({ entityType, entityId }: AnnotationPanelProps) {
  const { user, openModal } = useAuth()
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [newBody, setNewBody] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchAnnotations = useCallback(async () => {
    const { data } = await supabase
      .from("annotations")
      .select("id, body, created_at, user_id")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
    if (data) setAnnotations(data)
  }, [entityType, entityId])

  useEffect(() => {
    fetchAnnotations()
  }, [fetchAnnotations])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newBody.trim() || !user) return
    setLoading(true)
    setError("")

    const { error: insertError } = await supabase.from("annotations").insert({
      entity_type: entityType,
      entity_id: entityId,
      user_id: user.id,
      body: newBody.trim(),
    })

    if (insertError) {
      setError("No se pudo publicar la anotación. Inténtalo de nuevo.")
    } else {
      setNewBody("")
      textareaRef.current?.focus()
      await fetchAnnotations()
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    await supabase.from("annotations").delete().eq("id", id)
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="border border-[#2A2A27] rounded-[2px] bg-[#141412]">
        <div className="border-b border-[#2A2A27] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#999992]">
            Anotación
          </p>
        </div>
        <div className="p-4">
          {user ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                ref={textareaRef}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={3}
                placeholder="Añade contexto, fuentes o información relevante..."
                className="w-full resize-none rounded-[2px] border border-[#2A2A27] bg-[#0B0B0A] px-3 py-2 text-[13px] text-[#EEEDE9] placeholder:text-[#999992]/50 outline-none focus:border-[#C8FF00] focus:ring-1 focus:ring-[#C8FF00]/20 transition-colors"
              />
              {error && (
                <p className="text-[12px] text-red-400">{error}</p>
              )}
              <div className="flex items-center justify-between min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#999992]">
                  {user.email}
                </span>
                <button
                  type="submit"
                  disabled={loading || !newBody.trim()}
                  className="rounded-[2px] bg-[#C8FF00] px-4 py-1.5 text-[12px] font-semibold text-[#0B0B0A] transition-colors hover:bg-[#d4ff26] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Publicando..." : "Publicar"}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-[13px] text-[#999992]">
                Identifícate para añadir una anotación.
              </p>
              <button
                type="button"
                onClick={() => openModal("login")}
                className="shrink-0 rounded-[2px] border border-[#2A2A27] px-3 py-1.5 text-[12px] font-semibold text-[#C8FF00] transition-colors hover:border-[#C8FF00]"
              >
                Iniciar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      {annotations.length === 0 ? (
        <p className="py-6 text-center font-mono text-[11px] uppercase tracking-[0.10em] text-[#999992]">
          Sin anotaciones. Sé el primero en contribuir.
        </p>
      ) : (
        <div className="space-y-px">
          {annotations.map((a) => (
            <div
              key={a.id}
              className="group border-l-2 border-[#2A2A27] bg-[#141412] px-4 py-3 hover:border-[#C8FF00]/40 transition-colors"
            >
              <p className="text-[13px] leading-relaxed text-[#EEEDE9]">{a.body}</p>
              <div className="mt-1.5 flex items-center justify-between min-w-0">
                <span className="font-mono text-[10px] text-[#999992]">
                  {new Date(a.created_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                {user?.id === a.user_id && (
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    className="hidden group-hover:inline text-[10px] font-mono uppercase tracking-[0.08em] text-[#999992] hover:text-red-400 transition-colors"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
