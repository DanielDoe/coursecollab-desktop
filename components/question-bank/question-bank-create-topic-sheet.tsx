"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FolderPlus, Loader2, PenLine, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useToast } from "@/components/ui/use-toast"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/assessments/assessment-management-surface-classes"
import { cn } from "@/lib/utils"

type BankQuestion = {
  id: number
  question_text: string
  topic: string | null
}

type Step = "name" | "method" | "select"

export function QuestionBankCreateTopicSheet({
  open,
  onOpenChange,
  bankBase,
  existingTopics,
  allQuestions,
  onTopicCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bankBase: string
  existingTopics: string[]
  allQuestions: BankQuestion[]
  onTopicCreated: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState<Step>("name")
  const [topicName, setTopicName] = useState("")
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [assigning, setAssigning] = useState(false)

  const trimmedName = topicName.trim()
  const nameConflict = trimmedName.length > 0 && existingTopics.some((t) => t.toLowerCase() === trimmedName.toLowerCase())

  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase()
    return allQuestions.filter((q) => {
      if (q.topic === trimmedName) return false
      if (!term) return true
      return q.question_text.toLowerCase().includes(term) || String(q.id).includes(term)
    })
  }, [allQuestions, search, trimmedName])

  function reset() {
    setStep("name")
    setTopicName("")
    setSearch("")
    setSelectedIds(new Set())
    setAssigning(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function goCreateQuestions() {
    handleOpenChange(false)
    router.push(`${bankBase}/new?topic=${encodeURIComponent(trimmedName)}`)
  }

  async function assignSelected() {
    if (selectedIds.size === 0) {
      toast({ title: "Select questions", description: "Pick at least one question for this topic.", variant: "destructive" })
      return
    }
    setAssigning(true)
    try {
      const res = await instructorApiFetch("/api/instructor/question-bank/topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({ name: trimmedName, questionIds: Array.from(selectedIds) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to assign topic")
      toast({
        title: "Topic created",
        description: `${data.questionsUpdated ?? selectedIds.size} question(s) tagged as "${trimmedName}".`,
      })
      onTopicCreated()
      handleOpenChange(false)
    } catch (e) {
      toast({
        title: "Could not assign topic",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setAssigning(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg" showCloseButton={false}>
        <SheetHeader className="border-b border-[var(--border)] px-5 py-4 text-left">
          <SheetTitle className={PORTAL_TEXT}>Add topic</SheetTitle>
          <SheetDescription className={PORTAL_TEXT_MUTED}>
            {step === "name"
              ? "Name the topic, then add new questions or tag existing ones."
              : step === "method"
                ? `How should questions join "${trimmedName}"?`
                : `Select bank questions to tag with "${trimmedName}".`}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "name" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="topic-name" className={PORTAL_TEXT}>
                  Topic name
                </Label>
                <Input
                  id="topic-name"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  placeholder="e.g. AC Power, Chapter 3 — Op Amps"
                  className="h-10"
                  autoFocus
                />
                {nameConflict ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    A topic with this name already exists — you can still add more questions to it.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === "method" ? (
            <div className="grid gap-3">
              <button
                type="button"
                onClick={goCreateQuestions}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--cc-accent)]/30 hover:bg-[var(--muted)]/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cc-accent)]/10 text-[var(--cc-accent)]">
                  <PenLine className="h-5 w-5" />
                </div>
                <div>
                  <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Create new questions</p>
                  <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                    Open the question editor with this topic pre-filled. Add one or many items.
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStep("select")}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition-colors hover:border-[var(--cc-accent)]/30 hover:bg-[var(--muted)]/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cc-accent)]/10 text-[var(--cc-accent)]">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Add existing questions</p>
                  <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                    Pick questions already in your bank and tag them with this topic.
                  </p>
                </div>
              </button>
            </div>
          ) : null}

          {step === "select" ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search questions…"
                  className="h-9 pl-9"
                />
              </div>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                {selectedIds.size} selected · {filteredQuestions.length} available
              </p>
              <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                {filteredQuestions.length === 0 ? (
                  <p className={cn("py-6 text-center text-sm", PORTAL_TEXT_MUTED)}>No matching questions</p>
                ) : (
                  filteredQuestions.map((q) => (
                    <label
                      key={q.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-transparent p-2 hover:bg-[var(--muted)]/40"
                    >
                      <Checkbox
                        checked={selectedIds.has(q.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds)
                          if (checked) next.add(q.id)
                          else next.delete(q.id)
                          setSelectedIds(next)
                        }}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-mono text-[var(--cc-text-muted)]">#{q.id}</p>
                        <QuestionTextRenderer
                          text={q.question_text}
                          className="line-clamp-2 text-sm text-[var(--cc-text-secondary)]"
                        />
                        {q.topic ? (
                          <p className="mt-0.5 text-[10px] text-[var(--cc-text-muted)]">Current: {q.topic}</p>
                        ) : null}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        <SheetFooter className="border-t border-[var(--border)] px-5 py-4">
          {step === "name" ? (
            <>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[var(--cc-accent)] text-white hover:opacity-90"
                disabled={!trimmedName}
                onClick={() => setStep("method")}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                Continue
              </Button>
            </>
          ) : null}
          {step === "method" ? (
            <Button type="button" variant="outline" onClick={() => setStep("name")}>
              Back
            </Button>
          ) : null}
          {step === "select" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("method")} disabled={assigning}>
                Back
              </Button>
              <Button
                type="button"
                className="bg-[var(--cc-accent)] text-white hover:opacity-90"
                disabled={assigning || selectedIds.size === 0}
                onClick={() => void assignSelected()}
              >
                {assigning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning…
                  </>
                ) : (
                  `Add ${selectedIds.size} question${selectedIds.size === 1 ? "" : "s"}`
                )}
              </Button>
            </>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
