import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

const ACTIVE_PIPELINE = [
  "approved",
  "info_requested",
  "ai_generated",
  "student_selected",
  "instructor_review_pending",
  "revision_requested",
] as const

/**
 * Recommendation-letter guest applicants with stats for recommendation_requests
 * from students matching applicant email — scoped to instructor + selected course.
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const platformCourseId = scope.course.id
    const instructorId = scope.instructorId
    const pipeStatuses = [...ACTIVE_PIPELINE]

    const rows = await sql`
      SELECT
        ar.id,
        ar.full_name,
        ar.student_id,
        ar.section,
        ar.email,
        ar.status,
        ar.created_at,
        ar.approved_by,
        ar.approved_at,
        ar.rejected_at,
        ar.rejection_reason,
        ar.request_kind,
        ar.guest_purpose,
        ar.guest_purpose_detail,
        ar.organization,
        EXISTS (
          SELECT 1
          FROM students sx
          WHERE TRIM(LOWER(COALESCE(sx.email, ''))) = TRIM(LOWER(COALESCE(ar.email, '')))
          LIMIT 1
        ) AS matching_student_found,
        COALESCE(mi.rec_letter_total, 0)::int AS rec_letter_total,
        COALESCE(mi.rec_letter_completed, 0)::int AS rec_letter_completed,
        COALESCE(mi.rec_pipeline, 0)::int AS rec_pipeline,
        COALESCE(mi.rec_pending_your_review, 0)::int AS rec_pending_your_review,
        COALESCE(mi.rec_awaiting_student, 0)::int AS rec_awaiting_student,
        mi.last_request_submitted_at,
        mi.last_request_updated_at,
        mi.newest_deadline::text AS newest_deadline
      FROM account_requests ar
      LEFT JOIN LATERAL (
        SELECT
          COUNT(rr.id)::int AS rec_letter_total,
          COUNT(rr.id) FILTER (WHERE rr.status IN ('finalized', 'downloaded'))::int AS rec_letter_completed,
          COUNT(rr.id) FILTER (WHERE rr.status = ANY(${pipeStatuses}::text[]))::int AS rec_pipeline,
          COUNT(rr.id) FILTER (WHERE rr.status = 'requested')::int AS rec_pending_your_review,
          COUNT(rr.id) FILTER (
            WHERE rr.status IN ('info_requested', 'revision_requested', 'approved')
          )::int AS rec_awaiting_student,
          MAX(rr.created_at) AS last_request_submitted_at,
          MAX(rr.updated_at) AS last_request_updated_at,
          MAX(rr.deadline) FILTER (WHERE rr.deadline IS NOT NULL) AS newest_deadline
        FROM students st
        INNER JOIN recommendation_requests rr
          ON rr.student_id = st.id AND rr.instructor_id = ${instructorId}
        INNER JOIN sessions sess ON sess.id = rr.course_id AND sess.course_id = ${platformCourseId}
        WHERE TRIM(LOWER(COALESCE(st.email, ''))) = TRIM(LOWER(COALESCE(ar.email, '')))
      ) mi ON TRUE
      WHERE COALESCE(TRIM(LOWER(ar.guest_purpose)), '') = 'recommendation_letter'
        AND (
          COALESCE(TRIM(LOWER(ar.request_kind)), '') = 'guest'
          OR TRIM(UPPER(COALESCE(ar.section, ''))) = 'GUEST'
        )
      ORDER BY
        CASE ar.status
          WHEN 'pending' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'rejected' THEN 3
          ELSE 4
        END,
        ar.created_at DESC
    `

    return NextResponse.json({ requests: rows })
  } catch (e) {
    console.error("[recommendation-guest-account-requests]", e)
    return NextResponse.json({ error: "Failed to load recommendation guest requests" }, { status: 500 })
  }
}
