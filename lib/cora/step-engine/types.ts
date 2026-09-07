import type { CoraDomain, CoraProblemContext, CoraProblemSource } from "@/lib/cora/types"

export type CoraMode = "guided" | "explain"

export type CoraPhase =
  | "problem"
  | "analyze"
  | "plan"
  | "solve"
  | "verify"
  | "reflect"

export type CoraHintLevel = "small" | "medium" | "almost" | "step" | "solution"

export type CoraEquationLine = {
  id: string
  latex: string
  label?: string
}

export type CoraDiagramSpec = {
  kind: "circuit" | "flowchart" | "memory" | "timeline" | "generic"
  title?: string
  description?: string
  mediaUrl?: string | null
  highlights?: string[]
}

export type CoraAnimationSpec = {
  kind: "fade" | "slide" | "highlight" | "flow" | "substitute" | "execute"
  durationMs?: number
  target?: string
}

export type CoraCheckpointOption = {
  id: string
  label: string
  correct: boolean
  feedback?: string
}

export type CoraCheckpoint = {
  id: string
  prompt: string
  options: CoraCheckpointOption[]
  misconception?: string
}

export type CoraInteraction =
  | {
      type: "reflect"
      prompt: string
      placeholder?: string
    }
  | {
      type: "confidence"
      prompt: string
    }
  | {
      type: "checkpoint"
      checkpoint: CoraCheckpoint
    }

export type CoraStepHint = {
  level: CoraHintLevel
  text: string
  creditCost?: number
}

export type CoraStep = {
  id: string
  index: number
  phase: CoraPhase
  title: string
  explanation: string
  animation?: CoraAnimationSpec
  interaction?: CoraInteraction
  equations?: CoraEquationLine[]
  diagram?: CoraDiagramSpec
  checkpoint?: CoraCheckpoint
  hints?: CoraStepHint[]
  concepts?: string[]
}

export type CoraLearningSummary = {
  conceptsLearned: string[]
  mistakesMade: string[]
  skillsPracticed: string[]
  recommendedNext: string[]
}

export type CoraSession = {
  mode: CoraMode
  domain: CoraDomain
  source: CoraProblemSource
  dataSource: "reference" | "ai"
  problem: CoraProblemContext
  steps: CoraStep[]
  finalAnswer?: string | null
  summary?: CoraLearningSummary
}

export type CoraStepEngineState = {
  stepIndex: number
  completedStepIds: Set<string>
  hintsUsed: CoraHintLevel[]
  checkpointResults: Record<string, boolean>
  reflectionInputs: Record<string, string>
  confidence: number | null
  phase: CoraPhase
}
