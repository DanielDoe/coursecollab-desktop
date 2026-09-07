import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"
import { recordSlideView } from "@/lib/lecture-slide-view-scoring"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { slideId?: number; studentId?: string }
    const slideId = Number(body.slideId)
    const studentId = body.studentId?.trim()

    if (!Number.isFinite(slideId) || slideId <= 0) {
      return NextResponse.json({ error: "Valid slideId is required" }, { status: 400 })
    }
    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const slideRow = await sql`
      SELECT ls.id, ls.lecture_id
      FROM lecture_slides ls
      WHERE ls.id = ${slideId}
      LIMIT 1
    `
    if (slideRow.length === 0) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 })
    }

    const lectureId = Number(slideRow[0].lecture_id)
    const allowed = await isLectureAccessibleToStudent(studentId, lectureId)
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const studentRecord = await sql`
      SELECT id FROM students WHERE student_id = ${studentId} LIMIT 1
    `
    if (studentRecord.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const studentDbId = Number(studentRecord[0].id)
    await recordSlideView(slideId, studentDbId)

    try {
      const { syncActivityPointsAfterAction } = await import("@/lib/trade-center-sync")
      const student = await sql`
        SELECT section FROM students WHERE id = ${studentDbId}
      `
      const session = student[0]?.section || "ALL"
      await syncActivityPointsAfterAction(studentDbId, session, "lecture")
    } catch {
      /* non-blocking */
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Lecture Slide View] Error:", error)
    return NextResponse.json({ error: "Failed to record slide view" }, { status: 500 })
  }
}
