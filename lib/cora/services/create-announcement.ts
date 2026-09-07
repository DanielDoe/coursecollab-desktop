/**
 * Shared announcement create — used by POST /api/announcements and Cora tools.
 * Do not duplicate INSERT / notify logic inside Cora.
 */

import { sql } from "@/lib/db"
import { notifyStudentsForAnnouncement } from "@/lib/announcement-notifications"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import {
  isInvalidPersistedAttachmentUrl,
  sanitizeAnnouncementAttachments,
} from "@/lib/announcement-attachments"
import { ensureAnnouncementStudentContentLockedColumn } from "@/lib/ensure-announcement-student-content-locked"
import { ensureAnnouncementAiSummaryColumn } from "@/lib/ensure-announcement-ai-summary"
import { ensureAnnouncementComposerColumns } from "@/lib/ensure-announcement-composer-columns"
import { generateAndSaveAnnouncementAiSummary } from "@/lib/announcement-ai-summary"
import { ANNOUNCEMENT_STUDENT_LOCKED_MESSAGE } from "@/lib/announcement-student-lock"
import { sanitizeStoredContent } from "@/lib/security/sanitize-html"

export type CreateCourseAnnouncementInput = {
  instructorId: number
  courseId: number | null
  title: string
  content: string
  pinned?: boolean
  allowReactions?: boolean
  allowComments?: boolean
  attachments?: unknown
  studentContentLocked?: boolean
  type?: string
  priority?: string
  targetSession?: string
  expiresAt?: string | null
  eventDate?: string | null
  eventTime?: string | null
  eventEnd?: string | null
  eventLocation?: string | null
  /** Default false — AI summary + student notify run after persist. */
  waitForSideEffects?: boolean
}

export type CreateCourseAnnouncementResult = {
  announcement: Record<string, unknown>
  notifiedCount: number
}

function validateAttachments(attachments: unknown): string | null {
  if (!Array.isArray(attachments)) return null
  for (const att of attachments as { url?: string; name?: string }[]) {
    const url = typeof att?.url === "string" ? att.url : ""
    if (isInvalidPersistedAttachmentUrl(url)) {
      const name = typeof att?.name === "string" ? att.name : "Attachment"
      return `"${name}" must be uploaded to the server before publishing.`
    }
  }
  return null
}

export async function createCourseAnnouncement(
  input: CreateCourseAnnouncementInput,
): Promise<CreateCourseAnnouncementResult> {
  await ensureAnnouncementStudentContentLockedColumn()
  await ensureAnnouncementAiSummaryColumn()
  await ensureAnnouncementComposerColumns()

  const title = String(input.title ?? "").trim()
  const content = sanitizeStoredContent(String(input.content ?? "").trim())
  if (!title || !content) {
    throw new Error("Title and content are required.")
  }

  if (input.courseId != null) {
    const allowed = await instructorCanAccessCourse(input.instructorId, input.courseId)
    if (!allowed) {
      throw new Error("Instructor cannot publish announcements for this course.")
    }
  }

  const attachmentError = validateAttachments(input.attachments)
  if (attachmentError) throw new Error(attachmentError)

  const cleanAttachments = sanitizeAnnouncementAttachments(input.attachments ?? [])
  const pinned = input.pinned === true
  const allowReactions = input.allowReactions !== false
  const allowComments = input.allowComments !== false
  const lockedForStudents = input.studentContentLocked === true
  const type = String(input.type ?? "info").trim() || "info"
  const priority = String(input.priority ?? (pinned ? "high" : "medium")).trim() || "medium"
  const targetSession = String(input.targetSession ?? "all").trim() || "all"
  const expiresAt = input.expiresAt?.trim() ? input.expiresAt.trim() : null
  const eventDate = input.eventDate?.trim() ? input.eventDate.trim() : null
  const eventTime = input.eventTime?.trim() ? input.eventTime.trim() : null
  const eventEnd = input.eventEnd?.trim() ? input.eventEnd.trim() : null
  const eventLocation = input.eventLocation?.trim() ? input.eventLocation.trim() : null

  const result = await sql`
    INSERT INTO announcements (
      title, content, author_id, course_id, pinned, allow_reactions, allow_comments,
      attachments, student_content_locked, type, priority, target_session, expires_at,
      event_date, event_time, event_end, event_location
    )
    VALUES (
      ${title},
      ${content},
      ${input.instructorId},
      ${input.courseId},
      ${pinned},
      ${allowReactions},
      ${allowComments},
      ${JSON.stringify(cleanAttachments)},
      ${lockedForStudents},
      ${type},
      ${priority},
      ${targetSession},
      ${expiresAt},
      ${eventDate},
      ${eventTime},
      ${eventEnd},
      ${eventLocation}
    )
    RETURNING *
  `

  const announcement = (result as Record<string, unknown>[])[0]
  if (!announcement) throw new Error("Failed to create announcement.")

  if (input.waitForSideEffects) {
    const notifiedCount = await runAnnouncementCreateSideEffects({
      announcement,
      title,
      content,
      lockedForStudents,
      courseId: input.courseId,
    })
    return { announcement, notifiedCount }
  }

  return { announcement, notifiedCount: 0 }
}

export async function runAnnouncementCreateSideEffects(input: {
  announcement: Record<string, unknown>
  title: string
  content: string
  lockedForStudents: boolean
  courseId: number | null
}): Promise<number> {
  try {
    const aiSummary = await generateAndSaveAnnouncementAiSummary({
      announcementId: Number(input.announcement.id),
      title: input.title,
      content: input.content,
    })
    input.announcement.ai_summary = aiSummary
  } catch (summaryError) {
    console.error("[createCourseAnnouncement] AI summary failed:", summaryError)
  }

  if (input.courseId == null) return 0
  try {
    const targetSessionRaw = String(input.announcement.target_session ?? "").trim()
    const targetSession =
      targetSessionRaw && targetSessionRaw.toLowerCase() !== "all" ? targetSessionRaw : null
    let academicTermId: number | null = null
    if (targetSession && input.courseId != null) {
      const sessRows = (await sql`
        SELECT academic_term_id
        FROM sessions
        WHERE course_id = ${input.courseId}
          AND TRIM(code) = TRIM(${targetSession})
          AND academic_term_id IS NOT NULL
        ORDER BY id DESC
        LIMIT 1
      `) as { academic_term_id: number | null }[]
      academicTermId =
        sessRows[0]?.academic_term_id != null && Number.isFinite(Number(sessRows[0].academic_term_id))
          ? Number(sessRows[0].academic_term_id)
          : null
    }
    return await notifyStudentsForAnnouncement({
      courseId: input.courseId,
      title: input.title,
      content: input.lockedForStudents ? ANNOUNCEMENT_STUDENT_LOCKED_MESSAGE : input.content,
      announcementId: Number(input.announcement.id),
      targetSession,
      academicTermId,
    })
  } catch (notificationError) {
    console.error("[createCourseAnnouncement] notify failed:", notificationError)
    return 0
  }
}
