import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { ensureStudentProgressReviewsSchema } from "@/lib/ensure-student-progress-reviews-schema"
import { deliverSavedReviewForStudent } from "./dispatch-student-review"
import type { ProgressReviewPeriod } from "./review-period"
import type { BatchRunResult } from "./types"

const EMAIL_DELAY_MS = 80

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export type DeliverSavedBatchParams = {
  courseId: number
  instructorId: number
  studentIds?: number[]
  reviewPeriod?: ProgressReviewPeriod | string
  asOfDate?: string | null
  sendEmail?: boolean
  createAnnouncement?: boolean
  createNotification?: boolean
  onProgress?: (done: number, total: number, studentId: number) => void
}

export async function listSavedReviewStudentIds(
  courseId: number,
  reviewPeriod: ProgressReviewPeriod | string,
  asOfDate?: string | null,
): Promise<number[]> {
  await ensureStudentProgressReviewsSchema()
  const asOf = asOfDate != null && String(asOfDate).trim() !== "" ? String(asOfDate).slice(0, 10) : null

  const rows = sqlRows<{ student_id: number }>(
    await sql`
      SELECT DISTINCT spr.student_id
      FROM student_progress_reviews spr
      WHERE spr.course_id = ${courseId}
        AND spr.review_period = ${reviewPeriod}
        AND (
          (${asOf}::date IS NULL AND spr.as_of_date IS NULL)
          OR spr.as_of_date = ${asOf}::date
        )
      ORDER BY spr.student_id
    `,
  )
  return rows.map((r) => Number(r.student_id)).filter(Number.isFinite)
}

/** Send email / announcement / notification for reviews already saved (e.g. after dry run). */
export async function runDeliverSavedProgressReviewBatch(
  params: DeliverSavedBatchParams,
): Promise<BatchRunResult> {
  const savedStudentIds = await listSavedReviewStudentIds(
    params.courseId,
    params.reviewPeriod ?? "midterm",
    params.asOfDate,
  )

  const targetIds =
    params.studentIds && params.studentIds.length > 0
      ? params.studentIds.filter((id) => savedStudentIds.includes(id))
      : savedStudentIds

  const result: BatchRunResult = {
    total: targetIds.length,
    generated: 0,
    dispatched: 0,
    emailsSent: 0,
    skipped: 0,
    errors: [],
    dryRun: false,
    deliverSaved: true,
  }

  for (let i = 0; i < targetIds.length; i++) {
    const studentId = targetIds[i]
    params.onProgress?.(i + 1, targetIds.length, studentId)

    try {
      const res = await deliverSavedReviewForStudent({
        studentDbId: studentId,
        courseId: params.courseId,
        instructorId: params.instructorId,
        reviewPeriod: params.reviewPeriod,
        asOfDate: params.asOfDate,
        sendEmail: params.sendEmail !== false,
        createAnnouncement: params.createAnnouncement !== false,
        createNotification: params.createNotification !== false,
      })

      if (res.error) {
        if (res.error === "Already delivered") {
          result.skipped++
        } else if (res.error === "No saved review") {
          result.skipped++
          result.errors.push({ studentId, error: res.error })
        } else {
          result.skipped++
          result.errors.push({ studentId, error: res.error })
        }
        continue
      }

      result.dispatched++
      if (res.emailSent) result.emailsSent++
      if (params.sendEmail !== false) {
        await sleep(EMAIL_DELAY_MS)
      }
    } catch (err) {
      result.errors.push({
        studentId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}
