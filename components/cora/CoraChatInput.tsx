"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  ArrowUp,
  BookOpen,
  Brain,
  Bug,
  ChevronDown,
  ChevronRight,
  Code2,
  Eye,
  FileText,
  ImagePlus,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Plus,
  Star,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { motion, AnimatePresence } from "framer-motion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  CORA_LEARNING_GOALS,
  getLearningGoalMeta,
  type CoraLearningGoal,
} from "@/lib/cora/learning-goals"
import type { ChatAttachment } from "@/lib/cora/chat-attachments"
import type { CoraProblemContext } from "@/lib/cora/types"
import { CoraImportedQuestionPreview } from "@/components/cora/CoraImportedQuestionPreview"

const LEARNING_TOOLS = [
  { id: "concept", label: "Explain a concept", icon: Brain },
  { id: "mini-lesson", label: "Micro-lesson", icon: Star },
  { id: "debug", label: "Fix my code", icon: Bug },
  { id: "debug-trace", label: "Execution trace", icon: Eye },
  { id: "doc-generator", label: "Generate study notes", icon: FileText },
  { id: "paste-code", label: "Paste code", icon: Code2 },
] as const

const MORE_TOOLS = [
  { id: "alternative-solutions", label: "Alternative solutions" },
  { id: "complexity-analysis", label: "Complexity analysis" },
  { id: "refactor-mode", label: "Refactor mode" },
  { id: "exam-prep-mode", label: "Exam prep" },
  { id: "explain-thinking", label: "Explain my thinking" },
  { id: "code-translator", label: "C++ → Python" },
] as const

export type CoraChatModeOption = {
  id: string
  emoji?: string
  label: string
  shortLabel?: string
  tagline: string
}

export type CoraPlusMenuItem = {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  description?: string
}

type Props = {
  inputValue: string
  onInputChange: (v: string) => void
  onSend: (msg: string) => void
  learningGoal?: CoraLearningGoal
  onLearningGoalChange?: (goal: CoraLearningGoal) => void
  /** When set, replaces the learning-goal dropdown (e.g. Concept Explainer depth). */
  modeOptions?: CoraChatModeOption[]
  modeValue?: string
  onModeChange?: (id: string) => void
  modeMenuLabel?: string
  /** `attach` = files / photos / import only (no learning tools). */
  plusMenuVariant?: "full" | "attach"
  /** Custom items rendered in the + menu (replaces course import + learning tools). Fired via onQuickAction. */
  plusMenuItems?: CoraPlusMenuItem[]
  /** Label shown above custom plusMenuItems. */
  plusMenuItemsLabel?: string
  onQuickAction?: (action: string) => void
  attachments?: ChatAttachment[]
  onRemoveAttachment?: (id: string) => void
  onFilesSelected?: (files: FileList) => void
  onImportCourseQuestion?: () => void
  importedQuestion?: CoraProblemContext | null
  importedQuestionLabel?: string | null
  onClearImportedQuestion?: () => void
  isLoading?: boolean
  className?: string
  placeholder?: string
  creditsLabel?: string | null
  creditsExhausted?: boolean
}

export function CoraChatInput({
  inputValue,
  onInputChange,
  onSend,
  learningGoal = "understand",
  onLearningGoalChange,
  modeOptions,
  modeValue,
  onModeChange,
  modeMenuLabel = "How can I help you today?",
  plusMenuVariant = "full",
  plusMenuItems,
  plusMenuItemsLabel = "Tools",
  onQuickAction,
  attachments = [],
  onRemoveAttachment,
  onFilesSelected,
  onImportCourseQuestion,
  importedQuestion,
  importedQuestionLabel,
  onClearImportedQuestion,
  isLoading = false,
  className,
  placeholder = "How can I help you today?",
  creditsLabel = null,
  creditsExhausted = false,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const plusBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)
  const [attachExpanded, setAttachExpanded] = useState(false)
  const [moreToolsExpanded, setMoreToolsExpanded] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [dictationSupported, setDictationSupported] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{
    left: number
    bottom: number
    width: number
    maxHeight: number
  } | null>(null)
  const [mounted, setMounted] = useState(false)
  const canSend =
    (inputValue.trim().length > 0 || attachments.length > 0 || !!importedQuestion) &&
    !isLoading &&
    !creditsExhausted
  const hasPlusMenuContent =
    plusMenuVariant === "full" ||
    Boolean(onFilesSelected) ||
    Boolean(plusMenuItems?.length) ||
    Boolean(onImportCourseQuestion)
  const useCustomModes = Boolean(modeOptions?.length)
  const activeMode = useCustomModes
    ? modeOptions!.find((m) => m.id === modeValue) ?? modeOptions![0]
    : null
  const goalMeta = getLearningGoalMeta(learningGoal)
  const modeTriggerLabel = useCustomModes
    ? `${activeMode?.emoji ? `${activeMode.emoji} ` : ""}${activeMode?.shortLabel ?? activeMode?.label ?? "Mode"}`
    : `${goalMeta.emoji} ${goalMeta.shortLabel}`

  useEffect(() => {
    setMounted(true)
    const w = window as typeof window & {
      SpeechRecognition?: new () => any
      webkitSpeechRecognition?: new () => any
    }
    setDictationSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  const toggleDictation = () => {
    const w = window as typeof window & {
      SpeechRecognition?: new () => any
      webkitSpeechRecognition?: new () => any
    }
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"
    recognition.onresult = (event: {
      resultIndex: number
      results: ArrayLike<{ 0?: { transcript?: string }; isFinal?: boolean }>
    }) => {
      let transcript = ""
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i]?.[0]?.transcript ?? ""
      }
      const next = `${inputValue}${inputValue && !inputValue.endsWith(" ") ? " " : ""}${transcript}`.trimStart()
      onInputChange(next)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const updateMenuPosition = useCallback(() => {
    const btn = plusBtnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setMenuStyle({
      left: rect.left,
      bottom: window.innerHeight - rect.top + 12,
      width: Math.min(320, window.innerWidth - 24),
      maxHeight: Math.min(window.innerHeight - 48, rect.top - 16),
    })
  }, [])

  useEffect(() => {
    if (!attachExpanded) {
      setMenuStyle(null)
      return
    }
    updateMenuPosition()
    window.addEventListener("resize", updateMenuPosition)
    window.addEventListener("scroll", updateMenuPosition, true)
    return () => {
      window.removeEventListener("resize", updateMenuPosition)
      window.removeEventListener("scroll", updateMenuPosition, true)
    }
  }, [attachExpanded, updateMenuPosition])

  useEffect(() => {
    if (!attachExpanded) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || plusBtnRef.current?.contains(target)) return
      setAttachExpanded(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [attachExpanded])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [inputValue])

  const send = () => {
    if (canSend) onSend(inputValue.trim())
  }

  const runAction = (actionId: string) => {
    onQuickAction?.(actionId)
    setAttachExpanded(false)
  }

  const openFilePicker = () => {
    fileInputRef.current?.click()
    setAttachExpanded(false)
  }

  const openPhotoPicker = () => {
    photoInputRef.current?.click()
    setAttachExpanded(false)
  }

  const toggleAttachMenu = () => {
    if (attachExpanded) {
      setAttachExpanded(false)
      setMoreToolsExpanded(false)
      setMenuStyle(null)
      return
    }
    const btn = plusBtnRef.current
    if (btn) {
      const rect = btn.getBoundingClientRect()
      setMenuStyle({
        left: rect.left,
        bottom: window.innerHeight - rect.top + 12,
        width: Math.min(320, window.innerWidth - 24),
        maxHeight: Math.min(window.innerHeight - 48, rect.top - 16),
      })
    }
    setAttachExpanded(true)
  }

  const attachMenu =
    attachExpanded && menuStyle && mounted ? (
      <div
        ref={menuRef}
        style={{
          position: "fixed",
          left: menuStyle.left,
          bottom: menuStyle.bottom,
          width: menuStyle.width,
          maxHeight: menuStyle.maxHeight,
          zIndex: 9999,
        }}
        className="max-h-[min(calc(100vh-6rem),720px)] overflow-y-auto overscroll-contain rounded-3xl border border-neutral-200/80 bg-white py-2 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#1e1e24]"
      >
        {onFilesSelected ? (
          <>
            <button
              type="button"
              onClick={openFilePicker}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-neutral-800 transition-colors hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-white/[0.06]"
            >
              <Paperclip className="h-4 w-4 shrink-0 text-neutral-500" />
              Upload files
            </button>
            <button
              type="button"
              onClick={openPhotoPicker}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-neutral-800 transition-colors hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-white/[0.06]"
            >
              <ImagePlus className="h-4 w-4 shrink-0 text-neutral-500" />
              Upload photos
            </button>
          </>
        ) : null}
        {plusMenuItems?.length ? (
          <>
            {onFilesSelected ? (
              <div className="my-1.5 border-t border-neutral-100 dark:border-white/10" />
            ) : null}
            <p className="px-4 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {plusMenuItemsLabel}
            </p>
            {plusMenuItems.map(({ id, label, icon: Icon, description }) => (
              <button
                key={id}
                type="button"
                onClick={() => runAction(id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-neutral-800 transition-colors hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-white/[0.06]"
              >
                {Icon ? <Icon className="h-4 w-4 shrink-0 text-neutral-500" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block">{label}</span>
                  {description ? (
                    <span className="block truncate text-xs text-neutral-500">{description}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </>
        ) : null}
        {!plusMenuItems?.length && onImportCourseQuestion ? (
          <button
            type="button"
            onClick={() => {
              onImportCourseQuestion?.()
              setAttachExpanded(false)
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-neutral-800 transition-colors hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-white/[0.06]"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-neutral-500" />
            Import from course
          </button>
        ) : null}
        {plusMenuVariant === "full" && !plusMenuItems?.length ? (
          <>
            <div className="my-1.5 border-t border-neutral-100 dark:border-white/10" />
            {LEARNING_TOOLS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => runAction(id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-neutral-800 transition-colors hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-white/[0.06]"
              >
                <Icon className="h-4 w-4 shrink-0 text-neutral-500" />
                {label}
              </button>
            ))}
            <div className="my-1.5 border-t border-neutral-100 dark:border-white/10" />
            <button
              type="button"
              onClick={() => setMoreToolsExpanded((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-sm text-neutral-800 transition-colors hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-white/[0.06]"
            >
              <span className="flex items-center gap-3">
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-neutral-500 transition-transform",
                    moreToolsExpanded && "rotate-90",
                  )}
                />
                More tools
              </span>
            </button>
            {moreToolsExpanded
              ? MORE_TOOLS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => runAction(id)}
                    className="flex w-full items-center gap-3 py-2 pl-10 pr-4 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/[0.06]"
                  >
                    {label}
                  </button>
                ))
              : null}
          </>
        ) : null}
      </div>
    ) : null

  return (
    <div className={cn("relative w-full", className)}>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".txt,.md,.csv,.json,.cpp,.c,.h,.hpp,.py,.java,.js,.ts,.tsx,.jsx,.html,.css,.xml,.yaml,.yml,.tex,.pdf"
        onChange={(e) => {
          if (e.target.files?.length) onFilesSelected?.(e.target.files)
          e.target.value = ""
        }}
      />
      <input
        ref={photoInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*"
        onChange={(e) => {
          if (e.target.files?.length) onFilesSelected?.(e.target.files)
          e.target.value = ""
        }}
      />

      {mounted && attachMenu ? createPortal(attachMenu, document.body) : null}

      {creditsLabel ? (
        <p
          className={cn(
            "mb-2 px-1 text-[11px]",
            creditsExhausted ? "font-medium text-amber-700 dark:text-amber-300" : "text-neutral-500",
          )}
        >
          {creditsExhausted
            ? "No weekly credits left — upgrade or wait for reset before sending."
            : creditsLabel}
        </p>
      ) : null}

      <div
        className={cn(
          "flex flex-col rounded-[28px] border border-neutral-200/80 bg-white px-4 pb-3 pt-4",
          "shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition-shadow",
          "focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.08)]",
          "dark:border-white/10 dark:bg-[#1c1c22]",
        )}
      >
        {importedQuestion ? (
          <CoraImportedQuestionPreview
            label={importedQuestionLabel}
            problem={importedQuestion}
            compact
            onClear={onClearImportedQuestion}
            className="mb-2"
          />
        ) : null}

        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <span
                key={att.id}
                className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full bg-neutral-100 py-1 pl-2 pr-1 text-xs text-neutral-700 dark:bg-white/[0.08] dark:text-neutral-200"
              >
                {att.kind === "image" && att.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={att.dataUrl} alt="" className="h-5 w-5 rounded object-cover" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                )}
                <span className="truncate">{att.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment?.(att.id)}
                  className="rounded-full p-0.5 hover:bg-neutral-200 dark:hover:bg-white/10"
                  aria-label={`Remove ${att.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <Textarea
          ref={ref}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className="max-h-40 min-h-[28px] w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-relaxed text-neutral-900 shadow-none placeholder:text-neutral-400 focus-visible:ring-0 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {hasPlusMenuContent ? (
              <button
                ref={plusBtnRef}
                type="button"
                onClick={toggleAttachMenu}
                aria-label={attachExpanded ? "Close menu" : "Add attachments and tools"}
                aria-expanded={attachExpanded}
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/[0.08]"
              >
                {attachExpanded ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
              </button>
            ) : null}
            {dictationSupported ? (
              <button
                type="button"
                onClick={toggleDictation}
                aria-label={isListening ? "Stop dictation" : "Start voice dictation"}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  isListening
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/[0.08]",
                )}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-0.5 rounded-full px-2 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/[0.08]"
                >
                  {modeTriggerLabel}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-64 rounded-2xl">
                <DropdownMenuLabel className="text-xs font-normal text-neutral-500">
                  {modeMenuLabel}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {useCustomModes
                  ? modeOptions!.map((mode) => (
                      <DropdownMenuItem
                        key={mode.id}
                        onClick={() => onModeChange?.(mode.id)}
                        className={cn(
                          "flex flex-col items-start gap-0.5 py-2.5",
                          modeValue === mode.id && "bg-neutral-50 dark:bg-white/[0.06]",
                        )}
                      >
                        <span className="text-sm font-medium">
                          {mode.emoji ? `${mode.emoji} ` : ""}
                          {mode.label}
                        </span>
                        <span className="text-xs text-neutral-500">{mode.tagline}</span>
                      </DropdownMenuItem>
                    ))
                  : CORA_LEARNING_GOALS.map((goal) => (
                      <DropdownMenuItem
                        key={goal.id}
                        onClick={() => onLearningGoalChange?.(goal.id)}
                        className={cn(
                          "flex flex-col items-start gap-0.5 py-2.5",
                          learningGoal === goal.id && "bg-neutral-50 dark:bg-white/[0.06]",
                        )}
                      >
                        <span className="text-sm font-medium">
                          {goal.emoji} {goal.label}
                        </span>
                        <span className="text-xs text-neutral-500">{goal.tagline}</span>
                      </DropdownMenuItem>
                    ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              aria-label="Send"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full transition-all",
                canSend
                  ? "bg-[#d3e3fd] text-neutral-900 hover:bg-[#c2d7fc] dark:bg-sky-500/30 dark:text-white"
                  : "bg-neutral-100 text-neutral-300 dark:bg-white/[0.06] dark:text-neutral-600",
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
