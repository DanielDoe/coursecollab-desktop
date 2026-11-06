"use client"

import { Input } from "@/components/ui/input"
import type { CourseProjectAssignmentRecord, ProjectGradingComponent } from "@/lib/projects/project-grading-types"
import {
  applyGradingMethodFlags,
  readGradingMethodFlags,
  type ProjectGradingMethodFlags,
} from "@/lib/projects/project-grading-methods"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import type { FacultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  ProjectFormSwitchPanel,
  ProjectFormSwitchRow,
  projectFormInputClass,
} from "@/components/instructor/projects/project-form-ui"

function weightTotal(components: ProjectGradingComponent[]) {
  return components.filter((c) => c.enabled).reduce((s, c) => s + (Number(c.weight_percent) || 0), 0)
}

export function ProjectGradingMethodSelector({
  value,
  onChange,
  disabled,
  chrome: chromeProp,
}: {
  value: CourseProjectAssignmentRecord
  onChange: (next: CourseProjectAssignmentRecord) => void
  disabled?: boolean
  chrome?: FacultyEmbedChrome
}) {
  const chrome = chromeProp ?? facultyEmbedChrome("projects")
  const flags = readGradingMethodFlags(value)
  const enabledMethods = [flags.studentVoting, flags.instructorGrading, flags.aiGrading].filter(Boolean).length
  const total = weightTotal(value.grading_components)

  const setFlags = (partial: Partial<ProjectGradingMethodFlags>) => {
    const nextFlags = { ...flags, ...partial }
    if (!nextFlags.studentVoting && !nextFlags.instructorGrading && !nextFlags.aiGrading) {
      return
    }
    if (nextFlags.aiGrading) nextFlags.instructorAiAssist = false
    onChange(applyGradingMethodFlags(value, nextFlags))
  }

  const updateWeight = (key: ProjectGradingComponent["key"], weight: number) => {
    const next = value.grading_components.map((c) => (c.key === key ? { ...c, weight_percent: weight } : c))
    onChange({ ...value, grading_components: next })
  }

  const peer = value.grading_components.find((c) => c.key === "peer")
  const instructor = value.grading_components.find((c) => c.key === "instructor")
  const ai = value.grading_components.find((c) => c.key === "ai")

  return (
    <div className="space-y-5">
      <ProjectFormSwitchPanel>
        <ProjectFormSwitchRow
          chrome={chrome}
          disabled={disabled}
          label="Student voting"
          description="Peers rate eligible projects (stars and leaderboard)."
          checked={flags.studentVoting}
          onCheckedChange={(on) => setFlags({ studentVoting: on })}
        />
        <ProjectFormSwitchRow
          chrome={chrome}
          disabled={disabled}
          label="Instructor grading"
          description="You score with the rubric and final say."
          checked={flags.instructorGrading}
          onCheckedChange={(on) => setFlags({ instructorGrading: on })}
        />
        <ProjectFormSwitchRow
          chrome={chrome}
          disabled={disabled}
          label="AI grading"
          description="AI evaluates the submission as its own grade source."
          checked={flags.aiGrading}
          onCheckedChange={(on) => setFlags({ aiGrading: on })}
        />
      </ProjectFormSwitchPanel>

      {enabledMethods > 1 ? (
        <div className="rounded-xl border border-[var(--border)] bg-muted/20 p-4 sm:p-5">
          <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Grade weights</p>
          <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>Enabled sources must total 100%.</p>
          <div className="mt-4 space-y-3">
            {flags.studentVoting && peer ? (
              <WeightRow label="Student voting" value={peer.weight_percent} disabled={disabled} onChange={(w) => updateWeight("peer", w)} />
            ) : null}
            {flags.instructorGrading && instructor ? (
              <WeightRow
                label="Instructor grading"
                value={instructor.weight_percent}
                disabled={disabled}
                onChange={(w) => updateWeight("instructor", w)}
              />
            ) : null}
            {flags.aiGrading && ai ? (
              <WeightRow label="AI grading" value={ai.weight_percent} disabled={disabled} onChange={(w) => updateWeight("ai", w)} />
            ) : null}
          </div>
          <p className={cn("mt-3 text-xs font-medium", Math.abs(total - 100) > 0.01 ? "text-destructive" : PORTAL_TEXT_MUTED)}>
            Total: {total.toFixed(1)}%
          </p>
        </div>
      ) : (
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>One source enabled — it counts for 100% of the project grade.</p>
      )}

      {flags.instructorGrading && !flags.aiGrading ? (
        <ProjectFormSwitchPanel>
          <ProjectFormSwitchRow
            chrome={chrome}
            disabled={disabled}
            label="Tutor + AI"
            description="AI scores the report as soon as it is submitted. Students see that provisional grade, rubric, and feedback until you finalize it."
            checked={flags.instructorAiAssist}
            onCheckedChange={(on) => setFlags({ instructorAiAssist: on })}
          />
        </ProjectFormSwitchPanel>
      ) : null}

      {flags.studentVoting ? (
        <div className="space-y-2">
          <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Peer voting</p>
          <ProjectFormSwitchPanel>
            <ProjectFormSwitchRow
              chrome={chrome}
              disabled={disabled}
              label="Show leaderboard"
              checked={value.peer_voting.show_leaderboard}
              onCheckedChange={(c) => onChange({ ...value, peer_voting: { ...value.peer_voting, show_leaderboard: c } })}
            />
            <ProjectFormSwitchRow
              chrome={chrome}
              disabled={disabled}
              label="Anonymous votes"
              checked={value.peer_voting.anonymous}
              onCheckedChange={(c) => onChange({ ...value, peer_voting: { ...value.peer_voting, anonymous: c } })}
            />
            <ProjectFormSwitchRow
              chrome={chrome}
              disabled={disabled}
              label="Allow own-group voting"
              checked={value.peer_voting.allow_own_group_voting}
              onCheckedChange={(c) =>
                onChange({ ...value, peer_voting: { ...value.peer_voting, allow_own_group_voting: c } })
              }
            />
          </ProjectFormSwitchPanel>
        </div>
      ) : null}
    </div>
  )
}

function WeightRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: number
  disabled?: boolean
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-sm", PORTAL_TEXT)}>{label}</span>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          className={cn(projectFormInputClass, "w-20 text-center tabular-nums")}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
        />
        <span className={cn("text-sm", PORTAL_TEXT_MUTED)}>%</span>
      </div>
    </div>
  )
}
