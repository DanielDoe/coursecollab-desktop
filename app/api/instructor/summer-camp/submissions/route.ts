import { type NextRequest, NextResponse } from "next/server"
import { sql, asSqlRows } from "@/lib/db"
import { isFacultyAssignedToTraining, requireSummerCampStaff } from "@/lib/summer-camp/permissions"
import { notifyCampSubmissionFeedback } from "@/lib/summer-camp-notifications"
import { publishSubmissionToGallery } from "@/lib/summer-camp/showcase"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const trainingId = Number(request.nextUrl.searchParams.get("trainingId"))
    if (!Number.isFinite(trainingId)) {
      return NextResponse.json({ error: "trainingId required" }, { status: 400 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    const submissions = await sql`
      SELECT s.*, st.full_name AS student_name, st.student_id AS student_code,
        m.title AS module_title, b.content AS block_content
      FROM camp_submissions s
      JOIN students st ON st.id = s.student_id
      JOIN camp_modules m ON m.id = s.module_id
      JOIN camp_module_blocks b ON b.id = s.block_id
      JOIN camp_projects p ON p.id = m.project_id
      WHERE p.training_id = ${trainingId}
      ORDER BY s.submitted_at DESC
    `
    return NextResponse.json({ submissions })
  } catch (error) {
    console.error("[instructor/summer-camp/submissions GET]", error)
    return NextResponse.json({ error: "Failed to load submissions" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const { submission_id, status, grade, feedback } = await request.json()
    if (!submission_id) {
      return NextResponse.json({ error: "submission_id required" }, { status: 400 })
    }

    const subRows = asSqlRows<{
      training_id: number
      student_id: number
      module_id: number
      block_content: { title?: string }
    }>(await sql`
      SELECT s.*, p.training_id, b.content AS block_content
      FROM camp_submissions s
      JOIN camp_modules m ON m.id = s.module_id
      JOIN camp_projects p ON p.id = m.project_id
      JOIN camp_module_blocks b ON b.id = s.block_id
      WHERE s.id = ${Number(submission_id)}
      LIMIT 1
    `)
    if (subRows.length === 0) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }

    const sub = subRows[0]

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, sub.training_id)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    const updated = asSqlRows<Record<string, unknown>>(await sql`
      UPDATE camp_submissions SET
        status = COALESCE(${status ?? null}, status),
        grade = COALESCE(${grade ?? null}, grade),
        feedback = COALESCE(${feedback ?? null}, feedback),
        reviewed_at = NOW(),
        reviewed_by = ${scope.instructorId}
      WHERE id = ${Number(submission_id)}
      RETURNING *
    `)

    const finalStatus = String(status ?? updated[0]?.status ?? "")

    if (feedback || status) {
      const blockTitle = sub.block_content?.title ?? "Checkpoint"
      await notifyCampSubmissionFeedback(
        sub.student_id,
        blockTitle,
        finalStatus,
        sub.module_id,
      )
    }

    if (finalStatus === "approved") {
      await publishSubmissionToGallery(Number(submission_id)).catch((err) => {
        console.error("[summer-camp] gallery publish failed", err)
      })
    }

    return NextResponse.json({ submission: updated[0] ?? null })
  } catch (error) {
    console.error("[instructor/summer-camp/submissions PATCH]", error)
    return NextResponse.json({ error: "Failed to review submission" }, { status: 500 })
  }
}
