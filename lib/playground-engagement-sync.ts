import { sql } from "@/lib/db"
import { recalculateAndSaveGrade } from "@/lib/grades"
import { syncActivityPointsAfterAction } from "@/lib/trade-center-sync"

/**
 * After playground activity, sync Trade Center weekly points and refresh gradebook engagement.
 */
export async function syncPlaygroundEngagementForStudent(
  studentDbId: number,
  sessionCode: string,
): Promise<void> {
  await syncActivityPointsAfterAction(studentDbId, sessionCode, "playground")

  try {
    await recalculateAndSaveGrade(studentDbId, sessionCode)
  } catch {
    // Grade sync is best-effort; trade center points already updated
  }
}

export async function syncPlaygroundEngagementByResultId(resultId: number): Promise<void> {
  const rows = await sql`
    SELECT s.id AS student_db_id, s.section
    FROM playground_results pr
    JOIN students s ON s.student_id = pr.student_id
    WHERE pr.id = ${resultId}
    LIMIT 1
  `
  if (!rows.length) return
  const row = rows[0] as { student_db_id: number; section: string | null }
  await syncPlaygroundEngagementForStudent(Number(row.student_db_id), row.section || "ALL")
}
