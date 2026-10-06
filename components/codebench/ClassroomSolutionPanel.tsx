"use client"

import { BookOpenCheck, Lock } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type Props = {
  available: boolean
  unlocked: boolean
  code: string | null
  mode: "student" | "instructor"
  saving?: boolean
  onToggle?: (unlocked: boolean) => void
}

export function ClassroomSolutionPanel({
  available,
  unlocked,
  code,
  mode,
  saving = false,
  onToggle,
}: Props) {
  if (!available) return null

  if (mode === "student" && !unlocked) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Worked solution locked</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
              Work through the problem in CodeBench first. Your instructor will unlock the solution when the class is ready.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {mode === "instructor" ? (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
            unlocked
              ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-500/10"
              : "border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10",
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--cc-text)]">
              {unlocked ? "Visible to students" : "Hidden from students"}
            </p>
            <p className="text-xs text-[var(--cc-text-muted)]">
              {unlocked
                ? "Students can open this worked solution in the question drawer."
                : "Students see a locked message until you unlock this solution."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Label htmlFor="classroom-solution-unlock" className="text-xs text-[var(--cc-text-muted)]">
              Unlock
            </Label>
            <Switch
              id="classroom-solution-unlock"
              checked={unlocked}
              disabled={saving || !onToggle}
              onCheckedChange={(checked) => onToggle?.(checked)}
            />
          </div>
        </div>
      ) : null}

      {code ? (
        <div className="rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--cc-accent)_6%,var(--card))] p-3">
          <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
            <BookOpenCheck className="h-3.5 w-3.5 text-[var(--cc-accent)]" />
            Worked solution
          </p>
          <pre className="overflow-x-auto whitespace-pre rounded-md bg-[var(--cc-background,var(--muted))] p-3 font-mono text-xs leading-relaxed text-[var(--cc-text)]">
            {code}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
