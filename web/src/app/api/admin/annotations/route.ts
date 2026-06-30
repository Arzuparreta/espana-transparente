import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminRequestAuthorized } from "@/lib/admin-auth"
import { NextResponse } from "next/server"

async function parseBody(request: Request): Promise<{ action?: string; id?: string }> {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    try {
      return await request.json()
    } catch {
      return {}
    }
  }

  const formData = await request.formData()
  return {
    action: formData.get("action")?.toString(),
    id: formData.get("id")?.toString(),
  }
}

export async function POST(request: Request) {
  if (!(await isAdminRequestAuthorized())) {
    return NextResponse.redirect(new URL("/admin", request.url), { status: 303 })
  }

  const { action, id } = await parseBody(request)

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing annotation id" }, { status: 400 })
  }

  const isHidden = action === "hide" ? true : action === "show" ? false : null
  if (isHidden === null) {
    return NextResponse.json({ error: "Action must be 'hide' or 'show'" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("annotations")
    .update({ is_hidden: isHidden })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.redirect(new URL("/admin", request.url))
}
