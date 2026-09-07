import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { training_id, instructor_id, role } = await request.json()
    if (!training_id || !instructor_id) {
      return NextResponse.json({ error: "training_id and instructor_id are required" }, { status: 400 })
    }

    const inserted = await sql`
      INSERT INTO camp_training_faculty (training_id, instructor_id, role)
      VALUES (${Number(training_id)}, ${Number(instructor_id)}, ${role ?? "lead"})
      ON CONFLICT (training_id, instructor_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING *
    `
    return NextResponse.json({ assignment: inserted[0] })
  } catch (error) {
    console.error("[admin/summer-camp/trainings/faculty POST]", error)
    return NextResponse.json({ error: "Failed to assign faculty" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const trainingId = Number(request.nextUrl.searchParams.get("training_id"))
    const instructorId = Number(request.nextUrl.searchParams.get("instructor_id"))
    if (!trainingId || !instructorId) {
      return NextResponse.json({ error: "training_id and instructor_id required" }, { status: 400 })
    }

    await sql`
      DELETE FROM camp_training_faculty
      WHERE training_id = ${trainingId} AND instructor_id = ${instructorId}
    `
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[admin/summer-camp/trainings/faculty DELETE]", error)
    return NextResponse.json({ error: "Failed to remove faculty" }, { status: 500 })
  }
}
