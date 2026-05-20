"use client"

import { PageHeader } from "@/components/domain/PageHeader"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth/AuthContext"

export function ProfileLoginPrompt() {
  const { openModal } = useAuth()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Perfil"
        description="Inicia sesión para crear y editar tu perfil de usuario."
      />
      <div className="rounded border border-border bg-card px-4 py-5 sm:px-6 sm:py-6">
        <Button type="button" onClick={() => openModal("login")}>
          Iniciar sesión
        </Button>
      </div>
    </div>
  )
}
