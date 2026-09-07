import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { generateInstructorLetterSuggestion } from "@/lib/recommendation-letters-ai"
import type { RecommendationPurpose } from "@/lib/recommendation-letters"
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { getRecommendationBrief } from "@/lib/recommendation-brief-store"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response
    const iid = session.instructorId
    const scoped = await resolveOptionalCourseScope(request)
    if (!scoped.ok) return scoped.response
    if (scoped.courseId != null && String(scoped.instructorId ?? "") !== String(iid)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    if (!Number.isFinite(requestId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

    const rows = sqlRows(
      await sql`
      SELECT r.*, s.full_name AS student_name,
        sess.code AS course_code, sess.description AS course_description
      FROM recommendation_requests r
      JOIN students s ON s.id = r.student_id
      JOIN sessions sess ON sess.id = r.course_id
      WHERE r.id = ${requestId} AND r.instructor_id = ${iid}
      LIMIT 1
    `,
    )
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const reqRow = rows[0] as Record<string, unknown>
    const profRows = sqlRows(
      await sql`SELECT * FROM recommendation_profiles WHERE request_id = ${requestId} LIMIT 1`,
    )
    const profile = profRows[0] as Record<string, unknown> | undefined
    if (!profile) {
      return NextResponse.json(
        { error: "No student questionnaire yet — approve the request and wait for the student to submit details, or write the letter yourself." },
        { status: 400 },
      )
    }

    const inst = sqlRows(await sql`SELECT name FROM instructors WHERE id = ${iid} LIMIT 1`)
    const instructorDisplayName = String(inst[0]?.name ?? "Faculty")

    const courseLabel = `${reqRow.course_code ?? ""} ${reqRow.course_description ?? ""}`.trim()
    const bundle = {
      content_mode: profile.content_mode as string | null,
      student_strengths: profile.student_strengths as string | null,
      achievements: profile.achievements as string | null,
      projects: profile.projects as string | null,
      skills: profile.skills as string | null,
      leadership_examples: profile.leadership_examples as string | null,
      goals: profile.goals as string | null,
      tone: profile.tone as string | null,
      special_instructions: profile.special_instructions as string | null,
      letter_for: profile.letter_for as string | null,
      class_experience: profile.class_experience as string | null,
      personal_qualities: profile.personal_qualities as string | null,
    }

    const brief = await getRecommendationBrief(requestId)

    const generated = await generateInstructorLetterSuggestion({
      studentName: String(reqRow.student_name ?? "Student"),
      purpose: String(reqRow.purpose) as RecommendationPurpose,
      courseLabel: courseLabel || "Course",
      instructorDisplayName,
      profile: bundle,
      briefMarkdown: brief?.brief_markdown ?? null,
      recipientName: reqRow.recipient_name ? String(reqRow.recipient_name) : null,
      recipientOrg: reqRow.recipient_organization ? String(reqRow.recipient_organization) : null,
      recipientAddress:
        typeof reqRow.recipient_address === "string" ? reqRow.recipient_address : null,
      letterIsSpecific: Boolean(reqRow.letter_is_specific),
    })

    return NextResponse.json({
      text: generated.text,
      modelUsed: generated.modelUsed,
      usedBrief: Boolean(brief?.brief_markdown?.trim()),
      disclaimer: "AI-assisted draft — requires faculty review",
    })
  } catch (e) {
    console.error("[instructor ai-suggest]", e)
    const msg = e instanceof Error ? e.message : "AI failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
