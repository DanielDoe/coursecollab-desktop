/**
 * Permission-aware student data accessors for Cora tools.
 * Tools should call these — not raw SQL — so scope stays with the session.
 */

import { sql } from "@/lib/db"
import type { CoraSession } from "@/lib/cora/security/types"
import { authorizeCoraTool } from "@/lib/cora/security/authorize-tool"

function formatEventDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function assertOwnStudent(session: CoraSession, studentDbId: number) {
  if (session.role !== "student" || session.userId !== studentDbId) {
    throw new Error("Denied (scope): own-student data only")
  }
}

export async function coraApiGetAttendance(session: CoraSession, studentDbId: number): Promise<string> {
  const auth = authorizeCoraTool(session, "get_attendance", { targetStudentId: studentDbId })
  if (!auth.ok) return `Denied (${auth.code}): ${auth.reason}`
  assertOwnStudent(session, studentDbId)

  const rows = (await sql`
    SELECT ar.status, ar.points_earned, asess.class_title, asess.start_time
    FROM attendance_records ar
    INNER JOIN attendance_sessions asess ON ar.session_id = asess.id
    WHERE ar.student_id = ${studentDbId}
      AND asess.start_time <= NOW()
      AND ar.deleted_at IS NULL
    ORDER BY asess.start_time DESC
    LIMIT 40
  `) as {
    status: string | null
    points_earned: number | null
    class_title: string | null
    start_time: string | null
  }[]

  if (!rows.length) return "No attendance records on file."
  const present = rows.filter((r) => r.status === "present" || r.status === "late").length
  return [
    `**Attendance summary:** ${present}/${rows.length} present/late in recent sessions`,
    "",
    ...rows.slice(0, 25).map((r) => {
      const when = r.start_time ? formatEventDate(r.start_time) : "—"
      const pts = r.points_earned != null ? ` · ${Number(r.points_earned).toFixed(1)} pts` : ""
      return `- ${when}: ${r.class_title?.trim() || "Class"} — ${r.status ?? "unknown"}${pts}`
    }),
  ].join("\n")
}

export async function coraApiGetClassroomPoints(session: CoraSession, studentDbId: number): Promise<string> {
  const auth = authorizeCoraTool(session, "get_classroom_points", { targetStudentId: studentDbId })
  if (!auth.ok) return `Denied (${auth.code}): ${auth.reason}`
  assertOwnStudent(session, studentDbId)

  const rows = (await sql`
    SELECT points, reason, category, status, COALESCE(awarded_at, created_at) AS awarded_at
    FROM classroom_points
    WHERE student_id = ${studentDbId}
    ORDER BY COALESCE(awarded_at, created_at) DESC NULLS LAST
    LIMIT 40
  `) as {
    points: number | null
    reason: string | null
    category: string | null
    status: string | null
    awarded_at: string | null
  }[]

  if (!rows.length) return "No classroom points entries on file."
  const approvedTotal = rows
    .filter((r) => !r.status || r.status === "approved")
    .reduce((sum, r) => sum + (Number(r.points) || 0), 0)
  return [
    `**Classroom points:** ${approvedTotal.toFixed(1)} approved pts across ${rows.length} recent entries`,
    "",
    ...rows.slice(0, 25).map((r) => {
      const when = r.awarded_at ? formatEventDate(r.awarded_at) : "—"
      const pts = r.points != null ? `${Number(r.points).toFixed(1)} pts` : "—"
      return `- ${when}: ${r.reason?.trim() || r.category || "Entry"} — ${pts}${r.status ? ` [${r.status}]` : ""}`
    }),
  ].join("\n")
}

export async function coraApiGetNotifications(
  session: CoraSession,
  studentDbId: number,
  unreadOnly = false,
): Promise<string> {
  const auth = authorizeCoraTool(session, "get_notifications", { targetStudentId: studentDbId })
  if (!auth.ok) return `Denied (${auth.code}): ${auth.reason}`
  assertOwnStudent(session, studentDbId)

  const rows = (await sql`
    SELECT id, type, title, message, is_read, created_at
    FROM notifications
    WHERE student_id = ${studentDbId}
    ORDER BY created_at DESC
    LIMIT 25
  `) as { id: number; title: string; message: string; is_read: boolean; created_at: string }[]

  const filtered = unreadOnly ? rows.filter((r) => !r.is_read) : rows
  if (!filtered.length) return unreadOnly ? "No unread notifications." : "No notifications on record."
  return filtered
    .map(
      (n) =>
        `- [${n.is_read ? "read" : "UNREAD"}] ${n.title}${n.message ? `: ${n.message.slice(0, 120)}` : ""} (${formatEventDate(n.created_at)})`,
    )
    .join("\n")
}

/** Released / published lecture RAG only — never expose unpublished instructor material. */
export async function coraApiSearchReleasedLectureMaterials(
  session: CoraSession,
  query: string,
): Promise<string> {
  const auth = authorizeCoraTool(session, "search_lecture_materials", {
    targetCourseId: session.courseIds[0] ?? null,
  })
  if (!auth.ok) return `Denied (${auth.code}): ${auth.reason}`
  if (!query.trim()) return "Error: query is required."

  const { generateEmbedding, formatVectorForPg } = await import("@/lib/embeddings")
  try {
    const embedding = await generateEmbedding(query)
    const vectorString = formatVectorForPg(embedding)

    const courseId = session.courseIds[0] ?? null
    let docs: Record<string, unknown>[] = []
    try {
      if (courseId != null) {
        const { searchReleasedLectureEmbeddings } = await import(
          "@/lib/cora/apis/released-lecture-embeddings"
        )
        docs = (await searchReleasedLectureEmbeddings({
          courseId,
          vectorString,
          limit: 5,
        })) as unknown as Record<string, unknown>[]
      }
    } catch {
      docs = []
    }

    const relevant = docs.filter((d) => Number(d.similarity) > 0.65)
    if (!relevant.length) {
      return `No released lecture materials found for "${query}". Answer from general course knowledge if needed — do not invent unpublished content.`
    }
    // Never expose raw embedding metadata as "sources to the user" beyond lecture labels
    return relevant
      .map((d) => {
        const src = `${d.source ?? "Lecture"}${d.week_number != null ? ` Week ${d.week_number}` : ""}${d.page_number != null ? ` p.${d.page_number}` : ""}`
        return `[Released material · ${src}]\n${String(d.content ?? "").slice(0, 800)}`
      })
      .join("\n\n---\n\n")
  } catch (err) {
    console.warn("[cora/api] lecture RAG failed:", err)
    return "Lecture search unavailable right now."
  }
}
