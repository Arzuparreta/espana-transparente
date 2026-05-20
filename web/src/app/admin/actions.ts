"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

interface AuthState {
  error: string | null
}

export async function authenticate(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const password = formData.get("password")?.toString() ?? ""
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return { error: "ADMIN_PASSWORD no está configurado en el servidor." }
  }

  if (password !== adminPassword) {
    return { error: "Contraseña incorrecta." }
  }

  const cookieStore = await cookies()
  cookieStore.set("admin_token", adminPassword, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 30 * 24 * 60 * 60,
  })

  redirect("/admin")
}
