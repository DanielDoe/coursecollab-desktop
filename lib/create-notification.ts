import { sql } from "@/lib/db"
import { generateNotificationAiSummary } from "@/lib/notification-ai-summary"
import { sendStudentPushNotification, sendStudentPushToMany } from "@/lib/push-notifications"

export interface CreateNotificationParams {
  studentId: string | number // Can be student_id (string) or internal id (number)
  type:
    | "quiz"
    | "practice"
    | "ai_tutor"
    | "codebench"
    | "deadline"
    | "group"
    | "project"
    | "homework"
    | "exam"
    | "lecture"
    | "forum"
    | "donation"
    | "code_submission"
    | "classroom_points"
    | "membership"
    | "announcement"
    | "grade"
    | "issue"
    | "progress_review"
    | "office_hours"
    | "calendar"
    | "recommendation_letter_ready"
    | "recommendation_revision"
    | "recommendation_instructor_update"
    | "upgrade_reminder"
    | (string & {})
  title: string
  message: string
  link?: string
  /** Set when push is sent elsewhere (e.g. direct messages). */
  skipPush?: boolean
}

/**
 * Creates a notification for a student
 * Automatically handles converting student_id string to internal database ID
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    let internalStudentId: number

    // If studentId is a string (like "1234"), look up the internal ID
    if (typeof params.studentId === "string") {
      const studentResult = await sql`
        SELECT id FROM students WHERE student_id = ${params.studentId}
      `

      if (studentResult.length === 0) {
        console.error("[v0] Student not found:", params.studentId)
        return null
      }
      internalStudentId = studentResult[0].id
    } else {
      internalStudentId = params.studentId
    }

    const aiSummary = await generateNotificationAiSummary({
      title: params.title,
      message: params.message,
      type: params.type,
    })

    const result = await sql`
      INSERT INTO notifications (student_id, type, title, message, link, ai_summary, is_read, created_at)
      VALUES (
        ${internalStudentId}, 
        ${params.type}, 
        ${params.title}, 
        ${params.message}, 
        ${params.link || null},
        ${aiSummary},
        FALSE,
        CURRENT_TIMESTAMP
      )
      RETURNING id, created_at
    `

    if (!params.skipPush && result[0]) {
      void sendStudentPushNotification({
        studentInternalId: internalStudentId,
        type: params.type,
        title: params.title,
        body: params.message,
        link: params.link ?? null,
      }).catch((err) => console.warn("[Push] student notification failed:", err))
    }

    void (async () => {
      const { deliverInterventionViaNotification } = await import("@/lib/institutions/interventions")
      await deliverInterventionViaNotification({
        studentId: internalStudentId,
        notificationType: params.type,
        title: params.title,
      })
    })()

    return result[0]
  } catch (error) {
    console.error("[v0] Failed to create notification:", error)
    return null
  }
}

/**
 * Send email notifications for new assessments (alongside in-app notifications)
 * Only sends to students with valid email on file
 */
export async function sendNewAssessmentEmailsIfConfigured(
  studentIds: (string | number)[],
  assessmentType: "quiz" | "homework" | "mid-semester" | "final" | "code submission",
  title: string,
  dueDate: string | null = null
) {
  try {
    const { sendNewAssessmentEmails } = await import("@/lib/email/send-assessment-emails")
    const ids = studentIds.map((id) => (typeof id === "string" ? parseInt(id, 10) : id)).filter((n) => !isNaN(n))
    if (ids.length > 0) {
      const { sent, skipped } = await sendNewAssessmentEmails(ids, assessmentType, title, dueDate)
      if (sent > 0) console.log(`[Email] Sent new assessment emails: ${sent} sent, ${skipped} skipped (no email)`)
    }
  } catch (e) {
    console.warn("[Email] sendNewAssessmentEmails failed:", e)
  }
}

/**
 * Creates notifications for multiple students at once using a SINGLE bulk INSERT query
 * This reduces 127 individual queries to just 1-2 queries total
 */
export async function createBulkNotifications(
  studentIds: (string | number)[],
  notification: Omit<CreateNotificationParams, "studentId">,
) {
  console.log("[v0] 📊 Starting bulk notification creation for", studentIds.length, "students")

  try {
    const stringIds = studentIds.filter((id) => typeof id === "string")
    const numberIds = studentIds.filter((id) => typeof id === "number")

    const allInternalIds: number[] = [...numberIds] as number[]

    if (stringIds.length > 0) {
      console.log("[v0] 🔍 Looking up internal IDs for", stringIds.length, "student_id strings")
      const studentLookup = await sql`
        SELECT id FROM students WHERE student_id = ANY(${stringIds})
      `
      allInternalIds.push(...studentLookup.map((s: any) => s.id))
      console.log("[v0] ✅ Found", studentLookup.length, "internal IDs")
    }

    if (allInternalIds.length === 0) {
      console.error("[v0] ❌ No valid student IDs found")
      return []
    }

    console.log("[v0] 💾 Inserting", allInternalIds.length, "notifications in single query")

    const aiSummary = await generateNotificationAiSummary({
      title: notification.title,
      message: notification.message,
      type: notification.type,
    })

    const values = allInternalIds.map((id) => ({
      student_id: id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link || null,
      ai_summary: aiSummary,
      is_read: false,
    }))

    const placeholders = values
      .map((_, i) => {
        const offset = i * 7
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, CURRENT_TIMESTAMP)`
      })
      .join(", ")

    const flatValues = values.flatMap((v) => [
      v.student_id,
      v.type,
      v.title,
      v.message,
      v.link,
      v.ai_summary,
      v.is_read,
    ])

    const result = await sql.unsafe(
      `
      INSERT INTO notifications (student_id, type, title, message, link, ai_summary, is_read, created_at)
      VALUES ${placeholders}
      RETURNING id, student_id, created_at
    `,
      flatValues,
    )

    console.log("[v0] ✅ Bulk insert complete:", {
      total: studentIds.length,
      inserted: result.length,
      queryCount: stringIds.length > 0 ? 2 : 1, // 1 lookup + 1 insert, or just 1 insert
    })

    if (!notification.skipPush && allInternalIds.length > 0) {
      void sendStudentPushToMany({
        studentInternalIds: allInternalIds,
        type: notification.type,
        title: notification.title,
        body: notification.message,
        link: notification.link ?? null,
      }).catch((err) => console.warn("[Push] bulk student notification failed:", err))
    }

    return result
  } catch (error) {
    console.error("[v0] ❌ Failed to create bulk notifications:", error)
    console.error("[v0] Error details:", {
      studentCount: studentIds.length,
      type: notification.type,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}
