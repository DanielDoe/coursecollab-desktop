"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import {
  DEFAULT_UPLOAD_POINTS_MULTIPLIER,
  computeMultiPartPointTotals,
} from "@/lib/multi-part-grading-policy"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const FIELD = cn("h-10 max-w-xs rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)

export function MultiPartGradingSettings({ bare = false }: { bare?: boolean }) {
  const [multiplier, setMultiplier] = useState(String(DEFAULT_UPLOAD_POINTS_MULTIPLIER))
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
        if (data.multi_part_upload_multiplier != null) {
          setMultiplier(String(data.multi_part_upload_multiplier))
        }
      })
      .catch(() =>
        toast({ title: "Error", description: "Failed to load multi-part grading settings", variant: "destructive" }),
      )
      .finally(() => setLoading(false))
  }, [toast])

  const multNum = parseFloat(multiplier)
  const isValid = Number.isFinite(multNum) && multNum > 0
  const example3 = computeMultiPartPointTotals(3, isValid ? multNum : DEFAULT_UPLOAD_POINTS_MULTIPLIER)
  const example4 = computeMultiPartPointTotals(4, isValid ? multNum : DEFAULT_UPLOAD_POINTS_MULTIPLIER)

  const handleSave = async () => {
    if (!isValid) {
      toast({ title: "Invalid multiplier", description: "Enter a number greater than zero.", variant: "destructive" })
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
        body: JSON.stringify({ multi_part_upload_multiplier: multNum }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Save failed")
      }
      toast({ title: "Saved", description: "Multi-part upload multiplier updated for this course." })
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
        <Label htmlFor="mp-upload-mult" className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>
          Upload points multiplier
        </Label>
        <Input
          id="mp-upload-mult"
          type="number"
          min={0.01}
          step={0.1}
          value={multiplier}
          onChange={(e) => setMultiplier(e.target.value)}
          className={FIELD}
        />
        <p className={cn("text-[11px] leading-relaxed", PORTAL_TEXT_MUTED)}>
          Default is 2 (upload max = 2× part count). Must be greater than zero.
        </p>
      </div>

      <div className={cn("rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3.5 py-3 text-xs", PORTAL_TEXT_MUTED)}>
        <p className={cn("mb-2 text-sm font-medium", PORTAL_TEXT)}>Examples</p>
        <p>3 parts → MCQ 3 + Upload {example3.upload} = {example3.total} pts</p>
        <p>4 parts → MCQ 4 + Upload {example4.upload} = {example4.total} pts</p>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={() => void handleSave()}
        disabled={saving || !isValid}
        className={cn("h-9 gap-2 rounded-lg", bare ? chrome.cta : "rounded-xl gap-2")}
      >
        {saving ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : <Save className="h-4 w-4" />}
        Save multiplier
      </Button>
    </div>
  )

  if (bare) return body

  return (
    <InstructorPolicySurfaceCard
      title="Multi-part question grading"
      description="Each MCQ sub-part earns 1 point when correct. Uploaded work earns multiplier × number of parts points (instructor rubric)."
    >
      {body}
    </InstructorPolicySurfaceCard>
  )
}
