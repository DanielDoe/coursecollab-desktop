"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  GradeWeightDistributionBar,
  GradeWeightSliderRow,
} from "@/components/instructor/GradeWeightSliderRow"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useSessionCatalog } from "@/components/session-catalog-provider"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"

interface InstructorGradesSettingsProps {
  instructorId: number
  session?: string
  dataRefreshKey?: number
  /** Portal admin layout — no outer card, theme-aligned controls */
  bare?: boolean
}

const WEIGHT_KEYS = [
  { key: "quiz", label: "Quiz" },
  { key: "homework", label: "Homework" },
  { key: "midterm", label: "Midterm" },
  { key: "final", label: "Final" },
  { key: "attendance", label: "Attendance" },
  { key: "project", label: "Project" },
  { key: "classroom", label: "Classroom" },
  { key: "engagement", label: "Engagement" },
] as const

const SELECT = cn("h-10 w-full rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)

export function InstructorGradesSettings({
  instructorId: _instructorId,
  session: propSession = "ALL",
  dataRefreshKey = 0,
  bare = false,
}: InstructorGradesSettingsProps) {
  const { selectOptions } = useSessionCatalog()
  const [session, setSession] = useState(propSession)
  const [weights, setWeights] = useState<Record<string, number>>({
    quiz: 10,
    homework: 10,
    midterm: 20,
    final: 25,
    attendance: 10,
    project: 15,
    classroom: 5,
    engagement: 5,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const chrome = facultyEmbedChrome("grading-policies")
  const spinner = facultyModuleSpinnerClass("grading-policies")

  const total = Object.values(weights).reduce((sum, v) => sum + v, 0)
  const canSave = Math.abs(total - 100) < 0.01
  const isBalanced = canSave

  useEffect(() => {
    setSession(propSession)
  }, [propSession])

  useEffect(() => {
    setLoading(true)
    studentApiFetch(`/api/grades/weights?session=${encodeURIComponent(session)}`, {
      headers: buildInstructorApiHeaders(),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.weights) {
          setWeights({
            quiz: data.weights.quiz ?? 10,
            homework: data.weights.homework ?? 10,
            midterm: data.weights.midterm ?? 20,
            final: data.weights.final ?? 25,
            attendance: data.weights.attendance ?? 10,
            project: data.weights.project ?? 15,
            classroom: data.weights.classroom ?? 5,
            engagement: data.weights.engagement ?? 5,
          })
        }
      })
      .catch(() => toast({ title: "Error", description: "Failed to load weights", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [session, dataRefreshKey, toast])

  const handleSave = async () => {
    if (!canSave) {
      toast({ title: "Invalid", description: "Grade weights must total 100%.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const response = await studentApiFetch("/api/grades/adjust-weight", {
        method: "POST",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          session,
          quizWeight: weights.quiz,
          homeworkWeight: weights.homework,
          midtermWeight: weights.midterm,
          finalWeight: weights.final,
          attendanceWeight: weights.attendance,
          projectWeight: weights.project,
          classroomWeight: weights.classroom,
          engagementWeight: weights.engagement,
        }),
      })

      if (response.ok) {
        toast({ title: "Grade weights saved" })
      } else {
        const data = await response.json()
        toast({ title: "Error", description: data.error || "Failed to update", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to update weights", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const updateWeight = (key: string, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, value)) }))
  }

  if (loading) {
    if (bare) {
      return <InstructorPolicyLoadingState moduleId="grading-policies" label="Loading grade weights…" />
    }
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-teal-600 dark:border-teal-400" />
        <p className="mt-4 text-slate-600 dark:text-slate-400">Loading settings...</p>
      </div>
    )
  }

  const summaryPanel = (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 p-4">
      <div className="space-y-1.5">
        <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Section scope</Label>
        <Select value={session} onValueChange={setSession}>
          <SelectTrigger className={SELECT}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sections</SelectItem>
            {selectOptions.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Distribution</span>
          <span className={cn("text-xs tabular-nums font-semibold", PORTAL_TEXT)}>{total.toFixed(0)}% total</span>
        </div>
        <GradeWeightDistributionBar weights={weights} total={total} portal />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
        <span className={cn("text-sm font-medium", PORTAL_TEXT)}>Total weight</span>
        <span
          className={cn(
            "text-xl font-bold tabular-nums",
            !canSave
              ? "text-[var(--cc-sem-warning)]"
              : isBalanced
                ? "text-[var(--cc-sem-success)]"
                : "text-[var(--cc-accent-dark)]",
          )}
        >
          {total.toFixed(1)}%
        </span>
      </div>

      {!canSave ? (
        <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>Increase at least one category weight to save.</p>
      ) : !isBalanced ? (
        <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
          Totals above or below 100% are allowed. Course grades reflect this weighting scheme.
        </p>
      ) : (
        <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>Weights sum to 100% for this section scope.</p>
      )}

      {bare ? (
        <Button
          type="button"
          size="sm"
          disabled={!canSave || saving}
          className={cn("h-9 w-full gap-2 rounded-lg", chrome.cta)}
          onClick={() => void handleSave()}
        >
          {saving ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : <Save className="h-4 w-4" />}
          Save weights
        </Button>
      ) : null}
    </div>
  )

  const weightRows = (
    <div className="space-y-2">
      {WEIGHT_KEYS.map(({ key, label }) => (
        <GradeWeightSliderRow
          key={key}
          keyName={key}
          label={label}
          value={weights[key]}
          shareOfTotal={total > 0 ? (weights[key] / total) * 100 : 0}
          onChange={(v) => updateWeight(key, v)}
          portal={bare}
          sliderClass={bare ? chrome.slider : undefined}
        />
      ))}
    </div>
  )

  if (bare) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(17rem,100%)]">
        <div className="min-w-0 space-y-2">{weightRows}</div>
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">{summaryPanel}</div>
      </div>
    )
  }

  return (
    <InstructorPolicySurfaceCard
      title="Grade weight configuration"
      description="Adjust how each category contributes to the course grade. Weights can total over 100% if you use that scheme (e.g. 110%); each slider is still 0–100% per category."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Label className="text-slate-700 dark:text-slate-300">Session</Label>
          <Select value={session} onValueChange={setSession}>
            <SelectTrigger className="w-full rounded-xl sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Sections</SelectItem>
              {selectOptions.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Weight distribution</span>
            <span className="font-medium tabular-nums text-slate-600 dark:text-slate-300">{total.toFixed(0)}% total</span>
          </div>
          <GradeWeightDistributionBar weights={weights} total={total} />
        </div>

        {weightRows}

        <div
          className={cn(
            "rounded-xl border p-4",
            canSave
              ? isBalanced
                ? "border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-800/50 dark:bg-emerald-950/30"
                : "border-sky-200/80 bg-sky-50/80 dark:border-sky-800/50 dark:bg-sky-950/20"
              : "border-amber-200/80 bg-amber-50/80 dark:border-amber-800/50 dark:bg-amber-950/30",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-800 dark:text-slate-100">Total Weight</span>
            <span className="text-xl font-bold tabular-nums">{total.toFixed(1)}%</span>
          </div>
        </div>

        <Button onClick={() => void handleSave()} disabled={!canSave || saving} className="w-full min-w-0 rounded-xl">
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save weight configuration"}
        </Button>
      </div>
    </InstructorPolicySurfaceCard>
  )
}
