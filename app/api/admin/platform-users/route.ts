import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { normalizePlatformRole } from "@/lib/roles"
import { hashAdminPassword } from "@/lib/admin-password"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    await ensurePortalRbacSchema()

    const body = await request.json()
    const username = String(body.username ?? "").trim()
    const password = String(body.password ?? "").trim()
    const email = body.email ? String(body.email).trim() : null
    const role = normalizePlatformRole(body.primaryRole ?? body.role)

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    const existing = await sql`
      SELECT id FROM admin_users WHERE LOWER(username) = LOWER(${username}) LIMIT 1
    `
    if (existing.length > 0) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 })
    }

    const passwordHash = await hashAdminPassword(password)

    const inserted = await sql`
      INSERT INTO admin_users (username, password_hash, email, role)
      VALUES (${username}, ${passwordHash}, ${email}, ${role})
      RETURNING id, username, email, role
    `

    return NextResponse.json({ user: inserted[0] })
  } catch (error) {
    console.error("[admin/platform-users POST]", error)
    return NextResponse.json({ error: "Failed to create platform user" }, { status: 500 })
  }
}
