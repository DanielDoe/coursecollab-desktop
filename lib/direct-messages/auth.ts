import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundStudentCaller, requireCallerStudentDbId } from "@/lib/student-api-auth"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"
import type { MessageActor } from "@/lib/direct-messages/types"

export async function resolveMessageActor(request: NextRequest): Promise<MessageActor | null> {
  const studentHeader = request.headers.get("x-student-id")?.trim()
  if (studentHeader) {
    const bound = await requireBoundStudentCaller(request, studentHeader)
    if (!bound.ok) return null
    return { kind: "student", id: bound.studentDbId }
  }

  const instructorHeader = request.headers.get("x-instructor-id")?.trim()
  if (instructorHeader) {
    const session = await requireInstructorSession(request)
    if (!session.ok) return null
    const actor = await loadInstructorActor(session.instructorId)
    if (actor && actor.is_active) return { kind: "instructor", id: session.instructorId }
    return null
  }

  const studentSession = await requireCallerStudentDbId(request)
  if (studentSession.ok) return { kind: "student", id: studentSession.studentDbId }

  const instructorSession = await requireInstructorSession(request)
  if (instructorSession.ok) {
    const actor = await loadInstructorActor(instructorSession.instructorId)
    if (actor && actor.is_active) return { kind: "instructor", id: instructorSession.instructorId }
  }

  return null
}

export function participantKey(kind: MessageActor["kind"], id: number): string {
  return `${kind}:${id}`
}

export function buildPairKey(a: MessageActor, b: MessageActor): string {
  return [participantKey(a.kind, a.id), participantKey(b.kind, b.id)].sort().join("|")
}

export async function actorDisplayName(actor: MessageActor): Promise<string> {
  if (actor.kind === "student") {
    const rows = (await sql`
      SELECT full_name, student_id FROM students WHERE id = ${actor.id} LIMIT 1
    `) as Array<{ full_name: string | null; student_id: string | null }>
    if (rows.length === 0) return "Student"
    const row = rows[0]
    return row.full_name?.trim() || row.student_id || "Student"
  }

  const rows = (await sql`
    SELECT name, username FROM instructors WHERE id = ${actor.id} LIMIT 1
  `) as Array<{ name: string | null; username: string | null }>
  if (rows.length === 0) return "Instructor"
  const row = rows[0]
  return row.name?.trim() || row.username || "Instructor"
}

export async function actorEmail(actor: MessageActor): Promise<string | null> {
  if (actor.kind === "student") {
    const rows = (await sql`
      SELECT email FROM students WHERE id = ${actor.id} LIMIT 1
    `) as Array<{ email?: string | null }>
    return rows[0]?.email?.trim() || null
  }

  const rows = (await sql`
    SELECT email FROM instructors WHERE id = ${actor.id} LIMIT 1
  `) as Array<{ email?: string | null }>
  return rows[0]?.email?.trim() || null
}
