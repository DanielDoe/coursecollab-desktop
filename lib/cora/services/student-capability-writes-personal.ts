/**
 * Student personal write capability confirm handlers — calendar, notes, flashcards,
 * messages, office-hours cancel, and notification preferences.
 */

import { sql } from "@/lib/db"
import { sendDirectMessage, getThreadForActor } from "@/lib/direct-messages/service"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import {
  ensureFlashcardSchema,
  fetchFlashcardDeckById,
  normalizeFlashcardDifficulty,
  refreshFlashcardDeckCount,
  studentCanEditDeck,
} from "@/lib/flashcards"
import {
  registerCapabilityHandlers,
  type CapabilityExecutionContext,
  type CapabilityHandlerResult,
} from "@/lib/cora/services/capability-handler-registry"

function studentId(ctx: CapabilityExecutionContext): number {
  const id = ctx.studentDbId
  if (!id || !Number.isFinite(id)) throw new Error("Student context required.")
  return id
}

function positiveInt(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.trunc(n)
}

function notFound(message: string): CapabilityHandlerResult {
  return { success: false, message }
}

const NOTIFICATION_PREFERENCE_FIELDS = [
  "quiz_reminders",
  "practice_updates",
  "ai_tutor_alerts",
  "codebench_results",
  "deadline_alerts",
  "group_messages",
  "project_updates",
  "homework_alerts",
  "exam_alerts",
  "lecture_updates",
  "announcement_alerts",
  "forum_replies",
] as const

type NotificationPreferenceField = (typeof NOTIFICATION_PREFERENCE_FIELDS)[number]

async function ensureNotificationPreferenceColumns() {
  await sql`
    ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS announcement_alerts BOOLEAN NOT NULL DEFAULT true
  `
}

async function handleCalendarUpdate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const eventId = positiveInt(ctx.args.eventId ?? ctx.args.id)
  if (!eventId) return notFound("Valid eventId is required.")

  const existingRows = (await sql`
    SELECT id, title, description, start_time, end_time
    FROM calendar_events
    WHERE id = ${eventId} AND student_id = ${studentDbId}
    LIMIT 1
  `) as Array<{
    id: number
    title: string
    description: string | null
    start_time: string
    end_time: string | null
  }>

  const existing = existingRows[0]
  if (!existing) {
    return notFound("Calendar event not found or you do not own it.")
  }

  const title =
    ctx.args.title != null ? String(ctx.args.title).trim() || existing.title : existing.title
  const description =
    ctx.args.description !== undefined
      ? ctx.args.description != null
        ? String(ctx.args.description)
        : null
      : existing.description
  const startTime =
    ctx.args.startTime != null ? String(ctx.args.startTime).trim() || existing.start_time : existing.start_time
  const endTime =
    ctx.args.endTime !== undefined
      ? ctx.args.endTime != null
        ? String(ctx.args.endTime).trim()
        : null
      : existing.end_time

  const updated = (await sql`
    UPDATE calendar_events
    SET
      title = ${title},
      description = ${description},
      start_time = ${startTime}::timestamp,
      end_time = ${endTime != null ? endTime : null}::timestamp,
      updated_at = NOW()
    WHERE id = ${eventId} AND student_id = ${studentDbId}
    RETURNING id, title
  `) as Array<{ id: number; title: string }>

  if (!updated.length) {
    return notFound("Calendar event not found or you do not own it.")
  }

  return {
    success: true,
    message: `Updated calendar event "${updated[0]!.title}".`,
    entity: {
      type: "calendar_event",
      id: updated[0]!.id,
      title: updated[0]!.title,
      route: "/module/calendar",
    },
  }
}

async function handleCalendarDelete(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const eventId = positiveInt(ctx.args.eventId ?? ctx.args.id)
  if (!eventId) return notFound("Valid eventId is required.")

  const deleted = (await sql`
    DELETE FROM calendar_events
    WHERE id = ${eventId} AND student_id = ${studentDbId}
    RETURNING id, title
  `) as Array<{ id: number; title: string }>

  if (!deleted.length) {
    return notFound("Calendar event not found or you do not own it.")
  }

  return {
    success: true,
    message: `Deleted calendar event "${deleted[0]!.title}".`,
    entity: {
      type: "calendar_event",
      id: deleted[0]!.id,
      title: deleted[0]!.title,
      route: "/module/calendar",
    },
  }
}

async function handleNotesUpdate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const noteId = positiveInt(ctx.args.noteId ?? ctx.args.id)
  if (!noteId) return notFound("Valid noteId is required.")

  const existingRows = (await sql`
    SELECT id, title, body_text
    FROM student_digital_notes
    WHERE id = ${noteId} AND student_id = ${studentDbId}
    LIMIT 1
  `) as Array<{ id: number; title: string; body_text: string }>

  const existing = existingRows[0]
  if (!existing) {
    return notFound("Note not found or you do not own it.")
  }

  const title =
    ctx.args.title != null ? String(ctx.args.title).trim() || "Untitled note" : existing.title
  const bodyText =
    ctx.args.bodyText != null || ctx.args.content != null
      ? String(ctx.args.bodyText ?? ctx.args.content ?? "")
      : existing.body_text

  const updated = (await sql`
    UPDATE student_digital_notes
    SET title = ${title}, body_text = ${bodyText}, updated_at = NOW()
    WHERE id = ${noteId} AND student_id = ${studentDbId}
    RETURNING id, title
  `) as Array<{ id: number; title: string }>

  if (!updated.length) {
    return notFound("Note not found or you do not own it.")
  }

  return {
    success: true,
    message: `Updated note "${updated[0]!.title}".`,
    entity: {
      type: "note",
      id: updated[0]!.id,
      title: updated[0]!.title,
      route: "/module/notes",
    },
  }
}

async function handleNotesDelete(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const noteId = positiveInt(ctx.args.noteId ?? ctx.args.id)
  if (!noteId) return notFound("Valid noteId is required.")

  const deleted = (await sql`
    DELETE FROM student_digital_notes
    WHERE id = ${noteId} AND student_id = ${studentDbId}
    RETURNING id, title
  `) as Array<{ id: number; title: string }>

  if (!deleted.length) {
    return notFound("Note not found or you do not own it.")
  }

  return {
    success: true,
    message: `Deleted note "${deleted[0]!.title}".`,
    entity: {
      type: "note",
      id: deleted[0]!.id,
      title: deleted[0]!.title,
      route: "/module/notes",
    },
  }
}

async function handleFlashcardsUpdate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const deckId = positiveInt(ctx.args.deckId ?? ctx.args.id)
  if (!deckId) return notFound("Valid deckId is required.")

  await ensureFlashcardSchema()

  const deck = await fetchFlashcardDeckById(deckId)
  if (!deck || !studentCanEditDeck(deck, studentDbId)) {
    return notFound("Flashcard deck not found or you do not own it.")
  }

  const title =
    ctx.args.title != null ? String(ctx.args.title).trim() || "Untitled deck" : deck.title
  const description =
    ctx.args.description != null ? String(ctx.args.description) : deck.description
  const topic =
    ctx.args.topic !== undefined
      ? ctx.args.topic != null
        ? String(ctx.args.topic).trim() || null
        : null
      : deck.topic

  const updated = (await sql`
    UPDATE flashcard_decks
    SET title = ${title}, description = ${description}, topic = ${topic}, updated_at = NOW()
    WHERE id = ${deckId} AND student_id = ${studentDbId}
    RETURNING id, title
  `) as Array<{ id: number; title: string }>

  if (!updated.length) {
    return notFound("Flashcard deck not found or you do not own it.")
  }

  if (Array.isArray(ctx.args.cards)) {
    await sql`DELETE FROM flashcard_cards WHERE deck_id = ${deckId}`
    const cards = (ctx.args.cards as { front?: string; back?: string; difficulty?: string }[])
      .filter((c) => c.front?.trim() && c.back?.trim())
      .slice(0, 40)

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]!
      const difficulty = normalizeFlashcardDifficulty(card.difficulty ?? "medium")
      await sql`
        INSERT INTO flashcard_cards (deck_id, front_text, back_text, sort_order, difficulty)
        VALUES (
          ${deckId},
          ${card.front!.trim()},
          ${card.back!.trim()},
          ${i},
          ${difficulty}
        )
      `
    }
    await refreshFlashcardDeckCount(deckId)
  }

  return {
    success: true,
    message: `Updated flashcard deck "${updated[0]!.title}".`,
    entity: {
      type: "flashcard_deck",
      id: updated[0]!.id,
      title: updated[0]!.title,
      route: "/module/flashcards",
    },
  }
}

async function handleFlashcardsDelete(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const deckId = positiveInt(ctx.args.deckId ?? ctx.args.id)
  if (!deckId) return notFound("Valid deckId is required.")

  await ensureFlashcardSchema()

  const deck = await fetchFlashcardDeckById(deckId)
  if (!deck || !studentCanEditDeck(deck, studentDbId)) {
    return notFound("Flashcard deck not found or you do not own it.")
  }

  const deleted = (await sql`
    DELETE FROM flashcard_decks
    WHERE id = ${deckId} AND student_id = ${studentDbId}
    RETURNING id, title
  `) as Array<{ id: number; title: string }>

  if (!deleted.length) {
    return notFound("Flashcard deck not found or you do not own it.")
  }

  return {
    success: true,
    message: `Deleted flashcard deck "${deleted[0]!.title}".`,
    entity: {
      type: "flashcard_deck",
      id: deleted[0]!.id,
      title: deleted[0]!.title,
      route: "/module/flashcards",
    },
  }
}

async function resolveCourseInstructorId(courseId: number): Promise<number | null> {
  const rows = (await sql`
    SELECT instructor_id
    FROM courses
    WHERE id = ${courseId} AND COALESCE(is_active, true) = true
    LIMIT 1
  `) as Array<{ instructor_id: number | null }>
  const instructorId = Number(rows[0]?.instructor_id)
  return Number.isFinite(instructorId) && instructorId > 0 ? instructorId : null
}

async function handleMessagesSend(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const body = String(ctx.args.body ?? ctx.args.content ?? "").trim()
  if (!body) throw new Error("Message body is required.")

  const subject =
    ctx.args.subject != null ? String(ctx.args.subject).trim() || null : null
  const sender = { kind: "student" as const, id: studentDbId }
  const threadId = positiveInt(ctx.args.threadId)

  if (threadId != null) {
    const thread = await getThreadForActor(threadId, sender)
    if (!thread) {
      return notFound("Message thread not found or you are not a participant.")
    }
    if (thread.otherParticipant.kind !== "instructor") {
      return notFound("Students can only message instructors through this capability.")
    }

    const result = await sendDirectMessage({
      sender,
      recipientKind: "instructor",
      recipientId: thread.otherParticipant.id,
      subject: subject ?? thread.subject,
      body,
      existingThreadId: threadId,
    })

    return {
      success: true,
      message: `Message sent to ${thread.otherParticipant.displayName}.`,
      entity: {
        type: "message",
        id: result.messageId,
        title: subject ?? "Message",
        route: "/module/messages",
      },
      data: { threadId: result.threadId, messageId: result.messageId },
    }
  }

  let courseId =
    ctx.courseId != null && Number.isFinite(ctx.courseId) ? Number(ctx.courseId) : null
  if (courseId == null) {
    const courseCtx = await resolveStudentCourseContextByDbId(studentDbId)
    courseId = courseCtx?.courseId ?? null
  }
  if (courseId == null) {
    return notFound("Could not resolve your course instructor for messaging.")
  }

  const instructorId = await resolveCourseInstructorId(courseId)
  if (instructorId == null) {
    return notFound("Could not resolve your course instructor for messaging.")
  }

  const result = await sendDirectMessage({
    sender,
    recipientKind: "instructor",
    recipientId: instructorId,
    subject,
    body,
  })

  return {
    success: true,
    message: "Message sent to your instructor.",
    entity: {
      type: "message",
      id: result.messageId,
      title: subject ?? "Message",
      route: "/module/messages",
    },
    data: { threadId: result.threadId, messageId: result.messageId },
  }
}

async function handleOfficeHoursCancel(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const requestId = positiveInt(ctx.args.requestId ?? ctx.args.id)
  if (!requestId) return notFound("Valid requestId is required.")

  const updated = (await sql`
    UPDATE office_hour_requests
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${requestId}
      AND student_id = ${studentDbId}
      AND status = 'pending'
    RETURNING id, topic
  `) as Array<{ id: number; topic: string }>

  if (!updated.length) {
    return notFound("Office hours request not found, not owned by you, or not pending.")
  }

  return {
    success: true,
    message: `Cancelled office hours request "${updated[0]!.topic}".`,
    entity: {
      type: "announcement",
      id: updated[0]!.id,
      title: updated[0]!.topic,
      route: "/module/office-hours",
    },
  }
}

function isBooleanPreferenceValue(value: unknown): value is boolean {
  return typeof value === "boolean"
}

async function handleSettingsUpdate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const rawArgs = ctx.args

  // courseId may be injected by the proposal envelope — ignore it, it is not a preference.
  const unknownKeys = Object.keys(rawArgs).filter(
    (key) => key !== "courseId" && !NOTIFICATION_PREFERENCE_FIELDS.includes(key as NotificationPreferenceField),
  )
  if (unknownKeys.length > 0) {
    return {
      success: false,
      message: `Only these notification preference fields are allowed: ${NOTIFICATION_PREFERENCE_FIELDS.join(", ")}.`,
      error: "unsupported",
    }
  }

  const patchKeys = NOTIFICATION_PREFERENCE_FIELDS.filter((key) => key in rawArgs)
  if (patchKeys.length === 0) {
    return {
      success: false,
      message: `Provide at least one preference field: ${NOTIFICATION_PREFERENCE_FIELDS.join(", ")}.`,
      error: "unsupported",
    }
  }

  for (const key of patchKeys) {
    if (!isBooleanPreferenceValue(rawArgs[key])) {
      return {
        success: false,
        message: `Preference "${key}" must be a boolean. Allowed fields: ${NOTIFICATION_PREFERENCE_FIELDS.join(", ")}.`,
        error: "unsupported",
      }
    }
  }

  await ensureNotificationPreferenceColumns()

  const existingRows = (await sql`
    SELECT *
    FROM notification_preferences
    WHERE student_id = ${studentDbId}
    LIMIT 1
  `) as Array<Record<string, unknown>>

  const existing = existingRows[0] ?? {}
  const preferences: Record<NotificationPreferenceField, boolean> = {
    quiz_reminders: Boolean(existing.quiz_reminders ?? true),
    practice_updates: Boolean(existing.practice_updates ?? true),
    ai_tutor_alerts: Boolean(existing.ai_tutor_alerts ?? true),
    codebench_results: Boolean(existing.codebench_results ?? true),
    deadline_alerts: Boolean(existing.deadline_alerts ?? true),
    group_messages: Boolean(existing.group_messages ?? true),
    project_updates: Boolean(existing.project_updates ?? true),
    homework_alerts: Boolean(existing.homework_alerts ?? true),
    exam_alerts: Boolean(existing.exam_alerts ?? true),
    lecture_updates: Boolean(existing.lecture_updates ?? true),
    announcement_alerts: Boolean(existing.announcement_alerts ?? true),
    forum_replies: Boolean(existing.forum_replies ?? true),
  }

  for (const key of patchKeys) {
    preferences[key] = rawArgs[key] as boolean
  }

  const updated = (await sql`
    INSERT INTO notification_preferences (
      student_id,
      quiz_reminders,
      practice_updates,
      ai_tutor_alerts,
      codebench_results,
      deadline_alerts,
      group_messages,
      project_updates,
      homework_alerts,
      exam_alerts,
      lecture_updates,
      announcement_alerts,
      forum_replies,
      updated_at
    )
    VALUES (
      ${studentDbId},
      ${preferences.quiz_reminders},
      ${preferences.practice_updates},
      ${preferences.ai_tutor_alerts},
      ${preferences.codebench_results},
      ${preferences.deadline_alerts},
      ${preferences.group_messages},
      ${preferences.project_updates},
      ${preferences.homework_alerts},
      ${preferences.exam_alerts},
      ${preferences.lecture_updates},
      ${preferences.announcement_alerts},
      ${preferences.forum_replies},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (student_id) DO UPDATE SET
      quiz_reminders = EXCLUDED.quiz_reminders,
      practice_updates = EXCLUDED.practice_updates,
      ai_tutor_alerts = EXCLUDED.ai_tutor_alerts,
      codebench_results = EXCLUDED.codebench_results,
      deadline_alerts = EXCLUDED.deadline_alerts,
      group_messages = EXCLUDED.group_messages,
      project_updates = EXCLUDED.project_updates,
      homework_alerts = EXCLUDED.homework_alerts,
      exam_alerts = EXCLUDED.exam_alerts,
      lecture_updates = EXCLUDED.lecture_updates,
      announcement_alerts = EXCLUDED.announcement_alerts,
      forum_replies = EXCLUDED.forum_replies,
      updated_at = CURRENT_TIMESTAMP
    RETURNING student_id
  `) as Array<{ student_id: number }>

  if (!updated.length) {
    return {
      success: false,
      message: "Could not update notification preferences.",
      error: "unsupported",
    }
  }

  return {
    success: true,
    message: "Notification preferences updated.",
    entity: {
      type: "announcement",
      id: studentDbId,
      title: "Notification preferences",
      route: "/module/settings",
    },
    data: { updatedFields: patchKeys },
  }
}

registerCapabilityHandlers("student", {
  "calendar.update": handleCalendarUpdate,
  "calendar.delete": handleCalendarDelete,
  "notes.update": handleNotesUpdate,
  "notes.delete": handleNotesDelete,
  "flashcards.update": handleFlashcardsUpdate,
  "flashcards.delete": handleFlashcardsDelete,
  "messages.create": handleMessagesSend,
  "messages.send": handleMessagesSend,
  "office-hours.cancel": handleOfficeHoursCancel,
  "settings.update": handleSettingsUpdate,
})
