"use client"

import { useFormState, useFormStatus } from "react-dom"
import { authenticate } from "./actions"

const initialState = { error: null as string | null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-[2px] bg-[#C8FF00] px-4 py-2 font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0B0B0A] transition-colors hover:bg-[#d4ff26] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Verificando..." : "Acceder"}
    </button>
  )
}

export function AdminLoginForm() {
  const [state, formAction] = useFormState(authenticate, initialState)

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card/80 p-6">
        <h1 className="text-xl font-semibold tracking-tight">Panel de administración</h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.10em] text-[#999992]">
          Acceso restringido
        </p>

        <form action={formAction} className="mt-5 space-y-4">
          <div>
            <label htmlFor="password" className="block font-mono text-[10px] uppercase tracking-[0.10em] text-[#999992]">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="mt-1.5 w-full rounded-[2px] border border-[#2A2A27] bg-[#0B0B0A] px-3 py-2 font-mono text-[13px] text-[#EEEDE9] placeholder:text-[#999992]/50 outline-none focus:border-[#C8FF00] transition-colors"
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <p className="font-mono text-[11px] text-red-400">{state.error}</p>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
