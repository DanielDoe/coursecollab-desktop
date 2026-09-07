"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BookOpen,
  Brain,
  Loader2,
  NotebookPen,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { CORA_MOTTO, CORA_NAME, CORA_TAGLINE } from "@/lib/cora/constants"
import type { CoraMode, CoraSession } from "@/lib/cora/step-engine/types"
import type { CoraDomain, CoraProblemContext } from "@/lib/cora/types"
import {
  buildCoraSessionNoteTitle,
  coraSessionToExportMessages,
} from "@/lib/cora/step-engine/export-session-note"
import { useStepEngine } from "@/components/cora/use-step-engine"
import { CoraTimeline } from "@/components/cora/CoraTimeline"
import { CoraCanvas } from "@/components/cora/CoraCanvas"
import { CoraHintMenu } from "@/components/cora/CoraHintMenu"
import { CoraSummary } from "@/components/cora/CoraSummary"
import { useToast } from "@/hooks/use-toast"

const DOMAIN_ACCENT: Record<CoraDomain, string> = {
  circuit: "from-emerald-500 to-teal-400",
  coding: "from-violet-500 to-indigo-500",
  math: "from-sky-500 to-cyan-400",
  generic: "from-slate-500 to-slate-400",
}

type Props = {
  open: boolean
  problem: CoraProblemContext | null
  onClose: () => void
}

export function CoraWorkspace({ open, problem, onClose }: Props) {
  const { toast } = useToast()
  const [mode, setMode] = useState<CoraMode>("guided")
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<CoraSession | null>(null)
  const [playback, setPlayback] = useState<"paused" | "playing">("paused")

  const engine = useStepEngine(session)

  const loadSession = useCallback(
    async (ctx: CoraProblemContext, selectedMode: CoraMode) => {
      setLoading(true)
      setError(null)
      setSession(null)
      engine.reset()
      try {
        const res = await fetch("/api/cora/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...ctx, mode: selectedMode }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not start Cora")
        setSession(data.session as CoraSession)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start Cora")
      } finally {
        setLoading(false)
      }
    },
    [engine],
  )

  useEffect(() => {
    if (open && problem) void loadSession(problem, mode)
    if (!open) {
      setSession(null)
      setError(null)
      engine.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, problem])

  const accent = DOMAIN_ACCENT[session?.domain ?? problem?.domain ?? "generic"]

  const switchMode = (next: CoraMode) => {
    setMode(next)
    if (problem) void loadSession(problem, next)
  }

  const exportToNotes = useCallback(async () => {
    if (!session) {
      toast({ title: "Nothing to export", description: "Start the workspace first." })
      return
    }
    setExporting(true)
    try {
      const title = buildCoraSessionNoteTitle(session)
      const messages = coraSessionToExportMessages(session, {
        reflections: engine.reflections,
      })
      const res = await fetch("/api/cora/workspace-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "export_note",
          confirmed: true,
          title,
          messages,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Export failed")
      toast({
        title: "Saved to My Notes",
        description: data.title ?? title,
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
  }, [engine.reflections, session, toast])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-[var(--border)] bg-[var(--cc-background)]/95 p-0 backdrop-blur-xl",
          "h-[min(94vh,960px)] w-[min(96vw,1280px)] max-w-none sm:max-w-[min(96vw,1280px)]",
          "rounded-2xl",
        )}
      >
        <DialogTitle className="sr-only">{CORA_NAME}</DialogTitle>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg",
                accent,
              )}
            >
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-[var(--cc-text)]">{CORA_NAME}</p>
              <p className="truncate text-xs text-[var(--cc-text-muted)]">
                {CORA_TAGLINE} · {CORA_MOTTO}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-xl border border-[var(--border)] p-0.5 sm:flex">
              {(["guided", "explain"] as CoraMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all",
                    mode === m
                      ? cn("bg-gradient-to-r text-white shadow-sm", accent)
                      : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                  )}
                >
                  {m === "guided" ? "Guided" : "Explain"}
                </button>
              ))}
            </div>
            {session ? (
              <Badge variant="secondary" className="hidden text-[10px] uppercase md:inline-flex">
                {session.dataSource === "reference" ? "Course material" : "AI guided"}
              </Badge>
            ) : null}
            {session ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="hidden rounded-xl sm:inline-flex"
                disabled={exporting}
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
            <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10">
            <Loader2 className="h-10 w-10 animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-[var(--cc-text)]">Building your workspace…</p>
              <p className="text-sm text-[var(--cc-text-muted)]">
                Instructor solutions first · animations second
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            {problem ? (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => void loadSession(problem, mode)}
              >
                Retry
              </Button>
            ) : null}
          </div>
        ) : session && engine.finished ? (
          <CoraSummary
            session={session}
            onClose={onClose}
            onRestart={engine.reset}
            onExportToNotes={() => void exportToNotes()}
            isExporting={exporting}
          />
        ) : session && engine.current ? (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_1fr]">
            <CoraTimeline
              steps={engine.steps}
              stepIndex={engine.stepIndex}
              completedIds={engine.completedIds}
              accent={accent}
              onSelect={engine.goTo}
            />
            <div className="flex min-h-0 flex-col border-t border-[var(--border)] lg:border-t-0 lg:border-l">
              <CoraCanvas
                session={session}
                step={engine.current}
                mode={mode}
                accent={accent}
                activeHint={engine.activeHint}
                reflection={engine.reflections[engine.current.id] ?? ""}
                onReflectionChange={(v) =>
                  engine.setReflections((r) => ({ ...r, [engine.current!.id]: v }))
                }
                confidence={engine.confidence}
                onConfidenceChange={engine.setConfidence}
                checkpointResults={engine.checkpointResults}
                onCheckpoint={engine.submitCheckpoint}
              />
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--border)] bg-[var(--cc-background)]/80 px-5 py-3.5 backdrop-blur sm:px-6">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={engine.stepIndex === 0}
                  onClick={engine.prev}
                >
                  Back
                </Button>
                <CoraHintMenu
                  step={engine.current}
                  onHint={engine.useHint}
                  disabled={mode === "explain"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl sm:hidden"
                  disabled={exporting}
                  onClick={() => void exportToNotes()}
                >
                  <NotebookPen className="mr-1.5 h-3.5 w-3.5" />
                  Notes
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-xl"
                    onClick={() => setPlayback((p) => (p === "playing" ? "paused" : "playing"))}
                    title={playback === "playing" ? "Pause" : "Play"}
                  >
                    {playback === "playing" ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-xl"
                    onClick={engine.reset}
                    title="Restart"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!engine.canAdvance}
                    className={cn("rounded-xl bg-gradient-to-r text-white", accent)}
                    onClick={engine.next}
                  >
                    {engine.stepIndex >= engine.steps.length - 1 ? "Finish" : "Next step"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && !error && session ? (
          <div className="flex shrink-0 items-center gap-4 border-t border-[var(--border)] px-5 py-2.5 text-[10px] text-[var(--cc-text-muted)] sm:px-6">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" /> Interactive workspace
            </span>
            <span className="flex items-center gap-1">
              <Brain className="h-3 w-3" /> Not a chatbot
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <BookOpen className="h-3 w-3" /> Instructor-aligned
            </span>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
