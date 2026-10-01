import { sql } from "@/lib/db"
import {
  sessionInInstructorOfferingSql,
  studentInInstructorSessionScopeSql,
} from "@/lib/instructor-session-scope"

export type LiveActivityActor = "student" | "instructor" | "system"

export type LiveActivityInput = {
  courseId?: number | null
  assignmentId?: number | null
  liveSessionId?: number | null
  studentId?: number | null
  actor: LiveActivityActor
  eventType: string
  ok?: boolean | null
  httpStatus?: number | null
  message?: string | null
  codeExcerpt?: string | null
  codeChars?: number | null
  rosterStatus?: string | null
  detail?: Record<string, unknown> | null
  /** Skip the insert when the same event was stored this recently. */
  dedupeSeconds?: number
  /** Dedupe even when codeChars differs (keystroke saves change it on every write). */
  dedupeIgnoresCodeChars?: boolean
}

export type LiveActivityRow = {
  id: number
  createdAt: string
  courseId: number | null
  assignmentId: number | null
  liveSessionId: number | null
  studentId: number | null
  studentName: string | null
  actor: string
  eventType: string
  ok: boolean | null
  httpStatus: number | null
  message: string | null
  codeExcerpt: string | null
  codeChars: number | null
  rosterStatus: string | null
  detail: Record<string, unknown> | null
}

let schemaReady: Promise<void> | null = null

export function excerptCode(code: string | null | undefined, limit = 280): string | null {
  const trimmed = code?.replace(/\s+$/g, "") ?? ""
  if (!trimmed) return null
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed
}

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS codebench_live_activity_log (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        course_id INTEGER,
        assignment_id INTEGER,
        live_session_id INTEGER,
        student_id INTEGER,
        actor TEXT NOT NULL,
        event_type TEXT NOT NULL,
        ok BOOLEAN,
        http_status INTEGER,
        message TEXT,
        code_excerpt TEXT,
        code_chars INTEGER,
        roster_status TEXT
      )
    `
      .then(() =>
        sql`
          CREATE INDEX IF NOT EXISTS codebench_live_activity_log_course_created_idx
            ON codebench_live_activity_log (course_id, created_at DESC)
        `,
      )
      .then(() =>
        sql`
          ALTER TABLE codebench_live_activity_log
          ADD COLUMN IF NOT EXISTS detail JSONB
        `,
      )
      .then(() =>
        sql`
          CREATE INDEX IF NOT EXISTS codebench_live_activity_log_denied_idx
            ON codebench_live_activity_log (assignment_id, created_at DESC)
            WHERE event_type = 'snapshot_denied'
        `,
      )
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null
        throw error
      })
  }
  return schemaReady
}

/**
 * Best-effort debug trail for live classroom joins, snapshot saves, and roster
 * visibility. Failures here must not break the classroom itself.
 */
/** In-process first pass so hot paths (keystroke snapshots, roster polls) skip the dedupe SELECT. */
const recentWrites = new Map<string, number>()
const RECENT_WRITES_MAX = 5000

function throttledLocally(key: string, seconds: number): boolean {
  const now = Date.now()
  const last = recentWrites.get(key)
  if (last != null && now - last < seconds * 1000) return true
  if (recentWrites.size >= RECENT_WRITES_MAX) recentWrites.clear()
  recentWrites.set(key, now)
  return false
}

export async function recordLiveActivity(input: LiveActivityInput): Promise<void> {
  try {
    const dedupeSeconds = input.dedupeSeconds ?? 0
    const dedupeCodeChars = input.dedupeIgnoresCodeChars ? null : (input.codeChars ?? null)
    if (
      dedupeSeconds > 0 &&
      throttledLocally(
        `${input.eventType}|${input.studentId ?? ""}|${input.assignmentId ?? ""}|${dedupeCodeChars ?? ""}`,
        dedupeSeconds,
      )
    ) {
      return
    }
    await ensureSchema()
    if (dedupeSeconds > 0) {
      const existing = await sql`
        SELECT id
        FROM codebench_live_activity_log
        WHERE event_type = ${input.eventType}
          AND student_id IS NOT DISTINCT FROM ${input.studentId ?? null}
          AND assignment_id IS NOT DISTINCT FROM ${input.assignmentId ?? null}
          AND created_at > NOW() - (${dedupeSeconds} * INTERVAL '1 second')
          AND (
            ${dedupeCodeChars}::int IS NULL
            OR code_chars IS NOT DISTINCT FROM ${dedupeCodeChars}
          )
        LIMIT 1
      `
      if (existing.length > 0) return
    }
    await sql`
      INSERT INTO codebench_live_activity_log (
        course_id, assignment_id, live_session_id, student_id, actor, event_type,
        ok, http_status, message, code_excerpt, code_chars, roster_status, detail
      ) VALUES (
        ${input.courseId ?? null},
        ${input.assignmentId ?? null},
        ${input.liveSessionId ?? null},
        ${input.studentId ?? null},
        ${input.actor},
        ${input.eventType},
        ${input.ok ?? null},
        ${input.httpStatus ?? null},
        ${input.message ?? null},
        ${input.codeExcerpt ?? null},
        ${input.codeChars ?? null},
        ${input.rosterStatus ?? null},
        ${input.detail ? JSON.stringify(input.detail) : null}::jsonb
      )
    `
  } catch (error) {
    console.error("[codebench live-activity]", error)
  }
}

export async function recordRosterSample(input: {
  courseId: number
  assignmentId: number
  liveSessionId: number
  students: Array<{ studentId: number; status: string; codeChars: number | null }>
}): Promise<void> {
  try {
    if (input.students.length === 0) return
    if (throttledLocally(`roster_status|${input.liveSessionId}`, 30)) return
    await ensureSchema()
    const recent = await sql`
      SELECT 1
      FROM codebench_live_activity_log
      WHERE event_type = 'roster_status'
        AND live_session_id = ${input.liveSessionId}
        AND created_at > NOW() - INTERVAL '30 seconds'
      LIMIT 1
    `
    if (recent.length > 0) return
    const payload = JSON.stringify(
      input.students.map((student) => ({
        student_id: student.studentId,
        status: student.status,
        ok: true,
        message:
          student.status === "not_started"
            ? "On the roster as Not started — no snapshot or studio event since this session opened"
            : "Shown on the instructor roster",
        code_chars: student.codeChars,
        detail: {
          source: "instructor_roster_poll",
          instructorSeesStudent: true,
          rosterStatus: student.status,
          studentCodeChars: student.codeChars,
          httpStatus: null,
        },
      })),
    )
    await sql`
      INSERT INTO codebench_live_activity_log (
        course_id, assignment_id, live_session_id, student_id, actor, event_type,
        ok, message, code_chars, roster_status, detail
      )
      SELECT
        ${input.courseId},
        ${input.assignmentId},
        ${input.liveSessionId},
        x.student_id,
        'system',
        'roster_status',
        x.ok,
        x.message,
        x.code_chars,
        x.status,
        x.detail
      FROM jsonb_to_recordset(${payload}::jsonb) AS x(
        student_id int,
        status text,
        ok boolean,
        message text,
        code_chars int,
        detail jsonb
      )
    `
  } catch (error) {
    console.error("[codebench live-activity roster]", error)
  }
}

export async function listLiveActivity(
  courseId: number,
  limit = 200,
  scope?: { sessionId?: number | null; academicTermId?: number | null },
): Promise<LiveActivityRow[]> {
  await ensureSchema()
  const capped = Math.min(Math.max(limit, 1), 400)
  const studentScope = studentInInstructorSessionScopeSql({
    courseId,
    sessionId: scope?.sessionId,
    academicTermId: scope?.sessionId != null ? null : scope?.academicTermId,
    studentAlias: "s",
  })
  const assignmentScope = sessionInInstructorOfferingSql({
    courseId,
    sessionId: scope?.sessionId,
    academicTermId: scope?.sessionId != null ? null : scope?.academicTermId,
    sessionAlias: "asg",
  })
  const rows = await sql`
    SELECT l.id, l.created_at, l.course_id, l.assignment_id, l.live_session_id,
           l.student_id, l.actor, l.event_type, l.ok, l.http_status, l.message,
           l.code_excerpt, l.code_chars, l.roster_status, l.detail,
           COALESCE(NULLIF(TRIM(s.full_name), ''), s.student_id) AS student_name
    FROM codebench_live_activity_log l
    LEFT JOIN students s ON s.id = l.student_id
    WHERE l.course_id = ${courseId}
      AND (
        (
          l.student_id IS NOT NULL
          AND ${sql.unsafe(studentScope)}
        )
        OR (
          l.student_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM classroom_point_submissions cps
            JOIN sessions asg
              ON asg.course_id = ${courseId}
             AND TRIM(asg.code) = TRIM(cps.session)
            WHERE cps.id = l.assignment_id
              AND ${sql.unsafe(assignmentScope)}
          )
        )
      )
    ORDER BY l.created_at DESC
    LIMIT ${capped}
  `
  return rows.map((row: any) => ({
    id: Number(row.id),
    createdAt: new Date(row.created_at as string).toISOString(),
    courseId: row.course_id == null ? null : Number(row.course_id),
    assignmentId: row.assignment_id == null ? null : Number(row.assignment_id),
    liveSessionId: row.live_session_id == null ? null : Number(row.live_session_id),
    studentId: row.student_id == null ? null : Number(row.student_id),
    studentName: row.student_name == null ? null : String(row.student_name),
    actor: String(row.actor),
    eventType: String(row.event_type),
    ok: row.ok == null ? null : Boolean(row.ok),
    httpStatus: row.http_status == null ? null : Number(row.http_status),
    message: row.message == null ? null : String(row.message),
    codeExcerpt: row.code_excerpt == null ? null : String(row.code_excerpt),
    codeChars: row.code_chars == null ? null : Number(row.code_chars),
    rosterStatus: row.roster_status == null ? null : String(row.roster_status),
    detail: normalizeActivityDetail(row.detail),
  }))
}

export type BlockedLiveJoin = {
  studentDbId: number
  studentId: string | null
  fullName: string
  section: string | null
  message: string
  at: string
}

const BLOCKED_JOINS_CACHE_MS = 5_000
const blockedJoinsCache = new Map<string, { at: number; rows: BlockedLiveJoin[] }>()

/**
 * Students the server refused (403: section or course mismatch) for this assignment since
 * `sinceIso`. They have no snapshot row, so the roster can't show them otherwise.
 */
export async function listBlockedLiveJoins(assignmentId: number, sinceIso: string): Promise<BlockedLiveJoin[]> {
  const key = `${assignmentId}|${sinceIso}`
  const hit = blockedJoinsCache.get(key)
  if (hit && Date.now() - hit.at < BLOCKED_JOINS_CACHE_MS) return hit.rows
  try {
    await ensureSchema()
    const rows = await sql`
      SELECT DISTINCT ON (l.student_id)
        l.student_id,
        s.student_id AS student_code,
        COALESCE(NULLIF(TRIM(s.full_name), ''), s.student_id, 'Student') AS full_name,
        COALESCE(NULLIF(TRIM(s.section), ''), NULLIF(TRIM(sess.code), '')) AS section,
        l.message,
        l.created_at
      FROM codebench_live_activity_log l
      JOIN students s ON s.id = l.student_id
      LEFT JOIN sessions sess ON sess.id = s.session_id
      WHERE l.event_type = 'snapshot_denied'
        AND l.assignment_id = ${assignmentId}
        AND l.http_status = 403
        AND l.created_at >= ${sinceIso}::timestamptz
      ORDER BY l.student_id, l.created_at DESC
      LIMIT 100
    `
    const result = rows.map((row: any) => ({
      studentDbId: Number(row.student_id),
      studentId: row.student_code == null ? null : String(row.student_code),
      fullName: String(row.full_name),
      section: row.section == null ? null : String(row.section),
      message: row.message == null ? "Join was refused." : String(row.message),
      at: new Date(row.created_at as string).toISOString(),
    }))
    if (blockedJoinsCache.size >= 500) blockedJoinsCache.clear()
    blockedJoinsCache.set(key, { at: Date.now(), rows: result })
    return result
  } catch (error) {
    console.error("[codebench live activity] blocked joins", error)
    return []
  }
}

function normalizeActivityDetail(value: unknown): Record<string, unknown> | null {
  if (value == null) return null
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  return null
}
