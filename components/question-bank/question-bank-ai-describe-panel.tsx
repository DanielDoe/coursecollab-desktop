"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { resolveQuestionBankTypeMeta, type CustomQuestionTypeDraft } from "@/lib/custom-question-types"
import type { DraftQuestionBankItem } from "@/lib/question-bank-ai-from-pdf-types"
import { QuestionBankDraftReviewPanel } from "@/components/question-bank/question-bank-draft-review-panel"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { QuestionBankFlowStepIndicator } from "@/components/question-bank/question-bank-flow-step-indicator"
import { Loader2, Sparkles } from "lucide-react"

const DESCRIBE_FLOW_STEPS = [
  { id: "describe", label: "Describe question" },
  { id: "preview", label: "Preview & create" },
] as const

type Step = "describe" | "preview"

export function QuestionBankAiDescribePanel({
  questionType,
  customTypes = [],
  userType,
  onSuccess,
}: {
  questionType: string
  customTypes?: CustomQuestionTypeDraft[]
  userType: "admin" | "instructor"
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const meta = resolveQuestionBankTypeMeta(questionType, customTypes)

  const [step, setStep] = useState<Step>("describe")
  const [description, setDescription] = useState("")
  const [correctAnswer, setCorrectAnswer] = useState("")
  const [topic, setTopic] = useState("")
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium")
  const [draft, setDraft] = useState<DraftQuestionBankItem | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStep("describe")
    setDescription("")
    setCorrectAnswer("")
    setTopic("")
    setDifficulty("medium")
    setDraft(null)
  }, [questionType])

  if (userType === "admin") {
    return (
      <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
        Describe-to-AI is available on the instructor question bank for the selected course.
      </p>
    )
  }

  const handleGenerate = async () => {
    if (!description.trim()) {
      toast({ title: "Describe the question", variant: "destructive" })
      return
    }
    if (!correctAnswer.trim()) {
      toast({ title: "Correct answer required", description: "Tell AI which answer should be correct.", variant: "destructive" })
      return
    }
    if (!topic.trim()) {
      toast({ title: "Topic required", variant: "destructive" })
      return
    }

    setGenerating(true)
    try {
      const res = await instructorApiFetch("/api/instructor/question-bank/generate-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({
          questionType,
          description,
          correctAnswer,
          topic,
          difficulty,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generation failed")
      setDraft(data.draft as DraftQuestionBankItem)
      setStep("preview")
      toast({ title: "Draft ready", description: "Review the student preview, then confirm." })
    } catch (e) {
      toast({
        title: "Generation failed",
        description: e instanceof Error ? e.message : "Could not generate question",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleConfirm = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/question-bank/bulk-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({ questions: [draft] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast({ title: "Question created", description: "Added to your question bank." })
      onSuccess()
    } catch (e) {
      toast({
        title: "Could not create question",
        description: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (step === "preview" && draft) {
    return (
      <QuestionBankDraftReviewPanel
        drafts={[draft]}
        selected={{ [draft.draftId]: true }}
        onSelectedChange={() => {}}
        onUpdateDraft={(id, partial) => {
          if (id === draft.draftId) setDraft({ ...draft, ...partial })
        }}
        onBack={() => setStep("describe")}
        onConfirm={handleConfirm}
        saving={saving}
        backLabel="Edit description"
        confirmLabel="Create question"
        flowSteps={[...DESCRIBE_FLOW_STEPS]}
        flowCurrentIndex={1}
      />
    )
  }

  return (
    <div className={cn(PORTAL_CARD, "overflow-hidden")}>
      <div className="border-b border-slate-100 px-4 py-4 dark:border-white/[0.06] sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)]">
              <Sparkles className="h-5 w-5 text-[var(--cc-accent-dark)]" />
            </div>
            <div>
              <h3 className={cn("text-base font-semibold", PORTAL_TEXT)}>Describe to AI</h3>
              <p className={cn("mt-0.5 text-sm", PORTAL_TEXT_MUTED)}>
                Tell us what you want and the correct answer — AI builds the full question for preview.
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="rounded-lg shrink-0">
            {meta?.label ?? questionType}
            </Badge>
          </div>
          <div className="mt-5 flex justify-center border-t border-slate-100 pt-5 dark:border-white/[0.06]">
            <QuestionBankFlowStepIndicator steps={[...DESCRIBE_FLOW_STEPS]} currentIndex={0} />
          </div>
        </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Topic</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. AC Power"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Describe the question</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="e.g. Ask students to find the total resistance of three resistors in series: 2Ω, 4Ω, and 6Ω. Include realistic distractors."
            className="text-sm resize-y"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Correct answer you want</Label>
          <Textarea
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            rows={2}
            placeholder={
              meta?.requiresOptions
                ? "e.g. 12 Ω (option B) — or describe the statement if True/False"
                : "e.g. 12 Ω — or the model answer / rubric summary for open-ended types"
            }
            className="text-sm resize-y"
          />
        </div>

        <Button type="button" className="h-10 w-full gap-2" onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating preview…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate & preview
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
