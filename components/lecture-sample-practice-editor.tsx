"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronDown, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import {
  defaultLectureSamplePracticeConfig,
  emptySamplePracticeQuestion,
  normalizeSamplePracticeQuestion,
  type LectureSamplePracticeConfig,
  type LectureSamplePracticeQuestion,
} from "@/lib/lecture-sample-practice"
import { normalizeStructuredOptions } from "@/lib/question-type-schema"
import { SamplePracticeMcqOptionsEditor } from "@/components/sample-practice-mcq-options-editor"

type EditorProps = {
  lectureId: number
  lectureTitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export { emptySamplePracticeQuestion }

export function LectureSamplePracticeQuestionEditor({
  question,
  onChange,
  onRemove,
}: {
  question: LectureSamplePracticeQuestion
  onChange: (q: LectureSamplePracticeQuestion) => void
  onRemove: () => void
}) {
  const structuredOptions = normalizeStructuredOptions(question.options)
  const correctAnswer = (question.correct_answer ?? "A").trim().toUpperCase()

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{question.title || "Untitled"}</p>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove question">
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={question.title} onChange={(e) => onChange({ ...question, title: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Topic</Label>
          <Input value={question.topic ?? ""} onChange={(e) => onChange({ ...question, topic: e.target.value })} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Question text</Label>
        <Textarea
          rows={4}
          value={question.question_text}
          onChange={(e) => onChange({ ...question, question_text: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Standard MCQ — question text, structured options (A–F), and letter correct answer.
        </p>
      </div>

      <SamplePracticeMcqOptionsEditor
        options={structuredOptions}
        correctAnswer={correctAnswer}
        onChange={({ options, correctAnswer: nextCorrect }) => {
          onChange({ ...question, options, correct_answer: nextCorrect })
        }}
      />

      <div className="space-y-1.5">
        <Label>Explanation (shown after submit)</Label>
        <Textarea
          rows={8}
          value={question.explanation ?? ""}
          onChange={(e) => onChange({ ...question, explanation: e.target.value })}
          placeholder="Use markdown headings (### Step 1), bullet lists, and formulas."
        />
        <p className="text-xs text-muted-foreground">
          Supports markdown formatting. Students see this step-by-step solution after submitting.
        </p>
      </div>
    </div>
  )
}

export function LectureSamplePracticeConfigFields({
  config,
  setConfig,
  mobileAccordion = false,
  expandedQuestionId = null,
  onExpandedQuestionIdChange,
}: {
  config: LectureSamplePracticeConfig
  setConfig: (next: LectureSamplePracticeConfig) => void
  mobileAccordion?: boolean
  expandedQuestionId?: string | null
  onExpandedQuestionIdChange?: (id: string | null) => void
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
        <div>
          <p className="text-sm font-medium">Enable sample practice button</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shows a button in the lecture header for students to open in-class practice.
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Button label</Label>
        <Input
          value={config.button_label ?? "Sample Practice"}
          onChange={(e) => setConfig({ ...config, button_label: e.target.value })}
          placeholder="Sample Practice"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base">Questions ({config.questions.length})</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setConfig({
                ...config,
                questions: [...config.questions, emptySamplePracticeQuestion(config.questions.length)],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Add question
          </Button>
        </div>

        {config.questions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border rounded-xl border-dashed">
            No questions yet. Add practical examples for students to try in class.
          </p>
        ) : mobileAccordion ? (
          config.questions.map((q, idx) => {
            const open = expandedQuestionId === q.id
            return (
              <div
                key={q.id}
                className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--cc-surface)]"
              >
                <button
                  type="button"
                  onClick={() => onExpandedQuestionIdChange?.(open ? null : q.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--cc-text)]">
                      {q.title || `Question ${idx + 1}`}
                    </span>
                    <span className="block truncate text-xs text-[var(--cc-text-muted)]">
                      {q.topic?.trim() || "Tap to edit fields"}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-[var(--cc-text-muted)] transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </button>
                {open ? (
                  <div className="border-t border-[var(--border)] px-3 pb-3">
                    <LectureSamplePracticeQuestionEditor
                      question={q}
                      onChange={(next) => {
                        const questions = [...config.questions]
                        questions[idx] = next
                        setConfig({ ...config, questions })
                      }}
                      onRemove={() => {
                        onExpandedQuestionIdChange?.(null)
                        setConfig({
                          ...config,
                          questions: config.questions.filter((_, i) => i !== idx),
                        })
                      }}
                    />
                  </div>
                ) : null}
              </div>
            )
          })
        ) : (
          config.questions.map((q, idx) => (
            <LectureSamplePracticeQuestionEditor
              key={q.id}
              question={q}
              onChange={(next) => {
                const questions = [...config.questions]
                questions[idx] = next
                setConfig({ ...config, questions })
              }}
              onRemove={() => {
                setConfig({
                  ...config,
                  questions: config.questions.filter((_, i) => i !== idx),
                })
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function useLectureSamplePracticeConfig(lectureId: number, active: boolean) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<LectureSamplePracticeConfig>(defaultLectureSamplePracticeConfig())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/lectures/${lectureId}/sample-practice`, {
        headers: buildInstructorApiHeaders(),
        cache: "no-store",
      })
      const data = (await res.json()) as { config?: LectureSamplePracticeConfig; error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to load")
      const next = data.config ?? defaultLectureSamplePracticeConfig()
      setConfig(next)
      return next
    } catch (err) {
      toast({
        title: "Could not load sample practice",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
      setConfig(defaultLectureSamplePracticeConfig())
      return defaultLectureSamplePracticeConfig()
    } finally {
      setLoading(false)
    }
  }, [lectureId, toast])

  useEffect(() => {
    if (!active) return
    void load()
  }, [active, load])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const normalized = {
        ...config,
        questions: config.questions
          .map((q, i) => normalizeSamplePracticeQuestion(q, i))
          .filter((q): q is LectureSamplePracticeQuestion => q != null),
      }
      const res = await instructorApiFetch(`/api/instructor/lectures/${lectureId}/sample-practice`, {
        method: "PATCH",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ config: normalized }),
      })
      const data = (await res.json()) as { error?: string; config?: LectureSamplePracticeConfig }
      if (!res.ok) throw new Error(data.error || "Save failed")
      const saved = data.config ?? normalized
      setConfig(saved)
      toast({ title: "Sample practice saved", description: "Students will see updates on the lecture slides." })
      return saved
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
      return null
    } finally {
      setSaving(false)
    }
  }, [config, lectureId, toast])

  return { config, setConfig, loading, saving, load, save }
}

export function LectureSamplePracticeEditor({ lectureId, lectureTitle, open, onOpenChange }: EditorProps) {
  const isMobile = useIsMobile()
  const { config, setConfig, loading, saving, save } = useLectureSamplePracticeConfig(lectureId, open)
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setExpandedQuestionId(null)
  }, [open])

  useEffect(() => {
    if (config.questions?.length && expandedQuestionId == null) {
      setExpandedQuestionId(config.questions[0]?.id ?? null)
    }
  }, [config.questions, expandedQuestionId])

  const handleSave = async () => {
    const saved = await save()
    if (saved) onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex h-full max-h-[100dvh] w-full flex-col gap-0 overflow-hidden p-0",
          isMobile ? "max-w-full sm:max-w-full" : "sm:!max-w-none sm:w-[40vw]",
        )}
      >
        <SheetHeader className="shrink-0 space-y-1 border-b px-4 py-4 pr-12 text-left sm:px-6">
          <SheetTitle className="flex items-center gap-2 text-left">
            <Sparkles className="h-5 w-5 shrink-0 text-indigo-600" />
            Sample practice — slide configuration
          </SheetTitle>
          <SheetDescription className="text-left">
            {lectureTitle
              ? `Configure in-class practice for “${lectureTitle}”. Students reveal answers one question at a time after submitting.`
              : "Configure in-class practice questions shown on the lecture slide deck."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] px-4 py-4 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : (
            <LectureSamplePracticeConfigFields
              config={config}
              setConfig={setConfig}
              mobileAccordion
              expandedQuestionId={expandedQuestionId}
              onExpandedQuestionIdChange={setExpandedQuestionId}
            />
          )}
        </div>

        <SheetFooter className="shrink-0 flex-row justify-end gap-2 border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || loading} className="w-full sm:w-auto">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save sample practice
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
