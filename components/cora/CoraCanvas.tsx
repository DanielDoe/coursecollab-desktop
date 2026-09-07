"use client"

import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { LectureAiMarkdown } from "@/components/lecture-ai-markdown"
import { CoraEquationStrip } from "@/components/cora/CoraEquationStrip"
import { CoraCheckpoint } from "@/components/cora/CoraCheckpoint"
import type { CoraMode, CoraSession, CoraStep } from "@/lib/cora/step-engine/types"

type Props = {
  session: CoraSession
  step: CoraStep
  mode: CoraMode
  accent: string
  activeHint: string | null
  reflection: string
  onReflectionChange: (v: string) => void
  confidence: number | null
  onConfidenceChange: (v: number) => void
  checkpointResults: Record<string, boolean>
  onCheckpoint: (checkpointId: string, optionId: string, correct: boolean) => void
}

export function CoraCanvas({
  session,
  step,
  mode,
  accent,
  activeHint,
  reflection,
  onReflectionChange,
  confidence,
  onConfidenceChange,
  checkpointResults,
  onCheckpoint,
}: Props) {
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto p-5 sm:p-8 lg:p-10">
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] to-[var(--muted)]/30 p-6 shadow-inner sm:p-8 lg:p-10",
          "min-h-[360px]",
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">{step.phase}</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--cc-text)] sm:text-2xl">{step.title}</h2>
            </div>

            {step.diagram?.mediaUrl ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-2 dark:bg-slate-950"
              >
                <Image
                  src={step.diagram.mediaUrl}
                  alt={step.diagram.title ?? "Diagram"}
                  width={640}
                  height={360}
                  className="mx-auto h-auto max-h-48 w-auto object-contain"
                  unoptimized
                />
              </motion.div>
            ) : step.diagram ? (
              <div className={cn("rounded-2xl border border-dashed border-[var(--border)] p-6 text-center", accent.replace("from-", "border-").split(" ")[0])}>
                <p className="text-sm font-semibold text-[var(--cc-text)]">{step.diagram.title}</p>
                <p className="mt-1 text-xs text-[var(--cc-text-muted)]">{step.diagram.description}</p>
              </div>
            ) : null}

            {step.equations && step.equations.length > 0 ? (
              <CoraEquationStrip equations={step.equations} accent={accent} />
            ) : null}

            <div className="prose prose-sm dark:prose-invert max-w-none">
              <LectureAiMarkdown content={step.explanation} />
            </div>

            {activeHint ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100"
              >
                <p className="font-semibold mb-1">Hint</p>
                <LectureAiMarkdown content={activeHint} />
              </motion.div>
            ) : null}

            {mode === "guided" && step.interaction?.type === "reflect" ? (
              <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--cc-background)]/60 p-4">
                <p className="text-sm font-semibold text-[var(--cc-text)]">{step.interaction.prompt}</p>
                <Textarea
                  value={reflection}
                  onChange={(e) => onReflectionChange(e.target.value)}
                  placeholder={step.interaction.placeholder}
                  className="min-h-[88px] rounded-xl border-[var(--border)] bg-[var(--cc-surface)]"
                />
              </div>
            ) : null}

            {mode === "guided" && step.interaction?.type === "checkpoint" ? (
              <CoraCheckpoint
                checkpoint={step.interaction.checkpoint}
                result={checkpointResults[step.interaction.checkpoint.id]}
                onAnswer={onCheckpoint}
              />
            ) : null}

            {mode === "guided" && step.interaction?.type === "confidence" ? (
              <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--cc-background)]/60 p-4">
                <p className="text-sm font-semibold text-[var(--cc-text)]">{step.interaction.prompt}</p>
                <Slider
                  value={[confidence ?? 50]}
                  onValueChange={([v]) => onConfidenceChange(v ?? 50)}
                  max={100}
                  step={5}
                />
                <p className="text-center text-sm font-medium text-[var(--cc-accent)]">{confidence ?? 50}% confident</p>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {session.problem.questionText && step.index === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/15 p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--cc-text-muted)]">Problem</p>
          <LectureAiMarkdown content={session.problem.questionText} />
        </div>
      ) : null}
    </div>
  )
}
