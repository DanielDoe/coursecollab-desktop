"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FilePlus2,
  Loader2,
  NotebookPen,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react"
import { AiFeedbackMarkdown } from "@/components/ai-feedback-markdown"
import { CoraChatInput } from "@/components/cora/CoraChatInput"
import { Button } from "@/components/ui/button"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { useCoraContentPalette } from "@/hooks/use-cora-content-palette"
import { useToast } from "@/hooks/use-toast"
import { getStudentAuthHeaders } from "@/lib/auth"
import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import { getStudioToolChatConfig } from "@/lib/cora/studio-tool-chat"
import {
  STUDY_NOTES_PHASE_LABELS,
  deriveStudyNotesSeedTopic,
  loadStudyNotesSession,
  saveStudyNotesSession,
  type StudyNotesPack,
  type StudyNotesSection,
} from "@/lib/cora/study-notes-workspace"
import { cn } from "@/lib/utils"

type Props = {
  studentId: string
  studentContext?: CoraStudentContextPayload | null
  onClose: () => void
  initialTopic?: string | null
}

export function StudyNotesWorkspacePanel({
  studentId,
  studentContext = null,
  onClose,
  initialTopic = null,
}: Props) {
  const { toast } = useToast()
  const { tokens } = useAppearance()
  const { soft, accent, cta } = useCoraContentPalette()
  const notesConfig = getStudioToolChatConfig("study-notes")
  const isDark = tokens.isDark
  const hairline = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"
  const ink = "var(--cc-text)"
  const muted = "var(--cc-text-muted)"

  const seed = deriveStudyNotesSeedTopic(studentContext, initialTopic)
  const starters = useMemo(() => {
    const fromConfig = notesConfig?.starters?.slice(0, 6) ?? []
    const weak = (studentContext?.strugglingTopics ?? []).slice(0, 3)
    return Array.from(new Set([seed, ...weak, ...fromConfig].filter(Boolean))).slice(0, 8)
  }, [notesConfig?.starters, seed, studentContext?.strugglingTopics])

  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [composing, setComposing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pack, setPack] = useState<StudyNotesPack | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [completed, setCompleted] = useState<string[]>([])
  const [playing, setPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  const [mode, setMode] = useState(notesConfig?.defaultMode ?? "detailed")
  const [input, setInput] = useState("")

  useEffect(() => {
    const saved = loadStudyNotesSession(studentId)
    if (saved?.pack) {
      setPack(saved.pack)
      setStepIndex(Math.min(saved.stepIndex, Math.max(0, saved.pack.sections.length - 1)))
      setCompleted(saved.completed)
      setMode(saved.mode || notesConfig?.defaultMode || "detailed")
      setComposing(false)
      setLoading(false)
    } else {
      setComposing(true)
      setLoading(false)
      if (initialTopic?.trim()) setInput(initialTopic.trim())
      else if (seed) setInput(seed)
    }
    setHydrated(true)
  }, [studentId, initialTopic, seed, notesConfig?.defaultMode])

  useEffect(() => {
    if (!hydrated || !studentId || !pack?.sections?.length) return
    saveStudyNotesSession(studentId, {
      pack,
      stepIndex,
      completed,
      mode,
    })
  }, [hydrated, studentId, pack, stepIndex, completed, mode])

  const generate = useCallback(
    async (topic?: string, style?: string) => {
      const nextTopic = (topic || input || seed).trim()
      if (!nextTopic) {
        setError("Enter a topic or concept for your study notes.")
        setComposing(true)
        return
      }
      const nextMode = style || mode
      setLoading(true)
      setError(null)
      setFinished(false)
      setStepIndex(0)
      setCompleted([])
      setPlaying(false)
      setComposing(false)
      try {
        const headers: Record<string, string> = {
          ...(getStudentAuthHeaders() as Record<string, string>),
          "Content-Type": "application/json",
        }
        if (!headers["x-student-id"] && studentId) headers["x-student-id"] = studentId

        const res = await fetch("/api/cora/study-notes", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "generate", topic: nextTopic, mode: nextMode }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not generate study notes")
        const nextPack = data.pack as StudyNotesPack
        setPack(nextPack)
        setInput("")
        saveStudyNotesSession(studentId, {
          pack: nextPack,
          stepIndex: 0,
          completed: [],
          mode: nextMode,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not generate study notes")
        setComposing(true)
      } finally {
        setLoading(false)
      }
    },
    [input, seed, mode, studentId],
  )

  const startNewNote = () => {
    setPlaying(false)
    setFinished(false)
    setComposing(true)
    setError(null)
    setInput("")
  }

  const sections = pack?.sections ?? []
  const current: StudyNotesSection | null = sections[stepIndex] ?? null

  useEffect(() => {
    if (!playing || !pack || finished || composing) return
    const timer = window.setTimeout(() => {
      if (stepIndex >= sections.length - 1) {
        setPlaying(false)
        setFinished(true)
        setCompleted((prev) => Array.from(new Set([...prev, ...sections.map((s) => s.id)])))
        return
      }
      const cur = sections[stepIndex]
      if (cur) setCompleted((prev) => (prev.includes(cur.id) ? prev : [...prev, cur.id]))
      setStepIndex((i) => i + 1)
    }, 5500)
    return () => window.clearTimeout(timer)
  }, [playing, stepIndex, pack, sections, finished, composing])

  const goNext = () => {
    if (!current) return
    setCompleted((prev) => (prev.includes(current.id) ? prev : [...prev, current.id]))
    if (stepIndex >= sections.length - 1) {
      setFinished(true)
      setPlaying(false)
      return
    }
    setStepIndex((i) => i + 1)
  }

  const goPrev = () => {
    setFinished(false)
    setStepIndex((i) => Math.max(0, i - 1))
  }

  const exportToNotes = async () => {
    if (!pack) return
    setExporting(true)
    try {
      const headers: Record<string, string> = {
        ...(getStudentAuthHeaders() as Record<string, string>),
        "Content-Type": "application/json",
      }
      if (!headers["x-student-id"] && studentId) headers["x-student-id"] = studentId

      const res = await fetch("/api/cora/study-notes", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "export",
          pack,
          title: `Cora Study Notes · ${pack.topic}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Export failed")
      toast({
        title: "Saved to My Notes",
        description: data.title ?? pack.title,
      })
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const showComposer = composing || (!pack && !loading)
  const showWalkthrough = !showComposer && !loading && !error && !!pack && !!current && !finished

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ color: ink }}>
      <header
        className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5"
        style={{ background: soft, boxShadow: `inset 0 -1px 0 ${hairline}` }}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: muted }}>
            Study notes workspace
          </p>
          <h2 className="truncate text-base font-semibold sm:text-lg">
            {showComposer
              ? "What should we study?"
              : pack?.title ?? "Generating sectioned notes…"}
          </h2>
          <p className="truncate text-xs" style={{ color: muted }}>
            {showComposer
              ? "Pick a topic · choose a note style · generate a walkthrough"
              : "Scan CourseCollab · sectioned notes · interactive play"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={loading}
            onClick={startNewNote}
          >
            <FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
            New note
          </Button>
          {pack && !showComposer ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden rounded-xl sm:inline-flex"
              disabled={exporting || loading}
              onClick={() => void exportToNotes()}
            >
              {exporting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <NotebookPen className="mr-1.5 h-3.5 w-3.5" />
              )}
              Export to Notes
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: accent }} />
          <div className="max-w-sm text-center">
            <p className="font-semibold">Building your study notes…</p>
            <p className="mt-1 text-sm" style={{ color: muted }}>
              Sectioned walkthrough for{" "}
              <span className="font-medium">{(input || seed).trim() || "your topic"}</span>
            </p>
          </div>
        </div>
      ) : error && showComposer ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <Button variant="outline" className="rounded-xl" onClick={() => void generate()}>
              Retry
            </Button>
          </div>
          <ComposerFooter
            hairline={hairline}
            soft={soft}
            notesConfig={notesConfig}
            starters={starters}
            seed={seed}
            input={input}
            setInput={setInput}
            mode={mode}
            setMode={setMode}
            loading={loading}
            muted={muted}
            ink={ink}
            onGenerate={(topic) => void generate(topic)}
            onCancel={pack ? () => setComposing(false) : undefined}
          />
        </div>
      ) : showComposer ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-8">
            <div className="mx-auto max-w-xl space-y-6">
              <div className="space-y-2 text-center sm:text-left">
                <div
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl sm:mx-0"
                  style={{ background: soft, color: accent }}
                >
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">
                  {notesConfig?.heroTitle ?? "Build immersive notes"}
                </h3>
                <p className="text-sm" style={{ color: muted }}>
                  {notesConfig?.heroBody ??
                    "Tell Cora the topic or concept. Choose a note style, then generate a playable walkthrough."}
                </p>
              </div>
              {starters.length ? (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: muted }}>
                    Suggestions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {starters.map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        className="rounded-full border border-[var(--border)] px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-[var(--cc-surface)]"
                        onClick={() => {
                          setInput(topic)
                          void generate(topic)
                        }}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {pack ? (
                <button
                  type="button"
                  className="text-xs font-medium underline-offset-2 hover:underline"
                  style={{ color: muted }}
                  onClick={() => setComposing(false)}
                >
                  Back to current notes · {pack.topic}
                </button>
              ) : null}
            </div>
          </div>
          <ComposerFooter
            hairline={hairline}
            soft={soft}
            notesConfig={notesConfig}
            starters={starters}
            seed={seed}
            input={input}
            setInput={setInput}
            mode={mode}
            setMode={setMode}
            loading={loading}
            muted={muted}
            ink={ink}
            onGenerate={(topic) => void generate(topic)}
            onCancel={pack ? () => setComposing(false) : undefined}
          />
        </div>
      ) : finished && pack ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-8 text-center">
          <Sparkles className="h-12 w-12" style={{ color: accent }} />
          <h3 className="text-xl font-bold">Walkthrough complete</h3>
          <p className="max-w-md text-sm" style={{ color: muted }}>
            You played through {pack.sections.length} sections on {pack.topic}. Export the full pack to My
            Notes, or start a new topic.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={exporting}
              onClick={() => void exportToNotes()}
            >
              <NotebookPen className="mr-1.5 h-4 w-4" />
              Export to Notes
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setFinished(false)
                setStepIndex(0)
                setCompleted([])
              }}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Replay
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              style={{ background: cta.bg, color: cta.fg }}
              onClick={startNewNote}
            >
              <FilePlus2 className="mr-1.5 h-4 w-4" />
              New note
            </Button>
          </div>
        </div>
      ) : showWalkthrough ? (
        <div
          className="grid min-h-0 flex-1 overflow-hidden"
          style={{ gridTemplateColumns: "minmax(220px, 1fr) minmax(0, 2fr)" }}
        >
          <aside
            className="flex min-h-0 flex-col overflow-y-auto border-r border-[var(--border)] p-3 sm:p-5"
            style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}
          >
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: muted }}>
              Sections
            </p>
            <ol className="space-y-1.5">
              {sections.map((section, i) => {
                const active = i === stepIndex
                const done = completed.includes(section.id)
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setFinished(false)
                        setStepIndex(i)
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                        active ? "bg-[var(--cc-surface)] shadow-sm" : "hover:bg-[var(--cc-surface)]/70",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          done
                            ? "text-white"
                            : active
                              ? "border-2"
                              : "border border-[var(--border)]",
                        )}
                        style={
                          done
                            ? { background: accent }
                            : active
                              ? { borderColor: accent, color: accent }
                              : { color: muted }
                        }
                      >
                        {done ? <Check className="h-3 w-3" /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide" style={{ color: muted }}>
                          {STUDY_NOTES_PHASE_LABELS[section.phase]}
                        </span>
                        <span className="block text-sm font-medium leading-snug">{section.title}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--cc-background)]">
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
              <div
                key={current.id}
                className="w-full space-y-5 rounded-3xl p-6 sm:p-8"
                style={{ background: soft, color: ink }}
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: muted }}>
                    {STUDY_NOTES_PHASE_LABELS[current.phase]} · {stepIndex + 1}/{sections.length}
                  </p>
                  <h3 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{current.title}</h3>
                </div>
                <div className="prose prose-sm max-w-none dark:prose-invert" style={{ color: ink }}>
                  <AiFeedbackMarkdown
                    text={current.body || "_No content for this section yet._"}
                    className="text-[15px]"
                  />
                </div>
                {current.checkpoint ? (
                  <div
                    className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
                    style={{ background: "var(--cc-background)" }}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: muted }}>
                      Checkpoint
                    </p>
                    <p className="mt-1 font-medium">{current.checkpoint}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div
              className="flex shrink-0 flex-wrap items-center gap-2 px-5 py-3.5 sm:px-6"
              style={{ boxShadow: `inset 0 1px 0 ${hairline}`, background: soft }}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={stepIndex === 0}
                onClick={goPrev}
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl sm:hidden"
                disabled={exporting}
                onClick={() => void exportToNotes()}
              >
                <NotebookPen className="h-4 w-4" />
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  onClick={() => setPlaying((p) => !p)}
                  title={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
                  style={{ background: cta.bg, color: cta.fg }}
                  onClick={goNext}
                >
                  {stepIndex >= sections.length - 1 ? "Finish" : "Next section"}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ComposerFooter({
  hairline,
  soft,
  notesConfig,
  input,
  setInput,
  mode,
  setMode,
  loading,
  muted,
  ink,
  onGenerate,
  onCancel,
}: {
  hairline: string
  soft: string
  notesConfig: ReturnType<typeof getStudioToolChatConfig>
  starters: string[]
  seed: string
  input: string
  setInput: (v: string) => void
  mode: string
  setMode: (v: string) => void
  loading: boolean
  muted: string
  ink: string
  onGenerate: (topic: string) => void
  onCancel?: () => void
}) {
  return (
    <div
      className="shrink-0 px-4 pb-4 pt-2 sm:px-5"
      style={{ boxShadow: `inset 0 1px 0 ${hairline}`, background: soft }}
    >
      <div className="mx-auto max-w-xl space-y-2">
        {onCancel ? (
          <div className="flex justify-end">
            <button
              type="button"
              className="text-[11px] font-medium"
              style={{ color: muted }}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        ) : (
          <p className="text-[11px]" style={{ color: muted }}>
            Working on{" "}
            <span className="font-semibold" style={{ color: ink }}>
              {input.trim() || "a new topic"}
            </span>
            {" · "}
            choose Outline, Detailed, or Exam pack
          </p>
        )}
        <CoraChatInput
          inputValue={input}
          onInputChange={setInput}
          onSend={(msg) => onGenerate(msg)}
          modeOptions={notesConfig?.modes}
          modeValue={mode}
          onModeChange={setMode}
          modeMenuLabel={notesConfig?.modeMenuLabel ?? "Note style"}
          plusMenuVariant="attach"
          isLoading={loading}
          placeholder={notesConfig?.placeholder ?? "e.g. Chapter 7 AC analysis…"}
        />
      </div>
    </div>
  )
}
