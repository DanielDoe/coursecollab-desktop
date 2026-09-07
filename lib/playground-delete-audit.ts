import { sql } from "@/lib/db"

export type PlaygroundDeleteSource =
  | "api:instructor/playground/clear-sessions"
  | "api:instructor/data-management/clear"
  | "api:instructor/playground/sessions:delete"
  | "api:playground/admin/reset"
  | "script:prepare-playground-classroom-e2e"
  | (string & {})

export async function countPlaygroundRows(params: {
  courseId?: number | null
  sessionId?: number | null
  classroomOnly?: boolean
}): Promise<{ answers: number; results: number; questions: number; sessions: number }> {
  const { courseId, sessionId, classroomOnly = false } = params

  if (sessionId != null) {
    const [answers, results, questions] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS n
        FROM playground_answers pa
        JOIN playground_results pr ON pr.id = pa.result_id
        WHERE pr.session_id = ${sessionId}
      `,
      sql`SELECT COUNT(*)::int AS n FROM playground_results WHERE session_id = ${sessionId}`,
      sql`SELECT COUNT(*)::int AS n FROM playground_questions WHERE session_id = ${sessionId}`,
    ])
    return {
      answers: Number(answers[0]?.n ?? 0),
      results: Number(results[0]?.n ?? 0),
      questions: Number(questions[0]?.n ?? 0),
      sessions: 1,
    }
  }

  if (courseId != null) {
    const [answers, results, questions, sessions] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS n
        FROM playground_answers pa
        JOIN playground_results pr ON pr.id = pa.result_id
        JOIN playground_sessions ps ON ps.id = pr.session_id
        WHERE ps.course_id = ${courseId}
          ${classroomOnly ? sql`AND ps.mode = 'CLASSROOM'` : sql``}
      `,
      sql`
        SELECT COUNT(*)::int AS n
        FROM playground_results pr
        JOIN playground_sessions ps ON ps.id = pr.session_id
        WHERE ps.course_id = ${courseId}
          ${classroomOnly ? sql`AND ps.mode = 'CLASSROOM'` : sql``}
      `,
      sql`
        SELECT COUNT(*)::int AS n
        FROM playground_questions pq
        JOIN playground_sessions ps ON ps.id = pq.session_id
        WHERE ps.course_id = ${courseId}
          ${classroomOnly ? sql`AND ps.mode = 'CLASSROOM'` : sql``}
      `,
      sql`
        SELECT COUNT(*)::int AS n
        FROM playground_sessions ps
        WHERE ps.course_id = ${courseId}
          ${classroomOnly ? sql`AND ps.mode = 'CLASSROOM'` : sql``}
      `,
    ])
    return {
      answers: Number(answers[0]?.n ?? 0),
      results: Number(results[0]?.n ?? 0),
      questions: Number(questions[0]?.n ?? 0),
      sessions: Number(sessions[0]?.n ?? 0),
    }
  }

  const [answers, results, sessions] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM playground_answers`,
    sql`SELECT COUNT(*)::int AS n FROM playground_results`,
    sql`SELECT COUNT(*)::int AS n FROM playground_sessions`,
  ])
  return {
    answers: Number(answers[0]?.n ?? 0),
    results: Number(results[0]?.n ?? 0),
    questions: 0,
    sessions: Number(sessions[0]?.n ?? 0),
  }
}

export async function logPlaygroundDeleteAudit(params: {
  source: PlaygroundDeleteSource
  action?: string
  actorId?: number | null
  actorType?: "instructor" | "admin" | "script" | "system"
  courseId?: number | null
  sessionId?: number | null
  scope?: Record<string, unknown>
  rowsBefore: { answers: number; results: number; questions?: number; sessions?: number }
  rowsDeleted?: { answers?: number; results?: number; questions?: number; sessions?: number }
  metadata?: Record<string, unknown>
}): Promise<void> {
  const metadata = {
    source: params.source,
    scope: params.scope ?? null,
    session_id: params.sessionId ?? null,
    rows_before: params.rowsBefore,
    rows_deleted: params.rowsDeleted ?? null,
    ...(params.metadata ?? {}),
  }

  const courseId =
    params.courseId != null && params.courseId > 0 ? params.courseId : null
  const entityId = params.sessionId ?? courseId

  await sql`
    INSERT INTO audit_logs (
      actor_id,
      actor_type,
      action,
      entity_type,
      entity_id,
      course_id,
      metadata
    )
    VALUES (
      ${params.actorId ?? null},
      ${params.actorType ?? "system"},
      ${params.action ?? "playground_data_deleted"},
      ${"playground"},
      ${entityId},
      ${courseId},
      ${JSON.stringify(metadata)}::jsonb
    )
  `
}
