import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest,
  { params }: { params: Promise<{ campId: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { campId } = await params
    const id = Number.parseInt(campId, 10)

    const camp = await sql`SELECT * FROM summer_camps WHERE id = ${id} LIMIT 1`
    if (camp.length === 0) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 })
    }

    const trainings = await sql`
      SELECT t.*,
        (SELECT COUNT(*)::int FROM camp_enrollments e WHERE e.training_id = t.id) AS enrollment_count,
        (SELECT json_agg(json_build_object('id', f.id, 'instructor_id', f.instructor_id, 'role', f.role, 'name', i.name))
         FROM camp_training_faculty f
         JOIN instructors i ON i.id = f.instructor_id
         WHERE f.training_id = t.id) AS faculty
      FROM camp_trainings t
      WHERE t.camp_id = ${id}
      ORDER BY t.sort_order ASC
    `

    return NextResponse.json({ camp: camp[0], trainings })
  } catch (error) {
    console.error("[admin/summer-camp/camps GET]", error)
    return NextResponse.json({ error: "Failed to load camp" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest,
  { params }: { params: Promise<{ campId: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { campId } = await params
    const id = Number.parseInt(campId, 10)
    const body = await request.json()

    const updated = await sql`
      UPDATE summer_camps SET
        title = COALESCE(${body.title ?? null}, title),
        description = COALESCE(${body.description ?? null}, description),
        start_date = COALESCE(${body.start_date ?? null}, start_date),
        end_date = COALESCE(${body.end_date ?? null}, end_date),
        status = COALESCE(${body.status ?? null}, status),
        course_id = COALESCE(${body.course_id ?? null}, course_id),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    if (updated.length === 0) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 })
    }
    return NextResponse.json({ camp: updated[0] })
  } catch (error) {
    console.error("[admin/summer-camp/camps PUT]", error)
    return NextResponse.json({ error: "Failed to update camp" }, { status: 500 })
  }
}
