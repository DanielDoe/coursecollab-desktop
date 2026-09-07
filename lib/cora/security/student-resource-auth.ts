/**
 * Student resource authorization — delegates to CourseCollab ownership helpers.
 * Cora does not invent parallel privileges; it acts as the authenticated student.
 */

import { sql } from "@/lib/db"
import {
  fetchFlashcardDeckById,
  studentCanEditDeck,
  type FlashcardDeckRow,
} from "@/lib/flashcards"
import type { CoraSession } from "@/lib/cora/security/types"

export type StudentResourceAuthResult =
  | { ok: true }
  | { ok: false; reason: string }

function assertStudentSession(session: CoraSession): StudentResourceAuthResult {
  if (session.role !== "student") {
    return { ok: false, reason: "Student resource access requires a student session." }
  }
  return { ok: true }
}

export async function authorizeOwnFlashcardDeck(
  session: CoraSession,
  deckId: number,
): Promise<StudentResourceAuthResult & { deck?: FlashcardDeckRow }> {
  const gate = assertStudentSession(session)
  if (!gate.ok) return gate

  const studentDbId = session.claims.studentDbId ?? session.userId
  const deck = await fetchFlashcardDeckById(deckId)
  if (!deck) return { ok: false, reason: "Flashcard deck not found." }
  if (!studentCanEditDeck(deck, studentDbId)) {
    return { ok: false, reason: "You can only modify your personal flashcard decks." }
  }
  return { ok: true, deck }
}

export async function authorizeOwnDigitalNote(
  session: CoraSession,
  noteId: number,
): Promise<StudentResourceAuthResult> {
  const gate = assertStudentSession(session)
  if (!gate.ok) return gate

  const studentDbId = session.claims.studentDbId ?? session.userId
  const rows = (await sql`
    SELECT id FROM student_digital_notes
    WHERE id = ${noteId} AND student_id = ${studentDbId}
    LIMIT 1
  `) as { id: number }[]
  if (!rows.length) {
    return { ok: false, reason: "You can only modify your own notes." }
  }
  return { ok: true }
}

export async function authorizeOwnCalendarEvent(
  session: CoraSession,
  eventId: number,
): Promise<StudentResourceAuthResult> {
  const gate = assertStudentSession(session)
  if (!gate.ok) return gate

  const studentDbId = session.claims.studentDbId ?? session.userId
  const rows = (await sql`
    SELECT id, event_type FROM calendar_events
    WHERE id = ${eventId} AND student_id = ${studentDbId}
    LIMIT 1
  `) as { id: number; event_type?: string }[]
  if (!rows.length) {
    return { ok: false, reason: "You can only modify your own calendar events." }
  }
  const eventType = String(rows[0]?.event_type ?? "").toLowerCase()
  // Block mutating official course-synced types if present
  if (eventType === "class" || eventType === "exam" || eventType === "official") {
    return { ok: false, reason: "Official course events cannot be modified by Cora." }
  }
  return { ok: true }
}

/** Create path — student may create personal study events for themselves only. */
export function authorizeCreatePersonalCalendar(
  session: CoraSession,
  targetStudentId: number,
): StudentResourceAuthResult {
  const gate = assertStudentSession(session)
  if (!gate.ok) return gate
  const studentDbId = session.claims.studentDbId ?? session.userId
  if (Number(targetStudentId) !== Number(studentDbId)) {
    return { ok: false, reason: "Cannot create calendar events for another student." }
  }
  return { ok: true }
}
