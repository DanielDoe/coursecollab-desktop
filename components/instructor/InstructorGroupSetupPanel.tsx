"use client"

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
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const FIELD = cn("h-10 rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)

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

export function InstructorGroupSetupPanel() {
  const { policies, setPolicies, loading, saving, save } = useInstructorCoursePolicies()
  const chrome = facultyEmbedChrome("groups")
  const spinner = facultyModuleSpinnerClass("groups")
  const p = policies.project_policy

  if (loading) {
    return <InstructorPolicyLoadingState moduleId="groups" label="Loading group setup…" />
  }

  const patch = (next: Partial<typeof p>) =>
    setPolicies((prev) => ({
      ...prev,
      project_policy: { ...prev.project_policy, ...next },
    }))

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <InstructorPolicySurfaceCard
        title="Group setup"
        description="How many students can be in a group, and whether they can form teams themselves."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField
            id="group-min"
            label="Minimum members"
            hint="Projects require at least this many students."
            value={p.min_team_size}
            onChange={(n) => patch({ min_team_size: n, max_team_size: Math.max(p.max_team_size, n) })}
            min={1}
            max={20}
          />
          <NumField
            id="group-max"
            label="Maximum members"
            hint="Students cannot add more members than this."
            value={p.max_team_size}
            onChange={(n) => patch({ max_team_size: Math.max(p.min_team_size, n) })}
            min={p.min_team_size}
            max={30}
          />
        </div>

        <InstructorPolicyDividedList>
          <InstructorPolicyToggleRow
            label="Allow students to form groups"
            hint="If off, only you can create or assign groups."
            checked={p.allow_self_form_groups}
            onCheckedChange={(v) => patch({ allow_self_form_groups: v })}
            switchClass={chrome.switchChecked}
          />
        </InstructorPolicyDividedList>

        <InstructorPolicyDividedList>
          <InstructorAdminQuickLink
            href={`${FACULTY_DASHBOARD_BASE}/administration/team-project-policies`}
            label="More team & project policies"
            description="Peer review weight, late penalties, and project defaults"
            variant="row"
          />
        </InstructorPolicyDividedList>
      </InstructorPolicySurfaceCard>

      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          Groups {p.min_team_size}–{p.max_team_size} members · student formation{" "}
          {p.allow_self_form_groups ? "on" : "off"}
        </p>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          className={cn("h-9 gap-2 rounded-lg", chrome.cta)}
          onClick={() => void save({ project_policy: p })}
        >
          {saving ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : <Save className="h-4 w-4" />}
          Save group setup
        </Button>
      </div>
    </div>
  )
}
