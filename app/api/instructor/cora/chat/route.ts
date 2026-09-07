import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  buildFacultyCapabilityPrompt,
  FACULTY_CORA_SYSTEM_POLICY,
} from "@/lib/cora/faculty-copilot-policy"
import { buildFacultyToolCatalogPacket } from "@/lib/cora/capabilities/faculty-tool-registry"
import { DEFAULT_FACULTY_CAPABILITY_MODULES } from "@/lib/cora/capabilities/faculty-module-registry"
import {
  buildHardDenyRefusal,
  detectHardDeniedIntent,
} from "@/lib/cora/agent/clearances"
import { buildFacultyCoraSession, logCoraAuditEvent } from "@/lib/cora/security"
import { runCoraAgentRuntime } from "@/lib/cora/agent/runtime"
import { coraUiFromProposals } from "@/lib/cora/models/ui-payloads"
import { resolveCoraDynamicRoute } from "@/lib/cora/ai/dynamic-router"
import { loadCoraCourseRoutingPolicy } from "@/lib/cora/models/load-course-policy"
import { buildPublicCoraChatFields } from "@/lib/cora/models/public-route"
import {
  shouldSuggestAutomation,
  shouldSuggestQuestionGeneration,
} from "@/lib/cora/faculty-cora-generate-questions"
import {
  buildFacultyCoraPreferencesPrompt,
  mergeFacultyCoraPreferences,
  type FacultyCoraPreferences,
} from "@/lib/cora/faculty-preferences-storage"
import OpenAI from "openai"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

type ChatMessage = { role: "user" | "assistant"; content: string }

export type FacultyCoraChatAction = {
  id: string
  label: string
  kind:
    | "generate_questions"
    | "open_quiz_create"
    | "schedule_automation"
    | "open_flashcards"
    | "import_from_course"
    | "submit_github_fix"
    | "open_module"
    | "confirm_expensive_task"
  payload: Record<string, unknown>
}

function buildChatActions(
  message: string,
  capabilityId?: string,
  prefs?: FacultyCoraPreferences,
): FacultyCoraChatAction[] {
  if (prefs && !prefs.showActionChips) return []
  const actions: FacultyCoraChatAction[] = []

  if (
    prefs?.suggestQuestionDrafts !== false &&
    (shouldSuggestQuestionGeneration(message, capabilityId) ||
      /\b(generate|create|draft)\b.{0,40}\b(question|quiz)/i.test(message))
  ) {
    actions.push({
      id: "generate-questions",
      label: "Open drafts in Question Bank",
      kind: "generate_questions",
      payload: { prompt: message },
    })
  }

  if (/\b(create|build|draft|new)\b.{0,30}\b(quiz|homework|exam|assessment)/i.test(message)) {
    actions.push({
      id: "open-quiz-create",
      label: "Open quiz editor",
      kind: "open_quiz_create",
      payload: { prompt: message },
    })
  }

  if (
    prefs?.suggestFlashcardsAfterLecture !== false &&
    /\b(create|make|generate)\b.{0,30}\bflashcard/i.test(message)
  ) {
    actions.push({
      id: "open-flashcards",
      label: "Open Flashcards",
      kind: "open_flashcards",
      payload: { prompt: message },
    })
  }

  if (/\b(announce|announcement|tell my students|running late|minutes late|post to (the )?class)\b/i.test(message)) {
    // Agent tools handle propose_announcement; avoid scheduling automation chip when publishing now
  } else if (prefs?.suggestAutomations !== false && shouldSuggestAutomation(message, capabilityId)) {
    const weekly = /weekly|every week|each week/i.test(message)
    const flashcards = /flashcard|after lecture|post-lecture/i.test(message)
    actions.push({
      id: "schedule-automation",
      label: weekly ? "Schedule weekly announcement" : "Schedule automation",
      kind: "schedule_automation",
      payload: {
        jobType: flashcards ? "post_lecture_flashcards" : "weekly_announcement",
        notes: message,
        runInHours: weekly ? 24 * 7 : 24,
      },
    })
  }

  if (/\b(import|pull|load)\b.{0,40}\b(from course|question bank|quiz|homework)\b/i.test(message)) {
    actions.push({
      id: "import-from-course",
      label: "Import from course",
      kind: "import_from_course",
      payload: {},
    })
  }

  if (
    /\b(github|pull request|\bpr\b|submit.?fix|open a pr|code fix)\b/i.test(message) ||
    capabilityId === "improve"
  ) {
    if (/\b(github|pull request|\bpr\b|submit.?fix|open a pr|patch|diff)\b/i.test(message)) {
      actions.push({
        id: "submit-github-fix",
        label: "Submit GitHub fix",
        kind: "submit_github_fix",
        payload: { prompt: message },
      })
    }
  }

  return actions
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = (await request.json()) as {
      message?: string
      capabilityId?: string
      /** Client chat thread id — scopes thread memory + continuity. */
      threadId?: string | null
      conversationHistory?: ChatMessage[]
      confirmExpensiveTask?: boolean
      confirmScopeRelated?: boolean
      declaredAcademicContext?: string | null
      domainHint?: import("@/lib/cora/ai/dynamic-router").CoraTaskDomain | null
      preferences?: Partial<FacultyCoraPreferences> | null
      problemContext?: {
        title?: string
        questionText?: string
        questionType?: string
        expectedAnswer?: string | null
        hint?: string | null
        explanation?: string | null
        source?: string
        topic?: string
      } | null
    }

    const message = String(body.message ?? "").trim()
    if (!message || message.length > 8000) {
      return NextResponse.json({ error: "Message required (max 8000 chars)" }, { status: 400 })
    }

    const problem = body.problemContext
    const problemBlock =
      problem?.questionText?.trim()
        ? [
            "",
            "[Imported course question]",
            problem.title ? `Title: ${problem.title}` : null,
            problem.source ? `Source: ${problem.source}` : null,
            problem.topic ? `Topic: ${problem.topic}` : null,
            problem.questionType ? `Type: ${problem.questionType}` : null,
            `Question: ${problem.questionText}`,
            problem.expectedAnswer ? `Expected answer: ${problem.expectedAnswer}` : null,
            problem.hint ? `Hint: ${problem.hint}` : null,
            problem.explanation ? `Explanation: ${problem.explanation}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : ""

    const userMessage = `${message}${problemBlock}`.slice(0, 12000)

    const forbidden = detectHardDeniedIntent("copilot", message)
    if (forbidden) {
      const blockedSession = await buildFacultyCoraSession({
        instructorId: scope.instructorId,
        courseId: scope.course.id,
        courseCode: scope.course.course_code ?? null,
        courseTitle: scope.course.course_title ?? null,
      })
      void logCoraAuditEvent({
        session: blockedSession,
        action: "cora.chat.blocked",
        outcome: "blocked",
        promptText: message,
        errorMessage: forbidden,
      })
      return NextResponse.json({
        reply: buildHardDenyRefusal(forbidden),
        restricted: true,
        actions: [],
      })
    }

    {
      const scopeSession = await buildFacultyCoraSession({
        instructorId: scope.instructorId,
        courseId: scope.course.id,
        courseCode: scope.course.course_code ?? null,
        courseTitle: scope.course.course_title ?? null,
      })
      const { evaluateCoraDisclosureGate } = await import("@/lib/cora/disclosure")
      const disclosure = await evaluateCoraDisclosureGate({
        role: "faculty",
        message,
        conversationHistory: (body.conversationHistory ?? []).slice(-8),
        session: scopeSession,
      })
      if (disclosure.decision !== "ALLOW" && disclosure.userMessage) {
        return NextResponse.json({
          reply: disclosure.userMessage,
          restricted: true,
          creditsCharged: 0,
          actions: [],
        })
      }
      const { evaluateCoraPurposeScope } = await import("@/lib/cora/scope")
      const scopeEval = await evaluateCoraPurposeScope({
        session: scopeSession,
        role: "faculty",
        message,
        conversationHistory: (body.conversationHistory ?? []).slice(-8),
        confirmScopeRelated: Boolean(body.confirmScopeRelated),
        declaredAcademicContext: body.declaredAcademicContext
          ? String(body.declaredAcademicContext)
          : null,
      })
      if (scopeEval.shouldEnforce && scopeEval.userMessage) {
        return NextResponse.json({
          reply: scopeEval.userMessage,
          restricted: true,
          scopeRedirect: true,
          scopeDecision: scopeEval.decision,
          scopeEventId: scopeEval.scopeEventId ?? null,
          offerScopeFeedback: Boolean(scopeEval.offerFeedback),
          creditsCharged: 0,
          actions: [],
        })
      }
    }

    if (!openai) {
      return NextResponse.json({ error: "AI is not configured." }, { status: 503 })
    }

    const {
      getInstructorCoraBalance,
      estimateCoraCreditsForMessage,
      isCoraLiteEligible,
      estimateExpensiveCoraTask,
      expensiveTaskConfirmationPayload,
    } = await import("@/lib/cora/credits")
    const bal = await getInstructorCoraBalance(scope.instructorId)
    const expensive = estimateExpensiveCoraTask(message)
    const estimated = Math.max(estimateCoraCreditsForMessage(message), expensive.estimateLow)
    const confirmExpensiveTask = Boolean(body.confirmExpensiveTask)
    const prefs = mergeFacultyCoraPreferences(body.preferences)

    if (prefs.confirmExpensiveTasks && expensive.requiresConfirmation && !confirmExpensiveTask) {
      return NextResponse.json(
        {
          reply: expensiveTaskConfirmationPayload(expensive, bal.total).message,
          ...expensiveTaskConfirmationPayload(expensive, bal.total),
          actions: [
            {
              id: "confirm-expensive-cora",
              label: "Continue (use credits)",
              kind: "confirm_expensive_task",
              payload: { confirmExpensiveTask: true, prompt: message },
            },
          ],
        },
        { status: 409 },
      )
    }

    let coraLiteMode = false
    if (bal.total < estimated) {
      if (isCoraLiteEligible(message)) {
        coraLiteMode = true
      } else {
        return NextResponse.json(
          {
            reply: `You've used your Cora Credits for this period (${bal.total} remaining; ~${estimated} needed). Cora Lite still handles navigation and simple lookups. Premium generation resumes after refresh or a Cora Credit Pack.`,
            restricted: true,
            creditsInsufficient: true,
            creditsRemaining: bal.total,
            creditsNeeded: estimated,
            coraMode: "lite",
            actions: [],
          },
          { status: 403 },
        )
      }
    }

    const { course } = scope
    const capabilityAppendix = buildFacultyCapabilityPrompt(body.capabilityId)
    const preferencesAppendix = buildFacultyCoraPreferencesPrompt(prefs)
    const threadId = String(body.threadId ?? "").trim() || null

    const history = (body.conversationHistory ?? [])
      .filter((m) => m?.role === "user" || m?.role === "assistant")
      .slice(-12)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: String(m.content ?? "").slice(0, 6000),
      }))

    const facultySession = await buildFacultyCoraSession({
      instructorId: scope.instructorId,
      courseId: course.id,
      courseCode: course.course_code ?? null,
      courseTitle: course.course_title ?? null,
    })

    const { listCoraMemory, formatCoraMemoryPrompt } = await import(
      "@/lib/cora/memory/cora-user-memory"
    )
    const { formatContextProfilePrompt, getOrBootstrapContextProfile } = await import(
      "@/lib/cora/context/user-context-profile"
    )
    let memoryBlock = ""
    let contextProfileBlock = ""
    try {
      const profile = await getOrBootstrapContextProfile({
        role: "instructor",
        userId: scope.instructorId,
        courseId: course.id,
      })
      contextProfileBlock = formatContextProfilePrompt(profile)
    } catch (profileError) {
      console.warn("[instructor/cora/chat] context profile load failed", profileError)
    }
    if (prefs.persistGlobalMemory || prefs.persistThreadMemory) {
      try {
        const memory = await listCoraMemory({
          role: "instructor",
          userId: scope.instructorId,
          courseId: course.id,
          threadId: prefs.persistThreadMemory ? threadId : null,
          limit: 24,
        })
        memoryBlock = formatCoraMemoryPrompt({
          global: prefs.persistGlobalMemory ? memory.global : [],
          thread: prefs.persistThreadMemory ? memory.thread : [],
        })
      } catch (memoryError) {
        console.warn("[instructor/cora/chat] memory load failed", memoryError)
      }
    }

    const courseRoutingPolicy = await loadCoraCourseRoutingPolicy({
      courseId: course.id,
      instructorId: scope.instructorId,
    })
    const examLike = /\b(exam|midterm|final)\b/i.test(userMessage)
    const coraRouting = resolveCoraDynamicRoute({
      message: userMessage,
      conversationHistory: history,
      forAgentTools: true,
      userRole: "instructor",
      portal: "faculty",
      courseId: course.id,
      courseRoutingPolicy,
      coraLiteMode,
      assessmentContext: /\bfinal\b/i.test(userMessage) ? "final" : examLike ? "exam" : undefined,
      highImpact: examLike,
      taskCategory: examLike ? "assessment_exam" : undefined,
    })

    const agentResult = await runCoraAgentRuntime({
      openai,
      role: "copilot",
      session: facultySession,
      actor: {
        instructorId: scope.instructorId,
        courseId: course.id,
        courseCode: course.course_code ?? null,
        courseTitle: course.course_title ?? null,
        threadId,
        session: facultySession,
      },
      systemPrompt:
        FACULTY_CORA_SYSTEM_POLICY +
        capabilityAppendix +
        preferencesAppendix +
        (memoryBlock ? `\n\n${memoryBlock}` : "") +
      (contextProfileBlock ? `\n\n${contextProfileBlock}` : "") +
        "\n\n" +
        buildFacultyToolCatalogPacket(DEFAULT_FACULTY_CAPABILITY_MODULES) +
        "\nWhen you prepare announcements or question-bank items, use propose_announcement / propose_question_bank_create so the instructor can confirm before anything is published. When they ask to create course flashcards, call create_faculty_flashcard_deck immediately with the bank topic — do not dump cards as Markdown. For any other create/update in the capability packet (notes, groups, projects, attendance, …), call propose_faculty_capability with the matching capability_id — never substitute Markdown copy/paste. Use the active course context — do not ask for course/section when known. For recent/published announcements, call list_course_announcements immediately — never claim announcement history is unavailable. Never say you cannot publish/create when a tool exists.",
      conversationHistory: history,
      userMessage,
      requestContext: {
        userRole: "instructor",
        portal: "faculty",
        message: userMessage,
        conversationHistory: history,
        courseId: course.id,
        courseRoutingPolicy,
        coraLiteMode,
        requiresTools: true,
        agenticAction: true,
        assessmentContext: /\bfinal\b/i.test(userMessage) ? "final" : examLike ? "exam" : null,
        highImpact: examLike,
        taskCategory: examLike ? "assessment_exam" : undefined,
      },
    })

    const actions = buildChatActions(message, body.capabilityId, prefs)
    if (agentResult.artifacts?.questionDraftsJson) {
      try {
        const drafts = JSON.parse(agentResult.artifacts.questionDraftsJson)
        if (Array.isArray(drafts) && drafts.length) {
          const existing = actions.find((a) => a.kind === "generate_questions")
          if (existing) {
            existing.payload = { ...existing.payload, drafts }
          } else {
            actions.unshift({
              id: "generate-questions",
              label: "Open drafts in Question Bank",
              kind: "generate_questions",
              payload: { prompt: message, drafts },
            })
          }
        }
      } catch {
        /* ignore malformed artifact */
      }
    }

    // Prefer confirmation proposals over "open module" chips when present
    if (agentResult.artifacts?.proposals?.length) {
      const proposalKinds = new Set(agentResult.artifacts.proposals.map((p) => p.tool))
      if (proposalKinds.has("announcement.publish")) {
        for (let i = actions.length - 1; i >= 0; i--) {
          if (actions[i]?.kind === "schedule_automation") actions.splice(i, 1)
        }
      }
      if (proposalKinds.has("questionBank.createQuestions")) {
        for (let i = actions.length - 1; i >= 0; i--) {
          if (actions[i]?.kind === "generate_questions") actions.splice(i, 1)
        }
      }
      if (proposalKinds.has("flashcard.generateFromBank")) {
        for (let i = actions.length - 1; i >= 0; i--) {
          if (actions[i]?.kind === "open_flashcards") actions.splice(i, 1)
        }
      }
    }

    return NextResponse.json({
      reply: agentResult.content,
      actions,
      proposals: agentResult.artifacts?.proposals ?? [],
      plans: agentResult.artifacts?.plans ?? [],
      toolCalls: agentResult.toolCalls,
      creditsCharged: coraLiteMode ? 0 : agentResult.creditsCharged,
      creditsRemaining: bal.total,
      contextSyncedAt: new Date().toISOString(),
      ...buildPublicCoraChatFields({
        profile: coraRouting.profile ?? (coraLiteMode ? "lite" : "agent"),
        liteMode: coraLiteMode,
        complexity: coraRouting.complexity,
        reason: coraRouting.reason,
        ui: coraUiFromProposals(agentResult.content, agentResult.artifacts?.proposals),
      }),
    })
  } catch (error) {
    console.error("[instructor/cora/chat]", error)
    return NextResponse.json({ error: "Chat failed" }, { status: 500 })
  }
}
