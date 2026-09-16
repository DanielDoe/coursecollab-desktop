import { type NextRequest, NextResponse } from "next/server"
import { buildCoraWalkthrough } from "@/lib/cora/build-walkthrough"
import { enrichCoraContextFromBank, enrichCoraContextFromQuizQuestion } from "@/lib/cora/load-bank-context"
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

    let problem = body as CoraProblemContext
    problem = await enrichCoraContextFromQuizQuestion(problem)
    problem = await enrichCoraContextFromBank(problem)

    const walkthrough = await buildCoraWalkthrough(problem)
    return NextResponse.json(walkthrough)
  } catch (error) {
    console.error("[cora/walkthrough]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not build walkthrough." },
      { status: 500 },
    )
  }
}
