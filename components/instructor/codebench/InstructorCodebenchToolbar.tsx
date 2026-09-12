"use client"

import { BookOpenCheck, Files, Loader2, Maximize2, Minimize2, Play, Save, Sparkles, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { CODEBENCH_LANGUAGE_OPTIONS, type CodebenchLanguageId } from "@/lib/codebench-languages"
import { cn } from "@/lib/utils"
import type { CodeBenchRunState } from "@/src/features/codebench/types/codebench"

type Props = {
  languageId: CodebenchLanguageId
  onLanguageChange: (id: CodebenchLanguageId) => void
  projectName?: string
  fileName?: string
  classroomTitle?: string
  explorerOpen: boolean
  onToggleExplorer: () => void
  onSave?: () => void
  canSave?: boolean
  onRun?: () => void
  onStop?: () => void
  runState?: CodeBenchRunState
  runEnabled?: boolean
  questionOpen?: boolean
  onToggleQuestion?: () => void
  coraOpen?: boolean
  onToggleCora?: () => void
  editorExpanded?: boolean
  onToggleEditorExpanded?: () => void
}

export function InstructorCodebenchToolbar({
  languageId,
  onLanguageChange,
  projectName,
  fileName,
  classroomTitle,
  explorerOpen,
  onToggleExplorer,
  onSave,
  canSave = false,
  onRun,
  onStop,
  runState = "idle",
  runEnabled = true,
  questionOpen = false,
  onToggleQuestion,
  coraOpen = false,
  onToggleCora,
  editorExpanded = false,
  onToggleEditorExpanded,
}: Props) {
  const { roles } = useCodebenchChrome()
  const busy = runState === "compiling" || runState === "running" || runState === "stopping"
  const currentLanguage = CODEBENCH_LANGUAGE_OPTIONS.find((entry) => entry.id === languageId)

  const selectTrigger = cn(
    "h-7 min-w-0 w-[6.75rem] rounded-md border shadow-none text-[11px] font-medium gap-1 px-2",
    "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]",
  )

  return (
    <div className="min-w-0 shrink-0 overflow-x-auto border-b border-[var(--border)] bg-[var(--card)] [-webkit-overflow-scrolling:touch]">
      <div className="flex h-10 w-max min-w-full items-center gap-2 px-2.5 sm:w-full">
        <button
          type="button"
          className={cn(
            "instructor-structure-trigger inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-transparent px-1.5 text-[12px] font-medium shadow-sm",
            explorerOpen
              ? "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]"
              : "text-[var(--cc-text-muted)] hover:border-[var(--border)] hover:bg-[var(--card)] hover:text-[var(--cc-text)]",
          )}
          aria-label={explorerOpen ? "Hide explorer" : "Show explorer"}
          aria-pressed={explorerOpen}
          onClick={onToggleExplorer}
        >
          <Files className="h-3.5 w-3.5" />
          Explorer
        </button>

        <div className="min-w-0 max-w-[9rem] shrink truncate text-[12px] font-semibold text-[var(--cc-text)]">
          CodeBench
        </div>

        {projectName ? (
          <span className="hidden min-w-0 max-w-[8rem] truncate text-[11px] text-[var(--cc-text-muted)] sm:inline">
            {projectName}
          </span>
        ) : null}

        {fileName ? (
          <span className="hidden min-w-0 max-w-[8rem] truncate text-[11px] text-[var(--cc-text-muted)] md:inline">
            {fileName}
          </span>
        ) : null}

        {classroomTitle ? (
          <span className="hidden min-w-0 max-w-[10rem] truncate rounded-md bg-[color-mix(in_srgb,var(--cc-accent)_10%,var(--card))] px-1.5 py-0.5 text-[10px] font-medium text-[var(--cc-accent)] lg:inline">
            {classroomTitle}
          </span>
        ) : null}

        <div className="mx-0.5 h-4 w-px shrink-0 bg-[var(--border)]" aria-hidden />

        <Select value={languageId} onValueChange={(value) => onLanguageChange(value as CodebenchLanguageId)}>
          <SelectTrigger className={selectTrigger} aria-label="Language">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent className="border-[var(--border)] bg-[var(--popover)] text-[var(--cc-text)]">
            {CODEBENCH_LANGUAGE_OPTIONS.map((lang) => (
              <SelectItem key={lang.id} value={lang.id}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex shrink-0 items-center gap-1">
          {onSave ? (
            <Button
              type="button"
              variant="outline"
              onClick={onSave}
              disabled={!canSave}
              className="h-7 rounded-md border-[var(--border)] bg-[var(--card)] px-2 text-[12px] font-semibold"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          ) : null}
          {onRun ? (
            <>
              <Button
                onClick={onRun}
                disabled={!runEnabled || busy}
                className="h-7 rounded-md border-0 px-2.5 text-[12px] font-semibold shadow-none hover:opacity-90"
                style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
              >
                {runState === "compiling" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="mr-1 h-3.5 w-3.5" />
                )}
                {runState === "compiling" ? "Build" : "Run"}
              </Button>
              {busy && onStop ? (
                <Button
                  variant="outline"
                  onClick={onStop}
                  disabled={runState === "stopping"}
                  className="h-7 rounded-md border-[var(--border)] bg-[var(--card)] px-2"
                >
                  <Square className="h-3 w-3" />
                </Button>
              ) : null}
            </>
          ) : null}
          {onToggleQuestion ? (
            <Button
              type="button"
              variant={questionOpen ? "secondary" : "outline"}
              onClick={onToggleQuestion}
              className="h-7 rounded-md px-2 text-[12px] font-semibold"
            >
              <BookOpenCheck className="mr-1 h-3.5 w-3.5" />
              Question
            </Button>
          ) : null}
        </div>

        <div className="min-w-0 flex-1" />

        {onToggleEditorExpanded ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 rounded-md"
            onClick={onToggleEditorExpanded}
            aria-label={editorExpanded ? "Exit immersive editor" : "Expand editor"}
            title={editorExpanded ? "Exit immersive (Esc)" : "Expand editor"}
          >
            {editorExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        ) : null}

        {onToggleCora ? (
          <Button
            type="button"
            variant={coraOpen ? "secondary" : "ghost"}
            onClick={onToggleCora}
            className="h-7 rounded-md px-2 text-[12px] font-semibold"
          >
            <Sparkles className="mr-1 h-3.5 w-3.5" />
            Cora
          </Button>
        ) : null}

        <span className="hidden text-[10px] text-[var(--cc-text-muted)] lg:inline">
          {currentLanguage?.label ?? "C++"}
        </span>
      </div>
    </div>
  )
}
