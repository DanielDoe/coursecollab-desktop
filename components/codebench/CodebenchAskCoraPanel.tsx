"use client"

import { useEffect, useRef, useState } from "react"
import { Maximize2, Minimize2 } from "lucide-react"
import { CoraBotMark } from "@/components/cora/CoraBotMark"
import { Button } from "@/components/ui/button"
import { CoraChatInput } from "@/components/cora/CoraChatInput"
import { CoraQuestionImportDialog } from "@/components/cora/CoraQuestionImportDialog"
import { CoraThinkingIndicator } from "@/components/cora/CoraThinkingIndicator"
import { CoraWorkspaceChatMessage } from "@/components/cora/CoraWorkspaceChatMessage"
import { CoraUiPayloadCard } from "@/components/cora/CoraUiPayloadCard"
import { CoraFollowUps } from "@/components/cora/CoraFollowUps"
import { applyUnifiedDiff, followUpsForCoraUi, type CoraUiPayload } from "@/lib/cora/models/ui-payloads"
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
import { reportClientError } from "@/lib/system-log-client"

type Message = {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  ui?: CoraUiPayload
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
  onApplyCode?: (next: string) => void
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
  onApplyCode,
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
  const scrollerRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  const importSyncKey = initialImportedQuestion
    ? [
        initialImportedQuestion.source,
        initialImportedQuestion.questionId ?? "",
        initialImportedQuestion.quizId ?? "",
        initialImportedQuestion.questionText.slice(0, 80),
        initialImportedLabel ?? "",
      ].join("|")
    : ""
  const importedQuestionRef = useRef(initialImportedQuestion)
  const importedLabelRef = useRef(initialImportedLabel)
  importedQuestionRef.current = initialImportedQuestion
  importedLabelRef.current = initialImportedLabel

  useEffect(() => {
    if (cachedMessages?.length) setMessages(cachedMessages)
  }, [cachedMessages])

  useEffect(() => {
    const next = importedQuestionRef.current
    if (!next) return
    setImportedQuestion(next)
    setImportedLabel(importedLabelRef.current)
  }, [importSyncKey])

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

  const handleThreadScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96
  }

  const jumpToPrompt = (index: number) => {
    const el = scrollerRef.current
    const target = el?.querySelector(`[data-cora-message-index="${index}"]`)
    if (!el || !(target instanceof HTMLElement)) return
    stickToBottomRef.current = false
    const top = target.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 8
    el.scrollTo({ top, behavior: "smooth" })
  }

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !stickToBottomRef.current) return
    el.scrollTo({ top: el.scrollHeight })
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
          conversationHistory: messages.slice(-8).map((msg) => ({
            role: msg.role === "user" ? "student" : "assistant",
            content: msg.content,
          })),
          chatConfig: { learningGoal },
          problemContext: importedQuestion ?? undefined,
          context: (() => {
            const ctx = {
              topic: "tutor",
              learningMode,
              learningGoal,
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
          ui: data.ui,
          timestamp: new Date(),
        },
      ])

      if (text) awardXP("TUTOR_QUESTION")
      if (!retainImportedQuestion) {
        setImportedQuestion(null)
        setImportedLabel(null)
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Could not reach Cora."
      reportClientError({
        severity: "error",
        category: "api",
        title: assessmentEmbed ? "Ask Cora failed in quiz taker" : "Ask Cora failed",
        errorMessage: messageText,
        stackTrace: error instanceof Error ? error.stack : undefined,
        moduleName: assessmentEmbed ? "Quiz Module" : "Cora",
        featureName: "Ask Cora",
        apiEndpoint: "/api/ai-tutor",
        httpMethod: "POST",
        metadata: { learningGoal, assessmentEmbed },
      })
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${messageText}`,
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

      <div
        ref={scrollerRef}
        onScroll={handleThreadScroll}
        className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-4"
      >
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
              {importedQuestion && !assessmentEmbed
                ? "Challenge attached — ask your question"
                : assessmentEmbed
                  ? "Ask Cora a reference question"
                  : "Ask about the code in the editor"}
            </p>
            <p className="mt-1 text-xs">
              {assessmentEmbed
                ? "The question stays on the quiz. Ask about syntax or a concept, not the finished solution."
                : "Cora can explain a line or propose a diff you apply to the open buffer."}
            </p>
          </div>
        ) : (
          <>
            {messages.filter((message) => message.role === "user" && message.content.trim()).length >= 3 ? (
              <div className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto bg-inherit pb-1">
                {messages.map((message, index) =>
                  message.role === "user" && message.content.trim() ? (
                    <button
                      key={`prompt-${index}`}
                      type="button"
                      title={message.content}
                      className="max-w-[140px] shrink-0 truncate rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--cc-text-muted)]"
                      onClick={() => jumpToPrompt(index)}
                    >
                      {message.content.replace(/\s+/g, " ").slice(0, 28)}
                    </button>
                  ) : null,
                )}
              </div>
            ) : null}
            {messages.map((message, index) => (
              <div key={`${message.timestamp.getTime()}-${index}`} data-cora-message-index={index}>
                <CoraWorkspaceChatMessage
                  role={message.role}
                  content={message.content}
                  theme={theme}
                />
                {message.ui ? (
                  <CoraUiPayloadCard
                    ui={message.ui}
                    portal="student"
                    onApplyCode={onApplyCode}
                    applyDiff={
                      onApplyCode ? (diff) => applyUnifiedDiff(code, diff) : undefined
                    }
                  />
                ) : null}
                {message.role === "assistant" && index === messages.length - 1 ? (
                  <CoraFollowUps
                    className="pl-10 pr-2"
                    prompts={followUpsForCoraUi(message.ui, "student", "codebench")}
                    disabled={isLoading}
                    onSelect={(prompt) => void sendMessage(prompt)}
                  />
                ) : null}
              </div>
            ))}
          </>
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
          onImportCourseQuestion={assessmentEmbed ? undefined : () => setImportOpen(true)}
          importedQuestion={assessmentEmbed ? null : importedQuestion}
          importedQuestionLabel={assessmentEmbed ? null : importedLabel}
          onClearImportedQuestion={
            assessmentEmbed || retainImportedQuestion
              ? undefined
              : () => {
                  setImportedQuestion(null)
                  setImportedLabel(null)
                }
          }
          showImportedQuestionPreview={!assessmentEmbed}
          isLoading={isLoading || !studentId}
          placeholder={
            assessmentEmbed
              ? "Ask about syntax or a concept — not for the finished solution"
              : importedQuestion
                ? "Ask how to declare a variable, the syntax of a loop, or where to start — not for the finished solution."
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
