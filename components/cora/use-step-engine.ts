"use client"

import { useCallback, useMemo, useState } from "react"
import type { CoraHintLevel, CoraSession, CoraStep } from "@/lib/cora/step-engine/types"

export function useStepEngine(session: CoraSession | null) {
  const [stepIndex, setStepIndex] = useState(0)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [hintsUsed, setHintsUsed] = useState<CoraHintLevel[]>([])
  const [checkpointResults, setCheckpointResults] = useState<Record<string, boolean>>({})
  const [reflections, setReflections] = useState<Record<string, string>>({})
  const [confidence, setConfidence] = useState<number | null>(null)
  const [activeHint, setActiveHint] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)

  const steps = session?.steps ?? []
  const current: CoraStep | null = steps[stepIndex] ?? null

  const canAdvance = useMemo(() => {
    if (!current || session?.mode !== "guided") return true
    if (current.interaction?.type === "reflect") {
      return Boolean(reflections[current.id]?.trim())
    }
    if (current.interaction?.type === "checkpoint") {
      const ck = current.interaction.checkpoint
      return checkpointResults[ck.id] === true
    }
    if (current.interaction?.type === "confidence") {
      return confidence != null
    }
    return true
  }, [checkpointResults, confidence, current, reflections, session?.mode])

  const markComplete = useCallback((id: string) => {
    setCompletedIds((prev) => new Set(prev).add(id))
  }, [])

  const goTo = useCallback(
    (index: number) => {
      if (!steps.length) return
      setStepIndex(Math.max(0, Math.min(steps.length - 1, index)))
      setActiveHint(null)
      setFinished(false)
    },
    [steps.length],
  )

  const next = useCallback(() => {
    if (!current) return
    markComplete(current.id)
    if (stepIndex >= steps.length - 1) {
      setFinished(true)
      return
    }
    setStepIndex((i) => i + 1)
    setActiveHint(null)
  }, [current, markComplete, stepIndex, steps.length])

  const prev = useCallback(() => {
    setFinished(false)
    setStepIndex((i) => Math.max(0, i - 1))
    setActiveHint(null)
  }, [])

  const useHint = useCallback((level: CoraHintLevel, text: string) => {
    setHintsUsed((h) => [...h, level])
    setActiveHint(text)
  }, [])

  const submitCheckpoint = useCallback((checkpointId: string, optionId: string, correct: boolean) => {
    setCheckpointResults((r) => ({ ...r, [checkpointId]: correct }))
  }, [])

  const reset = useCallback(() => {
    setStepIndex(0)
    setCompletedIds(new Set())
    setHintsUsed([])
    setCheckpointResults({})
    setReflections({})
    setConfidence(null)
    setActiveHint(null)
    setFinished(false)
  }, [])

  return {
    stepIndex,
    steps,
    current,
    completedIds,
    hintsUsed,
    checkpointResults,
    reflections,
    setReflections,
    confidence,
    setConfidence,
    activeHint,
    finished,
    canAdvance,
    goTo,
    next,
    prev,
    useHint,
    submitCheckpoint,
    reset,
  }
}
