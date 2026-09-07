import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureSummerProgramRole } from "@/lib/require-summer-camper"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { notifyCampEnrollment } from "@/lib/summer-camp-notifications"
import { notifyInstructorsCampEnrollment } from "@/lib/summer-camp/notify-enrollment-email"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const caller = await requireCallerStudentDbId(request)
    if (!caller.ok) return caller.response
    const studentDbId = caller.studentDbId
    const trainingId = Number(body.trainingId)

    if (!Number.isFinite(trainingId)) {
      return NextResponse.json({ error: "trainingId is required" }, { status: 400 })
    }

    await ensureSummerProgramRole(studentDbId, "summer_student")

    const trainingRows = await sql`
      SELECT t.id, t.title, t.camp_id, t.status, c.status AS camp_status
      FROM camp_trainings t
      JOIN summer_camps c ON c.id = t.camp_id
      WHERE t.id = ${trainingId} AND t.status = 'published'
      LIMIT 1
    `
    if (trainingRows.length === 0) {
      return NextResponse.json({ error: "Training not found or not published" }, { status: 404 })
    }

    const training = trainingRows[0] as { id: number; title: string; camp_id: number; camp_status: string }
    if (!["published", "active"].includes(training.camp_status)) {
      return NextResponse.json({ error: "Camp is not open for enrollment" }, { status: 403 })
    }

    const existing = await sql`
      SELECT id, status FROM camp_enrollments
      WHERE student_id = ${studentDbId} AND training_id = ${trainingId}
      LIMIT 1
    `

    if (existing.length > 0) {
      const row = existing[0] as { id: number; status: string }
      if (row.status === "withdrawn") {
        await sql`
          UPDATE camp_enrollments SET status = 'active', enrolled_at = NOW()
          WHERE id = ${row.id}
        `
        await notifyCampEnrollment(studentDbId, training.title)
        await notifyInstructorsCampEnrollment(studentDbId, trainingId, training.title)
      }
      return NextResponse.json({ enrollment: { ...row, status: "active" }, alreadyEnrolled: true })
    }

    const inserted = await sql`
      INSERT INTO camp_enrollments (student_id, training_id, camp_id, status)
      VALUES (${studentDbId}, ${trainingId}, ${training.camp_id}, 'active')
      RETURNING *
    `

    await notifyCampEnrollment(studentDbId, training.title)
    await notifyInstructorsCampEnrollment(studentDbId, trainingId, training.title)

    return NextResponse.json({ enrollment: inserted[0], alreadyEnrolled: false })
  } catch (error) {
    console.error("[summer-camp/enroll]", error)
    return NextResponse.json({ error: "Enrollment failed" }, { status: 500 })
  }
}
