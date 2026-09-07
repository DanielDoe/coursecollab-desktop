import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { createNotification } from "@/lib/create-notification"
import { generateAndSaveAnnouncementAiSummary } from "@/lib/announcement-ai-summary"
import { sendEmail } from "@/lib/email/sendEmail"
import { getStudentForEmail } from "@/lib/email/send-notification-email"
import { ensureStudentProgressReviewsSchema } from "@/lib/ensure-student-progress-reviews-schema"
import {
  buildNotificationPreview,
  buildProgressReviewAnnouncementContent,
  buildProgressReviewEmailHtml,
} from "./build-email-html"
import { gatherStudentProgressData } from "./gather-student-data"
import { generateProgressReview, reviewToMarkdown } from "./generate-review"
import { reapplyProgressReviewGradebook } from "./adjust-gradebook-for-review"
import { getReviewPeriodConfig } from "./review-period"
import type {
  DispatchResult,
  GeneratedProgressReview,
  ProgressReviewSections,
  StudentProgressData,
} from "./types"
import type { ProgressReviewPeriod } from "./review-period"

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com").replace(/\/$/, "")

function firstName(full: string): string {
  const s = String(full ?? "").trim()
  if (!s) return "Student"
  return s.split(/\s+/)[0] ?? "Student"
}

export type SaveReviewParams = {
  studentDbId: number
  courseId: number
  instructorId: number
  progressData: StudentProgressData
  review: GeneratedProgressReview
  reviewPeriod: ProgressReviewPeriod
  asOfDate: string | null
}

export async function saveProgressReview(params: SaveReviewParams): Promise<number> {
  await ensureStudentProgressReviewsSchema()
  const markdown = reviewToMarkdown(params.review.sections, params.progressData)

  const existing = sqlRows<{ id: number }>(
    await sql`
      SELECT id FROM student_progress_reviews
      WHERE student_id = ${params.studentDbId}
        AND course_id = ${params.courseId}
        AND review_period = ${params.reviewPeriod}
        AND (
          (${params.asOfDate}::date IS NULL AND as_of_date IS NULL)
          OR as_of_date = ${params.asOfDate}::date
        )
      ORDER BY created_at DESC
      LIMIT 1
    `,
  )

  const progressJson = JSON.stringify(params.progressData)
  const sectionsJson = JSON.stringify(params.review.sections)

  if (existing.length > 0) {
    const reviewId = Number(existing[0].id)
    await sql`
      UPDATE student_progress_reviews
      SET instructor_id = ${params.instructorId},
          progress_data = ${progressJson}::jsonb,
          review_sections = ${sectionsJson}::jsonb,
          content_markdown = ${markdown},
          model_used = ${params.review.modelUsed},
          updated_at = NOW()
      WHERE id = ${reviewId}
    `
    return reviewId
  }

  const rows = sqlRows<{ id: number }>(
    await sql`
    INSERT INTO student_progress_reviews (
      student_id, course_id, instructor_id, review_period, as_of_date,
      progress_data, review_sections, content_markdown, model_used
    ) VALUES (
      ${params.studentDbId},
      ${params.courseId},
      ${params.instructorId},
      ${params.reviewPeriod},
      ${params.asOfDate},
      ${progressJson}::jsonb,
      ${sectionsJson}::jsonb,
      ${markdown},
      ${params.review.modelUsed}
    )
    RETURNING id
  `,
  )
  return Number(rows[0]?.id ?? 0)
}

export type DispatchOptions = {
  studentDbId: number
  courseId: number
  instructorId: number
  reviewId: number
  progressData: StudentProgressData
  review: GeneratedProgressReview
  sendEmail?: boolean
  createAnnouncement?: boolean
  createNotification?: boolean
  dryRun?: boolean
}

export async function dispatchProgressReview(opts: DispatchOptions): Promise<DispatchResult> {
  const result: DispatchResult = {
    studentId: opts.studentDbId,
    reviewId: opts.reviewId,
    emailSent: false,
    notificationCreated: false,
    announcementCreated: false,
  }

  if (opts.dryRun) return result

  await ensureStudentProgressReviewsSchema()

  const fn = firstName(opts.progressData.student.fullName)
  const courseLabel = opts.progressData.courseCode ?? "your course"
  const periodCfg = getReviewPeriodConfig(opts.progressData.reviewPeriod)
  const reviewLink = `${BASE_URL}/student/dashboard-v2/progress-review`
  const title = periodCfg.announcementTitle(courseLabel)
  const emailHtml = buildProgressReviewEmailHtml(opts.review.sections, opts.progressData)
  const announcementContent = buildProgressReviewAnnouncementContent(
    opts.review.sections,
    opts.progressData,
  )
  const notifPreview = buildNotificationPreview(opts.review.sections)

  if (opts.createAnnouncement !== false) {
    try {
      const ann = sqlRows<{ id: number }>(
        await sql`
        INSERT INTO announcements (
          title, content, author_id, course_id, pinned,
          allow_reactions, allow_comments, target_student_id
        ) VALUES (
          ${title},
          ${announcementContent},
          ${opts.instructorId},
          ${opts.courseId},
          true,
          false,
          false,
          ${opts.studentDbId}
        )
        RETURNING id
      `,
      )
      const announcementId = Number(ann[0]?.id ?? 0)
      result.announcementCreated = true
      if (announcementId > 0) {
        try {
          await generateAndSaveAnnouncementAiSummary({
            announcementId,
            title,
            content: announcementContent,
          })
        } catch (summaryErr) {
          console.error("[progress-review] announcement AI summary failed:", summaryErr)
        }
      }
      await sql`
        UPDATE student_progress_reviews
        SET announcement_id = ${announcementId}, updated_at = NOW()
        WHERE id = ${opts.reviewId}
      `
    } catch (err) {
      console.error("[progress-review] announcement failed:", err)
    }
  }

  if (opts.createNotification !== false) {
    const notif = await createNotification({
      studentId: opts.studentDbId,
      type: "exam",
      title,
      message: notifPreview,
      link: reviewLink,
    })
    result.notificationCreated = !!notif
  }

  if (opts.sendEmail !== false) {
    const student = await getStudentForEmail(opts.studentDbId)
    if (!student) {
      result.emailSkipReason = "No valid email on file"
    } else {
      const emailResult = await sendEmail("midterm_progress_review", student.email, {
        studentFirstName: fn,
        subject: periodCfg.emailSubject(courseLabel),
        title: periodCfg.emailTitle,
        bodySectionsHtml: emailHtml,
        linkUrl: reviewLink,
        linkLabel: "View full review in dashboard",
      })
      if (emailResult.success) {
        result.emailSent = true
        await sql`
          UPDATE student_progress_reviews
          SET email_sent_at = NOW(), updated_at = NOW()
          WHERE id = ${opts.reviewId}
        `
      } else {
        result.emailSkipReason = emailResult.error
      }
    }
  }

  return result
}

export type SavedReviewRow = {
  id: number
  emailSentAt: string | null
  announcementId: number | null
  progressData: StudentProgressData
  review: GeneratedProgressReview
}

export async function loadSavedProgressReview(params: {
  studentDbId: number
  courseId: number
  reviewPeriod?: ProgressReviewPeriod | string
  asOfDate?: string | null
}): Promise<SavedReviewRow | null> {
  await ensureStudentProgressReviewsSchema()
  const reviewPeriod = (params.reviewPeriod ?? "midterm") as ProgressReviewPeriod
  const asOf =
    params.asOfDate != null && String(params.asOfDate).trim() !== ""
      ? String(params.asOfDate).slice(0, 10)
      : null

  const rows = sqlRows<Record<string, unknown>>(
    await sql`
      SELECT
        spr.id,
        spr.email_sent_at,
        spr.announcement_id,
        spr.progress_data,
        spr.review_sections,
        spr.model_used
      FROM student_progress_reviews spr
      WHERE spr.student_id = ${params.studentDbId}
        AND spr.course_id = ${params.courseId}
        AND spr.review_period = ${reviewPeriod}
        AND (
          (${asOf}::date IS NULL AND spr.as_of_date IS NULL)
          OR spr.as_of_date = ${asOf}::date
        )
      ORDER BY spr.updated_at DESC, spr.created_at DESC
      LIMIT 1
    `,
  )

  const row = rows[0]
  if (!row) return null

  const progressData = row.progress_data as StudentProgressData
  const sections = row.review_sections as ProgressReviewSections
  if (!progressData?.student || !sections) return null

  if (progressData.gradebook) {
    progressData.gradebook =
      reapplyProgressReviewGradebook({
        gradebook: progressData.gradebook,
        assessments: progressData.assessments ?? [],
        attendance: progressData.attendance,
        classroomPoints: progressData.classroomPoints ?? [],
        practiceHub: progressData.practiceHub,
      }) ?? progressData.gradebook
  }

  return {
    id: Number(row.id),
    emailSentAt: row.email_sent_at != null ? String(row.email_sent_at) : null,
    announcementId: row.announcement_id != null ? Number(row.announcement_id) : null,
    progressData,
    review: {
      sections,
      modelUsed: row.model_used != null ? String(row.model_used) : "saved",
      generatedAt: progressData.gatheredAt ?? new Date().toISOString(),
    },
  }
}

/** Deliver channels for a review already in the database — no AI regenerate. */
export async function deliverSavedReviewForStudent(params: {
  studentDbId: number
  courseId: number
  instructorId: number
  reviewPeriod?: ProgressReviewPeriod | string
  asOfDate?: string | null
  sendEmail?: boolean
  createAnnouncement?: boolean
  createNotification?: boolean
}): Promise<DispatchResult> {
  const saved = await loadSavedProgressReview({
    studentDbId: params.studentDbId,
    courseId: params.courseId,
    reviewPeriod: params.reviewPeriod,
    asOfDate: params.asOfDate,
  })

  if (!saved) {
    return {
      studentId: params.studentDbId,
      reviewId: null,
      emailSent: false,
      notificationCreated: false,
      announcementCreated: false,
      error: "No saved review",
    }
  }

  const wantEmail = params.sendEmail !== false
  const wantAnnouncement = params.createAnnouncement !== false
  const wantNotification = params.createNotification !== false

  const sendEmail = wantEmail && !saved.emailSentAt
  const createAnnouncement = wantAnnouncement && !saved.announcementId
  const createNotification = wantNotification && !saved.emailSentAt

  if (!sendEmail && !createAnnouncement && !createNotification) {
    return {
      studentId: params.studentDbId,
      reviewId: saved.id,
      emailSent: false,
      notificationCreated: false,
      announcementCreated: false,
      error: "Already delivered",
    }
  }

  return dispatchProgressReview({
    studentDbId: params.studentDbId,
    courseId: params.courseId,
    instructorId: params.instructorId,
    reviewId: saved.id,
    progressData: saved.progressData,
    review: saved.review,
    sendEmail,
    createAnnouncement,
    createNotification,
    dryRun: false,
  })
}

export async function generateAndDispatchForStudent(params: {
  studentDbId: number
  courseId: number
  instructorId: number
  reviewPeriod?: ProgressReviewPeriod | string
  asOfDate?: string | null
  sendEmail?: boolean
  createAnnouncement?: boolean
  createNotification?: boolean
  dryRun?: boolean
}): Promise<DispatchResult & { progressData?: StudentProgressData; review?: GeneratedProgressReview }> {
  const progressData = await gatherStudentProgressData(params.studentDbId, params.courseId, {
    reviewPeriod: params.reviewPeriod,
    asOfDate: params.asOfDate,
  })
  if (!progressData) {
    return {
      studentId: params.studentDbId,
      reviewId: null,
      emailSent: false,
      notificationCreated: false,
      announcementCreated: false,
      error: "Student not found",
    }
  }

  const review = await generateProgressReview(progressData)

  const reviewId = await saveProgressReview({
    studentDbId: params.studentDbId,
    courseId: params.courseId,
    instructorId: params.instructorId,
    progressData,
    review,
    reviewPeriod: progressData.reviewPeriod,
    asOfDate: progressData.asOfDate,
  })

  if (params.dryRun) {
    return {
      studentId: params.studentDbId,
      reviewId,
      emailSent: false,
      notificationCreated: false,
      announcementCreated: false,
      progressData,
      review,
    }
  }

  const dispatchResult = await dispatchProgressReview({
    studentDbId: params.studentDbId,
    courseId: params.courseId,
    instructorId: params.instructorId,
    reviewId,
    progressData,
    review,
    sendEmail: params.sendEmail,
    createAnnouncement: params.createAnnouncement,
    createNotification: params.createNotification,
    dryRun: false,
  })

  return { ...dispatchResult, progressData, review }
}
