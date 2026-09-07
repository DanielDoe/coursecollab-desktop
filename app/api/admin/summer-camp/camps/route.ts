import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const camps = await sql`
      SELECT c.*,
        (SELECT COUNT(*)::int FROM camp_trainings t WHERE t.camp_id = c.id) AS training_count,
        (SELECT COUNT(DISTINCT e.student_id)::int FROM camp_enrollments e WHERE e.camp_id = c.id) AS enrollment_count
      FROM summer_camps c
      ORDER BY c.start_date DESC NULLS LAST, c.id DESC
    `
    return NextResponse.json({ camps })
  } catch (error) {
    console.error("[admin/summer-camp/camps GET]", error)
    return NextResponse.json({ error: "Failed to load camps" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { slug, title, description, start_date, end_date, status, course_id } = await request.json()
    if (!slug?.trim() || !title?.trim()) {
      return NextResponse.json({ error: "slug and title are required" }, { status: 400 })
    }

    const inserted = await sql`
      INSERT INTO summer_camps (slug, title, description, start_date, end_date, status, course_id)
      VALUES (
        ${String(slug).trim()},
        ${String(title).trim()},
        ${description ?? null},
        ${start_date ?? null},
        ${end_date ?? null},
        ${status ?? "draft"},
        ${course_id ?? null}
      )
      RETURNING *
    `
    return NextResponse.json({ camp: inserted[0] })
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "Camp slug already exists" }, { status: 400 })
    }
    console.error("[admin/summer-camp/camps POST]", error)
    return NextResponse.json({ error: "Failed to create camp" }, { status: 500 })
  }
}
