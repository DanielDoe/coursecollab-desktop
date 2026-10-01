import { sql } from "@/lib/db"
import type { TenantSql } from "@/lib/db-tenant-context"
import {
  buildStudioSnapshot,
  classifyCompilerMessage,
  type StudioErrorFamily,
  type StudioEvent,
  type StudioEventType,
} from "@/lib/codebench-studio-analytics"
import { ensureCodebenchStudioEventsSchema } from "@/lib/codebench-studio-schema"

const EVENT_TYPES = new Set<StudioEventType>([
  "run",
  "compile_success",
  "compile_error",
  "runtime_exit",
  "cora_tool",
  "save",
  "suggest_fix",
])

const ERROR_FAMILIES = new Set<StudioErrorFamily>([
  "missing-semicolon",
  "undeclared-name",
  "type-mismatch",
  "missing-include",
  "return-issue",
  "brace-mismatch",
  "unused-or-warning",
  "linker",
  "runtime",
  "timeout",
  "other",
])

function loggedEventAt(value: unknown) {
  if (value instanceof Date) return value.getTime()
  const ms = new Date(String(value ?? "")).getTime()
  return Number.isFinite(ms) ? ms : Date.now()
}

/** Saved compiler and editor events. This history stays after a later clean build. */
export async function listLoggedStudioEvents(db: TenantSql, studentId: number): Promise<StudioEvent[]> {
  const rows = await db`
    SELECT event_type, language, error_family, error_message, tool, file_name, success, created_at
    FROM codebench_studio_events
    WHERE student_id = ${studentId}
      AND created_at > NOW() - INTERVAL '90 days'
    ORDER BY created_at ASC
    LIMIT 400
  `
  return (rows as Array<Record<string, unknown>>).flatMap((row, index) => {
    const type = String(row.event_type || "")
    if (!EVENT_TYPES.has(type as StudioEventType)) return []
    const errorMessage = row.error_message ? String(row.error_message) : undefined
    const storedFamily = row.error_family ? String(row.error_family) : ""
    const errorFamily = ERROR_FAMILIES.has(storedFamily as StudioErrorFamily)
      ? (storedFamily as StudioErrorFamily)
      : errorMessage
        ? classifyCompilerMessage(errorMessage)
        : undefined
    return [
      {
        id: `db_${index}`,
        at: loggedEventAt(row.created_at),
        type: type as StudioEventType,
        language: row.language ? String(row.language) : undefined,
        fileName: row.file_name ? String(row.file_name) : undefined,
        tool: row.tool ? String(row.tool) : undefined,
        success: typeof row.success === "boolean" ? row.success : undefined,
        errorFamily,
        errorMessage,
      },
    ]
  })
}

export async function fetchStudioSnapshotForStudent(studentId: number) {
  try {
    await ensureCodebenchStudioEventsSchema()
    const events = await listLoggedStudioEvents(sql as unknown as TenantSql, studentId)
    return buildStudioSnapshot(events)
  } catch {
    return buildStudioSnapshot([])
  }
}
