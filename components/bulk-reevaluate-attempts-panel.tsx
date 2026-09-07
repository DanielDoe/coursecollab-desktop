"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import {
  useBulkReevaluateAttempts,
  type AssessmentBulkReevaluateScope,
  type BulkReevaluateStrategy,
} from "@/hooks/use-bulk-reevaluate-attempts"
import { cn } from "@/lib/utils"

interface BulkReevaluateAttemptsPanelProps {
  quizId: number | null
  quizTitle: string
  assessmentLabel: string
  scope: AssessmentBulkReevaluateScope
  onScopeChange?: (scope: AssessmentBulkReevaluateScope) => void
  /** When false, scope is chosen elsewhere (show no radios). */
  showScopePicker: boolean
  variant: "inline" | "dialog"
  onClose?: () => void
  /** Inline only: render without a second card shell (same card as filters). */
  embeddedInCard?: boolean
  /** When set, API limits preview to students in this class session. */
  sessionCode?: string | null
}

export function BulkReevaluateAttemptsPanel({
  quizId,
  quizTitle,
  assessmentLabel,
  scope,
  onScopeChange,
  showScopePicker,
  variant,
  onClose,
  embeddedInCard = false,
  sessionCode,
}: BulkReevaluateAttemptsPanelProps) {
  const { loadingList, rows, phase, running, loadCandidates, runAll, staleCandidateList } =
    useBulkReevaluateAttempts(quizId, scope, sessionCode)
  const [strategyOpen, setStrategyOpen] = useState(false)
  const [strategy, setStrategy] = useState<BulkReevaluateStrategy>("batch")

  const openStrategyThenRun = () => {
    setStrategy("batch")
    setStrategyOpen(true)
  }

  const confirmStrategyAndRun = () => {
    setStrategyOpen(false)
    void runAll(strategy)
  }

  const listMaxClass =
    variant === "inline" ? "max-h-[min(420px,55vh)] sm:max-h-[520px]" : "max-h-48"

  const body = (
    <div className={embeddedInCard ? "space-y-4" : "space-y-4 py-2"}>
      {showScopePicker && onScopeChange && (
        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] p-3">
          <Label className="text-sm font-medium">What to re-evaluate</Label>
          <RadioGroup
            value={scope}
            onValueChange={(v) => onScopeChange(v as AssessmentBulkReevaluateScope)}
            className="mt-2 gap-2"
            disabled={running}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pending" id="br-scope-pending" />
              <Label htmlFor="br-scope-pending" className="font-normal cursor-pointer">
                Pending (PND%) only — attempts that still show pending grading
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="br-scope-all" />
              <Label htmlFor="br-scope-all" className="font-normal cursor-pointer">
                All completed attempts — every finished submission for this {assessmentLabel.toLowerCase()}
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      <div className={cn("flex flex-wrap gap-2", embeddedInCard && "sm:justify-start")}>
        <Button
          type="button"
          variant="secondary"
          className={embeddedInCard ? "h-10 w-full sm:w-auto" : undefined}
          onClick={() => void loadCandidates()}
          disabled={loadingList || running || !quizId}
        >
          {loadingList ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading…
            </>
          ) : (
            "Preview attempt list"
          )}
        </Button>
      </div>

      {phase !== "pick" && rows.length === 0 && !loadingList && (
        <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          No attempts match this scope.
        </p>
      )}

      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {rows.length} attempt{rows.length === 1 ? "" : "s"} to process — choose evaluation mode when you start
            {variant === "inline" && quizTitle ? (
              <span className="font-normal text-slate-500 dark:text-slate-400"> · {quizTitle}</span>
            ) : null}
          </p>
          <ul
            className={`overflow-y-auto rounded-lg border border-slate-200/90 dark:border-white/10 ${listMaxClass}`}
          >
            {rows.map((r, idx) => (
              <li
                key={r.id}
                className={cn(
                  "flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-sm last:border-b-0 dark:border-white/[0.06]",
                  idx % 2 === 0 ? "bg-white/80 dark:bg-transparent" : "bg-slate-50/90 dark:bg-white/[0.02]"
                )}
              >
                <span className="min-w-0 text-slate-700 dark:text-slate-200">
                  <span className="text-slate-500 dark:text-slate-400">{idx + 1}.</span>{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {r.studentName?.trim() || "—"}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400"> · Attempt #{r.id}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {r.status === "idle" && <span className="text-xs text-slate-500">Waiting</span>}
                  {r.status === "running" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                      <span className="text-xs text-teal-600">Working…</span>
                    </>
                  )}
                  {r.status === "done" && (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-green-700 dark:text-green-400">
                        Completed
                        {r.evaluated != null ? ` · ${r.evaluated} q` : ""}
                        {r.newScore != null ? ` · score ${Number(r.newScore).toFixed(2)}` : ""}
                      </span>
                    </>
                  )}
                  {r.status === "error" && (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-xs text-red-600 max-w-[min(200px,40vw)] truncate" title={r.error}>
                        {r.error}
                      </span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {staleCandidateList && (
            <p className="text-xs text-amber-800 dark:text-amber-200/90 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 px-2.5 py-2">
              The list above shows this run’s results (Completed / errors). Click <strong>Preview attempt list</strong> to
              reload who still qualifies for pending (PND%) or to refresh names.
            </p>
          )}
        </div>
      )}
    </div>
  )

  const strategyModal = (
    <Dialog open={strategyOpen} onOpenChange={setStrategyOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How should we re-evaluate?</DialogTitle>
          <DialogDescription>
            Applies to each attempt in the queue. Entire attempt uses one server request per student (lower API cost,
            concise batched feedback). Question by question runs one request per question (richer per-question feedback,
            more API calls).
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] p-3">
          <Label className="text-sm font-medium">Evaluation mode</Label>
          <RadioGroup
            value={strategy}
            onValueChange={(v) => setStrategy(v as BulkReevaluateStrategy)}
            className="mt-2 gap-3"
          >
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="batch" id="br-strat-batch" className="mt-0.5" />
              <Label htmlFor="br-strat-batch" className="font-normal cursor-pointer leading-snug">
                <span className="font-medium text-slate-900 dark:text-slate-100">Entire attempt (recommended)</span>
                <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  One API call per attempt — batched AI for code text; faster and lower cost.
                </span>
              </Label>
            </div>
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="chunked" id="br-strat-chunked" className="mt-0.5" />
              <Label htmlFor="br-strat-chunked" className="font-normal cursor-pointer leading-snug">
                <span className="font-medium text-slate-900 dark:text-slate-100">Question by question</span>
                <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  One request per question — more detailed feedback per item; higher API usage.
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setStrategyOpen(false)}>
            Cancel
          </Button>
          <Button type="button" className="bg-teal-600 hover:bg-teal-700" onClick={confirmStrategyAndRun}>
            Run with this mode
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (variant === "dialog") {
    return (
      <>
        {strategyModal}
        {body}
        <DialogFooter className="gap-3 sm:flex-row sm:justify-end sm:gap-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={running}>
            Close
          </Button>
          <Button
            type="button"
            className="bg-teal-600 hover:bg-teal-700"
            onClick={openStrategyThenRun}
            disabled={rows.length === 0 || running || phase === "pick" || !quizId}
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Re-evaluating…
              </>
            ) : (
              "Start re-evaluation"
            )}
          </Button>
        </DialogFooter>
      </>
    )
  }

  const startButton = (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        embeddedInCard ? "pt-0" : "pt-1"
      )}
    >
      {strategyModal}
      <Button
        type="button"
        variant="default"
        className={cn(
          "bg-teal-600 hover:bg-teal-700",
          embeddedInCard ? "h-10 w-full sm:min-w-[180px] sm:w-auto" : "w-full sm:w-auto"
        )}
        onClick={openStrategyThenRun}
        disabled={rows.length === 0 || running || phase === "pick" || !quizId}
      >
        {running ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Re-evaluating…
          </>
        ) : (
          "Start re-evaluation"
        )}
      </Button>
    </div>
  )

  if (embeddedInCard) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50/80 p-3 ring-1 ring-inset ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Preview & run
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">Queue and progress</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Load matching attempts, then start — you’ll pick <strong>entire attempt</strong> (one request per attempt,
            batched AI) or <strong>question by question</strong> (one request per question, richer feedback).
            {scope === "pending" && (
              <>
                {" "}
                After a batch completes, use <strong>Preview attempt list</strong> to reload the queue (pending scope) or
                refresh names—progress stays visible so you can see each attempt’s outcome.
              </>
            )}
          </p>
        </div>
        {body}
        {startButton}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-3 sm:p-4 space-y-3">
      {body}
      {startButton}
    </div>
  )
}
