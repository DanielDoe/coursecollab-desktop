"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { optionLetter } from "@/lib/question-bank-preview"
import type { SchemaMcqOption } from "@/lib/question-type-schema"

type Props = {
  options: SchemaMcqOption[]
  correctAnswer: string
  onChange: (next: { options: SchemaMcqOption[]; correctAnswer: string }) => void
}

export function SamplePracticeMcqOptionsEditor({ options, correctAnswer, onChange }: Props) {
  const correctLetter = (correctAnswer ?? "").trim().toUpperCase()

  const updateOptionText = (index: number, text: string) => {
    const next = options.map((opt, i) => (i === index ? { ...opt, text } : opt))
    onChange({ options: next, correctAnswer })
  }

  const setCorrect = (letter: string) => {
    onChange({ options, correctAnswer: letter.toUpperCase() })
  }

  const addOption = () => {
    if (options.length >= 6) return
    const letter = optionLetter(options.length)
    onChange({
      options: [...options, { id: letter, text: "" }],
      correctAnswer: correctLetter || "A",
    })
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return
    const next = options
      .filter((_, i) => i !== index)
      .map((opt, i) => ({ ...opt, id: optionLetter(i) }))
    const stillValid = next.some((o) => o.id.toUpperCase() === correctLetter)
    onChange({
      options: next,
      correctAnswer: stillValid ? correctLetter : (next[0]?.id.toUpperCase() ?? "A"),
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Answer options</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={addOption}
          disabled={options.length >= 6}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add option
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Each option has an ID (A–F) and text. Mark exactly one correct answer.
      </p>
      <ul className="space-y-2">
        {options.map((opt, index) => {
          const letter = opt.id.toUpperCase()
          const isCorrect = letter === correctLetter
          return (
            <li
              key={`${letter}-${index}`}
              className={cn(
                "flex items-start gap-2 rounded-lg border p-2.5",
                isCorrect
                  ? "border-emerald-300/80 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-950/20"
                  : "border-slate-200/80 dark:border-slate-700",
              )}
            >
              <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold border border-slate-200 dark:border-slate-600">
                {letter}
              </span>
              <Checkbox
                checked={isCorrect}
                onCheckedChange={() => setCorrect(letter)}
                className="mt-1.5 shrink-0"
                aria-label={`Correct: ${letter}`}
              />
              <Input
                value={opt.text}
                onChange={(e) => updateOptionText(index, e.target.value)}
                placeholder={`Option ${letter}…`}
                className="h-8 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm"
              />
              {options.length > 2 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-slate-400 hover:text-red-600"
                  onClick={() => removeOption(index)}
                  aria-label={`Remove option ${letter}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
