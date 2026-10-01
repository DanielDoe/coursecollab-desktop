/**
 * Set Homework 2 Fall 2026 due three weeks from Sep 29, 2026 (Oct 20, 11:59 PM Central)
 * and tell Fall 2026 ELEG students: web announcement, email, desktop notification, mobile push.
 *
 * Safe to re-run: skips students who already have this announcement notification.
 *
 *   npx tsx scripts/announce-homework-2-fall-2026.ts
 */
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const TITLE = "Homework 2 Fall 2026 is available"
const DUE_LABEL = "Tuesday, October 20, 2026 at 11:59 PM Central"
const AVAILABLE_UNTIL = "2026-10-21T04:59:59.999Z"
const INSTRUCTOR_ID = 1

const SECTIONS = [
  { courseId: 5, code: "ELEG1301P01" },
  { courseId: 5, code: "ELEG1301P02" },
  { courseId: 6, code: "ELEG1304P03" },
] as const

function homeworkUrl(): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com").replace(/\/$/, "")
  return `${base}/student/dashboard-v2/homework`
}

function announcementHtml(): string {
  const href = homeworkUrl().replace(/"/g, "&quot;")
  return `<p>Homework 2 Fall 2026 is now open for your section. It covers selection criteria: if, else-if, and switch.</p>
<p><strong>Due:</strong> ${DUE_LABEL}.</p>
<ul>
<li>Section I is a concept review.</li>
<li>Section II is six C++ programming problems.</li>
</ul>
<p><a href="${href}"><strong>Open Homework</strong></a></p>
<p>Best,<br/>Daniel Doe</p>`
}

function emailHtml(firstName: string): string {
  const name = firstName.replace(/[<>&]/g, "")
  const href = homeworkUrl().replace(/"/g, "&quot;")
  return `<p>Hi ${name},</p>
<p>Homework 2 Fall 2026 is now open. It covers selection criteria: if, else-if, and switch.</p>
<p><strong>Due:</strong> ${DUE_LABEL}.</p>
<ul>
<li>Section I is a concept review.</li>
<li>Section II is six C++ programming problems.</li>
</ul>
<p><a href="${href}">Open Homework</a></p>
<p>Best,<br/>Daniel Doe</p>`
}

const NOTIFY_MESSAGE =
  "Homework 2 on selection criteria (if, else-if, and switch) is open. Due Tuesday, October 20, 2026 at 11:59 PM Central."

async function main() {
  const { sql } = await import("@/lib/db")
  const { createCourseAnnouncement } = await import("@/lib/cora/services/create-announcement")
  const { loadFall2026ElegStudents } = await import("@/lib/eleg-fall-2026-student-scope")
  const { isValidStudentEmail } = await import("@/lib/email/send-notification-email")
  const { sendEmail } = await import("@/lib/email/sendEmail")
  const { sendStudentPushToMany } = await import("@/lib/push-notifications")

  const updated = (await sql`
    UPDATE quizzes
    SET available_until = ${AVAILABLE_UNTIL}, updated_at = NOW()
    WHERE id IN (596, 597)
      AND title = 'Homework 2 Fall 2026'
      AND deleted_at IS NULL
    RETURNING id, course_id, available_until
  `) as { id: number; course_id: number; available_until: string }[]
  if (updated.length !== 2) {
    throw new Error(`Expected to update 2 homework rows, updated ${updated.length}.`)
  }
  console.log(
    "Due date set",
    updated.map((row) => `#${row.id} course ${row.course_id} until ${row.available_until}`).join("; "),
  )

  const students = await loadFall2026ElegStudents(sql)
  console.log(`Fall 2026 students: ${students.length}`)

  const announcementBySession = new Map<string, number>()
  for (const section of SECTIONS) {
    const existing = (await sql`
      SELECT id
      FROM announcements
      WHERE title = ${TITLE}
        AND course_id = ${section.courseId}
        AND TRIM(target_session) = ${section.code}
      ORDER BY id DESC
      LIMIT 1
    `) as { id: number }[]
    if (existing[0]) {
      announcementBySession.set(section.code, Number(existing[0].id))
      console.log(`Announcement already exists for ${section.code} #${existing[0].id}`)
      continue
    }
    const created = await createCourseAnnouncement({
      instructorId: INSTRUCTOR_ID,
      courseId: section.courseId,
      title: TITLE,
      content: announcementHtml(),
      pinned: true,
      priority: "high",
      type: "info",
      targetSession: section.code,
      allowComments: false,
      waitForSideEffects: false,
    })
    const id = Number(created.announcement.id)
    announcementBySession.set(section.code, id)
    console.log(`Created announcement #${id} for ${section.code}`)
  }

  const link = "/student/dashboard-v2/announcements"
  const inserted = (await sql`
    INSERT INTO notifications (student_id, type, title, message, link, ai_summary, is_read, created_at)
    SELECT s.id, 'announcement', ${TITLE}, ${NOTIFY_MESSAGE}, ${link}, ${NOTIFY_MESSAGE}, false, NOW()
    FROM students s
    WHERE s.id = ANY(${students.map((student) => student.id)})
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.student_id = s.id
          AND n.type = 'announcement'
          AND n.title = ${TITLE}
      )
    RETURNING student_id
  `) as { student_id: number }[]
  const newIds = new Set(inserted.map((row) => Number(row.student_id)))
  console.log(`In-app notifications created: ${newIds.size}`)

  const toNotify = students.filter((student) => newIds.has(student.id))
  if (toNotify.length === 0) {
    console.log("No new recipients. Email and push skipped.")
    return
  }

  await sendStudentPushToMany({
    studentInternalIds: toNotify.map((student) => student.id),
    type: "announcement",
    title: TITLE,
    body: NOTIFY_MESSAGE,
    link,
    route: "/announcements",
  })
  const tokens = (await sql`
    SELECT platform, COUNT(*)::int AS n
    FROM expo_push_tokens
    WHERE owner_kind = 'student'
      AND owner_id = ANY(${toNotify.map((student) => student.id)})
    GROUP BY platform
  `) as { platform: string | null; n: number }[]
  console.log("Push tokens on file", JSON.stringify(tokens))

  let sent = 0
  let skipped = 0
  const queue = toNotify.filter((student) => isValidStudentEmail(student.email))
  skipped += toNotify.length - queue.length
  const concurrency = 5
  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency)
    const results = await Promise.all(
      batch.map(async (student) => {
        const first = student.full_name.trim().split(/\s+/)[0] || "there"
        const result = await sendEmail("announcement", student.email!.trim(), {
          title: TITLE,
          message: NOTIFY_MESSAGE,
          link: homeworkUrl(),
          messageHtml: emailHtml(first),
        })
        return result.success
      }),
    )
    sent += results.filter(Boolean).length
    skipped += results.filter((ok) => !ok).length
  }
  console.log(`Email sent ${sent}, skipped ${skipped}`)
  console.log(
    "Announcements",
    [...announcementBySession.entries()].map(([code, id]) => `${code} #${id}`).join(", "),
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
