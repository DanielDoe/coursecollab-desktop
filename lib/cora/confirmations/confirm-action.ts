/**
 * Confirm a signed Cora action proposal by executing the shared CourseCollab service.
 */

import { createCourseAnnouncement } from "@/lib/cora/services/create-announcement"
import { bulkCreateQuestionBankQuestions } from "@/lib/cora/services/bulk-create-questions"
import { createAssessmentFromBank } from "@/lib/cora/services/create-assessment-from-bank"
import { sendInstructorDirectMessage } from "@/lib/cora/services/send-instructor-message"
import { updateSyllabusSection } from "@/lib/cora/services/update-syllabus-section"
import { createLectureShell } from "@/lib/cora/services/create-lecture-shell"
import { createStudentFlashcardDeck } from "@/lib/cora/services/create-student-flashcard-deck"
import { createStudentDigitalNote } from "@/lib/cora/services/create-student-digital-note"
import {
  createFlashcardsFromTopic,
  createStudyNoteFromTopic,
} from "@/lib/cora/run-workspace-action"
import { logCoraAuditEvent } from "@/lib/cora/security/audit"
import type { CoraSession } from "@/lib/cora/security/types"
import {
  verifyCoraActionProposal,
  type CoraActionProposal,
  type CoraProposalTool,
} from "@/lib/cora/confirmations/action-proposals"
import {
  claimCoraConfirmedAction,
  completeCoraConfirmedAction,
  releaseCoraConfirmedActionClaim,
} from "@/lib/cora/models/idempotency"
import { isFacultyRegistryCapabilityId } from "@/lib/cora/capabilities/faculty-tool-registry"
import { isStudentRegistryCapabilityId } from "@/lib/cora/capabilities/student-tool-registry"
import { executeFacultyCapability } from "@/lib/cora/services/execute-faculty-capability"
import { executeStudentCapability } from "@/lib/cora/services/execute-student-capability"

export type ConfirmCoraActionResult = {
  success: boolean
  message: string
  tool: CoraProposalTool
  entity?: {
    type: string
    id: number | string
    title?: string
    route?: string
  }
  data?: Record<string, unknown>
  undo?: {
    method: "delete" | "archive"
    entityType: string
    entityId: number
  }
  error?: string
}

export async function confirmCoraActionProposal(input: {
  session: CoraSession
  proposal: CoraActionProposal
  courseId?: number | null
}): Promise<ConfirmCoraActionResult> {
  const verified = verifyCoraActionProposal(input.proposal, {
    userId: input.session.userId,
    role: input.session.role,
    courseId: input.courseId ?? input.session.courseIds[0] ?? null,
  })

  if (!verified.ok) {
    void logCoraAuditEvent({
      session: input.session,
      action: "cora.action.confirm_blocked",
      outcome: "blocked",
      errorMessage: verified.reason,
      permissionChecks: [...input.session.permissions],
    })
    return {
      success: false,
      message: verified.reason,
      tool: input.proposal.tool,
      error: verified.reason,
    }
  }

  const proposal = verified.proposal
  const args = proposal.arguments

  // Role/tool isolation — students cannot execute faculty tools even with a forged role field
  // (verify already checks role match; this is defense in depth for tool families).
  const facultyTools: CoraProposalTool[] = [
    "announcement.publish",
    "questionBank.createQuestions",
    "assessment.createFromBank",
    "message.send",
    "syllabus.saveSection",
    "syllabus.publishSection",
    "lecture.createShell",
    "flashcard.generateFromBank",
    "courseNote.create",
    "account.accessRequest.approve",
    "account.accessRequest.reject",
  ]
  const adminTools: CoraProposalTool[] = [
    "account.passwordReset.approve",
    "account.passwordReset.reject",
    "account.accessRequest.approve",
    "account.accessRequest.reject",
  ]
  const studentTools: CoraProposalTool[] = [
    "personalFlashcards.createDeck",
    "personalNotes.create",
    "personalCalendar.createEvents",
    "personalPracticeQuiz.create",
    "personalStudyPlan.create",
  ]
  if (input.session.role === "student" && (facultyTools.includes(proposal.tool) || adminTools.includes(proposal.tool) || isFacultyRegistryCapabilityId(proposal.tool))) {
    return {
      success: false,
      message: "This action is not available for student accounts.",
      tool: proposal.tool,
      error: "role_tool_mismatch",
    }
  }
  if (
    input.session.role === "faculty" &&
    (studentTools.includes(proposal.tool) ||
      adminTools.includes(proposal.tool) ||
      (isStudentRegistryCapabilityId(proposal.tool) && !isFacultyRegistryCapabilityId(proposal.tool)))
  ) {
    return {
      success: false,
      message: "This action is not available for faculty accounts.",
      tool: proposal.tool,
      error: "role_tool_mismatch",
    }
  }
  if (
    input.session.role === "admin" &&
    (facultyTools.includes(proposal.tool) ||
      studentTools.includes(proposal.tool) ||
      isFacultyRegistryCapabilityId(proposal.tool) ||
      isStudentRegistryCapabilityId(proposal.tool))
  ) {
    return {
      success: false,
      message: "Admin Cora cannot execute Faculty/Student teaching tools.",
      tool: proposal.tool,
      error: "role_tool_mismatch",
    }
  }

  const claim = await claimCoraConfirmedAction({
    userId: input.session.userId,
    actionId: proposal.actionId,
    tool: proposal.tool,
  })
  if (claim.status === "replay") {
    return claim.result as ConfirmCoraActionResult
  }
  if (claim.status === "in_progress") {
    return {
      success: false,
      message: "This action is already being confirmed.",
      tool: proposal.tool,
      error: "in_progress",
    }
  }

  try {
    let result: ConfirmCoraActionResult

    switch (proposal.tool) {
      case "announcement.publish": {
        const instructorId = input.session.claims.instructorId ?? input.session.userId
        const courseId = Number(args.courseId ?? proposal.courseId)
        if (!Number.isFinite(courseId) || courseId <= 0) {
          throw new Error("Course context required to publish an announcement.")
        }
        const created = await createCourseAnnouncement({
          instructorId,
          courseId,
          title: String(args.title ?? ""),
          content: String(args.content ?? ""),
          pinned: args.pinned === true,
        })
        const { after } = await import("next/server")
        const { runAnnouncementCreateSideEffects } = await import(
          "@/lib/cora/services/create-announcement"
        )
        after(() =>
          runAnnouncementCreateSideEffects({
            announcement: created.announcement,
            title: String(args.title ?? ""),
            content: String(args.content ?? ""),
            lockedForStudents: false,
            courseId,
          }).catch((err) => console.error("[Cora] announcement side effects:", err)),
        )
        const id = Number(created.announcement.id)
        result = {
          success: true,
          tool: proposal.tool,
          message: `Announcement published${created.notifiedCount ? ` · ${created.notifiedCount} students notified` : ""}.`,
          entity: {
            type: "announcement",
            id,
            title: String(args.title ?? ""),
            route: "/faculty/dashboard/communication/announcements",
          },
          undo: { method: "delete", entityType: "announcement", entityId: id },
        }
        break
      }

      case "questionBank.createQuestions": {
        const instructorId = input.session.claims.instructorId ?? input.session.userId
        const courseId = Number(args.courseId ?? proposal.courseId)
        const drafts = Array.isArray(args.drafts) ? args.drafts : []
        const created = await bulkCreateQuestionBankQuestions({
          instructorId,
          courseId,
          questions: drafts,
        })
        result = {
          success: true,
          tool: proposal.tool,
          message: `${created.createdCount} question${created.createdCount === 1 ? "" : "s"} added to Question Bank.`,
          entity: {
            type: "question",
            id: created.questionIds[0] ?? 0,
            title: `${created.createdCount} questions`,
            route: "/faculty/dashboard/assessments/quizzes/question-bank",
          },
          data: { questionIds: created.questionIds },
          undo: {
            method: "archive",
            entityType: "question_bank",
            entityId: created.questionIds[0] ?? 0,
          },
        }
        break
      }

      case "assessment.createFromBank": {
        const instructorId = input.session.claims.instructorId ?? input.session.userId
        const courseId = Number(args.courseId ?? proposal.courseId)
        const questionIds = Array.isArray(args.questionIds)
          ? args.questionIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
          : []
        const assessmentTypeRaw = String(args.assessmentType ?? "quiz")
        const assessmentType =
          assessmentTypeRaw === "homework" ||
          assessmentTypeRaw === "mid_semester" ||
          assessmentTypeRaw === "final"
            ? assessmentTypeRaw
            : "quiz"
        const publish = args.publish === true
        const created = await createAssessmentFromBank({
          instructorId,
          courseId,
          title: String(args.title ?? ""),
          description: args.description != null ? String(args.description) : null,
          questionIds,
          assessmentType,
          timeLimit: args.timeLimit != null ? Number(args.timeLimit) : undefined,
          availableFrom: args.availableFrom != null ? String(args.availableFrom) : null,
          availableUntil: args.availableUntil != null ? String(args.availableUntil) : null,
          publish,
        })
        const typeLabel =
          created.assessmentType === "homework"
            ? "Homework"
            : created.assessmentType === "mid_semester"
              ? "Mid-semester exam"
              : created.assessmentType === "final"
                ? "Final exam"
                : "Quiz"
        result = {
          success: true,
          tool: proposal.tool,
          message: `${typeLabel} "${created.title}" created with ${created.questionsAdded} questions${created.published ? " and published" : " as a draft"}.`,
          entity: {
            type: "assessment",
            id: created.quizId,
            title: created.title,
            route: `/faculty/dashboard/assessments/${created.assessmentType === "homework" ? "homework" : "quizzes"}`,
          },
          undo: { method: "delete", entityType: "quiz", entityId: created.quizId },
        }
        break
      }

      case "message.send": {
        const instructorId = input.session.claims.instructorId ?? input.session.userId
        const courseId = Number(args.courseId ?? proposal.courseId)
        const sent = await sendInstructorDirectMessage({
          instructorId,
          courseId,
          recipientStudentId: Number(args.recipientStudentId),
          subject: args.subject != null ? String(args.subject) : null,
          body: String(args.body ?? ""),
          existingThreadId:
            args.existingThreadId != null ? Number(args.existingThreadId) : null,
        })
        result = {
          success: true,
          tool: proposal.tool,
          message: `Message sent to ${sent.recipientName}.`,
          entity: {
            type: "message",
            id: sent.messageId,
            title: sent.recipientName,
            route: `/faculty/dashboard/communication/messages?threadId=${sent.threadId}`,
          },
        }
        break
      }

      case "syllabus.saveSection":
      case "syllabus.publishSection": {
        const instructorId = input.session.claims.instructorId ?? input.session.userId
        const courseId = Number(args.courseId ?? proposal.courseId)
        const updated = await updateSyllabusSection({
          instructorId,
          courseId,
          sectionTitle: String(args.sectionTitle ?? ""),
          markdown: String(args.markdown ?? ""),
          sectionType:
            args.sectionType === "policy" ||
            args.sectionType === "schedule" ||
            args.sectionType === "grading" ||
            args.sectionType === "list" ||
            args.sectionType === "table"
              ? args.sectionType
              : "text",
          publish: proposal.tool === "syllabus.publishSection" || args.publish === true,
        })
        result = {
          success: true,
          tool: proposal.tool,
          message: updated.published
            ? `Syllabus section "${args.sectionTitle}" published.`
            : `Syllabus section "${args.sectionTitle}" saved as draft.`,
          entity: {
            type: "syllabus",
            id: updated.syllabus.id,
            title: String(args.sectionTitle ?? "Syllabus"),
            route: "/faculty/dashboard/course/syllabus",
          },
        }
        break
      }

      case "lecture.createShell": {
        const instructorId = input.session.claims.instructorId ?? input.session.userId
        const courseId = Number(args.courseId ?? proposal.courseId)
        const created = await createLectureShell({
          instructorId,
          courseId,
          title: String(args.title ?? ""),
          week: Number(args.week ?? 1),
          description: args.description != null ? String(args.description) : null,
          objectives: Array.isArray(args.objectives)
            ? args.objectives.map((o) => String(o))
            : [],
          publish: args.publish === true,
        })
        result = {
          success: true,
          tool: proposal.tool,
          message: `Lecture shell "${created.title}" created for week ${created.week}${created.published ? " (published)" : " (unpublished)"}.`,
          entity: {
            type: "lecture",
            id: created.lectureId,
            title: created.title,
            route: "/faculty/dashboard/course/lectures",
          },
          undo: { method: "delete", entityType: "lecture", entityId: created.lectureId },
        }
        break
      }

      case "account.passwordReset.approve":
      case "account.passwordReset.reject": {
        const adminId = input.session.claims.adminId ?? input.session.userId
        const requestId = Number(args.requestId)
        const decision =
          proposal.tool === "account.passwordReset.reject" || args.decision === "reject"
            ? "reject"
            : "approve"
        const { decideAdminPasswordReset } = await import(
          "@/lib/cora/services/admin-directory-services"
        )
        const { createActionReceipt, receiptToAuditEntry } = await import(
          "@/lib/cora/capabilities/action-receipts"
        )
        const decided = await decideAdminPasswordReset({
          adminId,
          requestId,
          decision,
          notes: args.notes != null ? String(args.notes) : null,
        })
        const receipt = createActionReceipt({
          actorUserId: input.session.userId,
          actorRole: "admin",
          coraSessionId: input.session.requestId,
          tool: proposal.tool,
          capability:
            decision === "approve"
              ? "account.passwordReset.approve"
              : "account.passwordReset.reject",
          resourceType: "password_reset_request",
          resourceId: decided.requestId,
          institutionId: input.session.institutionId,
          title: decision === "approve" ? "Password reset approved" : "Password reset rejected",
          summary: `Request #${decided.requestId} marked ${decided.status}.`,
          status: "completed",
          fields: [
            { label: "Request", value: String(decided.requestId) },
            { label: "Student record", value: String(decided.studentId) },
            { label: "Status", value: decided.status },
          ],
          links: [
            {
              label: "Account management",
              href: "/admin/dashboard-v2/users/account-management",
            },
          ],
          confirmationId: proposal.actionId,
          newState: { status: decided.status },
        })
        void logCoraAuditEvent({
          session: input.session,
          action: `cora.admin.password_reset.${decision}`,
          outcome: "success",
          metadata: receiptToAuditEntry(receipt),
        })
        result = {
          success: true,
          tool: proposal.tool,
          message: receipt.summary,
          entity: {
            type: "account",
            id: decided.requestId,
            title: receipt.title,
            route: "/admin/dashboard-v2/users/account-management",
          },
          data: { receipt },
        }
        break
      }

      case "account.accessRequest.approve":
      case "account.accessRequest.reject": {
        const requestId = Number(args.requestId)
        const decision =
          proposal.tool === "account.accessRequest.reject" || args.decision === "reject"
            ? "reject"
            : "approve"
        const { decideAccessRequest } = await import("@/lib/cora/services/access-governance-services")
        const reviewer =
          input.session.role === "admin"
            ? ({ role: "admin" as const, adminId: input.session.claims.adminId ?? input.session.userId })
            : ({
                role: "faculty" as const,
                instructorId: input.session.userId,
                courseId: Number(proposal.courseId ?? input.session.courseIds[0]),
                isActive: true,
              })
        if (reviewer.role === "faculty" && !Number.isFinite(reviewer.courseId)) {
          result = {
            success: false,
            tool: proposal.tool,
            message: "Select a course before approving access requests.",
            error: "missing_course_scope",
          }
          break
        }
        const decided = await decideAccessRequest({
          requestId,
          reviewer,
          decision,
          reason: args.reason != null ? String(args.reason) : undefined,
          approvalSource: input.session.role === "admin" ? "admin" : "faculty",
        })
        result = {
          success: true,
          tool: proposal.tool,
          message:
            decision === "approve" && "userId" in decided
              ? `Access approved (user #${decided.userId}).`
              : `Access request #${requestId} rejected.`,
          entity: { type: "account", id: requestId, title: `Request #${requestId}` },
        }
        break
      }

      case "courseExchange.request": {
        const { coraCreateExchangeRequest } = await import("@/lib/cora/services/course-exchange-services")
        if (input.session.role !== "faculty") throw new Error("Faculty session required.")
        const created = await coraCreateExchangeRequest({
          requesterInstructorId: input.session.userId,
          sourceCourseId: Number(args.sourceCourseId),
          purpose: args.purpose != null ? String(args.purpose) : null,
        })
        result = {
          success: true,
          tool: proposal.tool,
          message: `Course Exchange request #${created.id} sent.`,
          entity: { type: "course", id: created.id, title: `Exchange request #${created.id}` },
        }
        break
      }

      case "courseExchange.approve":
      case "courseExchange.reject": {
        const { coraDecideExchangeRequest } = await import("@/lib/cora/services/course-exchange-services")
        const { normalizeModuleList, defaultApprovalModules } = await import("@/lib/course-exchange/modules")
        if (input.session.role !== "faculty") throw new Error("Faculty session required.")
        const requestId = Number(args.requestId)
        const decision = proposal.tool === "courseExchange.reject" ? "reject" : "approve"
        await coraDecideExchangeRequest({
          instructorId: input.session.userId,
          requestId,
          decision,
          approvedModules: normalizeModuleList(args.approvedModules ?? defaultApprovalModules()),
          reason: args.reason != null ? String(args.reason) : null,
        })
        result = {
          success: true,
          tool: proposal.tool,
          message:
            decision === "approve"
              ? `Course Exchange request #${requestId} approved.`
              : `Course Exchange request #${requestId} rejected.`,
          entity: { type: "course", id: requestId, title: `Exchange request #${requestId}` },
        }
        break
      }

      case "courseExchange.importCopy": {
        const { coraExecuteExchangeCopy } = await import("@/lib/cora/services/course-exchange-services")
        if (input.session.role !== "faculty") throw new Error("Faculty session required.")
        const copyResult = await coraExecuteExchangeCopy({
          requesterInstructorId: input.session.userId,
          requestId: Number(args.requestId),
          destinationCourseId: Number(args.destinationCourseId),
          destinationSessionId:
            args.destinationSessionId != null ? Number(args.destinationSessionId) : null,
        })
        result = {
          success: true,
          tool: proposal.tool,
          message: "Independent course copy created. Review dates and publish status.",
          entity: {
            type: "course",
            id: Number(args.destinationCourseId),
            title: "Imported course copy",
          },
          data: { checklist: copyResult.postCopyChecklist },
        }
        break
      }

      case "flashcard.generateFromBank": {
        const instructorId = input.session.claims.instructorId ?? input.session.userId
        const courseId = Number(args.courseId ?? proposal.courseId)
        const topicName = String(args.topicName ?? args.topic ?? "").trim()
        if (!Number.isFinite(courseId) || courseId <= 0) {
          throw new Error("Course context required to generate flashcards.")
        }
        if (!topicName) {
          throw new Error("Topic is required.")
        }
        let courseCode = String(input.session.claims.courseCode ?? "").trim()
        if (!courseCode) {
          const { sql } = await import("@/lib/db")
          const rows = (await sql`
            SELECT course_code FROM courses WHERE id = ${courseId} LIMIT 1
          `) as { course_code: string | null }[]
          courseCode = String(rows[0]?.course_code ?? "").trim()
        }
        if (!courseCode) {
          throw new Error("Course code required to generate flashcards.")
        }
        const { generateFlashcardsFromQuestionBank } = await import("@/lib/flashcard-bank-generate")
        const { fetchFlashcardDeckById } = await import("@/lib/flashcards")
        const generated = await generateFlashcardsFromQuestionBank({
          courseId,
          instructorId,
          courseCode,
          topicName,
          session: args.session != null ? String(args.session) : null,
          deckId: args.deckId != null ? Number(args.deckId) : null,
          maxCards: args.maxCards != null ? Number(args.maxCards) : undefined,
        })
        const deck = await fetchFlashcardDeckById(generated.deckId)
        result = {
          success: true,
          tool: proposal.tool,
          message: `Created flashcard deck "${deck?.title ?? topicName}" with ${generated.cardsAdded} card${generated.cardsAdded === 1 ? "" : "s"}.`,
          entity: {
            type: "flashcard_deck",
            id: generated.deckId,
            title: deck?.title ?? topicName,
            route: "/module/flashcards",
          },
          undo: { method: "delete", entityType: "flashcard_deck", entityId: generated.deckId },
        }
        break
      }

      case "personalFlashcards.createDeck": {
        const studentDbId = input.session.claims.studentDbId ?? input.session.userId
        const cards = Array.isArray(args.cards)
          ? (args.cards as { front: string; back: string }[])
          : []
        const topic = String(args.topic ?? "").trim()
        const title = String(args.title ?? "").trim() || `Flashcards · ${topic || "Study"}`

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

        result = {
          success: true,
          tool: proposal.tool,
          message: `Created flashcard deck "${deck.title}" with ${deck.cardCount} cards.`,
          entity: {
            type: "flashcard_deck",
            id: deck.deckId,
            title: deck.title,
            route: deck.href ?? `/module/flashcards`,
          },
          undo: { method: "delete", entityType: "flashcard_deck", entityId: deck.deckId },
        }
        break
      }

      case "personalNotes.create": {
        const studentDbId = input.session.claims.studentDbId ?? input.session.userId
        const title = String(args.title ?? "").trim() || "Cora study note"
        const bodyText = String(args.bodyText ?? args.content ?? "").trim()
        const topic = String(args.topic ?? "").trim()

        let note: { noteId: number; title: string; href?: string }
        if (bodyText) {
          note = await createStudentDigitalNote({
            studentDbId,
            title,
            bodyText,
          })
        } else if (topic) {
          const created = await createStudyNoteFromTopic(studentDbId, topic, [], title)
          note = { noteId: created.noteId, title: created.title, href: created.href }
        } else {
          throw new Error("Note content or topic is required.")
        }

        result = {
          success: true,
          tool: proposal.tool,
          message: `Saved note "${note.title}".`,
          entity: {
            type: "note",
            id: note.noteId,
            title: note.title,
            route: note.href ?? `/module/notes`,
          },
          undo: { method: "delete", entityType: "note", entityId: note.noteId },
        }
        break
      }

      case "personalCalendar.createEvents": {
        const studentDbId = input.session.claims.studentDbId ?? input.session.userId
        const { authorizeCreatePersonalCalendar } = await import(
          "@/lib/cora/security/student-resource-auth"
        )
        const gate = authorizeCreatePersonalCalendar(input.session, studentDbId)
        if (!gate.ok) throw new Error(gate.reason)

        const { createStudentCalendarEvents } = await import(
          "@/lib/cora/services/create-student-calendar-events"
        )
        const sessions = Array.isArray(args.sessions)
          ? (args.sessions as {
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
        result = {
          success: true,
          tool: proposal.tool,
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
        break
      }

      case "personalPracticeQuiz.create": {
        const studentDbId = input.session.claims.studentDbId ?? input.session.userId
        const { createPracticeQuiz } = await import("@/lib/cora/run-workspace-action")
        const topic = String(args.topic ?? "").trim()
        if (!topic) throw new Error("Practice quiz topic is required.")
        const created = await createPracticeQuiz(studentDbId, topic, {
          count: args.count != null ? Number(args.count) : undefined,
          difficulty: args.difficulty != null ? String(args.difficulty) : undefined,
        })
        result = {
          success: true,
          tool: proposal.tool,
          message: `Created practice quiz on "${created.topic}" (${created.questionCount} questions).`,
          entity: {
            type: "practice_quiz",
            id: created.attemptId,
            title: created.topic,
            route: created.href,
          },
        }
        break
      }

      case "personalStudyPlan.create": {
        const studentDbId = input.session.claims.studentDbId ?? input.session.userId
        const { automateStudyPlanFromChat } = await import("@/lib/cora/automate-study-plan")
        const focus = String(args.focus ?? "upcoming assessments and weak topics").trim()
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
          { title: String(args.title ?? `Cora study plan · ${focus.slice(0, 48)}`) },
        )
        result = {
          success: true,
          tool: proposal.tool,
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
        void (async () => {
          try {
            const { advanceStudentIntervention, listOpenInterventionsForStudent } = await import(
              "@/lib/institutions/interventions"
            )
            const open = await listOpenInterventionsForStudent(studentDbId)
            const studyPlan = open.find((row) => row.interventionType === "study_plan")
            if (studyPlan) {
              await advanceStudentIntervention({
                studentId: studentDbId,
                interventionId: studyPlan.id,
                action: "completed",
              })
            }
          } catch {
            /* non-blocking */
          }
        })()
        break
      }

      default: {
        if (
          input.session.role === "faculty" &&
          isFacultyRegistryCapabilityId(proposal.tool)
        ) {
          const instructorId = input.session.claims.instructorId ?? input.session.userId
          const courseId = Number(args.courseId ?? proposal.courseId)
          result = await executeFacultyCapability({
            instructorId,
            courseId,
            courseCode: input.session.claims.courseCode ?? null,
            capabilityId: proposal.tool,
            arguments: args,
          })
          break
        }
        if (
          input.session.role === "student" &&
          isStudentRegistryCapabilityId(proposal.tool)
        ) {
          const studentDbId = input.session.claims.studentDbId ?? input.session.userId
          result = await executeStudentCapability({
            studentDbId,
            courseId: proposal.courseId ?? input.session.courseIds[0] ?? null,
            capabilityId: proposal.tool,
            arguments: args,
          })
          break
        }
        throw new Error(`Unsupported proposal tool: ${String(proposal.tool)}`)
      }
    }

    void logCoraAuditEvent({
      session: input.session,
      action: `cora.action.${proposal.tool}`,
      outcome: "success",
      promptText: proposal.actionId,
      responseText: result.message,
      permissionChecks: [...input.session.permissions],
      metadata: {
        source: "cora",
        tool: proposal.tool,
        entityType: result.entity?.type,
        entityId: result.entity?.id,
        confirmed: true,
        coraActionId: proposal.actionId,
      },
    })

    if (result.success) {
      await completeCoraConfirmedAction({
        userId: input.session.userId,
        actionId: proposal.actionId,
        tool: proposal.tool,
        result,
      })
    } else {
      await releaseCoraConfirmedActionClaim({
        userId: input.session.userId,
        actionId: proposal.actionId,
      })
    }
    return result
  } catch (error) {
    await releaseCoraConfirmedActionClaim({
      userId: input.session.userId,
      actionId: proposal.actionId,
    })
    const message = error instanceof Error ? error.message : "Action failed."
    void logCoraAuditEvent({
      session: input.session,
      action: `cora.action.${proposal.tool}`,
      outcome: "error",
      errorMessage: message,
      permissionChecks: [...input.session.permissions],
    })
    return {
      success: false,
      tool: proposal.tool,
      message,
      error: message,
    }
  }
}
