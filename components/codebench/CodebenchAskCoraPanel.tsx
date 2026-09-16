"use client"

import { useEffect, useRef, useState } from "react"
import { Maximize2, Minimize2 } from "lucide-react"
import { CoraBotMark } from "@/components/cora/CoraBotMark"
import { CoraImportedQuestionPreview } from "@/components/cora/CoraImportedQuestionPreview"
import { Button } from "@/components/ui/button"
import { CoraChatInput } from "@/components/cora/CoraChatInput"
import { CoraQuestionImportDialog } from "@/components/cora/CoraQuestionImportDialog"
import { CoraThinkingIndicator } from "@/components/cora/CoraThinkingIndicator"
import { CoraWorkspaceChatMessage } from "@/components/cora/CoraWorkspaceChatMessage"
import { CORA_NAME } from "@/lib/cora/constants"
import type { CoraLearningGoal } from "@/lib/cora/learning-goals"
import type { CoraProblemContext } from "@/lib/cora/types"
import {
  buildAttachmentContext,
  imageAttachmentsForApi,
  processChatFiles,
  type ChatAttachment,
} from "@/lib/cora/chat-attachments"
import { awardXP } from "@/lib/codebench-xp"
import {
  challengeToCoraProblem,
  consumeCodebenchChallengeHandoff,
} from "@/lib/codebench-challenge-handoff"
import { cn } from "@/lib/utils"
import { withCodebenchCoraContext } from "@/lib/codebench-cora-client"

type Message = {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

type Props = {
  code: string
  studentId: string | null
  language?: string
  learningMode?: "beginner" | "intermediate" | "expert"
  cachedMessages?: Message[]
  onMessagesChange?: (messages: Message[]) => void
  theme?: "light" | "dark"
  className?: string
  initialImportedQuestion?: CoraProblemContext | null
  initialImportedLabel?: string | null
  /** When true, do not read sessionStorage handoff (drawer supplies import). */
  skipHandoffConsume?: boolean
  /** Keep imported question context after each reply (quiz / assessment drawers). */
  retainImportedQuestion?: boolean
  /** Hide the Ask Cora title bar when a parent already shows the tool. */
  hideChrome?: boolean
  /** Quiz / homework / practice drawer — parent header, themed question preview. */
  assessmentEmbed?: boolean
  /** When true, this chat is a CodeBench Cora action (membership-gated). */
  codebenchCora?: boolean
  coraAccess?: boolean
  onLockedCora?: (label: string) => void
}

export function CodebenchAskCoraPanel({
  code,
  studentId,
  language = "cpp",
  learningMode = "intermediate",
  cachedMessages,
  onMessagesChange,
  theme = "dark",
  className,
  initialImportedQuestion = null,
  initialImportedLabel = null,
  skipHandoffConsume = false,
  retainImportedQuestion = false,
  hideChrome = false,
  assessmentEmbed = false,
  codebenchCora = false,
  coraAccess = true,
  onLockedCora,
}: Props) {
  const chromeHidden = hideChrome || assessmentEmbed
  const isLight = theme === "light"
  const [messages, setMessages] = useState<Message[]>(cachedMessages || [])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [learningGoal, setLearningGoal] = useState<CoraLearningGoal>("understand")
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [importedQuestion, setImportedQuestion] = useState<CoraProblemContext | null>(
    initialImportedQuestion,
  )
  const [importedLabel, setImportedLabel] = useState<string | null>(initialImportedLabel)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (cachedMessages?.length) setMessages(cachedMessages)
  }, [cachedMessages])

  useEffect(() => {
    if (initialImportedQuestion) {
      setImportedQuestion(initialImportedQuestion)
      setImportedLabel(initialImportedLabel)
      setLearningGoal("solve_together")
    }
  }, [initialImportedQuestion, initialImportedLabel])

  useEffect(() => {
    if (skipHandoffConsume) return
    const handoff = consumeCodebenchChallengeHandoff()
    if (!handoff || handoff.intent === "solve") return
    setImportedQuestion(challengeToCoraProblem(handoff))
    setImportedLabel(`Daily challenge · ${handoff.title}`)
    setLearningGoal("solve_together")
  }, [skipHandoffConsume])

  useEffect(() => {
    onMessagesChange?.(messages)
  }, [messages, onMessagesChange])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const sendMessage = async (rawInput?: string) => {
    if (codebenchCora && !coraAccess) {
      onLockedCora?.("Ask Cora")
      return
    }
    const text = (rawInput ?? input).trim()
    // Require an actual student question/message; imported challenge alone is not enough to send.
    if (!text || isLoading || !studentId) return

    let messageContent = text + buildAttachmentContext(attachments)

    const codeContext =
      code.trim().length > 10
        ? `\n\nStudent editor code (${language}):\n\`\`\`${language}\n${code}\n\`\`\``
        : ""

    const userMessage: Message = {
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setAttachments([])
    setIsLoading(true)

    try {
      const response = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          message: messageContent + codeContext,
          attachments: imageAttachmentsForApi(attachments),
          problemContext: importedQuestion ?? undefined,
          context: (() => {
            const ctx = {
              topic: "tutor",
              learningMode,
              importedQuestion: importedQuestion ?? undefined,
              attemptId: importedQuestion?.attemptId,
              quizId: importedQuestion?.quizId,
              codeContext: code.trim().length > 10 ? code : undefined,
            }
            return codebenchCora ? withCodebenchCoraContext(ctx) : ctx
          })(),
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response || data.message || "No response received.",
          timestamp: new Date(),
        },
      ])

      if (text) awardXP("TUTOR_QUESTION")
      if (!retainImportedQuestion) {
        setImportedQuestion(null)
        setImportedLabel(null)
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Could not reach Cora."}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-[320px] flex-col overflow-hidden",
        assessmentEmbed
          ? "rounded-xl border border-[var(--border)] bg-[var(--card)]"
          : chromeHidden
            ? ""
            : cn("rounded-xl border", isLight ? "border-slate-200 bg-white" : "border-[#582c83]/25 bg-[#0a0e14]"),
        expanded && "fixed inset-4 z-[70] min-h-0 shadow-2xl",
        className,
      )}
    >
      {chromeHidden && !assessmentEmbed ? (
        <div className="flex shrink-0 justify-end px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "Exit fullscreen" : "Fullscreen"}
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      ) : null}
      {!chromeHidden ? (
      <div
        className={cn(
          "flex shrink-0 items-center justify-between border-b px-4 py-2.5",
          isLight ? "border-slate-200 bg-slate-50" : "border-[#582c83]/25 bg-[#0c1018]",
        )}
      >
        <div>
          <p className={cn("text-sm font-semibold", isLight ? "text-slate-900" : "text-white")}>
            Ask {CORA_NAME}
          </p>
          <p className={cn("text-xs", isLight ? "text-slate-500" : "text-slate-400")}>
            Attach files, import course questions, or chat about your code.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Exit fullscreen" : "Fullscreen"}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
        {assessmentEmbed && importedQuestion ? (
          <CoraImportedQuestionPreview
            label={importedLabel}
            problem={importedQuestion}
            compact
            variant="theme"
            collapsible
            defaultCollapsed
          />
        ) : null}

        {messages.length === 0 ? (
          <div
            className={cn(
              "text-center text-sm",
              assessmentEmbed ? "mt-2" : "mt-6",
              isLight ? "text-slate-500" : "text-slate-400",
            )}
          >
            <CoraBotMark size="md" idle className="mx-auto mb-2" decorative />
            <p className="font-medium">
              {importedQuestion
                ? assessmentEmbed
                  ? "Ask about this question"
                  : "Challenge attached — ask your question"
                : "Start a tutoring session"}
            </p>
            <p className="mt-1 text-xs">
              {importedQuestion
                ? assessmentEmbed
                  ? "Cora sees this question and your attempt context. Ask for a hint or clarification — not the final answer."
                  : "Type a hint request or question below. Cora will use the imported daily challenge with your message."
                : "Import a quiz question or attach a screenshot of your work."}
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <CoraWorkspaceChatMessage
              key={`${message.timestamp.getTime()}-${index}`}
              role={message.role}
              content={message.content}
              theme={theme}
            />
          ))
        )}

        {isLoading ? (
          <CoraThinkingIndicator learningGoal={learningGoal} theme={theme} className="max-w-md" />
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <div
        className={cn(
          "shrink-0 border-t p-3",
          assessmentEmbed
            ? "border-[var(--border)] bg-[var(--card)]"
            : isLight
              ? "border-slate-200 bg-white"
              : "border-[#582c83]/25 bg-[#0a0e14]",
        )}
      >
        <CoraChatInput
          inputValue={input}
          onInputChange={setInput}
          onSend={(msg) => void sendMessage(msg)}
          learningGoal={learningGoal}
          onLearningGoalChange={setLearningGoal}
          attachments={attachments}
          onRemoveAttachment={(id) => setAttachments((prev) => prev.filter((item) => item.id !== id))}
          onFilesSelected={async (files) => {
            const next = await processChatFiles(Array.from(files))
            setAttachments((prev) => [...prev, ...next].slice(0, 5))
          }}
          onImportCourseQuestion={() => setImportOpen(true)}
          importedQuestion={importedQuestion}
          importedQuestionLabel={importedLabel}
          onClearImportedQuestion={
            retainImportedQuestion
              ? undefined
              : () => {
                  setImportedQuestion(null)
                  setImportedLabel(null)
                }
          }
          showImportedQuestionPreview={!assessmentEmbed}
          isLoading={isLoading || !studentId}
          placeholder={
            importedQuestion
              ? "Ask about this challenge — e.g. Where should I start?"
              : "Ask Cora about your code, attach files, or import a course question…"
          }
        />
      </div>

      <CoraQuestionImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        studentId={studentId ?? undefined}
        onImport={(problem, item) => {
          setImportedQuestion(problem)
          setImportedLabel(item.label || "Imported question")
          setImportOpen(false)
        }}
      />
    </div>
  )
}
