"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export function ResultsAutoFinalizeSettings({ bare = false }: { bare?: boolean }) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const chrome = facultyEmbedChrome("grading-policies")
  const spinner = facultyModuleSpinnerClass("grading-policies")
  const switchClass = chrome.switchChecked

  useEffect(() => {
    setLoading(true)
    instructorApiFetch("/api/instructor/courses/grading-policy", {
      headers: getInstructorScopeHeaders() as Record<string, string>,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.auto_finalize_perfect_scores != null) {
          setEnabled(Boolean(data.auto_finalize_perfect_scores))
        }
      })
      .catch(() =>
        toast({
          title: "Error",
          description: "Failed to load results finalization settings",
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false))
  }, [toast])

  const handleToggle = async (checked: boolean) => {
    setSaving(true)
    const previous = enabled
    setEnabled(checked)
    try {
      const res = await instructorApiFetch("/api/instructor/courses/grading-policy", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({ auto_finalize_perfect_scores: checked }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Save failed")
      }
      const data = await res.json()
      toast({
        title: checked ? "Auto-finalize enabled" : "Auto-finalize disabled",
        description:
          data.auto_finalize_backfilled_count > 0
            ? checked
              ? `Perfect scores with no pending review are finalized automatically. ${data.auto_finalize_backfilled_count} existing score(s) were finalized.`
              : "Instructors finalize perfect scores manually from each results report."
            : checked
              ? "Perfect scores with no pending review will be finalized automatically."
              : "Instructors finalize perfect scores manually from each results report.",
      })
    } catch (err: unknown) {
      setEnabled(previous)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const body = loading ? (
    <div className={cn("flex items-center gap-2 py-2 text-sm", PORTAL_TEXT_MUTED)}>
      <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} />
      Loading…
    </div>
  ) : (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3">
      <div className="min-w-0">
        <Label htmlFor="auto-finalize-perfect" className={cn("text-sm font-medium", PORTAL_TEXT)}>
          Auto-finalize perfect scores (100%)
        </Label>
        <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
          Completed attempts at 100% with no questions awaiting manual review are marked Finalized automatically.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {saving ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : null}
        <Switch
          id="auto-finalize-perfect"
          checked={enabled}
          onCheckedChange={(v) => void handleToggle(v)}
          disabled={saving}
          className={switchClass}
          aria-label="Auto-finalize perfect scores"
        />
      </div>
    </div>
  )

  if (bare) return body

  return (
    <InstructorPolicySurfaceCard
      title="Results finalization"
      description="Control when student results are marked as reviewed and finalized for grade release."
    >
      {body}
    </InstructorPolicySurfaceCard>
  )
}
