import type { CodeReplayPhase, CodeReplayStep } from "@/lib/codebench-replay"

export type ReplayPaceMode = "fast" | "normal" | "tutorial" | "deep-dive"

const PACE_MODE_KEYS = new Set<string>(["fast", "normal", "tutorial", "deep-dive"])

export function normalizePaceMode(value: unknown): ReplayPaceMode {
  if (typeof value === "string" && PACE_MODE_KEYS.has(value)) {
    return value as ReplayPaceMode
  }
  return "tutorial"
}

export type ReplayModeConfig = {
  label: string
  autoPlayMs: number
  staggerChildren: number
  delayChildren: number
  itemDuration: number
  slideDuration: number
  bulletStagger: number
  showBullets: boolean
  showTeachingNotes: boolean
  showDeepInsight: boolean
  showConceptBadge: boolean
  explanationMode: "summary" | "full"
  codeContextPad: number
  /** Minimum extra ms to let reveal animations finish before auto-advance */
  animationBufferMs: number
}

export const REPLAY_PACE_MODES: Record<ReplayPaceMode, ReplayModeConfig> = {
  fast: {
    label: "Fast",
    autoPlayMs: 1400,
    staggerChildren: 0.03,
    delayChildren: 0,
    itemDuration: 0.18,
    slideDuration: 0.22,
    bulletStagger: 0.04,
    showBullets: false,
    showTeachingNotes: false,
    showDeepInsight: false,
    showConceptBadge: false,
    explanationMode: "summary",
    codeContextPad: 1,
    animationBufferMs: 200,
  },
  normal: {
    label: "Normal",
    autoPlayMs: 2800,
    staggerChildren: 0.06,
    delayChildren: 0.04,
    itemDuration: 0.3,
    slideDuration: 0.34,
    bulletStagger: 0.08,
    showBullets: false,
    showTeachingNotes: false,
    showDeepInsight: false,
    showConceptBadge: true,
    explanationMode: "full",
    codeContextPad: 2,
    animationBufferMs: 450,
  },
  tutorial: {
    label: "Tutorial",
    autoPlayMs: 4200,
    staggerChildren: 0.1,
    delayChildren: 0.08,
    itemDuration: 0.42,
    slideDuration: 0.45,
    bulletStagger: 0.14,
    showBullets: true,
    showTeachingNotes: true,
    showDeepInsight: false,
    showConceptBadge: true,
    explanationMode: "full",
    codeContextPad: 2,
    animationBufferMs: 900,
  },
  "deep-dive": {
    label: "Deep dive",
    autoPlayMs: 5800,
    staggerChildren: 0.14,
    delayChildren: 0.12,
    itemDuration: 0.52,
    slideDuration: 0.52,
    bulletStagger: 0.18,
    showBullets: true,
    showTeachingNotes: true,
    showDeepInsight: true,
    showConceptBadge: true,
    explanationMode: "full",
    codeContextPad: 3,
    animationBufferMs: 1400,
  },
}

const PHASE_DEEP_INSIGHTS: Partial<Record<CodeReplayPhase, string>> = {
  setup:
    "Setup lines run once before your algorithm's core logic. Tracing them first builds a reliable baseline for every later step.",
  loop:
    "A for-loop packages init, condition, body, and increment into one construct — but the CPU still executes those pieces in that order every cycle.",
  condition:
    "The condition is a gate: true keeps you inside the loop, false breaks out. Drawing a flowchart box here helps when loops get nested.",
  body:
    "The body is where the work happens. If output looks wrong, compare the body against your intended formula variable-by-variable.",
  update:
    "The increment step prevents infinite loops. Off-by-one bugs usually mean this clause runs one time too many or too few.",
  output:
    "Output is a side effect — it does not change program state, but it confirms the state you computed is what you expected.",
  return:
    "The return value is how your program communicates success or failure to the shell, CI systems, and calling code.",
}

const CONCEPT_DEEP_INSIGHTS: Record<string, string> = {
  "Compound assignment":
    "Operators like += combine read and write into one expression, which is both concise and easy to misread during debugging — expand them mentally when stuck.",
  "Loop condition":
    "Write the condition as a question: 'Should I run another iteration?' Answering with the current variable values prevents skipping or repeating iterations.",
  "for-loop init":
    "Loop-scoped variables (int i inside the for header) exist only inside the loop in modern C++ — they cannot leak into later lines.",
}

export function summarizeExplanation(text: string): string {
  const trimmed = text.trim()
  const first = trimmed.match(/^[\s\S]*?[.!?](?:\s|$)/)
  return first ? first[0].trim() : trimmed
}

export function getDeepInsight(step: CodeReplayStep): string | undefined {
  if (step.deepInsight) return step.deepInsight
  if (step.concept && CONCEPT_DEEP_INSIGHTS[step.concept]) return CONCEPT_DEEP_INSIGHTS[step.concept]
  if (step.phase && PHASE_DEEP_INSIGHTS[step.phase]) return PHASE_DEEP_INSIGHTS[step.phase]
  return undefined
}

export function getExplanationForMode(step: CodeReplayStep, mode: ReplayModeConfig): string {
  if (mode.explanationMode === "summary") return summarizeExplanation(step.explanation)
  return step.explanation
}

export function getBulletsForMode(step: CodeReplayStep, mode: ReplayModeConfig): string[] {
  if (!mode.showBullets || !step.bullets?.length) return []
  return step.bullets
}

export function estimateStepRevealMs(step: CodeReplayStep, mode: ReplayModeConfig, reducedMotion: boolean): number {
  if (reducedMotion) return 0

  const explanation = getExplanationForMode(step, mode)
  const sentenceCount = Math.max(1, explanation.split(/(?<=[.!?])\s+/).filter(Boolean).length)
  const bulletCount = getBulletsForMode(step, mode).length
  const hasTeaching = mode.showTeachingNotes && !!step.teachingNote
  const hasDeep = mode.showDeepInsight && !!getDeepInsight(step)
  const hasCondition = !!step.condition
  const varCount = Object.keys(step.variables).length

  const blocks =
    2 + // badges + title
    1 + // code window
    sentenceCount +
    bulletCount +
    (hasTeaching ? 1 : 0) +
    (hasDeep ? 1 : 0) +
    (hasCondition ? 1 : 0) +
    Math.min(varCount, 1)

  return (
    mode.delayChildren * 1000 +
    blocks * mode.staggerChildren * 1000 +
    mode.itemDuration * 1000
  )
}

export function computeAutoAdvanceMs(
  step: CodeReplayStep,
  mode: ReplayModeConfig,
  reducedMotion: boolean,
): number {
  const revealMs = estimateStepRevealMs(step, mode, reducedMotion)
  return Math.max(mode.autoPlayMs, revealMs + mode.animationBufferMs)
}
