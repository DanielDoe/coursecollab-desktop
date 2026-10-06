import { sql } from "@/lib/db"
import type { StudentCourseContext } from "@/lib/student-course-scope"

export type PlaygroundLobbyJoinState = "open" | "waiting"

export type OpenPlaygroundLobby = {
  sessionId: number
  sessionCode: string
  label: string
  questionCount: number
  durationSec: number
  waitingCount: number
  joinState: PlaygroundLobbyJoinState
  resultId: number | null
}

export function playgroundSessionDisplayLabel(
  topics: string[] | null | undefined,
  sessionCode: string,
): string {
  const list = topics ?? []
  const label = list.find((topic) => topic.includes("—") || topic.toLowerCase().includes("lecture"))
  return label ?? list[0] ?? sessionCode
}

/** Section-locked lobbies only admit that section. Unrestricted lobbies stay on the course. */
export function studentMayEnterPlaygroundLobby(input: {
  allowedSessions: number[] | null | undefined
  playgroundCourseId: number | null
  studentSessionId: number | null
  studentCourseId: number | null
}): boolean {
  const allowed = (input.allowedSessions ?? [])
    .map((id) => Math.trunc(Number(id)))
    .filter((id) => Number.isFinite(id) && id > 0)
  if (allowed.length > 0) {
    return input.studentSessionId != null && allowed.includes(input.studentSessionId)
  }
  if (input.playgroundCourseId == null) return true
  return input.studentCourseId != null && input.playgroundCourseId === input.studentCourseId
}

type LobbyRow = {
  id: number
  session_code: string
  selected_topics: string[] | null
  question_count: number | null
  duration_sec: number | null
  waiting_count: number | null
  result_id: number | null
  joined_at_question: number | null
  completed_at: string | null
}

export async function listStudentOpenPlaygroundLobbies(
  ctx: StudentCourseContext,
  rosterStudentId: string,
): Promise<OpenPlaygroundLobby[]> {
  const courseId = ctx.courseId
  const sessionMatchId =
    ctx.sessionId != null && Number.isFinite(ctx.sessionId) && ctx.sessionId > 0
      ? Math.trunc(ctx.sessionId)
      : 0
  const rows = (await sql`
    SELECT
      ps.id,
      ps.session_code,
      ps.selected_topics,
      ps.question_count,
      ps.duration_sec,
      (
        SELECT COUNT(*)::int
        FROM playground_results pr_wait
        WHERE pr_wait.session_id = ps.id
          AND pr_wait.joined_at_question < 0
          AND pr_wait.completed_at IS NULL
      ) AS waiting_count,
      mine.id AS result_id,
      mine.joined_at_question,
      mine.completed_at
    FROM playground_sessions ps
    LEFT JOIN LATERAL (
      SELECT id, joined_at_question, completed_at
      FROM playground_results
      WHERE session_id = ps.id
        AND student_id = ${rosterStudentId}
      ORDER BY id DESC
      LIMIT 1
    ) mine ON true
    WHERE ps.mode = 'CLASSROOM'
      AND ps.is_active = true
      AND ps.game_started = false
      AND (
        (
          ps.allowed_sessions IS NOT NULL
          AND cardinality(ps.allowed_sessions) > 0
          AND ${sessionMatchId} > 0
          AND ps.allowed_sessions && ARRAY[${sessionMatchId}]::int[]
        )
        OR (
          (ps.allowed_sessions IS NULL OR cardinality(ps.allowed_sessions) = 0)
          AND (ps.course_id = ${courseId} OR ps.course_id IS NULL)
        )
      )
      AND (
        mine.id IS NULL
        OR (mine.joined_at_question < 0 AND mine.completed_at IS NULL)
      )
    ORDER BY ps.lobby_opened_at DESC NULLS LAST, ps.id DESC
  `) as LobbyRow[]

  return rows.map((row) => {
    const waiting = row.result_id != null && Number(row.joined_at_question ?? 0) < 0 && row.completed_at == null
    return {
      sessionId: Number(row.id),
      sessionCode: row.session_code,
      label: playgroundSessionDisplayLabel(row.selected_topics, row.session_code),
      questionCount: Number(row.question_count ?? 0),
      durationSec: Number(row.duration_sec ?? 15),
      waitingCount: Number(row.waiting_count ?? 0),
      joinState: waiting ? "waiting" : "open",
      resultId: waiting ? Number(row.result_id) : null,
    }
  })
}
