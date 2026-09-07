export type QuestionPrepareStepId = "fetch" | "parse" | "math" | "choices" | "ready"

export type QuestionPrepareStepStatus = "pending" | "active" | "done"

export type QuestionPrepareStep = {
  id: QuestionPrepareStepId
  label: string
  status: QuestionPrepareStepStatus
}

const STEP_LABELS: Record<QuestionPrepareStepId, string> = {
  fetch: "Loading questions",
  parse: "Parsing question content",
  math: "Preparing math & formatting",
  choices: "Building answer choices",
  ready: "Ready to view",
}

export function createQuestionPrepareSteps(activeId: QuestionPrepareStepId = "fetch"): QuestionPrepareStep[] {
  const order: QuestionPrepareStepId[] = ["fetch", "parse", "math", "choices", "ready"]
  const activeIndex = order.indexOf(activeId)
  return order.map((id, index) => ({
    id,
    label: STEP_LABELS[id],
    status: index < activeIndex ? "done" : index === activeIndex ? "active" : "pending",
  }))
}

export function updateQuestionPrepareStep(
  steps: QuestionPrepareStep[],
  id: QuestionPrepareStepId,
  status: "active" | "done",
): QuestionPrepareStep[] {
  const order = steps.map((step) => step.id)
  const index = order.indexOf(id)
  if (index < 0) return steps

  return steps.map((step, stepIndex) => {
    if (status === "active") {
      if (stepIndex < index) return { ...step, status: "done" }
      if (stepIndex === index) return { ...step, status: "active" }
      return { ...step, status: "pending" }
    }
    if (stepIndex <= index) return { ...step, status: "done" }
    return step
  })
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

/** Warm layout/fonts before revealing heavy LaTeX question panels. */
export async function runQuestionPreparePipeline(
  texts: string[],
  onStep: (id: QuestionPrepareStepId, status: "active" | "done") => void,
) {
  onStep("parse", "active")
  await nextFrame()
  onStep("parse", "done")

  onStep("math", "active")
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.ready
    } catch {
      /* ignore */
    }
  }
  const hasMath = texts.some((t) => /\\[\(\[]|\$\$/.test(t))
  await wait(hasMath ? 120 : 40)
  onStep("math", "done")

  onStep("choices", "active")
  await nextFrame()
  onStep("choices", "done")

  onStep("ready", "active")
  await wait(60)
  onStep("ready", "done")
}
