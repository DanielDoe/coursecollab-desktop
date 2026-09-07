import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get("adminId")

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID is required" }, { status: 400 })
    }

    const result = await sql`
      SELECT id, username, email
      FROM admin_users
      WHERE id = ${adminId}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      admin: result[0],
    })
  } catch (error) {
    console.error("[v0] Error fetching admin profile:", error)
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { adminId, username, email } = await request.json()

    // Validate input
    if (!adminId || !username) {
      return NextResponse.json({ error: "Admin ID and username are required" }, { status: 400 })
    }

    // Validate username
    if (username.trim().length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 })
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    // Check if username already exists (excluding current admin)
    const existingAdmin = await sql`
      SELECT id FROM admin_users
      WHERE username = ${username.trim()} AND id != ${adminId}
    `

    if (existingAdmin.length > 0) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 })
    }

    const result = await sql`
      UPDATE admin_users
      SET username = ${username.trim()},
          email = ${email?.trim() || null}
      WHERE id = ${adminId}
      RETURNING id, username, email
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      admin: result[0],
    })
  } catch (error) {
    console.error("[v0] Error updating admin profile:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
