"use client"

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase/client"

export type AuthModalMode = "login" | "signup"

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  modalOpen: boolean
  modalMode: AuthModalMode
  openModal: (mode?: AuthModalMode) => void
  closeModal: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<AuthModalMode>("login")

  useEffect(() => {
    // La sesión se resuelve en el navegador, así que llega siempre después del
    // HTML servido. Como transición queda por debajo de la hidratación en
    // prioridad y no puede colarse en mitad de ella, que es lo que hacía a
    // React descartar el árbol servido y rehacerlo (error recuperable #418).
    supabase.auth.getSession().then(({ data: { session } }) => {
      startTransition(() => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      startTransition(() => {
        setSession(session)
        setUser(session?.user ?? null)
      })
    })

    return () => subscription.unsubscribe()
  }, [])

  const openModal = useCallback((mode: AuthModalMode = "login") => {
    setModalMode(mode)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => setModalOpen(false), [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, session, loading, modalOpen, modalMode, openModal, closeModal, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
