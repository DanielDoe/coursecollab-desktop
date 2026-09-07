"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Save, PenLine, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { QuestionMediaPanel } from "@/components/question-media-panel"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { parseQuestionMedia, type QuestionMedia } from "@/lib/question-media"
import {
  categoryLabel,
  defaultLectureWorkspaceConfig,
  normalizeLectureWorkspaceQuestion,
  type LectureWorkspaceCategory,
  type LectureWorkspaceConfig,
  type LectureWorkspaceQuestion,
} from "@/lib/lecture-workspace"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { PORTAL_CTA } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const fp = facultyEmbedChrome("lectures").p

type EditorProps = {
  lectureId: number
  lectureTitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function emptyWorkspaceQuestion(index: number): LectureWorkspaceQuestion {
  return {
    id: `new-${Date.now()}-${index}`,
    category: "nodal",
    title: `Problem ${index + 1}`,
    topic: "",
    question_text: "",
    step_by_step_solution: { format: "markdown_latex", content: [] },
    solution_unlocked: false,
    solution_upload_config: {
      title: "In-class workspace",
      submission_instructions: "Use the ink workspace for equations and sketches.",
      max_files: 0,
      require_solution_upload: false,
      grading_type: "manual",
    },
  }
}

function solutionLinesToText(content: string[]): string {
  return content.join("\n")
}

function textToSolutionLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

export function LectureWorkspaceQuestionEditor({
  question,
  onChange,
  onRemove,
}: {
  question: LectureWorkspaceQuestion
  onChange: (q: LectureWorkspaceQuestion) => void
  onRemove: () => void
}) {
  const solutionText = solutionLinesToText(question.step_by_step_solution.content)
  const questionMedia = parseQuestionMedia(question.question_media)

  const handleMediaChange = (next: QuestionMedia) => {
    const hasUrl = Boolean(next.media_enabled && next.media_url?.trim())
    onChange({
      ...question,
      question_media: hasUrl
        ? {
            ...next,
            media_placement: next.media_placement ?? "above_question",
            media_allow_zoom: next.media_allow_zoom !== false,
          }
        : undefined,
    })
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--cc-text)]">{question.title || "Untitled"}</p>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove question">
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Question ID</Label>
          <Input
            value={question.id}
            onChange={(e) => onChange({ ...question, id: e.target.value.trim() })}
            placeholder="e.g. 3-1"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select
            value={question.category}
            onValueChange={(v) => onChange({ ...question, category: v as LectureWorkspaceCategory })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nodal">{categoryLabel("nodal")}</SelectItem>
              <SelectItem value="mesh">{categoryLabel("mesh")}</SelectItem>
              <SelectItem value="thevenin_norton">{categoryLabel("thevenin_norton")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={question.title} onChange={(e) => onChange({ ...question, title: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Topic</Label>
          <Input
            value={question.topic ?? ""}
            onChange={(e) => onChange({ ...question, topic: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Problem statement</Label>
        <Textarea
          rows={3}
          value={question.question_text}
          onChange={(e) => onChange({ ...question, question_text: e.target.value })}
          placeholder="Supports \\(LaTeX\\) in problem text."
        />
      </div>

      <QuestionMediaPanel media={questionMedia} onChange={handleMediaChange} allowUpload />

      <div className="space-y-1.5">
        <Label>Step-by-step solution (KaTeX / markdown)</Label>
        <Textarea
          rows={10}
          value={solutionText}
          onChange={(e) =>
            onChange({
              ...question,
              step_by_step_solution: {
                format: "markdown_latex",
                content: textToSolutionLines(e.target.value),
              },
            })
          }
          placeholder={"### Step 1 — Label nodes\n$$V_x = 4\\,\\text{V}$$"}
        />
        <p className="text-xs text-muted-foreground">
          One line per block. Use ### headings, bullet lines, and $$…$$ for display math. Shown below the
          workspace in class when unlocked for students.
        </p>
      </div>

      {solutionText.trim() ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-[var(--cc-text)]">Solution visible to students</p>
            <p className="text-xs text-muted-foreground">
              Leave off until you are ready for students to see the worked solution.
            </p>
          </div>
          <Switch
            checked={question.solution_unlocked === true}
            onCheckedChange={(checked) => onChange({ ...question, solution_unlocked: checked })}
          />
        </div>
      ) : null}
    </div>
  )
}

export function LectureWorkspaceConfigFields({
  config,
  setConfig,
}: {
  config: LectureWorkspaceConfig
  setConfig: (next: LectureWorkspaceConfig) => void
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Panel title</Label>
          <Input
            value={config.title}
            onChange={(e) => setConfig({ ...config, title: e.target.value })}
            placeholder="In-Class Workspace"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Toolbar button label</Label>
          <Input
            value={config.button_label ?? "Workspace"}
            onChange={(e) => setConfig({ ...config, button_label: e.target.value })}
            placeholder="Workspace"
          />
          <p className="text-xs text-muted-foreground">
            Shown on the slide deck toolbar next to Open.
          </p>
        </div>
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
                questions: [...config.questions, emptyWorkspaceQuestion(config.questions.length)],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Add question
          </Button>
        </div>

        {config.questions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center border rounded-xl border-dashed">
            No workspace questions yet. Add circuit problems with figures and step-by-step solutions.
          </p>
        ) : (
          config.questions.map((q, idx) => (
            <LectureWorkspaceQuestionEditor
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

export function useLectureWorkspaceConfig(lectureId: number, active: boolean) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<LectureWorkspaceConfig>(defaultLectureWorkspaceConfig())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/lectures/${lectureId}/workspace`, {
        headers: buildInstructorApiHeaders(),
        cache: "no-store",
      })
      const data = (await res.json()) as { config?: LectureWorkspaceConfig; error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to load")
      const next = data.config ?? defaultLectureWorkspaceConfig()
      setConfig(next)
      return next
    } catch (err) {
      toast({
        title: "Could not load workspace",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
      setConfig(defaultLectureWorkspaceConfig())
      return defaultLectureWorkspaceConfig()
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
        enabled: true,
        questions: config.questions
          .map((q, i) => normalizeLectureWorkspaceQuestion(q, i))
          .filter((q): q is LectureWorkspaceQuestion => q != null),
      }
      const res = await instructorApiFetch(`/api/instructor/lectures/${lectureId}/workspace`, {
        method: "PATCH",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ config: normalized }),
      })
      const data = (await res.json()) as { error?: string; config?: LectureWorkspaceConfig }
      if (!res.ok) throw new Error(data.error || "Save failed")
      const saved = data.config ?? normalized
      setConfig(saved)
      toast({
        title: "Workspace saved",
        description: "Students will see updates on the lecture slide deck.",
      })
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

export function LectureWorkspaceEditor({ lectureId, lectureTitle, open, onOpenChange, onSaved }: EditorProps) {
  const { config, setConfig, loading, saving, save } = useLectureWorkspaceConfig(lectureId, open)

  const handleSave = async () => {
    const saved = await save()
    if (saved) onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <DialogTitle className="flex items-center gap-2">
            <PenLine className={cn("h-5 w-5", fp.iconText)} />
            Workspace — slide configuration
          </DialogTitle>
          <DialogDescription>
            {lectureTitle
              ? `Configure in-class circuit problems for “${lectureTitle}”. Students open the workspace from the slide toolbar and work in the ink canvas with step-by-step solutions below each problem.`
              : "Configure circuit workspace questions opened from the Workspace button on the slide deck."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-10rem)] px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className={cn("h-8 w-8 animate-spin", facultyModuleSpinnerClass("lectures"))} />
            </div>
          ) : (
            <div className="pb-4">
              <LectureWorkspaceConfigFields config={config} setConfig={setConfig} />
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-[var(--border)]">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button className={PORTAL_CTA} onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save workspace
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
