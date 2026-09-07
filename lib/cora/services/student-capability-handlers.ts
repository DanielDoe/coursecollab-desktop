/**
 * Student capability confirm handlers — registry-backed executors for propose_student_capability.
 */

import { sql } from "@/lib/db"
import { createStudentFlashcardDeck } from "@/lib/cora/services/create-student-flashcard-deck"
import { createStudentDigitalNote } from "@/lib/cora/services/create-student-digital-note"
import { createStudentCalendarEvents } from "@/lib/cora/services/create-student-calendar-events"
import {
  createFlashcardsFromTopic,
  createPracticeQuiz,
  createStudyNoteFromTopic,
} from "@/lib/cora/run-workspace-action"
import { automateStudyPlanFromChat } from "@/lib/cora/automate-study-plan"
import {
  ensureOfficeHoursCourseScopeColumns,
  hasOfficeHourRequestsCourseIdColumn,
  resolveStudentCourseIdForOfficeHours,
} from "@/lib/office-hours-course-scope"
import { createInstructorNotification } from "@/lib/create-instructor-notification"
import { logSupportTicketToSystemLog } from "@/lib/system-log-support-ticket"
import {
  registerCapabilityHandler,
  registerCapabilityHandlers,
  hasCapabilityHandler,
  type CapabilityExecutionContext,
  type CapabilityHandlerResult,
} from "@/lib/cora/services/capability-handler-registry"
import {
  studentCapabilityIdsForAgent,
  resolveStudentModuleForCapability,
} from "@/lib/cora/capabilities/student-tool-registry"
import { getStudentModuleCapability } from "@/lib/cora/capabilities/student-module-registry"

function studentId(ctx: CapabilityExecutionContext): number {
  const id = ctx.studentDbId
  if (!id || !Number.isFinite(id)) throw new Error("Student context required.")
  return id
}

async function handleFlashcardsCreate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const cards = Array.isArray(ctx.args.cards)
    ? (ctx.args.cards as { front: string; back: string }[])
    : []
  const topic = String(ctx.args.topic ?? "").trim()
  const title = String(ctx.args.title ?? "").trim() || `Flashcards · ${topic || "Study"}`

  let deck: { deckId: number; title: string; cardCount: number; href?: string }
  if (cards.length > 0) {
    deck = await createStudentFlashcardDeck({
      studentDbId,
      title,
      topic: topic || undefined,
      description: "Created by Cora",
      cards,
    })
  } else if (topic) {
    const fromTopic = await createFlashcardsFromTopic(studentDbId, topic, [])
    deck = {
      deckId: fromTopic.deckId,
      title: fromTopic.title,
      cardCount: fromTopic.cardCount,
      href: fromTopic.href,
    }
  } else {
    throw new Error("Flashcard topic or cards are required.")
  }

  return {
    success: true,
    message: `Created flashcard deck "${deck.title}" with ${deck.cardCount} cards.`,
    entity: {
      type: "flashcard_deck",
      id: deck.deckId,
      title: deck.title,
      route: deck.href ?? "/module/flashcards",
    },
    undo: { method: "delete", entityType: "flashcard_deck", entityId: deck.deckId },
  }
}

async function handleNotesCreate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const title = String(ctx.args.title ?? "").trim() || "Cora study note"
  const bodyText = String(ctx.args.bodyText ?? ctx.args.content ?? "").trim()
  const topic = String(ctx.args.topic ?? "").trim()

  let note: { noteId: number; title: string; href?: string }
  if (bodyText) {
    note = await createStudentDigitalNote({ studentDbId, title, bodyText })
  } else if (topic) {
    const created = await createStudyNoteFromTopic(studentDbId, topic, [], title)
    note = { noteId: created.noteId, title: created.title, href: created.href }
  } else {
    throw new Error("Note content or topic is required.")
  }

  return {
    success: true,
    message: `Saved note "${note.title}".`,
    entity: {
      type: "note",
      id: note.noteId,
      title: note.title,
      route: note.href ?? "/module/notes",
    },
    undo: { method: "delete", entityType: "note", entityId: note.noteId },
  }
}

async function handleCalendarCreate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const sessions = Array.isArray(ctx.args.sessions)
    ? (ctx.args.sessions as {
        title?: string
        description?: string | null
        startTime?: string
        endTime?: string | null
        eventType?: string
      }[])
    : []
  const created = await createStudentCalendarEvents(
    sessions.map((s) => ({
      studentDbId,
      title: String(s.title ?? ""),
      description: s.description ?? null,
      startTime: String(s.startTime ?? ""),
      endTime: s.endTime ?? null,
      eventType: s.eventType ?? "study_session",
    })),
  )
  return {
    success: true,
    message: `Created ${created.count} study session${created.count === 1 ? "" : "s"} on your calendar.`,
    entity: {
      type: "calendar_events",
      id: created.eventIds[0] ?? 0,
      title: `${created.count} sessions`,
      route: "/module/calendar",
    },
    undo: {
      method: "delete",
      entityType: "calendar_event",
      entityId: created.eventIds[0] ?? 0,
    },
  }
}

async function handlePracticeStart(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const topic = String(ctx.args.topic ?? "").trim()
  if (!topic) throw new Error("Practice quiz topic is required.")
  const created = await createPracticeQuiz(studentDbId, topic, {
    count: ctx.args.count != null ? Number(ctx.args.count) : undefined,
    difficulty: ctx.args.difficulty != null ? String(ctx.args.difficulty) : undefined,
  })
  return {
    success: true,
    message: `Created practice quiz on "${created.topic}" (${created.questionCount} questions).`,
    entity: {
      type: "practice_quiz",
      id: created.attemptId,
      title: created.topic,
      route: created.href,
    },
  }
}

async function handleStudyPlanGenerate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const focus = String(ctx.args.focus ?? "upcoming assessments and weak topics").trim()
  const created = await automateStudyPlanFromChat(
    studentDbId,
    [
      {
        id: "plan-confirm",
        role: "student",
        content: `Create a study plan focused on: ${focus}`,
        timestamp: new Date().toISOString(),
      },
    ],
    { title: String(ctx.args.title ?? `Cora study plan · ${focus.slice(0, 48)}`) },
  )
  return {
    success: true,
    message: `Study plan saved: ${created.noteTitle}. ${created.eventsCreated} calendar session${created.eventsCreated === 1 ? "" : "s"} created.`,
    entity: {
      type: "study_plan",
      id: created.planId ?? created.noteId,
      title: created.noteTitle,
      route: created.href ?? "/module/calendar",
    },
    data: {
      eventsCreated: created.eventsCreated,
      flashcardDecks: created.flashcardDecks,
      practiceQuizzes: created.practiceQuizzes,
    },
  }
}

async function handleOfficeHoursBook(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const topic = String(ctx.args.topic ?? ctx.args.title ?? "").trim()
  if (!topic) throw new Error("topic is required.")

  await ensureOfficeHoursCourseScopeColumns()
  const hasCourseCol = await hasOfficeHourRequestsCourseIdColumn()
  const studentCourseId = hasCourseCol ? await resolveStudentCourseIdForOfficeHours(studentDbId) : null

  const inserted = hasCourseCol
    ? ((await sql`
        INSERT INTO office_hour_requests (
          student_id, course_id, topic, area_of_concern, description, priority, status
        )
        VALUES (
          ${studentDbId},
          ${studentCourseId},
          ${topic},
          ${ctx.args.areaOfConcern ?? null},
          ${ctx.args.description ?? null},
          ${String(ctx.args.priority ?? "medium")},
          'pending'
        )
        RETURNING id
      `) as { id: number }[])
    : ((await sql`
        INSERT INTO office_hour_requests (student_id, topic, area_of_concern, description, priority, status)
        VALUES (
          ${studentDbId},
          ${topic},
          ${ctx.args.areaOfConcern ?? null},
          ${ctx.args.description ?? null},
          ${String(ctx.args.priority ?? "medium")},
          'pending'
        )
        RETURNING id
      `) as { id: number }[])

  const requestId = Number(inserted[0]?.id ?? 0)
  try {
    await createInstructorNotification({
      type: "office_hour_request",
      title: `Office Hours Request: ${topic}`,
      message: `A student requested office hours (${topic}).`,
      link: "/instructor/office-hours",
      source_type: "office_hour",
      source_id: String(requestId),
      courseId: ctx.courseId ?? null,
    })
  } catch {
    /* non-critical */
  }

  return {
    success: true,
    message: "Office hours request submitted.",
    entity: { type: "announcement", id: requestId, title: topic, route: "/module/office-hours" },
  }
}

async function handleForumCreate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const title = String(ctx.args.title ?? "").trim()
  const description = String(ctx.args.description ?? ctx.args.body ?? "").trim()
  if (!title || !description) throw new Error("Forum thread title and description are required.")

  const rows = (await sql`
    INSERT INTO forum_threads (student_id, title, description, code_snippet, tags, is_anonymous)
    VALUES (
      ${studentDbId},
      ${title},
      ${description},
      ${ctx.args.codeSnippet ?? ctx.args.code_snippet ?? null},
      ${JSON.stringify(ctx.args.tags ?? [])}::jsonb,
      ${ctx.args.isAnonymous === true || ctx.args.is_anonymous === true}
    )
    RETURNING id
  `) as { id: number }[]

  return {
    success: true,
    message: `Discussion thread "${title}" created.`,
    entity: {
      type: "discussion",
      id: rows[0]?.id ?? 0,
      title,
      route: "/module/forum",
    },
  }
}

async function handleSupportTicketCreate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const subject = String(ctx.args.subject ?? ctx.args.title ?? "Support request").trim()
  const description = String(ctx.args.description ?? ctx.args.body ?? "").trim()
  if (!description) throw new Error("description is required.")

  const { ticketId } = await logSupportTicketToSystemLog({
    studentDbId,
    subject,
    description,
    category: String(ctx.args.category ?? "general"),
    priority: String(ctx.args.priority ?? "medium"),
    moduleId: ctx.args.moduleId != null ? String(ctx.args.moduleId) : null,
    moduleName: ctx.args.moduleLabel != null ? String(ctx.args.moduleLabel) : null,
  })

  return {
    success: true,
    message: "Support ticket submitted.",
    entity: { type: "announcement", id: ticketId, title: subject, route: "/module/submit-ticket" },
  }
}

const CORE_STUDENT_HANDLERS: Record<
  string,
  (ctx: CapabilityExecutionContext) => Promise<CapabilityHandlerResult>
> = {
  "flashcards.create": handleFlashcardsCreate,
  "flashcards.generate": handleFlashcardsCreate,
  "notes.create": handleNotesCreate,
  "notes.generate": handleNotesCreate,
  "calendar.create": handleCalendarCreate,
  "practice.start": handlePracticeStart,
  "practice.generate": handlePracticeStart,
  "ai-notetaker.generate": handleStudyPlanGenerate,
  "progress-review.generate": handleStudyPlanGenerate,
  "office-hours.book": handleOfficeHoursBook,
  "forum.create": handleForumCreate,
  "submit-ticket.create": handleSupportTicketCreate,
  "report-bug.create": handleSupportTicketCreate,
  "feature-requests.create": handleSupportTicketCreate,
}

/** Canonical capability aliases → primary handler id */
const STUDENT_CAPABILITY_ALIASES: Record<string, string> = {
  "flashcards.generate": "flashcards.create",
  "notes.generate": "notes.create",
  "practice.generate": "practice.start",
  "ai-notetaker.create": "notes.create",
  // Generate ops that map onto existing study artifacts
  "ai-tutor.generate": "notes.create",
  "lectures.generate": "notes.create",
  "quiz-history.generate": "practice.start",
}

/**
 * Navigation-only capabilities — "start"/"join" ops that must open the module in the app,
 * never write on the student's behalf. attendance.start is deliberately here: check-in has
 * integrity constraints (session codes, live windows) that Cora must not bypass.
 */
const NAVIGATION_ONLY_CAPABILITIES = new Set<string>([
  "ai-notetaker.start",
  "attendance.start",
  "codebench.start",
  "codebench.generate",
  "course-evaluation.start",
  "flashcards.start",
  "homework.start",
  "lectures.start",
  "playground.join",
  "playground.start",
  "quizzes.start",
])

function navigationHandler(capabilityId: string) {
  return async (ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> => {
    const moduleId = resolveStudentModuleForCapability(capabilityId)
    const mod = moduleId ? getStudentModuleCapability(moduleId) : null
    const route = mod?.route ?? "/module"
    const label = mod?.label ?? capabilityId
    void ctx
    return {
      success: true,
      message: `Opening ${label} — this action runs inside the app (Cora cannot complete it on your behalf).`,
      entity: { type: "announcement", id: 0, title: label, route },
      data: { navigation: true, capabilityId },
    }
  }
}

registerCapabilityHandlers("student", CORE_STUDENT_HANDLERS)

for (const capabilityId of studentCapabilityIdsForAgent()) {
  if (hasCapabilityHandler("student", capabilityId)) continue

  if (NAVIGATION_ONLY_CAPABILITIES.has(capabilityId)) {
    registerCapabilityHandler("student", capabilityId, navigationHandler(capabilityId))
    continue
  }

  const canonical = STUDENT_CAPABILITY_ALIASES[capabilityId]
  if (canonical && CORE_STUDENT_HANDLERS[canonical]) {
    const core = CORE_STUDENT_HANDLERS[canonical]
    registerCapabilityHandler("student", capabilityId, async (ctx) =>
      core({ ...ctx, capabilityId: canonical }),
    )
    continue
  }

  registerCapabilityHandler("student", capabilityId, async () => ({
    success: false,
    message: `Student capability "${capabilityId}" is registered but its executor is not wired yet. Ask Cora to open the module instead, or report this so the handler is added.`,
    error: "no_executor",
  }))
}

export { CORE_STUDENT_HANDLERS }
