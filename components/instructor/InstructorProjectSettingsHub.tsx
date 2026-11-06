"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  Bot,
  FileText,
  FolderCog,
  Loader2,
  Presentation,
  Save,
  Scale,
  Shield,
  Sparkles,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
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
import {
  DEFAULT_PROJECT_MODULE_DEFAULTS,
  type ProjectModuleDefaults,
} from "@/lib/course-policy-settings"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type Section = "defaults" | "grading" | "report" | "integrity" | "presentation"

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "defaults", label: "New setups", icon: FolderCog },
  { id: "grading", label: "Grading mix", icon: Scale },
  { id: "report", label: "Report & submit", icon: FileText },
  { id: "integrity", label: "Integrity & Cora", icon: Shield },
  { id: "presentation", label: "Presentation", icon: Presentation },
]

const FIELD = cn("h-10 rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)

function NumField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  disabled,
}: {
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
      <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>{label}</Label>
      <Input
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

function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>{title}</p>
      <InstructorPolicyDividedList>{children}</InstructorPolicyDividedList>
    </div>
  )
}

export function InstructorProjectSettingsHub() {
  const [section, setSection] = useState<Section>("defaults")
  const chrome = facultyEmbedChrome("project-settings")
  const spinner = facultyModuleSpinnerClass("project-settings")
  const { policies, setPolicies, loading, saving, save } = useInstructorCoursePolicies()

  const d = policies.project_policy.module_defaults

  const patchDefaults = (patch: Partial<ProjectModuleDefaults>) =>
    setPolicies((prev) => ({
      ...prev,
      project_policy: {
        ...prev.project_policy,
        module_defaults: { ...prev.project_policy.module_defaults, ...patch },
      },
    }))

  const applyLegacy50 = () =>
    patchDefaults({
      max_points: 50,
      voting_enabled: true,
      instructor_grading_enabled: true,
      ai_grading_enabled: false,
      voting_weight_percent: 60,
      instructor_weight_percent: 40,
      ai_weight_percent: 0,
      instructor_ai_assist: false,
      show_leaderboard: true,
      submission_mode: "FREEFORM_SUBMISSION",
    })

  const applyInstructorOnly = () =>
    patchDefaults({
      max_points: 100,
      voting_enabled: false,
      instructor_grading_enabled: true,
      ai_grading_enabled: false,
      voting_weight_percent: 0,
      instructor_weight_percent: 100,
      ai_weight_percent: 0,
      instructor_ai_assist: true,
    })

  const applyStructuredCapstone = () =>
    patchDefaults({
      max_points: 100,
      project_mode: "group",
      voting_enabled: false,
      instructor_grading_enabled: true,
      ai_grading_enabled: false,
      instructor_weight_percent: 100,
      submission_mode: "STRUCTURED_REPORT",
      confirmation_mode: "ALL_MEMBERS",
      require_citations: true,
      presentation_required: true,
      demo_required: true,
      presentation_duration_minutes: 15,
      cora_policy: "guided",
    })

  const enabledCount = [d.voting_enabled, d.instructor_grading_enabled, d.ai_grading_enabled].filter(Boolean).length
  const weightTotal =
    (d.voting_enabled ? d.voting_weight_percent : 0) +
    (d.instructor_grading_enabled ? d.instructor_weight_percent : 0) +
    (d.ai_grading_enabled ? d.ai_weight_percent : 0)

  const metaLine = useMemo(() => {
    switch (section) {
      case "defaults":
        return `${d.project_mode === "group" ? "Group" : "Individual"} · ${d.max_points} pts · ${d.counts_toward_course_grade ? "in gradebook" : "not in gradebook"}`
      case "grading": {
        const bits = [
          d.voting_enabled ? "voting" : null,
          d.instructor_grading_enabled ? "instructor" : null,
          d.ai_grading_enabled ? "AI" : null,
        ].filter(Boolean)
        return bits.length ? bits.join(" + ") : "No grading source selected"
      }
      case "report":
        return d.submission_mode === "STRUCTURED_REPORT" ? "Structured report default" : "Freeform default"
      case "integrity":
        return `Cora ${d.cora_policy} · paste ${d.copy_paste}${d.strict_mode ? " · strict" : ""}`
      case "presentation":
        return d.presentation_required
          ? `Presentation ${d.presentation_duration_minutes} min${d.demo_required ? " + demo" : ""}`
          : "Presentation optional"
      default:
        return "Course-wide project defaults"
    }
  }, [section, d])

  if (loading) {
    return <InstructorPolicyLoadingState moduleId="project-settings" />
  }

  const switchClass = chrome.switchChecked
  const handleSave = () => void save({ project_policy: policies.project_policy })

  return (
    <FacultyModuleSplitLayout
      menuWidthClass="lg:w-52 xl:w-56"
      menu={
        <FacultyModuleSideMenu
          moduleId="project-settings"
          title="Project settings"
          activeId={section}
          onSelect={(id) => setSection(id as Section)}
          items={SECTIONS.map(({ id, label, icon }) => ({ id, label, icon }))}
          accent="theme"
        />
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{metaLine}</p>

        {section === "defaults" ? (
          <InstructorPolicySurfaceCard
            variant="section"
            title="What new project configurations inherit"
            description="Applied when you create a setup. Existing projects and presets you pick in the dialog stay as chosen."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Default project mode</Label>
                <Select
                  value={d.project_mode}
                  onValueChange={(v) => patchDefaults({ project_mode: v as ProjectModuleDefaults["project_mode"] })}
                >
                  <SelectTrigger className={FIELD}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group">Group workspace</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumField
                label="Default max points"
                hint="50 matches current CourseCollab projects; 100 is typical for reports."
                value={d.max_points}
                onChange={(n) => patchDefaults({ max_points: n })}
                min={1}
                max={1000}
              />
            </div>
            <SettingGroup title="Gradebook">
              <InstructorPolicyToggleRow
                label="Count toward course grade"
                hint="New setups push scores to the gradebook unless you turn this off per project."
                checked={d.counts_toward_course_grade}
                onCheckedChange={(v) => patchDefaults({ counts_toward_course_grade: v })}
                switchClass={switchClass}
              />
              <InstructorPolicyToggleRow
                label="Show report-progress matrix"
                hint="Faculty Manage Projects shows group × section completion when structured reports are used."
                checked={d.show_report_progress}
                onCheckedChange={(v) => patchDefaults({ show_report_progress: v })}
                switchClass={switchClass}
              />
            </SettingGroup>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className={chrome.quiet} onClick={applyLegacy50}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Match current 50-pt projects
              </Button>
              <Button type="button" size="sm" className={chrome.quiet} onClick={applyInstructorOnly}>
                Instructor-only 100
              </Button>
              <Button type="button" size="sm" className={chrome.quiet} onClick={applyStructuredCapstone}>
                Structured capstone
              </Button>
              <Button
                type="button"
                size="sm"
                className={chrome.quiet}
                onClick={() => patchDefaults({ ...DEFAULT_PROJECT_MODULE_DEFAULTS })}
              >
                Reset defaults
              </Button>
            </div>
          </InstructorPolicySurfaceCard>
        ) : null}

        {section === "grading" ? (
          <InstructorPolicySurfaceCard
            variant="section"
            title="Default grading sources"
            description="Three independent sources. At least one must be on. Weights apply when more than one is enabled."
          >
            <SettingGroup title="Sources">
              <InstructorPolicyToggleRow
                label="Student voting"
                hint="Stars / leaderboard. Existing 50-pt projects use this at 60%."
                checked={d.voting_enabled}
                onCheckedChange={(v) => {
                  if (!v && !d.instructor_grading_enabled && !d.ai_grading_enabled) return
                  patchDefaults({ voting_enabled: v })
                }}
                switchClass={switchClass}
              />
              <InstructorPolicyToggleRow
                label="Instructor grading"
                hint="You score with the rubric. Independent from AI grading."
                checked={d.instructor_grading_enabled}
                onCheckedChange={(v) => {
                  if (!v && !d.voting_enabled && !d.ai_grading_enabled) return
                  patchDefaults({ instructor_grading_enabled: v })
                }}
                switchClass={switchClass}
              />
              <InstructorPolicyToggleRow
                label="AI grading"
                hint="AI produces its own grade source — not the same as the instructor assistant."
                checked={d.ai_grading_enabled}
                onCheckedChange={(v) => {
                  if (!v && !d.voting_enabled && !d.instructor_grading_enabled) return
                  patchDefaults({ ai_grading_enabled: v, instructor_ai_assist: v ? false : d.instructor_ai_assist })
                }}
                switchClass={switchClass}
              />
            </SettingGroup>
            {enabledCount > 1 ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {d.voting_enabled ? (
                  <NumField
                    label="Voting weight %"
                    value={d.voting_weight_percent}
                    onChange={(n) => patchDefaults({ voting_weight_percent: n })}
                    min={0}
                    max={100}
                  />
                ) : null}
                {d.instructor_grading_enabled ? (
                  <NumField
                    label="Instructor weight %"
                    value={d.instructor_weight_percent}
                    onChange={(n) => patchDefaults({ instructor_weight_percent: n })}
                    min={0}
                    max={100}
                  />
                ) : null}
                {d.ai_grading_enabled ? (
                  <NumField
                    label="AI weight %"
                    value={d.ai_weight_percent}
                    onChange={(n) => patchDefaults({ ai_weight_percent: n })}
                    min={0}
                    max={100}
                  />
                ) : null}
              </div>
            ) : (
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>One source on — it counts as 100% of the project grade.</p>
            )}
            {enabledCount > 1 ? (
              <p className={cn("text-xs font-medium", Math.abs(weightTotal - 100) > 0.01 ? "text-destructive" : PORTAL_TEXT_MUTED)}>
                Total: {weightTotal.toFixed(0)}%
              </p>
            ) : null}
            {d.instructor_grading_enabled && !d.ai_grading_enabled ? (
              <SettingGroup title="Instructor tools">
                <InstructorPolicyToggleRow
                  label="AI grading assistant"
                  hint="Suggests scores; only the instructor grade counts toward the Instructor component."
                  checked={d.instructor_ai_assist}
                  onCheckedChange={(v) => patchDefaults({ instructor_ai_assist: v })}
                  switchClass={switchClass}
                />
              </SettingGroup>
            ) : null}
            {d.voting_enabled ? (
              <SettingGroup title="Peer voting">
                <InstructorPolicyToggleRow
                  label="Show leaderboard"
                  checked={d.show_leaderboard}
                  onCheckedChange={(v) => patchDefaults({ show_leaderboard: v })}
                  switchClass={switchClass}
                />
                <InstructorPolicyToggleRow
                  label="Anonymous votes"
                  checked={d.anonymous_votes}
                  onCheckedChange={(v) => patchDefaults({ anonymous_votes: v })}
                  switchClass={switchClass}
                />
              </SettingGroup>
            ) : null}
          </InstructorPolicySurfaceCard>
        ) : null}

        {section === "report" ? (
          <InstructorPolicySurfaceCard
            variant="section"
            title="Report and submission defaults"
            description="Students still submit one assembled project per group. These only seed new configurations."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Default report style</Label>
                <Select
                  value={d.submission_mode}
                  onValueChange={(v) =>
                    patchDefaults({ submission_mode: v as ProjectModuleDefaults["submission_mode"] })
                  }
                >
                  <SelectTrigger className={FIELD}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREEFORM_SUBMISSION">Freeform deliverable</SelectItem>
                    <SelectItem value="STRUCTURED_REPORT">Structured group report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Who must confirm submit</Label>
                <Select
                  value={d.confirmation_mode}
                  onValueChange={(v) =>
                    patchDefaults({ confirmation_mode: v as ProjectModuleDefaults["confirmation_mode"] })
                  }
                >
                  <SelectTrigger className={FIELD}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONE_MEMBER">Any one member</SelectItem>
                    <SelectItem value="ALL_MEMBERS">All members confirm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SettingGroup title="Workspace">
              <InstructorPolicyToggleRow
                label="Allow resubmissions"
                checked={d.allow_resubmissions}
                onCheckedChange={(v) => patchDefaults({ allow_resubmissions: v })}
                switchClass={switchClass}
              />
              <InstructorPolicyToggleRow
                label="Lock workspace after submit"
                hint="Members can still view; further edits require a resubmission window."
                checked={d.lock_after_submit}
                onCheckedChange={(v) => patchDefaults({ lock_after_submit: v })}
                switchClass={switchClass}
              />
              <InstructorPolicyToggleRow
                label="Require citations"
                hint="Useful for engineering reports; sections can still override."
                checked={d.require_citations}
                onCheckedChange={(v) => patchDefaults({ require_citations: v })}
                switchClass={switchClass}
              />
            </SettingGroup>
          </InstructorPolicySurfaceCard>
        ) : null}

        {section === "integrity" ? (
          <InstructorPolicySurfaceCard
            variant="section"
            title="Integrity and Cora defaults"
            description="Server-enforced. Hiding a button is not enough. Section-level overrides on a setup still win."
          >
            <SettingGroup title="Workspace policy">
              <InstructorPolicyToggleRow
                label="Strict mode by default"
                hint="Tighter paste / focus rules; relax per section (e.g. References)."
                checked={d.strict_mode}
                onCheckedChange={(v) => patchDefaults({ strict_mode: v })}
                switchClass={switchClass}
              />
            </SettingGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Copy / paste</Label>
                <Select
                  value={d.copy_paste}
                  onValueChange={(v) => patchDefaults({ copy_paste: v as ProjectModuleDefaults["copy_paste"] })}
                >
                  <SelectTrigger className={FIELD}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allowed">Allowed</SelectItem>
                    <SelectItem value="tracked">Tracked</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Cora in project sections</Label>
                <Select
                  value={d.cora_policy}
                  onValueChange={(v) => patchDefaults({ cora_policy: v as ProjectModuleDefaults["cora_policy"] })}
                >
                  <SelectTrigger className={FIELD}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="guided">Guided (plan / review / rubric check)</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className={cn("rounded-lg border border-[var(--border)] bg-muted/30 px-4 py-3 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
              Cora must never invent lab results, measurements, citations, or prototype completion. If evidence is
              missing, it should say so.
            </p>
          </InstructorPolicySurfaceCard>
        ) : null}

        {section === "presentation" ? (
          <InstructorPolicySurfaceCard
            variant="section"
            title="Presentation and demo"
            description="Schedules still live in Presentations. These seed whether a new setup requires a live session."
          >
            <SettingGroup title="Requirements">
              <InstructorPolicyToggleRow
                label="Presentation required"
                checked={d.presentation_required}
                onCheckedChange={(v) => patchDefaults({ presentation_required: v })}
                switchClass={switchClass}
              />
              <InstructorPolicyToggleRow
                label="Hardware / software demo required"
                checked={d.demo_required}
                onCheckedChange={(v) => patchDefaults({ demo_required: v })}
                switchClass={switchClass}
              />
            </SettingGroup>
            <div className="max-w-xs">
              <NumField
                label="Default duration (minutes)"
                value={d.presentation_duration_minutes}
                onChange={(n) => patchDefaults({ presentation_duration_minutes: n })}
                min={1}
                max={180}
                disabled={!d.presentation_required && !d.demo_required}
              />
            </div>
          </InstructorPolicySurfaceCard>
        ) : null}

        <InstructorPolicySurfaceCard variant="section" title="Related">
          <InstructorPolicyDividedList>
            <InstructorAdminQuickLink
              href={`${FACULTY_DASHBOARD_BASE}/management/projects`}
              label="Manage projects"
              description="Setups, groups, grading, and presentations"
              variant="row"
            />
            <InstructorAdminQuickLink
              href={`${FACULTY_DASHBOARD_BASE}/administration/team-project-policies`}
              label="Team & project policies"
              description="Group formation and late-penalty course rules"
              variant="row"
            />
          </InstructorPolicyDividedList>
        </InstructorPolicySurfaceCard>

        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            disabled={saving || (enabledCount > 1 && Math.abs(weightTotal - 100) > 0.01)}
            className={cn("h-9 gap-2 rounded-lg", chrome.cta)}
            onClick={handleSave}
          >
            {saving ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : <Save className="h-4 w-4" />}
            Save project settings
          </Button>
        </div>
      </div>
    </FacultyModuleSplitLayout>
  )
}
