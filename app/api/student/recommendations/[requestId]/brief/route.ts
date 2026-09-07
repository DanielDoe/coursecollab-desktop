import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { logRecommendationAudit } from "@/lib/recommendation-letters"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import {
  generateAndStoreRecommendationBrief,
  getRecommendationBrief,
  upsertRecommendationBriefFields,
} from "@/lib/recommendation-brief-store"
import type { ProfileBundle } from "@/lib/recommendation-letters-ai"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const raw = (
      new URL(request.url).searchParams.get("studentDatabaseId") ??
      new URL(request.url).searchParams.get("studentId") ??
      ""
    ).trim()
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const owns = await sql`SELECT 1 FROM recommendation_requests WHERE id = ${requestId} AND student_id = ${dbId} LIMIT 1`
    if (owns.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const brief = await getRecommendationBrief(requestId)
    return NextResponse.json({ brief, creditFree: true })
  } catch (e) {
    console.error("[recommendations/brief GET]", e)
    return NextResponse.json({ error: "Failed to load brief" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const body = await request.json()
    const raw = String(body.studentDatabaseId ?? body.studentId ?? "").trim()
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const rows = sqlRows<Record<string, unknown>>(
      await sql`
      SELECT r.*, s.full_name AS student_full_name, i.name AS instructor_name,
        sess.code AS course_code, sess.description AS course_description
      FROM recommendation_requests r
      JOIN students s ON s.id = r.student_id
      JOIN instructors i ON i.id = r.instructor_id
      JOIN sessions sess ON sess.id = r.course_id
      WHERE r.id = ${requestId} AND r.student_id = ${dbId}
      LIMIT 1
    `,
    )
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const reqRow = rows[0]

    const st = String(reqRow.status)
    if (["rejected", "withdrawn", "finalized", "downloaded", "delivered"].includes(st)) {
      return NextResponse.json({ error: "Brief cannot be updated in this status." }, { status: 400 })
    }

    const profRows = sqlRows(await sql`SELECT * FROM recommendation_profiles WHERE request_id = ${requestId} LIMIT 1`)
    if (profRows.length === 0) {
      return NextResponse.json({ error: "Complete your questionnaire first." }, { status: 400 })
    }
    const profile = profRows[0] as Record<string, unknown>

    const attachments = sqlRows<{ file_type: string; file_name: string | null }>(
      await sql`
      SELECT file_type, file_name FROM recommendation_attachments WHERE request_id = ${requestId}
    `,
    )

    const fields = {
      opportunityTitle: body.opportunityTitle != null ? String(body.opportunityTitle) : undefined,
      programName: body.programName != null ? String(body.programName) : undefined,
      highlightTopics: body.highlightTopics != null ? String(body.highlightTopics) : undefined,
      relationshipContext: body.relationshipContext != null ? String(body.relationshipContext) : undefined,
    }

    const brief = await generateAndStoreRecommendationBrief({
      requestId,
      studentName: String(reqRow.student_full_name ?? "Student"),
      purpose: String(reqRow.purpose),
      deadline: reqRow.deadline ? String(reqRow.deadline) : null,
      instructorName: String(reqRow.instructor_name ?? "Faculty"),
      courseLabel: `${reqRow.course_code ?? ""} ${reqRow.course_description ?? ""}`.trim(),
      profile: profile as ProfileBundle,
      attachments,
      fields,
    })

    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: "brief_generated",
      details: { ai_model: brief.ai_model },
    })

    return NextResponse.json({ brief, creditFree: true })
  } catch (e) {
    console.error("[recommendations/brief POST]", e)
    return NextResponse.json({ error: "Failed to generate brief" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const body = await request.json()
    const raw = String(body.studentDatabaseId ?? body.studentId ?? "").trim()
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const owns = await sql`SELECT 1 FROM recommendation_requests WHERE id = ${requestId} AND student_id = ${dbId} LIMIT 1`
    if (owns.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const brief = await upsertRecommendationBriefFields(requestId, {
      opportunityTitle: body.opportunityTitle != null ? String(body.opportunityTitle) : undefined,
      programName: body.programName != null ? String(body.programName) : undefined,
      highlightTopics: body.highlightTopics != null ? String(body.highlightTopics) : undefined,
      relationshipContext: body.relationshipContext != null ? String(body.relationshipContext) : undefined,
    })

    return NextResponse.json({ brief })
  } catch (e) {
    console.error("[recommendations/brief PATCH]", e)
    return NextResponse.json({ error: "Failed to save brief fields" }, { status: 500 })
  }
}
