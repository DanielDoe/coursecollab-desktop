"use client"

import { MessageSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { CodebenchAskCoraPanel } from "@/components/codebench/CodebenchAskCoraPanel"
import { CORA_NAME } from "@/lib/cora/constants"
import type { CoraProblemContext } from "@/lib/cora/types"

type Props = {
  open: boolean
  onClose: () => void
  problem: CoraProblemContext | null
  studentId: string | null
  title?: string
  subtitle?: string
  /** CSS length — clears sticky quiz chrome (default ~116px). */
  topOffset?: string
  theme?: "light" | "dark"
}

export function CoraAskDrawer({
  open,
  onClose,
  problem,
  studentId,
  title = `Ask ${CORA_NAME}`,
  subtitle,
  topOffset = "7.25rem",
  theme = "dark",
}: Props) {
  const importedLabel = problem?.title ?? subtitle ?? null
  const panelKey = problem
    ? `${problem.source}-${problem.questionId ?? problem.quizId ?? "q"}-${problem.questionText.slice(0, 32)}`
    : "empty"

  return (
    <Sheet open={open} modal={false} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="z-[10040] flex w-full flex-col gap-0 border-[var(--border)] p-0 sm:max-w-md md:max-w-lg lg:max-w-xl"
        style={{
          top: topOffset,
          height: `calc(100dvh - ${topOffset})`,
        }}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>

        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--cc-text)]">{title}</p>
              {subtitle ? (
                <p className="truncate text-xs text-[var(--cc-text-muted)]">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden bg-[var(--cc-background)] p-3 sm:p-4">
          {problem ? (
            <CodebenchAskCoraPanel
              key={panelKey}
              code=""
              studentId={studentId}
              theme={theme}
              learningMode="intermediate"
              hideChrome
              skipHandoffConsume
              retainImportedQuestion
              initialImportedQuestion={problem}
              initialImportedLabel={importedLabel}
              className="h-full min-h-0 rounded-xl border border-[var(--border)]"
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
