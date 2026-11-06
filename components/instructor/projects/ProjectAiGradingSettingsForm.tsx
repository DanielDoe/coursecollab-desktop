"use client"

import { Check } from "lucide-react"
import { AssessmentAiModelPicker } from "@/components/assessment-ai-model-picker"
import { Input } from "@/components/ui/input"
import { AI_EVALUATION_MODES, type EvaluationModeConfig } from "@/lib/config/ai-evaluation-modes"
import type { ProjectAiGradingSettings, ProjectAiStrictness } from "@/lib/projects/project-integrity-types"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import type { FacultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  ProjectFormField,
  ProjectFormSegmented,
  ProjectFormSwitchPanel,
  ProjectFormSwitchRow,
  projectFormInputClass,
} from "@/components/instructor/projects/project-form-ui"

export function ProjectAiGradingSettingsForm({
  value,
  onChange,
  disabled,
  chrome: chromeProp,
}: {
  value: ProjectAiGradingSettings
  onChange: (next: ProjectAiGradingSettings) => void
  disabled?: boolean
  chrome?: FacultyEmbedChrome
}) {
  const chrome = chromeProp ?? facultyEmbedChrome("projects")
  const patch = (p: Partial<ProjectAiGradingSettings>) => onChange({ ...value, ...p })

  return (
    <div className="space-y-6">
      <AssessmentAiModelPicker
        portalTheme
        showPerTaskOverrides={false}
        switchCheckedClass={chrome.switchChecked}
        sliderClass={chrome.slider}
        value={{
          ai_model: value.ai_model || "auto",
          ai_model_by_task: value.ai_model_by_task,
          ai_enable_opus_fallback: value.ai_enable_opus_fallback,
          ai_opus_confidence_threshold: value.ai_opus_confidence_threshold,
        }}
        onChange={(next) => patch(next)}
      />

      <div className="space-y-2">
        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Grading strictness</p>
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>How hard the model scores report sections against the rubric.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.values(AI_EVALUATION_MODES) as EvaluationModeConfig[]).map((mode) => {
            const selected = (value.strictness || "standard") === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                disabled={disabled}
                onClick={() => patch({ strictness: mode.id as ProjectAiStrictness })}
                className={cn(
                  "relative rounded-xl border p-4 text-left transition-colors",
                  selected
                    ? cn(chrome.p.border, chrome.p.softBg, "ring-2 ring-[var(--cc-accent)]/35")
                    : "border-[var(--border)] bg-[var(--card)] hover:bg-muted/40",
                )}
              >
                {selected ? (
                  <span
                    className={cn(
                      "absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-[var(--cc-accent)] text-white",
                    )}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                ) : null}
                <p className={cn("mb-1 text-sm font-semibold", selected ? chrome.p.iconText : PORTAL_TEXT)}>
                  {mode.label}
                </p>
                <p className={cn("mb-2 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{mode.description}</p>
                <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-[11px] text-[var(--cc-text-muted)]">
                  {mode.bestFor}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>When AI runs</p>
        <ProjectFormSegmented
          chrome={chrome}
          disabled={disabled}
          value={value.scope}
          onChange={(v) => patch({ scope: v as ProjectAiGradingSettings["scope"] })}
          options={[
            { value: "section_by_section", label: "Each section" },
            { value: "whole_project", label: "Whole report" },
          ]}
        />
        <ProjectFormSwitchPanel>
          <ProjectFormSwitchRow
            chrome={chrome}
            disabled={disabled}
            label="Grade automatically when the group submits"
            description="AI scores every section right away. Students see a provisional report until you finalize it."
            checked={value.auto_run_on_submit}
            onCheckedChange={(c) => patch({ auto_run_on_submit: c })}
          />
        </ProjectFormSwitchPanel>
        <div className="max-w-xs">
          <ProjectFormField label="Hold for review below confidence" hint="0–1. Lower = fewer holds.">
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              disabled={disabled}
              className={projectFormInputClass}
              value={value.require_review_below_confidence}
              onChange={(e) => patch({ require_review_below_confidence: Number(e.target.value) || 0 })}
            />
          </ProjectFormField>
        </div>
      </div>
    </div>
  )
}