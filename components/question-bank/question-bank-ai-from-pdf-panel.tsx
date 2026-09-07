"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import {
  PDF_GENERATION_SUPPORTED_TYPES,
  defaultPdfGenerationRequest,
  validatePdfGenerationRequest,
  type DraftQuestionBankItem,
  type QuestionBankPdfGenerationRequest,
} from "@/lib/question-bank-ai-from-pdf-types"
import { getQuestionBankTypeMeta, type QuestionBankTypeId } from "@/lib/question-bank-type-config"
import { QuestionBankDraftReviewPanel } from "@/components/question-bank/question-bank-draft-review-panel"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { QuestionBankFlowStepIndicator } from "@/components/question-bank/question-bank-flow-step-indicator"
import {
  FileText,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react"

type Step = "configure" | "preview"

const PDF_FLOW_STEPS = [
  { id: "upload", label: "Upload slides" },
  { id: "settings", label: "Generation settings" },
  { id: "review", label: "Review & create" },
] as const

const DIFFICULTIES = [
  { id: "easy" as const, label: "Easy" },
  { id: "medium" as const, label: "Medium" },
  { id: "hard" as const, label: "Hard" },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}


export function QuestionBankAiFromPdfPanel({
  questionType,
  userType,
  onSuccess,
}: {
  questionType: QuestionBankTypeId
  userType: "admin" | "instructor"
  onSuccess: (createdCount: number) => void
}) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const meta = getQuestionBankTypeMeta(questionType)
  const supported = PDF_GENERATION_SUPPORTED_TYPES.includes(questionType)

  const [step, setStep] = useState<Step>("configure")
  const [spec, setSpec] = useState<QuestionBankPdfGenerationRequest>(() =>
    defaultPdfGenerationRequest(questionType),
  )
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [drafts, setDrafts] = useState<DraftQuestionBankItem[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [genMeta, setGenMeta] = useState<{ modelUsed?: string; pageCount?: number } | null>(null)

  useEffect(() => {
    setStep("configure")
    setPdfFile(null)
    setDrafts([])
    setSelected({})
    setGenMeta(null)
    setSpec(defaultPdfGenerationRequest(questionType))
  }, [questionType])

  const patch = (partial: Partial<QuestionBankPdfGenerationRequest>) => {
    setSpec((prev) => ({ ...prev, ...partial, questionType }))
  }

  const pickPdf = useCallback(
    (file: File | undefined) => {
      if (!file) return
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        toast({ title: "PDF only", description: "Please choose a slide deck PDF.", variant: "destructive" })
        return
      }
      setPdfFile(file)
    },
    [toast],
  )

  const clearPdf = () => {
    setPdfFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const updateDraft = (draftId: string, partial: Partial<DraftQuestionBankItem>) => {
    setDrafts((prev) => prev.map((d) => (d.draftId === draftId ? { ...d, ...partial } : d)))
  }

  const handleGenerate = async () => {
    const req = { ...spec, questionType }
    const err = validatePdfGenerationRequest(req)
    if (err) {
      toast({ title: "Check form", description: err, variant: "destructive" })
      return
    }
    if (!pdfFile) {
      toast({ title: "PDF required", description: "Upload a slide deck PDF first.", variant: "destructive" })
      return
    }

    setGenerating(true)
    try {
      const fd = new FormData()
      fd.append("file", pdfFile)
      fd.append("spec", JSON.stringify(req))
      const res = await instructorApiFetch("/api/instructor/question-bank/generate-from-pdf", {
        method: "POST",
        headers: getInstructorScopeHeaders() as Record<string, string>,
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generation failed")

      const items = (data.questions ?? []) as DraftQuestionBankItem[]
      setDrafts(items)
      setSelected(Object.fromEntries(items.map((q) => [q.draftId, true])))
      setGenMeta(data.meta ?? null)
      setStep("preview")
      toast({
        title: "Draft questions ready",
        description: `${items.length} question(s) — review the student preview, then confirm.`,
      })
    } catch (e) {
      toast({
        title: "Generation failed",
        description: e instanceof Error ? e.message : "Could not generate from PDF",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    const toSave = drafts.filter((d) => selected[d.draftId])
    if (toSave.length === 0) {
      toast({ title: "Nothing selected", description: "Select at least one question.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/question-bank/bulk-create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({ questions: toSave }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")

      toast({
        title: "Saved to question bank",
        description: `${data.createdCount} question(s) added.`,
      })
      onSuccess(Number(data.createdCount))
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Could not save questions",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (userType === "admin") {
    return (
      <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
        PDF slide import is available on the instructor question bank for the selected course.
      </p>
    )
  }

  if (!supported) {
    return (
      <div className={cn(PORTAL_CARD, "p-5 sm:p-6")}>
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
          PDF generation is not available for <strong className={PORTAL_TEXT}>{meta?.label ?? questionType}</strong> yet.
          Switch to <strong>Build manually</strong> or <strong>Describe to AI</strong>.
        </p>
      </div>
    )
  }

  if (step === "preview") {
    return (
      <QuestionBankDraftReviewPanel
        drafts={drafts}
        selected={selected}
        onSelectedChange={setSelected}
        onUpdateDraft={updateDraft}
        onBack={() => setStep("configure")}
        onConfirm={handleSave}
        saving={saving}
        backLabel="Back to PDF settings"
        flowSteps={[...PDF_FLOW_STEPS]}
        flowCurrentIndex={2}
        subtitle={
          genMeta
            ? `${drafts.length} draft(s) from ${genMeta.pageCount ?? "?"} PDF pages — review each as students will see it, then confirm.`
            : undefined
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className={cn(PORTAL_CARD, "overflow-hidden")}>
        <div className="border-b border-slate-100 px-4 py-4 dark:border-white/[0.06] sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)]">
                <Sparkles className="h-5 w-5 text-[var(--cc-accent-dark)]" />
              </div>
              <div>
                <h3 className={cn("text-base font-semibold", PORTAL_TEXT)}>Import from PDF slides</h3>
                <p className={cn("mt-0.5 text-sm", PORTAL_TEXT_MUTED)}>
                  AI reads your deck and drafts {meta?.label ?? questionType} questions for review.
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="rounded-lg shrink-0">
              {meta?.label ?? questionType}
            </Badge>
          </div>
          <div className="mt-5 flex justify-center border-t border-slate-100 pt-5 dark:border-white/[0.06]">
            <QuestionBankFlowStepIndicator
              steps={[...PDF_FLOW_STEPS]}
              currentIndex={step === "preview" ? 2 : pdfFile ? 1 : 0}
            />
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="border-b border-slate-100 p-4 dark:border-white/[0.06] sm:p-5 lg:border-b-0 lg:border-r">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => pickPdf(e.target.files?.[0])}
            />

            {!pdfFile ? (
              <div
                className={cn(
                  "relative flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors",
                  dragActive
                    ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]"
                    : "border-slate-200/90 bg-slate-50/50 dark:border-white/10 dark:bg-white/[0.02]",
                  generating && "pointer-events-none opacity-60",
                )}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragActive(false)
                  pickPdf(e.dataTransfer.files?.[0])
                }}
              >
                {generating ? (
                  <>
                    <Loader2 className="mb-3 h-10 w-10 animate-spin text-[var(--cc-accent-dark)]" />
                    <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Reading slides & generating…</p>
                    <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>This may take a minute for long decks.</p>
                  </>
                ) : (
                  <>
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-slate-900">
                      <Upload className={cn("h-7 w-7", PORTAL_TEXT_MUTED)} />
                    </div>
                    <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Drop your lecture PDF here</p>
                    <p className={cn("mt-1 max-w-xs text-xs", PORTAL_TEXT_MUTED)}>
                      Slide decks, handouts, or chapter PDFs — AI uses diagrams and text on each page.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4 h-9 rounded-lg"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse files
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                    <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{pdfFile.name}</p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{formatFileSize(pdfFile.size)} · PDF</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={clearPdf}
                    disabled={generating}
                    aria-label="Remove PDF"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 w-full text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={generating}
                >
                  Replace PDF
                </Button>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5 space-y-5">
            <div className="space-y-2">
              <Label className={cn("text-xs font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Topic</Label>
              <Input
                value={spec.topic}
                onChange={(e) => patch({ topic: e.target.value })}
                placeholder="e.g. AC Power, Kirchhoff's Laws"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label className={cn("text-xs font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Difficulty</Label>
              <div className="flex rounded-lg border border-slate-200/80 p-1 dark:border-white/[0.08]">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => patch({ difficulty: d.id })}
                    className={cn(
                      "flex-1 rounded-md py-2 text-xs font-medium transition-colors",
                      spec.difficulty === d.id
                        ? "bg-[var(--cc-accent-dark)] text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-white/[0.04]",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className={cn("text-xs font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                Question count
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => patch({ questionCount: Math.max(1, spec.questionCount - 1) })}
                  disabled={spec.questionCount <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={15}
                  value={spec.questionCount}
                  onChange={(e) => patch({ questionCount: Math.min(15, Math.max(1, Number(e.target.value) || 1)) })}
                  className="h-9 text-center font-medium tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => patch({ questionCount: Math.min(15, spec.questionCount + 1) })}
                  disabled={spec.questionCount >= 15}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>1–15 questions per generation</p>
            </div>

            <div className="space-y-2">
              <Label className={cn("text-xs font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                Focus & constraints
              </Label>
              <Textarea
                value={spec.additionalInstructions}
                onChange={(e) => patch({ additionalInstructions: e.target.value })}
                placeholder="e.g. Pages 3–8 only · emphasize diagrams · no duplicate stems"
                rows={3}
                className="text-sm resize-y min-h-[88px]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => patch({ includeHint: !spec.includeHint })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  spec.includeHint
                    ? "border-[var(--cc-accent)]/40 bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                    : "border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400",
                )}
              >
                {spec.includeHint ? "✓ " : ""}Hints
              </button>
              <button
                type="button"
                onClick={() => patch({ includeExplanation: !spec.includeExplanation })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  spec.includeExplanation
                    ? "border-[var(--cc-accent)]/40 bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                    : "border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400",
                )}
              >
                {spec.includeExplanation ? "✓ " : ""}Explanations
              </button>
            </div>

            <Button
              type="button"
              className="h-10 w-full gap-2 rounded-lg"
              onClick={handleGenerate}
              disabled={generating || !pdfFile}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating drafts…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate & preview {spec.questionCount} draft{spec.questionCount === 1 ? "" : "s"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
