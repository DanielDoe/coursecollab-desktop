import { sql } from "@/lib/db"
import { ensureAnnouncementStudentContentLockedColumn } from "@/lib/ensure-announcement-student-content-locked"
import { isAnnouncementStudentContentLocked } from "@/lib/announcement-student-lock"

export async function assertAnnouncementUnlockedForStudent(
  announcementId: number,
): Promise<{ locked: boolean; row: { student_content_locked: boolean } | null }> {
  await ensureAnnouncementStudentContentLockedColumn()
  const rows = await sql`
    SELECT student_content_locked FROM announcements WHERE id = ${announcementId} LIMIT 1
  `
  if (rows.length === 0) return { locked: false, row: null }
  const row = rows[0] as { student_content_locked: boolean }
  return { locked: isAnnouncementStudentContentLocked(row), row }
}
