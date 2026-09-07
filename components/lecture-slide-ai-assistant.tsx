"use client"


import { studentApiFetch } from "@/lib/auth"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Bot,
  Camera,
  Copy,
  FileText,
  Loader2,
  MessageSquare,
  ScanText,
  Sparkles,
  User,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { LectureAiMarkdown } from "@/components/lecture-ai-markdown"
import {
  actionNeedsSlideCapture,
  captureFullSlideForAi,
  captureSlideRegion,
} from "@/lib/capture-slide-region"
import { CORA_NAME, CORA_TAGLINE } from "@/lib/cora/constants"
import { cn } from "@/lib/utils"
import type { LectureAiAction } from "@/lib/lecture-ai-assistant-prompt"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  screenshotPreview?: string | null
  noteId?: number
}

type LectureSlideAiAssistantProps = {
  lectureId: number
  lectureTitle?: string
  studentRosterId: string | null
  captureTargetRef: React.RefObject<HTMLElement | null>
  slideNumber: number
  onSlideNumberChange: (n: number) => void
  /** Read the viewer's current page when opening the assistant (PDF iframe / legacy slides). */
  resolveActiveSlideNumber?: () => number
  /** Scroll the lecture viewer to a page when the student edits PDF page in the assistant. */
  onRequestViewerPage?: (page: number) => void
}

function threadStorageKey(lectureId: number) {
  return `lecture-ai-thread-${lectureId}`
}

function createThreadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function getOrCreateThreadId(lectureId: number): string {
  const key = threadStorageKey(lectureId)
  const existing = sessionStorage.getItem(key)
  if (existing) return existing
  const id = createThreadId()
  sessionStorage.setItem(key, id)
  return id
}

export function LectureSlideAiAssistant({
  lectureId,
  lectureTitle,
  studentRosterId,
  captureTargetRef,
  slideNumber,
  onSlideNumberChange,
  resolveActiveSlideNumber,
  onRequestViewerPage,
}: LectureSlideAiAssistantProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [statusLine, setStatusLine] = useState<string | null>(null)
  const [question, setQuestion] = useState("")
  const [pendingScreenshot, setPendingScreenshot] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [remaining, setRemaining] = useState<number | null>(null)
  const [threadId, setThreadId] = useState(() =>
    typeof window !== "undefined" ? getOrCreateThreadId(lectureId) : "",
  )
  const chatEndRef = useRef<HTMLDivElement>(null)
  const isEditingPageRef = useRef(false)
  const manualPageRef = useRef<number | null>(null)
  const [pageDraft, setPageDraft] = useState(String(slideNumber))

  useEffect(() => {
    if (!isEditingPageRef.current) {
      setPageDraft(String(slideNumber))
    }
  }, [slideNumber])

  const syncSlideNumberFromViewer = useCallback(() => {
    if (isEditingPageRef.current) return slideNumber
    const page = resolveActiveSlideNumber?.()
    if (page != null && page >= 1) {
      manualPageRef.current = null
      onSlideNumberChange(page)
      return page
    }
    return slideNumber
  }, [resolveActiveSlideNumber, onSlideNumberChange, slideNumber])

  const getEffectiveSlideNumber = useCallback(() => {
    if (manualPageRef.current != null && manualPageRef.current >= 1) {
      return manualPageRef.current
    }
    return slideNumber
  }, [slideNumber])

  const commitPageDraft = useCallback(() => {
    const next = Math.max(1, Number.parseInt(pageDraft, 10) || 1)
    isEditingPageRef.current = false
    manualPageRef.current = next
    setPageDraft(String(next))
    onSlideNumberChange(next)
    onRequestViewerPage?.(next)
  }, [pageDraft, onSlideNumberChange, onRequestViewerPage])

  const openAssistant = useCallback(() => {
    syncSlideNumberFromViewer()
    setOpen(true)
  }, [syncSlideNumberFromViewer])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) syncSlideNumberFromViewer()
      setOpen(next)
    },
    [syncSlideNumberFromViewer],
  )

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const loadThreadHistory = useCallback(async () => {
    if (!studentRosterId || !threadId) return
    setLoadingHistory(true)
    try {
      const q = new URLSearchParams({
        studentId: studentRosterId,
        lectureId: String(lectureId),
        threadId,
      })
      const res = await studentApiFetch(`/api/student/lecture-notes?${q}`)
      const data = await res.json()
      if (!res.ok) return

      const restored: ChatMessage[] = []
      for (const note of data.notes || []) {
        restored.push({
          id: `u-n-${note.id}`,
          role: "user",
          content: note.question,
          screenshotPreview: note.screenshotUrl,
        })
        restored.push({
          id: `a-n-${note.id}`,
          role: "assistant",
          content: note.aiResponse,
          noteId: note.id,
        })
      }
      if (restored.length) setMessages(restored)
    } catch {
      /* ignore */
    } finally {
      setLoadingHistory(false)
    }
  }, [studentRosterId, threadId, lectureId])

  useEffect(() => {
    if (open) {
      void loadThreadHistory()
      scrollToBottom()
    }
  }, [open, loadThreadHistory, scrollToBottom])

  useEffect(() => {
    if (open) scrollToBottom()
  }, [messages, open, scrollToBottom])

  /** Dev-only: ?aiPreview=1 loads sample messages to verify mobile chat layout */
  useEffect(() => {
    if (!open || messages.length > 0) return
    if (process.env.NODE_ENV !== "development") return
    if (typeof window === "undefined") return
    if (new URLSearchParams(window.location.search).get("aiPreview") !== "1") return
    setMessages([
      {
        id: "preview-u",
        role: "user",
        content: "Explain this slide",
      },
      {
        id: "preview-a",
        role: "assistant",
        content:
          "## Key idea\n\nOhm's law relates **voltage**, **current**, and **resistance**:\n\n- $V = I \\times R$\n- Use SI units: volts, amps, ohms\n\n> Review the circuit diagram on the slide for the worked example.\n\n```text\nV = I * R\nI = V / R\nR = V / I\n```",
      },
    ])
  }, [open, messages.length])

  useEffect(() => {
    if (!open) return
    syncSlideNumberFromViewer()
    const interval = window.setInterval(() => {
      if (!isEditingPageRef.current) syncSlideNumberFromViewer()
    }, 500)
    return () => window.clearInterval(interval)
  }, [open, syncSlideNumberFromViewer])

  const resolveSlideScreenshot = async (
    action: LectureAiAction,
    existing: string | null,
    pageNumber: number,
  ): Promise<{ screenshot: string | null; slideText: string | null }> => {
    if (existing?.startsWith("data:image/")) {
      return { screenshot: existing, slideText: null }
    }
    if (!actionNeedsSlideCapture(action, messages.length) && action !== "screenshot_region") {
      return { screenshot: null, slideText: null }
    }

    setStatusLine("Capturing current slide…")
    const el = captureTargetRef.current
    const captured = await captureFullSlideForAi(el, {
      lectureId,
      studentRosterId: studentRosterId!,
      slideNumber: pageNumber,
    })
    setStatusLine(null)

    if (!captured.dataUrl && (action === "explain_slide" || action === "summarize_slide")) {
      return { screenshot: null, slideText: captured.slideText }
    }

    return { screenshot: captured.dataUrl, slideText: captured.slideText }
  }

  const ask = async (action: LectureAiAction, customQuestion?: string) => {
    if (!studentRosterId) {
      toast({ title: "Sign in required", variant: "destructive" })
      return
    }

    const q = (customQuestion ?? question).trim()
    if (action === "custom" && !q) {
      toast({ title: "Enter a question first", variant: "destructive" })
      return
    }

    const selectedText =
      typeof window !== "undefined" ? window.getSelection()?.toString().trim() || "" : ""

    const userLabel =
      q ||
      (action === "explain_slide"
        ? "Explain this slide"
        : action === "summarize_slide"
          ? "Summarize this slide"
          : action === "explain_selection"
            ? selectedText
              ? `Explain: "${selectedText.slice(0, 80)}${selectedText.length > 80 ? "…" : ""}"`
              : "Explain selected text"
            : action === "screenshot_region"
              ? "Explain captured region"
              : "Question")

    setLoading(true)

    const activeSlideNumber = getEffectiveSlideNumber()
    if (activeSlideNumber !== slideNumber) {
      onSlideNumberChange(activeSlideNumber)
    }
    onRequestViewerPage?.(activeSlideNumber)

    const { screenshot, slideText } = await resolveSlideScreenshot(
      action,
      pendingScreenshot,
      activeSlideNumber,
    )

    if (
      (action === "explain_slide" || action === "summarize_slide") &&
      !screenshot &&
      !pendingScreenshot &&
      !slideText?.trim()
    ) {
      toast({
        title: "Screenshot unavailable",
        description:
          "Could not capture this slide. Check your PDF page number, or describe what you see in a custom question.",
        variant: "destructive",
      })
      setLoading(false)
      setStatusLine(null)
      return
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        role: "user",
        content: userLabel,
        screenshotPreview: screenshot ?? pendingScreenshot,
      },
    ])
    setQuestion("")
    setStatusLine("Thinking…")

    const history = messages
      .filter((m) => !m.content.startsWith("⚠️"))
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await studentApiFetch(`/api/student/lectures/${lectureId}/ai-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentRosterId,
          action,
          question: q,
          slideNumber: activeSlideNumber,
          slideText: slideText || undefined,
          selectedText: selectedText || undefined,
          screenshotBase64: screenshot || pendingScreenshot || undefined,
          lectureTitle,
          threadId,
          history,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || "Request failed")
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.response || "No response",
          noteId: data.noteId ?? undefined,
        },
      ])
      if (typeof data.remainingToday === "number") setRemaining(data.remainingToday)
      setPendingScreenshot(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      toast({ title: CORA_NAME, description: msg, variant: "destructive" })
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: "assistant", content: `⚠️ ${msg}` },
      ])
    } finally {
      setLoading(false)
      setStatusLine(null)
    }
  }

  const startRegionCapture = () => {
    const el = captureTargetRef.current
    if (!el) {
      toast({ title: "Viewer not ready", variant: "destructive" })
      return
    }
    setOpen(false)
    setCapturing(true)
  }

  const handleRegionCaptureComplete = async (region: {
    x: number
    y: number
    width: number
    height: number
  }) => {
    setCapturing(false)
    const el = captureTargetRef.current
    if (!el) {
      setOpen(true)
      return
    }
    const result = await captureSlideRegion(el, region, {
      lectureId,
      studentRosterId: studentRosterId!,
      slideNumber: getEffectiveSlideNumber(),
    })
    if (result.ok) {
      setPendingScreenshot(result.dataUrl)
      toast({ title: "Region captured", description: "Tap Explain capture or ask a follow-up." })
    } else {
      toast({
        title: "Screenshot unavailable",
        description:
          "Screenshot unavailable. Please use Explain Current Slide or describe the diagram.",
        variant: "destructive",
      })
    }
    setOpen(true)
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied to clipboard" })
    } catch {
      toast({ title: "Copy failed", variant: "destructive" })
    }
  }

  const startNewThread = () => {
    const newId = createThreadId()
    sessionStorage.setItem(threadStorageKey(lectureId), newId)
    setThreadId(newId)
    setMessages([])
    setPendingScreenshot(null)
    toast({ title: "New conversation started" })
  }

  if (!studentRosterId) return null

  return (
    <>
      {capturing && captureTargetRef.current ? (
        <RegionCaptureOverlay
          target={captureTargetRef.current}
          onCancel={() => {
            setCapturing(false)
            setOpen(true)
          }}
          onComplete={handleRegionCaptureComplete}
        />
      ) : null}

      <Button
        type="button"
        size="lg"
        onClick={openAssistant}
        className={cn(
          "fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full p-0 sm:bottom-5 sm:right-5 sm:h-14 sm:w-14",
          "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30",
          "border-2 border-white/90 dark:border-white/20",
          "transition-transform hover:scale-105",
          (open || capturing) && "pointer-events-none scale-0 opacity-0",
        )}
        aria-label={`Open ${CORA_NAME}`}
        aria-hidden={open || capturing}
        tabIndex={open || capturing ? -1 : 0}
      >
        <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton
          className={cn(
            "lecture-ai-dialog z-[60] grid w-full max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-0 bg-white p-0 shadow-2xl dark:bg-[#0B1120]",
            "max-sm:top-0 max-sm:left-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-none max-sm:rounded-none",
            "sm:h-[min(94dvh,780px)] sm:w-[calc(100vw-1rem)] sm:max-w-2xl",
            "[&_[data-slot=dialog-close]]:z-10 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:text-white/90 [&_[data-slot=dialog-close]]:top-3 [&_[data-slot=dialog-close]]:right-3 sm:[&_[data-slot=dialog-close]]:top-4 sm:[&_[data-slot=dialog-close]]:right-4",
          )}
        >
          <div className="shrink-0 min-w-0">
            <div className="bg-primary px-3 py-3 pr-12 text-primary-foreground sm:px-5 sm:py-4 sm:pr-12">
              <DialogHeader className="space-y-1 text-left sm:space-y-1.5">
                <DialogTitle className="flex items-center gap-2 text-base font-semibold text-primary-foreground sm:gap-2.5 sm:text-lg">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 sm:h-9 sm:w-9 sm:rounded-xl">
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                  </span>
                  <span className="min-w-0">{CORA_NAME}</span>
                  <span className="text-[10px] font-normal text-[var(--cc-text-muted)]">{CORA_TAGLINE}</span>
                </DialogTitle>
                <DialogDescription className="text-primary-foreground/85 text-xs sm:text-sm">
                  {lectureTitle ? (
                    <span className="line-clamp-2 break-words sm:line-clamp-1">{lectureTitle}</span>
                  ) : (
                    "Contextual explanations for this lecture"
                  )}
                  {remaining != null ? (
                    <span className="mt-1 block text-[11px] text-primary-foreground/75 sm:text-xs">
                      {remaining} questions left today · explanations only
                    </span>
                  ) : (
                    <span className="mt-1 block text-[11px] text-primary-foreground/75 sm:text-xs">
                      Explanations only — not assignment answers
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="grid grid-cols-2 gap-1.5 border-b border-slate-200/80 bg-slate-50/80 px-2 py-2 dark:border-white/[0.08] dark:bg-white/[0.02] sm:flex sm:flex-nowrap sm:gap-2 sm:overflow-x-auto sm:px-4 sm:py-3">
              <QuickAction icon={FileText} label="Explain slide" shortLabel="Explain" disabled={loading} onClick={() => ask("explain_slide")} />
              <QuickAction icon={Bot} label="Summarize" shortLabel="Summary" disabled={loading} onClick={() => ask("summarize_slide")} />
              <QuickAction icon={ScanText} label="Selection" shortLabel="Select" disabled={loading} onClick={() => ask("explain_selection")} />
              <QuickAction icon={Camera} label="Capture" shortLabel="Capture" disabled={loading} onClick={startRegionCapture} />
              {pendingScreenshot ? (
                <QuickAction
                  icon={Sparkles}
                  label="Explain capture"
                  shortLabel="Explain"
                  disabled={loading}
                  onClick={() => ask("screenshot_region")}
                  active
                  className="col-span-2 sm:col-span-1"
                />
              ) : null}
            </div>

            {pendingScreenshot ? (
              <div className="relative mx-3 mb-2 mt-2 shrink-0 overflow-hidden rounded-xl border border-primary/25 shadow-sm dark:border-primary/35 sm:mx-4 sm:mb-3 sm:mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingScreenshot}
                  alt="Captured region"
                  className="max-h-32 w-full bg-slate-100 object-contain dark:bg-slate-900"
                />
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white hover:bg-black/70"
                  onClick={() => setPendingScreenshot(null)}
                  aria-label="Remove screenshot"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain bg-white dark:bg-[#0B1120]">
            <div className="space-y-3 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
              {loadingHistory && messages.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading conversation…
                </div>
              ) : messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200/90 bg-slate-50/50 px-3 py-6 text-center dark:border-white/10 dark:bg-white/[0.02] sm:rounded-2xl sm:px-4 sm:py-10">
                  <MessageSquare className="mx-auto mb-2 h-7 w-7 text-primary/70 sm:mb-3 sm:h-8 sm:w-8" />
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Ask about this slide
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed sm:mt-1.5 sm:text-xs">
                    Tap Explain to capture this page. Follow-ups stay in context and save to your notes.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <ChatBubble key={m.id} message={m} onCopy={copyText} />
                ))
              )}
              {(loading || statusLine) && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  {statusLine || "Thinking…"}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200/80 bg-white px-2.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] dark:border-white/[0.08] dark:bg-[#0B1120] sm:px-4 sm:py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <label htmlFor="ai-slide-page" className="shrink-0 text-[11px] font-medium text-muted-foreground sm:text-xs">
                  <span className="sm:hidden">Page</span>
                  <span className="hidden sm:inline">PDF page</span>
                </label>
                <Input
                  id="ai-slide-page"
                  type="number"
                  min={1}
                  className="h-8 w-12 rounded-lg sm:w-16"
                  value={pageDraft}
                  onFocus={() => {
                    isEditingPageRef.current = true
                  }}
                  onChange={(e) => {
                    isEditingPageRef.current = true
                    setPageDraft(e.target.value)
                  }}
                  onBlur={() => {
                    commitPageDraft()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      commitPageDraft()
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-[11px] text-muted-foreground sm:text-xs"
                onClick={startNewThread}
              >
                <span className="sm:hidden">New chat</span>
                <span className="hidden sm:inline">New conversation</span>
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Textarea
                placeholder="Ask a follow-up…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={2}
                className="min-h-[44px] w-full min-w-0 resize-none rounded-xl border-slate-200/80 text-sm dark:border-white/10 sm:min-h-[48px] sm:flex-1"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    if (!loading) void ask("custom")
                  }
                }}
              />
              <Button
                type="button"
                className="h-10 w-full shrink-0 rounded-xl bg-primary px-4 hover:bg-primary/90 shadow-purple sm:h-10 sm:w-auto sm:min-w-[5.5rem]"
                disabled={loading || !question.trim()}
                onClick={() => ask("custom")}
              >
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ChatBubble({
  message,
  onCopy,
}: {
  message: ChatMessage
  onCopy: (text: string) => void
}) {
  const isUser = message.role === "user"
  const isError = message.content.startsWith("⚠️")

  return (
    <div className={cn("flex w-full min-w-0 gap-2 sm:gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:mt-0 sm:h-8 sm:w-8",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-primary",
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
      </div>
      <div
        className={cn(
          "min-w-0 max-w-[calc(100%-2rem)] flex-1 rounded-2xl px-3 py-2 shadow-sm [overflow-wrap:anywhere] [word-break:break-word] sm:max-w-[85%] sm:px-3.5 sm:py-2.5",
          isUser
            ? "rounded-tr-md bg-primary text-primary-foreground"
            : isError
              ? "rounded-tl-md border border-red-200/80 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200"
              : "rounded-tl-md border border-slate-200/80 bg-white dark:border-white/10 dark:bg-white/[0.04]",
        )}
      >
        {message.screenshotPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.screenshotPreview}
            alt="Slide context"
            className="mb-2 max-h-24 w-full rounded-lg border border-white/20 object-contain bg-black/5"
          />
        ) : null}
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : isError ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <LectureAiMarkdown content={message.content} />
        )}
        {!isUser && !isError ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
            onClick={() => onCopy(message.content)}
          >
            <Copy className="h-3 w-3" />
            Copy
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function QuickAction({
  icon: Icon,
  label,
  shortLabel,
  onClick,
  disabled,
  active,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  shortLabel?: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  className?: string
}) {
  const mobileLabel = shortLabel ?? label
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex w-full min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-1.5 text-[10px] font-medium leading-tight transition-all sm:min-h-0 sm:w-auto sm:shrink-0 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-3 sm:py-2 sm:text-xs",
        active
          ? "border-primary/50 bg-primary/10 text-primary shadow-sm dark:border-primary/40 dark:bg-primary/15 dark:text-primary"
          : "border-slate-200/80 bg-white text-slate-700 hover:border-primary/30 hover:bg-primary/5 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-primary/40",
        disabled && "opacity-50",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-primary sm:h-3.5 sm:w-3.5" />
      <span className="max-w-full truncate sm:hidden">{mobileLabel}</span>
      <span className="hidden max-w-full truncate sm:inline">{label}</span>
    </button>
  )
}

function RegionCaptureOverlay({
  target,
  onCancel,
  onComplete,
}: {
  target: HTMLElement
  onCancel: () => void
  onComplete: (region: { x: number; y: number; width: number; height: number }) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  const getBounds = useCallback(() => target.getBoundingClientRect(), [target])

  const onPointerDown = (e: React.PointerEvent) => {
    const b = getBounds()
    const x = e.clientX - b.left
    const y = e.clientY - b.top
    setStart({ x, y })
    setRect({ x, y, width: 0, height: 0 })
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !start) return
    const b = getBounds()
    const cx = e.clientX - b.left
    const cy = e.clientY - b.top
    setRect({
      x: Math.min(start.x, cx),
      y: Math.min(start.y, cy),
      width: Math.abs(cx - start.x),
      height: Math.abs(cy - start.y),
    })
  }

  const onPointerUp = () => {
    setDragging(false)
    if (rect && rect.width > 12 && rect.height > 12) {
      onComplete(rect)
    }
  }

  const b = getBounds()

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="pointer-events-none absolute border-2 border-dashed border-primary/70"
        style={{ left: b.left, top: b.top, width: b.width, height: b.height }}
      />
      <div
        className="absolute cursor-crosshair bg-black/45"
        style={{ left: b.left, top: b.top, width: b.width, height: b.height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {rect && rect.width > 0 ? (
          <div
            className="pointer-events-none absolute border-2 border-primary bg-primary/15"
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
          />
        ) : null}
      </div>
      <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 flex w-[min(calc(100%-1.5rem),20rem)] -translate-x-1/2 flex-col gap-2 sm:w-auto sm:max-w-none sm:flex-row">
        <Button variant="secondary" className="w-full sm:w-auto" onClick={onCancel}>
          Cancel
        </Button>
        {rect && rect.width > 12 ? (
          <Button className="w-full bg-primary hover:bg-primary/90 shadow-purple sm:w-auto" onClick={() => onComplete(rect)}>
            Use selection
          </Button>
        ) : (
          <span className="rounded-lg bg-black/75 px-3 py-2 text-center text-xs text-white sm:text-sm">
            Drag to select a region on the slide
          </span>
        )}
      </div>
    </div>
  )
}
