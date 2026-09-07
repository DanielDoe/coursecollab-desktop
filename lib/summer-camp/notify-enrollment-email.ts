import { sql, asSqlRows } from "@/lib/db"
import { sendEmail } from "@/lib/email/sendEmail"
import { campRoute } from "@/lib/summer-camp/camper-nav"

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com").replace(/\/$/, "")

export async function notifyInstructorsCampEnrollment(
  studentDbId: number,
  trainingId: number,
  trainingTitle: string,
): Promise<void> {
  const studentRows = asSqlRows<{ full_name: string; email: string | null }>(
    await sql`
      SELECT full_name, email FROM students WHERE id = ${studentDbId} LIMIT 1
    `,
  )
  const student = studentRows[0]
  if (!student) return

  const facultyRows = asSqlRows<{ email: string; name: string; role: string }>(
    await sql`
      SELECT i.email, i.name, f.role
      FROM camp_training_faculty f
      JOIN instructors i ON i.id = f.instructor_id
      WHERE f.training_id = ${trainingId}
        AND i.email IS NOT NULL
        AND TRIM(i.email) <> ''
      ORDER BY CASE f.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END
    `,
  )

  const campOwnerRows = asSqlRows<{ email: string; name: string }>(
    await sql`
      SELECT i.email, i.name
      FROM camp_trainings t
      JOIN summer_camps c ON c.id = t.camp_id
      JOIN instructors i ON i.id = c.instructor_id
      WHERE t.id = ${trainingId}
        AND i.email IS NOT NULL
        AND TRIM(i.email) <> ''
      LIMIT 1
    `,
  )

  const recipients = new Map<string, { email: string; name: string }>()
  for (const row of [...facultyRows, ...campOwnerRows]) {
    const email = String(row.email).trim().toLowerCase()
    if (email.includes("@")) recipients.set(email, { email, name: row.name })
  }
  if (recipients.size === 0) return

  const studentLabel = student.full_name?.trim() || "A camper"
  const studentEmail = student.email?.trim() || "not on file"
  const facultyHub = `${BASE}/faculty/dashboard/summer-camp`

  const message = `${studentLabel} (${studentEmail}) has enrolled in "${trainingTitle}" on CourseCollab Summer Camp.

You can review campers and training content from the faculty Summer Camp dashboard.

Student dashboard: ${BASE}${campRoute("/my-trainings")}`

  await Promise.all(
    [...recipients.values()].map((faculty) =>
      sendEmail("announcement", faculty.email, {
        title: `New camper enrolled — ${trainingTitle}`,
        message: `Hi ${faculty.name.split(/\s+/)[0] || faculty.name},

${message}`,
        link: facultyHub,
      }).catch((err) => {
        console.error("[notifyInstructorsCampEnrollment]", faculty.email, err)
      }),
    ),
  )
}
