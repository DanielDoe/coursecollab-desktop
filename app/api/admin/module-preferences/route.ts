import { getSQL } from "@/lib/db"
import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"

// 🔹 GET admin preferences
export async function GET(request: Request) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get("adminId")

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID is required" }, { status: 400 })
    }

    const sql = getSQL()

    const preferences = await sql`
      SELECT module_name, is_favorite, display_order, usage_count, last_accessed
      FROM admin_module_preferences
      WHERE admin_id = ${adminId}
      ORDER BY display_order ASC
    `

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error("[v0] Error fetching admin module preferences:", error)
    return NextResponse.json({ error: "Failed to fetch admin module preferences" }, { status: 500 })
  }
}

// 🔹 POST - toggle favorite
export async function POST(request: Request) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { adminId, moduleName, isFavorite } = await request.json()

    if (!adminId || !moduleName) {
      return NextResponse.json({ error: "Admin ID and module name are required" }, { status: 400 })
    }

    const sql = getSQL()

    await sql`
      INSERT INTO admin_module_preferences (admin_id, module_name, is_favorite, last_accessed)
      VALUES (${adminId}, ${moduleName}, ${isFavorite}, NOW())
      ON CONFLICT (admin_id, module_name)
      DO UPDATE SET is_favorite = ${isFavorite}, last_accessed = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error updating admin module preference:", error)
    return NextResponse.json({ error: "Failed to update admin module preference" }, { status: 500 })
  }
}

// 🔹 PUT - update order
export async function PUT(request: Request) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { adminId, preferences } = await request.json()

    if (!adminId || !preferences) {
      return NextResponse.json({ error: "Admin ID and preferences are required" }, { status: 400 })
    }

    const sql = getSQL()

    for (const pref of preferences) {
      await sql`
        INSERT INTO admin_module_preferences (admin_id, module_name, display_order)
        VALUES (${adminId}, ${pref.module_name}, ${pref.display_order})
        ON CONFLICT (admin_id, module_name)
        DO UPDATE SET display_order = ${pref.display_order}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error updating admin module order:", error)
    return NextResponse.json({ error: "Failed to update admin module order" }, { status: 500 })
  }
}
