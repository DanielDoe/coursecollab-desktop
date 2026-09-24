import { sql } from "@/lib/db"
import { codebenchEngagementPoints, codebenchImprovementNote } from "@/lib/codebench-engagement"

export type CodebenchStudentStudio = {
  runs: number
  compileErrors: number
  compileSuccesses: number
  saves: number
  coraUses: number
  liveSessions: number
  approvedCodes: number
  points: number
  improvement: string
  recent: Array<{ title: string; detail: string | null; createdAt: string }>
}

const EMPTY_STUDIO: CodebenchStudentStudio = {
  runs: 0,
  compileErrors: 0,
  compileSuccesses: 0,
  saves: 0,
  coraUses: 0,
  liveSessions: 0,
  approvedCodes: 0,
  points: 0,
  improvement: "No editor activity yet. Open the editor and press Run.",
  recent: [],
}

function eventTitle(type: string, tool: string | null): string {
  switch (type) {
    case "compile_error":
      return "Compiler error"
    case "compile_success":
      return "Clean compile"
    case "save":
      return "Saved in the editor"
    case "cora_tool":
      return tool ? `Cora · ${tool}` : "Asked Cora"
    case "suggest_fix":
      return "Asked Cora for a fix"
    case "runtime_exit":
      return "Program finished"
    default:
      return "Ran the editor"
  }
}

/** Last 30 days of editor, compile, Cora, and live-classroom use for one student. */
export async function loadCodebenchStudentStudio(
  studentDbId: number,
  approvedCodes = 0,
): Promise<CodebenchStudentStudio> {
  try {
    const [eventRows, liveRows, recentRows] = await Promise.all([
      sql`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'run')::int AS runs,
          COUNT(*) FILTER (WHERE event_type = 'compile_error')::int AS compile_errors,
          COUNT(*) FILTER (WHERE event_type = 'compile_success')::int AS compile_successes,
          COUNT(*) FILTER (WHERE event_type = 'save')::int AS saves,
          COUNT(*) FILTER (WHERE event_type IN ('cora_tool', 'suggest_fix'))::int AS cora_uses
        FROM codebench_studio_events
        WHERE student_id = ${studentDbId}
          AND created_at > NOW() - INTERVAL '30 days'
      `.catch(() => []),
      sql`
        SELECT COUNT(DISTINCT assignment_id)::int AS live_sessions
        FROM codebench_live_snapshots
        WHERE student_id = ${studentDbId}
          AND updated_at > NOW() - INTERVAL '30 days'
      `.catch(() => []),
      sql`
        SELECT event_type, tool, file_name, error_message, created_at
        FROM codebench_studio_events
        WHERE student_id = ${studentDbId}
          AND created_at > NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC
        LIMIT 12
      `.catch(() => []),
    ])

    const stats = (eventRows as Array<Record<string, unknown>>)[0] ?? {}
    const runs = Number(stats.runs) || 0
    const compileErrors = Number(stats.compile_errors) || 0
    const compileSuccesses = Number(stats.compile_successes) || 0
    const saves = Number(stats.saves) || 0
    const coraUses = Number(stats.cora_uses) || 0
    const liveSessions = Number((liveRows as Array<Record<string, unknown>>)[0]?.live_sessions) || 0
    const input = {
      approvedCodes,
      runs,
      compileSuccesses,
      compileErrors,
      saves,
      coraToolUses: coraUses,
      liveClassroomSessions: liveSessions,
    }

    return {
      ...input,
      coraUses,
      liveSessions,
      points: codebenchEngagementPoints(input),
      improvement: codebenchImprovementNote(input, "you"),
      recent: (recentRows as Array<Record<string, unknown>>).map((row) => ({
        title: eventTitle(String(row.event_type || "run"), row.tool ? String(row.tool) : null),
        detail: row.error_message
          ? String(row.error_message).slice(0, 140)
          : row.file_name
            ? String(row.file_name)
            : null,
        createdAt: String(row.created_at || ""),
      })),
    }
  } catch {
    return EMPTY_STUDIO
  }
}
