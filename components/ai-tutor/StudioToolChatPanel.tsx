"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Sparkles, X } from "lucide-react"
import { AiFeedbackMarkdown } from "@/components/ai-feedback-markdown"
import { CoraChatBubble } from "@/components/cora/CoraChatBubble"
import { CoraChatInput } from "@/components/cora/CoraChatInput"
import { CoraQuestionImportDialog } from "@/components/cora/CoraQuestionImportDialog"
import { Button } from "@/components/ui/button"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { useCoraContentPalette } from "@/hooks/use-cora-content-palette"
import {
  CORA_CHAT_PALETTE_DARK,
  CORA_CHAT_PALETTE_LIGHT,
} from "@/lib/cora/chat-bubble-theme"
import {
  buildAttachmentContext,
  imageAttachmentsForApi,
  processChatFiles,
  type ChatAttachment,
} from "@/lib/cora/chat-attachments"
import type { CoraImportableItem } from "@/lib/cora/question-import-types"
import type { CoraProblemContext } from "@/lib/cora/types"
import { getStudioToolChatConfig } from "@/lib/cora/studio-tool-chat"
import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import { deriveFocusTopics } from "@/lib/cora/study-plan-workspace"

type ChatRole = "student" | "ai"

type ToolChatMessage = {
  id: string
  role: ChatRole
  content: string
  related?: string[]
}

type Props = {
  toolId: string
  studentId: string
  onClose: () => void
  studentContext?: CoraStudentContextPayload | null
  autoStart?: boolean
}

export function StudioToolChatPanel({
  toolId,
  studentId,
  onClose,
  studentContext = null,
  autoStart = false,
}: Props) {
  const config = getStudioToolChatConfig(toolId)
  const { tokens } = useAppearance()
  const { soft, accent, cta } = useCoraContentPalette()
  const isDark = tokens.isDark
  const bubblePalette = isDark ? CORA_CHAT_PALETTE_DARK : CORA_CHAT_PALETTE_LIGHT
  const hairline = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"
  const chipBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"
  const cardBg = isDark ? "rgba(255,255,255,0.05)" : "var(--cc-surface)"
  const muted = "var(--cc-text-muted)"
  const ink = "var(--cc-text)"

  const seedTopic =
    deriveFocusTopics(studentContext)[0] ||
    config?.starters[0] ||
    "today's focus topic"

  const [mode, setMode] = useState(config?.defaultMode ?? "course")
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [activeTopic, setActiveTopic] = useState<string | null>(null)
  const [messages, setMessages] = useState<ToolChatMessage[]>([])
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [importedProblem, setImportedProblem] = useState<CoraProblemContext | null>(null)
  const [importedLabel, setImportedLabel] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoStartedRef = useRef(false)

  useEffect(() => {
    setMode(config?.defaultMode ?? "course")
    setInput("")
    setLoading(false)
    setActiveTopic(null)
    setMessages([])
    setAttachments([])
    setImportedProblem(null)
    setImportedLabel(null)
    autoStartedRef.current = false
  }, [toolId, config?.defaultMode])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  const handleFilesSelected = useCallback(async (files: FileList) => {
    const processed = await processChatFiles(Array.from(files))
    if (processed.length === 0) return
    setAttachments((prev) => [...prev, ...processed].slice(0, 5))
  }, [])

  const send = useCallback(
    async (raw: string, opts?: { asTopic?: boolean }) => {
      if (!config) return
      const text = raw.trim()
      const hasContext = attachments.length > 0 || !!importedProblem
      if ((!text && !hasContext) || loading) return

      const asTopic = opts?.asTopic ?? (!activeTopic || messages.length === 0)
      const topicSeed = text || importedLabel || importedProblem?.title || "this material"
      const topic = asTopic ? topicSeed : activeTopic
      const userContent = asTopic
        ? text
          ? text
          : `Use: ${importedLabel || importedProblem?.title || "attached material"}`
        : text || "Continue with the attached material."

      let apiMessage = asTopic ? config.buildPrompt(topicSeed, mode) : text || "Continue with the new material."
      if (importedProblem) {
        const excerpt = [importedProblem.title, importedProblem.questionText, importedProblem.explanation]
          .filter(Boolean)
          .join("\n")
          .slice(0, 4000)
        apiMessage += `\n\nImported course material (${importedLabel || importedProblem.title || "item"}):\n${excerpt}`
      }
      apiMessage += buildAttachmentContext(attachments)

      if (asTopic) setActiveTopic(topicSeed)

      const userMsg: ToolChatMessage = {
        id: `u-${Date.now()}`,
        role: "student",
        content: userContent,
      }
      setMessages((prev) => [...prev, userMsg])
      setInput("")
      const attachmentsForSend = attachments
      const problemForSend = importedProblem
      setAttachments([])
      setImportedProblem(null)
      setImportedLabel(null)
      setLoading(true)

      try {
        const history = [...messages, userMsg].slice(-8).map((m) => ({
          role: m.role,
          content: m.content,
        }))

        const response = await fetch("/api/ai-tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: apiMessage,
            studentId,
            context: {
              topic: topic ?? topicSeed,
              mode: `studio-${config.id}`,
            },
            conversationHistory: history,
            chatConfig: { learningGoal: config.learningGoal ?? "understand" },
            attachments: imageAttachmentsForApi(attachmentsForSend),
            problemContext: problemForSend ?? undefined,
            useAgent: true,
          }),
        })

        if (!response.ok) throw new Error("Failed")

        const data = await response.json()
        const content = String(
          data.response ?? data.result ?? "I couldn't generate a response. Please try again.",
        )
        const related = config.parseRelated?.(content)

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "ai",
            content,
            related: related?.length ? related : undefined,
          },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "ai",
            content: "Something went wrong. Please try again.",
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [
      activeTopic,
      attachments,
      config,
      importedLabel,
      importedProblem,
      loading,
      messages,
      mode,
      studentId,
    ],
  )

  useEffect(() => {
    if (!autoStart || !config?.autoGenerateOnOpen || autoStartedRef.current) return
    if (messages.length > 0 || loading) return
    autoStartedRef.current = true
    void send(seedTopic, { asTopic: true })
  }, [autoStart, config?.autoGenerateOnOpen, loading, messages.length, seedTopic, send])

  if (!config) return null

  const Icon = config.icon

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ background: "var(--cc-background)", color: "var(--cc-text)" }}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5"
        style={{
          background: isDark ? "rgba(255,255,255,0.04)" : soft,
          boxShadow: `inset 0 -1px 0 ${hairline}`,
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: isDark ? "rgba(255,255,255,0.1)" : soft,
              boxShadow: `inset 0 0 0 1px ${hairline}`,
            }}
          >
            <Icon className="h-5 w-5" style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            {config.workspaceLabel ? (
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: muted }}>
                {config.workspaceLabel}
              </p>
            ) : null}
            <h2 className="text-base font-semibold tracking-tight sm:text-lg" style={{ color: ink }}>
              {config.title}
            </h2>
            <p className="text-xs sm:text-sm" style={{ color: muted }}>
              {config.subtitle}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 rounded-full">
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl">
          {messages.length === 0 && !loading ? (
            <div className="space-y-6">
              <div className="rounded-2xl px-5 py-6" style={{ background: cardBg }}>
                <p className="text-sm font-semibold" style={{ color: ink }}>
                  {config.heroTitle}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: muted }}>
                  {config.heroBody}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    style={{ background: cta.bg, color: cta.fg }}
                    onClick={() => void send(seedTopic, { asTopic: true })}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    {config.primaryCta ?? "Generate"} · {seedTopic}
                  </Button>
                </div>
              </div>

              {config.starters.length > 0 ? (
                <div>
                  <p
                    className="mb-2 text-xs font-medium uppercase tracking-wide"
                    style={{ color: muted }}
                  >
                    Or pick a focus
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {config.starters.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => void send(label, { asTopic: true })}
                        className="rounded-full px-3 py-1.5 text-left text-sm transition-opacity hover:opacity-90"
                        style={{ background: chipBg, color: ink }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {messages.map((msg, idx) => {
            const isLastAi = msg.role === "ai" && idx === messages.length - 1 && !loading
            return (
              <div key={msg.id}>
                <CoraChatBubble role={msg.role} palette={bubblePalette} isDark={isDark}>
                  {msg.role === "ai" ? (
                    <AiFeedbackMarkdown text={msg.content} className="text-[15px]" />
                  ) : (
                    msg.content
                  )}
                </CoraChatBubble>

                {isLastAi && (msg.related?.length || config.followUps.length > 0) ? (
                  <div className="mb-8 -mt-4 space-y-3">
                    {msg.related && msg.related.length > 0 ? (
                      <div>
                        <p
                          className="mb-1.5 text-[11px] font-medium uppercase tracking-wide"
                          style={{ color: muted }}
                        >
                          {config.relatedHeading ?? "Related"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.related.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => void send(r, { asTopic: true })}
                              className="rounded-full px-2.5 py-1 text-xs font-medium"
                              style={{ background: chipBg, color: ink }}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <p
                        className="mb-1.5 text-[11px] font-medium uppercase tracking-wide"
                        style={{ color: muted }}
                      >
                        Continue
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {config.followUps.map((f) => {
                          const FIcon = f.icon
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => void send(f.prompt)}
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                              style={{ background: chipBg, color: ink }}
                            >
                              <FIcon className="h-3 w-3 shrink-0 opacity-80" style={{ color: accent }} />
                              {f.label}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() =>
                            void send("Adjust the last response — make it clearer and more actionable.")
                          }
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
                          style={{ background: chipBg, color: ink }}
                        >
                          <Sparkles className="h-3 w-3 shrink-0 opacity-80" style={{ color: accent }} />
                          Refine
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}

          {loading ? (
            <div className="mb-8 flex items-center gap-2 text-sm" style={{ color: muted }}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: accent }} />
              Working…
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="shrink-0 px-4 pb-4 pt-2 sm:px-5"
        style={{ boxShadow: `inset 0 1px 0 ${hairline}` }}
      >
        <div className="mx-auto max-w-2xl">
          {activeTopic ? (
            <p className="mb-2 text-[11px]" style={{ color: muted }}>
              Working on{" "}
              <span className="font-semibold" style={{ color: ink }}>
                {activeTopic}
              </span>
              {" · "}
              ask a follow-up or start something new
            </p>
          ) : null}
          <CoraChatInput
            inputValue={input}
            onInputChange={setInput}
            onSend={(msg) => void send(msg)}
            modeOptions={config.modes}
            modeValue={mode}
            onModeChange={setMode}
            modeMenuLabel={config.modeMenuLabel}
            plusMenuVariant="attach"
            attachments={attachments}
            onRemoveAttachment={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
            onFilesSelected={(files) => void handleFilesSelected(files)}
            onImportCourseQuestion={() => setShowImport(true)}
            importedQuestion={importedProblem}
            importedQuestionLabel={importedLabel}
            onClearImportedQuestion={() => {
              setImportedProblem(null)
              setImportedLabel(null)
            }}
            isLoading={loading}
            placeholder={
              activeTopic ? "Ask a follow-up, or type a new topic…" : config.placeholder
            }
          />
        </div>
      </div>

      <CoraQuestionImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        studentId={studentId}
        onImport={(problem: CoraProblemContext, item: CoraImportableItem) => {
          setImportedProblem(problem)
          setImportedLabel(item?.label ?? problem.title ?? null)
          setShowImport(false)
        }}
      />
    </div>
  )
}
