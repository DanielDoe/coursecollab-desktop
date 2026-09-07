"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"
import {
  createQuestionPrepareSteps,
  runQuestionPreparePipeline,
  updateQuestionPrepareStep,
  type QuestionPrepareStep,
} from "@/lib/question-prepare"
import { cn } from "@/lib/utils"

type Props = {
  fetching: boolean
  texts: string[] | null | undefined
  title: string
  subtitle?: string
  enabled?: boolean
  children: ReactNode
}

function QuestionPrepareLoadingOverlay({
  visible,
  title,
  subtitle,
  steps,
  questionCount,
}: {
  visible: boolean
  title: string
  subtitle?: string
  steps: QuestionPrepareStep[]
  questionCount: number
}) {
  if (!visible) return null

  const doneCount = steps.filter((s) => s.status === "done").length
  const progress = steps.length > 0 ? doneCount / steps.length : 0

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-[var(--card)]/95 backdrop-blur-sm">
      <div className="w-full max-w-sm px-6 py-8 text-center">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[var(--cc-accent)]" />
        <p className="text-sm font-semibold text-[var(--cc-text)]">{title}</p>
        {subtitle ? <p className="mt-1 text-xs text-[var(--cc-text-muted)]">{subtitle}</p> : null}
        {questionCount > 0 ? (
          <p className="mt-2 text-[10px] uppercase tracking-wider text-[var(--cc-text-muted)]">
            {questionCount} question{questionCount === 1 ? "" : "s"}
          </p>
        ) : null}
        <div className="mx-auto mt-4 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-[var(--muted)]">
          <div
            className="h-full rounded-full bg-[var(--cc-accent)] transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <ul className="mt-4 space-y-1 text-left text-[11px] text-[var(--cc-text-muted)]">
          {steps.map((step) => (
            <li
              key={step.id}
              className={cn(
                step.status === "done" && "text-[var(--cc-accent-dark)]",
                step.status === "active" && "font-medium text-[var(--cc-text)]",
              )}
            >
              {step.status === "done" ? "✓ " : step.status === "active" ? "… " : "○ "}
              {step.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Stepped prepare overlay while question copy loads — mobile QuestionPrepareGate parity. */
export function QuestionPrepareGate({
  fetching,
  texts,
  title,
  subtitle,
  enabled = true,
  children,
}: Props) {
  const [visible, setVisible] = useState(false)
  const [steps, setSteps] = useState<QuestionPrepareStep[]>(() => createQuestionPrepareSteps("fetch"))
  const [questionCount, setQuestionCount] = useState(0)
  const preparingRef = useRef(false)
  const lastTextsRef = useRef("")

  const begin = useCallback(() => {
    preparingRef.current = false
    setQuestionCount(0)
    setVisible(true)
    setSteps(createQuestionPrepareSteps("fetch"))
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
  }, [])

  const prepare = useCallback(async (list: string[]) => {
    if (preparingRef.current) return
    preparingRef.current = true
    setQuestionCount(list.length)
    setVisible(true)
    setSteps(createQuestionPrepareSteps("parse"))

    try {
      await runQuestionPreparePipeline(list, (id, status) => {
        setSteps((prev) => updateQuestionPrepareStep(prev, id, status))
      })
    } finally {
      preparingRef.current = false
      setVisible(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (fetching) begin()
  }, [enabled, fetching, begin])

  useEffect(() => {
    if (!enabled || fetching) return
    const list = texts ?? []
    if (list.length === 0) {
      lastTextsRef.current = ""
      dismiss()
      return
    }
    const signature = list.join("\u0001")
    if (signature === lastTextsRef.current) return
    lastTextsRef.current = signature
    void prepare(list)
  }, [enabled, fetching, texts, prepare, dismiss])

  const showOverlay = enabled && (fetching || visible) && (fetching || (texts?.length ?? 0) > 0)

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {children}
      <QuestionPrepareLoadingOverlay
        visible={showOverlay}
        title={title}
        subtitle={subtitle}
        steps={steps}
        questionCount={questionCount || texts?.length || 0}
      />
    </div>
  )
}
