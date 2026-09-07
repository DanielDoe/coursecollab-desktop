"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Loader2,
  Lock,
  Sparkles,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { CoraImportableItem } from "@/lib/cora/question-import-types"
import type {
  ImportContainerOption,
  ImportSourceKey,
  ImportSourceOption,
} from "@/lib/cora/question-import-types"
import { IMPORT_SOURCE_META } from "@/lib/cora/question-import-types"
import type { CoraProblemContext } from "@/lib/cora/types"

const SOURCE_ICON: Record<ImportSourceKey, typeof BookOpen> = {
  quizzes: ClipboardList,
  homework: ClipboardList,
  mid_semester: GraduationCap,
  final_exam: GraduationCap,
  practice_hub: Sparkles,
  lecture_workspace: BookOpen,
  classroom_points: GraduationCap,
}

type Step = "source" | "container" | "question"

type Props = {
  open: boolean
  onClose: () => void
  studentId?: string
  onImport: (problem: CoraProblemContext, item: CoraImportableItem) => void
}

export function CoraQuestionImportDialog({ open, onClose, studentId, onImport }: Props) {
  const [step, setStep] = useState<Step>("source")
  const [sourceKey, setSourceKey] = useState<ImportSourceKey | null>(null)
  const [container, setContainer] = useState<ImportContainerOption | null>(null)

  const [sources, setSources] = useState<ImportSourceOption[]>([])
  const [containers, setContainers] = useState<ImportContainerOption[]>([])
  const [questions, setQuestions] = useState<CoraImportableItem[]>([])

  const [loading, setLoading] = useState(false)
  const [resolvingRef, setResolvingRef] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const headers = studentId ? { "x-student-id": studentId } : undefined

  const reset = useCallback(() => {
    setStep("source")
    setSourceKey(null)
    setContainer(null)
    setContainers([])
    setQuestions([])
    setError(null)
  }, [])

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    setLoading(true)
    setError(null)
    fetch("/api/cora/question-import?level=sources", { headers })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load sources")
        setSources(data.sources ?? [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }, [open, reset, studentId])

  const pickSource = async (key: ImportSourceKey) => {
    setSourceKey(key)
    setStep("container")
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cora/question-import?level=containers&sourceKey=${key}`, { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setContainers(data.containers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  const pickContainer = async (c: ImportContainerOption) => {
    if (!sourceKey) return
    if (c.locked) {
      setError(
        c.lockReason ||
          "Attempt this assessment first. Cora can help with its questions only after you submit.",
      )
      return
    }
    setContainer(c)
    setStep("question")
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/cora/question-import?level=questions&sourceKey=${sourceKey}&containerId=${encodeURIComponent(c.id)}`,
        { headers },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.lockReason || "Failed to load questions")

      const items: CoraImportableItem[] = data.items ?? []
      setQuestions(items)

      if (sourceKey === "classroom_points" && items.length === 1) {
        await pickQuestion(items[0])
        return
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions")
    } finally {
      setLoading(false)
    }
  }

  const pickQuestion = async (item: CoraImportableItem) => {
    setResolvingRef(item.ref)
    setError(null)
    try {
      const res = await fetch("/api/cora/question-import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          source: item.source,
          questionId: item.questionId,
          quizId: item.quizId,
          bankQuestionId: item.bankQuestionId,
          lectureId: item.lectureId,
          classroomSubmissionId: item.classroomSubmissionId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Import failed")
      onImport(data.problem as CoraProblemContext, item)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed")
    } finally {
      setResolvingRef(null)
    }
  }

  const goBack = () => {
    setError(null)
    if (step === "question") {
      setStep("container")
      setContainer(null)
      setQuestions([])
    } else if (step === "container") {
      setStep("source")
      setSourceKey(null)
      setContainers([])
    }
  }

  const breadcrumb =
    step === "source"
      ? "Choose a source"
      : step === "container"
        ? IMPORT_SOURCE_META[sourceKey!]?.label ?? "Browse"
        : container?.label ?? "Select question"

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg gap-0 overflow-hidden rounded-3xl p-0">
        <DialogHeader className="border-b border-neutral-200 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            {step !== "source" ? (
              <button
                type="button"
                onClick={goBack}
                className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base">Import from your course</DialogTitle>
              <DialogDescription className="truncate text-sm">{breadcrumb}</DialogDescription>
              {step === "container" &&
              ["quizzes", "homework", "mid_semester", "final_exam"].includes(sourceKey ?? "") ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Pending assessments are locked until you attempt and submit them.
                </p>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[min(60vh,420px)] px-3 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : step === "source" ? (
            <ul className="space-y-1">
              {sources.map((src) => {
                const Icon = SOURCE_ICON[src.key]
                return (
                  <li key={src.key}>
                    <button
                      type="button"
                      onClick={() => void pickSource(src.key)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-white/[0.04]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-white/[0.06]">
                        <Icon className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {src.label}
                        </span>
                        <span className="block text-xs text-neutral-500">{src.description}</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs text-neutral-400">
                        {src.count != null ? src.count : ""}
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : step === "container" ? (
            containers.length === 0 ? (
              <p className="py-12 text-center text-sm text-neutral-500">Nothing available in this source yet.</p>
            ) : (
              <ul className="space-y-1">
                {containers.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => void pickContainer(c)}
                      aria-disabled={Boolean(c.locked)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors",
                        c.locked
                          ? "cursor-not-allowed bg-amber-50/70 dark:bg-amber-500/10"
                          : "hover:bg-neutral-50 dark:hover:bg-white/[0.04]",
                      )}
                    >
                      {c.locked ? (
                        <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block text-sm font-medium",
                            c.locked
                              ? "text-amber-950 dark:text-amber-100"
                              : "text-neutral-900 dark:text-neutral-100",
                          )}
                        >
                          {c.label}
                        </span>
                        {c.subtitle ? (
                          <span
                            className={cn(
                              "block text-xs",
                              c.locked
                                ? "text-amber-800/80 dark:text-amber-200/80"
                                : "text-neutral-500",
                            )}
                          >
                            {c.subtitle}
                          </span>
                        ) : null}
                      </span>
                      {c.locked ? null : <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : questions.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-500">No questions in this item.</p>
          ) : (
            <ul className="space-y-1">
              {questions.map((item) => (
                <li key={item.ref}>
                  <button
                    type="button"
                    disabled={resolvingRef === item.ref}
                    onClick={() => void pickQuestion(item)}
                    className={cn(
                      "w-full rounded-2xl border border-transparent px-3 py-2.5 text-left transition-colors",
                      "hover:border-neutral-200 hover:bg-neutral-50 dark:hover:border-white/10 dark:hover:bg-white/[0.04]",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                        {item.label}
                      </span>
                      {resolvingRef === item.ref ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 line-clamp-3 text-xs text-neutral-500">{item.preview}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        {error ? (
          <p className="border-t border-red-100 bg-red-50 px-5 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

type ChipProps = {
  label: string
  preview?: string
  onClear: () => void
}

export function CoraImportedQuestionChip({ label, preview, onClear }: ChipProps) {
  return (
    <div className="mb-2 flex items-start gap-2 rounded-2xl border border-violet-200/80 bg-violet-50/80 px-3 py-2 dark:border-violet-500/25 dark:bg-violet-500/10">
      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-violet-900 dark:text-violet-100">Imported: {label}</p>
        {preview ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-violet-700/80 dark:text-violet-200/70">{preview}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-1 text-violet-600 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-500/20"
        aria-label="Remove imported question"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
