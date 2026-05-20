"use client"

import type { ReactNode } from "react"
import { Suspense } from "react"
import { AuthProvider } from "@/lib/auth/AuthContext"
import { AuthModal } from "@/components/auth/AuthModal"
import { InternalHistoryTracker } from "@/components/navigation/InternalHistoryTracker"

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <InternalHistoryTracker />
      </Suspense>
      {children}
      <AuthModal />
    </AuthProvider>
  )
}
