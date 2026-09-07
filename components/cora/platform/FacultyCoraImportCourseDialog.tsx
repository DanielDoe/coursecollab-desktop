"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Library,
  Loader2,
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
import type { CoraProblemContext } from "@/lib/cora/types"
import type {
  FacultyImportContainerOption,
  FacultyImportSourceKey,
  FacultyImportSourceOption,
} from "@/lib/cora/faculty-question-import-types"
import {
  listFacultyQuestionImportContainers,
  listFacultyQuestionImportItems,
  listFacultyQuestionImportSources,
  resolveFacultyQuestionImport,
} from "@/lib/cora/faculty-cora-client"

type Step = "source" | "container" | "question"

type Props = {
  open: boolean
  onClose: () => void
  hint?: { sourceKey?: FacultyImportSourceKey; containerHint?: string; improveGoal?: string } | null
  onImport: (problem: CoraProblemContext, item: CoraImportableItem) => void
}

const SOURCE_ICON: Record<FacultyImportSourceKey, typeof BookOpen> = {
  question_bank: Library,
  quizzes: ClipboardList,
  homework: ClipboardList,
  mid_semester: GraduationCap,
  final: GraduationCap,
}

function matchesHint(label: string, hint?: string) {
  if (!hint?.trim()) return false
  return label.toLowerCase().includes(hint.trim().toLowerCase())
}

export function FacultyCoraImportCourseDialog({ open, onClose, hint, onImport }: Props) {
  const [step, setStep] = useState<Step>("source")
  const [sourceKey, setSourceKey] = useState<FacultyImportSourceKey | null>(null)
  const [container, setContainer] = useState<FacultyImportContainerOption | null>(null)
  const [sources, setSources] = useState<FacultyImportSourceOption[]>([])
  const [containers, setContainers] = useState<FacultyImportContainerOption[]>([])
  const [questions, setQuestions] = useState<CoraImportableItem[]>([])
  const [loading, setLoading] = useState(false)
  const [resolvingRef, setResolvingRef] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStep("source")
    setSourceKey(null)
    setContainer(null)
    setContainers([])
    setQuestions([])
    setError(null)
  }, [])

  const openContainer = useCallback(
    async (next: FacultyImportContainerOption, key: FacultyImportSourceKey) => {
      setContainer(next)
      setStep("question")
      setLoading(true)
      setError(null)
      try {
        const res = await listFacultyQuestionImportItems(key, next.id)
        setQuestions(res.items ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load questions")
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const openSource = useCallback(
    async (key: FacultyImportSourceKey) => {
      setSourceKey(key)
      setStep("container")
      setLoading(true)
      setError(null)
      try {
        const res = await listFacultyQuestionImportContainers(key)
        const nextContainers = res.containers ?? []
        setContainers(nextContainers)
        const preferred = hint?.containerHint
          ? nextContainers.find((entry) => matchesHint(entry.label, hint.containerHint))
          : undefined
        if (preferred) await openContainer(preferred, key)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load topics")
      } finally {
        setLoading(false)
      }
    },
    [hint?.containerHint, openContainer],
  )

  useEffect(() => {
    if (!open) {
      reset()
      return
    }
    setLoading(true)
    setError(null)
    void listFacultyQuestionImportSources()
      .then(async (res) => {
        const nextSources = res.sources ?? []
        setSources(nextSources)
        const preferred = hint?.sourceKey
          ? nextSources.find((source) => source.key === hint.sourceKey)
          : undefined
        if (preferred) await openSource(preferred.key)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load sources"))
      .finally(() => setLoading(false))
  }, [open, reset, hint?.sourceKey, openSource])

  const goBack = () => {
    setError(null)
    if (step === "question") {
      setStep("container")
      setQuestions([])
      setContainer(null)
      return
    }
    if (step === "container") {
      setStep("source")
      setSourceKey(null)
      setContainers([])
      return
    }
    onClose()
  }

  const importItem = async (item: CoraImportableItem) => {
    setResolvingRef(item.ref)
    setError(null)
    try {
      const res = await resolveFacultyQuestionImport(item)
      onImport(res.problem, item)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setResolvingRef(null)
    }
  }

  const title =
    step === "source"
      ? "Import from course"
      : step === "container"
        ? sources.find((s) => s.key === sourceKey)?.label || "Select topic"
        : container?.label || "Select question"

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg p-1 text-[var(--cc-text-muted)] hover:bg-[var(--muted)]"
              aria-label={step === "source" ? "Close" : "Back"}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <DialogTitle className="truncate text-base">{title}</DialogTitle>
              <DialogDescription className="text-xs">
                {hint?.improveGoal
                  ? hint.improveGoal
                  : "Attach a course question for Cora to improve, review, or explain."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-1 p-3">
            {error ? <p className="px-2 py-2 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--cc-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : null}

            {!loading && step === "source"
              ? sources.map((source) => {
                  const Icon = SOURCE_ICON[source.key]
                  return (
                    <button
                      key={source.key}
                      type="button"
                      onClick={() => void openSource(source.key)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[var(--muted)]/40"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--muted)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-[var(--cc-text)]">{source.label}</span>
                        <span className="block text-xs text-[var(--cc-text-muted)]">
                          {source.description}
                          {source.count != null ? ` · ${source.count}` : ""}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-[var(--cc-text-muted)]" />
                    </button>
                  )
                })
              : null}

            {!loading && step === "container"
              ? containers.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => sourceKey && void openContainer(entry, sourceKey)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[var(--muted)]/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[var(--cc-text)]">{entry.label}</span>
                      {entry.subtitle ? (
                        <span className="block text-xs text-[var(--cc-text-muted)]">{entry.subtitle}</span>
                      ) : null}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--cc-text-muted)]" />
                  </button>
                ))
              : null}

            {!loading && step === "question"
              ? questions.map((item) => (
                  <button
                    key={item.ref}
                    type="button"
                    disabled={resolvingRef === item.ref}
                    onClick={() => void importItem(item)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-[var(--muted)]/40",
                      resolvingRef === item.ref && "opacity-70",
                    )}
                  >
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[var(--cc-text)]">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-[var(--cc-text-muted)]">{item.preview}</span>
                    </span>
                    {resolvingRef === item.ref ? (
                      <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 text-[var(--cc-text-muted)]" />
                    )}
                  </button>
                ))
              : null}

            {!loading &&
            ((step === "source" && sources.length === 0) ||
              (step === "container" && containers.length === 0) ||
              (step === "question" && questions.length === 0)) ? (
              <p className="px-2 py-8 text-center text-sm text-[var(--cc-text-muted)]">
                Nothing to import here yet.
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
