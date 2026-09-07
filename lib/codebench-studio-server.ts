import { sql } from "@/lib/db"
import {
  buildStudioSnapshot,
  type StudioErrorFamily,
  type StudioEvent,
  type StudioEventType,
} from "@/lib/codebench-studio-analytics"
import { ensureCodebenchStudioEventsSchema } from "@/lib/codebench-studio-schema"

export async function fetchStudioSnapshotForStudent(studentId: number) {
  try {
    await ensureCodebenchStudioEventsSchema()
    const rows = await sql`
      SELECT event_type, language, error_family, error_message, tool, file_name, success, created_at
      FROM codebench_studio_events
      WHERE student_id = ${studentId}
        AND created_at > NOW() - INTERVAL '90 days'
      ORDER BY created_at ASC
      LIMIT 400
    `
    const events: StudioEvent[] = (rows as Array<Record<string, unknown>>).map((row, index) => ({
      id: `db_${index}`,
      at: row.created_at instanceof Date ? row.created_at.getTime() : Date.now(),
      type: String(row.event_type) as StudioEventType,
      language: row.language ? String(row.language) : undefined,
      fileName: row.file_name ? String(row.file_name) : undefined,
      tool: row.tool ? String(row.tool) : undefined,
      success: typeof row.success === "boolean" ? row.success : undefined,
      errorFamily: row.error_family ? (String(row.error_family) as StudioErrorFamily) : undefined,
      errorMessage: row.error_message ? String(row.error_message) : undefined,
    }))
    return buildStudioSnapshot(events)
  } catch {
    return buildStudioSnapshot([])
  }
}
