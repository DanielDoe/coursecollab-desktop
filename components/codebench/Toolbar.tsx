"use client"

import { Files, Loader2, Play, Save, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useNativeApp } from "@/hooks/use-native-app"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { CODEBENCH_LANGUAGE_OPTIONS, type CodebenchLanguageId } from "@/lib/codebench-languages"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface ToolbarProps {
  onExplain: () => void
  onDebug: () => void
  onImprove: () => void
  onPseudocode: () => void
  onTutor: () => void
  onPractice: () => void
  onEvaluate?: () => void
  onWalkWithCora?: () => void
  onSubmit: () => void
  activeTool?: string | null
  learningMode?: "beginner" | "intermediate" | "expert"
  onLearningModeChange?: (mode: "beginner" | "intermediate" | "expert") => void
  languageId?: CodebenchLanguageId
  detectedLanguageLabel?: string
  onLanguageChange?: (id: CodebenchLanguageId) => void
  theme?: "light" | "dark"
  isLoading: {
    explain: boolean
    debug: boolean
    improve: boolean
    pseudocode: boolean
    tutor: boolean
    practice: boolean
    evaluate?: boolean
    submit: boolean
  }
  classroomSubmissions?: any[]
  classroomSubmissionId?: string
  onAssignmentChange?: (submissionId: string) => void
  assignmentSelectionConfirmed?: boolean
  moreMenu?: ReactNode
  embedded?: boolean
  onLocalRun?: () => void
  onLocalStop?: () => void
  localRunState?: "idle" | "checking" | "compiling" | "running" | "stopping"
  localRunEnabled?: boolean
  explorerOpen?: boolean
  onToggleExplorer?: () => void
  onSave?: () => void
  canSave?: boolean
  projectName?: string
}

export function Toolbar({
  languageId = "cpp",
  detectedLanguageLabel,
  onLanguageChange,
  theme = "dark",
  moreMenu,
  embedded,
  onLocalRun,
  onLocalStop,
  localRunState = "idle",
  localRunEnabled = true,
  explorerOpen = false,
  onToggleExplorer,
  onSave,
  canSave = false,
  projectName,
}: ToolbarProps) {
  const isNative = useNativeApp()
  const { roles } = useCodebenchChrome()
  const compact = Boolean(embedded || isNative)
  const currentLanguage = CODEBENCH_LANGUAGE_OPTIONS.find((l) => l.id === languageId)
  const subtitleLanguage = detectedLanguageLabel || currentLanguage?.label || "C++"
  const busy = localRunState === "compiling" || localRunState === "running" || localRunState === "stopping"

  const selectTrigger = cn(
    "h-7 min-w-0 w-[6.75rem] rounded-md border shadow-none text-[11px] font-medium gap-1 px-2",
    "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]",
  )
  const selectContent =
    "border-[var(--border)] bg-[var(--popover)] text-[var(--cc-text)] [&_[data-slot=select-item]]:text-[var(--cc-text)]"
  const selectItemClass =
    "text-[var(--cc-text)] focus:text-[var(--cc-text)] data-[highlighted]:text-[var(--cc-text)]"

  return (
    <div
      data-codebench-toolbar={compact ? "compact" : "full"}
      className="min-w-0 shrink-0 border-b border-[var(--border)] bg-[var(--card)]"
    >
      <div
        data-codebench-toolbar-top
        className="flex h-10 min-w-0 items-center gap-2 px-2.5"
      >
        {onToggleExplorer ? (
          <button
            type="button"
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium",
              explorerOpen
                ? "bg-[var(--muted)] text-[var(--cc-text)]"
                : "text-[var(--cc-text-muted)] hover:bg-[var(--muted)] hover:text-[var(--cc-text)]",
            )}
            aria-label={explorerOpen ? "Hide files" : "Show files"}
            aria-pressed={explorerOpen}
            onClick={onToggleExplorer}
          >
            <Files className="h-3.5 w-3.5" />
            Files
          </button>
        ) : (
          <div className="min-w-0 max-w-[160px] shrink">
            <p className="truncate text-sm font-semibold text-[var(--cc-text)]">
              CodeBench
            </p>
            <p className="truncate text-[10px] text-[var(--cc-text-muted)]">
              {subtitleLanguage}
            </p>
          </div>
        )}

        {projectName ? (
          <span className="hidden min-w-0 max-w-[9rem] truncate text-[12px] font-medium text-[var(--cc-text-muted)] sm:inline">
            {projectName}
          </span>
        ) : null}

        <div className="mx-0.5 h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden />

        {onLanguageChange ? (
          <Select value={languageId} onValueChange={(value) => onLanguageChange(value as CodebenchLanguageId)}>
            <SelectTrigger className={selectTrigger} aria-label="Language">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent className={selectContent}>
              {CODEBENCH_LANGUAGE_OPTIONS.map((lang) => (
                <SelectItem key={lang.id} value={lang.id} className={selectItemClass}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <div className="flex shrink-0 items-center gap-1">
          {onSave ? (
            <Button
              type="button"
              variant="outline"
              onClick={onSave}
              disabled={!canSave}
              className="h-7 rounded-md border-[var(--border)] bg-[var(--card)] px-2 text-[12px] font-semibold text-[var(--cc-text)]"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          ) : null}
          {onLocalRun ? (
            <>
              <Button
                onClick={onLocalRun}
                disabled={!localRunEnabled || busy}
                className="h-7 rounded-md border-0 px-2.5 text-[12px] font-semibold shadow-none hover:opacity-90"
                style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
              >
                {localRunState === "compiling" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="mr-1 h-3.5 w-3.5" />
                )}
                {localRunState === "compiling" ? "Build" : "Run"}
              </Button>
              {busy ? (
                <Button
                  variant="outline"
                  onClick={onLocalStop}
                  disabled={localRunState === "stopping"}
                  className="h-7 rounded-md border-[var(--border)] bg-[var(--card)] px-2 text-[12px] font-semibold"
                >
                  <Square className="h-3 w-3" />
                </Button>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="min-w-0 flex-1" />

        {moreMenu ? <div data-codebench-xp-slot className="shrink-0">{moreMenu}</div> : null}
      </div>
    </div>
  )
}
