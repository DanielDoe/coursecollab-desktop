import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sendEmail } from "@/lib/email/sendEmail"
import { requireInstructorProjectAccess } from "@/lib/project-request-auth"

export const dynamic = "force-dynamic"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const projectId = Number.parseInt((await params).id, 10)
    const access = await requireInstructorProjectAccess(request, projectId)
    if (!access.ok) return access.response

    const projects = await sql`
      SELECT p.title, COALESCE(ps.total_score, ps.instructor_points, 0) AS earned, a.max_points
      FROM projects p
      LEFT JOIN project_scores ps ON ps.project_id = p.id
      LEFT JOIN course_project_assignments a ON a.id = p.assignment_id
      WHERE p.id = ${projectId}
      LIMIT 1
    `
    const project = projects[0] as { title: string; earned: number; max_points: number | null } | undefined
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const members = await sql`
      SELECT s.full_name, s.email
      FROM projects p
      JOIN group_members gm ON gm.group_id = p.group_id
      JOIN students s ON s.id = gm.student_id
      WHERE p.id = ${projectId}
        AND s.email IS NOT NULL
        AND btrim(s.email) <> ''
    `

    const maxPoints = Number(project.max_points) || 20
    const earned = Number(project.earned) || 0
    const percentage = maxPoints > 0 ? ((earned / maxPoints) * 100).toFixed(1) : "0"
    let sent = 0
    for (const member of members) {
      const row = member as { full_name: string; email: string }
      const result = await sendEmail("grades_updated", row.email, {
        name: row.full_name || "Student",
        assessmentTitle: project.title,
        assessmentTypeLabel: "Project",
        score: earned.toFixed(1),
        totalPoints: String(maxPoints),
        percentage,
        reportLink: `${BASE_URL}/student/dashboard-v2/projects`,
      })
      if (result.success) sent += 1
    }

    if (members.length === 0) {
      return NextResponse.json({ error: "No group member has an email on file" }, { status: 400 })
    }
    return NextResponse.json({ sent, total: members.length })
  } catch (error) {
    console.error("[project email-grade]", error)
    return NextResponse.json({ error: "Failed to email the group" }, { status: 500 })
  }
}
