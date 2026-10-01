"use client"

import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { useStudioSnapshot } from "@/hooks/use-studio-snapshot"
import { CodebenchStudentInsight } from "@/components/codebench/CodebenchStudentInsight"

type Props = {
  studentId: string | null
  variant?: "card" | "full"
  onOpenEditor?: () => void
  onSeeDetails?: () => void
}

export function CodebenchStudioCoach({
  studentId,
  variant = "full",
  onOpenEditor,
  onSeeDetails,
}: Props) {
  const { roles } = useCodebenchChrome()
  const snapshot = useStudioSnapshot(studentId)
  const compact = variant === "card"

  if (!studentId || !snapshot) return null

  return (
    <div className="space-y-3">
      <CodebenchStudentInsight
        rows={snapshot.runRows}
        errorCount={snapshot.compileErrors}
        cleanCount={snapshot.compileSuccesses}
        compact={compact}
      />
      {onOpenEditor || onSeeDetails ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {onOpenEditor ? (
            <Button
              className="h-11 w-full rounded-xl border-0 px-3 text-sm shadow-sm hover:opacity-90 sm:h-9 sm:w-auto"
              style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
              onClick={onOpenEditor}
            >
              Open editor and fix this
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onSeeDetails ? (
            <Button
              variant="ghost"
              className="h-11 w-full rounded-xl px-3 text-sm text-[var(--cc-text)] hover:bg-[color-mix(in_srgb,var(--cc-accent-soft)_35%,var(--muted))] sm:h-9 sm:w-auto"
              onClick={onSeeDetails}
            >
              See the full read
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
