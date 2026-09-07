"use client"

import { useState } from "react"
import { Brain, Check, ChevronDown, ChevronUp, Info } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  AI_MODEL_PRESET_OPTIONS,
  CLAUDE_AUTO_TASK_PRESET,
  OPENAI_AUTO_TASK_PRESET,
  isAutoRoutingPreset,
  type AiGradingTask,
  type AiModelPreset,
} from "@/lib/ai-model-catalog"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const TASK_LABELS: Record<AiGradingTask, string> = {
  code: "Code grading (C++/MATLAB)",
  circuit_vision: "Circuit submissions",
  document_vision: "Multi-part uploads",
  circuit_narrative: "Circuit narrative",
  tutor: "AI tutor / chat",
  summary: "Summaries & letters",
  generation: "Question generation",
}

const GROUP_LABELS: Record<string, string> = {
  routing: "Smart routing",
  openai: "OpenAI / ChatGPT",
  claude: "Anthropic / Claude",
  legacy: "Legacy models",
}

export type AssessmentAiModelValue = {
  ai_model: AiModelPreset
  ai_model_by_task: Partial<Record<AiGradingTask, AiModelPreset>> | null
  ai_enable_opus_fallback: boolean
  ai_opus_confidence_threshold: number
}

type Props = {
  value: AssessmentAiModelValue
  onChange: (patch: Partial<AssessmentAiModelValue>) => void
  showPerTaskOverrides?: boolean
  compact?: boolean
  /** Portal admin surfaces — module accent, no legacy purple/violet cards */
  portalTheme?: boolean
  switchCheckedClass?: string
  sliderClass?: string
}

function autoRoutingTable(preset: AiModelPreset) {
  if (preset === "auto-claude") return CLAUDE_AUTO_TASK_PRESET
  if (preset === "auto-openai" || preset === "auto") return OPENAI_AUTO_TASK_PRESET
  return null
}

function isOpenAiPreset(preset: AiModelPreset): boolean {
  return preset.startsWith("gpt-") || preset === "auto-openai"
}

const LEGACY_TIER_COLORS: Record<string, string> = {
  auto: "border-violet-500 bg-violet-50 dark:bg-violet-900/20 ring-violet-500/40",
  reasoning: "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-indigo-500/40",
  fast: "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-500/40",
  expert: "border-rose-500 bg-rose-50 dark:bg-rose-900/20 ring-rose-500/40",
  openai: "border-sky-500 bg-sky-50 dark:bg-sky-900/20 ring-sky-500/40",
  legacy: "border-slate-400 bg-slate-50 dark:bg-slate-800/40 ring-slate-400/40",
}

export function AssessmentAiModelPicker({
  value,
  onChange,
  showPerTaskOverrides = true,
  compact = false,
  portalTheme = false,
  switchCheckedClass,
  sliderClass,
}: Props) {
  const [showLegacy, setShowLegacy] = useState(false)
  const selected = AI_MODEL_PRESET_OPTIONS.find((o) => o.id === value.ai_model) ?? AI_MODEL_PRESET_OPTIONS[0]
  const routingTable = autoRoutingTable(value.ai_model)
  const openAiContext = isOpenAiPreset(value.ai_model) || value.ai_model === "auto"

  const groups = ["routing", "openai", "claude", "legacy"] as const
  const visibleGroups = portalTheme && compact
    ? groups.filter((g) => g !== "legacy" || showLegacy)
    : groups

  const groupLabelClass = portalTheme
    ? cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)
    : "text-xs font-semibold uppercase tracking-wide text-slate-500"

  const gridClass = portalTheme && compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 sm:grid-cols-2 gap-3"

  return (
    <div className={cn("space-y-4", portalTheme && compact && "space-y-3")}>
      {visibleGroups.map((group) => {
        const options = AI_MODEL_PRESET_OPTIONS.filter((o) => o.group === group)
        if (!options.length) return null
        return (
          <div key={group} className="space-y-2">
            {!(compact && !portalTheme) ? (
              <p className={groupLabelClass}>{GROUP_LABELS[group]}</p>
            ) : null}
            <div className={gridClass}>
              {options.map((option) => {
                const isSelected = value.ai_model === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onChange({ ai_model: option.id })}
                    className={cn(
                      "text-left rounded-xl border transition-colors",
                      portalTheme ? "p-3.5" : "p-4 border-2 hover:shadow-md",
                      portalTheme
                        ? isSelected
                          ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)] shadow-sm"
                          : "border-[var(--border)] bg-[var(--sidebar-accent)]/10 hover:bg-[var(--sidebar-accent)]/18"
                        : isSelected
                          ? `${LEGACY_TIER_COLORS[option.tier]} shadow-md ring-2`
                          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/80",
                    )}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Brain
                          className={cn(
                            "h-4 w-4 shrink-0",
                            portalTheme ? "text-[var(--cc-accent-dark)]" : "text-violet-600 dark:text-violet-400",
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            portalTheme ? PORTAL_TEXT : "text-slate-900 dark:text-slate-100",
                          )}
                        >
                          {option.label}
                        </span>
                      </div>
                      {portalTheme && isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-[var(--cc-accent-dark)]" aria-hidden />
                      ) : null}
                    </div>
                    <p
                      className={cn(
                        "mb-2 text-xs leading-relaxed",
                        portalTheme ? PORTAL_TEXT_MUTED : "text-slate-600 dark:text-slate-400",
                      )}
                    >
                      {option.description}
                    </p>
                    <span
                      className={cn(
                        "inline-block rounded-md px-2 py-0.5 text-[11px]",
                        portalTheme
                          ? "bg-[var(--sidebar-accent)]/35 text-[var(--cc-text-secondary)]"
                          : "bg-slate-200/70 text-slate-600 dark:bg-slate-700/70 dark:text-slate-400",
                      )}
                    >
                      {option.bestFor}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {portalTheme && compact ? (
        <button
          type="button"
          onClick={() => setShowLegacy((v) => !v)}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium",
            PORTAL_TEXT_MUTED,
            "hover:bg-[var(--sidebar-accent)]/20 hover:text-[var(--cc-text)]",
          )}
        >
          {showLegacy ? (
            <>
              Hide legacy models <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show legacy models <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      ) : null}

      {routingTable && !compact ? (
        <div
          className={cn(
            "rounded-lg px-3 py-2.5 text-xs",
            portalTheme
              ? "border border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)]/40 text-[var(--cc-accent-dark)]"
              : "border border-violet-200/60 bg-violet-50/40 text-violet-900 dark:border-violet-800/40 dark:bg-violet-950/20 dark:text-violet-100",
          )}
        >
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Smart routing active</p>
              <ul className="list-disc space-y-0.5 pl-4 opacity-90">
                {(Object.entries(routingTable) as [AiGradingTask, AiModelPreset][]).map(
                  ([task, preset]) => (
                    <li key={task}>
                      {TASK_LABELS[task]} →{" "}
                      {AI_MODEL_PRESET_OPTIONS.find((o) => o.id === preset)?.label ?? preset}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {showPerTaskOverrides && isAutoRoutingPreset(value.ai_model) ? (
        <div
          className={cn(
            "space-y-3 rounded-xl p-4",
            portalTheme
              ? "bg-[var(--sidebar-accent)]/10"
              : "border border-slate-200 dark:border-slate-700",
          )}
        >
          <p className={cn("text-sm font-medium", portalTheme ? PORTAL_TEXT : "text-slate-800 dark:text-slate-200")}>
            Per-task overrides (optional)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["code", "circuit_vision", "document_vision"] as AiGradingTask[]).map((task) => (
              <div key={task} className="space-y-1">
                <Label className={cn("text-xs", portalTheme ? PORTAL_TEXT_MUTED : "text-slate-600")}>
                  {TASK_LABELS[task]}
                </Label>
                <select
                  value={value.ai_model_by_task?.[task] ?? ""}
                  onChange={(e) => {
                    const next = { ...(value.ai_model_by_task ?? {}) }
                    const v = e.target.value as AiModelPreset | ""
                    if (!v) delete next[task]
                    else next[task] = v
                    onChange({
                      ai_model_by_task: Object.keys(next).length ? next : null,
                    })
                  }}
                  className={cn(
                    "h-9 w-full rounded-lg border px-2 text-sm shadow-none",
                    portalTheme
                      ? cn(CC_FIELD.base, CC_FIELD.focus)
                      : "border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900",
                  )}
                >
                  <option value="">Use smart routing</option>
                  {AI_MODEL_PRESET_OPTIONS.filter(
                    (o) => o.id !== "auto" && o.id !== "auto-openai" && o.id !== "auto-claude",
                  ).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          portalTheme
            ? "space-y-3 rounded-xl bg-[var(--sidebar-accent)]/12 px-3.5 py-3"
            : "space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700",
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className={cn("text-sm font-medium", portalTheme ? PORTAL_TEXT : "text-slate-800 dark:text-slate-200")}>
              Expert fallback for low confidence
            </p>
            <p className={cn("mt-0.5 text-xs leading-relaxed", portalTheme ? PORTAL_TEXT_MUTED : "text-slate-500")}>
              {openAiContext
                ? "Re-grade with a stronger model when confidence is below the threshold."
                : "Use Claude Opus as a second opinion on low-confidence grades."}
            </p>
          </div>
          <Switch
            checked={value.ai_enable_opus_fallback}
            onCheckedChange={(checked) => onChange({ ai_enable_opus_fallback: checked })}
            className={cn("shrink-0", switchCheckedClass)}
          />
        </div>
        {value.ai_enable_opus_fallback ? (
          <div className="max-w-md space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <Label className={cn("font-normal", portalTheme ? PORTAL_TEXT : "text-slate-600")}>
                Confidence threshold
              </Label>
              <span className={cn("tabular-nums font-medium", portalTheme ? PORTAL_TEXT : undefined)}>
                {value.ai_opus_confidence_threshold.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0.5}
              max={0.95}
              step={0.05}
              value={[value.ai_opus_confidence_threshold]}
              onValueChange={(v) => onChange({ ai_opus_confidence_threshold: v[0] ?? 0.75 })}
              className={sliderClass}
            />
          </div>
        ) : null}
      </div>

      {!compact ? (
        <p className={cn("text-xs", portalTheme ? PORTAL_TEXT_MUTED : "text-slate-500")}>
          Selected: <strong className={portalTheme ? PORTAL_TEXT : undefined}>{selected.label}</strong>.
          Circuit submissions use gpt-5.4-mini under OpenAI routing.
        </p>
      ) : null}
    </div>
  )
}
