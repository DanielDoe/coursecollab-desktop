"use client"

import { motion } from "framer-motion"
import { ArrowRight, CheckCircle2, Loader2, NotebookPen, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CoraSession } from "@/lib/cora/step-engine/types"

type Props = {
  session: CoraSession
  onClose: () => void
  onRestart: () => void
  onExportToNotes?: () => void
  isExporting?: boolean
}

export function CoraSummary({
  session,
  onClose,
  onRestart,
  onExportToNotes,
  isExporting = false,
}: Props) {
  const summary = session.summary

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto p-8 sm:p-12"
    >
      <div className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <CheckCircle2 className="mb-4 h-14 w-14 text-emerald-500" />
        <h2 className="text-2xl font-bold text-[var(--cc-text)]">Session complete</h2>
        <p className="mt-2 text-sm text-[var(--cc-text-secondary)]">
          You worked through {session.steps.length} steps in {session.mode} mode.
        </p>

        {summary ? (
          <div className="mt-8 w-full space-y-4 text-left">
            {[
              { title: "Concepts", items: summary.conceptsLearned },
              { title: "Skills practiced", items: summary.skillsPracticed },
              { title: "Try next", items: summary.recommendedNext },
            ].map((block) =>
              block.items.length ? (
                <div
                  key={block.title}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--cc-text-muted)]">
                    {block.title}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--cc-text)]">
                    {block.items.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        ) : null}

        {session.finalAnswer ? (
          <div className="mt-6 w-full rounded-2xl border border-[var(--border)] bg-[var(--muted)]/20 p-5 text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--cc-text-muted)]">
              Reference answer
            </p>
            <p className="mt-2 font-mono text-sm text-[var(--cc-text)]">{session.finalAnswer}</p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {onExportToNotes ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-xl"
              disabled={isExporting}
              onClick={onExportToNotes}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <NotebookPen className="h-4 w-4" />
              )}
              Export to Notes
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="gap-2 rounded-xl" onClick={onRestart}>
            <RotateCcw className="h-4 w-4" />
            Restart
          </Button>
          <Button type="button" className="gap-2 rounded-xl" onClick={onClose}>
            Done
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
