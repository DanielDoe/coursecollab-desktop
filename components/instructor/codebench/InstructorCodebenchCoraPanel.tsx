"use client"

import { forwardRef, useCallback, useImperativeHandle, useState } from "react"
import { Sparkles } from "lucide-react"
import { CodebenchCoraBar } from "@/components/codebench/CodebenchCoraBar"
import { CodebenchCoraComposer } from "@/components/codebench/CodebenchCoraComposer"
import { CoraThinkingIndicator } from "@/components/cora/CoraThinkingIndicator"
import { CoraWorkspaceChatMessage } from "@/components/cora/CoraWorkspaceChatMessage"
import { CODEBENCH_CONCISE_EXPLAIN_MARKDOWN, CODEBENCH_FACULTY_SUGGEST_FIX_REPLY } from "@/lib/cora/codebench-output-format"
import { mapCodebenchToolToThinkingMode } from "@/lib/cora/thinking-process"
import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type Message = { role: "user" | "assistant"; content: string }

type Props = {
  code: string
  language: string
  theme?: "light" | "dark"
  compilerOutput?: string
}

export type InstructorCodebenchCoraPanelHandle = {
  runDebug: (compilerOutput?: string) => void
}

const TEACHING_PROMPTS: Record<string, (code: string, language: string, compilerOutput?: string) => string> = {
  explain: (code, language) =>
    `${CODEBENCH_CONCISE_EXPLAIN_MARKDOWN}\n\nExplain this ${language} code for classroom teaching. Do not rewrite the full solution.\n\n\`\`\`${language}\n${code}\n\`\`\``,
  debug: (code, language, compilerOutput) =>
    compilerOutput?.trim()
      ? `${CODEBENCH_FACULTY_SUGGEST_FIX_REPLY}\n\nFix the first compiler error only. No teaching or explanations.\n\nCompiler output:\n${compilerOutput}\n\n\`\`\`${language}\n${code}\n\`\`\``
      : `Find bugs in this ${language} code. Under 100 words, line numbers and fixes only.\n\n\`\`\`${language}\n${code}\n\`\`\``,
  improve: (code, language) =>
    `Suggest teaching-focused improvements for this ${language} example (readability, naming, structure). Keep it suitable for demonstrating in class.\n\n\`\`\`${language}\n${code}\n\`\`\``,
  pseudocode: (code, language) =>
    `Convert this ${language} code into clear pseudocode I can walk through on the board.\n\n\`\`\`${language}\n${code}\n\`\`\``,
  tutor: (code, language) =>
    `I am preparing to teach with this ${language} code. What should I emphasize, what demo order should I use, and what checkpoint questions should I ask students?\n\n\`\`\`${language}\n${code}\n\`\`\``,
}

const TOOL_USER_LABELS: Record<string, string> = {
  explain: "Explain this code for class",
  debug: "Debug this code",
  improve: "Suggest improvements for teaching",
  pseudocode: "Generate pseudocode for the board",
  tutor: "Help me plan how to teach this code",
}

export const InstructorCodebenchCoraPanel = forwardRef<InstructorCodebenchCoraPanelHandle, Props>(
  function InstructorCodebenchCoraPanel({ code, language, theme = "dark", compilerOutput = "" }, ref) {
    const [activeTool, setActiveTool] = useState<string | null>("explain")
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [fromCompilerError, setFromCompilerError] = useState(false)

    const sendToCora = useCallback(
      async (
        message: string,
        toolId?: string | null,
        displayContent?: string,
        historyBase?: Message[],
      ) => {
        const trimmed = message.trim()
        if (!trimmed || loading) return
        setLoading(true)
        const nextUser: Message = { role: "user", content: displayContent ?? trimmed }
        const prior = historyBase ?? messages
        setMessages([...prior, nextUser])
        setInput("")
        try {
          const res = await instructorApiFetch("/api/instructor/cora/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: trimmed,
              capabilityId: toolId ?? activeTool ?? "codebench",
              conversationHistory: [...prior, nextUser].slice(-8).map((entry) => ({
                role: entry.role,
                content: entry.content,
              })),
            }),
          })
          const data = (await res.json()) as { reply?: string; message?: string; error?: string }
          const reply = data.reply || data.message || data.error || "Cora could not respond."
          setMessages((prev) => [...prev, { role: "assistant", content: reply }])
        } catch (error) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: error instanceof Error ? error.message : "Failed to reach Cora.",
            },
          ])
        } finally {
          setLoading(false)
          setFromCompilerError(false)
        }
      },
      [activeTool, loading, messages],
    )

    const runTool = useCallback(
      async (
        toolId: string,
        options?: {
          compilerOutput?: string
          userLabel?: string
          fromCompilerError?: boolean
          resetConversation?: boolean
        },
      ) => {
        setActiveTool(toolId)
        setFromCompilerError(Boolean(options?.fromCompilerError))
        const output = options?.compilerOutput ?? compilerOutput
        const prompt = TEACHING_PROMPTS[toolId]?.(code, language, output)
        if (!prompt) return
        const label =
          options?.userLabel ??
          (options?.fromCompilerError ? "Suggest fix" : TOOL_USER_LABELS[toolId])
        const historyBase = options?.resetConversation ? [] : undefined
        await sendToCora(prompt, toolId, label, historyBase)
      },
      [code, compilerOutput, language, sendToCora],
    )

    useImperativeHandle(
      ref,
      () => ({
        runDebug: (output?: string) => {
          void runTool("debug", {
            compilerOutput: output ?? compilerOutput,
            fromCompilerError: Boolean((output ?? compilerOutput)?.trim()),
            userLabel: "Suggest fix",
            resetConversation: true,
          })
        },
      }),
      [compilerOutput, runTool],
    )

    const thinkingMode = mapCodebenchToolToThinkingMode(activeTool, { fromCompilerError })

    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--card)]">
        <CodebenchCoraBar
          activeTool={activeTool}
          onToolSelect={(tool) => void runTool(tool)}
          toolLoading={loading}
          showEvaluate={false}
          showWalkthrough={false}
          theme={theme}
          onClear={() => {
            setMessages([])
            setFromCompilerError(false)
          }}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && loading ? (
              <div className="flex min-h-[240px] items-center justify-center p-2">
                <CoraThinkingIndicator mode={thinkingMode} theme={theme} className="w-full max-w-md" />
              </div>
            ) : messages.length === 0 ? (
              <div className={cn("rounded-lg border border-dashed border-[var(--border)] p-4 text-sm", PORTAL_TEXT_MUTED)}>
                <div className="mb-2 flex items-center gap-2 font-medium text-[var(--cc-text)]">
                  <Sparkles className="h-4 w-4 text-[var(--cc-accent)]" />
                  Cora teaching copilot
                </div>
                <p>
                  Use Explain, Debug, Improve, or ask a question about the code in your editor. Cora uses your faculty
                  session and current course scope.
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <CoraWorkspaceChatMessage
                  key={`${message.role}-${index}`}
                  role={message.role}
                  content={message.content}
                  theme={theme}
                  tone={message.role === "assistant" && activeTool === "debug" ? "error-analysis" : "default"}
                />
              ))
            )}
            {loading && messages.length > 0 ? (
              <CoraThinkingIndicator mode={thinkingMode} theme={theme} compact className="max-w-md" />
            ) : null}
          </div>
          <div
            className={cn(
              "shrink-0 border-t p-3",
              theme === "light" ? "border-[var(--border)] bg-[var(--card)]" : "border-[#582c83]/25 bg-[#0a0e14]",
            )}
          >
            <CodebenchCoraComposer
              value={input}
              onChange={setInput}
              onSend={() => void sendToCora(input)}
              placeholder="Ask about this code…"
              isLoading={loading}
              theme={theme}
            />
          </div>
        </div>
      </div>
    )
  },
)
