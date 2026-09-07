import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { expandSessionKeysForGradeLookup, normalizeSessionForStorage } from "@/lib/session-catalog"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export type StudentTradeAccessResult =
  | { ok: true; studentId: number; normalizedSession: string }
  | { ok: false; error: string; status: number }

export async function resolveStudentIdFromBody(
  raw: unknown,
): Promise<{ ok: true; studentId: number } | { ok: false; error: string; status: number }> {
  const trimmed = String(raw ?? "").trim()
  if (!trimmed) {
    return { ok: false, error: "Student id required", status: 401 }
  }
  const studentId = await resolveStudentDatabaseIdFromParam(trimmed)
  if (studentId == null) {
    return { ok: false, error: "Student not found", status: 404 }
  }
  return { ok: true, studentId }
}

/** Resolve Trade Center storage session — prefer the student's course section over ALL. */
export async function resolveTradeSessionForStudent(
  session: string,
  studentId: number,
): Promise<string> {
  const raw = String(session ?? "").trim()

  const rows = await sql`
    SELECT s.section, sess.code AS session_code
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${studentId}
    LIMIT 1
  `
  const studentSection =
    rows.length > 0
      ? String((rows[0] as { section: string | null; session_code: string | null }).session_code ??
          (rows[0] as { section: string | null }).section ??
          "").trim()
      : ""

  if (studentSection && (!raw || raw === "ALL" || raw === studentSection)) {
    return studentSection
  }

  const normalized = await normalizeSessionForStorage(raw)
  if (normalized !== "ALL") return normalized
  if (studentSection) return studentSection
  return "ALL"
}

/** Ensure student belongs to the given section code (after normalization). */
export async function verifyStudentInSession(
  studentId: number,
  session: string,
): Promise<{ ok: true; normalizedSession: string } | { ok: false; error: string; status: number }> {
  const normalizedSession = await resolveTradeSessionForStudent(session, studentId)
  const rows = await sql`
    SELECT s.id, s.section, sess.code AS session_code
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${studentId}
    LIMIT 1
  `
  if (rows.length === 0) {
    return { ok: false, error: "Student not found", status: 404 }
  }
  const row = rows[0] as { section: string | null; session_code: string | null }
  const studentSection = String(row.session_code ?? row.section ?? "").trim()
  if (
    normalizedSession !== "ALL" &&
    studentSection &&
    studentSection !== normalizedSession
  ) {
    return { ok: false, error: "Session mismatch for this student", status: 403 }
  }
  return { ok: true, normalizedSession }
}

/** Resolve student id and verify session in one step for Trade Center APIs. */
export async function requireStudentTradeAccess(
  rawStudentId: unknown,
  session: string,
): Promise<StudentTradeAccessResult> {
  const resolved = await resolveStudentIdFromBody(rawStudentId)
  if (!resolved.ok) return resolved
  const sessionCheck = await verifyStudentInSession(resolved.studentId, session)
  if (!sessionCheck.ok) return sessionCheck
  return {
    ok: true,
    studentId: resolved.studentId,
    normalizedSession: sessionCheck.normalizedSession,
  }
}

/** GET routes: resolve student id + session from query params. */
export async function requireStudentTradeAccessFromQuery(
  studentIdParam: string | null,
  sessionParam: string | null,
): Promise<StudentTradeAccessResult> {
  if (!studentIdParam?.trim()) {
    return { ok: false, error: "Student id required", status: 401 }
  }
  if (!sessionParam?.trim()) {
    return { ok: false, error: "Session required", status: 400 }
  }
  return requireStudentTradeAccess(studentIdParam, sessionParam)
}

function boundCallerFailure(
  status: number,
): { ok: false; error: string; status: number } {
  return {
    ok: false,
    error: status === 403 ? "Access denied" : "Student authentication required",
    status,
  }
}

/**
 * Session-bound student identity. `x-student-id` is never enough on its own.
 * no session → 401; claimed mismatch → 403; matching claim uses session id.
 */
export async function requireAuthenticatedStudentFromRequest(
  request: NextRequest,
  claimedStudentId?: unknown,
): Promise<{ ok: true; studentId: number } | { ok: false; error: string; status: number }> {
  const claimed =
    claimedStudentId != null && String(claimedStudentId).trim() !== ""
      ? String(claimedStudentId)
      : request.headers.get("x-student-id")
  const bound = await requireBoundStudentCaller(request, claimed)
  if (!bound.ok) {
    return boundCallerFailure(bound.response.status)
  }
  return { ok: true, studentId: bound.studentDbId }
}

/** Student Trade Center reads/writes: session-bound caller, then section membership. */
export async function requireAuthenticatedStudentTradeAccess(
  request: NextRequest,
  claimedStudentId: unknown,
  session: string,
): Promise<StudentTradeAccessResult> {
  const caller = await requireAuthenticatedStudentFromRequest(request, claimedStudentId)
  if (!caller.ok) return caller
  const sessionCheck = await verifyStudentInSession(caller.studentId, session)
  if (!sessionCheck.ok) return sessionCheck
  return {
    ok: true,
    studentId: caller.studentId,
    normalizedSession: sessionCheck.normalizedSession,
  }
}

export type TradeCenterPeerRow = {
  id: number
  full_name: string
  student_id: string
  section: string
}

/** Classmates for peer donate/request — matches legacy + canonical section codes and session_id. */
export async function fetchTradeCenterPeers(
  sessionFragment: string,
  excludeStudentId?: number,
): Promise<TradeCenterPeerRow[]> {
  const variants = normalizedSectionVariantsForSql(sessionFragment)
  if (variants.length === 0) return []

  const rows =
    excludeStudentId != null
      ? await sql`
          SELECT s.id, s.full_name, s.student_id, COALESCE(sess.code, s.section, '') AS section
          FROM students s
          LEFT JOIN sessions sess ON sess.id = s.session_id
          WHERE s.id != ${excludeStudentId}
            AND (
              TRIM(s.section) = ANY(${variants})
              OR TRIM(sess.code) = ANY(${variants})
            )
          ORDER BY s.full_name ASC
        `
      : await sql`
          SELECT s.id, s.full_name, s.student_id, COALESCE(sess.code, s.section, '') AS section
          FROM students s
          LEFT JOIN sessions sess ON sess.id = s.session_id
          WHERE TRIM(s.section) = ANY(${variants})
             OR TRIM(sess.code) = ANY(${variants})
          ORDER BY s.full_name ASC
        `

  return (rows || []) as TradeCenterPeerRow[]
}

/** True when student belongs to the same section cluster as sessionFragment (aliases + session_id). */
export async function studentMatchesSessionFragment(
  studentId: number,
  sessionFragment: string,
): Promise<boolean> {
  const variants = normalizedSectionVariantsForSql(sessionFragment)
  if (variants.length === 0) return false
  const rows = await sql`
    SELECT 1
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${studentId}
      AND (
        TRIM(s.section) = ANY(${variants})
        OR TRIM(sess.code) = ANY(${variants})
      )
    LIMIT 1
  `
  return rows.length > 0
}

/** Session keys used when summing classroom_points (handles ECE2202 / legacy aliases). */
export async function classroomPointsSessionKeys(sessionFragment: string): Promise<string[]> {
  const expanded = await expandSessionKeysForGradeLookup(sessionFragment)
  const raw = String(sessionFragment ?? "").trim()
  const keys = new Set<string>(expanded)
  if (raw) keys.add(raw)
  const normalized = await normalizeSessionForStorage(raw)
  if (normalized && normalized !== "ALL") keys.add(normalized)
  return [...keys]
}

/** Pick the session key classroom_points rows use for this student (avoids split balances). */
export async function resolveClassroomPointsStorageSession(
  studentId: number,
  sessionFragment: string,
): Promise<string> {
  const keys = await classroomPointsSessionKeys(sessionFragment)
  if (keys.length > 0) {
    const existing = await sql`
      SELECT session
      FROM classroom_points
      WHERE student_id = ${studentId}
        AND session = ANY(${keys})
      GROUP BY session
      ORDER BY COUNT(*) DESC, SUM(ABS(points)) DESC
      LIMIT 1
    `
    if (existing.length > 0) {
      return String((existing[0] as { session: string }).session)
    }
    const normalized = await normalizeSessionForStorage(sessionFragment)
    if (normalized && normalized !== "ALL" && keys.includes(normalized)) {
      return normalized
    }
    return keys[0]!
  }

  const rows = await sql`
    SELECT COALESCE(sess.code, s.section, '') AS code
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${studentId}
    LIMIT 1
  `
  const code = String((rows[0] as { code?: string })?.code ?? "").trim()
  return code || String(sessionFragment ?? "").trim() || "ALL"
}
