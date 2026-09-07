import type { CoraStep } from "@/lib/cora/step-engine/types"

/** Structured instructional walkthrough — do not dump a single Markdown essay. */
export type CoraWalkthroughStep = {
  id: string
  title: string
  explanation: string
  equation?: string
  code?: string
  visual?: string
  hint?: string
  checkpoint?: string
  expectedAnswer?: string
}

export type CoraWalkthrough = {
  title: string
  objective: string
  givens: string[]
  concepts: string[]
  steps: CoraWalkthroughStep[]
  finalAnswer?: string
  commonMistakes: string[]
  followUps: string[]
}

export function walkthroughFromCoraSteps(args: {
  title: string
  objective: string
  steps: CoraStep[]
}): CoraWalkthrough {
  return {
    title: args.title,
    objective: args.objective,
    givens: [],
    concepts: [],
    steps: args.steps.map((step) => ({
      id: step.id,
      title: step.title,
      explanation: step.explanation,
      equation: step.equations?.[0]?.latex,
      hint: step.hints?.[0]?.text,
      checkpoint: step.checkpoint?.prompt,
    })),
    commonMistakes: [],
    followUps: [],
  }
}
