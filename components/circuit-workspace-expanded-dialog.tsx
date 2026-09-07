"use client"

import { useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, NotebookPen, Check, X } from "lucide-react"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import { CircuitWorkspaceEditor } from "@/components/circuit-workspace-editor"
import { CircuitWorkspaceBackupActions } from "@/components/circuit-workspace-backup-actions"
import type { CircuitWorkspace } from "@/lib/circuit-workspace"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: CircuitWorkspace
  onWorkspaceChange: (next: CircuitWorkspace, options?: { flush?: boolean }) => void
  onRegisterFlush?: (flush: () => void) => void
  replayRecorderRef?: React.MutableRefObject<import("@/lib/workspace-replay").WorkspaceReplayRecorder>
  onSave: (workspace: CircuitWorkspace) => Promise<boolean>
  saving?: boolean
  disabled?: boolean
  question: {
    question_text: string
    question_media?: unknown
    circuit_spec?: unknown
    title?: string | null
  }
}

export function CircuitWorkspaceExpandedDialog({
  open,
  onOpenChange,
  workspace,
  onWorkspaceChange,
  onRegisterFlush,
  replayRecorderRef,
  onSave,
  saving,
  disabled,
  question,
}: Props) {
  const [localSaving, setLocalSaving] = useState(false)
  const workspaceSnapshotRef = useRef(workspace)
  const localFlushRef = useRef<(() => void) | null>(null)
  workspaceSnapshotRef.current = workspace

  const handleSave = async () => {
    if (localSaving || saving) return
    setLocalSaving(true)
    try {
      localFlushRef.current?.()
      const ok = await onSave(workspaceSnapshotRef.current)
      if (ok) onOpenChange(false)
    } finally {
      setLocalSaving(false)
    }
  }

  const isSaving = saving || localSaving

  return (
    <Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
      <DialogContent
        showCloseButton={false}
        className="!flex !flex-col gap-0 p-0 min-w-0 overflow-hidden max-w-[100vw] w-[100vw] h-[100dvh] max-h-[100dvh] sm:max-w-[100vw] sm:w-[100vw] rounded-none border-0 top-0 left-0 translate-x-0 translate-y-0 bg-slate-100 dark:bg-slate-950"
      >
        <DialogHeader className="shrink-0 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/95 backdrop-blur-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
                <NotebookPen className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <span className="truncate">{question.title || "Solution workspace"}</span>
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5 text-slate-500 dark:text-slate-400">
                Write your complete worked solution. Supports Apple Pencil, stylus, or finger.
              </DialogDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 shrink-0">
              <CircuitWorkspaceBackupActions
                workspace={workspace}
                onImport={onWorkspaceChange}
                disabled={disabled || isSaving}
                filenameBase={question.title || "workspace"}
                compact
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-w-[5.5rem]"
                disabled={isSaving}
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4 mr-1.5" />
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-w-[7.5rem]"
                disabled={disabled || isSaving}
                onClick={() => void handleSave()}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1.5" />
                )}
                {isSaving ? "Saving…" : "Save & close"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 min-w-0 flex-col 2xl:flex-row overflow-y-auto 2xl:overflow-hidden overscroll-contain">
          <aside className="shrink-0 w-full 2xl:w-[min(360px,32vw)] border-b 2xl:border-b-0 2xl:border-r border-slate-200/80 dark:border-slate-800 overflow-y-auto bg-white/60 dark:bg-slate-900/40 p-4 space-y-3 max-h-[28dvh] sm:max-h-[32dvh] 2xl:max-h-none">
            <QuestionMediaDisplay question={question} size="compact" />
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-800/95 p-3 shadow-sm">
              <QuestionTextRenderer
                text={question.question_text}
                className="text-sm leading-relaxed text-slate-900 dark:text-slate-50"
              />
            </div>
          </aside>

          <main className="flex-1 min-h-0 min-w-0 p-3 sm:p-4 flex flex-col overflow-hidden">
            <CircuitWorkspaceEditor
              workspace={workspace}
              onChange={(next, options) => {
                workspaceSnapshotRef.current = next
                onWorkspaceChange(next, options)
              }}
              onRegisterFlush={(flush) => {
                localFlushRef.current = flush
                onRegisterFlush?.(flush)
              }}
              replayRecorderRef={replayRecorderRef}
              disabled={disabled || isSaving}
            />
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
