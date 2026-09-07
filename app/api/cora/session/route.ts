import { type NextRequest, NextResponse } from "next/server"
import { buildCoraWalkthrough } from "@/lib/cora/build-walkthrough"
import { enrichCoraContextFromBank, enrichCoraContextFromQuizQuestion } from "@/lib/cora/load-bank-context"
import { buildCoraSession } from "@/lib/cora/step-engine/build-session"
import type { CoraMode } from "@/lib/cora/step-engine/types"
import type { CoraProblemContext } from "@/lib/cora/types"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import {
  buildAssessmentIntegrityRefusal,
  resolveAssessmentIntegrityContext,
  textMatchesAssessmentQuestions,
} from "@/lib/cora/security"

export const dynamic = "force-dynamic"
export const maxDuration = 45

/** Full Cora interactive session — instructor data first, then AI. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const body = (await request.json()) as CoraProblemContext & { mode?: CoraMode }
    if (!body?.questionText?.trim()) {
      return NextResponse.json({ error: "questionText is required." }, { status: 400 })
    }

    // Integrity: this endpoint produces full walkthroughs (including final answers).
    // If the student has an active attempt, refuse when the problem references that
    // assessment directly (quizId) or reproduces one of its questions (content match) —
    // the source/assessmentState fields in the body are client-claimed and not trusted.
    const integrity = await resolveAssessmentIntegrityContext(auth.studentDbId)
    const integrityProtected =
      integrity.state === "active" ||
      (integrity.state === "submitted" && !integrity.answersReleased)
    if (integrityProtected && integrity.assessmentId != null) {
      const referencesActiveAssessment =
        (body.quizId != null && Number(body.quizId) === integrity.assessmentId) ||
        (await textMatchesAssessmentQuestions(
          integrity.assessmentId,
          String(body.questionText ?? ""),
        ))
      if (referencesActiveAssessment) {
        return NextResponse.json(
          {
            error: buildAssessmentIntegrityRefusal(integrity),
            assessmentIntegrity: {
              state: integrity.state,
              title: integrity.title,
              highStakes: integrity.highStakes,
            },
          },
          { status: 403 },
        )
      }
    }

    const mode: CoraMode = body.mode === "explain" ? "explain" : "guided"
    let problem = body as CoraProblemContext
    problem = await enrichCoraContextFromQuizQuestion(problem)
    problem = await enrichCoraContextFromBank(problem)

    const walkthrough = await buildCoraWalkthrough(problem)
    const session = buildCoraSession({ mode, problem, walkthrough })

    return NextResponse.json({ session })
  } catch (error) {
    console.error("[cora/session]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start Cora session." },
      { status: 500 },
    )
  }
}
