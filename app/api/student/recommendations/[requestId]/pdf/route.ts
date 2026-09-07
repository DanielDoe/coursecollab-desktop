import { NextRequest, NextResponse } from "next/server"

/** Regenerate on every request so letterhead, logo, and footer match current instructor settings and assets. */
export const dynamic = "force-dynamic"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { logRecommendationAudit } from "@/lib/recommendation-letters"
import { buildRecommendationLetterPdfBufferFromRow } from "@/lib/recommendation-letter-pdf-serve"
import { studentCanDownloadPdf, normalizeDeliveryMethod } from "@/lib/recommendation-delivery"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const { searchParams } = new URL(request.url)
    const raw = (searchParams.get("studentDatabaseId") ?? searchParams.get("studentId") ?? "").trim()
    const bound = await requireBoundStudentCaller(request, raw || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const rows = sqlRows<Record<string, unknown>>(
      await sql`
      SELECT r.*, i.name AS instructor_name, s.full_name AS student_full_name
      FROM recommendation_requests r
      JOIN instructors i ON i.id = r.instructor_id
      JOIN students s ON s.id = r.student_id
      WHERE r.id = ${requestId} AND r.student_id = ${dbId}
      LIMIT 1
    `,
    )
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const reqRow = rows[0] as {
      status: string
      instructor_id: number
      final_letter_text: string | null
      instructor_locked: boolean
      delivery_method?: string | null
    }

    const st = String(reqRow.status)
    const deliveryMethod = normalizeDeliveryMethod(reqRow.delivery_method)
    if (!studentCanDownloadPdf(deliveryMethod, st)) {
      return NextResponse.json(
        {
          error:
            deliveryMethod === "confidential"
              ? "This is a confidential recommendation — the letter is not available for download."
              : "The letter is not available for download in this delivery mode.",
        },
        { status: 403 },
      )
    }

    const letter = String(reqRow.final_letter_text ?? "").trim()
    if (!letter) {
      return NextResponse.json({ error: "Final letter is not ready" }, { status: 400 })
    }

    const settingsRows = sqlRows(
      await sql`
      SELECT require_final_review
      FROM recommendation_settings WHERE instructor_id = ${Number(reqRow.instructor_id)} LIMIT 1
    `,
    )
    const settings = settingsRows[0] as { require_final_review: boolean } | undefined

    if (settings?.require_final_review && !reqRow.instructor_locked) {
      return NextResponse.json(
        { error: "Your instructor must approve the final letter before download." },
        { status: 403 },
      )
    }

    const buffer = await buildRecommendationLetterPdfBufferFromRow(rows[0], Number(reqRow.instructor_id))

    await logRecommendationAudit({
      requestId,
      actorType: "student",
      actorId: dbId,
      action: "pdf_download_served",
      details: {},
    })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="recommendation-${requestId}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
      },
    })
  } catch (e) {
    console.error("[recommendations pdf]", e)
    return NextResponse.json({ error: "PDF failed" }, { status: 500 })
  }
}
