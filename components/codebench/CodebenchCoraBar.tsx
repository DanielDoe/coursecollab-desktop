"use client"

import { BookOpen, Bug, ChevronsRight, Eraser, FileCode, GraduationCap, Lightbulb, Loader2, MessageSquare, Sparkles, Wand2, Zap } from "lucide-react"
import { useCodebenchCoraPanel } from "@/components/codebench/codebench-cora-panel-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { cn } from "@/lib/utils"

const CORA_WORKSPACE_TOOLS = [
  { key: "explain", label: "Explain", icon: Lightbulb },
  { key: "walkthrough", label: "Walkthrough", icon: Wand2 },
  { key: "debug", label: "Debug", icon: Bug },
  { key: "improve", label: "Improve", icon: Sparkles },
  { key: "pseudocode", label: "Pseudo", icon: FileCode },
  { key: "tutor", label: "Tutor", icon: MessageSquare },
  { key: "practice", label: "Practice", icon: BookOpen },
] as const

const MODE_LABEL = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
} as const

type LearningMode = keyof typeof MODE_LABEL

type Props = {
  activeTool?: string | null
  onToolSelect: (tool: string) => void
  toolLoading?: boolean
  showEvaluate?: boolean
  showWalkthrough?: boolean
  learningMode?: LearningMode
  onLearningModeChange?: (mode: LearningMode) => void
  classroomSubmissions?: { id: string | number; title: string }[]
  classroomSubmissionId?: string
  onAssignmentChange?: (submissionId: string) => void
  theme?: "light" | "dark"
  onClear?: () => void
}

function toolLabel(key: string | null | undefined) {
  if (!key) return "Ask Cora"
  if (key === "evaluate") return "Evaluate"
  return CORA_WORKSPACE_TOOLS.find((tool) => tool.key === key)?.label ?? "Ask Cora"
}

export function CodebenchCoraBar({
  activeTool = null,
  onToolSelect,
  toolLoading = false,
  showEvaluate = true,
  showWalkthrough = true,
  learningMode = "intermediate",
  onLearningModeChange,
  classroomSubmissions = [],
  classroomSubmissionId = "",
  onAssignmentChange,
  theme: _theme = "light",
  onClear,
}: Props) {
  const { accent } = useCodebenchChrome()
  const coraPanel = useCodebenchCoraPanel()
  const trigger = cn(
    "h-6 min-h-6 max-h-6 min-w-0 rounded-md border-0 shadow-none text-[11px] font-medium gap-1.5 px-2.5",
    "data-[size=sm]:h-6 data-[size=sm]:min-h-6",
    "bg-[var(--muted)] text-[var(--cc-text)] hover:bg-[color-mix(in_srgb,var(--cc-text)_6%,var(--muted))]",
  )
  const menu =
    "border-[var(--border)] bg-[var(--popover)] text-[var(--cc-text)] [&_[data-slot=select-item]]:text-[var(--cc-text)]"
  const item = "text-[var(--cc-text)] focus:text-[var(--cc-text)] data-[highlighted]:text-[var(--cc-text)]"

  return (
    <div
      data-codebench-cora-bar
      className="flex h-9 min-w-0 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-3"
    >
      <span
        className="shrink-0 pr-0.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: accent }}
      >
        Cora
      </span>
      <Select value={activeTool ?? undefined} onValueChange={onToolSelect} disabled={toolLoading}>
        <SelectTrigger size="sm" className={cn(trigger, "min-w-0 flex-1")} aria-label="Cora tool">
          {toolLoading ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : <Sparkles className="h-3 w-3 shrink-0" style={{ color: accent }} />}
          <span className="min-w-0 truncate">{toolLabel(activeTool)}</span>
        </SelectTrigger>
        <SelectContent className={menu}>
          {CORA_WORKSPACE_TOOLS.filter((tool) => tool.key !== "walkthrough" || showWalkthrough).map(({ key, label, icon: Icon }) => (
            <SelectItem key={key} value={key} textValue={label} className={item}>
              <span className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]" />
                {label}
              </span>
            </SelectItem>
          ))}
          {showEvaluate ? (
            <SelectItem value="evaluate" textValue="Evaluate" className={item}>
              <span className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]" />
                Evaluate
              </span>
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
      {onLearningModeChange ? (
        <Select value={learningMode} onValueChange={(value) => onLearningModeChange(value as LearningMode)}>
          <SelectTrigger size="sm" className={cn(trigger, "w-[7.5rem] shrink-0")} aria-label={`Learning mode: ${learningMode}`}>
            <GraduationCap className="h-3 w-3 shrink-0" style={{ color: accent }} />
            <span className="min-w-0 truncate">{MODE_LABEL[learningMode]}</span>
          </SelectTrigger>
          <SelectContent className={cn(menu, "min-w-[10rem]")}>
            <SelectItem value="beginner" className={item}>Beginner</SelectItem>
            <SelectItem value="intermediate" className={item}>Intermediate</SelectItem>
            <SelectItem value="expert" className={item}>Expert</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      {onAssignmentChange && activeTool === "evaluate" ? (
        <Select
          value={classroomSubmissionId || "practice"}
          onValueChange={(value) => onAssignmentChange(value === "practice" ? "" : value)}
        >
          <SelectTrigger size="sm" className={cn(trigger, "w-[6.75rem] shrink-0")} aria-label="Assignment">
            <SelectValue placeholder="Practice" />
          </SelectTrigger>
          <SelectContent className={menu}>
            <SelectItem value="practice" className={item}>Practice</SelectItem>
            {classroomSubmissions.map((sub) => (
              <SelectItem key={String(sub.id)} value={String(sub.id)} className={item}>
                {sub.title}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
        ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {activeTool && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className={cn(
              "inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium",
              "bg-[var(--muted)] text-[var(--cc-text-muted)] hover:bg-[color-mix(in_srgb,var(--cc-text)_6%,var(--muted))] hover:text-[var(--cc-text)]",
            )}
            aria-label="Clear Cora output"
          >
            <Eraser className="h-3 w-3" />
            Clear
          </button>
        ) : null}
        {coraPanel ? (
          <button
            type="button"
            onClick={coraPanel.toggleCollapse}
            className={cn(
              "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
              "bg-[var(--muted)] text-[var(--cc-text-muted)] hover:bg-[color-mix(in_srgb,var(--cc-text)_6%,var(--muted))] hover:text-[var(--cc-text)]",
            )}
            aria-label="Collapse Cora panel"
            aria-expanded={!coraPanel.collapsed}
            title="Collapse Cora panel"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
