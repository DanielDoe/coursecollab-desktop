import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import {
  backfillCodebenchStudioEventCourseIds,
  studioEventInCourseSql,
} from "@/lib/codebench-studio-course-scope"
import { ensureCodebenchStudioEventsSchema } from "@/lib/codebench-studio-schema"
import {
  studioFamilyLabel,
  studioToolLabel,
  type StudioErrorFamily,
} from "@/lib/codebench-studio-analytics"
import { readInstructorSessionScopeFromRequest, studentInInstructorSessionScopeSql } from "@/lib/instructor-session-scope"

export type CodebenchStudentActivityRow = {
  studentDbId: number
  studentId: string
  fullName: string
  email: string | null
  section: string | null
  sessionCode: string | null
  engaged: boolean
  lastActivityAt: string | null
  runs: number
  compileErrors: number
  compileSuccesses: number
  coraToolUses: number
  saves: number
  lastCoraTool: string | null
  submissions: number
  lastSubmissionAt: string | null
  activityLabel: string
  detail: string | null
}

export type CodebenchRecentActivityItem = {
  id: string
  studentDbId: number
  studentName: string
  studentCode: string
  eventType: string
  title: string
  detail: string | null
  createdAt: string
  tone: "error" | "ok" | "tool" | "info" | "submit"
}

export type CodebenchStudentActivityPayload = {
  windowDays: number
  summary: {
    totalStudents: number
    activeStudents: number
    notStartedStudents: number
    totalRuns: number
    totalSubmissions: number
  }
  students: CodebenchStudentActivityRow[]
  recent: CodebenchRecentActivityItem[]
}

function scopeSql(courseId: number, request: NextRequest): string {
  const sessionScope = readInstructorSessionScopeFromRequest(request)
  return studentInInstructorSessionScopeSql({
    courseId,
    sessionId: sessionScope.sessionId,
    academicTermId: sessionScope.academicTermId,
  })
}

export function formatInstructorStudioEvent(input: {
  eventType: string
  tool?: string | null
  fileName?: string | null
  errorFamily?: string | null
  errorMessage?: string | null
  assignmentTitle?: string | null
}): { title: string; detail: string | null; tone: CodebenchRecentActivityItem["tone"] } {
  const fileSuffix = input.fileName ? ` · ${input.fileName}` : ""
  switch (input.eventType) {
    case "compile_error":
      return {
        title: input.errorFamily
          ? studioFamilyLabel(input.errorFamily as StudioErrorFamily)
          : "Compiler error",
        detail: input.errorMessage?.slice(0, 120) || `Compile failed${fileSuffix}`,
        tone: "error",
      }
    case "compile_success":
      return { title: "Clean compile", detail: `Build succeeded${fileSuffix}`, tone: "ok" }
    case "cora_tool":
      return {
        title: `Cora · ${studioToolLabel(input.tool || "tool")}`,
        detail: `Used ${studioToolLabel(input.tool || "a Cora tool")}${fileSuffix}`,
        tone: "tool",
      }
    case "suggest_fix":
      return {
        title: "Asked Cora to suggest a fix",
        detail: input.errorMessage?.slice(0, 120) || "Cora read compiler output",
        tone: "tool",
      }
    case "save":
      return { title: "Saved workspace", detail: input.fileName || "Saved files", tone: "info" }
    case "runtime_exit":
      return { title: "Program finished", detail: `Runtime exit${fileSuffix}`, tone: "info" }
    case "codebench_submit":
      return {
        title: "Submitted assignment",
        detail: input.assignmentTitle || "Code submitted for grading",
        tone: "submit",
      }
    default:
      return { title: "Ran program", detail: `Pressed Run${fileSuffix}`, tone: "info" }
  }
}

function buildActivityLabel(input: {
  runs: number
  compileErrors: number
  coraToolUses: number
  submissions: number
  lastCoraTool: string | null
}): { label: string; detail: string | null } {
  if (input.runs === 0 && input.submissions === 0 && input.coraToolUses === 0) {
    return { label: "No CodeBench activity", detail: null }
  }

  const parts: string[] = []
  if (input.runs > 0) parts.push(`${input.runs} run${input.runs === 1 ? "" : "s"}`)
  if (input.submissions > 0) parts.push(`${input.submissions} submission${input.submissions === 1 ? "" : "s"}`)
  if (input.coraToolUses > 0) parts.push(`${input.coraToolUses} Cora use${input.coraToolUses === 1 ? "" : "s"}`)
  if (input.compileErrors > 0) parts.push(`${input.compileErrors} compile error${input.compileErrors === 1 ? "" : "s"}`)

  const detail =
    input.lastCoraTool != null
      ? `Last Cora tool: ${studioToolLabel(input.lastCoraTool)}`
      : input.compileErrors > 0
        ? "Recent compile errors — check Insights for class patterns"
        : null

  return { label: parts.join(" · "), detail }
}

function maxIso(values: Array<string | null | undefined>): string | null {
  let best: number | null = null
  let bestValue: string | null = null
  for (const value of values) {
    if (!value) continue
    const ms = new Date(value).getTime()
    if (Number.isNaN(ms)) continue
    if (best == null || ms > best) {
      best = ms
      bestValue = value
    }
  }
  return bestValue
}

export async function fetchCodebenchStudentActivity(
  courseId: number,
  request: NextRequest,
  windowDays = 30,
): Promise<CodebenchStudentActivityPayload> {
  const scopeWhere = scopeSql(courseId, request)
  const windowDaysSafe = Math.min(90, Math.max(7, Math.trunc(windowDays)))

  try {
    await ensureCodebenchStudioEventsSchema()
    await backfillCodebenchStudioEventCourseIds()
  } catch {
    /* table may not exist yet in some environments */
  }

  const eventCourseMatch = studioEventInCourseSql(courseId, "e")

  const [studentRows, recentStudioRows, recentSubmissionRows] = await Promise.all([
    sql`
      SELECT
        s.id AS student_db_id,
        s.student_id,
        s.full_name,
        s.email,
        s.section,
        sess.code AS session_code,
        COUNT(e.id) FILTER (
          WHERE e.created_at > NOW() - (${windowDaysSafe}::int * INTERVAL '1 day')
        )::int AS event_count,
        COUNT(e.id) FILTER (
          WHERE e.event_type = 'run'
            AND e.created_at > NOW() - (${windowDaysSafe}::int * INTERVAL '1 day')
        )::int AS runs,
        COUNT(e.id) FILTER (
          WHERE e.event_type = 'compile_error'
            AND e.created_at > NOW() - (${windowDaysSafe}::int * INTERVAL '1 day')
        )::int AS compile_errors,
        COUNT(e.id) FILTER (
          WHERE e.event_type = 'compile_success'
            AND e.created_at > NOW() - (${windowDaysSafe}::int * INTERVAL '1 day')
        )::int AS compile_successes,
        COUNT(e.id) FILTER (
          WHERE e.event_type = 'cora_tool'
            AND e.created_at > NOW() - (${windowDaysSafe}::int * INTERVAL '1 day')
        )::int AS cora_tool_uses,
        COUNT(e.id) FILTER (
          WHERE e.event_type = 'save'
            AND e.created_at > NOW() - (${windowDaysSafe}::int * INTERVAL '1 day')
        )::int AS saves,
        MAX(e.created_at) FILTER (
          WHERE e.created_at > NOW() - (${windowDaysSafe}::int * INTERVAL '1 day')
        ) AS last_studio_at,
        (
          SELECT e2.tool
          FROM codebench_studio_events e2
          WHERE e2.student_id = s.id
            AND ${sql.unsafe(studioEventInCourseSql(courseId, "e2"))}
            AND e2.event_type = 'cora_tool'
            AND e2.created_at > NOW() - (${windowDaysSafe}::int * INTERVAL '1 day')
          ORDER BY e2.created_at DESC
          LIMIT 1
        ) AS last_cora_tool,
        COALESCE(sub.submissions, 0)::int AS submissions,
        sub.last_submission_at
      FROM students s
      JOIN sessions sess ON sess.id = s.session_id
      LEFT JOIN codebench_studio_events e
        ON e.student_id = s.id
        AND ${sql.unsafe(eventCourseMatch)}
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS submissions,
          MAX(cs.submitted_at) AS last_submission_at
        FROM codebench_submissions cs
        WHERE cs.student_id = s.id
          AND cs.submitted_at > NOW() - (${windowDaysSafe}::int * INTERVAL '1 day')
      ) sub ON TRUE
      WHERE ${sql.unsafe(scopeWhere)}
      GROUP BY
        s.id,
        s.student_id,
        s.full_name,
        s.email,
        s.section,
        sess.code,
        sub.submissions,
        sub.last_submission_at
      ORDER BY GREATEST(
        COALESCE(MAX(e.created_at), 'epoch'::timestamptz),
        COALESCE(sub.last_submission_at, 'epoch'::timestamptz)
      ) DESC,
      s.full_name ASC
    `.catch(() => []),
    sql`
      SELECT
        e.id,
        e.student_id AS student_db_id,
        s.full_name,
        s.student_id AS student_code,
        e.event_type,
        e.tool,
        e.file_name,
        e.error_family,
        e.error_message,
        e.created_at
      FROM codebench_studio_events e
      JOIN students s ON s.id = e.student_id
      WHERE ${sql.unsafe(eventCourseMatch)}
        AND e.created_at > NOW() - (${windowDaysSafe}::int * INTERVAL '1 day')
        AND ${sql.unsafe(scopeWhere.replace(/\bs\./g, "s."))}
      ORDER BY e.created_at DESC
      LIMIT 40
    `.catch(() => []),
    sql`
      SELECT
        cs.id,
        cs.student_id AS student_db_id,
        s.full_name,
        s.student_id AS student_code,
        cs.submitted_at AS created_at,
        cps.title AS assignment_title
      FROM codebench_submissions cs
      JOIN students s ON s.id = cs.student_id
      LEFT JOIN classroom_point_submissions cps ON cps.id = cs.assignment_id
      WHERE cs.submitted_at > NOW() - (${windowDaysSafe}::int * INTERVAL '1 day')
        AND ${sql.unsafe(scopeWhere.replace(/\bs\./g, "s."))}
      ORDER BY cs.submitted_at DESC
      LIMIT 20
    `.catch(() => []),
  ])

  type StudentRow = {
    student_db_id: number
    student_id: string
    full_name: string
    email: string | null
    section: string | null
    session_code: string | null
    event_count: number
    runs: number
    compile_errors: number
    compile_successes: number
    cora_tool_uses: number
    saves: number
    last_studio_at: string | null
    last_cora_tool: string | null
    submissions: number
    last_submission_at: string | null
  }

  const students = (studentRows as StudentRow[]).map((row) => {
    const runs = Number(row.runs) || 0
    const submissions = Number(row.submissions) || 0
    const coraToolUses = Number(row.cora_tool_uses) || 0
    const compileErrors = Number(row.compile_errors) || 0
    const engaged = runs > 0 || submissions > 0 || coraToolUses > 0 || Number(row.event_count) > 0
    const { label, detail } = buildActivityLabel({
      runs,
      compileErrors,
      coraToolUses,
      submissions,
      lastCoraTool: row.last_cora_tool,
    })

    return {
      studentDbId: row.student_db_id,
      studentId: row.student_id,
      fullName: row.full_name,
      email: row.email,
      section: row.section,
      sessionCode: row.session_code,
      engaged,
      lastActivityAt: maxIso([row.last_studio_at, row.last_submission_at]),
      runs,
      compileErrors,
      compileSuccesses: Number(row.compile_successes) || 0,
      coraToolUses,
      saves: Number(row.saves) || 0,
      lastCoraTool: row.last_cora_tool,
      submissions,
      lastSubmissionAt: row.last_submission_at,
      activityLabel: label,
      detail,
    }
  })

  const studioRecent = (recentStudioRows as Array<Record<string, unknown>>).map((row) => {
    const formatted = formatInstructorStudioEvent({
      eventType: String(row.event_type || "run"),
      tool: row.tool ? String(row.tool) : null,
      fileName: row.file_name ? String(row.file_name) : null,
      errorFamily: row.error_family ? String(row.error_family) : null,
      errorMessage: row.error_message ? String(row.error_message) : null,
    })
    return {
      id: `studio-${String(row.id)}`,
      studentDbId: Number(row.student_db_id) || 0,
      studentName: String(row.full_name || "Student"),
      studentCode: String(row.student_code || ""),
      eventType: String(row.event_type || "run"),
      title: formatted.title,
      detail: formatted.detail,
      createdAt: String(row.created_at || new Date().toISOString()),
      tone: formatted.tone,
    } satisfies CodebenchRecentActivityItem
  })

  const submissionRecent = (recentSubmissionRows as Array<Record<string, unknown>>).map((row) => {
    const formatted = formatInstructorStudioEvent({
      eventType: "codebench_submit",
      assignmentTitle: row.assignment_title ? String(row.assignment_title) : null,
    })
    return {
      id: `submit-${String(row.id)}`,
      studentDbId: Number(row.student_db_id) || 0,
      studentName: String(row.full_name || "Student"),
      studentCode: String(row.student_code || ""),
      eventType: "codebench_submit",
      title: formatted.title,
      detail: formatted.detail,
      createdAt: String(row.created_at || new Date().toISOString()),
      tone: formatted.tone,
    } satisfies CodebenchRecentActivityItem
  })

  const recent = [...studioRecent, ...submissionRecent]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50)

  const activeStudents = students.filter((row) => row.engaged).length
  const totalRuns = students.reduce((sum, row) => sum + row.runs, 0)
  const totalSubmissions = students.reduce((sum, row) => sum + row.submissions, 0)

  return {
    windowDays: windowDaysSafe,
    summary: {
      totalStudents: students.length,
      activeStudents,
      notStartedStudents: Math.max(0, students.length - activeStudents),
      totalRuns,
      totalSubmissions,
    },
    students,
    recent,
  }
}
