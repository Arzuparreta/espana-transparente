"use client"

import type { ReactNode } from "react"
import { AuthProvider } from "@/lib/auth/AuthContext"
import { AuthModal } from "@/components/auth/AuthModal"

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <AuthModal />
    </AuthProvider>
  )
}
