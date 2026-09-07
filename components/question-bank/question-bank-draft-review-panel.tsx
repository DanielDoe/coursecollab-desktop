"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { QuestionBankPreviewPanel } from "@/components/question-bank-preview-panel"
import type { DraftQuestionBankItem } from "@/lib/question-bank-ai-from-pdf-types"
import { draftToPreviewData } from "@/lib/question-bank-draft-normalize"
import { resolveQuestionBankTypeMeta } from "@/lib/custom-question-types"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { QuestionBankFlowStepIndicator, type QuestionBankFlowStep } from "@/components/question-bank/question-bank-flow-step-indicator"
import { Eye, Loader2, Pencil, CheckCircle2 } from "lucide-react"

export function QuestionBankDraftReviewPanel({
  drafts,
  selected,
  onSelectedChange,
  onUpdateDraft,
  onBack,
  onConfirm,
  saving,
  backLabel = "Back",
  confirmLabel,
  subtitle,
  flowSteps,
  flowCurrentIndex,
}: {
  drafts: DraftQuestionBankItem[]
  selected: Record<string, boolean>
  onSelectedChange: (next: Record<string, boolean>) => void
  onUpdateDraft: (draftId: string, partial: Partial<DraftQuestionBankItem>) => void
  onBack: () => void
  onConfirm: () => void
  saving: boolean
  backLabel?: string
  confirmLabel?: string
  subtitle?: string
  flowSteps?: QuestionBankFlowStep[]
  flowCurrentIndex?: number
}) {
  const multi = drafts.length > 1
  const [activeId, setActiveId] = useState(drafts[0]?.draftId ?? "")
  const [showEdit, setShowEdit] = useState(false)

  const activeDraft = drafts.find((d) => d.draftId === activeId) ?? drafts[0]
  const selectedCount = drafts.filter((d) => selected[d.draftId]).length

  const activeMeta = useMemo(
    () => (activeDraft ? resolveQuestionBankTypeMeta(activeDraft.question_type) : undefined),
    [activeDraft],
  )

  if (!activeDraft) return null

  const toggleAll = (value: boolean) => {
    onSelectedChange(Object.fromEntries(drafts.map((d) => [d.draftId, value])))
  }

  return (
    <div className={cn(PORTAL_CARD, "overflow-hidden")}>
      <div className="border-b border-slate-100 px-4 py-4 dark:border-white/[0.06] sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className={cn("text-base font-semibold flex items-center gap-2", PORTAL_TEXT)}>
              <Eye className="h-4 w-4 text-[var(--cc-accent-dark)]" />
              Preview before creating
            </h3>
            <p className={cn("mt-0.5 text-sm", PORTAL_TEXT_MUTED)}>
              {subtitle ?? "This is how students will see the question during a quiz. Edit anything, then confirm."}
            </p>
          </div>
          {multi ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-lg">{selectedCount} selected</Badge>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => toggleAll(true)}>
                Select all
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => toggleAll(false)}>
                Clear
              </Button>
            </div>
          ) : null}
        </div>

        {flowSteps && flowCurrentIndex != null ? (
          <div className="mt-5 flex justify-center border-t border-slate-100 pt-5 dark:border-white/[0.06]">
            <QuestionBankFlowStepIndicator steps={flowSteps} currentIndex={flowCurrentIndex} />
          </div>
        ) : null}

        {multi ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {drafts.map((d, idx) => {
              const isActive = d.draftId === activeDraft.draftId
              return (
                <button
                  key={d.draftId}
                  type="button"
                  onClick={() => setActiveId(d.draftId)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-[var(--cc-accent)]/40 bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400",
                  )}
                >
                  Q{idx + 1}
                  {selected[d.draftId] ? " ✓" : ""}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-b border-slate-100 p-4 dark:border-white/[0.06] sm:p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
              Student view
            </p>
            {multi ? (
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Checkbox
                  checked={selected[activeDraft.draftId] ?? false}
                  onCheckedChange={(c) =>
                    onSelectedChange({ ...selected, [activeDraft.draftId]: c === true })
                  }
                />
                Include in batch
              </label>
            ) : null}
          </div>
          <QuestionBankPreviewPanel question={draftToPreviewData(activeDraft)} />
        </div>

        <div className="p-4 sm:p-5">
          <button
            type="button"
            onClick={() => setShowEdit((v) => !v)}
            className={cn(
              "mb-3 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium",
              showEdit
                ? "border-[var(--cc-accent)]/30 bg-[var(--cc-accent-soft)]/50"
                : "border-slate-200 dark:border-white/10",
            )}
          >
            <span className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit question fields
            </span>
            <span className="text-xs text-slate-500">{showEdit ? "Hide" : "Show"}</span>
          </button>

          {showEdit ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Question text</Label>
                <Textarea
                  value={activeDraft.question_text}
                  onChange={(e) => onUpdateDraft(activeDraft.draftId, { question_text: e.target.value })}
                  rows={4}
                  className="text-sm font-mono resize-y"
                />
              </div>

              {activeMeta?.requiresOptions && activeDraft.options.length > 0 ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Options (one per line)</Label>
                  <Textarea
                    value={activeDraft.options.join("\n")}
                    onChange={(e) =>
                      onUpdateDraft(activeDraft.draftId, {
                        options: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                      })
                    }
                    rows={Math.min(6, activeDraft.options.length + 1)}
                    className="text-sm resize-y"
                  />
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label className="text-xs">Correct answer</Label>
                <Input
                  value={
                    Array.isArray(activeDraft.correct_answer)
                      ? activeDraft.correct_answer.join(", ")
                      : String(activeDraft.correct_answer)
                  }
                  onChange={(e) => onUpdateDraft(activeDraft.draftId, { correct_answer: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>

              {activeDraft.hint != null ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Hint</Label>
                  <Textarea
                    value={activeDraft.hint ?? ""}
                    onChange={(e) => onUpdateDraft(activeDraft.draftId, { hint: e.target.value || null })}
                    rows={2}
                    className="text-sm resize-y"
                  />
                </div>
              ) : null}

              {activeDraft.explanation != null ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Explanation</Label>
                  <Textarea
                    value={activeDraft.explanation ?? ""}
                    onChange={(e) => onUpdateDraft(activeDraft.draftId, { explanation: e.target.value || null })}
                    rows={3}
                    className="text-sm resize-y"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              Happy with the preview? Confirm below to add {multi ? `${selectedCount} question(s)` : "this question"} to your bank.
            </p>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-wrap justify-between gap-2 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/[0.06] dark:bg-slate-950/95 sm:px-5">
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={onBack} disabled={saving}>
          {backLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600"
          onClick={onConfirm}
          disabled={saving || (multi && selectedCount === 0)}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {confirmLabel ??
                (multi ? `Create ${selectedCount} question${selectedCount === 1 ? "" : "s"}` : "Create question")}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
