"use server"

import { redirect } from "next/navigation"
import {
  isAdminPasswordConfigured,
  setAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/admin-auth"

interface AuthState {
  error: string | null
}

export async function authenticate(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const password = formData.get("password")?.toString() ?? ""

  if (!isAdminPasswordConfigured()) {
    return { error: "ADMIN_PASSWORD no está configurado en el servidor." }
  }

  if (!verifyAdminPassword(password)) {
    return { error: "Contraseña incorrecta." }
  }

  await setAdminSessionCookie()

  redirect("/admin")
}
