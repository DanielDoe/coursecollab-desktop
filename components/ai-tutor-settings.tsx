"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  Save,
  Settings,
  ShieldCheck,
  TextCursorInput,
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { facultyToolbarFilterButtonClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { STUDENT_CORA_CAPABILITIES } from "@/lib/cora/student-capabilities"
import { CORA_NAV_LABEL } from "@/lib/cora/constants"
import { portalListStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { CoraSectionTools } from "@/components/instructor/administration/CoraSectionTools"
import {
  CORA_COURSE_ROUTING_OPTIONS,
  normalizeCoraCourseRoutingPolicy,
} from "@/lib/cora/models/course-policy"

const RESPONSE_STYLE_OPTIONS = [
  { value: "helpful", label: "Detailed", description: "Thorough explanations" },
  { value: "concise", label: "Concise", description: "Short and direct" },
  { value: "encouraging", label: "Supportive", description: "Warm, motivating tone" },
] as const

const STUDENT_WRITE_NOTES: Record<string, string> = {
  flashcards: "Cora proposes a personal deck. Nothing is saved until the student confirms.",
  plan: "Cora proposes a study plan. Nothing is saved until the student confirms.",
  exam: "Practice quizzes are proposed in chat and created only after Confirm.",
  lecture: "Lecture notes can be saved as a personal note after the student confirms.",
}

const STUDENT_PUBLIC_MODES = [
  { label: "Cora", note: "Everyday answers while premium credits remain" },
  { label: "Cora Lite", note: "Cheaper lookups when credits are exhausted — same course data, no write tools" },
  { label: "Advanced Reasoning", note: "Hard STEM and exams, only if this course allows it" },
] as const

type SettingsState = {
  enableAITutor: boolean
  allowCodeDebugging: boolean
  allowPracticeGeneration: boolean
  maxResponseLength: number
  responseStyle: string
  aiModel: string
  enableHints: boolean
  enableStepByStep: boolean
  enableCodeExamples: boolean
}

const TOGGLE_SETTINGS: Array<{
  key: keyof Pick<
    SettingsState,
    | "enableAITutor"
    | "allowCodeDebugging"
    | "allowPracticeGeneration"
    | "enableHints"
    | "enableStepByStep"
    | "enableCodeExamples"
  >
  label: string
  description: string
  group: "access" | "pedagogy"
}> = [
  {
    key: "enableAITutor",
    label: "Enable Cora Assistant",
    description: "Students can open Cora Assistant in this course",
    group: "access",
  },
  {
    key: "allowCodeDebugging",
    label: "Code help",
    description: "Cora may trace and debug student code in Code and CodeBench",
    group: "access",
  },
  {
    key: "allowPracticeGeneration",
    label: "Practice generation",
    description: "Cora may propose extra Practice Hub quizzes. Students confirm before a quiz is created.",
    group: "access",
  },
  {
    key: "enableHints",
    label: "Hints before solutions",
    description: "Match student Cora preference: guide first, do not dump the answer",
    group: "pedagogy",
  },
  {
    key: "enableStepByStep",
    label: "Step-by-step",
    description: "Break complex answers into Cora Solve walkthroughs",
    group: "pedagogy",
  },
  {
    key: "enableCodeExamples",
    label: "Code examples",
    description: "Include runnable examples when the student Cora Code tab is relevant",
    group: "pedagogy",
  },
]

export type AiTutorSettingsActions = {
  canSave: boolean
  saving: boolean
  save: () => void
}

export function AITutorSettings({
  embedInDashboard,
  searchQuery = "",
  onActionsChange,
}: {
  embedInDashboard?: boolean
  searchQuery?: string
  onActionsChange?: (actions: AiTutorSettingsActions | null) => void
} = {}) {
  const { toast } = useToast()
  const chrome = embedInDashboard ? facultyEmbedChrome("ai-assistant-settings") : null
  const spinner = embedInDashboard ? facultyModuleSpinnerClass("ai-assistant-settings") : "text-purple-600"

  const [settings, setSettings] = useState<SettingsState>({
    enableAITutor: true,
    allowCodeDebugging: true,
    allowPracticeGeneration: true,
    maxResponseLength: 500,
    responseStyle: "helpful",
    aiModel: "auto",
    enableHints: true,
    enableStepByStep: true,
    enableCodeExamples: true,
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasChanges, setHasChanges] = useState(false)
  const [filter, setFilter] = useState("")

  const loadSettings = useCallback(async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/ai-tutor/settings", {
        headers: buildInstructorApiHeaders(),
      })
      const data = await response.json()
      if (response.ok && data.settings) {
        setSettings({
          ...data.settings,
          aiModel: normalizeCoraCourseRoutingPolicy(data.settings.aiModel),
        })
      }
    } catch (error) {
      console.error("Failed to load settings:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const response = await instructorApiFetch("/api/instructor/ai-tutor/settings", {
        method: "POST",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const data = await response.json()
      if (response.ok || data.success) {
        toast({
          title: "Settings saved",
          description: "Cora Assistant course policy updated.",
        })
        setHasChanges(false)
      } else {
        throw new Error("Failed to save")
      }
    } catch {
      toast({ title: "Could not save settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }, [settings, toast])

  useEffect(() => {
    if (!embedInDashboard || !onActionsChange) return
    onActionsChange({
      canSave: hasChanges,
      saving,
      save: () => void handleSave(),
    })
    return () => onActionsChange(null)
  }, [embedInDashboard, onActionsChange, hasChanges, saving, handleSave])

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const activeQuery = embedInDashboard ? filter : searchQuery
  const filteredToggles = useMemo(() => {
    const q = activeQuery.trim().toLowerCase()
    if (!q) return TOGGLE_SETTINGS
    return TOGGLE_SETTINGS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
    )
  }, [activeQuery])

  const accessToggles = filteredToggles.filter((t) => t.group === "access")
  const pedagogyToggles = filteredToggles.filter((t) => t.group === "pedagogy")

  const showModelSection =
    !activeQuery.trim() ||
    ["model", "routing", "cora", "reasoning", "lite", "response", "style", "length", "ai", "confirm"].some((term) =>
      activeQuery.toLowerCase().includes(term),
    )

  if (loading) {
    if (embedInDashboard) {
      return <InstructorPolicyLoadingState moduleId="ai-assistant-settings" label="Loading Cora Assistant settings…" />
    }
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className={cn("mx-auto mb-4 h-12 w-12 animate-spin", spinner)} />
      </div>
    )
  }

  if (embedInDashboard) {
    const renderToggleGroup = (
      title: string,
      description: string,
      items: typeof TOGGLE_SETTINGS,
    ) =>
      items.length > 0 ? (
        <InstructorPolicySurfaceCard variant="section" title={title} description={description}>
          <div className="divide-y divide-[var(--border)]">
            {items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Label className={cn("text-sm font-medium", PORTAL_TEXT)}>{item.label}</Label>
                  <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{item.description}</p>
                </div>
                <Switch
                  checked={settings[item.key]}
                  onCheckedChange={(checked) => updateSetting(item.key, checked)}
                  className={cn("shrink-0", chrome?.switchChecked)}
                />
              </div>
            ))}
          </div>
        </InstructorPolicySurfaceCard>
      ) : null

    return (
      <div className="space-y-4">
        <CoraSectionTools
          search={filter}
          onSearchChange={setFilter}
          searchPlaceholder="Filter Cora Assistant settings…"
          trailing={
            <Button
              type="button"
              disabled={saving || !hasChanges}
              className={cn("h-9 gap-2 rounded-lg", chrome?.cta)}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          }
          meta={hasChanges ? "Unsaved changes" : "Course policy for student Cora Assistant"}
        />
        {renderToggleGroup(
          "Cora Assistant access",
          "Course-level gates for the student Cora Assistant — the same product students open from Cora Assistant.",
          accessToggles,
        )}
        {renderToggleGroup(
          "Cora teaching style",
          "How student Cora guides work. These map to Cora Assistant preferences (hints, steps, examples).",
          pedagogyToggles,
        )}

        {(() => {
          const q = activeQuery.trim().toLowerCase()
          const caps = STUDENT_CORA_CAPABILITIES.filter(
            (cap) =>
              !q ||
              cap.title.toLowerCase().includes(q) ||
              cap.description.toLowerCase().includes(q),
          )
          if (caps.length === 0) return null
          return (
            <InstructorPolicySurfaceCard
              variant="section"
              title={`What ${CORA_NAV_LABEL} can do`}
              description="Student Cora capabilities — the same actions on the student Cora Assistant home."
            >
              <div className="divide-y divide-[var(--border)]">
                {caps.map((cap, index) => {
                  const stripe = portalListStripe(index, "amber")
                  return (
                    <div key={cap.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <div
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold uppercase",
                          stripe.iconBg,
                          stripe.iconText,
                        )}
                      >
                        {cap.title.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{cap.title}</p>
                        <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                          {cap.description}
                          {STUDENT_WRITE_NOTES[cap.id] ? ` ${STUDENT_WRITE_NOTES[cap.id]}` : ""}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </InstructorPolicySurfaceCard>
          )
        })()}

        <InstructorPolicySurfaceCard
          variant="section"
          title="Student writes"
          description="Consequential student actions never execute from a chat yes. Cora shows a Confirm card first."
        >
          <div className="flex gap-3">
            <div
              className={cn(
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                chrome?.p.softBg ?? "bg-[var(--cc-accent-soft)]",
                chrome?.p.iconText ?? "text-[var(--cc-accent-dark)]",
              )}
            >
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
              Notes, flashcards, practice quizzes, study plans, and calendar sessions are proposed in chat.
              Confirm writes once; replaying the same card does not create a second copy.
            </p>
          </div>
        </InstructorPolicySurfaceCard>

        {showModelSection ? (
          <InstructorPolicySurfaceCard
            variant="section"
            title="Routing & responses"
            description="Cora chooses a capability profile per task. Students see Cora, Cora Lite, or Advanced Reasoning — not provider names."
          >
            <div className="divide-y divide-[var(--border)]">
              <div className="space-y-3 py-3 first:pt-0">
                <div className="flex min-w-0 gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                      chrome?.p.softBg ?? "bg-[var(--cc-accent-soft)]",
                      chrome?.p.iconText ?? "text-[var(--cc-accent-dark)]",
                    )}
                  >
                    <Brain className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <Label className={cn("text-sm font-medium", PORTAL_TEXT)}>Cora routing</Label>
                    <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                      Course policy for how Cora selects intelligence. The server still owns the model.
                    </p>
                  </div>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-3">
                  {CORA_COURSE_ROUTING_OPTIONS.map((option) => {
                    const active = normalizeCoraCourseRoutingPolicy(settings.aiModel) === option.value
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant="ghost"
                        className={cn(
                          facultyToolbarFilterButtonClass(active),
                          "h-auto min-h-[4.5rem] flex-col items-start gap-0.5 px-3 py-2.5 text-left whitespace-normal",
                        )}
                        onClick={() => updateSetting("aiModel", option.value)}
                      >
                        <span className="text-sm font-medium">{option.label}</span>
                        <span className={cn("text-[11px] font-normal leading-relaxed", active ? "opacity-80" : PORTAL_TEXT_MUTED)}>
                          {option.note}
                        </span>
                      </Button>
                    )
                  })}
                </div>
                <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] px-3">
                  {STUDENT_PUBLIC_MODES.map((mode) => (
                    <div key={mode.label} className="flex items-baseline justify-between gap-3 py-2">
                      <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{mode.label}</p>
                      <p className={cn("text-xs leading-relaxed text-right", PORTAL_TEXT_MUTED)}>{mode.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="py-3">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]">
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Label className={cn("text-sm font-medium", PORTAL_TEXT)}>Response style</Label>
                    <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                      How Cora Assistant phrases answers for students
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {RESPONSE_STYLE_OPTIONS.map((style) => {
                        const active = settings.responseStyle === style.value
                        return (
                          <Button
                            key={style.value}
                            type="button"
                            variant="ghost"
                            className={cn(
                              facultyToolbarFilterButtonClass(active),
                              "h-auto min-w-[5.5rem] flex-col items-start gap-0.5 px-3 py-2 text-left",
                            )}
                            onClick={() => updateSetting("responseStyle", style.value)}
                          >
                            <span className="text-sm font-medium">{style.label}</span>
                            <span className={cn("text-[11px] font-normal", active ? "opacity-80" : PORTAL_TEXT_MUTED)}>
                              {style.description}
                            </span>
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pb-0 pt-3">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]">
                    <TextCursorInput className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <Label className={cn("text-sm font-medium", PORTAL_TEXT)}>Max response length</Label>
                        <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                          Cap reply size in words · recommended 300–500
                        </p>
                      </div>
                      <span className={cn("text-sm font-semibold tabular-nums", PORTAL_TEXT)}>
                        {settings.maxResponseLength}{" "}
                        <span className={cn("text-xs font-normal", PORTAL_TEXT_MUTED)}>words</span>
                      </span>
                    </div>
                    <Slider
                      min={100}
                      max={1000}
                      step={50}
                      value={[settings.maxResponseLength]}
                      onValueChange={(value) => updateSetting("maxResponseLength", value[0] ?? 500)}
                      className={cn("max-w-md", chrome?.slider)}
                    />
                    <div className={cn("flex justify-between text-[11px] tabular-nums", PORTAL_TEXT_MUTED)}>
                      <span>100</span>
                      <span>500</span>
                      <span>1000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </InstructorPolicySurfaceCard>
        ) : null}

        {!embedInDashboard && !onActionsChange ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            {hasChanges ? (
              <p className={cn("flex items-center gap-1.5 text-xs", PORTAL_TEXT_MUTED)}>
                <AlertCircle className="h-3.5 w-3.5 text-[var(--cc-sem-warning)]" />
                Unsaved changes
              </p>
            ) : (
              <p className={cn("flex items-center gap-1.5 text-xs", PORTAL_TEXT_MUTED)}>
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--cc-sem-success)]" />
                All changes saved
              </p>
            )}
            <Button
              type="button"
              disabled={saving || !hasChanges}
              className={cn("h-9 gap-2 rounded-lg", chrome?.cta)}
              onClick={() => void handleSave()}
            >
              {saving ? <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} /> : <Save className="h-4 w-4" />}
              Save settings
            </Button>
          </div>
        ) : null}

        {filteredToggles.length === 0 && !showModelSection ? (
          <InstructorPolicySurfaceCard variant="section" title="No matches" description="Try a different search term.">
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No settings match your filter.</p>
          </InstructorPolicySurfaceCard>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/85">
        <div className="mb-6 flex items-center gap-2">
          <Settings className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">General Settings</h3>
        </div>
        <div className="space-y-4">
          {TOGGLE_SETTINGS.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50"
            >
              <div className="flex-1">
                <Label className="text-base font-semibold">{item.label}</Label>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.description}</p>
              </div>
              <Switch
                checked={settings[item.key]}
                onCheckedChange={(checked) => updateSetting(item.key, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/85">
        <div className="mb-6 flex items-center gap-2">
          <Brain className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cora routing</h3>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Course routing policy</Label>
            <div className="flex flex-col gap-1.5">
              {CORA_COURSE_ROUTING_OPTIONS.map((option) => {
                const active = normalizeCoraCourseRoutingPolicy(settings.aiModel) === option.value
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="ghost"
                    className={cn(
                      facultyToolbarFilterButtonClass(active),
                      "h-auto flex-col items-start gap-0.5 px-3 py-2 text-left whitespace-normal",
                    )}
                    onClick={() => updateSetting("aiModel", option.value)}
                  >
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className={cn("text-[11px] font-normal", active ? "opacity-80" : "text-slate-500")}>
                      {option.note}
                    </span>
                  </Button>
                )
              })}
            </div>
            <p className="text-xs text-slate-500">
              Students see Cora, Cora Lite, or Advanced Reasoning — never provider names.
            </p>
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Response Style</Label>
            <Select value={settings.responseStyle} onValueChange={(value) => updateSetting("responseStyle", value)}>
              <SelectTrigger className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="helpful">Helpful & Detailed</SelectItem>
                <SelectItem value="concise">Concise & Direct</SelectItem>
                <SelectItem value="encouraging">Encouraging & Supportive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Max Response Length (words)</Label>
            <Input
              type="number"
              min={100}
              max={1000}
              value={settings.maxResponseLength}
              onChange={(e) => updateSetting("maxResponseLength", parseInt(e.target.value, 10) || 500)}
              className="rounded-lg"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border-2 border-dashed border-slate-300 p-4 dark:border-slate-700">
        {hasChanges ? (
          <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
            <AlertCircle className="h-4 w-4" />
            <span>You have unsaved changes</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>All changes saved</span>
          </div>
        )}
        <Button
          onClick={() => void handleSave()}
          disabled={saving || !hasChanges}
          size="lg"
          className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-8 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
