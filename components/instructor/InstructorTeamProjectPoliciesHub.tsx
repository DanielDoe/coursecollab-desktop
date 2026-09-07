"use client"

import { type ReactNode } from "react"
import { Loader2, Save } from "lucide-react"
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
import { useInstructorCoursePolicies } from "@/components/instructor/useInstructorCoursePolicies"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import type { ProjectPolicy } from "@/lib/course-policy-settings"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
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
  disabled,
}: {
  id: string
  label: string
  hint?: string
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  disabled?: boolean
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
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className={FIELD}
      />
      {hint ? <p className={cn("text-[11px] leading-relaxed", PORTAL_TEXT_MUTED)}>{hint}</p> : null}
    </div>
  )
}

export function InstructorTeamProjectPoliciesHub() {
  const { policies, setPolicies, loading, saving, save } = useInstructorCoursePolicies()
  const chrome = facultyEmbedChrome("team-project-policies")
  const spinner = facultyModuleSpinnerClass("team-project-policies")
  const switchClass = chrome.switchChecked

  if (loading) {
    return <InstructorPolicyLoadingState moduleId="team-project-policies" />
  }

  const p = policies.project_policy

  const patch = (patch: Partial<ProjectPolicy>) =>
    setPolicies((prev) => ({
      ...prev,
      project_policy: { ...prev.project_policy, ...patch },
    }))

  const handleSave = () => void save({ project_policy: p })

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <InstructorPolicySurfaceCard
        className="w-full"
        title="Team & project rules"
        description="Group formation, peer review weight, and late penalties for this course offering."
      >
        <PolicyBlock
          title="Team formation"
          description="How students form teams and acceptable team sizes."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField
              id="min-team"
              label="Minimum team size"
              value={p.min_team_size}
              onChange={(n) => patch({ min_team_size: n })}
              min={1}
              max={20}
            />
            <NumField
              id="max-team"
              label="Maximum team size"
              value={p.max_team_size}
              onChange={(n) => patch({ max_team_size: Math.max(p.min_team_size, n) })}
              min={p.min_team_size}
              max={30}
            />
          </div>

          <InstructorPolicyDividedList>
            <InstructorPolicyToggleRow
              label="Allow self-formed groups"
              hint="Students can create and join teams without instructor assignment."
              checked={p.allow_self_form_groups}
              onCheckedChange={(v) => patch({ allow_self_form_groups: v })}
              switchClass={switchClass}
            />
          </InstructorPolicyDividedList>
        </PolicyBlock>

        <PolicyBlock
          title="Project grading"
          description="Peer review and late submission penalties applied to project deliverables."
        >
          <InstructorPolicyDividedList>
            <InstructorPolicyToggleRow
              label="Require peer review"
              hint="Students evaluate teammates as part of the project grade."
              checked={p.peer_review_required}
              onCheckedChange={(v) => patch({ peer_review_required: v })}
              switchClass={switchClass}
            />
          </InstructorPolicyDividedList>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumField
              id="peer-weight"
              label="Peer review weight (%)"
              hint="Share of the project grade from teammate evaluations."
              value={p.peer_review_weight_percent}
              onChange={(n) => patch({ peer_review_weight_percent: n })}
              min={0}
              max={100}
              disabled={!p.peer_review_required}
            />
            <NumField
              id="late-penalty"
              label="Late penalty per day (%)"
              hint="Deduction applied for each day a project is submitted late."
              value={p.late_project_penalty_percent_per_day}
              onChange={(n) => patch({ late_project_penalty_percent_per_day: n })}
              min={0}
              max={100}
            />
          </div>
        </PolicyBlock>

        <PolicyBlock title="Related">
          <InstructorPolicyDividedList>
            <InstructorAdminQuickLink
              href={`${FACULTY_DASHBOARD_BASE}/management/groups`}
              label="Manage groups"
              description="View teams, memberships, and group assignments"
              variant="row"
            />
            <InstructorAdminQuickLink
              href={`${FACULTY_DASHBOARD_BASE}/management/projects`}
              label="Manage projects"
              description="Milestones, rubrics, and project deliverables"
              variant="row"
            />
          </InstructorPolicyDividedList>
        </PolicyBlock>
      </InstructorPolicySurfaceCard>

      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          Team size {p.min_team_size}–{p.max_team_size} · self-formed {p.allow_self_form_groups ? "yes" : "no"} · peer
          review {p.peer_review_required ? `${p.peer_review_weight_percent}%` : "off"}
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
          Save team & project policies
        </Button>
      </div>
    </div>
  )
}
