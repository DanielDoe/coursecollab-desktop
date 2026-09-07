import { NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"

const sql = getSQL()

export const dynamic = "force-dynamic"
export const revalidate = 0

const MAX_REASON_LEN = 1000
const MAX_POINTS = 500

/**
 * PATCH — Update an existing classroom_points row (manual correction).
 * Instructor must be the original awarder. Code-submission rows are not editable here.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { requireClassroomPointsInstructor } = await import("@/lib/classroom-points-request-auth")
    const scope = await requireClassroomPointsInstructor(request)
    if (!scope.ok) return scope.response
    const instructorId = scope.instructorId

    const { id: idParam } = await context.params
    const pointId = parseInt(idParam, 10)
    if (!Number.isFinite(pointId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await request.json()
    const pointsRaw = body.points
    const reasonRaw = body.reason != null ? String(body.reason) : undefined
    const categoryRaw = body.category != null ? String(body.category).trim() : undefined

    const existing = await sql`
      SELECT id, student_id, points, reason, category, status, awarded_by, submission_id
      FROM classroom_points
      WHERE id = ${pointId}
      LIMIT 1
    `
    if (existing.length === 0) {
      return NextResponse.json({ error: "Point entry not found" }, { status: 404 })
    }

    const row = existing[0] as {
      awarded_by: number
      category: string | null
      submission_id: number | null
      status: string | null
    }

    if (Number(row.awarded_by) !== instructorId) {
      return NextResponse.json({ error: "You can only edit awards you created" }, { status: 403 })
    }

    const cat = String(row.category ?? "")
    if (cat === "code_submission" || row.submission_id != null) {
      return NextResponse.json(
        { error: "Code submission points cannot be edited here; use approvals or re-evaluation flows." },
        { status: 400 },
      )
    }

    const st = row.status == null ? "approved" : String(row.status)
    if (st === "pending" || st === "rejected") {
      return NextResponse.json(
        { error: "Approve or reject this entry first, or edit it from the pending list." },
        { status: 400 },
      )
    }

    let nextPoints: number | undefined
    if (pointsRaw !== undefined && pointsRaw !== null && pointsRaw !== "") {
      const n = typeof pointsRaw === "number" ? pointsRaw : parseFloat(String(pointsRaw))
      if (!Number.isFinite(n) || n <= 0 || n > MAX_POINTS) {
        return NextResponse.json(
          { error: `points must be a number between 0 and ${MAX_POINTS}` },
          { status: 400 },
        )
      }
      nextPoints = n
    }

    let nextReason: string | undefined
    if (reasonRaw !== undefined) {
      const trimmed = reasonRaw.trim()
      if (!trimmed) {
        return NextResponse.json({ error: "reason cannot be empty" }, { status: 400 })
      }
      nextReason = trimmed.slice(0, MAX_REASON_LEN)
    }

    const allowedCategories = new Set([
      "presentation",
      "participation",
      "quiz_bonus",
      "extra_credit",
      "other",
    ])
    let nextCategory: string | undefined
    if (categoryRaw) {
      if (!allowedCategories.has(categoryRaw)) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 })
      }
      nextCategory = categoryRaw
    }

    if (nextPoints === undefined && nextReason === undefined && nextCategory === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    await sql`
      UPDATE classroom_points
      SET
        points = COALESCE(${nextPoints === undefined ? null : nextPoints}, points),
        reason = COALESCE(${nextReason === undefined ? null : nextReason}, reason),
        category = COALESCE(${nextCategory === undefined ? null : nextCategory}, category)
      WHERE id = ${pointId}
        AND awarded_by = ${instructorId}
    `

    const updated = await sql`
      SELECT cp.*, i.name AS instructor_name
      FROM classroom_points cp
      JOIN instructors i ON cp.awarded_by = i.id
      WHERE cp.id = ${pointId}
      LIMIT 1
    `

    return NextResponse.json({ success: true, point: updated[0] ?? null })
  } catch (e) {
    console.error("[classroom-points PATCH]", e)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}
