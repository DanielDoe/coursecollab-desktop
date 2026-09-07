"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { optionLetter } from "@/lib/question-bank-preview"
import {
  defaultEditableSubPart,
  type EditableSubPart,
  type EditableSubPartOption,
} from "@/lib/multi-part-question"
import {
  DEFAULT_UPLOAD_POINTS_MULTIPLIER,
  formatMultiPartGradingSummary,
} from "@/lib/multi-part-grading-policy"

export function MultiPartSubquestionsEditor({
  parts,
  onChange,
  useStandardGrading = true,
  uploadPointsMultiplier = DEFAULT_UPLOAD_POINTS_MULTIPLIER,
}: {
  parts: EditableSubPart[]
  onChange: (parts: EditableSubPart[]) => void
  /** When true, MCQ pool = 1 pt per part, solution upload = multiplier × parts. */
  useStandardGrading?: boolean
  uploadPointsMultiplier?: number
}) {
  const updatePart = (index: number, patch: Partial<EditableSubPart>) => {
    const next = [...parts]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  const updateOption = (partIndex: number, optIndex: number, patch: Partial<EditableSubPartOption>) => {
    const next = [...parts]
    const opts = [...next[partIndex].options]
    opts[optIndex] = { ...opts[optIndex], ...patch }
    next[partIndex] = { ...next[partIndex], options: opts }
    onChange(next)
  }

  const toggleCorrect = (partIndex: number, optIndex: number) => {
    const part = parts[partIndex]
    const opts = part.options.map((o, i) => {
      if (part.type === "mcq") return { ...o, isCorrect: i === optIndex }
      if (i === optIndex) return { ...o, isCorrect: !o.isCorrect }
      return o
    })
    updatePart(partIndex, { options: opts })
  }

  const addOption = (partIndex: number) => {
    const part = parts[partIndex]
    if (part.options.length >= 6) return
    const letter = optionLetter(part.options.length)
    updatePart(partIndex, {
      options: [...part.options, { letter, text: "", isCorrect: false }],
    })
  }

  const removeOption = (partIndex: number, optIndex: number) => {
    const part = parts[partIndex]
    if (part.options.length <= 2) return
    const opts = part.options
      .filter((_, i) => i !== optIndex)
      .map((o, i) => ({ ...o, letter: optionLetter(i) }))
    const correctLetters = new Set(opts.filter((o) => o.isCorrect).map((o) => o.letter))
    if (part.type === "mcq" && correctLetters.size === 0 && opts.length > 0) {
      opts[0].isCorrect = true
    }
    updatePart(partIndex, { options: opts })
  }

  const addPart = () => {
    const ids = parts.map((p) => p.id)
    let nextId = "a"
    for (let c = 97; c <= 122; c++) {
      const letter = String.fromCharCode(c)
      if (!ids.includes(letter)) {
        nextId = letter
        break
      }
    }
    onChange([...parts, defaultEditableSubPart(nextId)])
  }

  const removePart = (index: number) => {
    if (parts.length <= 1) return
    onChange(parts.filter((_, i) => i !== index))
  }

  const onTypeChange = (partIndex: number, type: "mcq" | "select_all") => {
    const part = parts[partIndex]
    let opts = part.options
    if (type === "mcq") {
      let found = false
      opts = opts.map((o) => {
        if (o.isCorrect && !found) {
          found = true
          return o
        }
        return { ...o, isCorrect: false }
      })
      if (!opts.some((o) => o.isCorrect) && opts.length > 0) {
        opts = opts.map((o, i) => ({ ...o, isCorrect: i === 0 }))
      }
    }
    updatePart(partIndex, { type, options: opts })
  }

  return (
    <div className="space-y-4">
      {useStandardGrading ? (
        <div className="rounded-lg border border-indigo-200/80 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/20 px-4 py-3 text-sm space-y-1">
          <p className="font-medium text-slate-800 dark:text-slate-100">Grading structure</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
            {formatMultiPartGradingSummary(parts.length, uploadPointsMultiplier)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            MCQ: 1 pt per correct part · Upload: {uploadPointsMultiplier}× part count (change multiplier in
            Grading Policies settings)
          </p>
        </div>
      ) : null}
      {parts.map((part, partIndex) => (
        <div
          key={`${part.id}-${partIndex}`}
          className="rounded-xl border border-slate-200/80 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-900/20"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200/70 dark:border-slate-600 bg-slate-50/90 dark:bg-slate-800/40">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 text-sm font-bold px-2">
                Part {part.id}
              </span>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-500 sr-only">Part id</Label>
                <Input
                  value={part.id}
                  onChange={(e) => updatePart(partIndex, { id: e.target.value.slice(0, 8) })}
                  className="h-8 w-14 text-xs font-mono"
                  aria-label="Part label"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={part.type} onValueChange={(v) => onTypeChange(partIndex, v as "mcq" | "select_all")}>
                <SelectTrigger className="h-8 w-[10.5rem] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple choice</SelectItem>
                  <SelectItem value="select_all">Select all</SelectItem>
                </SelectContent>
              </Select>
              {!useStandardGrading ? (
                <div className="flex items-center gap-1.5">
                  <Label htmlFor={`pts-${partIndex}`} className="text-xs text-slate-500 whitespace-nowrap">
                    Pts
                  </Label>
                  <Input
                    id={`pts-${partIndex}`}
                    type="number"
                    min={1}
                    max={99}
                    value={part.points}
                    onChange={(e) => updatePart(partIndex, { points: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-8 w-14 text-xs"
                  />
                </div>
              ) : null}
              {parts.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:text-red-600"
                  onClick={() => removePart(partIndex)}
                  aria-label={`Remove part ${part.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Prompt</Label>
              <Textarea
                value={part.prompt}
                onChange={(e) => updatePart(partIndex, { prompt: e.target.value })}
                rows={2}
                className="text-sm resize-y min-h-[3rem]"
                placeholder="Question for this part…"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Answer choices</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => addOption(partIndex)}
                  disabled={part.options.length >= 6}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add choice
                </Button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {part.type === "select_all"
                  ? "Check every correct answer"
                  : "Check exactly one correct answer"}
              </p>
              <ul className="space-y-2">
                {part.options.map((opt, optIndex) => (
                  <li
                    key={opt.letter}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-2.5",
                      opt.isCorrect
                        ? "border-emerald-300/80 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-950/20"
                        : "border-slate-200/80 dark:border-slate-700",
                    )}
                  >
                    <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold border border-slate-200 dark:border-slate-600">
                      {opt.letter}
                    </span>
                    <Checkbox
                      checked={opt.isCorrect}
                      onCheckedChange={() => toggleCorrect(partIndex, optIndex)}
                      className="mt-1.5 shrink-0"
                      aria-label={`Correct: ${opt.letter}`}
                    />
                    <Input
                      value={opt.text}
                      onChange={(e) => updateOption(partIndex, optIndex, { text: e.target.value })}
                      placeholder={`Choice ${opt.letter}…`}
                      className="h-8 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm"
                    />
                    {part.options.length > 2 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-slate-400 hover:text-red-600"
                        onClick={() => removeOption(partIndex, optIndex)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Explanation <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <Textarea
                value={part.explanation}
                onChange={(e) => updatePart(partIndex, { explanation: e.target.value })}
                rows={2}
                className="text-sm resize-none"
                placeholder="Shown after submission or in review…"
              />
            </div>

            {!useStandardGrading ? (
            <div className="rounded-lg border border-slate-200/80 dark:border-slate-700 p-3 space-y-3 bg-slate-50/50 dark:bg-slate-900/20">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Student solution upload
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Lets students attach worked solutions for this part (+bonus points).
                  </p>
                </div>
                <Switch
                  checked={part.allow_solution_upload}
                  onCheckedChange={(v) => updatePart(partIndex, { allow_solution_upload: v })}
                />
              </div>
              {part.allow_solution_upload ? (
                <div className="space-y-1.5 max-w-[8rem]">
                  <Label className="text-xs">Bonus %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={part.solution_bonus_percent}
                    onChange={(e) =>
                      updatePart(partIndex, {
                        solution_bonus_percent: Math.min(
                          50,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              ) : null}
            </div>
            ) : null}
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="h-9" onClick={addPart}>
        <Plus className="h-4 w-4 mr-2" />
        Add sub-question
      </Button>
    </div>
  )
}
