import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { logRecommendationAudit } from "@/lib/recommendation-letters"
import { studentCanMarkDownloaded } from "@/lib/recommendation-request-transitions"

export const dynamic = "force-dynamic"

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

    const rows = sqlRows(
      await sql`
      SELECT id, status, student_id FROM recommendation_requests
      WHERE id = ${requestId} AND student_id = ${dbId} LIMIT 1
    `,
    )
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const st = String((rows[0] as { status: string }).status)
    if (!studentCanMarkDownloaded(st)) {
      return NextResponse.json({ error: "The letter is not approved for download yet." }, { status: 403 })
    }

    const pdfUrl =
      typeof body.pdfUrl === "string" && body.pdfUrl.startsWith("/uploads/")
        ? body.pdfUrl
        : `/uploads/recommendations/${requestId}/letter.pdf`

    await sql`
      UPDATE recommendation_requests SET status = 'downloaded', updated_at = NOW()
      WHERE id = ${requestId}
    `

    await sql`
      INSERT INTO recommendation_files (request_id, pdf_url, finalized_at, downloaded_at)
      VALUES (${requestId}, ${pdfUrl}, NOW(), NOW())
    `

    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: "marked_downloaded",
      details: { pdfUrl },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[recommendations mark-downloaded]", e)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
