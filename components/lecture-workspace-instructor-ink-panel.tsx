"use client"

import { PenLine } from "lucide-react"
import { CircuitWorkspaceEditor } from "@/components/circuit-workspace-editor"
import {
  createEmptyWorkspace,
  workspaceHasContent,
  type CircuitWorkspace,
} from "@/lib/circuit-workspace"
import { cn } from "@/lib/utils"

type Props = {
  workspace: CircuitWorkspace | null | undefined
  title?: string
  className?: string
}

/** Read-only instructor ink solution — mobile StudentLectureWorkspaceInkPanel parity. */
export function LectureWorkspaceInstructorInkPanel({
  workspace,
  title = "Instructor worked solution",
  className,
}: Props) {
  const displayWorkspace = workspace ?? createEmptyWorkspace()
  const hasInk = workspace != null && workspaceHasContent(workspace)

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--muted)]/20",
        className,
      )}
    >
      <div className="flex items-start gap-2.5 border-b border-[var(--border)] px-3 py-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]">
          <PenLine className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--cc-text)]">{title}</p>
          <p className="text-xs text-[var(--cc-text-muted)]">
            {hasInk
              ? "Instructor worked solution — view only"
              : "Your instructor publishes ink solutions here during class"}
          </p>
        </div>
      </div>

      <CircuitWorkspaceEditor workspace={displayWorkspace} onChange={() => {}} disabled />

      {!hasInk ? (
        <p className="mx-3 mb-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--cc-text-muted)]">
          No ink solution has been published for this problem yet. Step-by-step text and Cora are still
          available below.
        </p>
      ) : null}
    </div>
  )
}
