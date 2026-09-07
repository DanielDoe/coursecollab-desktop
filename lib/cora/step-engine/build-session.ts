import type {
  CoraCheckpoint,
  CoraEquationLine,
  CoraMode,
  CoraSession,
  CoraStep,
  CoraStepHint,
} from "@/lib/cora/step-engine/types"
import type { CoraProblemContext, CoraWalkthroughResponse, CoraWalkthroughStep } from "@/lib/cora/types"
import { phaseForStep } from "@/lib/cora/step-engine/phases"
import { defaultConcepts, diagramForDomain } from "@/lib/cora/plugins/registry"

const HINT_CREDITS: Record<string, number> = {
  small: 1,
  medium: 2,
  almost: 3,
  step: 5,
  solution: 10,
}

function extractEquations(text: string): CoraEquationLine[] {
  const lines = text.split(/\n/)
  const equations: CoraEquationLine[] = []
  let i = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.includes("=") || trimmed.length > 120) continue
    if (/^[A-Za-z0-9\\^_+\-*/().,\s=]+$/.test(trimmed.replace(/\$/g, ""))) {
      equations.push({ id: `eq-${i++}`, latex: trimmed.replace(/^\$|\$$/g, "") })
    }
  }
  return equations.slice(0, 6)
}

function buildHints(step: CoraWalkthroughStep, finalAnswer?: string | null): CoraStepHint[] {
  const hints: CoraStepHint[] = []
  if (step.hint) {
    hints.push({ level: "small", text: step.hint, creditCost: HINT_CREDITS.small })
    hints.push({ level: "medium", text: step.hint, creditCost: HINT_CREDITS.medium })
  } else if (step.body.length > 40) {
    hints.push({
      level: "small",
      text: `Focus on: ${step.title}. What quantity or idea is introduced here?`,
      creditCost: HINT_CREDITS.small,
    })
  }
  hints.push({
    level: "almost",
    text: step.body.slice(0, Math.min(180, step.body.length)) + (step.body.length > 180 ? "…" : ""),
    creditCost: HINT_CREDITS.almost,
  })
  hints.push({ level: "step", text: step.body, creditCost: HINT_CREDITS.step })
  if (finalAnswer) {
    hints.push({ level: "solution", text: `Reference result: ${finalAnswer}`, creditCost: HINT_CREDITS.solution })
  }
  return hints
}

function defaultCheckpoint(step: CoraWalkthroughStep, domain: CoraProblemContext["domain"]): CoraCheckpoint | undefined {
  if (step.kind !== "check" && step.kind !== "concept") return undefined
  if (domain === "circuit") {
    return {
      id: `ck-${step.id}`,
      prompt: "Which law is most useful for this step?",
      options: [
        { id: "kcl", label: "KCL (Kirchhoff's Current Law)", correct: step.title.toLowerCase().includes("node") },
        { id: "kvl", label: "KVL (Kirchhoff's Voltage Law)", correct: step.title.toLowerCase().includes("mesh") || step.title.toLowerCase().includes("loop") },
        { id: "ohm", label: "Ohm's Law", correct: !step.title.toLowerCase().includes("node") && !step.title.toLowerCase().includes("mesh") },
      ].map((o) => ({ ...o, feedback: o.correct ? "Nice — that matches this step." : "Re-read the step goal and try again." })),
      misconception: "Mixing KCL and KVL is a common source of sign errors.",
    }
  }
  if (domain === "coding") {
    return {
      id: `ck-${step.id}`,
      prompt: "What should you verify before moving on?",
      options: [
        { id: "a", label: "Loop bounds and off-by-one", correct: true, feedback: "Yes — trace iteration boundaries." },
        { id: "b", label: "Only the final print statement", correct: false, feedback: "Trace how variables change each iteration." },
        { id: "c", label: "Compiler version", correct: false, feedback: "Focus on logic for this step." },
      ],
    }
  }
  return undefined
}

function toEngineStep(
  step: CoraWalkthroughStep,
  index: number,
  total: number,
  mode: CoraMode,
  problem: CoraProblemContext,
  finalAnswer?: string | null,
): CoraStep {
  const phase = phaseForStep(index, total, step.kind)
  const equations = extractEquations(step.body)
  const checkpoint = defaultCheckpoint(step, problem.domain)

  let interaction: CoraStep["interaction"]
  if (mode === "guided") {
    if (index === 0) {
      interaction = {
        type: "reflect",
        prompt: "What information do we know from the problem statement?",
        placeholder: "List given values, unknowns, and assumptions…",
      }
    } else if (checkpoint) {
      interaction = { type: "checkpoint", checkpoint }
    } else if (phase === "verify") {
      interaction = { type: "confidence", prompt: "How confident are you in this result?" }
    }
  }

  return {
    id: step.id,
    index,
    phase,
    title: step.title,
    explanation: step.body,
    animation: {
      kind: equations.length > 1 ? "substitute" : index === 0 ? "fade" : "slide",
      durationMs: 420,
    },
    interaction,
    equations: equations.length ? equations : undefined,
    diagram: index === 0 ? diagramForDomain(problem.domain, problem.mediaUrl) : undefined,
    checkpoint,
    hints: buildHints(step, finalAnswer),
    concepts: defaultConcepts(problem.domain),
  }
}

export function buildCoraSession(params: {
  mode: CoraMode
  problem: CoraProblemContext
  walkthrough: CoraWalkthroughResponse
}): CoraSession {
  const { mode, problem, walkthrough } = params
  const steps = walkthrough.steps.map((s, i) =>
    toEngineStep(s, i, walkthrough.steps.length, mode, problem, walkthrough.finalAnswer),
  )

  const concepts = new Set<string>()
  for (const s of steps) {
    for (const c of s.concepts ?? []) concepts.add(c)
  }

  return {
    mode,
    domain: walkthrough.domain,
    source: problem.source,
    dataSource: walkthrough.source,
    problem,
    steps,
    finalAnswer: walkthrough.finalAnswer,
    summary: {
      conceptsLearned: [...concepts],
      mistakesMade: [],
      skillsPracticed: steps.map((s) => s.title).slice(0, 5),
      recommendedNext: ["Review related lecture notes", "Practice similar problems in Practice Hub"],
    },
  }
}
