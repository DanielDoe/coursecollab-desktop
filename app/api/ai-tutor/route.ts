import { type NextRequest, NextResponse } from "next/server"
import {
  ASSESSMENT_GUIDED_LEARNING_GOAL_OVERRIDE,
  buildLearningGoalSystemPrompt,
  clampLearningGoalForAssessmentPolicy,
  resolveCoraAiRouting,
  learningGoalFromLegacyChatConfig,
  normalizeLearningGoal,
} from "@/lib/cora/learning-goals"
import { buildFlowSystemPromptAppendix, type CoraChatFlow } from "@/lib/cora/study-plan-flows"
import { getStudentContextForCora, type CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import { formatStudentContextForPrompt } from "@/lib/cora/format-student-context-for-prompt"
import type { ExternalAiContextOptions } from "@/lib/cora/privacy/ai-data-minimization"
import { buildTutorPreferencesPrompt, type CoraTutorPreferences } from "@/lib/cora/preferences-storage"
import { runCoraAgentRuntime } from "@/lib/cora/agent/runtime"
import { coraUiFromProposals } from "@/lib/cora/models/ui-payloads"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import {
  agentPolicyForRole,
  buildHardDenyRefusal,
  detectHardDeniedIntent,
} from "@/lib/cora/agent/clearances"
import {
  buildStudentCoraSession,
  logCoraAuditEvent,
  detectActiveHighStakesExam,
  looksLikeExamAnswerRequest,
  ACTIVE_EXAM_REFUSAL,
  refuseIfIntegrityBlocksAnswers,
  resolveAssessmentIntegrityContext,
  buildAssessmentSocraticPromptAppendix,
  isLectureOrPracticeLearningContext,
  textMatchesAssessmentQuestions,
} from "@/lib/cora/security"
import { guardCoraAgainstUnattemptedAssessments } from "@/lib/cora/assessment-import-gate"
import { formatMembershipAccessForPrompt, formatReadOnlyCapabilitiesForPrompt } from "@/lib/cora/read-only-agent"
import { buildImportedProblemPrompt } from "@/lib/cora/problem-prompt"
import {
  applyAskCoraOutputGate,
  enforceAskCoraGate,
  logAskCoraGateEvent,
} from "@/lib/cora/assessment-policy-gate"
import type { CoraProblemContext } from "@/lib/cora/types"
import { resolveVisionImageDataUrl } from "@/lib/vision-image-for-ai"
import { buildPublicCoraChatFields } from "@/lib/cora/models/public-route"
import { loadCoraCourseRoutingPolicy } from "@/lib/cora/models/load-course-policy"
import {
  buildCoraStudentSettingsPromptAppendix,
  capTokensForCourseSettings,
  loadCoraStudentCourseSettings,
} from "@/lib/cora/models/course-student-settings"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { sql } from "@/lib/db"
import { createForFeature, resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import { buildModelOpts } from "@/lib/openai-model-params"
import OpenAI from "openai"
import { getEffectiveMembershipTier, deductAITutorCredits } from "@/lib/membership"
import { getStudentCodeBenchEntitlement } from "@/lib/codebench-entitlement"
import { codebenchMembershipRequiredResponse } from "@/lib/codebench-cora-usage"

// Check if OpenAI API key is configured
const isOpenAIConfigured = !!process.env.OPENAI_API_KEY

const openai = isOpenAIConfigured ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatSlimStudentContextForAgent(
  ctx: CoraStudentContextPayload,
  options?: ExternalAiContextOptions,
): string {
  const learningContext = options?.privacy?.useLearningContext !== false
  const personalized = options?.privacy?.personalizedLearning !== false
  if (!learningContext && !personalized) {
    return `\n\n**Student snapshot:** Learning context is disabled in Cora privacy settings. Use authorized read tools when course data is required.`
  }
  const account = ctx.account
  const struggling =
    personalized && learningContext
      ? ctx.strugglingTopics?.slice(0, 5).join(", ") || "none flagged"
      : "disabled"
  return `\n\n**Student snapshot (use tools for live calendar/assessments/notifications):**
- Course: ${account?.courseCode ?? "Course"}${account?.courseTitle ? ` — ${account.courseTitle}` : ""} | Section ${account?.section ?? "—"}
- Struggling topics: ${struggling}
- Membership: ${personalized ? (ctx.membership?.tier ?? "—") : "personalization off"}
- Privacy: student name, email, and IDs are not sent to external AI providers.`
}

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { 
      message, 
      studentId, 
      context, 
      conversationHistory = [],
      chatConfig,
      sessionMemory,
      analysis,
      studentContext,
      learningMemory,
      tutorPreferences,
      attachments = [],
      problemContext,
      useAgent = true,
      confirmExpensiveTask = false,
      confirmScopeRelated = false,
      declaredAcademicContext = null,
      domainHint = null,
      threadId = null,
    } = await request.json()

    const imageAttachments = (attachments as Array<{ name?: string; dataUrl?: string }>).filter(
      (a) => typeof a.dataUrl === "string" && a.dataUrl.startsWith("data:image/"),
    )

    const importedProblem = (problemContext ?? context?.importedQuestion) as CoraProblemContext | undefined
    const importedDiagramUrl =
      importedProblem?.mediaUrl?.trim() ||
      importedProblem?.questionMedia?.media_url?.trim() ||
      ""
    const importedDiagramDataUrl = importedDiagramUrl
      ? await resolveVisionImageDataUrl(importedDiagramUrl)
      : null

    const visionImages = [
      ...(importedDiagramDataUrl ? [{ dataUrl: importedDiagramDataUrl, name: "question-diagram" }] : []),
      ...imageAttachments.filter((a) => a.dataUrl),
    ]

    if ((!message || !String(message).trim()) && visionImages.length === 0 && !problemContext?.questionText) {
      return NextResponse.json(
        { error: "Message or attachment is required" },
        { status: 400 }
      )
    }

    let studentIdNum = studentId ? parseInt(String(studentId), 10) : NaN
    let resolvedStudentContext = studentContext
    if (!Number.isNaN(studentIdNum)) {
      try {
        resolvedStudentContext = await getStudentContextForCora(studentIdNum)
      } catch (contextError) {
        console.warn("[AI Tutor] Server student context fetch failed, using client payload:", contextError)
      }
    }

    const forbiddenWrite = detectHardDeniedIntent("assistant", String(message ?? ""))
    if (forbiddenWrite) {
      if (!Number.isNaN(studentIdNum)) {
        try {
          const blockedSession = await buildStudentCoraSession({ studentDbId: studentIdNum })
          void logCoraAuditEvent({
            session: blockedSession,
            action: "cora.chat.blocked",
            outcome: "blocked",
            promptText: String(message ?? ""),
            errorMessage: forbiddenWrite,
          })
        } catch {
          /* ignore */
        }
      }
      return NextResponse.json({
        response: buildHardDenyRefusal(forbiddenWrite),
        isConfigured: true,
        clearanceDenied: true,
        readOnlyRefusal: true,
        timestamp: new Date().toISOString(),
      })
    }

    // Security disclosure gate (≠ academic purpose). Always enforced.
    if (String(message ?? "").trim()) {
      try {
        const { evaluateCoraDisclosureGate } = await import("@/lib/cora/disclosure")
        const disclosureSession = !Number.isNaN(studentIdNum)
          ? await buildStudentCoraSession({ studentDbId: studentIdNum })
          : null
        const disclosure = await evaluateCoraDisclosureGate({
          role: "student",
          message: String(message ?? ""),
          conversationHistory: Array.isArray(conversationHistory)
            ? conversationHistory.slice(-8)
            : [],
          session: disclosureSession,
        })
        if (disclosure.decision !== "ALLOW" && disclosure.userMessage) {
          return NextResponse.json({
            response: disclosure.userMessage,
            isConfigured: true,
            restricted: true,
            creditsCharged: 0,
            timestamp: new Date().toISOString(),
          })
        }
      } catch (disclosureErr) {
        console.warn("[AI Tutor] disclosure gate failed (continuing):", disclosureErr)
      }
    }

    // Academic-purpose scope (≠ authorization). Default OBSERVE; ENFORCE via CORA_SCOPE_MODE.
    if (!Number.isNaN(studentIdNum) && String(message ?? "").trim()) {
      try {
        const scopeSession = await buildStudentCoraSession({ studentDbId: studentIdNum })
        const { evaluateCoraPurposeScope } = await import("@/lib/cora/scope")
        const scopeEval = await evaluateCoraPurposeScope({
          session: scopeSession,
          role: "student",
          message: String(message ?? ""),
          conversationHistory: Array.isArray(conversationHistory)
            ? conversationHistory.slice(-8).map((m: { role?: string; content?: string }) => ({
                role: String(m.role ?? "user"),
                content: String(m.content ?? ""),
              }))
            : [],
          confirmScopeRelated: Boolean(confirmScopeRelated),
          declaredAcademicContext:
            declaredAcademicContext != null ? String(declaredAcademicContext) : null,
        })
        if (scopeEval.shouldEnforce && scopeEval.userMessage) {
          return NextResponse.json({
            response: scopeEval.userMessage,
            isConfigured: true,
            scopeRedirect: true,
            scopeDecision: scopeEval.decision,
            scopeClassification: scopeEval.classification,
            scopeEventId: scopeEval.scopeEventId ?? null,
            offerScopeFeedback: Boolean(scopeEval.offerFeedback),
            creditsCharged: 0,
            timestamp: new Date().toISOString(),
          })
        }
      } catch (scopeErr) {
        console.warn("[AI Tutor] scope evaluate failed (continuing):", scopeErr)
      }
    }

    // Bypass for CodeBench classroom assignments — instructor-assigned work allows AI help.
    const isCodeBenchAssignment = !!context?.classroomSubmissionId
    if (!isCodeBenchAssignment) {
      const auth = await requireCallerStudentDbId(request)
      if (!auth.ok) return auth.response
      studentIdNum = auth.studentDbId
    }

    const isCodeBenchCoraRequest =
      context?.source === "codebench" || context?.module === "codebench"
    if (isCodeBenchCoraRequest && !Number.isNaN(studentIdNum)) {
      const entitlement = await getStudentCodeBenchEntitlement(studentIdNum)
      if (!entitlement.coraAccess) {
        return codebenchMembershipRequiredResponse()
      }
    }

    const { getCoraPrivacySettings, DEFAULT_CORA_PRIVACY_SETTINGS } = await import(
      "@/lib/cora/privacy/cora-privacy-settings"
    )
    let coraPrivacy = DEFAULT_CORA_PRIVACY_SETTINGS
    if (!Number.isNaN(studentIdNum)) {
      coraPrivacy = await getCoraPrivacySettings(studentIdNum)
    }
    const privacyOptions: ExternalAiContextOptions = { privacy: coraPrivacy }

    let lecturePracticeContext = isLectureOrPracticeLearningContext({
      lectureId: context?.lectureId ?? importedProblem?.lectureId ?? null,
      problemSource: importedProblem?.source ?? null,
      classroomSubmissionId: context?.classroomSubmissionId,
    })

    let assessmentIntegrityCtx: Awaited<ReturnType<typeof resolveAssessmentIntegrityContext>> | null =
      null
    if (!Number.isNaN(studentIdNum) && !isCodeBenchAssignment) {
      assessmentIntegrityCtx = await resolveAssessmentIntegrityContext(studentIdNum)
    }

    // Anti-spoof: the lecture/practice context is client-claimed. If the student has
    // an ACTIVE attempt and their message reproduces a question from that assessment,
    // treat this as assessment help regardless of the claimed context.
    if (
      lecturePracticeContext &&
      assessmentIntegrityCtx?.state === "active" &&
      assessmentIntegrityCtx.assessmentId != null
    ) {
      const candidateText = [
        String(message ?? ""),
        importedProblem ? JSON.stringify(importedProblem) : "",
      ].join("\n")
      if (
        await textMatchesAssessmentQuestions(assessmentIntegrityCtx.assessmentId, candidateText)
      ) {
        lecturePracticeContext = false
      }
    }

    let askCoraGate: Awaited<ReturnType<typeof enforceAskCoraGate>> | null = null
    if (!Number.isNaN(studentIdNum) && !isCodeBenchAssignment) {
      askCoraGate = await enforceAskCoraGate({
        studentId: studentIdNum,
        message: String(message ?? ""),
        conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
        problem: importedProblem ?? null,
        source: importedProblem?.source ?? context?.importedQuestion?.source ?? null,
        quizId: importedProblem?.quizId ?? context?.quizId ?? null,
        questionId: importedProblem?.questionId != null ? Number(importedProblem.questionId) : null,
        bankQuestionId: importedProblem?.bankQuestionId ?? null,
        attemptId: importedProblem?.attemptId ?? context?.attemptId ?? null,
        questionType: importedProblem?.questionType ?? null,
      })
      if (askCoraGate.blockBeforeModel) {
        void logAskCoraGateEvent({
          studentId: studentIdNum,
          gate: askCoraGate,
          answerBlocked: true,
        })
        return NextResponse.json({
          response: askCoraGate.refusalMessage,
          isConfigured: true,
          assessmentPolicy: askCoraGate.policy,
          timestamp: new Date().toISOString(),
        })
      }
      if (askCoraGate.policy.mode === "GUIDED_ONLY" || askCoraGate.policy.mode === "DISABLED") {
        lecturePracticeContext = false
      }
    }

    // Assessment integrity: refuse answer-seeking under restricted/active policies
    if (!Number.isNaN(studentIdNum) && !isCodeBenchAssignment && !lecturePracticeContext) {
      const integrityGate = await refuseIfIntegrityBlocksAnswers(
        studentIdNum,
        String(message ?? ""),
      )
      if (integrityGate.refuse) {
        try {
          const blockedSession = await buildStudentCoraSession({ studentDbId: studentIdNum })
          void logCoraAuditEvent({
            session: blockedSession,
            action: "cora.chat.blocked",
            outcome: "blocked",
            promptText: String(message ?? ""),
            errorMessage: integrityGate.message ?? ACTIVE_EXAM_REFUSAL,
            metadata: {
              assessment_integrity: integrityGate.context,
            },
          })
        } catch {
          /* ignore */
        }
        return NextResponse.json({
          response: integrityGate.message ?? ACTIVE_EXAM_REFUSAL,
          isConfigured: true,
          examBlocked: integrityGate.context.highStakes && integrityGate.context.state === "active",
          assessmentIntegrity: integrityGate.context,
          assessmentTitle: integrityGate.context.title,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Legacy high-stakes active exam hard block (kept as belt-and-suspenders; skip in lecture/practice context)
    if (
      !Number.isNaN(studentIdNum) &&
      !lecturePracticeContext &&
      looksLikeExamAnswerRequest(String(message ?? ""))
    ) {
      const examBlock = await detectActiveHighStakesExam(studentIdNum)
      if (examBlock.blocked) {
        try {
          const blockedSession = await buildStudentCoraSession({ studentDbId: studentIdNum })
          void logCoraAuditEvent({
            session: blockedSession,
            action: "cora.chat.blocked",
            outcome: "blocked",
            promptText: String(message ?? ""),
            errorMessage: examBlock.reason ?? ACTIVE_EXAM_REFUSAL,
          })
        } catch {
          /* ignore */
        }
        return NextResponse.json({
          response: examBlock.reason ?? ACTIVE_EXAM_REFUSAL,
          isConfigured: true,
          examBlocked: true,
          assessmentTitle: examBlock.assessmentTitle,
          assessmentIntegrity: examBlock.integrity ?? undefined,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Block pre-solving unattempted / in-progress homework & quizzes (import or paste)
    if (!Number.isNaN(studentIdNum) && !isCodeBenchAssignment) {
      const importLock = await guardCoraAgainstUnattemptedAssessments(studentIdNum, {
        quizId: importedProblem?.quizId ?? null,
        bankQuestionId: importedProblem?.bankQuestionId ?? null,
        source: importedProblem?.source ?? null,
        texts: [importedProblem?.questionText, typeof message === "string" ? message : null],
      })
      if (!importLock.allowed) {
        try {
          const blockedSession = await buildStudentCoraSession({ studentDbId: studentIdNum })
          void logCoraAuditEvent({
            session: blockedSession,
            action: "cora.chat.blocked",
            outcome: "blocked",
            promptText: String(message ?? importedProblem?.questionText ?? ""),
            errorMessage: importLock.message ?? "assessment_import_locked",
          })
        } catch {
          /* ignore */
        }
        return NextResponse.json({
          response:
            importLock.message ??
            "Attempt and submit this assessment first. Cora can help with its questions only after you submit.",
          isConfigured: true,
          assessmentImportLocked: true,
          assessmentTitle: importLock.assessmentTitle,
          accessStatus: importLock.status,
          timestamp: new Date().toISOString(),
        })
      }
    }

    // Check membership tier and Cora Credits (monthly allocation; Lite when exhausted).
    let effectiveMembershipTier: Awaited<ReturnType<typeof getEffectiveMembershipTier>> | null = null
    let coraLiteMode = false
    if (!Number.isNaN(studentIdNum) && !isCodeBenchAssignment) {
      effectiveMembershipTier = await getEffectiveMembershipTier(studentIdNum)
      const {
        estimateCoraCreditsForMessage,
        isCoraLiteEligible,
        estimateExpensiveCoraTask,
        expensiveTaskConfirmationPayload,
      } = await import("@/lib/cora/credits")
      const { getStudentCoraBalance } = await import("@/lib/membership")
      const bal = await getStudentCoraBalance(studentIdNum)
      const expensive = estimateExpensiveCoraTask(String(message ?? ""), {
        hasAttachments: Boolean(attachments?.length),
        attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
      })
      const estimatedCredits = Math.max(
        estimateCoraCreditsForMessage(String(message ?? ""), {
          hasAttachments: Boolean(attachments?.length),
        }),
        expensive.estimateLow,
      )

      if (expensive.requiresConfirmation && !confirmExpensiveTask && !coraLiteMode) {
        return NextResponse.json(
          {
            response: expensiveTaskConfirmationPayload(expensive, bal.total).message,
            isConfigured: true,
            ...expensiveTaskConfirmationPayload(expensive, bal.total),
            timestamp: new Date().toISOString(),
          },
          { status: 409 },
        )
      }

      if (bal.total < estimatedCredits) {
        if (isCoraLiteEligible(String(message ?? ""))) {
          coraLiteMode = true
        } else {
          return NextResponse.json(
            {
              response: `⚠️ **Cora Credits low**\n\nYou have **${bal.total}** Cora Credits remaining (need ~${estimatedCredits} for this request).\n\n**Cora Lite** is still available for grades, deadlines, navigation, and simple lookups.\n\nPremium generation resumes when your monthly allocation refreshes, you upgrade, or you buy a Cora Credit Pack.`,
              isConfigured: true,
              accessDenied: true,
              creditsInsufficient: true,
              creditsRemaining: bal.total,
              creditsNeeded: estimatedCredits,
              coraMode: "lite",
              upgradeRequired: bal.tier === "Trailblazer" ? undefined : "Explorer",
              timestamp: new Date().toISOString(),
            },
            { status: 403 },
          )
        }
      }
    }

    // Check if OpenAI is configured
    if (!isOpenAIConfigured || !openai) {
      console.warn("[AI Tutor] OpenAI API key not configured")
      return NextResponse.json({
        response: "⚠️ **AI Tutor is currently unavailable.**\n\nThe instructor has not configured the OpenAI API key yet. Please:\n- Use the lecture-specific AI assistant (available in lecture slides)\n- Ask questions in the forum\n- Contact your instructor during office hours\n\nSorry for the inconvenience!",
        isConfigured: false,
        timestamp: new Date().toISOString(),
      })
    }

    let lectureContext = ""
    let recentPerformance = ""

    // Fetch lecture context if provided
    if (context?.lectureId) {
      try {
        const lectureData = await sql`
          SELECT l.title, l.week, l.description
          FROM lectures l
          WHERE l.id = ${context.lectureId}
        `

        if (lectureData.length > 0) {
          const lecture = lectureData[0]
          lectureContext = `\n\nCurrent Lecture Context:\n- Title: ${lecture.title}\n- Week: ${lecture.week}\n- Description: ${lecture.description || 'N/A'}\n`
        }
      } catch (error) {
        console.error("[AI Tutor] Failed to fetch lecture context:", error)
      }
    }

    // Use student context if provided, otherwise fetch basic performance
    let studentProfileContext = ""
    const agentEligible =
      useAgent !== false && !Number.isNaN(studentIdNum) && openai != null

    if (resolvedStudentContext) {
      studentProfileContext = agentEligible
        ? formatSlimStudentContextForAgent(resolvedStudentContext, privacyOptions)
        : `\n\n${formatStudentContextForPrompt(resolvedStudentContext, privacyOptions)}`
    } else if (studentId) {
      // Fallback: fetch basic performance if context not provided
      try {
        const recentQuizzes = await sql`
          SELECT 
            q.title,
            qa.score,
            qa.completed_at
          FROM quiz_attempts qa
          JOIN quizzes q ON qa.quiz_id = q.id
          WHERE qa.student_id = ${studentId}
          ORDER BY qa.completed_at DESC
          LIMIT 3
        `

        if (recentQuizzes.length > 0) {
          recentPerformance = "\n\nStudent's Recent Performance:\n"
          recentQuizzes.forEach((quiz: any) => {
            recentPerformance += `- ${quiz.title}: ${quiz.score}% (${new Date(quiz.completed_at).toLocaleDateString()})\n`
          })
        }
      } catch (error) {
        console.error("[AI Tutor] Failed to fetch student performance:", error)
      }
    }

    // Practice/evaluate stay on a finite-state evaluator (not the tool agent).
    // Pseudocode and general tutor chat go through runCoraAgentRuntime.
    let systemPrompt = ""
    let useCoraAgentLoop = false
    /** Isolated comprehension FSM — no tools. Completions still go through the Cora gateway. */
    let evaluationFsm = false
    const isProblemGeneration = context?.isProblemGeneration === true || 
                                (message.toLowerCase().includes("generate") && message.toLowerCase().includes("practice problem"))
    
    if ((context?.topic === "practice" || context?.topic === "evaluate") && !isProblemGeneration) {
      evaluationFsm = true
      // STRICT EVALUATION MODE - No general chat, only questions and scoring
      systemPrompt = `You are a CODE EVALUATION ASSISTANT. Your ONLY job is to evaluate student code comprehension.

CRITICAL - YOU ARE NOT A TUTOR OR CHATBOT:
- DO NOT provide explanations, tutorials, or general programming help
- DO NOT answer questions about programming concepts
- DO NOT engage in general conversation
- DO NOT provide code examples or solutions
- DO NOT act like ChatGPT or a general assistant
- DO NOT repeat the same question - ALWAYS move to the next question after receiving ANY answer

YOUR ONLY TASKS:
1. Ask comprehension questions about the student's code (ONE at a time, sequentially)
2. Evaluate the student's answers (accept ANY response, including "no idea", "I don't know", etc.)
3. After EXACTLY 3 questions are answered, provide FINAL_SCORE and FEEDBACK
4. STOP IMMEDIATELY after providing the score - do not continue chatting

CRITICAL PROGRESSION RULES - FINITE STATE MACHINE:
- YOU MUST NEVER repeat a question that has already been asked
- Ask exactly ONE question at a time, sequentially (Question 1, then Question 2, then Question 3)
- YOU CANNOT SKIP QUESTIONS - You MUST ask Question 2 before Question 3
- YOU CANNOT go from Question 1 directly to Question 3 - you MUST ask Question 2 first
- After you ask Question 3 and get the student response, YOU MUST STOP immediately
- After receiving ANY answer to Question 1 (even "no idea" or "I don't know"), IMMEDIATELY ask Question 2 (do NOT repeat Question 1, do NOT skip to Question 3)
- After receiving ANY answer to Question 2, IMMEDIATELY ask Question 3 (do NOT repeat Question 2, do NOT restart with Question 1)
- After receiving ANY answer to Question 3, IMMEDIATELY provide FINAL_SCORE (do NOT ask Question 4 or restart with Question 1)
- Accept ALL answers, even if the student says "no idea", "I don't know", or gives an incorrect answer
- NEVER repeat a question - always move forward to the next question number
- NEVER skip questions - always ask them in order (1, 2, 3)
- You are PROHIBITED from asking Question 1 again after it has been asked once
- You are PROHIBITED from asking more than 3 questions total
- You are PROHIBITED from skipping Question 2
- If the student gives a vague answer, still move to the next question and evaluate it later in the final score

EVALUATION FORMAT:
- Ask questions that test understanding of the code logic
- Format each question EXACTLY as "Question X of 3: [your question]" (where X is 1, 2, or 3)
- After receiving ANY answer, immediately ask the next numbered question
- Score answers: 0-10 (10=excellent, 7-9=good, 4-6=partial, 1-3=poor, 0=incorrect/no idea)
- After EXACTLY 3 questions: "FINAL_SCORE: X" and "FEEDBACK: [explanation]" and "END_EVALUATION"
- HARD LIMIT: Maximum 3 questions. Do NOT ask a 4th question.

QUESTION PROGRESSION EXAMPLE (STRICT):
- First message: "Question 1 of 3: [question]"
- After student answers (even "no idea"): "Question 2 of 3: [different question]"
- After student answers: "Question 3 of 3: [different question]"
- After student answers: "FINAL_SCORE: X\nFEEDBACK: [explanation]\nEND_EVALUATION"

CRITICAL CONSTRAINTS:
- After 3 questions, you MUST provide FINAL_SCORE and STOP. Do NOT ask more questions.
- NEVER repeat a question - always move to the next number after receiving ANY answer.
- You CANNOT restart with Question 1 after asking Question 2 or 3.
- You CANNOT ask Question 1 again after it has been asked once.
- You CANNOT ask more than 3 questions total.

DO NOT DEVIATE FROM THIS ROLE. You are an evaluator, not a tutor.`
    } else if (context?.topic === "pseudocode") {
      // Pseudocode mode: Help students understand pseudocode, algorithms, and flow diagrams
      systemPrompt = `You are an expert computer science educator specializing in pseudocode, algorithms, and flow diagrams. Help students understand algorithmic thinking and pseudocode concepts.

CRITICAL RULES:
- Answer questions about pseudocode, algorithms, flow diagrams, and algorithmic thinking
- Explain how to read and understand pseudocode
- Help students understand algorithm steps and logic flow
- Clarify concepts related to the pseudocode they're working with
- Provide examples and visual explanations when helpful
- Encourage students to think through problems step by step
- NEVER write actual code implementations - focus on pseudocode and algorithmic concepts

When students ask follow-up questions:
- Reference the pseudocode, algorithm, or flow diagram they're working with
- Explain specific steps or concepts they're confused about
- Use visual diagrams (ASCII art) to illustrate flow
- Break down complex algorithms into simpler parts
- Ask guiding questions to help them understand

Format responses with:
- Clear explanations of pseudocode concepts
- Visual flow diagrams when helpful (use ASCII art)
- Step-by-step breakdowns
- Examples of pseudocode patterns
- Markdown formatting for readability

Be encouraging and educational. Help students understand algorithmic thinking, not just memorize patterns.`
      useCoraAgentLoop = agentEligible
    } else {
      useCoraAgentLoop = agentEligible
      const learningGoal = clampLearningGoalForAssessmentPolicy(
        normalizeLearningGoal(
          chatConfig?.learningGoal ?? learningGoalFromLegacyChatConfig(chatConfig),
        ),
        askCoraGate?.policy.mode,
      )

      let memoryPrompt = ""
      const prefs = tutorPreferences as CoraTutorPreferences | undefined
      if (prefs) {
        const hasCode =
          /```|int\s+main|#include|\bdef\s+\w+|function\s*\(/i.test(String(message || "")) ||
          problemContext?.domain === "coding"
        memoryPrompt += buildTutorPreferencesPrompt(prefs, {
          domain: problemContext?.domain ?? null,
          hasCode,
        })
      } else if (learningMemory) {
        if (learningMemory["remember-gaps"]) {
          memoryPrompt += "\n\nLEARNING MEMORY:\n- Remember topics the student struggles with\n- Reference previous gaps\n- Adapt explanations based on history"
        }
        if (learningMemory["detect-confusion"]) {
          memoryPrompt += "\n\nCONFUSION DETECTION:\n- Detect uncertainty; clarify proactively\n- Ask follow-ups when the student seems lost"
        }
        if (learningMemory["remember-strengths"]) {
          memoryPrompt += "\n\nSTRENGTHS MEMORY:\n- Avoid over-explaining concepts the student has mastered"
        }
        if (learningMemory["use-course-progress"]) {
          memoryPrompt += "\n\nCOURSE PROGRESS:\n- Personalize using lectures, practice, and performance context"
        }
      }

      let weaknessPrompt = ""
      if (analysis && analysis.confusionScore >= 4) {
        weaknessPrompt =
          "\n\nWEAKNESS DETECTED:\n- Student shows confusion (score: " +
          analysis.confusionScore +
          "/10)\n- Offer a short structured micro-lesson before continuing"
      }

      const courseHint =
        context?.courseCode ||
        context?.session ||
        resolvedStudentContext?.profile?.session ||
        (resolvedStudentContext?.strugglingTopics?.length
          ? `Student may need help with: ${resolvedStudentContext.strugglingTopics.slice(0, 5).join(", ")}`
          : "")

      systemPrompt = buildLearningGoalSystemPrompt({
        learningGoal,
        lectureContext,
        studentProfileContext: `${agentPolicyForRole("assistant")}${studentProfileContext}`,
        recentPerformance,
        memoryPrompt,
        weaknessPrompt,
        courseHint: courseHint ? String(courseHint) : undefined,
      })

      const flow = chatConfig?.flow as CoraChatFlow | undefined
      if (flow) {
        systemPrompt += buildFlowSystemPromptAppendix(flow, resolvedStudentContext?.knowledgeGraph ?? null)
      }

      const problemForPolicy = askCoraGate?.problem ?? importedProblem
      if (problemForPolicy?.questionText) {
        let problemForPrompt = problemForPolicy
        if (askCoraGate?.policy.canUseHiddenSolutionContext) {
          try {
            const { enrichCoraContextFromQuizQuestion, enrichCoraContextFromBank } = await import(
              "@/lib/cora/load-bank-context"
            )
            problemForPrompt = await enrichCoraContextFromQuizQuestion(problemForPrompt)
            problemForPrompt = await enrichCoraContextFromBank(problemForPrompt)
          } catch {
            /* use sanitized payload as-is */
          }
        }
        systemPrompt += buildImportedProblemPrompt(problemForPrompt)
      }

      if (askCoraGate?.promptAppendix) {
        systemPrompt += askCoraGate.promptAppendix
      }
      if (askCoraGate?.policy.mode === "GUIDED_ONLY") {
        systemPrompt += ASSESSMENT_GUIDED_LEARNING_GOAL_OVERRIDE
      } else if (lecturePracticeContext) {
        systemPrompt += `

LECTURE / PRACTICE WORKSPACE — GUIDED LEARNING:
- Help the student learn how to reach the answer. Do not complete the solution for them.`
      } else if (assessmentIntegrityCtx?.state === "active") {
        systemPrompt += buildAssessmentSocraticPromptAppendix(assessmentIntegrityCtx)
      }

      if (!Number.isNaN(studentIdNum)) {
        try {
          const { formatContextProfilePrompt, getOrBootstrapContextProfile } = await import(
            "@/lib/cora/context/user-context-profile"
          )
          const profile = await getOrBootstrapContextProfile({
            role: "student",
            userId: studentIdNum,
            courseId: null,
          })
          const profileBlock = formatContextProfilePrompt(profile)
          if (profileBlock) systemPrompt += `\n\n${profileBlock}`
        } catch (profileError) {
          console.warn("[AI Tutor] context profile load failed", profileError)
        }
      }

      if (!Number.isNaN(studentIdNum)) {
        try {
          const [
            { listCoraMemory, formatCoraMemoryPrompt },
          ] = await Promise.all([
            import("@/lib/cora/memory/cora-user-memory"),
          ])
          const memory = await listCoraMemory({
            role: "student",
            userId: studentIdNum,
            threadId: threadId != null ? String(threadId).trim() || null : null,
            limit: 24,
          })
          const block = formatCoraMemoryPrompt(memory)
          if (block) systemPrompt += `\n\n${block}`
        } catch (memoryError) {
          console.warn("[AI Tutor] memory load failed", memoryError)
        }
      }
    }

    // Build conversation messages with history
    const messages: any[] = [
      { role: "system", content: systemPrompt }
    ]
    
    // Add conversation history (limit to last 10 messages for context)
    const recentHistory = conversationHistory.slice(-10)
    recentHistory.forEach((msg: any) => {
      messages.push({
        role: msg.role === 'student' ? 'user' : 'assistant',
        content: msg.content
      })
    })
    
    // Add current message
    messages.push({ role: "user", content: message })

    const tutorLearningGoal = clampLearningGoalForAssessmentPolicy(
      normalizeLearningGoal(
        chatConfig?.learningGoal ?? learningGoalFromLegacyChatConfig(chatConfig),
      ),
      askCoraGate?.policy.mode,
    )
    let studentCourseId: number | null = null
    if (!Number.isNaN(studentIdNum)) {
      try {
        studentCourseId = (await resolveStudentCourseContextByDbId(studentIdNum))?.courseId ?? null
      } catch {
        studentCourseId = null
      }
    }
    const courseStudentSettings = await loadCoraStudentCourseSettings(studentCourseId)
    if (studentCourseId != null && !courseStudentSettings.enableAITutor) {
      return NextResponse.json(
        { error: "The AI tutor is disabled for this course." },
        { status: 403 },
      )
    }
    if (isProblemGeneration && !courseStudentSettings.allowPracticeGeneration) {
      return NextResponse.json(
        { error: "Practice generation is disabled for this course." },
        { status: 403 },
      )
    }
    const settingsAppendix = buildCoraStudentSettingsPromptAppendix(courseStudentSettings)
    systemPrompt += settingsAppendix
    if (messages[0]?.role === "system") {
      messages[0].content = `${messages[0].content}${settingsAppendix}`
    }

    const courseRoutingPolicy = await loadCoraCourseRoutingPolicy({ courseId: studentCourseId })
    const coraRouting = resolveCoraAiRouting({
      learningGoal: tutorLearningGoal,
      message: String(message ?? ""),
      conversationHistory: recentHistory,
      forAgentTools: Boolean(useCoraAgentLoop),
      domainHint: domainHint ?? null,
      courseId: studentCourseId,
      courseRoutingPolicy,
      userRole: "student",
      portal: "student",
      coraLiteMode,
    })

    let userText =
      String(message ?? "").trim() ||
      (visionImages.length > 0
        ? importedDiagramDataUrl
          ? "Please help me with this imported course question. Use the attached question diagram."
          : "Please analyze the attached image(s) and help me learn from them."
        : "")

    let aiContent: string | null | undefined
    let coraProposals: import("@/lib/cora/confirmations/action-proposals").CoraActionProposal[] = []
    let agentUsageCredits: number | null = null
    let modelUsedMeta: string | null = null
    let routingMeta: {
      provider: string
      domain: string
      complexity: string
      modelId: string
      reason: string
    } | null = null

    if (visionImages.length > 0 && openai) {
      const visionModel = resolveModelForFeature("document_vision", { aiModel: "auto-openai" })
      modelUsedMeta = visionModel
      const vision = await openai.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: "system",
            content:
              "Extract all text, equations, diagrams, and question details from the attached image(s). " +
              "Output a precise description a tutor can use. Do not solve the problem.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: userText || "Extract the attached course image." },
              ...visionImages.map((a) => ({
                type: "image_url" as const,
                image_url: { url: a.dataUrl!, detail: "high" as const },
              })),
            ],
          },
        ],
        ...buildModelOpts(visionModel, { temperature: 0.2, max_tokens: 900 }),
      })
      const extracted = vision.choices[0]?.message?.content?.trim() || ""
      if (!Number.isNaN(studentIdNum) && studentIdNum > 0) {
        try {
          const { recordModelCall } = await import("@/lib/cora/ai")
          await recordModelCall({
            context: {
              actor: { userId: studentIdNum, userRole: "student" },
              feature: "DOCUMENT_ANALYSIS",
              module: "ai-tutor-vision-extract",
              billable: !coraLiteMode,
            },
            model: visionModel,
            rawResponse: vision,
          })
        } catch {
          /* accounting must not block extract */
        }
      }
      if (extracted) {
        userText = [userText, `[Extracted from attached image]\n${extracted}`].filter(Boolean).join("\n\n")
        const last = messages[messages.length - 1]
        if (last?.role === "user") last.content = userText
      }
    }
    if (useCoraAgentLoop && openai) {
      // Tool loop is OpenAI-only; use agentModelId (complexity-matched GPT).
      if (effectiveMembershipTier == null && !Number.isNaN(studentIdNum)) {
        try {
          effectiveMembershipTier = await getEffectiveMembershipTier(studentIdNum)
        } catch {
          /* leave null */
        }
      }
      const studentSession = await buildStudentCoraSession({
        studentDbId: studentIdNum,
        membershipTier: effectiveMembershipTier,
      })
      const agentResult = await runCoraAgentRuntime({
        openai,
        role: "assistant",
        session: studentSession,
        actor: {
          studentDbId: studentIdNum,
          threadId: threadId != null ? String(threadId).trim() || null : null,
          session: studentSession,
        },
        systemPrompt,
        conversationHistory: recentHistory,
        userMessage: userText,
        requestContext: {
          userRole: "student",
          portal: "student",
          message: userText,
          conversationHistory: recentHistory,
          courseId: studentCourseId,
          courseRoutingPolicy,
          coraLiteMode,
          requiresTools: true,
          agenticAction: true,
        },
      })
      aiContent = agentResult.content
      coraProposals = agentResult.artifacts?.proposals ?? []
      agentUsageCredits = agentResult.creditsCharged
      modelUsedMeta = agentResult.modelUsed
      routingMeta = {
        provider: "openai",
        domain: coraRouting.domain,
        complexity: coraRouting.complexity,
        modelId: agentResult.modelUsed,
        reason: `${coraRouting.reason} · agent tools`,
      }
    } else if (evaluationFsm && openai) {
      const { coraGatewayChat } = await import("@/lib/cora/ai")
      const result = await coraGatewayChat({
        openai,
        context: {
          actor: {
            userId: Number.isFinite(studentIdNum) ? studentIdNum : 0,
            userRole: "student",
          },
          feature: "GRADING",
          module: "ai-tutor-evaluation-fsm",
          billable: !coraLiteMode && Number.isFinite(studentIdNum) && studentIdNum > 0,
        },
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: String(m.content ?? ""),
        })),
        model: coraRouting.modelId,
        featureHint: coraRouting.feature,
        temperature: coraRouting.temperature,
        maxTokens: capTokensForCourseSettings(coraRouting.maxTokens, courseStudentSettings),
      })
      aiContent = result.content
      modelUsedMeta = result.modelUsed
      agentUsageCredits = result.creditsCharged
      routingMeta = {
        provider: result.provider === "ANTHROPIC" ? "anthropic" : "openai",
        domain: coraRouting.domain,
        complexity: coraRouting.complexity,
        modelId: result.modelUsed,
        reason: `${coraRouting.reason} · evaluation FSM via gateway`,
      }
    } else {
      // Direct chat — Claude for code, OpenAI for creative/reasoning, cheap for simple.
      const result = await createForFeature(openai!, coraRouting.feature, {
        messages,
        model: coraRouting.modelId,
        aiModel: coraRouting.aiModelPreset,
        temperature: coraRouting.temperature,
        max_tokens: capTokensForCourseSettings(coraRouting.maxTokens, courseStudentSettings),
        usageContext:
          Number.isFinite(studentIdNum) && studentIdNum > 0
            ? {
                actor: {
                  userId: studentIdNum,
                  userRole: "student",
                  membershipTier: effectiveMembershipTier,
                  courseId: studentCourseId,
                },
                feature: "CHAT",
                module: "ai-tutor",
                operation: "direct_chat",
                billable: !coraLiteMode,
              }
            : undefined,
      })
      aiContent = result.content
      modelUsedMeta = result.modelUsed
      agentUsageCredits = result.creditsCharged
      routingMeta = {
        provider: coraRouting.provider,
        domain: coraRouting.domain,
        complexity: coraRouting.complexity,
        modelId: result.modelUsed,
        reason: coraRouting.reason,
      }
    }

    let response = typeof aiContent === "string" ? aiContent : String(aiContent ?? "")
    if (askCoraGate) {
      const gated = applyAskCoraOutputGate(response, askCoraGate.policy)
      response = gated.text
      void logAskCoraGateEvent({
        studentId: studentIdNum,
        gate: askCoraGate,
        answerBlocked: gated.blockedAnswer,
        providedConceptualGuidance: !gated.blockedAnswer,
      })
    }
    const responseTime = Date.now() - startTime


    // Auto-detect topic from the conversation
    let detectedTopic = context?.topic || 'General'
    const topicKeywords = {
      'Variables': ['variable', 'var', 'int', 'float', 'double', 'char', 'string', 'declaration'],
      'Loops': ['loop', 'for', 'while', 'do-while', 'iteration', 'repeat'],
      'Functions': ['function', 'method', 'return', 'parameter', 'argument', 'void'],
      'Arrays': ['array', 'vector', 'index', 'element', 'subscript'],
      'Pointers': ['pointer', 'address', 'reference', 'dereference', 'malloc', 'new', 'delete'],
      'Classes': ['class', 'object', 'constructor', 'destructor', 'member', 'method'],
      'Inheritance': ['inherit', 'base', 'derived', 'parent', 'child', 'override'],
      'Debugging': ['error', 'bug', 'debug', 'segmentation fault', 'crash', 'exception'],
      'Algorithms': ['algorithm', 'sort', 'search', 'complexity', 'efficiency', 'big-o'],
      'Data Structures': ['linked list', 'stack', 'queue', 'tree', 'graph', 'heap']
    }

    const messageLower = message.toLowerCase()
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => messageLower.includes(keyword))) {
        detectedTopic = topic
        break
      }
    }

    // Deduct Cora Credits from metered usage (skip charge in Cora Lite)
    let sessionId: number | null = null
    if (studentId) {
      try {
        let creditsUsed = 0
        if (!coraLiteMode) {
          const { estimateCoraCreditsForMessage, CORA_MIN_PREMIUM_CREDITS } = await import(
            "@/lib/cora/credits"
          )
          const floor = estimateCoraCreditsForMessage(String(message ?? ""), {
            hasAttachments: Boolean(attachments?.length),
          })
          if (agentUsageCredits != null && agentUsageCredits > 0) {
            // Agent path already charged the student-facing ledger.
            // Still debit the campus pool — institution cover is capped, not free.
            creditsUsed = agentUsageCredits
            try {
              const { tryDebitInstitutionCora } = await import("@/lib/institutions/cora")
              await tryDebitInstitutionCora({
                userType: "student",
                userId: studentIdNum,
                credits: creditsUsed,
                workflowType: "student_cora",
              })
            } catch {
              /* personal charge already applied */
            }
          } else {
            creditsUsed = Math.max(CORA_MIN_PREMIUM_CREDITS, floor)
            const deducted = await deductAITutorCredits(studentIdNum, creditsUsed)
            if (!deducted) {
              console.error(`[AI Tutor] Failed to deduct credits for student ${studentId}`)
            }
          }
        }
        
        const result = await sql`
          INSERT INTO ai_tutor_conversations (
            student_id,
            message,
            response,
            topic,
            response_time,
            created_at
          )
          VALUES (
            ${studentIdNum},
            ${message},
            ${response},
            ${detectedTopic},
            ${responseTime},
            NOW()
          )
          RETURNING id
        `
        sessionId = result[0]?.id || null

        if (sessionId) {
          try {
            const { findStudentCoveredLicenses } = await import("@/lib/institutions/coverage")
            const { recordAiLearningInteraction } = await import("@/lib/institutions/ai-learning-interactions")
            const licenses = await findStudentCoveredLicenses(studentIdNum, { courseId: studentCourseId ?? undefined })
            const license = licenses[0]
            if (license) {
              const practiceBefore = await sql`
                SELECT COUNT(*)::int AS n FROM practice_attempts
                WHERE student_id = ${studentIdNum}
                  AND COALESCE(started_at, completed_at) >= NOW() - INTERVAL '24 hours'
              `.catch(() => [{ n: 0 }])
              await recordAiLearningInteraction({
                institutionId: license.institutionId,
                studentId: studentIdNum,
                courseId: studentCourseId,
                conceptId: detectedTopic ?? null,
                sessionId: String(sessionId),
                workflowType: "student_cora",
                userMessage: String(message ?? ""),
                learningGoal: tutorLearningGoal,
                activeAssessment: assessmentIntegrityCtx?.state === "active",
                assessmentId: assessmentIntegrityCtx?.assessmentId ?? null,
                attemptCountBeforeAi: Number(practiceBefore[0]?.n ?? 0),
                credits: creditsUsed > 0 ? creditsUsed : null,
                latencyMs: responseTime ?? null,
              })
            }
          } catch {
            /* analytics must not block chat */
          }
        }
        
        if (sessionId && !coraLiteMode) {
          try {
            await sql`
              UPDATE ai_tutor_credit_transactions
              SET session_id = ${sessionId}
              WHERE student_id = ${studentIdNum}
                AND transaction_type = 'spent'
                AND session_id IS NULL
                AND created_at > NOW() - INTERVAL '1 minute'
            `
          } catch {
            // Ignore if table doesn't exist
          }
        }
        
      } catch (logError: any) {
        // Don't fail the request if logging fails
        if (logError.message?.includes('does not exist')) {
        } else if (logError.message?.includes('foreign key')) {
        } else {
          console.error("[AI Tutor] Failed to log conversation:", logError.message)
        }
      }
    }

    // Parse premium features from response
    let messageType: string = 'normal'
    let meta: any = {}
    let weaknessInsight: string | undefined
    let visualizerData: any
    let rubricFeedback: any
    let debugTrace: any
    let mistakeSimulation: any
    let lessonBlock: any
    
    // Check for special message types in response
    if ((response.includes('[LESSON_BLOCK]')) || (analysis && analysis.confusionScore >= 4)) {
      messageType = 'lessonBlock'
    }
    
    if (response.includes('[VISUALIZER]')) {
      messageType = 'visualizer'
    }
    
    if (response.includes('[RUBRIC_FEEDBACK]')) {
      messageType = 'rubricFeedback'
    }
    
    if (response.includes('[DEBUG_TRACE]')) {
      messageType = 'debugTrace'
    }
    
    // Extract weakness insight
    if (analysis && analysis.confusionScore >= 4) {
      weaknessInsight = "I noticed you seem uncertain about this concept. Let me break it down into simpler parts."
    }
    
    if (response.includes('[MISTAKE_SIMULATION]') || message.toLowerCase().includes('show_common_mistakes')) {
      messageType = 'mistakeSimulation'
    }

    meta.askedQuestion = response.includes('?')
    meta.weaknessDetected = analysis && analysis.confusionScore >= 4
    meta.microLessonAvailable = analysis && analysis.confusionScore >= 4
    if (chatConfig?.learningGoal) {
      meta.learningGoal = chatConfig.learningGoal
    }

    const publicRoute = buildPublicCoraChatFields({
      profile: coraRouting.profile ?? (coraLiteMode ? "lite" : "standard"),
      liteMode: coraLiteMode,
      complexity: coraRouting.complexity,
      reason: routingMeta?.reason ?? coraRouting.reason,
      ui: coraUiFromProposals(response, coraProposals),
    })

    return NextResponse.json({
      response,
      detectedTopic,
      isConfigured: true,
      timestamp: new Date().toISOString(),
      responseTime,
      // Premium features
      messageType,
      meta,
      weaknessInsight,
      visualizerData,
      rubricFeedback,
      debugTrace,
      mistakeSimulation,
      lessonBlock,
      proposals: coraProposals,
      ...publicRoute,
      ...(agentUsageCredits != null ? { creditsCharged: agentUsageCredits } : {}),
    })
  } catch (error: any) {
    console.error("[AI Tutor] Error:", error)
    
    // Provide helpful error messages
    if (error.code === 'insufficient_quota') {
      return NextResponse.json({
        response: "⚠️ **AI Tutor Usage Limit Reached**\n\nThe AI assistant has reached its usage limit for this month. Please contact your instructor to add more credits to the OpenAI account.\n\nIn the meantime, you can:\n- Use the lecture-specific AI (available in slides)\n- Ask questions in the forum\n- Attend office hours",
        isConfigured: false,
        timestamp: new Date().toISOString(),
      })
    }
    
    if (error.code === 'invalid_api_key') {
      return NextResponse.json({
        response: "⚠️ **AI Tutor Misconfigured**\n\nThere's an issue with the AI configuration. Please contact your instructor to update the OpenAI API key.",
        isConfigured: false,
        timestamp: new Date().toISOString(),
      })
    }

    if (error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED')) {
      return NextResponse.json({
        response: "⚠️ **Connection Timeout**\n\nThe AI service is taking too long to respond. Please try again in a moment.",
        isConfigured: false,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      response: "❌ Sorry, I encountered an unexpected error. Please try again, or contact your instructor if the problem persists.",
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 200 }) // Return 200 so message shows to user
  }
}
