import { NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { sql } from "@/lib/db"
import { accountRequestStoredSectionMatchesSessionSql } from "@/lib/session-code-aliases"

export const dynamic = "force-dynamic"

/** Pending access request count for faculty mobile badge / toolbar. */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const sectionMatchSql = accountRequestStoredSectionMatchesSessionSql()
    const [row] = (await sql`
      SELECT COUNT(*)::int AS pending
      FROM account_requests ar
      WHERE ar.status = 'pending'
        AND ar.request_kind != 'camp_password_reset'
        AND (
          (
            COALESCE(ar.request_kind, 'roster') = 'roster'
            AND EXISTS (
              SELECT 1 FROM sessions sess
              WHERE sess.course_id = ${scope.course.id}
                AND ${sql.unsafe(sectionMatchSql)}
            )
          )
          OR (
            (
              COALESCE(ar.request_kind, 'roster') = 'guest'
              OR LOWER(COALESCE(ar.account_type, '')) = 'career_member'
            )
            AND (
              ar.sponsoring_faculty_id = ${scope.instructorId}
              OR ar.course_id = ${scope.course.id}
              OR EXISTS (
                SELECT 1 FROM access_invitations ai
                WHERE ai.id = ar.invitation_id
                  AND ai.created_by = ${scope.instructorId}
              )
            )
          )
          OR (
            ar.request_kind IN ('summer_camper', 'summer_student', 'camp_password_reset')
            AND (
              (
                ar.camp_id IS NOT NULL
                AND (
                  EXISTS (
                    SELECT 1 FROM summer_camps sc
                    WHERE sc.id = ar.camp_id AND sc.instructor_id = ${scope.instructorId}
                  )
                  OR EXISTS (
                    SELECT 1
                    FROM camp_training_faculty ctf
                    INNER JOIN camp_trainings ct ON ct.id = ctf.training_id
                    WHERE ct.camp_id = ar.camp_id
                      AND ctf.instructor_id = ${scope.instructorId}
                  )
                )
              )
              OR (
                ar.camp_id IS NULL
                AND (
                  EXISTS (SELECT 1 FROM summer_camps sc WHERE sc.instructor_id = ${scope.instructorId})
                  OR EXISTS (SELECT 1 FROM camp_training_faculty ctf WHERE ctf.instructor_id = ${scope.instructorId})
                )
              )
            )
          )
        )
    `) as { pending: number }[]

    return NextResponse.json({ pending: row?.pending ?? 0 })
  } catch (e) {
    console.error("[instructor/access-requests/summary]", e)
    return NextResponse.json({ pending: 0 }, { status: 500 })
  }
}
