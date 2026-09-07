"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Brain, Star, Bug, Eye, FileText, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"
import { motion } from "framer-motion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { CoraChatInput } from "@/components/cora/CoraChatInput"
import type { CoraLearningGoal } from "@/lib/cora/learning-goals"
import type { ChatAttachment } from "@/lib/cora/chat-attachments"
import type { CoraProblemContext } from "@/lib/cora/types"

const aiTutorTheme = getStudentModuleTheme("ai-tutor")

const QUICK_ACTIONS = [
  { id: "concept", label: "Explain a concept", icon: Brain },
  { id: "mini-lesson", label: "Micro-lesson", icon: Star },
  { id: "debug", label: "Fix my code", icon: Bug },
  { id: "debug-trace", label: "Execution trace", icon: Eye },
  { id: "doc-generator", label: "Generate docs", icon: FileText },
] as const

const MORE_TOOLS = [
  { id: "alternative-solutions", label: "Alternative solutions" },
  { id: "complexity-analysis", label: "Complexity analysis" },
  { id: "refactor-mode", label: "Refactor mode" },
  { id: "exam-prep-mode", label: "Exam prep" },
  { id: "explain-thinking", label: "Explain my thinking" },
  { id: "code-translator", label: "C++ → Python" },
] as const

interface BottomToolBarProps {
  onSendMessage?: (message: string) => void
  onQuickAction?: (action: string) => void
  onSuggestionSelect?: (prompt: string) => void
  learningGoal?: CoraLearningGoal
  onLearningGoalChange?: (goal: CoraLearningGoal) => void
  isLoading?: boolean
  variant?: "default" | "workspace"
  inputValue?: string
  onInputChange?: (value: string) => void
  placeholder?: string
  attachments?: ChatAttachment[]
  onRemoveAttachment?: (id: string) => void
  onFilesSelected?: (files: FileList) => void
  onImportCourseQuestion?: () => void
  importedQuestion?: CoraProblemContext | null
  importedQuestionLabel?: string | null
  onClearImportedQuestion?: () => void
  creditsLabel?: string | null
  creditsExhausted?: boolean
}

export function BottomToolBar({
  onSendMessage,
  onQuickAction,
  learningGoal = "understand",
  onLearningGoalChange,
  isLoading = false,
  variant = "default",
  inputValue: externalInputValue,
  onInputChange,
  placeholder,
  attachments,
  onRemoveAttachment,
  onFilesSelected,
  onImportCourseQuestion,
  importedQuestion,
  importedQuestionLabel,
  onClearImportedQuestion,
  creditsLabel = null,
  creditsExhausted = false,
}: BottomToolBarProps) {
  const [internalInputValue, setInternalInputValue] = useState("")
  const inputValue = externalInputValue !== undefined ? externalInputValue : internalInputValue
  const setInputValue = onInputChange || setInternalInputValue
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isWorkspace = variant === "workspace"

  useEffect(() => {
    if (!isWorkspace && textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [inputValue, isWorkspace])

  const handleSend = () => {
    if (inputValue.trim() && !isLoading) onSendMessage?.(inputValue.trim())
  }

  if (isWorkspace) {
    return (
      <CoraChatInput
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSend={(msg) => onSendMessage?.(msg)}
        onQuickAction={onQuickAction}
        attachments={attachments}
        onRemoveAttachment={onRemoveAttachment}
        onFilesSelected={onFilesSelected}
        onImportCourseQuestion={onImportCourseQuestion}
        importedQuestion={importedQuestion}
        importedQuestionLabel={importedQuestionLabel}
        onClearImportedQuestion={onClearImportedQuestion}
        learningGoal={learningGoal}
        onLearningGoalChange={onLearningGoalChange ?? (() => {})}
        isLoading={isLoading}
        placeholder={placeholder}
        creditsLabel={creditsLabel}
        creditsExhausted={creditsExhausted}
        className="w-full"
      />
    )
  }

  return (
    <div className="flex w-full flex-col gap-2 border-t border-neutral-200 bg-white/70 px-4 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <motion.button
              key={action.id}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onQuickAction?.(action.id)}
              title={action.label}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white/60 hover:bg-white dark:border-white/15 dark:bg-white/[0.06] dark:hover:bg-white/10"
            >
              <Icon className="h-4 w-4 text-[#582c83] dark:text-[#b8a0e0]" />
            </motion.button>
          )
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white/60 dark:border-white/15 dark:bg-white/[0.06]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>More tools</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {MORE_TOOLS.map(({ id, label }) => (
              <DropdownMenuItem key={id} onClick={() => onQuickAction?.(id)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex min-h-[44px] items-end gap-2 rounded-full border border-neutral-200 bg-white/80 py-1 pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-[#7a4eba]/50 dark:border-white/15 dark:bg-white/[0.06]">
        <Textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Ask anything about C++…"
          className="max-h-[120px] min-h-[36px] flex-1 resize-none border-0 bg-transparent py-2 text-sm shadow-none focus-visible:ring-0 dark:text-slate-100"
          disabled={isLoading}
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
          className={cn("mb-0.5 h-9 w-9 shrink-0 rounded-full text-white", aiTutorTheme.page.cta)}
          size="icon"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
