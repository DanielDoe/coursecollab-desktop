import { sql } from "@/lib/db"
import { ensureInstructorNotificationOwnershipColumns } from "@/lib/ensure-instructor-notification-ownership"
import { generateNotificationAiSummary } from "@/lib/notification-ai-summary"
import { sendInstructorPushNotification } from "@/lib/push-notifications"

export type CreateInstructorNotificationParams = {
  type: string
  title: string
  message: string
  link?: string | null
  source_type?: string | null
  source_id?: string | null
  /**
   * Owner of the notification. `instructor_notifications` originally had no owner
   * column, so every instructor read every other instructor's notifications.
   * Supply at least one of these; a notification with neither is not shown in any
   * instructor's feed.
   */
  instructorId?: number | null
  courseId?: number | null
  /** Set when push is sent elsewhere (e.g. direct messages). */
  skipPush?: boolean
}

function toOwnerId(value: number | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Insert instructor notification with generated ai_summary. */
export async function createInstructorNotification(params: CreateInstructorNotificationParams) {
  const aiSummary = await generateNotificationAiSummary({
    title: params.title,
    message: params.message,
    type: params.type,
  })

  await ensureInstructorNotificationOwnershipColumns()

  const instructorId = toOwnerId(params.instructorId)
  const courseId = toOwnerId(params.courseId)

  if (instructorId == null && courseId == null) {
    console.warn(
      `[Notifications] instructor notification "${params.type}" created with no instructorId or courseId; ` +
        "it will not appear in any instructor's feed.",
    )
  }

  const result = (await sql`
    INSERT INTO instructor_notifications (
      type, title, message, link, source_type, source_id, ai_summary,
      instructor_id, course_id, is_read, created_at
    )
    VALUES (
      ${params.type},
      ${params.title},
      ${params.message},
      ${params.link ?? null},
      ${params.source_type ?? null},
      ${params.source_id ?? null},
      ${aiSummary},
      ${instructorId},
      ${courseId},
      false,
      NOW()
    )
    RETURNING *
  `) as Record<string, unknown>[]

  if (!params.skipPush && result[0]) {
    void sendInstructorPushNotification({
      instructorId,
      type: params.type,
      title: params.title,
      body: params.message,
      link: params.link ?? null,
    }).catch((err) => console.warn("[Push] instructor notification failed:", err))
  }

  return result[0]
}
