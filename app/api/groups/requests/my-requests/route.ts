import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { resolveGroupProjectCourseScope } from "@/lib/student-course-scope"
import { resolveGroupProjectTermScope } from "@/lib/group-project-term-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const session = searchParams.get("session")

    if (!studentId || !session) {
      return NextResponse.json({ ok: false, error: "Student ID and session are required" }, { status: 400 })
    }

    const sessionVariants = normalizedSectionVariantsForSql(session)

    const scope = await resolveGroupProjectCourseScope(request)
    if (!scope.ok) return scope.response
    const gCourseScope = scope.gCourseScope
    const courseId = scope.courseId
    const gTermScope = await resolveGroupProjectTermScope(request, courseId, session)

    // Get incoming join requests (if student is a group leader)
    const incomingJoinRequests = await sql`
      SELECT 
        gjr.id,
        gjr.status,
        gjr.created_at,
        gjr.group_id,
        g.name as group_name,
        s.id as requester_id,
        s.full_name as requester_name,
        s.student_id as requester_student_id
      FROM group_join_requests gjr
      JOIN groups g ON gjr.group_id = g.id
      JOIN students s ON gjr.requester_student_id = s.id
      WHERE g.created_by = ${Number.parseInt(studentId)}
        AND TRIM(g.session) = ANY(${sessionVariants}::text[])
        AND (${gCourseScope})
        AND (${gTermScope})
        AND gjr.status = 'pending'
      ORDER BY gjr.created_at DESC
    `

    // Get outgoing join requests
    const outgoingJoinRequests = await sql`
      SELECT 
        gjr.id,
        gjr.status,
        gjr.created_at,
        gjr.group_id,
        g.name as group_name,
        s.full_name as leader_name
      FROM group_join_requests gjr
      JOIN groups g ON gjr.group_id = g.id
      JOIN students s ON g.created_by = s.id
      WHERE gjr.requester_student_id = ${Number.parseInt(studentId)}
        AND TRIM(g.session) = ANY(${sessionVariants}::text[])
        AND (${gCourseScope})
        AND (${gTermScope})
        AND gjr.status = 'pending'
      ORDER BY gjr.created_at DESC
    `

    // Get incoming link requests
    const incomingLinkRequests = await sql`
      SELECT 
        slr.id,
        slr.status,
        slr.created_at,
        slr.session,
        s.id as from_student_id,
        s.full_name as from_student_name,
        s.student_id as from_student_student_id
      FROM student_link_requests slr
      JOIN students s ON slr.from_student_id = s.id
      WHERE slr.to_student_id = ${Number.parseInt(studentId)}
        AND TRIM(slr.session) = ANY(${sessionVariants}::text[])
        AND slr.status = 'pending'
      ORDER BY slr.created_at DESC
    `

    // Get outgoing link requests
    const outgoingLinkRequests = await sql`
      SELECT 
        slr.id,
        slr.status,
        slr.created_at,
        slr.session,
        s.id as to_student_id,
        s.full_name as to_student_name,
        s.student_id as to_student_student_id
      FROM student_link_requests slr
      JOIN students s ON slr.to_student_id = s.id
      WHERE slr.from_student_id = ${Number.parseInt(studentId)}
        AND TRIM(slr.session) = ANY(${sessionVariants}::text[])
        AND slr.status = 'pending'
      ORDER BY slr.created_at DESC
    `

    return NextResponse.json({
      ok: true,
      data: {
        incomingJoinRequests,
        outgoingJoinRequests,
        incomingLinkRequests,
        outgoingLinkRequests,
      },
    })
  } catch (error) {
    console.error("[v0] Failed to fetch requests:", error)
    return NextResponse.json({ ok: false, error: "Failed to fetch requests" }, { status: 500 })
  }
}
