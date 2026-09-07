"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, GripVertical } from "lucide-react"
import type { SectionConfig, SectionTimerMode, SectionScoringMode } from "@/lib/assessment-sections"
import {
  DEFAULT_EXAM_SHARED_TIMER_SECONDS,
  DEFAULT_SECTION_TIMER_SECONDS,
  OBJECTIVE_QUESTION_TIMER_SECONDS,
  applyExamSharedTimerConfig,
  clearExamSharedTimerConfig,
  formatTimerMmSs,
  getAssessmentTimerStrategy,
  getExamSharedTimerSeconds,
} from "@/lib/assessment-timer"

const QUESTION_TYPES = [
  "mcq",
  "multiple_choice",
  "true_false",
  "select_all",
  "fill_blank",
  "code_write",
  "code_write_plot",
  "code_problem",
  "debug_code",
  "code_debug",
  "code_explain",
  "circuit_numeric",
  "circuit_worked_solution",
  "circuit_diagram_analysis",
  "circuit_multi_part",
  "circuit_fill_equation",
  "circuit_transfer_function",
  "circuit_phasor_power",
  "circuit_transient_response",
  "circuit_upload_work",
  "circuit_submission",
]

interface SectionConfigEditorProps {
  sections: SectionConfig[]
  onChange: (sections: SectionConfig[]) => void
  disabled?: boolean
}

export function SectionConfigEditor({
  sections,
  onChange,
  disabled = false,
}: SectionConfigEditorProps) {
  const addSection = () => {
    const nextNum = sections.length + 1
    onChange([
      ...sections,
      {
        title: `Section ${nextNum}`,
        question_types: nextNum === 1 ? ["mcq", "true_false", "select_all"] : nextNum === 2 ? ["code_write"] : ["code_write_plot"],
        weight_percent: nextNum === 1 ? 20 : nextNum === 2 ? 40 : 40,
      },
    ])
  }

  const removeSection = (index: number) => {
    const next = sections.filter((_, i) => i !== index)
    if (next.length === 0) return
    const totalWeight = next.reduce((s, x) => s + (Number(x.weight_percent) || 0), 0)
    if (Math.abs(totalWeight - 100) >= 0.01 && next.length > 0) {
      const perSection = Math.round(100 / next.length)
      next.forEach((s, i) => {
        next[i] = { ...s, weight_percent: i === next.length - 1 ? 100 - perSection * (next.length - 1) : perSection }
      })
    }
    onChange(next)
  }

  const updateSectionField = (
    index: number,
    patch: Partial<SectionConfig>,
  ) => {
    const next = [...sections]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  const updateSection = (index: number, field: keyof SectionConfig, value: string | number | string[] | boolean) => {
    const next = [...sections]
    if (field === "question_types") {
      next[index] = { ...next[index], question_types: value as string[] }
    } else if (field === "weight_percent") {
      const n = Math.max(0, Math.min(100, Number(value)))
      next[index] = { ...next[index], weight_percent: n }
    } else {
      next[index] = { ...next[index], [field]: value }
    }
    onChange(next)
  }

  const toggleQuestionType = (sectionIndex: number, type: string) => {
    const section = sections[sectionIndex]
    const types = section.question_types || []
    const has = types.includes(type)
    const next = has ? types.filter((t) => t !== type) : [...types, type]
    updateSection(sectionIndex, "question_types", next)
  }

  const totalWeight = sections.reduce((s, x) => s + (Number(x.weight_percent) || 0), 0)
  const weightValid = Math.abs(totalWeight - 100) < 0.01
  const timerStrategy = getAssessmentTimerStrategy(sections)
  const examSharedSeconds =
    getExamSharedTimerSeconds(sections) ?? DEFAULT_EXAM_SHARED_TIMER_SECONDS

  const setTimerStrategy = (strategy: "mixed" | "exam_shared") => {
    if (strategy === "exam_shared") {
      onChange(applyExamSharedTimerConfig(sections, examSharedSeconds))
      return
    }
    onChange(clearExamSharedTimerConfig(sections))
  }

  const setExamSharedMinutes = (minutes: number) => {
    const mins = Math.max(1, Math.floor(Number(minutes) || 90))
    onChange(applyExamSharedTimerConfig(sections, mins * 60))
  }

  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardHeader>
        <CardTitle className="text-base">Section configuration</CardTitle>
        <CardDescription>
          Each section gets a <strong>percentage of the exam score</strong> (e.g. 20 / 40 / 40). The grade is{" "}
          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">Σ (section points earned ÷ section max) × weight%</code>
          , so the reported score is always 0–100. You can keep every question at <strong>1 raw point</strong>; changing
          these weights later does not require recalculating individual question points—only this table.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-950/30 p-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-sm font-medium text-slate-800 dark:text-slate-100">
              Assessment timer
            </Label>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Choose one countdown for the whole exam, or configure timers independently per section below.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Timer strategy</Label>
              <select
                value={timerStrategy}
                onChange={(e) => setTimerStrategy(e.target.value as "mixed" | "exam_shared")}
                disabled={disabled}
                className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-sm"
              >
                <option value="mixed">Per section (mixed modes)</option>
                <option value="exam_shared">One timer for entire assessment</option>
              </select>
            </div>
            {timerStrategy === "exam_shared" && (
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Total time (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={Math.round(examSharedSeconds / 60)}
                  onChange={(e) => setExamSharedMinutes(Number(e.target.value))}
                  disabled={disabled}
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Shared pool: {formatTimerMmSs(examSharedSeconds)} across all sections. Per-question timers are off.
                </p>
              </div>
            )}
          </div>
        </div>
        {sections.map((section, idx) => (
          <div
            key={idx}
            className="border border-slate-200 dark:border-slate-600 rounded-lg p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/30"
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-slate-400" />
              <Input
                value={section.title}
                onChange={(e) => updateSection(idx, "title", e.target.value)}
                placeholder="Section title"
                className="flex-1 max-w-[200px]"
                disabled={disabled}
              />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-500 whitespace-nowrap" title="Share of the 0–100 exam score for this section">
                  Section % (of exam)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={section.weight_percent}
                  onChange={(e) => updateSection(idx, "weight_percent", e.target.value)}
                  className="w-16"
                  disabled={disabled}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeSection(idx)}
                disabled={disabled || sections.length <= 1}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {timerStrategy === "exam_shared" ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Uses the exam-wide {Math.round(examSharedSeconds / 60)}-minute pool ({formatTimerMmSs(examSharedSeconds)}).
              </p>
            ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Timer mode</Label>
                <select
                  value={section.timer_mode ?? ""}
                  onChange={(e) => {
                    const mode = e.target.value as SectionTimerMode | ""
                    if (!mode) {
                      updateSectionField(idx, {
                        timer_mode: undefined,
                        allow_backtracking: undefined,
                        total_time_seconds: undefined,
                        timers: undefined,
                      })
                      return
                    }
                    if (mode === "per_question") {
                      updateSectionField(idx, {
                        timer_mode: "per_question",
                        allow_backtracking: false,
                        auto_submit_on_expire: true,
                        timers: { ...OBJECTIVE_QUESTION_TIMER_SECONDS, ...section.timers },
                        total_time_seconds: undefined,
                      })
                    } else {
                      updateSectionField(idx, {
                        timer_mode: "section_timer",
                        allow_backtracking: true,
                        auto_submit_on_expire: true,
                        total_time_seconds: section.total_time_seconds ?? DEFAULT_SECTION_TIMER_SECONDS,
                      })
                    }
                  }}
                  disabled={disabled}
                  className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-sm"
                >
                  <option value="">Legacy (auto-detect)</option>
                  <option value="per_question">Per question (objective)</option>
                  <option value="section_timer">Section timer (circuit)</option>
                </select>
              </div>
              {section.timer_mode === "section_timer" && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Section time (seconds)</Label>
                  <Input
                    type="number"
                    min={60}
                    value={section.total_time_seconds ?? DEFAULT_SECTION_TIMER_SECONDS}
                    onChange={(e) =>
                      updateSectionField(idx, {
                        total_time_seconds: Math.max(60, Number(e.target.value) || DEFAULT_SECTION_TIMER_SECONDS),
                      })
                    }
                    disabled={disabled}
                  />
                </div>
              )}
              {section.timer_mode === "per_question" && (
                <>
                  {(["mcq", "true_false", "select_all"] as const).map((key) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-xs text-slate-500">{key} (sec)</Label>
                      <Input
                        type="number"
                        min={10}
                        value={section.timers?.[key] ?? OBJECTIVE_QUESTION_TIMER_SECONDS[key]}
                        onChange={(e) =>
                          updateSectionField(idx, {
                            timers: {
                              ...section.timers,
                              [key]: Math.max(10, Number(e.target.value) || OBJECTIVE_QUESTION_TIMER_SECONDS[key]),
                            },
                          })
                        }
                        disabled={disabled}
                      />
                    </div>
                  ))}
                </>
              )}
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 self-end pb-2">
                <input
                  type="checkbox"
                  checked={section.allow_backtracking ?? section.timer_mode !== "per_question"}
                  onChange={(e) => updateSectionField(idx, { allow_backtracking: e.target.checked })}
                  disabled={disabled}
                />
                Allow backtracking
              </label>
            </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 border-t border-slate-200/80 dark:border-slate-600/80 pt-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Section scoring mode</Label>
                <select
                  value={section.section_scoring_mode ?? "all"}
                  onChange={(e) => {
                    const mode = e.target.value as SectionScoringMode
                    if (mode === "all") {
                      updateSectionField(idx, {
                        section_scoring_mode: undefined,
                        questions_required: undefined,
                      })
                    } else {
                      updateSectionField(idx, {
                        section_scoring_mode: "student_pick",
                        questions_required: section.questions_required ?? 8,
                      })
                    }
                  }}
                  disabled={disabled}
                  className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 text-sm"
                >
                  <option value="all">All questions count (default)</option>
                  <option value="student_pick">Student picks N for grading</option>
                </select>
              </div>
              {section.section_scoring_mode === "student_pick" && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Questions required (N)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={section.questions_required ?? 8}
                    onChange={(e) =>
                      updateSectionField(idx, {
                        questions_required: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    disabled={disabled}
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Students select any {section.questions_required ?? 8} questions; section score uses N/N not N/total pool.
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {QUESTION_TYPES.map((type) => {
                const checked = (section.question_types || []).includes(type)
                return (
                  <label
                    key={type}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors ${
                      checked
                        ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200"
                        : "bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-300/60 dark:hover:bg-slate-600/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleQuestionType(idx, type)}
                      disabled={disabled}
                      className="sr-only"
                    />
                    {type}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSection}
          disabled={disabled}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Section
        </Button>
        {sections.length > 0 && (
          <p
            className={`text-sm ${weightValid ? "text-slate-600 dark:text-slate-400" : "text-amber-600 dark:text-amber-400"}`}
          >
            Section percentages total: <span className="font-mono font-medium">{Math.round(totalWeight * 100) / 100}%</span>
            {weightValid ? " (OK — exam score uses these shares)." : " — adjust so the total equals 100%."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
