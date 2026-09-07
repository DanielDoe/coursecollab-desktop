"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Paperclip } from "lucide-react"
import {
  DEFAULT_SOLUTION_BONUS_PERCENT,
  type QuestionSolutionUploadConfig,
} from "@/lib/solution-upload"
import {
  questionBankSectionClass,
  questionBankSectionHeaderClass,
} from "@/lib/question-bank-ui"

export function SolutionUploadConfigPanel({
  config,
  onChange,
}: {
  config: QuestionSolutionUploadConfig | null | undefined
  onChange: (next: QuestionSolutionUploadConfig) => void
}) {
  const c = {
    enabled: false,
    bonus_percent: DEFAULT_SOLUTION_BONUS_PERCENT,
    ...config,
  }
  const patch = (p: Partial<QuestionSolutionUploadConfig>) => onChange({ ...c, ...p })

  return (
    <section className={questionBankSectionClass}>
      <div className={questionBankSectionHeaderClass}>
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Student solution upload</p>
        </div>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-700 dark:text-slate-300">Allow worked-solution uploads</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Students can attach PDF or images to support their answer. Uploads earn bonus points and go to
              instructor review.
            </p>
          </div>
          <Switch checked={!!c.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
        </div>

        {c.enabled ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Bonus percent</Label>
              <Input
                type="number"
                min={0}
                max={50}
                value={c.bonus_percent ?? DEFAULT_SOLUTION_BONUS_PERCENT}
                onChange={(e) =>
                  patch({
                    bonus_percent: Math.min(50, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="h-9"
              />
              <p className="text-[11px] text-slate-500">Extra % of question points when a file is attached</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Button label (optional)</Label>
              <Input
                value={c.label ?? ""}
                onChange={(e) => patch({ label: e.target.value || undefined })}
                placeholder="Upload worked solution"
                className="h-9"
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
