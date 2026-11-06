"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ProjectRubric, ProjectRubricCriterion } from "@/lib/projects/project-grading-types"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import type { FacultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  ProjectFormSegmented,
  ProjectFormSwitchPanel,
  ProjectFormSwitchRow,
  projectFormInputClass,
  projectFormTextareaClass,
} from "@/components/instructor/projects/project-form-ui"

const DEFAULT_LEVELS = [
  { id: "excellent", label: "Excellent" },
  { id: "good", label: "Good" },
  { id: "developing", label: "Developing" },
  { id: "insufficient", label: "Insufficient" },
]

function newCriterion(index: number): ProjectRubricCriterion {
  return {
    id: `criterion-${Date.now()}-${index}`,
    title: `Criterion ${index + 1}`,
    description: "",
    weight_percent: 0,
    max_points: 10,
    levels: DEFAULT_LEVELS.map((l) => ({ ...l, description: "" })),
  }
}

export function ProjectRubricBuilder({
  value,
  onChange,
  disabled,
  chrome: chromeProp,
}: {
  value: ProjectRubric
  onChange: (next: ProjectRubric) => void
  disabled?: boolean
  chrome?: FacultyEmbedChrome
}) {
  const chrome = chromeProp ?? facultyEmbedChrome("projects")
  const criteria = value.criteria ?? []

  const updateCriterion = (idx: number, patch: Partial<ProjectRubricCriterion>) => {
    const next = [...criteria]
    next[idx] = { ...next[idx], ...patch }
    onChange({ ...value, criteria: next })
  }

  const totalWeight = criteria.reduce((s, c) => s + (Number(c.weight_percent) || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Rubric style</p>
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Simple points or analytic performance levels.</p>
        </div>
        <ProjectFormSegmented
          chrome={chrome}
          disabled={disabled}
          value={value.type}
          onChange={(t) => onChange({ ...value, type: t as ProjectRubric["type"] })}
          options={[
            { value: "simple", label: "Simple points" },
            { value: "analytic", label: "Analytic levels" },
          ]}
        />
      </div>

      <ProjectFormSwitchPanel>
        <ProjectFormSwitchRow
          chrome={chrome}
          disabled={disabled}
          label="Allow overall instructor comment"
          checked={value.overall_comment_enabled !== false}
          onCheckedChange={(checked) => onChange({ ...value, overall_comment_enabled: checked })}
        />
      </ProjectFormSwitchPanel>

      {criteria.map((criterion, idx) => (
        <div key={criterion.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] bg-muted/20 px-4 py-3">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Criterion {idx + 1}</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="h-8 w-8 shrink-0 text-[var(--cc-sem-danger)]"
              onClick={() => {
                const next = criteria.filter((_, i) => i !== idx)
                onChange({ ...value, criteria: next })
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Title</Label>
              <Input
                className={projectFormInputClass}
                value={criterion.title}
                disabled={disabled}
                onChange={(e) => updateCriterion(idx, { title: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea
                className={projectFormTextareaClass}
                value={criterion.description || ""}
                disabled={disabled}
                rows={2}
                onChange={(e) => updateCriterion(idx, { description: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Weight %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                className={projectFormInputClass}
                disabled={disabled}
                value={criterion.weight_percent}
                onChange={(e) => updateCriterion(idx, { weight_percent: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max points</Label>
              <Input
                type="number"
                min={0}
                className={projectFormInputClass}
                disabled={disabled}
                value={criterion.max_points}
                onChange={(e) => updateCriterion(idx, { max_points: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          {value.type === "analytic" ? (
            <div className="space-y-2 border-t border-[var(--border)] bg-muted/10 px-4 py-3">
              <p className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Performance levels</p>
              {criterion.levels.map((level, li) => (
                <div key={level.id} className="grid gap-2 sm:grid-cols-3">
                  <Input
                    className={projectFormInputClass}
                    value={level.label}
                    disabled={disabled}
                    placeholder="Level label"
                    onChange={(e) => {
                      const levels = [...criterion.levels]
                      levels[li] = { ...levels[li], label: e.target.value }
                      updateCriterion(idx, { levels })
                    }}
                  />
                  <Input
                    type="number"
                    className={projectFormInputClass}
                    disabled={disabled}
                    placeholder="Points"
                    value={level.points ?? ""}
                    onChange={(e) => {
                      const levels = [...criterion.levels]
                      levels[li] = {
                        ...levels[li],
                        points: e.target.value === "" ? null : Number(e.target.value),
                      }
                      updateCriterion(idx, { levels })
                    }}
                  />
                  <Input
                    className={projectFormInputClass}
                    value={level.description || ""}
                    disabled={disabled}
                    placeholder="Descriptor"
                    onChange={(e) => {
                      const levels = [...criterion.levels]
                      levels[li] = { ...levels[li], description: e.target.value }
                      updateCriterion(idx, { levels })
                    }}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          Criterion weights: {totalWeight.toFixed(1)}% (target 100% when used for grading)
        </p>
        <Button
          type="button"
          size="sm"
          className={chrome.quiet}
          disabled={disabled}
          onClick={() => onChange({ ...value, criteria: [...criteria, newCriterion(criteria.length)] })}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add criterion
        </Button>
      </div>
    </div>
  )
}
