import { type NextRequest, NextResponse } from "next/server"
import { buildCoraWalkthrough } from "@/lib/cora/build-walkthrough"
import { enrichCoraContextFromBank, enrichCoraContextFromQuizQuestion } from "@/lib/cora/load-bank-context"
import { CoraAssessmentPolicy } from "@/lib/cora/assessment-policy"
import { sanitizeProblemForCoraPolicy } from "@/lib/cora/assessment-policy-context"
import { enforceAskCoraGate, logAskCoraGateEvent } from "@/lib/cora/assessment-policy-gate"
import { resolveCallerStudentDbId } from "@/lib/student-api-auth"
import type { CoraProblemContext } from "@/lib/cora/types"

export const dynamic = "force-dynamic"
export const maxDuration = 45

/** Build an interactive step-by-step walkthrough for any problem context. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CoraProblemContext
    if (!body?.questionText?.trim()) {
      return NextResponse.json({ error: "questionText is required." }, { status: 400 })
    }

    const studentId = await resolveCallerStudentDbId(request)
    let problem = body as CoraProblemContext
    let canReveal = false

    if (studentId != null) {
      const gate = await enforceAskCoraGate({
        studentId,
        message: "Walk me through this without giving the final answer.",
        problem,
        source: problem.source,
        quizId: problem.quizId ?? null,
        questionId: problem.questionId != null ? Number(problem.questionId) : null,
        bankQuestionId: problem.bankQuestionId ?? null,
        attemptId: problem.attemptId ?? null,
        questionType: problem.questionType ?? null,
      })
      if (gate.policy.mode === "DISABLED") {
        void logAskCoraGateEvent({ studentId, gate, answerBlocked: true })
        return NextResponse.json(
          { error: gate.refusalMessage ?? "Walkthrough is not available for this question." },
          { status: 403 },
        )
      }
      canReveal = gate.policy.canRevealAnswer && gate.policy.canUseHiddenSolutionContext
      problem = gate.problem ?? problem
      if (canReveal) {
        problem = await enrichCoraContextFromQuizQuestion(problem)
        problem = await enrichCoraContextFromBank(problem)
      }
      void logAskCoraGateEvent({ studentId, gate, providedConceptualGuidance: true })
    } else {
      const locked = CoraAssessmentPolicy.evaluate({
        source: problem.source,
        questionType: problem.questionType,
        assessmentActive: true,
        submitted: false,
        solutionsReleased: false,
        assessmentClosed: false,
        instructorPolicy: "guided_only",
      })
      problem = sanitizeProblemForCoraPolicy(problem, locked) ?? problem
    }

    const walkthrough = await buildCoraWalkthrough(problem)
    if (!canReveal) {
      walkthrough.finalAnswer = null
    }
    return NextResponse.json(walkthrough)
  } catch (error) {
    console.error("[cora/walkthrough]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not build walkthrough." },
      { status: 500 },
    )
  }
}
