import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"

export async function POST(request: Request) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { adminId, moduleName } = await request.json()

    if (!adminId || !moduleName) {
      return NextResponse.json({ error: "Admin ID and module name are required" }, { status: 400 })
    }

    // For now, return success - client will use localStorage
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error tracking admin module usage:", error)
    return NextResponse.json({ error: "Failed to track module usage" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { adminId } = await request.json()

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID is required" }, { status: 400 })
    }

    await sql`
      UPDATE admin_module_preferences
      SET last_accessed = NULL
      WHERE admin_id = ${adminId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error clearing admin recently used:", error)
    return NextResponse.json({ error: "Failed to clear admin recently used" }, { status: 500 })
  }
}
