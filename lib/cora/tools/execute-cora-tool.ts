import { sql } from "@/lib/db"
import { getStudentContextForCora } from "@/lib/cora/fetch-student-context"
import { formatStudentContextForPrompt } from "@/lib/cora/format-student-context-for-prompt"
import { searchPlatformForStudent } from "@/lib/cora/platform-search"
import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"
import type { CoraAgentRole } from "@/lib/cora/roles"
import type { CoraSession } from "@/lib/cora/security/types"
import {
  coraApiGetAttendance,
  coraApiGetClassroomPoints,
  coraApiGetNotifications,
  coraApiSearchReleasedLectureMaterials,
} from "@/lib/cora/apis/student-data-api"
import {
  coraApiAdminGovernanceHints,
  coraApiAdminPlatformSnapshot,
  coraApiAdminRevenueSummary,
  coraApiAdminSecurityOverview,
} from "@/lib/cora/apis/admin-data-api"
import {
  fetchFacultyContextForCora,
  formatFacultyContextForPrompt,
} from "@/lib/cora/fetch-faculty-context"
import { generateQuestionDraftsFromPrompt } from "@/lib/cora/faculty-cora-generate-questions"
import {
  createCoraActionProposal,
  serializeProposalForToolResult,
} from "@/lib/cora/confirmations/action-proposals"

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

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

export type CoraToolActor = {
  role: CoraAgentRole
  studentDbId?: number
  instructorId?: number
  courseId?: number
  courseCode?: string | null
  courseTitle?: string | null
  /** Active chat thread — used for thread-scoped memory. */
  threadId?: string | null
  /** Preferred: full RBAC session. When present, tools are permission-gated. */
  session?: CoraSession
}

async function executeCoraToolImpl(
  actor: CoraToolActor,
  toolName: CoraAgentToolName,
  args: Record<string, unknown>,
): Promise<string> {
  const session = actor.session
  const createTools = new Set<CoraAgentToolName>([
    "propose_personal_flashcards",
    "propose_personal_note",
    "propose_calendar_study_sessions",
    "propose_practice_quiz",
    "propose_study_plan",
    "generate_question_drafts",
    "propose_question_bank_create",
    "list_course_announcements",
    "remember_fact",
    "propose_announcement",
    "propose_assessment_from_bank",
    "propose_message_send",
    "propose_syllabus_section",
    "propose_lecture_shell",
    "create_faculty_flashcard_deck",
    "propose_faculty_capability",
    "propose_student_capability",
    "propose_remediation_quiz_plan",
  ])
  // analyze_assessment_results is read-only but still needs session + principal auth
  if (
    (createTools.has(toolName) || toolName === "analyze_assessment_results") &&
    !session
  ) {
    return "Error: Cora session required for this tool."
  }

  const targetSectionId =
    args.section_id != null && Number.isFinite(Number(args.section_id))
      ? Number(args.section_id)
      : null

  if (!session) {
    return "Error: Cora session required for this tool."
  }

  const { studentMutationModuleForTool, facultyMutationModuleForTool, adminMutationModuleForTool } =
    await import("@/lib/cora/security/principal-authorization")
  const { authorizeCoraToolGateway } = await import("@/lib/cora/disclosure/authorization-gateway")
  const mutation =
    session.role === "faculty"
      ? facultyMutationModuleForTool(toolName)
      : session.role === "admin"
        ? adminMutationModuleForTool(toolName)
        : studentMutationModuleForTool(toolName)
  const principal = authorizeCoraToolGateway(session, toolName, args, {
    courseId: actor.courseId ?? session.courseIds[0] ?? null,
    studentDbId: actor.studentDbId ?? session.claims.studentDbId ?? null,
    sectionId: targetSectionId,
    moduleId: mutation?.moduleId,
    operation: mutation?.operation,
  })
  if (!principal.ok) {
    return `Denied (${principal.code}): ${principal.reason}`
  }

  const studentDbId = actor.studentDbId ?? session?.claims.studentDbId
  // When session is student-scoped, never operate on another student id
  if (session?.role === "student" && studentDbId != null && studentDbId !== session.userId) {
    return "Denied (scope): Students may only access their own data."
  }

  switch (toolName) {
    case "get_student_summary": {
      if (!studentDbId) return "Error: student context required."
      const { getCoraPrivacySettings } = await import("@/lib/cora/privacy/cora-privacy-settings")
      const privacy = await getCoraPrivacySettings(studentDbId)
      const ctx = await getStudentContextForCora(studentDbId)
      return formatStudentContextForPrompt(ctx, { privacy })
    }

    case "get_calendar_events": {
      if (!studentDbId) return "Error: student context required."
      const daysBack = clamp(Number(args.days_back) || 7, 0, 60)
      const daysForward = clamp(Number(args.days_forward) || 45, 1, 120)
      const ctx = await getStudentContextForCora(studentDbId)
      const now = Date.now()
      const events = (ctx.calendarEvents ?? []).filter((e) => {
        const t = new Date(e.start).getTime()
        if (Number.isNaN(t)) return true
        return t >= now - daysBack * 86400000 && t <= now + daysForward * 86400000
      })
      if (events.length === 0) {
        return "No calendar events on record in CourseCollab for this date window."
      }
      return events
        .slice(0, 30)
        .map(
          (e) =>
            `- ${formatEventDate(e.start)} — ${e.title}${e.eventType ? ` (${e.eventType})` : ""}${e.isCompleted ? " [completed]" : ""}`,
        )
        .join("\n")
    }

    case "get_assessments": {
      if (!studentDbId) return "Error: student context required."
      const filter = String(args.filter ?? "upcoming") as "upcoming" | "missed" | "recent" | "all"
      const query = String(args.query ?? "").trim().toLowerCase()
      const ctx = await getStudentContextForCora(studentDbId)
      const lines: string[] = []
      const matchesQuery = (title: string) => !query || title.toLowerCase().includes(query)

      if (filter === "upcoming" || filter === "all") {
        const upcoming = (ctx.upcomingAssessments ?? []).filter((a) => matchesQuery(a.title))
        lines.push("**Upcoming assessments:**")
        lines.push(
          upcoming.length
            ? upcoming
                .slice(0, 20)
                .map((a) => `- ${a.title} (${a.type}) — due ${a.dueDate ? formatEventDate(a.dueDate) : "open"}`)
                .join("\n")
            : query
              ? `- None matching "${args.query}"`
              : "- None on record",
        )
      }

      if (filter === "missed" || filter === "all") {
        const missed = (ctx.missedDeadlines ?? []).filter((a) => matchesQuery(a.title))
        lines.push("", "**Missed deadlines:**")
        lines.push(
          missed.length
            ? missed
                .slice(0, 15)
                .map((a) => `- ${a.title} (${a.type}) — was due ${a.dueDate ? formatEventDate(a.dueDate) : "—"}`)
                .join("\n")
            : "- None on record",
        )
      }

      if (filter === "recent" || filter === "all") {
        const attempts = (ctx.quizAttempts as Record<string, unknown>[]) ?? []
        lines.push("", "**Recent completed attempts:**")
        lines.push(
          attempts.length
            ? attempts
                .slice(0, 10)
                .map((a) => {
                  const title = String(a.title ?? "Assessment")
                  const score = a.score != null ? `${a.score}/${a.total_questions ?? "?"}` : "—"
                  const when = a.completed_at ? formatEventDate(String(a.completed_at)) : ""
                  return `- ${title}: ${score}${when ? ` (${when})` : ""}`
                })
                .join("\n")
            : "- None on record",
        )
      }

      return lines.join("\n")
    }

    case "get_attendance": {
      if (!studentDbId) return "Error: student context required."
      if (!session) return "Error: Cora session required."
      try {
        return await coraApiGetAttendance(session, studentDbId)
      } catch (err) {
        console.warn("[cora/tools] attendance failed:", err)
        return "Attendance data unavailable right now."
      }
    }

    case "get_classroom_points": {
      if (!studentDbId) return "Error: student context required."
      if (!session) return "Error: Cora session required."
      try {
        return await coraApiGetClassroomPoints(session, studentDbId)
      } catch (err) {
        console.warn("[cora/tools] classroom points failed:", err)
        return "Classroom points data unavailable right now."
      }
    }

    case "get_notifications": {
      if (!studentDbId) return "Error: student context required."
      if (!session) return "Error: Cora session required."
      try {
        return await coraApiGetNotifications(session, studentDbId, args.unread_only === true)
      } catch (err) {
        console.warn("[cora/tools] notifications failed:", err)
        return "Notifications unavailable right now."
      }
    }

    case "get_lecture_progress": {
      if (!studentDbId) return "Error: student context required."
      const ctx = await getStudentContextForCora(studentDbId)
      const lectures = (ctx.lectureProgress as Record<string, unknown>[]) ?? []
      if (!lectures.length) return "No lecture progress on record."
      return lectures
        .slice(0, 20)
        .map((l) => {
          const week = l.week != null ? `Week ${l.week}` : "—"
          return `- ${week}: ${l.title ?? "Lecture"} — ${l.status ?? "unknown"}${l.last_accessed ? ` (last ${formatEventDate(String(l.last_accessed))})` : ""}`
        })
        .join("\n")
    }

    case "get_flashcards_and_notes": {
      if (!studentDbId) return "Error: student context required."
      const ctx = await getStudentContextForCora(studentDbId)
      const decks = ctx.flashcardDecks ?? []
      const notes = ctx.digitalNotes ?? []
      const lines = ["**Flashcard decks:**"]
      lines.push(
        decks.length
          ? decks.map((d) => `- ${d.title}${d.cardCount != null ? ` (${d.cardCount} cards)` : ""}`).join("\n")
          : "- None",
      )
      lines.push("", "**My Notes:**")
      lines.push(
        notes.length
          ? notes.map((n) => `- ${n.title}${n.updatedAt ? ` (updated ${n.updatedAt.slice(0, 10)})` : ""}`).join("\n")
          : "- None",
      )
      return lines.join("\n")
    }

    case "search_platform": {
      const query = String(args.query ?? "").trim()
      if (!query) return "Error: query is required."
      if (studentDbId) {
        const { results } = await searchPlatformForStudent(studentDbId, query)
        if (!results.length) return `No platform matches for "${query}".`
        return results
          .slice(0, 12)
          .map((r) => {
            if (r.kind === "practice_topic") return `- Practice topic: ${r.label} (${r.questionCount} questions)`
            if (r.kind === "lecture") return `- Lecture: ${r.label}${r.week != null ? ` (Week ${r.week})` : ""} → ${r.href}`
            if (r.kind === "announcement") return `- Announcement: ${r.label} → ${r.href}`
            return `- ${r.group}: ${r.label} → ${r.href}`
          })
          .join("\n")
      }
      return `Search for "${query}" — open the matching module in CourseCollab (Practice, Lectures, Grades, Attendance, etc.).`
    }

    case "search_lecture_materials": {
      const query = String(args.query ?? "").trim()
      if (!query) return "Error: query is required."
      if (!session) return "Error: Cora session required."
      return coraApiSearchReleasedLectureMaterials(session, query)
    }

    case "propose_practice_quiz": {
      if (!session || !studentDbId) return "Error: student context required."
      const topic = String(args.topic ?? "").trim()
      if (!topic) return "Error: topic is required."
      const count = args.count != null ? Number(args.count) : 8
      const difficulty = args.difficulty != null ? String(args.difficulty) : "medium"
      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "student",
        institutionId: session.institutionId,
        courseId: session.courseIds[0] ?? null,
        tool: "personalPracticeQuiz.create",
        arguments: { topic, count, difficulty },
        preview: {
          title: "Create practice quiz",
          summary: `${topic} · ${count} questions · ${difficulty}`,
          fields: [
            { label: "Topic", value: topic },
            { label: "Questions", value: String(count) },
            { label: "Difficulty", value: difficulty },
            { label: "Scope", value: "Personal practice" },
          ],
          confirmLabel: "Create practice quiz",
          entityType: "practice_quiz",
        },
      })
      return [
        `I'll prepare a practice quiz on **${topic}**.`,
        "",
        "Confirm in the card below to generate it.",
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }

    case "propose_study_plan": {
      if (!session || !studentDbId) return "Error: student context required."
      const focus = String(args.focus ?? "upcoming assessments and weak topics").trim()
      const title = `Cora study plan · ${focus.slice(0, 48)}`
      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "student",
        institutionId: session.institutionId,
        courseId: session.courseIds[0] ?? null,
        tool: "personalStudyPlan.create",
        arguments: { focus, title },
        preview: {
          title: "Save study plan",
          summary: title,
          fields: [
            { label: "Focus", value: focus },
            { label: "Includes", value: "Calendar sessions and related study artifacts" },
            { label: "Scope", value: "Personal" },
          ],
          confirmLabel: "Save study plan",
          entityType: "study_plan",
        },
      })
      return [
        `I'll prepare a study plan focused on **${focus}**.`,
        "",
        "Confirm in the card below to save calendar sessions and related artifacts.",
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }

    case "get_faculty_course_summary": {
      if (!actor.courseId || !actor.instructorId) return "Error: faculty course context required."
      const courseContext = await fetchFacultyContextForCora({
        courseId: actor.courseId,
        instructorId: actor.instructorId,
        courseCode: actor.courseCode ?? null,
        courseTitle: actor.courseTitle ?? null,
      })
      return formatFacultyContextForPrompt(courseContext)
    }

    case "list_course_announcements": {
      if (!actor.courseId || !actor.instructorId) return "Error: faculty course context required."
      const {
        listCourseAnnouncements,
        formatListedAnnouncementsForCora,
      } = await import("@/lib/cora/services/list-announcements")
      const items = await listCourseAnnouncements({
        instructorId: actor.instructorId,
        courseId: actor.courseId,
        limit: args.limit != null ? Number(args.limit) : 12,
        query: args.query != null ? String(args.query) : null,
      })
      const courseLabel = actor.courseCode || actor.courseTitle || `Course ${actor.courseId}`
      return formatListedAnnouncementsForCora(items, courseLabel)
    }

    case "remember_fact": {
      if (!actor.instructorId && !actor.studentDbId) {
        return "Error: authenticated user context required to remember facts."
      }
      try {
        const content = String(args.content ?? "").trim()
        if (!content) return "Error: content is required."
        const scopeRaw = String(args.scope ?? "global").toLowerCase()
        const scope = scopeRaw === "thread" ? "thread" : "global"
        const { rememberCoraFact } = await import("@/lib/cora/memory/cora-user-memory")
        const role =
          session?.role === "admin"
            ? "admin"
            : session?.role === "faculty" || actor.instructorId
              ? "instructor"
              : "student"
        const userId =
          role === "student"
            ? Number(actor.studentDbId)
            : Number(actor.instructorId ?? session?.claims?.instructorId)
        if (!Number.isFinite(userId)) return "Error: could not resolve user id for memory."
        const threadId =
          args.thread_id != null
            ? String(args.thread_id)
            : actor.threadId != null
              ? String(actor.threadId)
              : null
        const saved = await rememberCoraFact({
          role,
          userId,
          courseId: actor.courseId ?? null,
          scope,
          threadId: scope === "thread" ? threadId : null,
          kind: args.kind != null ? String(args.kind) : "fact",
          content,
          source: "cora_tool",
        })
        if (saved.scope === "global") {
          try {
            const { updateContextProfileFacts } = await import("@/lib/cora/context/user-context-profile")
            await updateContextProfileFacts({
              role,
              userId,
              facts: [saved.content],
            })
          } catch {
            /* profile sync must never fail the tool */
          }
        }
        return `Saved ${saved.scope} memory (#${saved.id}): ${saved.content}`
      } catch (err) {
        return `Error saving memory: ${err instanceof Error ? err.message : "unknown"}`
      }
    }

    case "generate_question_drafts": {
      const prompt = String(args.prompt ?? "").trim()
      if (!prompt) return "Error: prompt is required."
      const count = args.count != null ? Number(args.count) : undefined
      const generated = await generateQuestionDraftsFromPrompt({
        prompt,
        count,
        defaultTopic: actor.courseCode ?? actor.courseTitle ?? "Course",
      })
      const lines = [
        `Generated **${generated.drafts.length}** question draft(s) (topic: ${generated.parsed.topic}, type: ${generated.parsed.questionType}, difficulty: ${generated.parsed.difficulty}).`,
        "Open Question Bank to review/publish. Draft previews:",
        ...generated.drafts.slice(0, 5).map((d, i) => {
          const stem = String((d as { question_text?: string; prompt?: string }).question_text ?? (d as { prompt?: string }).prompt ?? "Draft").slice(0, 160)
          return `${i + 1}. ${stem}`
        }),
        `\n__DRAFTS_JSON__:${JSON.stringify(generated.drafts).slice(0, 14000)}`,
      ]
      return lines.join("\n")
    }

    case "propose_question_bank_create": {
      if (!session || !actor.courseId || !actor.instructorId) {
        return "Error: faculty course context required."
      }
      const prompt = String(args.prompt ?? "").trim()
      if (!prompt) return "Error: prompt is required."
      const count = args.count != null ? Number(args.count) : undefined
      const topicOverride = String(args.topic ?? "").trim()
      const rawMix = Array.isArray(args.type_mix) ? args.type_mix : null
      const typeMix = rawMix
        ?.map((x: { type?: string; count?: number }) => ({
          type: String(x?.type ?? ""),
          count: Number(x?.count ?? 0),
        }))
        .filter((x: { type: string; count: number }) => x.type && x.count > 0)
      const generated = await generateQuestionDraftsFromPrompt({
        prompt,
        count,
        typeMix: typeMix?.length ? typeMix : undefined,
        defaultTopic:
          topicOverride || actor.courseCode || actor.courseTitle || "Course",
      })
      if (!generated.drafts.length) {
        return "Could not generate question drafts for this request."
      }

      const typeCounts = new Map<string, number>()
      for (const d of generated.drafts) {
        const t = String((d as { question_type?: string }).question_type ?? "question")
        typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
      }
      const typeSummary = [...typeCounts.entries()]
        .map(([t, n]) => `${n} ${t}`)
        .join(" · ")

      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "faculty",
        institutionId: session.institutionId,
        courseId: actor.courseId,
        tool: "questionBank.createQuestions",
        arguments: {
          courseId: actor.courseId,
          drafts: generated.drafts,
          topic: generated.parsed.topic,
        },
        preview: {
          title: "Create questions in Question Bank",
          summary: `${generated.drafts.length} questions ready · ${generated.parsed.topic}`,
          fields: [
            { label: "Topic", value: generated.parsed.topic },
            { label: "Count", value: String(generated.drafts.length) },
            { label: "Types", value: typeSummary || generated.parsed.questionType },
            { label: "Difficulty", value: generated.parsed.difficulty },
            {
              label: "Course",
              value: actor.courseCode || actor.courseTitle || `Course ${actor.courseId}`,
            },
          ],
          confirmLabel: "Create in Question Bank",
          entityType: "question",
        },
      })

      return [
        `**${generated.drafts.length} questions ready**`,
        "",
        typeSummary,
        `Topic: ${generated.parsed.topic}`,
        `Difficulty: ${generated.parsed.difficulty}`,
        "",
        "Review the confirmation card, then create them in Question Bank.",
        "",
        ...generated.drafts.slice(0, 8).map((d, i) => {
          const stem = String((d as { question_text?: string }).question_text ?? "Draft").slice(0, 140)
          const qt = String((d as { question_type?: string }).question_type ?? "")
          return `${i + 1}. [${qt}] ${stem}`
        }),
        `\n__DRAFTS_JSON__:${JSON.stringify(generated.drafts).slice(0, 14000)}`,
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }

    case "propose_announcement": {
      if (!session || !actor.courseId || !actor.instructorId) {
        return "Error: faculty course context required."
      }
      const title = String(args.title ?? "").trim()
      const content = String(args.content ?? "").trim()
      if (!title || !content) return "Error: title and content are required."
      const pinned = args.pinned === true
      const courseLabel = actor.courseCode || actor.courseTitle || `Course ${actor.courseId}`

      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "faculty",
        institutionId: session.institutionId,
        courseId: actor.courseId,
        tool: "announcement.publish",
        arguments: {
          courseId: actor.courseId,
          title,
          content,
          pinned,
        },
        preview: {
          title: "Publish announcement",
          summary: title,
          fields: [
            { label: "Audience", value: `${courseLabel} · All students` },
            { label: "Delivery", value: "Publish now" },
            ...(pinned ? [{ label: "Pinned", value: "Yes" }] : []),
          ],
          confirmLabel: "Publish announcement",
          entityType: "announcement",
        },
      })

      return [
        "Here's the announcement I prepared for your course.",
        "",
        `**${title}**`,
        "",
        content,
        "",
        `**Audience:** ${courseLabel}`,
        "**Publish:** Immediately after you confirm",
        "",
        "Use the confirmation card to publish, edit, or cancel.",
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }

    case "propose_assessment_from_bank": {
      if (!session || !actor.courseId || !actor.instructorId) {
        return "Error: faculty course context required."
      }
      const title = String(args.title ?? "").trim()
      if (!title) return "Error: title is required."

      const assessmentTypeRaw = String(args.assessment_type ?? "quiz")
      const assessmentType =
        assessmentTypeRaw === "homework" ||
        assessmentTypeRaw === "mid_semester" ||
        assessmentTypeRaw === "final"
          ? assessmentTypeRaw
          : "quiz"
      const publish = args.publish === true
      let questionIds = Array.isArray(args.question_ids)
        ? args.question_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
        : []

      const topic = String(args.topic ?? "").trim()
      if (questionIds.length === 0 && topic) {
        const { findQuestionBankIdsByTopic } = await import(
          "@/lib/cora/services/create-assessment-from-bank"
        )
        const found = await findQuestionBankIdsByTopic({
          courseId: actor.courseId,
          topic,
          limit: Number(args.question_count) || 10,
        })
        questionIds = found.map((r) => r.id)
        if (questionIds.length === 0) {
          return `No Question Bank items found for topic "${topic}" in this course. Create questions first (propose_question_bank_create), then build the assessment.`
        }
      }
      if (questionIds.length === 0) {
        return "Error: provide question_ids or a topic to look up bank items."
      }

      const typeLabel =
        assessmentType === "homework"
          ? "Homework"
          : assessmentType === "mid_semester"
            ? "Mid-semester exam"
            : assessmentType === "final"
              ? "Final exam"
              : "Quiz"
      const courseLabel = actor.courseCode || actor.courseTitle || `Course ${actor.courseId}`

      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "faculty",
        institutionId: session.institutionId,
        courseId: actor.courseId,
        tool: "assessment.createFromBank",
        arguments: {
          courseId: actor.courseId,
          title,
          description: args.description != null ? String(args.description) : null,
          questionIds,
          assessmentType,
          publish,
        },
        preview: {
          title: publish ? `Publish ${typeLabel}` : `Create ${typeLabel} draft`,
          summary: `${title} · ${questionIds.length} Question Bank items`,
          fields: [
            { label: "Type", value: typeLabel },
            { label: "Questions", value: String(questionIds.length) },
            { label: "Course", value: courseLabel },
            { label: "Visibility", value: publish ? "Published to students" : "Draft (not visible yet)" },
            ...(topic ? [{ label: "Topic filter", value: topic }] : []),
          ],
          confirmLabel: publish ? `Publish ${typeLabel}` : `Create ${typeLabel}`,
          entityType: "assessment",
        },
      })

      return [
        `**${typeLabel} ready:** ${title}`,
        "",
        `${questionIds.length} Question Bank items will be linked.`,
        publish
          ? "Students will see this after you confirm."
          : "This will be created as a draft — you can publish later from the assessment editor.",
        "",
        "Use the confirmation card to create, edit, or cancel.",
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }

    case "propose_message_send": {
      if (!session || !actor.courseId || !actor.instructorId) {
        return "Error: faculty course context required."
      }
      const recipientStudentId = Number(args.recipient_student_id)
      const body = String(args.body ?? "").trim()
      if (!Number.isFinite(recipientStudentId) || recipientStudentId <= 0) {
        return "Error: recipient_student_id is required."
      }
      if (!body) return "Error: message body is required."
      const recipientName =
        String(args.recipient_name ?? "").trim() || `Student ${recipientStudentId}`
      const subject = String(args.subject ?? "").trim()
      const courseLabel = actor.courseCode || actor.courseTitle || `Course ${actor.courseId}`

      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "faculty",
        institutionId: session.institutionId,
        courseId: actor.courseId,
        tool: "message.send",
        arguments: {
          courseId: actor.courseId,
          recipientStudentId,
          subject: subject || null,
          body,
          existingThreadId:
            args.existing_thread_id != null ? Number(args.existing_thread_id) : null,
        },
        preview: {
          title: "Send message",
          summary: subject || body.slice(0, 80),
          fields: [
            { label: "To", value: recipientName },
            { label: "Course", value: courseLabel },
            ...(subject ? [{ label: "Subject", value: subject }] : []),
          ],
          confirmLabel: "Send message",
          entityType: "message",
        },
      })

      return [
        "**Message ready**",
        "",
        `**To:** ${recipientName}`,
        subject ? `**Subject:** ${subject}` : null,
        "",
        body,
        "",
        "Sending requires your confirmation.",
        "",
        serializeProposalForToolResult(proposal),
      ]
        .filter((line) => line != null)
        .join("\n")
    }

    case "analyze_assessment_results": {
      if (!session || !actor.courseId || !actor.instructorId) {
        return "Error: faculty course context required."
      }
      const { analyzeAssessmentResults, findMostRecentlyCompletedAssessment } = await import(
        "@/lib/cora/services/analyze-assessment-results"
      )
      let assessmentId = Number(args.assessment_id)
      const useMostRecent =
        args.use_most_recent === true ||
        !Number.isFinite(assessmentId) ||
        assessmentId <= 0

      if (useMostRecent) {
        try {
          const recent = await findMostRecentlyCompletedAssessment({
            instructorId: actor.instructorId,
            courseId: actor.courseId,
          })
          if (!recent) {
            return (
              "No completed quiz attempts found in this course yet. " +
              "Once students finish a quiz, I can analyze weak concepts and build a remediation plan."
            )
          }
          assessmentId = recent.id
        } catch (error) {
          return `Error: ${error instanceof Error ? error.message : "Failed to find recent quiz."}`
        }
      }

      if (!Number.isFinite(assessmentId) || assessmentId <= 0) {
        return "Error: assessment_id is required (or set use_most_recent=true)."
      }
      try {
        const analysis = await analyzeAssessmentResults({
          instructorId: actor.instructorId,
          courseId: actor.courseId,
          assessmentId,
        })
        return analysis.summaryText
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : "Failed to analyze results."}`
      }
    }

    case "propose_syllabus_section": {
      if (!session || !actor.courseId) {
        return "Error: faculty course context required."
      }
      const sectionTitle = String(args.section_title ?? "").trim()
      const markdown = String(args.markdown ?? "").trim()
      if (!sectionTitle || !markdown) return "Error: section_title and markdown are required."
      const publish = args.publish === true
      const courseLabel = actor.courseCode || actor.courseTitle || `Course ${actor.courseId}`
      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "faculty",
        institutionId: session.institutionId,
        courseId: actor.courseId,
        tool: publish ? "syllabus.publishSection" : "syllabus.saveSection",
        arguments: {
          courseId: actor.courseId,
          sectionTitle,
          markdown,
          sectionType: args.section_type != null ? String(args.section_type) : "text",
          publish,
        },
        preview: {
          title: publish ? "Publish syllabus section" : "Save syllabus section draft",
          summary: sectionTitle,
          fields: [
            { label: "Course", value: courseLabel },
            { label: "Section", value: sectionTitle },
            { label: "Visibility", value: publish ? "Published" : "Draft" },
          ],
          confirmLabel: publish ? "Publish section" : "Save draft",
          entityType: "syllabus",
        },
      })
      return [
        `**Syllabus section ready:** ${sectionTitle}`,
        "",
        markdown.slice(0, 1200),
        markdown.length > 1200 ? "\n…" : "",
        "",
        publish
          ? "Publishing will replace the live syllabus section after you confirm."
          : "This will save as a draft until you publish from Syllabus.",
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }

    case "propose_lecture_shell": {
      if (!session || !actor.courseId) {
        return "Error: faculty course context required."
      }
      const title = String(args.title ?? "").trim()
      const week = Number(args.week)
      if (!title || !Number.isFinite(week)) return "Error: title and week are required."
      const publish = args.publish === true
      const courseLabel = actor.courseCode || actor.courseTitle || `Course ${actor.courseId}`
      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "faculty",
        institutionId: session.institutionId,
        courseId: actor.courseId,
        tool: "lecture.createShell",
        arguments: {
          courseId: actor.courseId,
          title,
          week,
          description: args.description != null ? String(args.description) : null,
          objectives: Array.isArray(args.objectives)
            ? args.objectives.map((o) => String(o))
            : [],
          publish,
        },
        preview: {
          title: "Create lecture shell",
          summary: `${title} · Week ${week}`,
          fields: [
            { label: "Course", value: courseLabel },
            { label: "Week", value: String(week) },
            { label: "Visibility", value: publish ? "Published" : "Unpublished shell" },
          ],
          confirmLabel: "Create lecture",
          entityType: "lecture",
        },
      })
      return [
        `**Lecture shell ready:** ${title}`,
        `Week ${week}`,
        args.description ? `\n${String(args.description)}\n` : "",
        "Confirm to create the shell in Lectures (attach materials afterward).",
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }

    case "propose_faculty_capability": {
      if (!session || !actor.courseId || !actor.instructorId) {
        return "Error: faculty course context required."
      }
      const capabilityId = String(args.capability_id ?? "").trim()
      if (!capabilityId) return "Error: capability_id is required."
      const previewTitle = String(args.preview_title ?? "").trim() || capabilityId
      const previewSummary = String(args.preview_summary ?? "").trim() || capabilityId
      const confirmLabel = String(args.confirm_label ?? "").trim() || undefined
      const capabilityArgs =
        args.arguments != null && typeof args.arguments === "object" && !Array.isArray(args.arguments)
          ? (args.arguments as Record<string, unknown>)
          : {}
      const courseLabel = actor.courseCode || actor.courseTitle || `Course ${actor.courseId}`

      const { proposeRegistryCapability } = await import("@/lib/cora/services/capability-propose-route")
      return proposeRegistryCapability({
        role: "faculty",
        session,
        capabilityId,
        capabilityArgs,
        previewTitle,
        previewSummary,
        confirmLabel,
        courseId: actor.courseId,
        courseLabel,
        executeDedicatedTool: (dedicatedTool, delegatedArgs) =>
          executeCoraToolImpl(actor, dedicatedTool, delegatedArgs),
      })
    }

    case "propose_student_capability": {
      if (!session || !studentDbId) return "Error: student context required."
      const capabilityId = String(args.capability_id ?? "").trim()
      if (!capabilityId) return "Error: capability_id is required."
      const previewTitle = String(args.preview_title ?? "").trim() || capabilityId
      const previewSummary = String(args.preview_summary ?? "").trim() || capabilityId
      const confirmLabel = String(args.confirm_label ?? "").trim() || undefined
      const capabilityArgs =
        args.arguments != null && typeof args.arguments === "object" && !Array.isArray(args.arguments)
          ? (args.arguments as Record<string, unknown>)
          : {}

      const { proposeRegistryCapability } = await import("@/lib/cora/services/capability-propose-route")
      return proposeRegistryCapability({
        role: "student",
        session,
        capabilityId,
        capabilityArgs,
        previewTitle,
        previewSummary,
        confirmLabel,
        courseId: session.courseIds[0] ?? null,
        executeDedicatedTool: (dedicatedTool, delegatedArgs) =>
          executeCoraToolImpl(actor, dedicatedTool, delegatedArgs),
      })
    }

    case "create_faculty_flashcard_deck": {
      if (!session || !actor.courseId || !actor.instructorId) {
        return "Error: faculty course context required."
      }
      const topic = String(args.topic ?? "").trim()
      if (!topic) return "Error: topic is required."
      const cardCountRaw = Number(args.card_count)
      const maxCards =
        Number.isFinite(cardCountRaw) && cardCountRaw > 0
          ? Math.min(Math.max(Math.round(cardCountRaw), 4), 40)
          : 20
      const courseLabel = actor.courseCode || actor.courseTitle || `Course ${actor.courseId}`
      const sessionLabel =
        args.section_id != null && Number.isFinite(Number(args.section_id))
          ? String(args.section_id)
          : null

      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "faculty",
        institutionId: session.institutionId,
        courseId: actor.courseId,
        tool: "flashcard.generateFromBank",
        arguments: {
          courseId: actor.courseId,
          topicName: topic,
          maxCards,
          session: sessionLabel,
        },
        preview: {
          title: "Generate flashcard deck",
          summary: `${topic} · up to ${maxCards} cards`,
          fields: [
            { label: "Course", value: courseLabel },
            { label: "Topic", value: topic },
            { label: "Source", value: "Question bank" },
            { label: "Max cards", value: String(maxCards) },
          ],
          confirmLabel: "Generate flashcards",
          entityType: "flashcard_deck",
        },
      })

      return [
        `I'll generate a **course flashcard deck** on **${topic}** from your question bank.`,
        "",
        `**Course:** ${courseLabel}`,
        `**Max cards:** ${maxCards}`,
        "",
        "Confirm in the card below to create the deck in Flashcards.",
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }

    case "propose_remediation_quiz_plan": {
      if (!session || !actor.courseId || !actor.instructorId) {
        return "Error: faculty course context required."
      }
      const quizTitle = String(args.quiz_title ?? "").trim()
      if (!quizTitle) return "Error: quiz_title is required."

      let questionIds = Array.isArray(args.question_ids)
        ? args.question_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
        : []
      const topic = String(args.topic ?? "").trim()
      if (questionIds.length === 0 && topic) {
        const { findQuestionBankIdsByTopic } = await import(
          "@/lib/cora/services/create-assessment-from-bank"
        )
        const found = await findQuestionBankIdsByTopic({
          courseId: actor.courseId,
          topic,
          limit: Number(args.question_count) || 10,
        })
        questionIds = found.map((r) => r.id)
      }
      if (questionIds.length === 0) {
        return "No Question Bank items available for this remediation plan. Create questions first (propose_question_bank_create), then retry."
      }

      const { buildRemediationQuizTransactionPlan, serializePlanForToolResult } = await import(
        "@/lib/cora/confirmations/transaction-plans"
      )
      const courseLabel = actor.courseCode || actor.courseTitle || `Course ${actor.courseId}`
      const assessmentTypeRaw = String(args.assessment_type ?? "quiz")
      const assessmentType =
        assessmentTypeRaw === "homework" ||
        assessmentTypeRaw === "mid_semester" ||
        assessmentTypeRaw === "final"
          ? assessmentTypeRaw
          : "quiz"
      const plan = buildRemediationQuizTransactionPlan({
        courseLabel,
        courseId: actor.courseId,
        userId: session.userId,
        institutionId: session.institutionId,
        quizTitle,
        questionIds,
        weakTopics: Array.isArray(args.weak_topics)
          ? args.weak_topics.map((t) => String(t))
          : topic
            ? [topic]
            : [],
        assessmentType,
        publish: args.publish === true,
      })

      return [
        `### Remediation plan · ${courseLabel}`,
        "",
        plan.summary,
        "",
        ...plan.operations.map((op, i) => `${i + 1}. **${op.label}** (${op.risk})`),
        "",
        "Confirm the plan card to execute these steps in order.",
        "",
        serializePlanForToolResult(plan),
      ].join("\n")
    }

    case "propose_personal_flashcards": {
      if (!session || !studentDbId) return "Error: student context required."
      const topic = String(args.topic ?? "").trim()
      if (!topic) return "Error: topic is required."
      const title = String(args.title ?? "").trim() || `Flashcards · ${topic}`
      const cardCount = Number(args.card_count) || 8
      const cards = Array.isArray(args.cards)
        ? (args.cards as { front?: unknown; back?: unknown }[])
            .map((c) => ({
              front: String(c?.front ?? "").trim(),
              back: String(c?.back ?? "").trim(),
            }))
            .filter((c) => c.front && c.back)
            .slice(0, 20)
        : []

      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "student",
        institutionId: session.institutionId,
        courseId: session.courseIds[0] ?? null,
        tool: "personalFlashcards.createDeck",
        arguments: {
          topic,
          title,
          cardCount: cards.length > 0 ? cards.length : cardCount,
          cards,
        },
        preview: {
          title: "Create personal flashcard deck",
          summary:
            cards.length > 0
              ? `${title} · ${cards.length} cards ready`
              : `${title} · ~${cardCount} cards`,
          fields: [
            { label: "Topic", value: topic },
            {
              label: "Cards",
              value: cards.length > 0 ? String(cards.length) : String(cardCount),
            },
            { label: "Scope", value: "Personal (only you)" },
          ],
          confirmLabel: "Create flashcards",
          entityType: "flashcard_deck",
        },
      })

      return [
        `I'll prepare a personal flashcard deck on **${topic}**.`,
        "",
        "Confirm in the card below to save it to My Flashcards.",
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }

    case "propose_personal_note": {
      if (!session || !studentDbId) return "Error: student context required."
      const topic = String(args.topic ?? "").trim()
      if (!topic) return "Error: topic is required."
      const title = String(args.title ?? "").trim() || `Cora notes: ${topic.slice(0, 60)}`
      const content = args.content != null ? String(args.content) : ""

      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "student",
        institutionId: session.institutionId,
        courseId: session.courseIds[0] ?? null,
        tool: "personalNotes.create",
        arguments: {
          topic,
          title,
          bodyText: content,
        },
        preview: {
          title: "Save study note",
          summary: title,
          fields: [
            { label: "Topic", value: topic },
            { label: "Scope", value: "Personal (My Notes)" },
          ],
          confirmLabel: "Save to My Notes",
          entityType: "note",
        },
      })

      return [
        content
          ? `Here's a note draft for **${topic}**. Confirm to save it to My Notes.`
          : `I'll write a study note on **${topic}** and save it after you confirm.`,
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }

    case "propose_calendar_study_sessions": {
      if (!session || !studentDbId) return "Error: student context required."
      const { authorizeCreatePersonalCalendar } = await import(
        "@/lib/cora/security/student-resource-auth"
      )
      const gate = authorizeCreatePersonalCalendar(session, studentDbId)
      if (!gate.ok) return `Denied: ${gate.reason}`

      const rawSessions = Array.isArray(args.sessions) ? args.sessions : []
      const sessions = rawSessions
        .map((s) => {
          const row = s as Record<string, unknown>
          const title = String(row.title ?? "").trim()
          const startTime = String(row.start_time ?? "").trim()
          if (!title || !startTime) return null
          const duration = Number(row.duration_minutes)
          let endTime = row.end_time != null ? String(row.end_time) : null
          if (!endTime && Number.isFinite(duration) && duration > 0) {
            const start = new Date(startTime.includes("T") ? startTime : startTime.replace(" ", "T"))
            if (!Number.isNaN(start.getTime())) {
              endTime = new Date(start.getTime() + duration * 60_000).toISOString()
            }
          }
          return {
            title,
            description: row.description != null ? String(row.description) : null,
            startTime,
            endTime,
            eventType: "study_session",
          }
        })
        .filter(Boolean) as {
        title: string
        description: string | null
        startTime: string
        endTime: string | null
        eventType: string
      }[]

      if (!sessions.length) return "Error: at least one valid session (title + start_time) is required."

      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "student",
        institutionId: session.institutionId,
        courseId: session.courseIds[0] ?? null,
        tool: "personalCalendar.createEvents",
        arguments: { sessions },
        preview: {
          title: "Create study sessions",
          summary: `${sessions.length} personal calendar event${sessions.length === 1 ? "" : "s"}`,
          fields: sessions.slice(0, 5).map((s, i) => ({
            label: `Session ${i + 1}`,
            value: `${s.title} · ${s.startTime}`,
          })),
          confirmLabel: "Set up my plan",
          entityType: "calendar_events",
        },
      })

      return [
        `**Study plan ready** — ${sessions.length} session${sessions.length === 1 ? "" : "s"} prepared.`,
        "",
        ...sessions.map((s) => `- ${s.title} · ${s.startTime}`),
        "",
        "Confirm in the card to add these to your calendar.",
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }

    case "get_assessment_integrity": {
      if (!session || !studentDbId) return "Error: student context required."
      const {
        resolveAssessmentIntegrityContext,
        formatAssessmentIntegrityForPrompt,
      } = await import("@/lib/cora/security/assessment-integrity")
      const assessmentId =
        args.assessment_id != null && Number.isFinite(Number(args.assessment_id))
          ? Number(args.assessment_id)
          : null
      const ctx = await resolveAssessmentIntegrityContext(studentDbId, assessmentId)
      return formatAssessmentIntegrityForPrompt(ctx)
    }

    case "review_released_attempt": {
      if (!session || !studentDbId) return "Error: student context required."
      const { resolveAssessmentIntegrityContext } = await import(
        "@/lib/cora/security/assessment-integrity"
      )
      const assessmentId =
        args.assessment_id != null && Number.isFinite(Number(args.assessment_id))
          ? Number(args.assessment_id)
          : null
      const ctx = await resolveAssessmentIntegrityContext(studentDbId, assessmentId)
      if (ctx.coraPolicy !== "review" || !ctx.answersReleased) {
        return (
          ctx.reason ??
          "Results are not released yet. I can help with study planning, but I can't review this attempt until your instructor releases results."
        )
      }

      const rows = (await sql`
        SELECT
          qa.score,
          qa.total_questions,
          qa.completed_at,
          q.title,
          q.assessment_type
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON q.id = qa.quiz_id
        WHERE qa.id = ${ctx.attemptId}
          AND qa.student_id = ${studentDbId}
        LIMIT 1
      `) as {
        score: number | null
        total_questions: number | null
        completed_at: string | null
        title: string | null
        assessment_type: string | null
      }[]

      const row = rows[0]
      if (!row) return "Could not load your released attempt."

      const score = row.score != null ? Number(row.score) : null
      const total = row.total_questions != null ? Number(row.total_questions) : null
      const pct =
        score != null && total != null && total > 0
          ? Math.round((score / total) * 100)
          : score != null
            ? Math.round(score)
            : null

      return [
        `**Review: ${row.title ?? "Assessment"}**`,
        pct != null ? `You scored **${pct}%**${total != null ? ` (${score}/${total})` : ""}.` : "Score on file.",
        "",
        "Allowed next steps: explain mistakes, teach concepts, generate similar practice, create flashcards.",
        "Ask me to focus on a weak topic, or say “create flashcards from what I missed.”",
        "",
        `Integrity: policy=${ctx.coraPolicy} · capabilities=${ctx.allowedCapabilities.join(", ")}`,
      ].join("\n")
    }

    case "get_admin_platform_snapshot": {
      if (!session) return "Error: Cora session required."
      return coraApiAdminPlatformSnapshot(session)
    }

    case "get_admin_revenue_summary": {
      if (!session) return "Error: Cora session required."
      return coraApiAdminRevenueSummary(session)
    }

    case "get_admin_security_overview": {
      if (!session) return "Error: Cora session required."
      return coraApiAdminSecurityOverview(session)
    }

    case "get_admin_governance_hints": {
      if (!session) return "Error: Cora session required."
      return coraApiAdminGovernanceHints(session)
    }

    case "search_admin_faculty": {
      if (!session) return "Error: Cora session required."
      const { searchAdminFaculty } = await import("@/lib/cora/services/admin-directory-services")
      return searchAdminFaculty({
        search: args.search != null ? String(args.search) : null,
        limit: args.limit != null ? Number(args.limit) : undefined,
      })
    }
    case "search_admin_students": {
      if (!session) return "Error: Cora session required."
      const { searchAdminStudents } = await import("@/lib/cora/services/admin-directory-services")
      return searchAdminStudents({
        search: args.search != null ? String(args.search) : null,
        limit: args.limit != null ? Number(args.limit) : undefined,
      })
    }
    case "search_admin_courses": {
      if (!session) return "Error: Cora session required."
      const { searchAdminCourses } = await import("@/lib/cora/services/admin-directory-services")
      return searchAdminCourses({
        search: args.search != null ? String(args.search) : null,
        limit: args.limit != null ? Number(args.limit) : undefined,
      })
    }
    case "list_admin_academic_terms": {
      if (!session) return "Error: Cora session required."
      const { listAdminAcademicTerms } = await import("@/lib/cora/services/admin-directory-services")
      return listAdminAcademicTerms({
        limit: args.limit != null ? Number(args.limit) : undefined,
      })
    }
    case "get_admin_student_success": {
      if (!session) return "Error: Cora session required."
      const { getAdminStudentSuccessSummary } = await import(
        "@/lib/cora/services/admin-directory-services"
      )
      return getAdminStudentSuccessSummary()
    }
    case "get_admin_enrollment_analytics": {
      if (!session) return "Error: Cora session required."
      const { getAdminEnrollmentAnalyticsSummary } = await import(
        "@/lib/cora/services/admin-directory-services"
      )
      return getAdminEnrollmentAnalyticsSummary()
    }
    case "list_admin_password_resets": {
      if (!session) return "Error: Cora session required."
      const { listAdminPasswordResets } = await import("@/lib/cora/services/admin-directory-services")
      return listAdminPasswordResets({
        status: args.status != null ? String(args.status) : "pending",
        limit: args.limit != null ? Number(args.limit) : undefined,
      })
    }
    case "propose_admin_password_reset_decision": {
      if (!session || session.role !== "admin") {
        return "Error: admin session required."
      }
      const requestId = Number(args.request_id)
      const decision = String(args.decision ?? "").toLowerCase() === "reject" ? "reject" : "approve"
      if (!Number.isFinite(requestId) || requestId <= 0) return "Error: request_id is required."
      const studentLabel = String(args.student_label ?? `Request #${requestId}`)
      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "admin",
        institutionId: session.institutionId,
        courseId: null,
        tool:
          decision === "approve"
            ? "account.passwordReset.approve"
            : "account.passwordReset.reject",
        arguments: {
          requestId,
          decision,
          notes: args.notes != null ? String(args.notes) : null,
        },
        preview: {
          title: decision === "approve" ? "Approve password reset" : "Reject password reset",
          summary: studentLabel,
          fields: [
            { label: "Request", value: String(requestId) },
            { label: "Decision", value: decision },
            ...(args.notes ? [{ label: "Notes", value: String(args.notes) }] : []),
          ],
          confirmLabel: decision === "approve" ? "Approve reset" : "Reject request",
          entityType: "account",
        },
      })
      return [
        `**Password reset ${decision} ready**`,
        "",
        studentLabel,
        "",
        "Confirm in the action card to apply this decision (audited).",
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }
    case "list_faculty_access_requests": {
      if (!session || session.role !== "faculty") return "Error: faculty session required."
      const courseId = actor.courseId ?? session.courseIds[0]
      if (courseId == null) return "Error: select a course first."
      const { listFacultyApprovableAccessRequests, formatAccessRequestListMarkdown } = await import(
        "@/lib/cora/services/access-governance-services"
      )
      const items = await listFacultyApprovableAccessRequests({
        instructorId: session.userId,
        courseId,
        status: args.status != null ? String(args.status) : "pending",
        limit: args.limit != null ? Number(args.limit) : undefined,
      })
      return formatAccessRequestListMarkdown(items, "**Pending access requests (your course scope)**")
    }
    case "propose_faculty_access_request_decision": {
      if (!session || session.role !== "faculty") return "Error: faculty session required."
      const requestId = Number(args.request_id)
      const decision = String(args.decision ?? "").toLowerCase() === "reject" ? "reject" : "approve"
      if (!Number.isFinite(requestId) || requestId <= 0) return "Error: request_id is required."
      const label = String(args.applicant_label ?? `Request #${requestId}`)
      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "faculty",
        institutionId: session.institutionId,
        courseId: actor.courseId ?? session.courseIds[0] ?? null,
        tool: decision === "approve" ? "account.accessRequest.approve" : "account.accessRequest.reject",
        arguments: {
          requestId,
          decision,
          reason: args.reason != null ? String(args.reason) : null,
        },
        preview: {
          title: decision === "approve" ? "Approve access request" : "Reject access request",
          summary: label,
          fields: [
            { label: "Request", value: String(requestId) },
            { label: "Decision", value: decision },
            ...(args.reason ? [{ label: "Reason", value: String(args.reason) }] : []),
          ],
          confirmLabel: decision === "approve" ? "Approve access" : "Reject request",
          entityType: "account",
        },
      })
      return [
        `**Access request ${decision} ready**`,
        "",
        label,
        "",
        "Confirm in the action card to apply (audited, scope-checked).",
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }
    case "list_admin_access_requests": {
      if (!session || session.role !== "admin") return "Error: admin session required."
      const { listAdminAccessRequests, formatAccessRequestListMarkdown } = await import(
        "@/lib/cora/services/access-governance-services"
      )
      const items = await listAdminAccessRequests({
        status: args.status != null ? String(args.status) : "pending",
        accountType: args.account_type != null ? String(args.account_type) : null,
        limit: args.limit != null ? Number(args.limit) : undefined,
      })
      return formatAccessRequestListMarkdown(items, "**Platform access requests**")
    }
    case "propose_admin_access_request_decision": {
      if (!session || session.role !== "admin") return "Error: admin session required."
      const requestId = Number(args.request_id)
      const decision = String(args.decision ?? "").toLowerCase() === "reject" ? "reject" : "approve"
      if (!Number.isFinite(requestId) || requestId <= 0) return "Error: request_id is required."
      const label = String(args.applicant_label ?? `Request #${requestId}`)
      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "admin",
        institutionId: session.institutionId,
        courseId: null,
        tool: decision === "approve" ? "account.accessRequest.approve" : "account.accessRequest.reject",
        arguments: {
          requestId,
          decision,
          reason: args.reason != null ? String(args.reason) : null,
        },
        preview: {
          title: decision === "approve" ? "Approve access request" : "Reject access request",
          summary: label,
          fields: [
            { label: "Request", value: String(requestId) },
            { label: "Decision", value: decision },
            ...(args.reason ? [{ label: "Reason", value: String(args.reason) }] : []),
          ],
          confirmLabel: decision === "approve" ? "Approve access" : "Reject request",
          entityType: "account",
        },
      })
      return [
        `**Access request ${decision} ready**`,
        "",
        label,
        "",
        "Confirm in the action card to apply (audited).",
        "",
        serializeProposalForToolResult(proposal),
      ].join("\n")
    }
    case "search_admin_submission_issues": {
      if (!session) return "Error: Cora session required."
      const { searchAdminSubmissionIssues } = await import(
        "@/lib/cora/services/admin-directory-services"
      )
      return searchAdminSubmissionIssues({
        status: args.status != null ? String(args.status) : "open",
        limit: args.limit != null ? Number(args.limit) : undefined,
      })
    }
    case "search_admin_system_logs": {
      if (!session) return "Error: Cora session required."
      const { searchAdminSystemLogs } = await import("@/lib/cora/services/admin-directory-services")
      return searchAdminSystemLogs({
        search: args.search != null ? String(args.search) : null,
        severity: args.severity != null ? String(args.severity) : null,
        limit: args.limit != null ? Number(args.limit) : undefined,
      })
    }
    case "search_admin_audit_logs": {
      if (!session) return "Error: Cora session required."
      const { searchAdminAuditLogs } = await import("@/lib/cora/services/admin-directory-services")
      return searchAdminAuditLogs({
        search: args.search != null ? String(args.search) : null,
        limit: args.limit != null ? Number(args.limit) : undefined,
      })
    }
    case "list_discoverable_courses": {
      if (!session || session.role !== "faculty") return "Error: faculty session required."
      const { coraListDiscoverableCourses, formatDiscoverableCoursesMarkdown } = await import(
        "@/lib/cora/services/course-exchange-services"
      )
      const courses = await coraListDiscoverableCourses({
        instructorId: session.userId,
        query: args.query != null ? String(args.query) : null,
      })
      return formatDiscoverableCoursesMarkdown(courses)
    }
    case "propose_course_exchange_request": {
      if (!session || session.role !== "faculty") return "Error: faculty session required."
      const sourceCourseId = Number(args.source_course_id)
      if (!Number.isFinite(sourceCourseId)) return "Error: source_course_id is required."
      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "faculty",
        institutionId: session.institutionId,
        courseId: actor.courseId ?? session.courseIds[0] ?? null,
        tool: "courseExchange.request",
        arguments: {
          sourceCourseId,
          purpose: args.purpose != null ? String(args.purpose) : null,
        },
        preview: {
          title: "Request course materials",
          summary: String(args.course_label ?? `Course #${sourceCourseId}`),
          fields: [
            { label: "Source course", value: String(sourceCourseId) },
            ...(args.purpose ? [{ label: "Purpose", value: String(args.purpose) }] : []),
          ],
          confirmLabel: "Send request",
          entityType: "course",
        },
      })
      return ["**Course Exchange request ready**", "", "Confirm to notify the course creator.", "", serializeProposalForToolResult(proposal)].join("\n")
    }
    case "propose_course_exchange_approval": {
      if (!session || session.role !== "faculty") return "Error: faculty session required."
      const requestId = Number(args.request_id)
      if (!Number.isFinite(requestId)) return "Error: request_id is required."
      const decision = String(args.decision ?? "approve").toLowerCase() === "reject" ? "reject" : "approve"
      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "faculty",
        institutionId: session.institutionId,
        courseId: actor.courseId ?? session.courseIds[0] ?? null,
        tool: decision === "approve" ? "courseExchange.approve" : "courseExchange.reject",
        arguments: {
          requestId,
          decision,
          approvedModules: args.approved_modules,
          reason: args.reason != null ? String(args.reason) : null,
        },
        preview: {
          title: decision === "approve" ? "Approve Course Exchange" : "Reject Course Exchange",
          summary: String(args.requester_label ?? `Request #${requestId}`),
          fields: [{ label: "Request", value: String(requestId) }, { label: "Decision", value: decision }],
          confirmLabel: decision === "approve" ? "Approve & select content" : "Reject",
          entityType: "course",
        },
      })
      return ["**Course Exchange decision ready**", "", "Confirm in the action card.", "", serializeProposalForToolResult(proposal)].join("\n")
    }
    case "propose_course_exchange_import": {
      if (!session || session.role !== "faculty") return "Error: faculty session required."
      const requestId = Number(args.request_id)
      const destinationCourseId = Number(args.destination_course_id)
      if (!Number.isFinite(requestId) || !Number.isFinite(destinationCourseId)) {
        return "Error: request_id and destination_course_id are required."
      }
      const proposal = createCoraActionProposal({
        userId: session.userId,
        role: "faculty",
        institutionId: session.institutionId,
        courseId: destinationCourseId,
        tool: "courseExchange.importCopy",
        arguments: {
          requestId,
          destinationCourseId,
          destinationSessionId:
            args.destination_session_id != null ? Number(args.destination_session_id) : null,
        },
        preview: {
          title: "Import approved course copy",
          summary: `Request #${requestId} → course #${destinationCourseId}`,
          fields: [
            { label: "Request", value: String(requestId) },
            { label: "Destination", value: String(destinationCourseId) },
          ],
          confirmLabel: "Approve & create copy",
          entityType: "course",
        },
      })
      return ["**Course copy import ready**", "", "Creates an independent copy — original stays unchanged.", "", serializeProposalForToolResult(proposal)].join("\n")
    }

    default:
      return `Unknown tool: ${toolName}`
  }
}

export async function executeCoraTool(
  actor: CoraToolActor,
  toolName: CoraAgentToolName,
  args: Record<string, unknown>,
): Promise<string> {
  const { sanitizeCoraToolResult } = await import("@/lib/cora/disclosure/sanitize-tool-result")
  try {
    return sanitizeCoraToolResult(await executeCoraToolImpl(actor, toolName, args), { toolName })
  } catch (error) {
    return sanitizeCoraToolResult("", { toolName, error })
  }
}
