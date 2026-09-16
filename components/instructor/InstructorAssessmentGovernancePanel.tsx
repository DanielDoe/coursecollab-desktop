"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Loader2, Save, Shield, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import {
  InstructorPolicyDividedList,
  InstructorPolicySurfaceCard,
  InstructorPolicyToggleRow,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { portalListStripe } from "@/lib/portal-module-themes"
import {
  type AssessmentPrivilegeSource,
  assessmentPrivilegeSourceLabel,
  membershipAssessmentBenefitsAllowed,
  tradeCenterAssessmentBenefitsAllowed,
} from "@/lib/assessment-privilege-governance-shared"
import {
  DEFAULT_ASSESSMENT_PLATFORM_ACCESS,
  parseAssessmentPlatformAccess,
  type AssessmentPlatformAccess,
  type AssessmentPlatformKind,
} from "@/lib/assessment-platform-access"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const PLATFORM_KIND_ROWS: Array<{ kind: AssessmentPlatformKind; label: string }> = [
  { kind: "quiz", label: "Quizzes" },
  { kind: "homework", label: "Homework" },
  { kind: "mid_semester", label: "Mid-semester exams" },
  { kind: "final", label: "Final exams" },
]

const SOURCE_OPTIONS: Array<{
  value: AssessmentPrivilegeSource
  title: string
  description: string
}> = [
  {
    value: "instructor_only",
    title: "Instructor controlled only",
    description:
      "All assessment policies follow instructor settings. Membership perks cannot modify quiz attempts, homework attempts, retakes, extensions, late passes, or exam access.",
  },
  {
    value: "membership_enabled",
    title: "Membership enabled",
    description:
      "Explorer and Trailblazer membership benefits may grant additional assessment opportunities (retakes, save-and-finish, rollovers) per platform rules.",
  },
  {
    value: "hybrid",
    title: "Hybrid",
    description:
      "Assessment opportunities may come from instructor settings, membership benefits, and Trade Center redemptions. Instructor may still configure limits on each assessment.",
  },
]

export function InstructorAssessmentGovernancePanel() {
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const chrome = facultyEmbedChrome("assessment-governance")
  const spinner = facultyModuleSpinnerClass("assessment-governance")
  const switchClass = chrome.switchChecked

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [courseLabel, setCourseLabel] = useState("")
  const [source, setSource] = useState<AssessmentPrivilegeSource>("instructor_only")
  const [showNotice, setShowNotice] = useState(true)
  const [studentsImpacted, setStudentsImpacted] = useState(0)
  const [platformAccess, setPlatformAccess] = useState<AssessmentPlatformAccess>(
    DEFAULT_ASSESSMENT_PLATFORM_ACCESS,
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/courses/assessment-governance", {
        headers: buildInstructorApiHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setCourseLabel(data.course_label ?? "")
      setSource(data.assessment_privilege_source ?? "instructor_only")
      setShowNotice(data.show_course_policy_notice !== false)
      setStudentsImpacted(Number(data.students_impacted) || 0)
      setPlatformAccess(parseAssessmentPlatformAccess(data.platform_access))
    } catch (e) {
      toast({
        title: "Could not load governance settings",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load, courseScopeVersion])

  const save = async () => {
    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/courses/assessment-governance", {
        method: "PATCH",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_privilege_source: source,
          show_course_policy_notice: showNotice,
          platform_access: platformAccess,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      toast({ title: "Assessment governance saved" })
      setStudentsImpacted(Number(data.students_impacted) || 0)
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <InstructorPolicyLoadingState
        moduleId="assessment-governance"
        label="Loading assessment governance…"
      />
    )
  }

  const membershipEnabled = membershipAssessmentBenefitsAllowed(source)
  const tradeEnabled = tradeCenterAssessmentBenefitsAllowed(source)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <InstructorPolicySurfaceCard
        variant="section"
        title="Privilege source"
        description={
          courseLabel
            ? `How assessment opportunities are granted for ${courseLabel}.`
            : "How assessment opportunities are granted for your selected course."
        }
      >
        <InstructorPolicyDividedList>
          {SOURCE_OPTIONS.map((opt, index) => {
            const selected = source === opt.value
            const stripe = portalListStripe(index, chrome.theme.family)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSource(opt.value)}
                className={cn(
                  "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors sm:gap-3.5 sm:px-3.5 sm:py-3.5",
                  "hover:bg-[var(--cc-accent-soft)]/45",
                  selected && "bg-[var(--muted)]/35",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                    selected ? stripe.iconBg : "bg-[var(--muted)]/50",
                    selected ? stripe.iconText : "text-[var(--cc-text-muted)]",
                  )}
                >
                  <Shield className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{opt.title}</p>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-[var(--cc-accent-dark)]" aria-hidden />
                    ) : null}
                  </div>
                  <p className={cn("mt-1 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{opt.description}</p>
                </div>
              </button>
            )
          })}
        </InstructorPolicyDividedList>

        {membershipEnabled ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3.5 py-2.5">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", chrome.p.softBg, chrome.p.iconText)}>
              <Users className="h-4 w-4" aria-hidden />
            </span>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              <span className={cn("font-medium", PORTAL_TEXT)}>{studentsImpacted}</span> enrolled students may
              receive membership-based assessment perks under this mode.
            </p>
          </div>
        ) : null}
      </InstructorPolicySurfaceCard>

      <InstructorPolicySurfaceCard
        variant="section"
        title="Where students may take assessments"
        description="Course default for each assessment type. You can override these on an individual quiz, homework, or exam."
      >
        <InstructorPolicyDividedList>
          {PLATFORM_KIND_ROWS.map(({ kind, label }) => (
            <InstructorPolicyToggleRow
              key={kind}
              label={`${label} on mobile`}
              hint={
                platformAccess[kind].mobile
                  ? "Students can start this type in the CourseCollab app."
                  : "Students must take this type on the CourseCollab website."
              }
              checked={platformAccess[kind].mobile}
              onCheckedChange={(next) =>
                setPlatformAccess((prev) => ({
                  ...prev,
                  [kind]: { ...prev[kind], mobile: next },
                }))
              }
              switchClass={switchClass}
            />
          ))}
        </InstructorPolicyDividedList>
      </InstructorPolicySurfaceCard>

      <InstructorPolicySurfaceCard variant="section" title="Student visibility" description="Optional notice on the student course dashboard.">
        <InstructorPolicyDividedList>
          <InstructorPolicyToggleRow
            label="Show course policy notice"
            hint="Compact card explaining instructor-controlled assessment policies."
            checked={showNotice}
            onCheckedChange={setShowNotice}
            switchClass={switchClass}
          />
        </InstructorPolicyDividedList>
      </InstructorPolicySurfaceCard>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          {assessmentPrivilegeSourceLabel(source)}
          {membershipEnabled ? ` · ${studentsImpacted} students` : ""}
          {tradeEnabled ? " · Trade Center on" : ""}
        </p>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          className={cn("h-9 gap-2 rounded-lg", chrome.cta)}
          onClick={() => void save()}
        >
          {saving ? (
            <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save governance
        </Button>
      </div>
    </div>
  )
}
