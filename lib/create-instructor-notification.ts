import { sql } from "@/lib/db"
import { generateNotificationAiSummary } from "@/lib/notification-ai-summary"
import { sendInstructorPushNotification } from "@/lib/push-notifications"

export type CreateInstructorNotificationParams = {
  type: string
  title: string
  message: string
  link?: string | null
  source_type?: string | null
  source_id?: string | null
  /** Set when push is sent elsewhere (e.g. direct messages). */
  skipPush?: boolean
}

/** Insert instructor notification with generated ai_summary. */
export async function createInstructorNotification(params: CreateInstructorNotificationParams) {
  const aiSummary = await generateNotificationAiSummary({
    title: params.title,
    message: params.message,
    type: params.type,
  })

  const result = await sql`
    INSERT INTO instructor_notifications (
      type, title, message, link, source_type, source_id, ai_summary, is_read, created_at
    )
    VALUES (
      ${params.type},
      ${params.title},
      ${params.message},
      ${params.link ?? null},
      ${params.source_type ?? null},
      ${params.source_id ?? null},
      ${aiSummary},
      false,
      NOW()
    )
    RETURNING *
  `

  if (!params.skipPush && result[0]) {
    void sendInstructorPushNotification({
      type: params.type,
      title: params.title,
      body: params.message,
      link: params.link ?? null,
    }).catch((err) => console.warn("[Push] instructor notification failed:", err))
  }

  return result[0]
}
