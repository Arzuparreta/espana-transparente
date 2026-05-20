"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { type AuthModalMode, useAuth } from "@/lib/auth/AuthContext"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function AuthModal() {
  const { modalOpen, modalMode, closeModal, openModal } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [confirmSent, setConfirmSent] = useState(false)

  function reset() {
    setEmail("")
    setPassword("")
    setError("")
    setConfirmSent(false)
    setLoading(false)
  }

  function switchMode(mode: AuthModalMode) {
    reset()
    openModal(mode)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (modalMode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(translateError(error.message))
        setLoading(false)
      } else {
        reset()
        closeModal()
      }
    } else {
      const origin = typeof window !== "undefined" ? window.location.origin : ""
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${origin}/auth/callback` },
      })
      if (error) {
        setError(translateError(error.message))
        setLoading(false)
      } else {
        setConfirmSent(true)
        setLoading(false)
      }
    }
  }

  return (
    <Dialog
      open={modalOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset()
          closeModal()
        }
      }}
    >
      <DialogContent
        className="rounded-[2px] border border-[#2A2A27] bg-[#141412] p-0 shadow-2xl sm:max-w-sm"
        showCloseButton={false}
      >
        <div className="border-b border-[#2A2A27] px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#999992]">
            España Transparente · Comunidad
          </p>
          <h2 className="mt-1 text-[15px] font-semibold text-[#EEEDE9]">
            {modalMode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </h2>
        </div>

        <div className="px-6 py-5">
          {confirmSent ? (
            <div className="space-y-4">
              <p className="text-[13px] text-[#EEEDE9]">
                Revisa tu correo. Te hemos enviado un enlace para confirmar la cuenta.
              </p>
              <p className="text-[12px] text-[#999992]">
                Una vez confirmada, puedes iniciar sesión.
              </p>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-[13px] text-[#C8FF00] hover:text-[#d4ff26] transition-colors"
              >
                Ir a iniciar sesión →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block font-mono text-[10px] uppercase tracking-[0.10em] text-[#999992]">
                  Correo electrónico
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="tu@correo.es"
                  className="rounded-[2px] border-[#2A2A27] bg-[#0B0B0A] text-[#EEEDE9] placeholder:text-[#999992]/50 focus-visible:border-[#C8FF00] focus-visible:ring-[#C8FF00]/20"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-mono text-[10px] uppercase tracking-[0.10em] text-[#999992]">
                  Contraseña
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={modalMode === "login" ? "current-password" : "new-password"}
                  placeholder="mínimo 6 caracteres"
                  className="rounded-[2px] border-[#2A2A27] bg-[#0B0B0A] text-[#EEEDE9] placeholder:text-[#999992]/50 focus-visible:border-[#C8FF00] focus-visible:ring-[#C8FF00]/20"
                />
              </div>

              {error && (
                <p className="text-[12px] text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full rounded-[2px] bg-[#C8FF00] py-2 text-[13px] font-semibold text-[#0B0B0A] transition-colors hover:bg-[#d4ff26] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading
                  ? "..."
                  : modalMode === "login"
                  ? "Entrar"
                  : "Crear cuenta"}
              </button>
            </form>
          )}
        </div>

        <div className="border-t border-[#2A2A27] px-6 py-4">
          {modalMode === "login" ? (
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="text-[12px] text-[#999992] hover:text-[#EEEDE9] transition-colors"
            >
              ¿Sin cuenta? Crear una →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="text-[12px] text-[#999992] hover:text-[#EEEDE9] transition-colors"
            >
              ¿Ya tienes cuenta? Iniciar sesión →
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function translateError(msg: string): string {
  if (msg.includes("Invalid login credentials")) return "Correo o contraseña incorrectos."
  if (msg.includes("Email not confirmed")) return "Confirma tu correo antes de iniciar sesión."
  if (msg.includes("User already registered")) return "Ya existe una cuenta con ese correo."
  if (msg.includes("Password should be")) return "La contraseña debe tener al menos 6 caracteres."
  if (msg.includes("rate limit")) return "Demasiados intentos. Espera un momento."
  return msg
}
