"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { Loader2, Save, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { DEFAULT_ASSESSMENT_PERKS_GRACE_DAYS_AFTER_DEADLINE } from "@/lib/assessment-perks-expiry"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const FIELD = cn("h-10 max-w-xs rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)

export function AssessmentPerksGraceSettings({ bare = false }: { bare?: boolean }) {
  const [graceDays, setGraceDays] = useState(String(DEFAULT_ASSESSMENT_PERKS_GRACE_DAYS_AFTER_DEADLINE))
  const [platformDefault, setPlatformDefault] = useState(DEFAULT_ASSESSMENT_PERKS_GRACE_DAYS_AFTER_DEADLINE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const chrome = facultyEmbedChrome("grading-policies")
  const spinner = facultyModuleSpinnerClass("grading-policies")

  useEffect(() => {
    setLoading(true)
    instructorApiFetch("/api/instructor/courses/grading-policy", {
      headers: getInstructorScopeHeaders() as Record<string, string>,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.assessment_perks_grace_days_after_deadline != null) {
          setGraceDays(String(data.assessment_perks_grace_days_after_deadline))
        }
        if (data.platform_default_assessment_perks_grace_days != null) {
          setPlatformDefault(Number(data.platform_default_assessment_perks_grace_days))
        }
      })
      .catch(() =>
        toast({
          title: "Error",
          description: "Failed to load assessment grace period settings",
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false))
  }, [toast])

  const daysNum = parseInt(graceDays, 10)
  const isValid = Number.isFinite(daysNum) && daysNum >= 0 && daysNum <= 90

  const handleSave = async () => {
    if (!isValid) {
      toast({
        title: "Invalid value",
        description: "Enter a whole number from 0 to 90 days.",
        variant: "destructive",
      })
      return
    }
    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/courses/grading-policy", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(getInstructorScopeHeaders() as Record<string, string>),
        },
        body: JSON.stringify({ assessment_perks_grace_days_after_deadline: daysNum }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Save failed")
      }
      toast({
        title: "Saved",
        description: "Assessment grace period updated for this course.",
      })
    } catch (err: unknown) {
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
    <p className={cn("flex items-center gap-2 text-sm", PORTAL_TEXT_MUTED)}>
      <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> Loading…
    </p>
  ) : (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="perks-grace-days" className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>
          Days after deadline
        </Label>
        <Input
          id="perks-grace-days"
          type="number"
          min={0}
          max={90}
          step={1}
          value={graceDays}
          onChange={(e) => setGraceDays(e.target.value)}
          className={FIELD}
        />
        <p className={cn("text-[11px] leading-relaxed", PORTAL_TEXT_MUTED)}>
          Applies to every quiz and homework in this course. Platform default: {platformDefault} day
          {platformDefault !== 1 ? "s" : ""}. Set 0 to close perks at the deadline.
        </p>
      </div>

      <div className={cn("rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3.5 py-3 text-xs", PORTAL_TEXT_MUTED)}>
        <p className={cn("mb-2 flex items-center gap-1.5 text-sm font-medium", PORTAL_TEXT)}>
          <Timer className="h-3.5 w-3.5" />
          Example
        </p>
        <p>
          Deadline Friday 11:59 PM + {isValid ? daysNum : "…"} day grace → perks close{" "}
          {isValid ? (daysNum === 0 ? "at the deadline" : `${daysNum} day${daysNum !== 1 ? "s" : ""} later`) : "…"}
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={() => void handleSave()}
        disabled={saving || !isValid}
        className={cn("h-9 gap-2 rounded-lg", bare ? chrome.cta : "rounded-xl gap-2")}
      >
        {saving ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : <Save className="h-4 w-4" />}
        Save grace period
      </Button>
    </div>
  )

  if (bare) return body

  return (
    <InstructorPolicySurfaceCard
      title="Rollover & retake grace period"
      description="Course-wide rule: after each assessment deadline, membership Extend and unused retakes stay open for this many days, then expire automatically."
    >
      {body}
    </InstructorPolicySurfaceCard>
  )
}
