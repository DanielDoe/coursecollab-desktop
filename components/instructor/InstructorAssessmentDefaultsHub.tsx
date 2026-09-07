"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  Bot,
  Clock,
  Layers,
  Loader2,
  RotateCcw,
  Save,
  Shield,
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
  InstructorPolicyDividedList,
  InstructorPolicySurfaceCard,
  InstructorPolicyToggleRow,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { useInstructorAssessmentPolicy } from "@/components/instructor/useInstructorAssessmentPolicy"
import { formatTimerMmSs } from "@/lib/assessment-timer"
import { AssessmentAiModelPicker } from "@/components/assessment-ai-model-picker"
import { DEFAULT_OPUS_CONFIDENCE_THRESHOLD } from "@/lib/ai-model-catalog"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_OUTLINE_BTN, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type Section = "timing" | "sections" | "retakes" | "integrity" | "access"

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "timing", label: "Timing", icon: Clock },
  { id: "sections", label: "Sections", icon: Layers },
  { id: "retakes", label: "Retakes", icon: RotateCcw },
  { id: "integrity", label: "Integrity", icon: Shield },
  { id: "access", label: "Access & AI", icon: Bot },
]

const FIELD = cn("h-10 rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)

function Toggle(props: {
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  switchClass?: string
}) {
  return <InstructorPolicyToggleRow {...props} />
}

function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>{title}</p>
      <InstructorPolicyDividedList>{children}</InstructorPolicyDividedList>
    </div>
  )
}

function NumField({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 100000,
  className,
}: {
  label: string
  hint?: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>{label}</Label>
      <Input
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

export function InstructorAssessmentDefaultsHub() {
  const [section, setSection] = useState<Section>("timing")
  const chrome = facultyEmbedChrome("assessment-defaults")
  const spinner = facultyModuleSpinnerClass("assessment-defaults")
  const { policy, setPolicy, loading, saving, save, resetToPlatformDefaults } =
    useInstructorAssessmentPolicy()

  const t = policy.timer
  const s = policy.sections
  const r = policy.retakes
  const ac = policy.anti_cheat

  const patchTimer = (patch: Partial<typeof t>) =>
    setPolicy((prev) => ({ ...prev, timer: { ...prev.timer, ...patch } }))
  const patchSections = (patch: Partial<typeof s>) =>
    setPolicy((prev) => ({ ...prev, sections: { ...prev.sections, ...patch } }))
  const patchRetakes = (patch: Partial<typeof r>) =>
    setPolicy((prev) => ({ ...prev, retakes: { ...prev.retakes, ...patch } }))
  const patchAntiCheat = (patch: Partial<typeof ac>) =>
    setPolicy((prev) => ({ ...prev, anti_cheat: { ...prev.anti_cheat, ...patch } }))
  const patchAi = (patch: Partial<typeof policy.ai>) =>
    setPolicy((prev) => ({ ...prev, ai: { ...prev.ai, ...patch } }))
  const patchAccess = (patch: Partial<typeof policy.access>) =>
    setPolicy((prev) => ({ ...prev, access: { ...prev.access, ...patch } }))
  const patchSuperpowers = (patch: Partial<typeof policy.superpowers>) =>
    setPolicy((prev) => ({ ...prev, superpowers: { ...prev.superpowers, ...patch } }))

  const metaLine = useMemo(() => {
    switch (section) {
      case "timing":
        return `${t.time_per_question_default}s per question · ${formatTimerMmSs(t.hybrid_circuit_section_pooled_seconds)} hybrid pool`
      case "sections":
        return "Backtracking and auto-submit for objective and circuit sections"
      case "retakes":
        return r.retake_enabled_default
          ? `Retakes on · limit ${r.retake_limit_default}`
          : "Retakes off by default"
      case "integrity":
        return ac.strict_mode_default ? "Strict anti-cheat" : "Standard integrity defaults"
      case "access":
        return `Evaluation: ${policy.ai.ai_evaluation_mode_default.replace(/_/g, " ")}`
      default:
        return "Course-wide defaults"
    }
  }, [section, t, r, ac, policy.ai.ai_evaluation_mode_default])

  if (loading) {
    return <InstructorPolicyLoadingState moduleId="assessment-defaults" />
  }

  const switchClass = chrome.switchChecked

  return (
    <FacultyModuleSplitLayout
      menuWidthClass="lg:w-52 xl:w-56"
      menu={
        <FacultyModuleSideMenu
          moduleId="assessment-defaults"
          title="Defaults"
          activeId={section}
          onSelect={(id) => setSection(id as Section)}
          items={SECTIONS.map(({ id, label, icon }) => ({ id, label, icon }))}
          accent="theme"
        />
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        {section !== "access" ? (
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{metaLine}</p>
        ) : null}
        <div className="min-w-0 space-y-4">
          {section === "timing" ? (
            <InstructorPolicySurfaceCard
              variant="section"
              title="Timers"
              description="Per-question and pooled section limits for hybrid and circuit exams."
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <NumField
                  label="Seconds per question (default)"
                  value={t.time_per_question_default}
                  onChange={(n) => patchTimer({ time_per_question_default: n })}
                  min={10}
                  max={7200}
                />
                <NumField
                  label="MCQ · Section I"
                  value={t.objective_mcq_seconds}
                  onChange={(n) => patchTimer({ objective_mcq_seconds: n })}
                  min={10}
                  max={600}
                />
                <NumField
                  label="True / false"
                  value={t.objective_true_false_seconds}
                  onChange={(n) => patchTimer({ objective_true_false_seconds: n })}
                  min={10}
                  max={600}
                />
                <NumField
                  label="Select all"
                  value={t.objective_select_all_seconds}
                  onChange={(n) => patchTimer({ objective_select_all_seconds: n })}
                  min={10}
                  max={900}
                />
                <NumField
                  label="Hybrid Section II pool"
                  hint={formatTimerMmSs(t.hybrid_circuit_section_pooled_seconds)}
                  value={t.hybrid_circuit_section_pooled_seconds}
                  onChange={(n) => patchTimer({ hybrid_circuit_section_pooled_seconds: n })}
                  min={300}
                  max={14400}
                />
                <NumField
                  label="Circuit-only pool"
                  hint={formatTimerMmSs(t.circuit_only_seconds_per_question)}
                  value={t.circuit_only_seconds_per_question}
                  onChange={(n) => patchTimer({ circuit_only_seconds_per_question: n })}
                  min={300}
                  max={14400}
                />
              </div>
            </InstructorPolicySurfaceCard>
          ) : null}

          {section === "sections" ? (
            <InstructorPolicySurfaceCard
              variant="section"
              title="Section behavior"
              description="Used when an assessment does not override timer mode or backtracking."
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <SettingGroup title="Objective">
                  <Toggle
                    label="Allow backtracking"
                    checked={s.objective_allow_backtracking}
                    onCheckedChange={(v) => patchSections({ objective_allow_backtracking: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Auto-submit when time expires"
                    checked={s.objective_auto_submit_on_expire}
                    onCheckedChange={(v) => patchSections({ objective_auto_submit_on_expire: v })}
                    switchClass={switchClass}
                  />
                </SettingGroup>
                <SettingGroup title="Circuit / multi-part">
                  <Toggle
                    label="Allow backtracking"
                    checked={s.circuit_allow_backtracking}
                    onCheckedChange={(v) => patchSections({ circuit_allow_backtracking: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Auto-submit section on expiry"
                    checked={s.circuit_auto_submit_on_expire}
                    onCheckedChange={(v) => patchSections({ circuit_auto_submit_on_expire: v })}
                    switchClass={switchClass}
                  />
                </SettingGroup>
              </div>
            </InstructorPolicySurfaceCard>
          ) : null}

          {section === "retakes" ? (
            <InstructorPolicySurfaceCard
              variant="section"
              title="Retakes & review"
              description="Default retake rules for newly created assessments."
            >
              <div className="space-y-4">
                <Toggle
                  label="Retakes enabled by default"
                  checked={r.retake_enabled_default}
                  onCheckedChange={(v) => patchRetakes({ retake_enabled_default: v })}
                  switchClass={switchClass}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumField
                    label="Retake limit"
                    value={r.retake_limit_default}
                    onChange={(n) => patchRetakes({ retake_limit_default: n })}
                    min={0}
                    max={10}
                  />
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Scoring policy</Label>
                    <Select
                      value={r.retake_policy_default}
                      onValueChange={(v) =>
                        patchRetakes({ retake_policy_default: v as "best" | "latest" | "average" })
                      }
                    >
                      <SelectTrigger className={FIELD}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="best">Best score</SelectItem>
                        <SelectItem value="latest">Latest attempt</SelectItem>
                        <SelectItem value="average">Average</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <SettingGroup title="Review rules">
                  <Toggle
                    label="Review before retake"
                    checked={r.review_before_retake_default}
                    onCheckedChange={(v) => patchRetakes({ review_before_retake_default: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Forfeit retake after viewing report"
                    checked={r.forfeit_retake_on_report_view_default}
                    onCheckedChange={(v) => patchRetakes({ forfeit_retake_on_report_view_default: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Lock student results review"
                    checked={r.lock_student_results_review_default}
                    onCheckedChange={(v) => patchRetakes({ lock_student_results_review_default: v })}
                    switchClass={switchClass}
                  />
                </SettingGroup>
              </div>
            </InstructorPolicySurfaceCard>
          ) : null}

          {section === "integrity" ? (
            <InstructorPolicySurfaceCard
              variant="section"
              title="Anti-cheat"
              description="Inherited unless overridden per assessment."
            >
              <div className="space-y-4">
                <SettingGroup title="Core">
                  <Toggle
                    label="Strict mode"
                    checked={ac.strict_mode_default}
                    onCheckedChange={(v) => patchAntiCheat({ strict_mode_default: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Block copy / paste"
                    checked={ac.block_copy_paste_default}
                    onCheckedChange={(v) => patchAntiCheat({ block_copy_paste_default: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Require fullscreen"
                    checked={ac.require_fullscreen_default}
                    onCheckedChange={(v) => patchAntiCheat({ require_fullscreen_default: v })}
                    switchClass={switchClass}
                  />
                </SettingGroup>
                <SettingGroup title="Tab & AI monitoring">
                  <Toggle
                    label="Track tab switches"
                    checked={ac.track_tab_switches_default}
                    onCheckedChange={(v) => patchAntiCheat({ track_tab_switches_default: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Warn on tab switch"
                    checked={ac.warn_on_tab_switch_default}
                    onCheckedChange={(v) => patchAntiCheat({ warn_on_tab_switch_default: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Auto-submit on violations"
                    checked={ac.auto_submit_on_violations_default}
                    onCheckedChange={(v) => patchAntiCheat({ auto_submit_on_violations_default: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Track browser AI tools"
                    checked={ac.track_gemini_window_default}
                    onCheckedChange={(v) => patchAntiCheat({ track_gemini_window_default: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Keystroke replay enforced"
                    checked={ac.keystroke_playback_enforced_default}
                    onCheckedChange={(v) => patchAntiCheat({ keystroke_playback_enforced_default: v })}
                    switchClass={switchClass}
                  />
                </SettingGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumField
                    label="Max tab switches"
                    value={ac.max_tab_switches_default}
                    onChange={(n) => patchAntiCheat({ max_tab_switches_default: n })}
                    min={0}
                    max={20}
                  />
                  <NumField
                    label="Max AI tool strikes"
                    value={ac.max_gemini_strikes_default}
                    onChange={(n) => patchAntiCheat({ max_gemini_strikes_default: n })}
                    min={0}
                    max={10}
                  />
                </div>
              </div>
            </InstructorPolicySurfaceCard>
          ) : null}

          {section === "access" ? (
            <div className="space-y-4">
              <InstructorPolicySurfaceCard
              variant="section"
                title="Evaluation defaults"
                description="Strictness and location rules applied to new assessments."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>AI evaluation mode</Label>
                    <Select
                      value={policy.ai.ai_evaluation_mode_default}
                      onValueChange={(v) =>
                        patchAi({
                          ai_evaluation_mode_default: v as
                            | "relaxed"
                            | "standard"
                            | "strict"
                            | "very_strict",
                        })
                      }
                    >
                      <SelectTrigger className={FIELD}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="relaxed">Relaxed</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="strict">Strict</SelectItem>
                        <SelectItem value="very_strict">Very strict</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <NumField
                    label="Geo radius (meters)"
                    value={policy.access.geo_radius_meters_default}
                    onChange={(n) => patchAccess({ geo_radius_meters_default: n })}
                    min={10}
                    max={5000}
                  />
                </div>
              </InstructorPolicySurfaceCard>

              <InstructorPolicySurfaceCard
              variant="section"
                title="Default grading model"
                description="Smart routing and fallback behavior for AI-graded submissions."
              >
                <AssessmentAiModelPicker
                  compact
                  portalTheme
                  showPerTaskOverrides={false}
                  switchCheckedClass={switchClass}
                  sliderClass={chrome.slider}
                  value={{
                    ai_model: policy.ai.ai_model_default,
                    ai_model_by_task: policy.ai.ai_model_by_task_default,
                    ai_enable_opus_fallback: policy.ai.ai_enable_opus_fallback_default,
                    ai_opus_confidence_threshold:
                      policy.ai.ai_opus_confidence_threshold_default ??
                      DEFAULT_OPUS_CONFIDENCE_THRESHOLD,
                  }}
                  onChange={(patch) =>
                    patchAi({
                      ...(patch.ai_model != null ? { ai_model_default: patch.ai_model } : {}),
                      ...(patch.ai_model_by_task !== undefined
                        ? { ai_model_by_task_default: patch.ai_model_by_task }
                        : {}),
                      ...(patch.ai_enable_opus_fallback !== undefined
                        ? { ai_enable_opus_fallback_default: patch.ai_enable_opus_fallback }
                        : {}),
                      ...(patch.ai_opus_confidence_threshold !== undefined
                        ? {
                            ai_opus_confidence_threshold_default:
                              patch.ai_opus_confidence_threshold,
                          }
                        : {}),
                    })
                  }
                />
              </InstructorPolicySurfaceCard>

              <InstructorPolicySurfaceCard
              variant="section"
                title="Student access"
                description="Who can take assessments and how scores count."
              >
                <SettingGroup title="Access">
                  <Toggle
                    label="Counts toward course grade"
                    checked={policy.access.counts_toward_grade_default}
                    onCheckedChange={(v) => patchAccess({ counts_toward_grade_default: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Restrict to selected students"
                    checked={policy.access.restrict_access_default}
                    onCheckedChange={(v) => patchAccess({ restrict_access_default: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Geo-location required"
                    checked={policy.access.geo_required_default}
                    onCheckedChange={(v) => patchAccess({ geo_required_default: v })}
                    switchClass={switchClass}
                  />
                  <Toggle
                    label="Enable superpowers by default"
                    checked={policy.superpowers.enable_superpowers_default}
                    onCheckedChange={(v) => patchSuperpowers({ enable_superpowers_default: v })}
                    switchClass={switchClass}
                  />
                </SettingGroup>
              </InstructorPolicySurfaceCard>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            className={cn("h-9 rounded-lg", PORTAL_OUTLINE_BTN)}
            onClick={resetToPlatformDefaults}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to platform defaults
          </Button>
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
            Save defaults
          </Button>
        </div>
      </div>
    </FacultyModuleSplitLayout>
  )
}
