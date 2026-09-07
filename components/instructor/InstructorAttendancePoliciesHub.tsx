"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  InstructorAdminQuickLink,
  InstructorPolicyDividedList,
  InstructorPolicySurfaceCard,
  InstructorPolicyToggleRow,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { useInstructorCoursePolicies } from "@/components/instructor/useInstructorCoursePolicies"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import type { AttendancePolicy } from "@/lib/course-policy-settings"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const FIELD = cn("h-10 rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)
const TEXTAREA = cn("min-h-[6.5rem] rounded-lg border shadow-none resize-y", CC_FIELD.base, CC_FIELD.focus)

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

export function InstructorAttendancePoliciesHub() {
  const { policies, setPolicies, loading, saving, save } = useInstructorCoursePolicies()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [sessionCount, setSessionCount] = useState(0)
  const chrome = facultyEmbedChrome("attendance-policies")
  const spinner = facultyModuleSpinnerClass("attendance-policies")
  const switchClass = chrome.switchChecked

  useEffect(() => {
    const instructorId = localStorage.getItem("instructorId")
    if (!instructorId) return
    void fetch(`/api/attendance/sessions?instructorId=${instructorId}`, {
      headers: buildInstructorApiHeaders(),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSessionCount((data?.sessions ?? []).length))
      .catch(() => setSessionCount(0))
  }, [courseScopeVersion])

  if (loading) {
    return <InstructorPolicyLoadingState moduleId="attendance-policies" />
  }

  const p = policies.attendance_policy

  const patch = (patch: Partial<AttendancePolicy>) =>
    setPolicies((prev) => ({
      ...prev,
      attendance_policy: { ...prev.attendance_policy, ...patch },
    }))

  const handleSave = () => void save({ attendance_policy: p })

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <InstructorPolicySurfaceCard
        className="w-full"
        title="Attendance policy"
        description={`Defaults for sessions, thresholds, and excused absences.${sessionCount > 0 ? ` ${sessionCount} session${sessionCount === 1 ? "" : "s"} recorded for this course.` : ""}`}
      >
        <PolicyBlock
          title="Requirements"
          description="Course-wide attendance expectations shown to students and used in grade reports."
        >
          <NumField
            id="min-attendance"
            label="Minimum attendance (%)"
            hint="Students below this threshold may be flagged in attendance reports."
            value={p.minimum_attendance_percent}
            onChange={(n) => patch({ minimum_attendance_percent: n })}
            min={0}
            max={100}
          />
        </PolicyBlock>

        <PolicyBlock
          title="Session defaults"
          description="Applied when you create new attendance sessions."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <NumField
              id="late-grace"
              label="Late arrival grace (minutes)"
              hint="Check-ins within this window count as on time."
              value={p.late_arrival_grace_minutes}
              onChange={(n) => patch({ late_arrival_grace_minutes: n })}
              min={0}
              max={120}
            />
            <NumField
              id="qr-expiry"
              label="QR code expiry (minutes)"
              hint="How long session QR codes stay valid."
              value={p.qr_expiry_minutes_default}
              onChange={(n) => patch({ qr_expiry_minutes_default: n })}
              min={1}
              max={240}
            />
            <NumField
              id="radius"
              label="Location radius (meters)"
              hint="GPS check-in must fall within this distance."
              value={p.radius_meters_default}
              onChange={(n) => patch({ radius_meters_default: n })}
              min={10}
              max={5000}
            />
          </div>

          <InstructorPolicyDividedList>
            <InstructorPolicyToggleRow
              label="Require location by default"
              hint="New sessions prompt for GPS verification when enabled."
              checked={p.require_location_default}
              onCheckedChange={(v) => patch({ require_location_default: v })}
              switchClass={switchClass}
            />
          </InstructorPolicyDividedList>
        </PolicyBlock>

        <PolicyBlock
          title="Excused absences"
          description="Share how students should request excused absences and what documentation you require."
        >
          <Textarea
            id="excused-notes"
            rows={4}
            placeholder="e.g. Email the instructor before the session with documentation for medical or university-sanctioned absences…"
            value={p.excused_absence_notes}
            onChange={(e) => patch({ excused_absence_notes: e.target.value })}
            className={TEXTAREA}
          />
        </PolicyBlock>

        <PolicyBlock
          title="Rankings privacy"
          description="When enabled, students only see their own name on the attendance leaderboard. Leave off when the roster has agreed to share names for rankings."
        >
          <InstructorPolicyDividedList>
            <InstructorPolicyToggleRow
              label="Blur peer names on ranks"
              hint="Hides classmates' names on the student attendance leaderboard (FERPA)."
              checked={p.blur_leaderboard_peer_names}
              onCheckedChange={(v) => patch({ blur_leaderboard_peer_names: v })}
              switchClass={switchClass}
            />
          </InstructorPolicyDividedList>
        </PolicyBlock>

        <PolicyBlock title="Related">
          <InstructorPolicyDividedList>
            <InstructorAdminQuickLink
              href={`${FACULTY_DASHBOARD_BASE}/assessments/attendance`}
              label="Open Attendance"
              description="Record sessions, QR codes, and student check-ins"
              variant="row"
            />
            <InstructorAdminQuickLink
              href={`${FACULTY_DASHBOARD_BASE}/administration/grading-policies`}
              label="Grade weights"
              description="Set how attendance counts toward the final grade"
              variant="row"
            />
          </InstructorPolicyDividedList>
        </PolicyBlock>
      </InstructorPolicySurfaceCard>

      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          {p.require_location_default ? "Location on" : "Location off"} · {p.qr_expiry_minutes_default}m QR ·{" "}
          {p.late_arrival_grace_minutes}m grace
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
          Save attendance policy
        </Button>
      </div>
    </div>
  )
}
