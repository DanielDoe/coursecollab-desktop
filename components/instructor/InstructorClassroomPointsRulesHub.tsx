"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, type ReactNode } from "react"
import { Code, Loader2, PenLine, Save, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  InstructorAdminQuickLink,
  InstructorPolicyDividedList,
  InstructorPolicySurfaceCard,
  InstructorPolicyToggleRow,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { useToast } from "@/components/ui/use-toast"
import { useInstructorCoursePolicies } from "@/components/instructor/useInstructorCoursePolicies"
import { classroomRawPointsToGradePoints10 } from "@/lib/classroom-points-grade-scale"
import { classroomSubmissionBlocksLabel, type RewardsPolicy } from "@/lib/course-policy-settings"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_OUTLINE_BTN, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const FIELD = cn("h-10 rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)

function PolicyBlock({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-4 border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0">
      <div>
        <h4 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</h4>
        {description ? <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

function NumField({
  id,
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  id: string
  label: string
  hint?: string
  value: number
  onChange: (n: number) => void
  min: number
  max: number
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className={FIELD}
      />
      {hint ? <p className={cn("text-[11px] leading-relaxed", PORTAL_TEXT_MUTED)}>{hint}</p> : null}
    </div>
  )
}

const BLOCK_PRESETS = [
  {
    id: "code",
    label: "Code only",
    icon: Code,
    patch: { show_code_assignments: true, show_solution_assignments: false },
    active: (p: RewardsPolicy) => p.show_code_assignments && !p.show_solution_assignments,
  },
  {
    id: "solution",
    label: "Solution only",
    icon: PenLine,
    patch: { show_code_assignments: false, show_solution_assignments: true },
    active: (p: RewardsPolicy) => !p.show_code_assignments && p.show_solution_assignments,
  },
  {
    id: "both",
    label: "Both blocks",
    icon: null,
    patch: { show_code_assignments: true, show_solution_assignments: true },
    active: (p: RewardsPolicy) => p.show_code_assignments && p.show_solution_assignments,
  },
] as const

export function InstructorClassroomPointsRulesHub({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast()
  const { policies, setPolicies, loading, saving, save } = useInstructorCoursePolicies()
  const [backfilling, setBackfilling] = useState(false)
  const moduleId = embedded ? "classroom-points" : "classroom-points-rules"
  const chrome = facultyEmbedChrome(moduleId)
  const spinner = facultyModuleSpinnerClass(moduleId)
  const switchClass = chrome.switchChecked

  if (loading) {
    return <InstructorPolicyLoadingState moduleId={moduleId} />
  }

  const p = policies.rewards_policy
  const pointsForFullGrade = p.points_for_full_grade
  const gradeSlice = classroomRawPointsToGradePoints10(pointsForFullGrade, pointsForFullGrade).toFixed(1)
  const submissionBlocksLabel = classroomSubmissionBlocksLabel(p)

  const patch = (patch: Partial<RewardsPolicy>) =>
    setPolicies((prev) => ({
      ...prev,
      rewards_policy: { ...prev.rewards_policy, ...patch },
    }))

  const handleSave = () => void save({ rewards_policy: p })

  const runAiFeedbackBackfill = async () => {
    setBackfilling(true)
    try {
      const instructorId =
        typeof window !== "undefined" ? sessionStorage.getItem("instructorId") : null
      const res = await instructorApiFetch("/api/instructor/classroom-points/bulk-ai-evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(instructorId ? { "x-instructor-id": instructorId } : {}),
        },
        body: JSON.stringify({
          status: "all",
          skipWithFeedback: true,
          preserveApprovedPoints: true,
          limit: 25,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Backfill failed")
      toast({
        title: "AI feedback backfill complete",
        description: data.message ?? `Evaluated ${data.summary?.evaluated ?? 0} submissions`,
      })
    } catch (e) {
      toast({
        title: "Backfill failed",
        description: e instanceof Error ? e.message : "Could not run AI evaluation",
        variant: "destructive",
      })
    } finally {
      setBackfilling(false)
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <InstructorPolicySurfaceCard
        className="w-full"
        title={embedded ? "Configuration" : "Classroom points rules"}
        description={
          embedded
            ? "Grade mapping, student panels, automation, and integrity settings for this course."
            : `${pointsForFullGrade} pts for full grade (${gradeSlice}/10 slice) · ${p.max_daily_submission_points} daily cap · ${submissionBlocksLabel}`
        }
      >
        <PolicyBlock
          title="Grade mapping"
          description="How raw classroom points translate to the gradebook slice."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField
              id="full-grade-pts"
              label="Raw points for full classroom grade"
              hint={`At ${p.points_for_full_grade} raw points, students earn the full 10-point classroom slice.`}
              value={p.points_for_full_grade}
              onChange={(n) => patch({ points_for_full_grade: n })}
              min={1}
              max={10000}
            />
            <NumField
              id="daily-cap"
              label="Max daily submission points"
              hint="Caps how many points a student can earn from submissions per day."
              value={p.max_daily_submission_points}
              onChange={(n) => patch({ max_daily_submission_points: n })}
              min={0}
              max={1000}
            />
          </div>
        </PolicyBlock>

        <PolicyBlock
          title="Student submission blocks"
          description="Choose which assignment types appear on the student classroom points page."
        >
          <div className="flex flex-wrap gap-1.5">
            {BLOCK_PRESETS.map(({ id, label, icon: Icon, patch: presetPatch, active }) => {
              const isActive = active(p)
              return (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-auto gap-1.5 rounded-lg px-3 py-2",
                    isActive ? chrome.solid : chrome.quiet,
                  )}
                  onClick={() => patch(presetPatch)}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {label}
                </Button>
              )
            })}
          </div>

          <InstructorPolicyDividedList>
            <InstructorPolicyToggleRow
              label="Show Code Assignments block"
              hint="Programming submissions with the in-page editor (typical for ELEG-style courses)."
              checked={p.show_code_assignments}
              onCheckedChange={(v) => patch({ show_code_assignments: v })}
              switchClass={switchClass}
            />
            <InstructorPolicyToggleRow
              label="Show Solution Assignments block"
              hint="PDF, photo, or ink workspace submissions for worked solutions (typical for ECE2202-style courses)."
              checked={p.show_solution_assignments}
              onCheckedChange={(v) => patch({ show_solution_assignments: v })}
              switchClass={switchClass}
            />
          </InstructorPolicyDividedList>
        </PolicyBlock>

        <PolicyBlock
          title="Automation & integrity"
          description="AI approval, student access, and duplicate detection defaults."
        >
          <InstructorPolicyDividedList>
            <InstructorPolicyToggleRow
              label="Blur peer names on student leaderboard (FERPA)"
              hint="When on, students only see their own name and points. Turn off only with institutional FERPA release."
              checked={p.blur_leaderboard_peer_names}
              onCheckedChange={(v) => patch({ blur_leaderboard_peer_names: v })}
              switchClass={switchClass}
            />
            <InstructorPolicyToggleRow
              label="Allow student assignments (code & solutions)"
              hint="Students can submit participation work for points."
              checked={p.allow_student_submissions}
              onCheckedChange={(v) => patch({ allow_student_submissions: v })}
              switchClass={switchClass}
            />
            <InstructorPolicyToggleRow
              label="Auto-approve classroom submissions (AI)"
              hint="AI evaluates submissions, shows feedback, and awards points immediately when the score qualifies."
              checked={p.auto_approve_submissions}
              onCheckedChange={(v) => patch({ auto_approve_submissions: v })}
              switchClass={switchClass}
            />
            <InstructorPolicyToggleRow
              label="Auto-approve Practice Hub uploads (AI)"
              hint="AI grades circuit and multi-part practice uploads and credits qualifying attempts immediately."
              checked={p.auto_approve_practice_submissions}
              onCheckedChange={(v) => patch({ auto_approve_practice_submissions: v })}
              switchClass={switchClass}
            />
            <InstructorPolicyToggleRow
              label="Duplicate detection"
              hint="Flag similar submissions across students."
              checked={p.duplicate_detection_enabled}
              onCheckedChange={(v) => patch({ duplicate_detection_enabled: v })}
              switchClass={switchClass}
            />
          </InstructorPolicyDividedList>
        </PolicyBlock>

        <PolicyBlock
          title="AI feedback backfill"
          description="Evaluate up to 25 existing submissions that do not yet have AI feedback. Approved points are preserved; run again to process the next batch."
        >
          <Button
            type="button"
            variant="outline"
            disabled={backfilling}
            onClick={() => void runAiFeedbackBackfill()}
            className={cn("h-9 gap-2 rounded-lg", embedded ? chrome.quiet : PORTAL_OUTLINE_BTN)}
          >
            {backfilling ? (
              <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {backfilling ? "Running AI feedback…" : "Run AI feedback on existing submissions"}
          </Button>
        </PolicyBlock>

        <PolicyBlock title="Related">
          <InstructorPolicyDividedList>
            {!embedded ? (
              <InstructorAdminQuickLink
                href={`${FACULTY_DASHBOARD_BASE}/assessments/classroom-points`}
                label="Open Classroom Points"
                description="Award points, review submissions, and export portfolios"
                variant="row"
              />
            ) : null}
            <InstructorAdminQuickLink
              href={`${FACULTY_DASHBOARD_BASE}/administration/grading-policies`}
              label="Grade weights"
              description="Adjust the classroom category weight in the final grade"
              variant="row"
            />
          </InstructorPolicyDividedList>
        </PolicyBlock>
      </InstructorPolicySurfaceCard>

      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          {p.auto_approve_submissions ? "Classroom AI on" : "Classroom AI off"} ·{" "}
          {p.auto_approve_practice_submissions ? "Practice AI on" : "Practice AI off"} · {submissionBlocksLabel}
        </p>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          className={cn("h-9 gap-2 rounded-lg", chrome.cta)}
          onClick={handleSave}
        >
          {saving ? (
            <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save {embedded ? "configuration" : "classroom points rules"}
        </Button>
      </div>
    </div>
  )
}
