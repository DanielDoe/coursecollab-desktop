import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"
import { parseSubmission } from "@/lib/projects/project-grading-config"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    await ensureProjectWorkspaceSchema()
    const studentHeader = request.headers.get("x-student-id")?.trim()
    if (!studentHeader) {
      return NextResponse.json({ assignment: null })
    }
    const bound = await requireBoundStudentCaller(request, studentHeader)
    if (!bound.ok) return bound.response

    const session = request.nextUrl.searchParams.get("session")?.trim() || ""
    const student = await sql`
      SELECT course_id, section FROM students WHERE id = ${bound.studentDbId} LIMIT 1
    `
    if (!student.length) return NextResponse.json({ assignment: null })
    const courseId = Number(student[0].course_id)
    const section = session || String(student[0].section || "")

    const rows = await sql`
      SELECT id, title, description, instructions, status, session, max_points, submission, due_at
      FROM course_project_assignments
      WHERE course_id = ${courseId}
        AND status = 'published'
        AND (session IS NULL OR TRIM(session) = ${section})
      ORDER BY CASE WHEN session IS NULL THEN 1 ELSE 0 END, id DESC
      LIMIT 1
    `
    if (!rows.length) return NextResponse.json({ assignment: null })
    const row = rows[0] as Record<string, unknown>
    const submission = parseSubmission(row.submission)
    if (submission.proposal_mode !== "instructor") {
      return NextResponse.json({ assignment: null, proposalMode: "student" })
    }
    const sections = await sql`
      SELECT section_key, title, instructions, config, sort_order
      FROM project_template_sections
      WHERE assignment_id = ${Number(row.id)}
      ORDER BY sort_order ASC
    `
    return NextResponse.json({
      proposalMode: "instructor",
      assignment: {
        id: Number(row.id),
        title: String(row.title || ""),
        description: row.description ? String(row.description) : null,
        instructions: row.instructions ? String(row.instructions) : null,
        maxPoints: Number(row.max_points) || 0,
        dueAt: row.due_at ? String(row.due_at) : null,
        sectionCount: sections.length,
      },
    })
  } catch (error) {
    console.error("[instructor-setup]", error)
    return NextResponse.json({ error: "Failed to load project setup" }, { status: 500 })
  }
}
