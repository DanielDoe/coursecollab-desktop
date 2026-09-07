import { sql } from "@/lib/db"
import { announcementPlainText } from "@/lib/announcement-content"
import { sendAnnouncementPushForCourse } from "@/lib/push-notifications"

export const STUDENT_ANNOUNCEMENTS_LINK = "/student/dashboard-v2/announcements"

function announcementNotificationLink(announcementId?: number, link?: string): string {
  if (link) return link
  if (announcementId != null && Number.isFinite(announcementId)) {
    return `${STUDENT_ANNOUNCEMENTS_LINK}?open=${announcementId}`
  }
  return STUDENT_ANNOUNCEMENTS_LINK
}

/** In-app notifications for a new course announcement (scoped to enrolled students). */
export async function notifyStudentsForAnnouncement(params: {
  courseId: number
  title: string
  content: string
  link?: string
  announcementId?: number
  targetSession?: string | null
  academicTermId?: number | null
}): Promise<number> {
  const { courseId, title, content } = params
  const link = announcementNotificationLink(params.announcementId, params.link)
  const preview = announcementPlainText(content, 150)
  const targetSession = String(params.targetSession ?? "").trim()
  const scopedToSession = targetSession.length > 0 && targetSession.toLowerCase() !== "all"
  const academicTermId =
    params.academicTermId != null &&
    Number.isFinite(Number(params.academicTermId)) &&
    Number(params.academicTermId) > 0
      ? Math.trunc(Number(params.academicTermId))
      : null

  const result = scopedToSession
    ? academicTermId != null
      ? await sql`
          INSERT INTO notifications (student_id, type, title, message, link, is_read, created_at)
          SELECT
            s.id,
            'announcement',
            ${title},
            ${preview},
            ${link},
            false,
            NOW()
          FROM students s
          INNER JOIN sessions sess ON sess.id = s.session_id
          WHERE sess.course_id = ${courseId}
            AND TRIM(sess.code) = TRIM(${targetSession})
            AND sess.academic_term_id = ${academicTermId}
            AND s.deleted_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM notifications n
              WHERE n.student_id = s.id
                AND n.type = 'announcement'
                AND n.title = ${title}
            )
        `
      : await sql`
          INSERT INTO notifications (student_id, type, title, message, link, is_read, created_at)
          SELECT
            s.id,
            'announcement',
            ${title},
            ${preview},
            ${link},
            false,
            NOW()
          FROM students s
          INNER JOIN sessions sess ON sess.id = s.session_id
          WHERE sess.course_id = ${courseId}
            AND TRIM(sess.code) = TRIM(${targetSession})
            AND s.deleted_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM notifications n
              WHERE n.student_id = s.id
                AND n.type = 'announcement'
                AND n.title = ${title}
            )
        `
    : await sql`
        INSERT INTO notifications (student_id, type, title, message, link, is_read, created_at)
        SELECT
          s.id,
          'announcement',
          ${title},
          ${preview},
          ${link},
          false,
          NOW()
        FROM students s
        LEFT JOIN sessions sess ON sess.id = s.session_id
        WHERE (
          s.course_id = ${courseId}
          OR sess.course_id = ${courseId}
        )
        AND s.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.student_id = s.id
            AND n.type = 'announcement'
            AND n.title = ${title}
        )
      `

  if (result.length > 0) {
    void sendAnnouncementPushForCourse({
      courseId,
      title,
      body: preview,
      link,
      announcementId: params.announcementId,
    }).catch((err) => console.warn("[Push] announcement notification failed:", err))
  }

  return result.length
}
