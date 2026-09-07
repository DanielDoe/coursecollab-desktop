import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import { ensureStudentProgressReviewsSchema } from "@/lib/ensure-student-progress-reviews-schema"
import { reapplyProgressReviewGradebook } from "@/lib/midterm-progress-review/adjust-gradebook-for-review"
import type { ProgressReviewSections, StudentProgressData } from "@/lib/midterm-progress-review/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/student/progress-review?studentId=
 * Returns the student's latest progress review for the current course.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const studentIdParam = searchParams.get("studentId")
    if (!studentIdParam) {
      return NextResponse.json({ error: "studentId required" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(req, studentIdParam)
    if (!auth.ok) return auth.response

    const studentDbId = await resolveStudentDatabaseIdFromParam(studentIdParam)
    if (!studentDbId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    await ensureStudentProgressReviewsSchema()

    const rows = sqlRows<Record<string, unknown>>(
      await sql`
      SELECT
        spr.id,
        spr.review_period,
        spr.as_of_date::text AS as_of_date,
        spr.review_sections,
        spr.content_markdown,
        spr.progress_data,
        spr.model_used,
        spr.created_at,
        spr.email_sent_at
      FROM student_progress_reviews spr
      WHERE spr.student_id = ${studentDbId}
      ORDER BY spr.created_at DESC
      LIMIT 1
    `,
    )

    if (rows.length === 0) {
      return NextResponse.json({ success: true, review: null })
    }

    const row = rows[0] as Record<string, unknown>
    const sections = row.review_sections as ProgressReviewSections | null
    const progressData = row.progress_data as StudentProgressData | null

    if (progressData?.gradebook) {
      progressData.gradebook =
        reapplyProgressReviewGradebook({
          gradebook: progressData.gradebook,
          assessments: progressData.assessments ?? [],
          attendance: progressData.attendance,
          classroomPoints: progressData.classroomPoints ?? [],
          practiceHub: progressData.practiceHub,
        }) ?? progressData.gradebook
    }

    return NextResponse.json({
      success: true,
      review: {
        id: Number(row.id),
        reviewPeriod: String(row.review_period ?? "midterm"),
        asOfDate: row.as_of_date != null ? String(row.as_of_date).slice(0, 10) : null,
        sections,
        contentMarkdown: row.content_markdown != null ? String(row.content_markdown) : null,
        progressData,
        modelUsed: row.model_used != null ? String(row.model_used) : null,
        createdAt: row.created_at,
        emailSentAt: row.email_sent_at,
      },
    })
  } catch (e) {
    console.error("[student/progress-review GET]", e)
    return NextResponse.json({ error: "Failed to load progress review" }, { status: 500 })
  }
}
