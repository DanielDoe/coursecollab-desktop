import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import { studentBelongsToCourse } from "@/lib/instructor-course-scope"
import { generateAndDispatchForStudent } from "@/lib/midterm-progress-review/dispatch-student-review"
import { runDeliverSavedProgressReviewBatch } from "@/lib/midterm-progress-review/deliver-saved-batch"
import { runMidtermProgressReviewBatch } from "@/lib/midterm-progress-review/run-batch"
import type { ProgressReviewPeriod } from "@/lib/midterm-progress-review/review-period"

function parseStudentIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
}

async function assertStudentsInCourse(courseId: number, studentIds: number[]): Promise<void> {
  for (const studentId of studentIds) {
    if (!(await studentBelongsToCourse(studentId, courseId))) {
      throw new Error(`Student ${studentId} is not enrolled in this course.`)
    }
  }
}

export async function generateProgressReviewDraft(params: {
  instructorId: number
  courseId: number
  studentIds?: number[] | null
  reviewPeriod?: ProgressReviewPeriod | string | null
  asOfDate?: string | null
  onlyMissing?: boolean
}): Promise<{ generated: number; reviewIds: number[]; href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot generate progress reviews for this course.")

  const studentIds = params.studentIds?.length ? params.studentIds : null
  if (studentIds?.length) {
    await assertStudentsInCourse(params.courseId, studentIds)
  }

  const batch = await runMidtermProgressReviewBatch({
    courseId: params.courseId,
    instructorId: params.instructorId,
    studentIds: studentIds ?? undefined,
    reviewPeriod: params.reviewPeriod ?? "midterm",
    asOfDate: params.asOfDate ?? null,
    dryRun: true,
    sendEmail: false,
    createAnnouncement: false,
    createNotification: false,
    onlyMissing: params.onlyMissing === true,
  })

  const reviewIds: number[] = []
  if (studentIds?.length) {
    for (const studentId of studentIds) {
      const rows = (await sql`
        SELECT id FROM student_progress_reviews
        WHERE student_id = ${studentId}
          AND course_id = ${params.courseId}
          AND review_period = ${params.reviewPeriod ?? "midterm"}
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
      `) as { id: number }[]
      if (rows[0]?.id) reviewIds.push(Number(rows[0].id))
    }
  }

  return {
    generated: batch.generated,
    reviewIds,
    href: "/module/progress-reviews",
  }
}

export async function saveProgressReviewForStudents(params: {
  instructorId: number
  courseId: number
  studentIds: number[]
  reviewPeriod?: ProgressReviewPeriod | string | null
  asOfDate?: string | null
}): Promise<{ saved: number; href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot save progress reviews for this course.")

  const studentIds = params.studentIds?.length ? params.studentIds : []
  if (studentIds.length === 0) throw new Error("studentIds is required.")

  await assertStudentsInCourse(params.courseId, studentIds)

  let saved = 0
  for (const studentDbId of studentIds) {
    const res = await generateAndDispatchForStudent({
      studentDbId,
      courseId: params.courseId,
      instructorId: params.instructorId,
      reviewPeriod: params.reviewPeriod ?? "midterm",
      asOfDate: params.asOfDate ?? null,
      dryRun: true,
      sendEmail: false,
      createAnnouncement: false,
      createNotification: false,
    })
    if (!res.error && res.reviewId) saved++
  }

  return { saved, href: "/module/progress-reviews" }
}

export async function editProgressReviewContent(params: {
  instructorId: number
  courseId: number
  reviewId: number
  contentMarkdown: string
}): Promise<{ reviewId: number; href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot edit progress reviews for this course.")

  const reviewId = Number(params.reviewId)
  const contentMarkdown = String(params.contentMarkdown ?? "").trim()
  if (!Number.isFinite(reviewId) || reviewId <= 0) throw new Error("reviewId is required.")
  if (!contentMarkdown) throw new Error("contentMarkdown is required.")

  const updated = (await sql`
    UPDATE student_progress_reviews
    SET content_markdown = ${contentMarkdown},
        updated_at = NOW()
    WHERE id = ${reviewId}
      AND course_id = ${params.courseId}
      AND instructor_id = ${params.instructorId}
    RETURNING id
  `) as { id: number }[]

  if (updated.length === 0) {
    throw new Error("Progress review not found for this course.")
  }

  return { reviewId: updated[0].id, href: "/module/progress-reviews" }
}

export async function publishProgressReviews(params: {
  instructorId: number
  courseId: number
  studentIds?: number[] | null
  reviewPeriod?: ProgressReviewPeriod | string | null
  asOfDate?: string | null
  sendEmail?: boolean
  createAnnouncement?: boolean
  createNotification?: boolean
}): Promise<{ dispatched: number; emailsSent: number; href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot publish progress reviews for this course.")

  const studentIds = params.studentIds?.length ? params.studentIds : undefined
  if (studentIds?.length) {
    await assertStudentsInCourse(params.courseId, studentIds)
  }

  const batch = await runDeliverSavedProgressReviewBatch({
    courseId: params.courseId,
    instructorId: params.instructorId,
    studentIds,
    reviewPeriod: params.reviewPeriod ?? "midterm",
    asOfDate: params.asOfDate ?? null,
    sendEmail: params.sendEmail !== false,
    createAnnouncement: params.createAnnouncement !== false,
    createNotification: params.createNotification !== false,
  })

  return {
    dispatched: batch.dispatched,
    emailsSent: batch.emailsSent,
    href: "/module/progress-reviews",
  }
}

export function parseProgressReviewStudentIds(args: Record<string, unknown>): number[] {
  if (Array.isArray(args.studentIds)) return parseStudentIds(args.studentIds)
  if (Array.isArray(args.student_ids)) return parseStudentIds(args.student_ids)
  const single = Number(args.studentId ?? args.student_id)
  if (Number.isFinite(single) && single > 0) return [single]
  return []
}
