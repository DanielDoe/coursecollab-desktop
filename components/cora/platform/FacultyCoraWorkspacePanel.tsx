"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUp,
  ClipboardPaste,
  FileUp,
  Github,
  Library,
  Loader2,
  Maximize2,
  Minimize2,
  PanelRight,
  Plus,
  Sparkles,
  Wand2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FeedbackTextRenderer } from "@/components/question-text-renderer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { CoraChatBubble } from "@/components/cora/CoraChatBubble"
import { CoraActionCard } from "@/components/cora/CoraActionCard"
import { CoraTransactionPlanCard } from "@/components/cora/CoraTransactionPlanCard"
import { CoraLogo } from "@/components/cora/CoraLogo"
import { CoraImportedQuestionPreview } from "@/components/cora/CoraImportedQuestionPreview"
import { FacultyCoraQuestionBankDraftModal } from "@/components/cora/platform/FacultyCoraQuestionBankDraftModal"
import { FacultyCoraImportCourseDialog } from "@/components/cora/platform/FacultyCoraImportCourseDialog"
import { FacultyCoraGithubFixDialog } from "@/components/cora/platform/FacultyCoraGithubFixDialog"
import { FacultyCoraSessionSidebar } from "@/components/cora/platform/FacultyCoraSessionSidebar"
import {
  deleteFacultyCoraThread,
  generateFacultyCoraQuestions,
  ingestFacultyCoraDocument,
  listFacultyCoraThreads,
  sendFacultyCoraChat,
  scheduleFacultyCoraAutomation,
  upsertFacultyCoraThread,
  type FacultyCoraChatAction,
  type FacultyCoraChatThread,
} from "@/lib/cora/faculty-cora-client"
import { FACULTY_CORA_INTENTS, dispatchFacultyCoraIntent } from "@/lib/cora/cora-intents"
import { runFacultyMigration } from "@/lib/cora/faculty-cora-migrations"
import { setFacultyCoraPending } from "@/lib/cora/faculty-cora-pending"
import type { FacultyCoraStoredMessage } from "@/lib/cora/faculty-cora-thread-types"
import type { DraftQuestionBankItem } from "@/lib/question-bank-ai-from-pdf-types"
import type { CoraProblemContext } from "@/lib/cora/types"
import { FACULTY_CORA_NAV_LABEL, FACULTY_CORA_TAGLINE } from "@/lib/cora/constants"
import { FACULTY_CORA_CAPABILITIES, facultyCoraCapability } from "@/lib/cora/faculty-capabilities"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { loadFacultyCoraPreferences } from "@/lib/cora/faculty-preferences-storage"
import { useIsBelowLg } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

type ChatMessage = FacultyCoraStoredMessage & {
  role: "user" | "assistant"
}

type Props = {
  capabilityId?: string
  initialPrompt?: string
  bootstrapNonce?: number
  fillHeight?: boolean
  immersive?: boolean
  onToggleImmersive?: () => void
}

const COMPOSER_STARTERS = [
  "Generate question bank drafts for this week's lecture",
  "Draft a weekly announcement summarizing upcoming deadlines",
  "Which topics are students struggling with most?",
  "Schedule flashcards after the next lecture",
]

function createThreadId() {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `fcora-${uuid}`
}

function deriveTitle(messages: ChatMessage[]) {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim())
  if (!firstUser) return "Cora conversation"
  const text = firstUser.content.trim().replace(/\s+/g, " ")
  return text.length > 56 ? `${text.slice(0, 53)}…` : text
}

function derivePreview(messages: ChatMessage[]) {
  const last = [...messages].reverse().find((m) => m.content.trim())
  if (!last) return "No messages yet"
  const prefix = last.role === "user" ? "You: " : "Cora: "
  const text = last.content.trim().replace(/\s+/g, " ")
  const combined = prefix + text
  return combined.length > 96 ? `${combined.slice(0, 93)}…` : combined
}

function asDrafts(value: unknown): DraftQuestionBankItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (row): row is DraftQuestionBankItem =>
      Boolean(row) &&
      typeof row === "object" &&
      typeof (row as DraftQuestionBankItem).question_text === "string",
  )
}

function actionHref(action: FacultyCoraChatAction): string | null {
  switch (action.kind) {
    case "generate_questions":
    case "open_quiz_create":
      return `${FACULTY_DASHBOARD_BASE}/assessments/quizzes/question-bank`
    case "open_flashcards":
      return `${FACULTY_DASHBOARD_BASE}/content/flashcards`
    default:
      return null
  }
}

function parseFenceFiles(text: string) {
  const files: { path: string; content: string }[] = []
  const re = /```([^\n`]+)\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const header = match[1].trim()
    const content = match[2].replace(/\n$/, "")
    if (!content.trim()) continue
    const parts = header.split(/\s+/)
    const maybePath = parts.find((p) => p.includes("/")) || parts[parts.length - 1]
    if (!maybePath || !/[./]/.test(maybePath)) continue
    files.push({ path: maybePath.replace(/^\/+/, ""), content })
  }
  return files
}

export function FacultyCoraWorkspacePanel({
  capabilityId,
  initialPrompt,
  bootstrapNonce,
  fillHeight = false,
  immersive = false,
  onToggleImmersive,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const isBelowLg = useIsBelowLg()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [modeId, setModeId] = useState(capabilityId || "assistant")
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [drafts, setDrafts] = useState<DraftQuestionBankItem[]>([])
  const [draftModalOpen, setDraftModalOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [importOpen, setImportOpen] = useState(false)
  const [githubOpen, setGithubOpen] = useState(false)
  const [githubSeed, setGithubSeed] = useState<{
    title?: string
    description?: string
    files?: { path: string; content: string }[]
  }>({})
  const [importedProblem, setImportedProblem] = useState<CoraProblemContext | null>(null)
  const [importedLabel, setImportedLabel] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [threads, setThreads] = useState<FacultyCoraChatThread[]>([])
  const [archivedThreads, setArchivedThreads] = useState<FacultyCoraChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [historySyncing, setHistorySyncing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bootstrappedRef = useRef<number | null>(null)
  const createdAtRef = useRef<string>(new Date().toISOString())
  const titleCustomRef = useRef(false)
  const customTitleRef = useRef<string | null>(null)
  const persistTimerRef = useRef<number | null>(null)
  const persistInFlightRef = useRef(false)
  const persistQueuedRef = useRef<{ messages: ChatMessage[]; threadId: string } | null>(null)
  const [topbarHeight, setTopbarHeight] = useState(64)

  const activeThreads = useMemo(
    () => threads.filter((thread) => !thread.archivedAt),
    [threads],
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, isLoading, isIngesting])

  const loadHistory = useCallback(async () => {
    setHistorySyncing(true)
    try {
      const res = await listFacultyCoraThreads()
      const all = res.threads ?? []
      setThreads(all.filter((t) => !t.archivedAt))
      setArchivedThreads(all.filter((t) => Boolean(t.archivedAt)))
      if (!activeThreadId && res.activeThreadId) {
        const active =
          all.find((t) => t.id === res.activeThreadId) ??
          all.find((t) => !t.archivedAt) ??
          null
        if (active && messages.length === 0) {
          setActiveThreadId(active.id)
          setMessages(active.messages as ChatMessage[])
          createdAtRef.current = active.createdAt
          titleCustomRef.current = Boolean(active.titleIsCustom)
          customTitleRef.current = active.titleIsCustom ? active.title : null
        }
      }
    } catch {
      /* local-only until API available */
    } finally {
      setHistorySyncing(false)
    }
  }, [activeThreadId, messages.length])

  useEffect(() => {
    void loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!immersive) return
    setHistoryOpen(false)
    const measure = () => {
      const topbar = document.querySelector("[data-dashboard-topbar]")
      setTopbarHeight(topbar instanceof HTMLElement ? Math.ceil(topbar.getBoundingClientRect().height) : 64)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [immersive])

  const persistThread = useCallback(
    async (nextMessages: ChatMessage[], threadId: string) => {
      const meaningful = nextMessages.filter(
        (m) => m.content.trim() || m.importedQuestion || (m.proposals?.length ?? 0) > 0,
      )
      if (!meaningful.length) return
      const now = new Date().toISOString()
      const thread: FacultyCoraChatThread = {
        id: threadId,
        title:
          titleCustomRef.current && customTitleRef.current
            ? customTitleRef.current
            : deriveTitle(meaningful),
        preview: derivePreview(meaningful),
        capabilityId: modeId,
        messages: meaningful,
        createdAt: createdAtRef.current || now,
        updatedAt: now,
        titleIsCustom: titleCustomRef.current,
      }
      setThreads((prev) => {
        const without = prev.filter((item) => item.id !== thread.id)
        return [thread, ...without].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
      })
      setArchivedThreads((prev) => prev.filter((item) => item.id !== thread.id))
      if (persistInFlightRef.current) {
        persistQueuedRef.current = { messages: nextMessages, threadId }
        return
      }
      persistInFlightRef.current = true
      try {
        await upsertFacultyCoraThread(thread, true)
      } catch {
        /* keep local sidebar state */
      } finally {
        persistInFlightRef.current = false
        const queued = persistQueuedRef.current
        persistQueuedRef.current = null
        if (queued) void persistThread(queued.messages, queued.threadId)
      }
    },
    [modeId],
  )

  const schedulePersist = useCallback(
    (nextMessages: ChatMessage[], threadId: string) => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = window.setTimeout(() => {
        void persistThread(nextMessages, threadId)
      }, 600)
    },
    [persistThread],
  )

  const ensureThreadId = useCallback(() => {
    if (activeThreadId) return activeThreadId
    const id = createThreadId()
    setActiveThreadId(id)
    createdAtRef.current = new Date().toISOString()
    titleCustomRef.current = false
    customTitleRef.current = null
    return id
  }, [activeThreadId])

  const openDrafts = useCallback(
    (next: DraftQuestionBankItem[]) => {
      if (!next.length) {
        toast({ title: "No drafts returned", variant: "destructive" })
        return
      }
      setDrafts(next)
      setDraftModalOpen(true)
    },
    [toast],
  )

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim()
      if ((!message && !importedProblem) || isLoading) return

      const threadId = ensureThreadId()
      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: message || `Help with imported question: ${importedLabel || importedProblem?.title || "course item"}`,
        importedQuestion: importedProblem ?? undefined,
        importedQuestionLabel: importedLabel ?? undefined,
        timestamp: new Date().toISOString(),
      }
      const nextMessages = [...messages, userMessage]
      setMessages(nextMessages)
      setInput("")
      const problemForSend = importedProblem
      setImportedProblem(null)
      setImportedLabel(null)
      setIsLoading(true)
      schedulePersist(nextMessages, threadId)

      try {
        const history = nextMessages
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content }))
        const data = await sendFacultyCoraChat({
          message: userMessage.content,
          capabilityId: modeId,
          threadId,
          conversationHistory: history,
          problemContext: problemForSend,
          preferences: loadFacultyCoraPreferences(),
        })
        if (data.needsConfirmation) {
          const assistantMessage: ChatMessage = {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: data.reply || "Large Cora task — confirm to continue.",
            actions: data.actions ?? [],
            timestamp: new Date().toISOString(),
          }
          const withReply = [...nextMessages, assistantMessage]
          setMessages(withReply)
          schedulePersist(withReply, threadId)
          return
        }
        const replyActions = data.actions ?? []
        const replyProposals = data.proposals ?? []
        const replyPlans = data.plans ?? []
        const assistantMessage: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply || "I couldn't generate a reply.",
          actions: replyActions,
          proposals: replyProposals,
          plans: replyPlans,
          timestamp: new Date().toISOString(),
        }
        const withReply = [...nextMessages, assistantMessage]
        setMessages(withReply)
        schedulePersist(withReply, threadId)

        // Prefer confirmation cards; only auto-open draft modal when no create proposal
        if (!replyProposals.some((p) => p.tool === "questionBank.createQuestions")) {
          const draftAction = replyActions.find((a) => a.kind === "generate_questions")
          const embedded = asDrafts(draftAction?.payload?.drafts)
          if (embedded.length) openDrafts(embedded)
        }
      } catch (error) {
        toast({
          title: "Cora Copilot error",
          description: error instanceof Error ? error.message : "Failed to send message",
          variant: "destructive",
        })
        const errMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: "I hit an error talking to the teaching copilot. Try again in a moment.",
        }
        const withErr = [...nextMessages, errMsg]
        setMessages(withErr)
        schedulePersist(withErr, threadId)
      } finally {
        setIsLoading(false)
      }
    },
    [
      modeId,
      ensureThreadId,
      importedLabel,
      importedProblem,
      isLoading,
      messages,
      openDrafts,
      schedulePersist,
      toast,
    ],
  )

  useEffect(() => {
    if (!initialPrompt?.trim() || !bootstrapNonce) return
    if (bootstrappedRef.current === bootstrapNonce) return
    bootstrappedRef.current = bootstrapNonce
    void send(initialPrompt)
  }, [bootstrapNonce, initialPrompt, send])

  useEffect(() => {
    setModeId(capabilityId || "assistant")
  }, [capabilityId, bootstrapNonce])

  const startNewConversation = () => {
    setMessages([])
    setInput("")
    setImportedProblem(null)
    setImportedLabel(null)
    setActiveThreadId(createThreadId())
    createdAtRef.current = new Date().toISOString()
    titleCustomRef.current = false
    customTitleRef.current = null
    bootstrappedRef.current = null
  }

  const selectThread = (thread: FacultyCoraChatThread) => {
    setActiveThreadId(thread.id)
    setMessages((thread.messages as ChatMessage[]) ?? [])
    createdAtRef.current = thread.createdAt
    titleCustomRef.current = Boolean(thread.titleIsCustom)
    customTitleRef.current = thread.titleIsCustom ? thread.title : null
    setImportedProblem(null)
    setImportedLabel(null)
  }

  const renameThread = async (threadId: string, title: string) => {
    const source =
      threads.find((t) => t.id === threadId) ?? archivedThreads.find((t) => t.id === threadId)
    if (!source) return
    const updated = {
      ...source,
      title,
      titleIsCustom: true,
      updatedAt: new Date().toISOString(),
      archivedAt: undefined,
    }
    titleCustomRef.current = true
    customTitleRef.current = title
    setThreads((prev) => [updated, ...prev.filter((t) => t.id !== threadId)])
    setArchivedThreads((prev) => prev.filter((t) => t.id !== threadId))
    try {
      await upsertFacultyCoraThread(updated, threadId === activeThreadId)
    } catch {
      /* ignore */
    }
  }

  const archiveThread = async (threadId: string) => {
    const source = threads.find((t) => t.id === threadId)
    if (!source) return
    const updated = { ...source, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    setThreads((prev) => prev.filter((t) => t.id !== threadId))
    setArchivedThreads((prev) => [updated, ...prev.filter((t) => t.id !== threadId)])
    if (activeThreadId === threadId) startNewConversation()
    try {
      await upsertFacultyCoraThread(updated, false)
    } catch {
      /* ignore */
    }
  }

  const restoreThread = async (threadId: string) => {
    const source = archivedThreads.find((t) => t.id === threadId)
    if (!source) return
    const updated = { ...source, archivedAt: undefined, updatedAt: new Date().toISOString() }
    setArchivedThreads((prev) => prev.filter((t) => t.id !== threadId))
    setThreads((prev) => [updated, ...prev.filter((t) => t.id !== threadId)])
    try {
      await upsertFacultyCoraThread(updated, false)
    } catch {
      /* ignore */
    }
  }

  const removeThread = async (threadId: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== threadId))
    setArchivedThreads((prev) => prev.filter((t) => t.id !== threadId))
    if (activeThreadId === threadId) startNewConversation()
    try {
      await deleteFacultyCoraThread(threadId)
    } catch {
      /* ignore */
    }
  }

  const runAction = async (action: FacultyCoraChatAction, fromMessage?: ChatMessage) => {
    if (action.kind === "confirm_expensive_task") {
      const prompt =
        typeof action.payload.prompt === "string" ? action.payload.prompt : input.trim()
      if (!prompt) return
      setIsLoading(true)
      try {
        const threadId = ensureThreadId()
        const history = messages
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content }))
        const data = await sendFacultyCoraChat({
          message: prompt,
          capabilityId: modeId,
          threadId,
          conversationHistory: history,
          confirmExpensiveTask: true,
          preferences: loadFacultyCoraPreferences(),
        })
        const assistantMessage: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply || "Done.",
          actions: data.actions ?? [],
          proposals: data.proposals ?? [],
          plans: data.plans ?? [],
          timestamp: new Date().toISOString(),
        }
        const withReply = [...messages, assistantMessage]
        setMessages(withReply)
        schedulePersist(withReply, threadId)
      } catch (error) {
        toast({
          title: "Cora Copilot error",
          description: error instanceof Error ? error.message : "Try again",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (action.kind === "import_from_course") {
      setImportOpen(true)
      return
    }

    if (action.kind === "open_module") {
      try {
        const result = await runFacultyMigration("open_module", action.payload)
        if (result.href) router.push(result.href)
        toast({ title: "Opening module", description: result.message })
      } catch (error) {
        toast({
          title: "Could not open module",
          description: error instanceof Error ? error.message : "Try again",
          variant: "destructive",
        })
      }
      return
    }

    if (action.kind === "submit_github_fix") {
      const description =
        typeof action.payload.description === "string"
          ? action.payload.description
          : fromMessage?.content || ""
      const files = Array.isArray(action.payload.files)
        ? (action.payload.files as { path: string; content: string }[])
        : parseFenceFiles(description)
      setGithubSeed({
        title: typeof action.payload.title === "string" ? action.payload.title : "Cora Copilot fix",
        description,
        files,
      })
      setGithubOpen(true)
      return
    }

    if (action.kind === "schedule_automation") {
      try {
        const jobType =
          action.payload.jobType === "post_lecture_flashcards"
            ? "post_lecture_flashcards"
            : "weekly_announcement"
        await scheduleFacultyCoraAutomation({
          jobType,
          payload: action.payload,
          runInHours: Number(action.payload.runInHours ?? 24),
        })
        toast({ title: "Automation scheduled", description: action.label })
      } catch (error) {
        toast({
          title: "Could not schedule",
          description: error instanceof Error ? error.message : "Try again",
          variant: "destructive",
        })
      }
      return
    }

    if (action.kind === "generate_questions") {
      const embedded = asDrafts(action.payload.drafts)
      if (embedded.length) {
        openDrafts(embedded)
        return
      }
      const prompt =
        typeof action.payload.prompt === "string"
          ? action.payload.prompt
          : "Generate question bank drafts for this course"
      setIsLoading(true)
      try {
        const res = await generateFacultyCoraQuestions({ prompt, count: 5 })
        openDrafts(asDrafts(res.drafts ?? res.questions))
      } catch (error) {
        toast({
          title: "Could not generate drafts",
          description: error instanceof Error ? error.message : "Try again",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
      return
    }

    const href = actionHref(action)
    if (href) {
      if (typeof action.payload.prompt === "string") {
        sessionStorage.setItem("facultyCoraQuestionPrompt", action.payload.prompt)
      }
      router.push(href)
    }
  }

  const handleFile = async (file: File | null) => {
    if (!file) return
    setIsIngesting(true)
    try {
      const res = await ingestFacultyCoraDocument({
        file,
        intent: "extract_questions",
        prompt: input.trim() || undefined,
      })
      const next = asDrafts(res.drafts)
      const threadId = ensureThreadId()
      const nextMessages: ChatMessage[] = [
        ...messages,
        {
          id: `u-${Date.now()}`,
          role: "user",
          content: `Uploaded ${file.name} for question extraction`,
        },
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.message || `Extracted ${next.length} draft questions from ${file.name}.`,
          actions: next.length
            ? [
                {
                  id: "review-drafts",
                  label: "Review drafts",
                  kind: "generate_questions",
                  payload: { drafts: next, prompt: input.trim() },
                },
              ]
            : undefined,
        },
      ]
      setMessages(nextMessages)
      schedulePersist(nextMessages, threadId)
      if (next.length) openDrafts(next)
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Try a PDF or image",
        variant: "destructive",
      })
    } finally {
      setIsIngesting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const busy = isLoading || isIngesting

  return (
    <div
      className={cn(
        "relative flex min-h-0 w-full min-w-0 overflow-hidden bg-[var(--card)]",
        immersive
          ? "fixed inset-x-0 bottom-0 z-40 rounded-none border-0"
          : fillHeight
            ? "h-full flex-1 rounded-2xl border border-[var(--border)] sm:rounded-3xl"
            : "h-[min(calc(100dvh-13rem),720px)] rounded-2xl border border-[var(--border)] sm:h-[min(78vh,820px)] sm:rounded-3xl",
      )}
      style={immersive ? { top: topbarHeight } : undefined}
      role={immersive ? "dialog" : undefined}
      aria-modal={immersive ? true : undefined}
      aria-label={immersive ? "Cora Copilot immersive workspace" : undefined}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--border)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <CoraLogo size="sm" />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <p className="truncate text-sm font-medium text-[var(--cc-text)]">{FACULTY_CORA_NAV_LABEL}</p>
                {modeId ? (
                  <span className="hidden max-w-[8rem] truncate rounded-full bg-[var(--muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--cc-text-secondary)] sm:inline">
                    {facultyCoraCapability(modeId).title}
                  </span>
                ) : null}
              </div>
              <p className="hidden truncate text-xs text-[var(--cc-text-muted)] sm:block">
                {immersive ? "Expanded · Esc to exit" : FACULTY_CORA_TAGLINE}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-xl px-2 sm:h-9 sm:px-3"
              onClick={() => setHistoryOpen((v) => !v)}
            >
              <PanelRight className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">History</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-xl px-2 sm:h-9 sm:px-3"
              onClick={startNewConversation}
            >
              <Plus className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">New chat</span>
            </Button>
            {onToggleImmersive ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-xl px-2 sm:h-9 sm:px-3"
                onClick={onToggleImmersive}
                aria-label={immersive ? "Exit expanded workspace" : "Expand workspace"}
                title={immersive ? "Exit expanded workspace (Esc)" : "Expand workspace"}
              >
                {immersive ? <Minimize2 className="h-3.5 w-3.5 sm:mr-1.5 sm:h-4 sm:w-4" /> : <Maximize2 className="h-3.5 w-3.5 sm:mr-1.5 sm:h-4 sm:w-4" />}
                <span className="hidden sm:inline">{immersive ? "Exit" : "Expand"}</span>
              </Button>
            ) : null}
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
          <div className="mx-auto w-full min-w-0 max-w-2xl space-y-2">
            {messages.length === 0 && !busy ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-3 py-6 text-center sm:rounded-3xl sm:px-5 sm:py-8">
                <Sparkles className="mx-auto h-6 w-6 text-[var(--cc-text-muted)]" />
                <p className="mt-3 text-sm font-medium text-[var(--cc-text)]">
                  Ask {FACULTY_CORA_NAV_LABEL} to create, improve, analyze, or automate
                </p>
                <p className="mt-1 text-xs text-[var(--cc-text-muted)]">
                  Import from course, upload PDFs, or submit GitHub fixes from the + menu.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {COMPOSER_STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => void send(starter)}
                      className="max-w-full rounded-full border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-1.5 text-left text-xs leading-snug text-[var(--cc-text)] hover:bg-[var(--muted)]/40"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === "user" && msg.importedQuestion ? (
                  <div className="mb-2">
                    <CoraImportedQuestionPreview
                      label={msg.importedQuestionLabel}
                      problem={msg.importedQuestion as CoraProblemContext}
                      compact
                    />
                  </div>
                ) : null}
                <CoraChatBubble role={msg.role === "user" ? "student" : "ai"}>
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <FeedbackTextRenderer
                      text={msg.content}
                      className="cora-ai-reply text-[15px] leading-[1.7] [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex-display]:text-left [&_li]:leading-relaxed"
                    />
                  )}
                </CoraChatBubble>
                {msg.proposals && msg.proposals.length > 0 ? (
                  <div className="mb-4 space-y-2">
                    {msg.proposals.map((proposal) => (
                      <CoraActionCard
                        key={proposal.actionId}
                        proposal={proposal}
                        portal="faculty"
                      />
                    ))}
                  </div>
                ) : null}
                {msg.plans && msg.plans.length > 0 ? (
                  <div className="mb-4 space-y-2">
                    {msg.plans.map((plan) => (
                      <CoraTransactionPlanCard key={plan.planId} plan={plan} />
                    ))}
                  </div>
                ) : null}
                {msg.actions && msg.actions.length > 0 ? (
                  <div className="mb-6 flex flex-wrap gap-2">
                    {msg.actions.map((action) => (
                      <Button
                        key={action.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => void runAction(action as FacultyCoraChatAction, msg)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {busy ? (
              <div className="flex items-center gap-2 text-sm text-[var(--cc-text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isIngesting ? "Extracting questions from document…" : isLoading ? "Preparing response…" : "Cora is thinking…"}
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--border)] px-3 py-2.5 sm:px-6 sm:py-3">
          {importedProblem ? (
            <div className="mx-auto mb-2 w-full min-w-0 max-w-2xl">
              <CoraImportedQuestionPreview
                label={importedLabel}
                problem={importedProblem}
                compact
                onClear={() => {
                  setImportedProblem(null)
                  setImportedLabel(null)
                }}
              />
            </div>
          ) : null}
          <div className="mx-auto w-full min-w-0 max-w-2xl space-y-2">
            <div className="flex min-w-0 items-end gap-1.5 rounded-[24px] border border-[var(--border)] bg-[var(--background)] px-1.5 py-1.5 sm:gap-2 sm:rounded-[28px] sm:px-2 sm:py-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="mb-1 h-9 w-9 rounded-full"
                  disabled={busy}
                  aria-label="Attach and tools"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Attachments</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setImportOpen(true)}>
                  <Library className="mr-2 h-4 w-4" />
                  Import from course
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Upload PDF or image
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPasteOpen(true)}>
                  <ClipboardPaste className="mr-2 h-4 w-4" />
                  Paste content
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
                {FACULTY_CORA_INTENTS.map((intent) => (
                  <DropdownMenuItem
                    key={intent.id}
                    onClick={() => {
                      const dispatched = dispatchFacultyCoraIntent(intent.id)
                      if (dispatched) void send(dispatched.starterPrompt)
                    }}
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {intent.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setGithubSeed({
                      title: "Cora Copilot fix",
                      description: messages.filter((m) => m.role === "assistant").at(-1)?.content || "",
                      files: parseFenceFiles(
                        messages.filter((m) => m.role === "assistant").at(-1)?.content || "",
                      ),
                    })
                    setGithubOpen(true)
                  }}
                >
                  <Github className="mr-2 h-4 w-4" />
                  Submit GitHub fix
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mb-0.5 h-8 max-w-[5.5rem] shrink-0 truncate rounded-full px-2 text-[11px] font-medium sm:mb-1 sm:h-8 sm:max-w-none sm:px-2.5 sm:text-xs"
                  disabled={busy}
                >
                  {facultyCoraCapability(modeId).title}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {FACULTY_CORA_CAPABILITIES.map((capability) => (
                  <DropdownMenuItem key={capability.id} onClick={() => setModeId(capability.id)}>
                    {capability.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            />

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
              placeholder={messages.length > 0 ? "Ask a follow-up..." : "Ask Cora to draft questions, announcements, analysis…"}
              rows={1}
              disabled={busy}
              className="min-h-[36px] min-w-0 max-h-36 flex-1 resize-none border-0 bg-transparent p-1.5 text-sm shadow-none focus-visible:ring-0 sm:min-h-[40px] sm:p-2"
            />
            <Button
              type="button"
              size="icon"
              className="mb-0.5 h-8 w-8 shrink-0 rounded-full sm:mb-1 sm:h-9 sm:w-9"
              disabled={busy || (!input.trim() && !importedProblem)}
              onClick={() => void send(input)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
            </div>
          </div>
        </div>
      </div>

      {historyOpen ? (
        <div className="hidden w-[280px] shrink-0 lg:block">
          <FacultyCoraSessionSidebar
            threads={activeThreads}
            archivedThreads={archivedThreads}
            activeThreadId={activeThreadId}
            syncing={historySyncing}
            onSelect={selectThread}
            onNew={startNewConversation}
            onRename={(id, title) => void renameThread(id, title)}
            onArchive={(id) => void archiveThread(id)}
            onRestore={(id) => void restoreThread(id)}
            onDelete={(id) => void removeThread(id)}
            onClose={() => setHistoryOpen(false)}
          />
        </div>
      ) : null}

      <Sheet open={historyOpen && isBelowLg} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-[min(100vw-1rem,320px)] p-0 lg:hidden">
          <FacultyCoraSessionSidebar
            threads={activeThreads}
            archivedThreads={archivedThreads}
            activeThreadId={activeThreadId}
            syncing={historySyncing}
            onSelect={(thread) => {
              selectThread(thread)
              setHistoryOpen(false)
            }}
            onNew={() => {
              startNewConversation()
              setHistoryOpen(false)
            }}
            onRename={(id, title) => void renameThread(id, title)}
            onArchive={(id) => void archiveThread(id)}
            onRestore={(id) => void restoreThread(id)}
            onDelete={(id) => void removeThread(id)}
            onClose={() => setHistoryOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <FacultyCoraQuestionBankDraftModal
        open={draftModalOpen}
        drafts={drafts}
        onClose={() => setDraftModalOpen(false)}
        onSaved={() => {
          const threadId = ensureThreadId()
          setFacultyCoraPending({
            kind: "question_bank_drafts",
            drafts,
            createdAt: new Date().toISOString(),
          })
          const nextMessages: ChatMessage[] = [
            ...messages,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content:
                "Drafts saved to Question Bank. You can assemble a quiz or homework from them next.",
              actions: [
                {
                  id: "open-qb",
                  label: "Open Question Bank",
                  kind: "open_module",
                  payload: { moduleKind: "question_bank_drafts" },
                },
                {
                  id: "open-quiz",
                  label: "Create quiz from bank",
                  kind: "open_module",
                  payload: { moduleKind: "quiz_create" },
                },
              ],
            },
          ]
          setMessages(nextMessages)
          schedulePersist(nextMessages, threadId)
        }}
      />

      <FacultyCoraImportCourseDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        hint={
          modeId === "improve"
            ? {
                sourceKey: "question_bank",
                improveGoal: "Import a question to improve wording, distractors, or difficulty.",
              }
            : null
        }
        onImport={(problem, item) => {
          setImportedProblem(problem)
          setImportedLabel(item.label)
          toast({ title: "Question attached", description: item.label })
        }}
      />

      <FacultyCoraGithubFixDialog
        open={githubOpen}
        onClose={() => setGithubOpen(false)}
        initialTitle={githubSeed.title}
        initialDescription={githubSeed.description}
        initialFiles={githubSeed.files}
      />

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste content</DialogTitle>
          </DialogHeader>
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            placeholder="Paste lecture notes, a quiz draft, or announcement text…"
            className="rounded-xl"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!pasteText.trim()}
              onClick={() => {
                const text = pasteText.trim()
                setPasteOpen(false)
                setPasteText("")
                void send(`Use the following course content to help me teach:\n\n${text}`)
              }}
            >
              Send to Cora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
