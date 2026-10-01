import { type NextRequest } from "next/server"
import { codebenchEngagementPoints } from "@/lib/codebench-engagement"
import { sql } from "@/lib/db"
import {
  readInstructorSessionScopeFromRequest,
  studentInInstructorSessionScopeSql,
} from "@/lib/instructor-session-scope"

export type InstructorLeaderboardRow = {
  rank: number
  student_id: number
  student_name: string
  section: string | null
  xp: number
  total_activities: number
  approved_codes: number
  practice_count: number
  last_activity: string | null
  editor_runs: number
  compile_errors: number
  compile_successes: number
  editor_saves: number
  cora_uses: number
  live_sessions: number
  points: number
}

type StudioRow = {
  student_id: number
  student_name?: string
  section?: string | null
  runs?: number
  compile_errors?: number
  compile_successes?: number
  saves?: number
  cora_uses?: number
}

type LiveRow = {
  student_id: number
  student_name?: string
  section?: string | null
  live_sessions?: number
}

function rankRows(
  submissionRows: Array<Record<string, unknown>>,
  studioRows: StudioRow[],
  liveRows: LiveRow[],
): InstructorLeaderboardRow[] {
  const byStudent = new Map<number, Record<string, unknown>>()

  for (const row of submissionRows) {
    const id = Number(row.student_id)
    if (!Number.isFinite(id)) continue
    byStudent.set(id, { ...row })
  }

  for (const row of studioRows) {
    const id = Number(row.student_id)
    if (!Number.isFinite(id)) continue
    const existing = byStudent.get(id) ?? {
      student_id: id,
      student_name: row.student_name || "Student",
      section: row.section || null,
      approved_codes: 0,
      practice_count: 0,
      total_activities: 0,
      xp: 0,
      last_activity: null,
    }
    existing.editor_runs = Number(row.runs) || 0
    existing.compile_errors = Number(row.compile_errors) || 0
    existing.compile_successes = Number(row.compile_successes) || 0
    existing.editor_saves = Number(row.saves) || 0
    existing.cora_uses = Number(row.cora_uses) || 0
    if (!existing.student_name && row.student_name) existing.student_name = row.student_name
    byStudent.set(id, existing)
  }

  for (const row of liveRows) {
    const id = Number(row.student_id)
    if (!Number.isFinite(id)) continue
    const existing = byStudent.get(id) ?? {
      student_id: id,
      student_name: row.student_name || "Student",
      section: row.section || null,
      approved_codes: 0,
      practice_count: 0,
      total_activities: 0,
      xp: 0,
      last_activity: null,
    }
    existing.live_sessions = Number(row.live_sessions) || 0
    byStudent.set(id, existing)
  }

  return [...byStudent.values()]
    .map((row) => {
      const points = codebenchEngagementPoints({
        xp: Number(row.xp) || 0,
        approvedCodes: Number(row.approved_codes) || 0,
        runs: Number(row.editor_runs) || 0,
        compileSuccesses: Number(row.compile_successes) || 0,
        compileErrors: Number(row.compile_errors) || 0,
        saves: Number(row.editor_saves) || 0,
        coraToolUses: Number(row.cora_uses) || 0,
        liveClassroomSessions: Number(row.live_sessions) || 0,
      })
      return { ...row, points }
    })
    .filter((row) => Number(row.xp) > 0)
    .sort((a, b) => Number(b.xp) - Number(a.xp) || Number(b.total_activities) - Number(a.total_activities))
    .slice(0, 100)
    .map((row, index) => ({
      rank: index + 1,
      student_id: Number(row.student_id),
      student_name: String(row.student_name || "Student"),
      section: row.section == null ? null : String(row.section),
      xp: Number(row.xp) || 0,
      total_activities: Number(row.total_activities) || 0,
      approved_codes: Number(row.approved_codes) || 0,
      practice_count: Number(row.practice_count) || 0,
      last_activity: row.last_activity == null ? null : String(row.last_activity),
      editor_runs: Number(row.editor_runs) || 0,
      compile_errors: Number(row.compile_errors) || 0,
      compile_successes: Number(row.compile_successes) || 0,
      editor_saves: Number(row.editor_saves) || 0,
      cora_uses: Number(row.cora_uses) || 0,
      live_sessions: Number(row.live_sessions) || 0,
      points: Number(row.points) || 0,
    }))
}

/** Same CodeBench XP ranking students see, limited to the instructor's selected section. */
export async function fetchInstructorCodebenchLeaderboard(
  courseId: number,
  request: NextRequest,
): Promise<InstructorLeaderboardRow[]> {
  const sessionScope = readInstructorSessionScopeFromRequest(request)
  const scope = sql.unsafe(
    studentInInstructorSessionScopeSql({
      courseId,
      sessionId: sessionScope.sessionId,
      academicTermId: sessionScope.academicTermId,
    }),
  )

  const submissionRows = await sql`
    WITH codebench_xp AS (
      SELECT
        cs.student_id,
        s.full_name as student_name,
        s.section,
        COUNT(DISTINCT cs.id) as submissions_count,
        MAX(cs.submitted_at) as last_submission
      FROM codebench_submissions cs
      JOIN students s ON cs.student_id = s.id
      WHERE cs.status = 'approved'
        AND ${scope}
      GROUP BY cs.student_id, s.full_name, s.section
    ),
    practice_xp AS (
      SELECT
        ps.student_id,
        s.full_name as student_name,
        s.section,
        COUNT(DISTINCT ps.id) as practice_count,
        SUM(COALESCE(ppp.points, 0)) as practice_points,
        MAX(ps.submitted_at) as last_practice
      FROM practice_submissions ps
      JOIN students s ON ps.student_id = s.id
      LEFT JOIN pending_practice_points ppp ON ppp.id = ps.practice_point_id
        AND ppp.status = 'approved'
      WHERE ps.status = 'approved'
        AND ${scope}
      GROUP BY ps.student_id, s.full_name, s.section
    ),
    award_xp AS (
      SELECT
        cp.student_id,
        s.full_name as student_name,
        s.section,
        SUM(cp.points) as total_points
      FROM classroom_points cp
      JOIN students s ON s.id = cp.student_id
      WHERE cp.category = 'code_submission'
        AND cp.status = 'approved'
        AND ${scope}
      GROUP BY cp.student_id, s.full_name, s.section
    ),
    activity_stats AS (
      SELECT
        COALESCE(c.student_id, p.student_id) as student_id,
        COALESCE(c.student_name, p.student_name) as student_name,
        COALESCE(c.section, p.section) as section,
        COALESCE(c.submissions_count, 0) as approved_codes,
        COALESCE(p.practice_count, 0) as practice_count,
        COALESCE(c.submissions_count, 0) + COALESCE(p.practice_count, 0) as total_activities,
        COALESCE(p.practice_points, 0) as practice_points,
        GREATEST(COALESCE(c.last_submission, '1970-01-01'), COALESCE(p.last_practice, '1970-01-01')) as last_activity
      FROM codebench_xp c
      FULL OUTER JOIN practice_xp p ON c.student_id = p.student_id
    ),
    combined_stats AS (
      SELECT
        COALESCE(a.student_id, w.student_id) as student_id,
        COALESCE(a.student_name, w.student_name) as student_name,
        COALESCE(a.section, w.section) as section,
        COALESCE(a.approved_codes, 0) as approved_codes,
        COALESCE(a.practice_count, 0) as practice_count,
        COALESCE(a.total_activities, 0) as total_activities,
        COALESCE(w.total_points, 0) + COALESCE(a.practice_points, 0) as total_xp,
        COALESCE(a.last_activity, '1970-01-01') as last_activity
      FROM activity_stats a
      FULL OUTER JOIN award_xp w ON w.student_id = a.student_id
    )
    SELECT
      student_id,
      student_name,
      section,
      approved_codes,
      practice_count,
      total_activities,
      total_xp::INTEGER as xp,
      last_activity
    FROM combined_stats
    WHERE total_activities > 0 OR total_xp > 0
    ORDER BY total_xp DESC, last_activity DESC
  `

  const studioRows = await sql`
    SELECT
      s.id AS student_id,
      s.full_name AS student_name,
      s.section,
      COUNT(*) FILTER (WHERE e.event_type = 'run')::int AS runs,
      COUNT(*) FILTER (WHERE e.event_type = 'compile_error')::int AS compile_errors,
      COUNT(*) FILTER (WHERE e.event_type = 'compile_success')::int AS compile_successes,
      COUNT(*) FILTER (WHERE e.event_type = 'save')::int AS saves,
      COUNT(*) FILTER (WHERE e.event_type = 'cora_tool')::int AS cora_uses
    FROM codebench_studio_events e
    JOIN students s ON s.id = e.student_id
    WHERE ${scope}
    GROUP BY s.id, s.full_name, s.section
  `.catch(() => [])

  const liveRows = await sql`
    SELECT
      s.id AS student_id,
      s.full_name AS student_name,
      s.section,
      COUNT(DISTINCT snap.assignment_id)::int AS live_sessions
    FROM codebench_live_snapshots snap
    JOIN students s ON s.id = snap.student_id
    WHERE ${scope}
    GROUP BY s.id, s.full_name, s.section
  `.catch(() => [])

  return rankRows(submissionRows as Array<Record<string, unknown>>, studioRows as StudioRow[], liveRows as LiveRow[])
}
