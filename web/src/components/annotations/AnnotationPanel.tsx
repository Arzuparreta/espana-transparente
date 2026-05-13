"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

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
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [newBody, setNewBody] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase
      .from("annotations")
      .select("id, body, created_at, user_id")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setAnnotations(data)
      })
  }, [entityType, entityId])

  async function handleSubmit() {
    if (!newBody.trim()) return
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    await supabase.from("annotations").insert({
      entity_type: entityType,
      entity_id: entityId,
      user_id: user.id,
      body: newBody.trim(),
    })
    setNewBody("")
    setLoading(false)
    // Refresh
    const { data } = await supabase
      .from("annotations")
      .select("id, body, created_at, user_id")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
    if (data) setAnnotations(data)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Anotaciones de la comunidad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Añade contexto, enlaces o información relevante sobre esta persona..."
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={3}
          />
          <Button onClick={handleSubmit} disabled={loading || !newBody.trim()} size="sm">
            Publicar anotación
          </Button>
        </div>

        <Separator />

        {annotations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay anotaciones todavía. Sé la primera persona en contribuir.
          </p>
        ) : (
          <div className="space-y-3">
            {annotations.map((a) => (
              <div key={a.id} className="text-sm border-l-2 border-muted pl-3 py-1">
                <p className="text-foreground">{a.body}</p>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
