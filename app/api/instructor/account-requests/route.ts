import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { accountRequestStoredSectionMatchesSessionSql } from "@/lib/session-code-aliases"
import { ensureAccessGovernanceSchema } from "@/lib/access-governance/schema"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    await ensureAccessGovernanceSchema()
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const platformCourseId = scope.course.id
    const instructorId = scope.instructorId

    const status = request.nextUrl.searchParams.get("status")
    const sectionMatchSql = accountRequestStoredSectionMatchesSessionSql()

    const requests = await sql`
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
        ar.account_type,
        ar.guest_purpose,
        ar.guest_purpose_detail,
        ar.organization,
        ar.school_affiliation,
        ar.university_id,
        ar.course_id,
        ar.session_id,
        ar.camp_id,
        ar.sponsoring_faculty_id,
        ar.invitation_id,
        ar.email_verified_at,
        ar.approval_source,
        ar.metadata,
        sc.title AS camp_name
      FROM account_requests ar
      LEFT JOIN summer_camps sc ON sc.id = ar.camp_id
      WHERE (
        (
          COALESCE(ar.request_kind, 'roster') = 'roster'
          AND EXISTS (
            SELECT 1 FROM sessions sess
            WHERE sess.course_id = ${platformCourseId}
              AND ${sql.unsafe(sectionMatchSql)}
          )
        )
        OR (
          (
            COALESCE(ar.request_kind, 'roster') = 'guest'
            OR LOWER(COALESCE(ar.account_type, '')) = 'career_member'
          )
          AND (
            ar.sponsoring_faculty_id = ${instructorId}
            OR ar.course_id = ${platformCourseId}
            OR EXISTS (
              SELECT 1 FROM access_invitations ai
              WHERE ai.id = ar.invitation_id
                AND ai.created_by = ${instructorId}
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
                  WHERE sc.id = ar.camp_id AND sc.instructor_id = ${instructorId}
                )
                OR EXISTS (
                  SELECT 1
                  FROM camp_training_faculty ctf
                  INNER JOIN camp_trainings ct ON ct.id = ctf.training_id
                  WHERE ct.camp_id = ar.camp_id
                    AND ctf.instructor_id = ${instructorId}
                )
              )
            )
            OR (
              ar.camp_id IS NULL
              AND (
                EXISTS (SELECT 1 FROM summer_camps sc WHERE sc.instructor_id = ${instructorId})
                OR EXISTS (SELECT 1 FROM camp_training_faculty ctf WHERE ctf.instructor_id = ${instructorId})
              )
            )
          )
        )
      )
      AND (${status}::text IS NULL OR ar.status = ${status})
      ORDER BY 
        CASE 
          WHEN ar.status = 'pending' THEN 1
          WHEN ar.status = 'approved' THEN 2
          WHEN ar.status = 'rejected' THEN 3
          ELSE 4
        END,
        ar.created_at DESC
    `

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("[Account Requests] Error:", error)
    return NextResponse.json({ error: "Failed to fetch account requests" }, { status: 500 })
  }
}
