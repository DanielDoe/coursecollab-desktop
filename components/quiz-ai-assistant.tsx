"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent as BaseSheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Send, Sparkles, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"
import { CORA_NAME } from "@/lib/cora/constants"
import { XIcon } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

function canUseInExamAiAssistantTier(tier: string) {
  return tier === "Trailblazer" || tier === "Explorer"
}

// Custom SheetContent with less intrusive overlay and non-dismissible
function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <SheetPrimitive.Portal>
      {/* Less intrusive overlay - non-interactive so clicks pass through to quiz content */}
      <SheetPrimitive.Overlay 
        className="fixed inset-0 z-50 bg-black/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 pointer-events-none" 
      />
      <SheetPrimitive.Content
        onInteractOutside={(e) => {
          // Prevent closing when clicking outside - students need to keep it open while coding
          e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking outside - students need to keep it open while coding
          e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          // Allow Escape key to close (for accessibility)
          // But prevent accidental closes
        }}
        className={cn(
          'bg-white dark:bg-slate-900 data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 overflow-hidden border-slate-200 dark:border-slate-700',
          side === 'right' &&
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
          side === 'left' &&
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
          side === 'top' &&
            'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b',
          side === 'bottom' &&
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-3 right-3 sm:top-4 sm:right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none z-20">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

interface QuizAIAssistantProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questionId: number
  questionText: string
  questionType?: string
  studentCode?: string
  studentWork?: string
  studentId: string
  membershipTier: string
}

function isMultiPartAssistant(questionType?: string) {
  return (questionType ?? "").toLowerCase() === "multi_part"
}

interface Message {
  role: "user" | "assistant"
  content: string
}

export function QuizAIAssistant({
  open,
  onOpenChange,
  questionId,
  questionText,
  questionType = "code_write",
  studentCode = "",
  studentWork = "",
  studentId,
  membershipTier,
}: QuizAIAssistantProps) {
  const isCircuitAssistant = isMultiPartAssistant(questionType)

  const getWelcomeMessage = (): Message[] => [
    {
      role: "assistant",
      content: isCircuitAssistant
        ? "👋 ECE2202 Learning Assistant:\n• Concept hints\n• Procedure guidance\n• Work review\n\nI won't give final answers — ask for the next step."
        : "👋 Quick help available:\n• Review code\n• Syntax errors\n• Logic hints\n\nAsk concisely - I'll respond briefly.",
    },
  ]

  const [messages, setMessages] = useState<Message[]>(getWelcomeMessage())
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requiresUpgrade, setRequiresUpgrade] = useState(false)
  const { toast } = useToast()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const previousQuestionIdRef = useRef<number>(questionId)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Reset chat history when question changes - start fresh for each question
  useEffect(() => {
    if (questionId !== previousQuestionIdRef.current) {
      // Question changed - reset to welcome message and clear input
      setMessages(getWelcomeMessage())
      setInput("")
      previousQuestionIdRef.current = questionId
      setError(null)
    }
  }, [questionId])

  // Initialize welcome message when panel opens (only if no messages exist)
  useEffect(() => {
    if (open && canUseInExamAiAssistantTier(membershipTier) && messages.length === 0) {
      setMessages(getWelcomeMessage())
    }
  }, [open, membershipTier])

  // Check membership when side panel opens
  useEffect(() => {
    if (open) {
      if (!canUseInExamAiAssistantTier(membershipTier)) {
        setRequiresUpgrade(true)
        setError(
          "This feature is not available on the free tier. Upgrade to Explorer or Trailblazer to use the in-exam AI assistant.",
        )
      } else {
        setRequiresUpgrade(false)
        setError(null)
      }
    }
  }, [open, membershipTier])

  const handleSend = async () => {
    if (!input.trim() || isLoading || requiresUpgrade) return

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setError(null)

    try {
      // Always send question text and student code for context
      const response = await fetch("/api/quiz/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId,
          questionId,
          questionText,
          studentCode: studentCode || "",
          studentWork: studentWork || "",
          conversationHistory: messages,
          userRequest: input.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.requiresUpgrade) {
          setRequiresUpgrade(true)
          setError(data.error || "Upgrade to Explorer or Trailblazer to use the in-exam AI assistant.")
          toast({
            title: "Upgrade Required",
            description: "Explorer or Trailblazer membership is required.",
            variant: "destructive",
          })
        } else {
          const msg = data.error || "Failed to get AI response. Please try again."
          setError(msg)
          if (data.detail) console.error("[Quiz AI Assistant] Server detail:", data.code, data.detail)
          if (data.stack) console.error("[Quiz AI Assistant] Stack:", data.stack)
          toast({
            title: "AI Error",
            description: data.detail ? `${msg}\n\n${data.detail}` : msg,
            variant: "destructive",
          })
        }
        setIsLoading(false)
        return
      }

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message,
        },
      ])
    } catch (err) {
      console.error("[Quiz AI Assistant] Error:", err)
      setError("An error occurred. Please try again.")
      toast({
        title: "Error",
        description: "Failed to communicate with AI assistant.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickAction = async (action: string) => {
    if (requiresUpgrade) return

    let quickMessage = ""
    switch (action) {
      case "review":
        quickMessage = isCircuitAssistant
          ? studentWork
            ? "Review my current selections and tell me what concept to focus on next — no final answers."
            : "Help me identify which circuit analysis concepts apply to this problem."
          : studentCode
            ? "Review my code and tell me what's wrong or how to improve it."
            : "Help me understand how to approach this problem."
        break
      case "hint":
        quickMessage = isCircuitAssistant
          ? "Give me the next conceptual step only — do not compute final values."
          : "Give me step-by-step hints on how to approach this problem."
        break
      case "pseudocode":
        quickMessage = isCircuitAssistant
          ? "What analysis procedure should I follow (KCL, KVL, etc.) without solving the numbers?"
          : "Provide pseudocode showing the step-by-step logic for solving this problem."
        break
      case "syntax":
        quickMessage = isCircuitAssistant
          ? "I'm stuck on setting up equations — what should I define first?"
          : "I'm having syntax issues. What's wrong?"
        break
      case "improve":
        quickMessage = isCircuitAssistant
          ? studentWork
            ? "What should I check in my work so far?"
            : "How should I start this multi-part circuit problem?"
          : studentCode
            ? "How can I improve my code? Give me suggestions."
            : "Help me understand how to approach this problem."
        break
      default:
        return
    }

    // Add user message immediately
    const userMessage: Message = {
      role: "user",
      content: quickMessage,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/quiz/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId,
          questionId,
          questionText,
          studentCode: studentCode || "",
          studentWork: studentWork || "",
          conversationHistory: messages,
          userRequest: quickMessage,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.requiresUpgrade) {
          setRequiresUpgrade(true)
          setError(data.error || "Upgrade to Explorer or Trailblazer to use the in-exam AI assistant.")
          toast({
            title: "Upgrade Required",
            description: "Explorer or Trailblazer membership is required.",
            variant: "destructive",
          })
        } else {
          const msg = data.error || "Failed to get AI response. Please try again."
          setError(msg)
          if (data.detail) console.error("[Quiz AI Assistant] Server detail:", data.code, data.detail)
          if (data.stack) console.error("[Quiz AI Assistant] Stack:", data.stack)
          toast({
            title: "AI Error",
            description: data.detail ? `${msg}\n\n${data.detail}` : msg,
            variant: "destructive",
          })
        }
        setIsLoading(false)
        return
      }

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message,
        },
      ])
    } catch (err) {
      console.error("[Quiz AI Assistant] Error:", err)
      setError("An error occurred. Please try again.")
      toast({
        title: "Error",
        description: "Failed to communicate with AI assistant.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent 
        side="right" 
        className="w-full sm:w-[380px] md:w-[400px] flex flex-col p-0"
      >
        <SheetHeader className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 border-b border-slate-200 dark:border-slate-700 relative pr-12 sm:pr-14">
          <div className="flex items-center gap-2">
            <SheetTitle className="flex items-center gap-2 text-base sm:text-lg flex-1 min-w-0 text-slate-900 dark:text-slate-100">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 dark:text-purple-400 shrink-0" />
              <span className="truncate">{isCircuitAssistant ? `${CORA_NAME} · Circuits` : `${CORA_NAME} · Code`}</span>
            </SheetTitle>
            {open && canUseInExamAiAssistantTier(membershipTier) && !requiresUpgrade && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-[10px] sm:text-xs shrink-0 mr-0">
                Active
              </Badge>
            )}
          </div>
          <SheetDescription className="text-[11px] sm:text-xs mt-1 text-slate-600 dark:text-slate-300">
            {isCircuitAssistant
              ? "Concept hints and procedure guidance — no final answers."
              : "Quick help while coding. Responses stay visible."}
          </SheetDescription>
        </SheetHeader>

        {requiresUpgrade && (
          <Alert variant="destructive" className="m-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              This feature is not available on the free tier. Upgrade to Explorer or Trailblazer to use the in-exam AI assistant.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50/50 dark:bg-slate-900/80">
          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
            <div className="space-y-3 py-3 px-2 sm:px-3">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-2 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 py-2.5 shadow-sm ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-purple-500 to-indigo-500 text-white rounded-br-sm"
                        : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-600"
                    }`}
                    style={{ 
                      wordBreak: 'break-word', 
                      overflowWrap: 'anywhere',
                      hyphens: 'auto',
                      maxWidth: '100%'
                    }}
                  >
                    {message.role === "assistant" ? (
                      <div className="text-sm leading-relaxed">
                        <ReactMarkdown
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || "")
                              const language = match ? match[1] : "text"
                              
                              if (inline) {
                                return (
                                  <code className="bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-1.5 py-0.5 rounded text-[11px] sm:text-xs font-mono break-all border border-slate-300 dark:border-slate-600" {...props}>
                                    {children}
                                  </code>
                                )
                              }
                              
                              // For code blocks: return div (not inside p). Use div as root to avoid p>pre hydration error.
                              return (
                                <div className="my-2 -mx-1 w-[calc(100%+0.5rem)] max-w-full overflow-x-auto rounded-lg [&>pre]:!m-0 [&>pre]:!rounded-lg">
                                  <SyntaxHighlighter
                                    language={language}
                                    style={vscDarkPlus}
                                    customStyle={{
                                      margin: 0,
                                      padding: '0.625rem 0.75rem',
                                      borderRadius: '0.5rem',
                                      fontSize: '0.6875rem',
                                      background: '#1e293b',
                                    }}
                                    codeTagProps={{ style: { fontFamily: 'ui-monospace, monospace' } }}
                                    showLineNumbers={false}
                                    PreTag="pre"
                                  >
                                    {String(children).replace(/\n$/, "")}
                                  </SyntaxHighlighter>
                                </div>
                              )
                            },
                            pre({ children, ...props }: any) {
                              return <div className="[&_pre]:!m-0 [&_pre]:!p-0">{children}</div>
                            },
                            p({ children, ...props }: any) {
                              // Always use div: p cannot contain div/pre (code blocks), and nested p causes hydration errors
                              return <div className="mb-2 last:mb-0 leading-relaxed text-sm" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', hyphens: 'auto' }} {...props}>{children}</div>
                            },
                            ul({ children }) {
                              return <ul className="list-disc list-outside mb-2 ml-3 sm:ml-4 space-y-0.5 text-sm" style={{ wordBreak: 'break-word' }}>{children}</ul>
                            },
                            ol({ children }) {
                              return <ol className="list-decimal list-outside mb-2 ml-3 sm:ml-4 space-y-0.5 text-sm" style={{ wordBreak: 'break-word' }}>{children}</ol>
                            },
                            li({ children }) {
                              return <li className="leading-relaxed" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', hyphens: 'auto' }}>{children}</li>
                            },
                            strong({ children }) {
                              return <strong className="font-semibold">{children}</strong>
                            },
                            em({ children }) {
                              return <em className="italic">{children}</em>
                            },
                            h1({ children }) {
                              return <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>
                            },
                            h2({ children }) {
                              return <h2 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">{children}</h2>
                            },
                            h3({ children }) {
                              return <h3 className="text-sm font-medium mb-1 mt-2 first:mt-0">{children}</h3>
                            },
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', hyphens: 'auto' }}>
                        {message.content}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start gap-2">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm border border-slate-200 dark:border-slate-600 flex items-center gap-2 max-w-[85%] sm:max-w-[80%]">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-500 dark:text-purple-400 shrink-0" />
                    <span className="text-sm text-slate-600 dark:text-slate-200 break-words">
                      Thinking...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Quick Actions */}
          {!requiresUpgrade && messages.length === 1 && (
            <div className="px-2 sm:px-3 pb-2 sm:pb-3">
              <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction("review")}
                  disabled={isLoading}
                  className="text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 whitespace-nowrap flex-shrink-0 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Review Code
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction("improve")}
                  disabled={isLoading}
                  className="text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 whitespace-nowrap flex-shrink-0 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Improve Code
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction("hint")}
                  disabled={isLoading}
                  className="text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 whitespace-nowrap flex-shrink-0 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Get Hint
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction("pseudocode")}
                  disabled={isLoading}
                  className="text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 whitespace-nowrap flex-shrink-0 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Pseudocode
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction("syntax")}
                  disabled={isLoading}
                  className="text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 whitespace-nowrap flex-shrink-0 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Syntax Help
                </Button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 p-2 sm:p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                requiresUpgrade
                  ? "Upgrade to Explorer or Trailblazer…"
                  : "Ask about your code..."
              }
              disabled={isLoading || requiresUpgrade}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className="min-h-[50px] sm:min-h-[60px] resize-none text-sm break-words bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 border-slate-200 dark:border-slate-600"
              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || requiresUpgrade}
              size="icon"
              className="shrink-0 h-[50px] w-[50px] sm:h-[60px] sm:w-[60px] bg-gradient-to-br from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {error && !requiresUpgrade && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
