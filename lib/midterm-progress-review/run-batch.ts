import { listCourseStudentIds } from "./gather-student-data"
import { listSavedReviewStudentIds } from "./deliver-saved-batch"
import { generateAndDispatchForStudent } from "./dispatch-student-review"
import type { ProgressReviewPeriod } from "./review-period"
import type { BatchRunResult } from "./types"
const EMAIL_DELAY_MS = 80

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export type RunBatchParams = {
  courseId: number
  instructorId: number
  studentIds?: number[]
  reviewPeriod?: ProgressReviewPeriod | string
  asOfDate?: string | null
  dryRun?: boolean
  sendEmail?: boolean
  createAnnouncement?: boolean
  createNotification?: boolean
  /** When true, skip students who already have a saved review for this period. */
  onlyMissing?: boolean
  sessionScope?: { sessionId?: number | null; academicTermId?: number | null }
  onProgress?: (done: number, total: number, studentId: number) => void
}

export async function listMissingReviewStudentIds(
  courseId: number,
  reviewPeriod?: ProgressReviewPeriod | string,
  asOfDate?: string | null,
  sessionScope?: { sessionId?: number | null; academicTermId?: number | null },
): Promise<number[]> {
  const roster = await listCourseStudentIds(courseId, sessionScope)
  const saved = new Set(
    await listSavedReviewStudentIds(courseId, reviewPeriod ?? "midterm", asOfDate),
  )
  return roster.filter((id) => !saved.has(id))
}

export async function runMidtermProgressReviewBatch(  params: RunBatchParams,
): Promise<BatchRunResult> {
  const result: BatchRunResult = {
    total: 0,
    generated: 0,
    dispatched: 0,
    emailsSent: 0,
    skipped: 0,
    errors: [],
    dryRun: params.dryRun === true,
  }

  let studentIds =
    params.studentIds && params.studentIds.length > 0
      ? params.studentIds
      : await listCourseStudentIds(params.courseId, params.sessionScope)

  if (params.onlyMissing) {
    const missing = await listMissingReviewStudentIds(
      params.courseId,
      params.reviewPeriod,
      params.asOfDate,
      params.sessionScope,
    )
    const missingSet = new Set(missing)
    studentIds =
      params.studentIds && params.studentIds.length > 0
        ? studentIds.filter((id) => missingSet.has(id))
        : missing
  }

  result.total = studentIds.length

  if (studentIds.length === 0) {
    return result
  }

  for (let i = 0; i < studentIds.length; i++) {    const studentId = studentIds[i]
    params.onProgress?.(i + 1, studentIds.length, studentId)

    try {
      const res = await generateAndDispatchForStudent({
        studentDbId: studentId,
        courseId: params.courseId,
        instructorId: params.instructorId,
        reviewPeriod: params.reviewPeriod,
        asOfDate: params.asOfDate,
        dryRun: params.dryRun,
        sendEmail: params.sendEmail !== false,
        createAnnouncement: params.createAnnouncement !== false,
        createNotification: params.createNotification !== false,
      })

      if (res.error) {
        result.skipped++
        result.errors.push({ studentId, error: res.error })
        continue
      }

      result.generated++
      if (res.reviewId) {
        result.dispatched++
      }

      if (!params.dryRun) {
        if (res.emailSent) result.emailsSent++
        if (!res.emailSent && res.emailSkipReason) result.skipped++
        if (params.sendEmail !== false) {
          await sleep(EMAIL_DELAY_MS)
        }
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
