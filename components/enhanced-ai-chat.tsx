"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Send, 
  Copy, 
  Download, 
  Search,
  Bookmark,
  BookmarkCheck,
  Code,
  FileCode,
  X,
  Check,
  Loader2,
  Sparkles,
  Tag,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Bot,
  ListOrdered,
  Baby,
  Brain,
  Gamepad2,
  Mic,
  Volume2,
  Play,
  Square,
  BarChart3,
  Settings,
  GraduationCap,
  Lightbulb,
  Bug,
  Eye,
  BookOpen,
  FileText,
  Zap,
  Target,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { CodePlaygroundInline } from "./code-playground-inline"
import { BottomToolBar } from "./ai-tutor/BottomToolBar"
import { ConceptModal } from "./ai-tutor/ConceptModal"
import { MiniLessonDrawer } from "./ai-tutor/MiniLessonDrawer"
import { DebugPanel } from "./ai-tutor/DebugPanel"
import { DebugTraceModal } from "./ai-tutor/DebugTraceModal"
import { DocGeneratorPanel } from "./ai-tutor/DocGeneratorPanel"
import { MoreToolsDrawer } from "./ai-tutor/MoreToolsDrawer"
import { CoraThinkingIndicator } from "@/components/cora/CoraThinkingIndicator"
import { CoraWorkspaceWelcome } from "@/components/cora/CoraWorkspaceWelcome"
import { CoraQuestionImportDialog } from "@/components/cora/CoraQuestionImportDialog"
import { CoraImportedQuestionPreview } from "@/components/cora/CoraImportedQuestionPreview"
import { FeedbackTextRenderer } from "@/components/question-text-renderer"
import type { CoraImportableItem } from "@/lib/cora/question-import-types"
import type { CoraProblemContext } from "@/lib/cora/types"
import {
  CORA_LEARNING_GOALS,
  DEFAULT_LEARNING_GOAL,
  getLearningGoalMeta,
  type CoraLearningGoal,
} from "@/lib/cora/learning-goals"
import { defaultBehaviorToLearningGoal } from "@/lib/cora/preferences-storage"
import { cn } from "@/lib/utils"
import {
  buildAttachmentContext,
  imageAttachmentsForApi,
  processChatFiles,
  type ChatAttachment,
} from "@/lib/cora/chat-attachments"
import { buildWorkspaceSessionSnapshot } from "@/lib/cora/session-artifacts"
import {
  activeCoraConversations,
  archivedCoraConversations,
  loadCoraConversationsFromStorage,
  mergeCoraConversations,
  reviveStoredCoraConversation,
  saveCoraConversationsToStorage,
  serializeCoraConversations,
} from "@/lib/cora/conversation-storage"
import {
  countUserExchanges,
  getMaxExchangesForTier,
  isThreadAtExchangeLimit,
} from "@/lib/cora/exchange-limits"
import {
  appendUserMessageVersion,
  applyUserMessageVersion,
  getActiveUserVersion,
  getActiveUserVersionIndex,
  getUserMessageVersions,
  rebuildThreadAfterVersionChange,
  saveAssistantOnActiveVersion,
  userMessageHasMultipleVersions,
} from "@/lib/cora/message-versions"
import type { CoraMessageMenuActionId } from "@/lib/cora/message-actions"
import { CoraAssistantMessageMenu } from "@/components/cora/CoraAssistantMessageMenu"
import {
  CoraUserMessageMenu,
  type CoraUserMessageMenuAction,
} from "@/components/cora/CoraUserMessageMenu"
import {
  attachImportedQuestionToMessage,
  restoreImportedQuestionsInConversations,
} from "@/lib/cora/import-recovery"
import type { MembershipTier } from "@/lib/membership-constants"
import type { CoraWorkspaceBootstrap } from "@/components/cora/platform/CoraDashboard"
import {
  deleteCoraWorkspaceConversationFromApi,
  fetchCoraWorkspaceConversationsFromApi,
  syncCoraWorkspaceConversationsToApi,
} from "@/lib/cora/workspace-conversations.client"
import {
  detectWorkspaceAction,
  formatCapabilitiesHelpText,
  type CoraWorkspaceActionIntent,
} from "@/lib/cora/workspace-actions"
import type { CoraPlatformTab } from "@/lib/cora/platform-nav"
import {
  CALENDAR_ASSISTANT_PROMPT,
  EXAM_COUNTDOWN_PROMPT,
  STUDY_PLAN_GENERATION_PROMPT,
  WEEKLY_REVIEW_PROMPT,
  type CoraChatFlow,
} from "@/lib/cora/study-plan-flows"
import { buildReadOnlyRefusal, detectForbiddenWriteIntent } from "@/lib/cora/read-only-agent"
import { CoraChatBubble } from "@/components/cora/CoraChatBubble"
import { CoraActionCard } from "@/components/cora/CoraActionCard"
import type { CoraActionProposal } from "@/lib/cora/confirmations/action-proposals"
import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import { useRouter } from "next/navigation"

async function parseApiJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(
      response.status >= 500
        ? "Cora is temporarily unavailable. Refresh the page and try again."
        : `Unexpected server response (${response.status}).`,
    )
  }
}

function StudyPlanAutomationBanner({
  status,
  onRetry,
}: {
  status: "running" | "done" | "error"
  onRetry?: () => void
}) {
  if (status === "running") {
    return (
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/90 px-3 py-2 text-sm text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/50 dark:text-violet-100">
        <Loader2 className="h-4 w-4 animate-spin" />
        Saving notes, calendar, flashcards, Practice Hub quizzes, and reminders…
      </div>
    )
  }

  if (status === "done") {
    return (
      <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
        Study plan saved — calendar, flashcards, Practice Hub quizzes, and reminders are set.
      </div>
    )
  }

  return (
    <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40">
      <span>Could not fully automate your study plan.</span>
      {onRetry ? (
        <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}

// Extended message types for premium features
type MessageType = 'normal' | 'lessonBlock' | 'visualizer' | 'rubricFeedback' | 'debugTrace' | 'mistakeSimulation'

interface MessageMeta {
  askedQuestion?: boolean
  difficulty?: 'easy' | 'medium' | 'hard'
  weaknessDetected?: boolean
  microLessonAvailable?: boolean
  tutorReasoning?: string
  conceptTested?: string
  evaluationCriteria?: string
}

interface Message {
  id: string
  role: "student" | "ai"
  content: string
  timestamp: Date
  topic?: string
  isBookmarked?: boolean
  hasCodePlayground?: boolean
  mode?: 'normal' | 'step-by-step' | 'eli5'
  messageType?: MessageType
  meta?: MessageMeta
  proposals?: CoraActionProposal[]
  /** Scope redirect false-positive feedback (ENFORCE mode only) */
  scopeFeedback?: {
    eventId: number | null
    originalMessage: string
  } | null
  weaknessInsight?: string
  visualizerData?: {
    type: 'pointer' | 'recursion' | 'array' | 'execution'
    steps: Array<{ step: number; state: string; description: string }>
  }
  rubricFeedback?: {
    logicalConsistency: number
    completeness: number
    correctness: number
    misconceptions: string[]
  }
  debugTrace?: {
    lineNumber: number
    issue: string
    fix: string
    memoryMap?: string
  }[]
  mistakeSimulation?: {
    wrongCode: string
    explanation: string
    correctCode: string
    takeaways: string[]
  }
  lessonBlock?: {
    definition: string
    whyItMatters: string
    example: string
    visualExplanation: string
    quizQuestion: string
    nextStep: string
  }
  importedQuestion?: CoraProblemContext
  importedQuestionLabel?: string
  versions?: import("@/lib/cora/message-versions").CoraMessageVersion[]
  activeVersionIndex?: number
}

interface SavedConversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  lastUpdated: Date
  archivedAt?: Date
  capabilityId?: string
}

function conversationTitle(messages: Message[]): string {
  const firstPrompt = messages.find((message) => message.role === "student")?.content ?? ""
  const clean = firstPrompt
    .replace(/```[\s\S]*?```/g, " code ")
    .replace(/[#*_`[\]()]/g, "")
    .replace(/^\/\w+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()

  if (!clean) return "New Cora chat"
  return clean.length > 44 ? `${clean.slice(0, 43).trimEnd()}…` : clean
}

interface ChatConfig {
  learningGoal: CoraLearningGoal
  flow?: CoraChatFlow
}

interface SessionMemory {
  misunderstandings: string[]
  strengths: string[]
  tonePatterns: string[]
  confusionScore: number
  reasoningQuality: number
}

interface EnhancedAIChatProps {
  studentId?: string
  hideHeader?: boolean
  hideFooter?: boolean
  className?: string
  onSettingsClick?: () => void
  learningMemory?: Record<string, boolean>
  tutorPreferences?: import("@/lib/cora/preferences-storage").CoraTutorPreferences | null
  onStudyPlanRequested?: () => void
  workspaceMode?: boolean
  studentFirstName?: string
  initialLearningGoal?: CoraLearningGoal
  onWorkspaceSessionChange?: (snapshot: import("@/lib/cora/session-artifacts").CoraWorkspaceSessionSnapshot) => void
  workspaceSessionRef?: React.MutableRefObject<import("@/lib/cora/session-artifacts").CoraWorkspaceSessionController | null>
  onCoraNavigate?: (tab: CoraPlatformTab, toolId?: string) => void
  onAppNavigate?: (href: string) => void
  membershipTier?: MembershipTier | null
  bootstrap?: CoraWorkspaceBootstrap | null
  preparedStudentContext?: CoraStudentContextPayload | null
}

export function EnhancedAIChat({ 
  studentId, 
  hideHeader = false, 
  hideFooter = false, 
  className = "", 
  onSettingsClick,
  learningMemory: externalLearningMemory,
  tutorPreferences: externalTutorPreferences = null,
  onStudyPlanRequested,
  workspaceMode = false,
  studentFirstName,
  initialLearningGoal,
  onWorkspaceSessionChange,
  workspaceSessionRef,
  onCoraNavigate,
  onAppNavigate,
  membershipTier = null,
  bootstrap = null,
  preparedStudentContext = null,
}: EnhancedAIChatProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [codeInput, setCodeInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [showPlayground, setShowPlayground] = useState<string | null>(null)
  const [showConfigPanel, setShowConfigPanel] = useState(false)
  const [studentContext, setStudentContext] = useState<any>(null)
  const [studyPlanAutomationStatus, setStudyPlanAutomationStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle")
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  
  // Tool modals/drawers state
  const [showConceptModal, setShowConceptModal] = useState(false)
  const [showMiniLessonDrawer, setShowMiniLessonDrawer] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [showDebugTraceModal, setShowDebugTraceModal] = useState(false)
  const [showDocGeneratorPanel, setShowDocGeneratorPanel] = useState(false)
  const [showMoreToolsDrawer, setShowMoreToolsDrawer] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([])
  const [importedProblem, setImportedProblem] = useState<CoraProblemContext | null>(null)
  const [scopeRetry, setScopeRetry] = useState<{
    confirm: boolean
    context: string | null
  } | null>(null)
  const scopeRetryRef = useRef<{ confirm: boolean; context: string | null } | null>(null)
  const [importedMeta, setImportedMeta] = useState<CoraImportableItem | null>(null)
  const [reattachTargetMessageId, setReattachTargetMessageId] = useState<string | null>(null)
  const [credits, setCredits] = useState<{
    credits: number
    isUnlimited: boolean
    creditsLimit?: number | string
  } | null>(null)
  const editingMessageIdRef = useRef<string | null>(null)
  const activeCapabilityIdRef = useRef<string | undefined>(undefined)
  const resolvedMembershipTier =
    membershipTier ||
    (typeof window !== "undefined"
      ? ((sessionStorage.getItem("studentMembershipTier") ||
          localStorage.getItem("studentMembershipTier")) as MembershipTier | null)
      : null)
  const [showQuestionImport, setShowQuestionImport] = useState(false)

  const [chatConfig, setChatConfig] = useState<ChatConfig>({
    learningGoal:
      initialLearningGoal ??
      (externalTutorPreferences
        ? defaultBehaviorToLearningGoal(externalTutorPreferences.defaultBehavior)
        : DEFAULT_LEARNING_GOAL),
  })

  useEffect(() => {
    if (initialLearningGoal) {
      setChatConfig({ learningGoal: initialLearningGoal })
    }
  }, [initialLearningGoal])
  
  const [sessionMemory, setSessionMemory] = useState<SessionMemory>({
    misunderstandings: [],
    strengths: [],
    tonePatterns: [],
    confusionScore: 0,
    reasoningQuality: 0
  })
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null)
  const activeConversationIdRef = useRef<string | null>(null)
  const savedConversationsRef = useRef<SavedConversation[]>([])
  const serverSyncTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    activeConversationIdRef.current = currentConversationId
    if (studentId && workspaceMode && currentConversationId) {
      sessionStorage.setItem(`cora-workspace-active:${studentId}`, currentConversationId)
    }
  }, [currentConversationId, studentId, workspaceMode])

  useEffect(() => {
    savedConversationsRef.current = savedConversations
  }, [savedConversations])

  const readMergedStoredConversations = useCallback((): SavedConversation[] => {
    if (!studentId) return savedConversationsRef.current
    return mergeCoraConversations(
      loadCoraConversationsFromStorage(studentId) as SavedConversation[],
      savedConversationsRef.current,
    ) as SavedConversation[]
  }, [studentId])

  const queueServerConversationSync = useCallback(
    (conversations: SavedConversation[]) => {
      if (!studentId || !workspaceMode || conversations.length === 0) return
      if (serverSyncTimeoutRef.current) window.clearTimeout(serverSyncTimeoutRef.current)
      serverSyncTimeoutRef.current = window.setTimeout(() => {
        void syncCoraWorkspaceConversationsToApi(serializeCoraConversations(conversations)).catch(
          (error) => {
            console.warn("[Cora] Failed to sync conversations to server:", error)
          },
        )
      }, 800)
    },
    [studentId, workspaceMode],
  )

  const commitSavedConversations = useCallback(
    (conversations: SavedConversation[]): SavedConversation[] => {
      if (!studentId) {
        savedConversationsRef.current = conversations
        setSavedConversations(conversations)
        return conversations
      }
      const merged = mergeCoraConversations(
        loadCoraConversationsFromStorage(studentId) as SavedConversation[],
        savedConversationsRef.current,
        conversations,
      ) as SavedConversation[]
      saveCoraConversationsToStorage(studentId, serializeCoraConversations(merged))
      savedConversationsRef.current = merged
      setSavedConversations(merged)
      queueServerConversationSync(merged)
      return merged
    },
    [studentId, queueServerConversationSync],
  )

  useEffect(() => {
    if (!studentId) return

    let cancelled = false

    const applyConversations = (conversations: SavedConversation[]) => {
      if (cancelled) return
      savedConversationsRef.current = conversations
      setSavedConversations(conversations)
      saveCoraConversationsToStorage(studentId, serializeCoraConversations(conversations))
    }

    if (!workspaceMode) {
      applyConversations(loadCoraConversationsFromStorage(studentId) as SavedConversation[])
      return () => {
        cancelled = true
      }
    }

    void (async () => {
      const local = loadCoraConversationsFromStorage(studentId) as SavedConversation[]
      let remote: SavedConversation[] = []
      try {
        const rows = await fetchCoraWorkspaceConversationsFromApi()
        remote = rows.map(reviveStoredCoraConversation) as SavedConversation[]
      } catch (error) {
        console.warn("[Cora] Could not load conversations from server:", error)
      }

      const merged = mergeCoraConversations(local, remote) as SavedConversation[]
      applyConversations(merged)
      if (merged.length > 0) {
        queueServerConversationSync(merged)
        if (!activeConversationIdRef.current) {
          const storedId =
            typeof window !== "undefined"
              ? sessionStorage.getItem(`cora-workspace-active:${studentId}`)
              : null
          const active = merged.filter((conversation) => !conversation.archivedAt)
          const match =
            active.find((conversation) => conversation.id === storedId) ?? active[0]
          if (match?.messages?.length) {
            setMessages(
              match.messages.map((msg) => ({
                ...msg,
                timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
              })),
            )
            setCurrentConversationId(match.id)
            activeConversationIdRef.current = match.id
          }
        }
      }

      try {
        const recovered = await restoreImportedQuestionsInConversations(studentId, merged)
        if (!cancelled && recovered.changed) {
          applyConversations(recovered.conversations as SavedConversation[])
          queueServerConversationSync(recovered.conversations as SavedConversation[])
        }
      } catch (error) {
        console.warn("[Cora] Import recovery skipped:", error)
      }
    })()

    return () => {
      cancelled = true
      if (serverSyncTimeoutRef.current) {
        window.clearTimeout(serverSyncTimeoutRef.current)
      }
    }
  }, [studentId, workspaceMode, queueServerConversationSync])

  useEffect(() => {
    // Load student context
    if (studentId) {
      loadStudentContext()
    }
  }, [studentId])

  useEffect(() => {
    if (!studentId) return
    const interval = window.setInterval(() => {
      void loadStudentContext()
    }, 5 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [studentId])

  useEffect(() => {
    if (!studentId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/ai-tutor/credits?studentId=${encodeURIComponent(studentId)}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setCredits({
          credits: Number(data.credits) || 0,
          isUnlimited: Boolean(data.isUnlimited),
          creditsLimit: data.creditsLimit,
        })
      } catch {
        // Credits are best-effort; send still hits server limits.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [studentId])

  useEffect(() => {
    // Initialize with welcome message if no messages (non-workspace legacy mode)
    if (messages.length === 0 && !workspaceMode) {
      const welcomeMessage: Message = {
        id: "welcome",
        role: "ai",
        content: `# Welcome to Cora! ✨

I'm your personal learning intelligence — not just answers, but guided problem-solving across your course.

- **Interactive Solve** — step-by-step with animations and checkpoints
- **Code debugging** and execution tracing
- **Concept explanations** aligned with your lectures
- **Study plans** and exam preparation
- **Course-aware** responses using instructor materials

💡 **Tip:** Paste problems in 🧠 Solve, or use 💬 Workspace for open-ended work.

How can I help you learn today?`,
        timestamp: new Date(),
        topic: "Welcome"
      }
      setMessages([welcomeMessage])
    }
  }, [studentId])

  useEffect(() => {
    if (preparedStudentContext) {
      setStudentContext(preparedStudentContext)
    }
  }, [preparedStudentContext])

  const loadStudentContext = async () => {
    if (preparedStudentContext) {
      setStudentContext(preparedStudentContext)
      return preparedStudentContext
    }
    if (!studentId) return null

    setIsLoadingContext(true)
    try {
      const response = await fetch('/api/ai-tutor/student-context', {
        headers: {
          'x-student-id': studentId
        }
      })
      if (response.ok) {
        const context = await parseApiJson(response)
        setStudentContext(context)
        return context
      }
    } catch (error) {
      console.error("Failed to load student context:", error)
    } finally {
      setIsLoadingContext(false)
    }
    return null
  }

  // Handle quick actions with student context
  const handleQuickAction = async (action: string) => {
    switch (action) {
      case "paste-code":
        setShowCodeInput(true)
        return
      case "concept":
        setShowConceptModal(true)
        return
      case "mini-lesson":
        setShowMiniLessonDrawer(true)
        return
      case "debug":
        setShowDebugPanel(true)
        return
      case "debug-trace":
        setShowDebugTraceModal(true)
        return
      case "doc-generator":
        setShowDocGeneratorPanel(true)
        return
      case "alternative-solutions":
      case "complexity-analysis":
      case "refactor-mode":
      case "exam-prep-mode":
      case "teaching-personality":
      case "explain-thinking":
      case "code-translator":
        setShowMoreToolsDrawer(true)
        return
    }

    if (!studentId) {
      toast({
        title: "Student ID Required",
        description: "Please log in to use quick actions",
        variant: "destructive",
      })
      return
    }

    if (!studentContext) {
      await loadStudentContext()
    }

    const context = studentContext || {}
    const strugglingTopics = context.strugglingTopics || []
    const summary = context.summary || {}

    let contextInfo = ""
    if (strugglingTopics.length > 0) {
      contextInfo += `\n\n**Student's Struggling Topics:** ${strugglingTopics.slice(0, 5).join(", ")}`
    }
    if (Number(summary.avgPracticeScore) > 0) {
      contextInfo += `\n**Practice Hub Performance:** Average score: ${Number(summary.avgPracticeScore).toFixed(1)}% (${summary.totalPracticeAttempts} attempts)`
    }
    if (Number(summary.avgQuizScore) > 0) {
      contextInfo += `\n**Assessment Performance:** Average score: ${Number(summary.avgQuizScore).toFixed(1)}% (${summary.totalQuizAttempts} attempts)`
    }

    const prompt = `Help me with ${action}.${contextInfo}`
    setInputValue(prompt)
    inputRef.current?.focus()
  }

  const handleFilesSelected = async (files: FileList) => {
    try {
      const processed = await processChatFiles(Array.from(files))
      if (processed.length === 0) {
        toast({
          title: "Couldn't add files",
          description: "Use photos or text/code files under 5 MB each.",
          variant: "destructive",
        })
        return
      }
      setPendingAttachments((prev) => [...prev, ...processed].slice(0, 5))
      if (processed.length < files.length) {
        toast({
          title: "Some files skipped",
          description: "Max 5 attachments, 5 MB each. PDFs: photograph pages or paste text.",
        })
      }
    } catch {
      toast({
        title: "Upload failed",
        description: "Could not read one or more files.",
        variant: "destructive",
      })
    }
  }

  const handleConceptSelect = (concept: string) => {
    const context = studentContext || {}
    const strugglingTopics = context.strugglingTopics || []
    const contextInfo = strugglingTopics.length > 0 
      ? `\n\n**Student's Struggling Topics:** ${strugglingTopics.slice(0, 5).join(", ")}`
      : ""
    
    const prompt = `Explain the concept of "${concept}" clearly and comprehensively.${contextInfo}`
    setInputValue(prompt)
    inputRef.current?.focus()
  }

  const handleMiniLessonGenerate = async (options: {
    difficulty: string
    includeExamples: boolean
    autoQuiz: boolean
    topic?: string
  }) => {
    const context = studentContext || {}
    const strugglingTopics = context.strugglingTopics || []
    const contextInfo = strugglingTopics.length > 0 
      ? `\n\n**Student's Struggling Topics:** ${strugglingTopics.slice(0, 5).join(", ")}`
      : ""
    
    const topic = options.topic || (strugglingTopics.length > 0 ? strugglingTopics[0] : "programming fundamentals")
    const prompt = `Create a ${options.difficulty} mini-lesson about "${topic}".${options.includeExamples ? " Include practical code examples." : ""}${options.autoQuiz ? " Generate quiz questions at the end." : ""}${contextInfo}`
    setInputValue(prompt)
    inputRef.current?.focus()
    await sendAIRequest(prompt, 'normal')
  }

  const handleDebugAnalyze = (code: string) => {
    const context = studentContext || {}
    const contextInfo = context.strugglingTopics?.length > 0 
      ? `\n\n**Student's Common Mistakes:** ${context.strugglingTopics.slice(0, 3).join(", ")}`
      : ""
    
    const prompt = `Help me debug this C++ code. Analyze for errors, suggest fixes, and explain what went wrong:\n\n\`\`\`cpp\n${code}\n\`\`\`${contextInfo}`
    setInputValue(prompt)
    setCodeInput(code)
    setShowCodeInput(true)
    inputRef.current?.focus()
    setTimeout(() => {
      handleSendMessage()
    }, 100)
  }

  const handleDebugTrace = (code: string) => {
    const prompt = `Show me a detailed execution trace for this C++ code, step by step with variable values at each step:\n\n\`\`\`cpp\n${code}\n\`\`\``
    setInputValue(prompt)
    setCodeInput(code)
    setShowCodeInput(true)
    inputRef.current?.focus()
    setTimeout(() => {
      handleSendMessage()
    }, 100)
  }

  const handleDocGenerate = (code: string, options: {
    includeComments: boolean
    includeReadme: boolean
    includeUml: boolean
  }) => {
    let prompt = `Generate comprehensive documentation for this C++ code`
    if (options.includeComments) prompt += ` with inline comments`
    if (options.includeReadme) prompt += `, a README.md file`
    if (options.includeUml) prompt += `, and a UML diagram`
    prompt += `:\n\n\`\`\`cpp\n${code}\n\`\`\``
    
    setInputValue(prompt)
    setCodeInput(code)
    setShowCodeInput(true)
    inputRef.current?.focus()
    setTimeout(() => {
      handleSendMessage()
    }, 100)
  }

  const handleMoreToolSelect = (tool: string, options?: any) => {
    const context = studentContext || {}
    const contextInfo = context.strugglingTopics?.length > 0 
      ? `\n\n**Student's Struggling Topics:** ${context.strugglingTopics.slice(0, 5).join(", ")}`
      : ""
    
    let prompt = ""
    
    switch (tool) {
      case "alternative-solutions":
        prompt = `Show me alternative solutions to this problem. Present different approaches and explain the trade-offs.${contextInfo}`
        break
      case "complexity-analysis":
        prompt = `Analyze the time and space complexity of this code:\n\n\`\`\`cpp\n${options?.code || ""}\n\`\`\`${contextInfo}`
        if (options?.code) {
          setCodeInput(options.code)
          setShowCodeInput(true)
        }
        break
      case "refactor-mode":
        prompt = `Refactor this code to improve readability, maintainability, and best practices:\n\n\`\`\`cpp\n${codeInput || ""}\n\`\`\`${contextInfo}`
        break
      case "exam-prep-mode":
        prompt = `Generate exam-style practice questions${context.strugglingTopics?.length > 0 ? ` focusing on: ${context.strugglingTopics.slice(0, 3).join(", ")}` : ""}.${contextInfo}`
        break
      case "teaching-personality":
        prompt = `Change teaching style. I want a different explanation approach.${contextInfo}`
        break
      case "explain-thinking":
        prompt = `Review my problem-solving approach and explain my thinking process:\n\n\`\`\`cpp\n${options?.code || ""}\n\`\`\`\n\nWhat did I do well? What could be improved?${contextInfo}`
        if (options?.code) {
          setCodeInput(options.code)
          setShowCodeInput(true)
        }
        break
      case "code-translator":
        prompt = `Translate this C++ code to ${options?.targetLanguage || "Python"}:\n\n\`\`\`cpp\n${options?.code || ""}\n\`\`\`\n\nExplain the key differences between C++ and ${options?.targetLanguage || "Python"} implementations.${contextInfo}`
        if (options?.code) {
          setCodeInput(options.code)
          setShowCodeInput(true)
        }
        break
      default:
        prompt = `Help me with ${tool}.${contextInfo}`
    }
    
    setInputValue(prompt)
    inputRef.current?.focus()
    setTimeout(() => {
      handleSendMessage()
    }, 100)
  }

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom()
    }
  }, [messages])

  useEffect(() => {
    if (!workspaceMode || !onWorkspaceSessionChange) return
    const archived = archivedCoraConversations(savedConversations).map((conv) => ({
      id: conv.id,
      title: conv.title,
      messageCount: conv.messages.length,
      lastUpdated: conv.lastUpdated,
      preview:
        conv.messages.find((m) => m.role === "student")?.content.slice(0, 160) || conv.title,
      archivedAt: conv.archivedAt ?? null,
      capabilityId: conv.capabilityId,
    }))
    onWorkspaceSessionChange({
      ...buildWorkspaceSessionSnapshot(
        messages,
        activeCoraConversations(savedConversations).map((conv) => ({
          id: conv.id,
          title: conv.title,
          messageCount: conv.messages.length,
          lastUpdated: conv.lastUpdated,
          preview:
            conv.messages.find((m) => m.role === "student")?.content.slice(0, 160) ||
            conv.title,
          isCurrent: conv.id === currentConversationId,
          capabilityId: conv.capabilityId,
        })),
      ),
      archivedConversations: archived,
    })
  }, [messages, savedConversations, currentConversationId, workspaceMode, onWorkspaceSessionChange])

  const shouldAutoScrollRef = useRef(true)

  const handleChatScroll = () => {
    const el = chatScrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < 96
  }

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const scrollEl = chatScrollRef.current
    if (scrollEl) {
      scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior })
      return
    }
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // Premium Feature Helper Functions
  
  // 1. Analyze student message for weakness detection
  const analyzeStudentMessage = (message: string): {
    confusionScore: number
    reasoningQuality: number
    flags: string[]
    suggestions: string[]
  } => {
    const lowerMessage = message.toLowerCase()
    const uncertaintyMarkers = [
      "i don't know", "don't know", "no idea", "not sure", "maybe", 
      "confused", "unclear", "don't understand", "not clear"
    ]
    
    let confusionScore = 0
    const flags: string[] = []
    const suggestions: string[] = []
    
    // Check for uncertainty markers
    uncertaintyMarkers.forEach(marker => {
      if (lowerMessage.includes(marker)) {
        confusionScore += 2
        flags.push("uncertainty")
      }
    })
    
    // Check for question patterns
    if (lowerMessage.includes("?") && lowerMessage.split("?").length > 2) {
      confusionScore += 1
      flags.push("multiple_questions")
    }
    
    // Check for reasoning patterns
    const reasoningKeywords = ["because", "since", "therefore", "so", "if", "then"]
    const hasReasoning = reasoningKeywords.some(keyword => lowerMessage.includes(keyword))
    const reasoningQuality = hasReasoning ? 7 : 3
    
    // Generate suggestions based on confusion
    if (confusionScore >= 4) {
      suggestions.push("micro_lesson")
      suggestions.push("simplify_explanation")
    } else if (confusionScore >= 2) {
      suggestions.push("follow_up_question")
    }
    
    return {
      confusionScore: Math.min(confusionScore, 10),
      reasoningQuality,
      flags,
      suggestions
    }
  }
  
  // Response pipeline (learning goal handled server-side)
  const applyTutorConfig = (response: string, _config: ChatConfig): string => response
  
  // 3. Update session memory
  const updateSessionMemory = (analysis: ReturnType<typeof analyzeStudentMessage>, message: string) => {
    setSessionMemory(prev => {
      const newMemory = { ...prev }
      
      if (analysis.confusionScore >= 4) {
        newMemory.misunderstandings.push(message.substring(0, 100))
      }
      
      if (analysis.reasoningQuality >= 7) {
        newMemory.strengths.push("Good reasoning")
      }
      
      newMemory.confusionScore = (prev.confusionScore + analysis.confusionScore) / 2
      newMemory.reasoningQuality = (prev.reasoningQuality + analysis.reasoningQuality) / 2
      
      return newMemory
    })
  }
  
  // 4. Handle special commands
  const handleCommand = async (command: string, args: string) => {
    switch (command) {
      case "/compare_solutions":
        await sendAIRequest(`Compare these two solutions and explain the differences:\n\n${args}`, 'normal')
        break
      case "/optimize":
        await sendAIRequest(`Optimize this code and explain the improvements:\n\n${args}`, 'normal')
        break
      case "/explain_complexity":
        await sendAIRequest(`Analyze the time and space complexity of this code:\n\n${args}`, 'normal')
        break
      case "/rewrite_beginner":
        await sendAIRequest(`Rewrite this code in a beginner-friendly way:\n\n${args}`, 'normal')
        break
      case "/rewrite_advanced":
        await sendAIRequest(`Rewrite this code using advanced C++ features:\n\n${args}`, 'normal')
        break
      case "/generate_docs":
        await sendAIRequest(`Generate documentation (README, function docs, UML diagram) for:\n\n${args}`, 'normal')
        break
      case "/show_common_mistakes":
        await sendAIRequest(`Show common mistakes related to:\n\n${args}`, 'normal')
        break
      default:
        toast({
          title: "Unknown Command",
          description: `Available commands: /compare_solutions, /optimize, /explain_complexity, /rewrite_beginner, /rewrite_advanced, /generate_docs, /show_common_mistakes`,
          variant: "destructive"
        })
    }
  }

  const runWorkspaceAction = async (intent: CoraWorkspaceActionIntent, displayText: string) => {
    const exportMessages = messages
      .filter((m) => m.id !== "typing" && m.id !== "welcome")
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      }))

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "student",
      content: displayText,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev.filter((m) => m.id !== "typing"), userMessage])

    if (intent.type === "list_capabilities") {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: formatCapabilitiesHelpText(),
        timestamp: new Date(),
        topic: "Cora action",
      }
      setMessages((prev) => [...prev, aiMessage])
      return
    }

    if (intent.type === "navigate") {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: `Opening **${intent.label}**…\n\n[Go to ${intent.label}](${intent.href})`,
        timestamp: new Date(),
        topic: "Cora action",
      }
      setMessages((prev) => [...prev, aiMessage])
      if (onAppNavigate) onAppNavigate(intent.href)
      else router.push(intent.href)
      return
    }

    if (intent.type === "open_cora_tab") {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: `Switching to **${intent.label}** in Cora.`,
        timestamp: new Date(),
        topic: "Cora action",
      }
      setMessages((prev) => [...prev, aiMessage])
      onCoraNavigate?.(intent.tab, intent.toolId)
      return
    }

    if (
      intent.type === "export_note" ||
      intent.type === "create_flashcards" ||
      intent.type === "create_note" ||
      intent.type === "create_practice_quiz"
    ) {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: buildReadOnlyRefusal("content_write"),
        timestamp: new Date(),
        topic: "Cora action",
      }
      setMessages((prev) => [...prev, aiMessage])
      return
    }

    setIsLoading(true)

    try {
      const payload =
        intent.type === "export_note"
          ? { action: "export_note" as const, messages: exportMessages, title: intent.title }
          : intent.type === "create_flashcards"
            ? { action: "create_flashcards" as const, topic: intent.topic, messages: exportMessages }
            : intent.type === "create_note"
              ? {
                  action: "create_note" as const,
                  topic: intent.topic,
                  title: intent.title,
                  messages: exportMessages,
                }
              : intent.type === "search_platform"
                ? { action: "search_platform" as const, query: intent.query }
                : {
                    action: "create_practice_quiz" as const,
                    topic: intent.topic,
                    count: intent.count,
                    difficulty: intent.difficulty,
                  }

      const res = await fetch("/api/cora/workspace-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, confirmed: true }),
      })
      const data = await parseApiJson(res)
      if (!res.ok) {
        throw new Error(String(data.error ?? "Action failed"))
      }

      if (intent.type === "create_practice_quiz" && data.attemptId && Array.isArray(data.questions)) {
        sessionStorage.setItem("practiceAttemptId", String(data.attemptId))
        sessionStorage.setItem("practiceQuestions", JSON.stringify(data.questions))
      }

      const href = String(data.href ?? "")
      const linkLine = href ? `\n\n[Open in CourseCollab](${href})` : ""

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: `${intent.type === "search_platform" ? "" : "✅ "}${String(data.message ?? "Done.")}${linkLine}`,
        timestamp: new Date(),
        topic: "Cora action",
      }
      setMessages((prev) => [...prev, aiMessage])

      if (intent.type === "create_practice_quiz" && href) {
        toast({
          title: "Practice quiz ready",
          description: `${data.questionCount ?? ""} questions on ${data.topic ?? intent.topic}`,
        })
        if (onAppNavigate) onAppNavigate(href)
        else router.push(href)
      } else if (intent.type !== "search_platform") {
        toast({
          title: "Cora",
          description: String(data.message ?? "Done.").replace(/\*\*/g, ""),
        })
      }
    } catch (error) {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: `I couldn't complete that action: ${error instanceof Error ? error.message : "Unknown error"}. Try \`/help\` for commands, or rephrase (e.g. "search for homework", "create a quiz on AC analysis", "go to grades").`,
        timestamp: new Date(),
        topic: "Cora action",
      }
      setMessages((prev) => [...prev, aiMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async (overrideContent?: string, contextOverride?: typeof studentContext) => {
    const raw = overrideContent?.trim() || inputValue.trim()
    const attachmentsForSend = pendingAttachments
    const problemForSend = importedProblem
    if (!raw && !codeInput.trim() && attachmentsForSend.length === 0 && !problemForSend) return

    if (credits && !credits.isUnlimited && credits.credits <= 0) {
      toast({
        title: "Cora Credits exhausted",
        description: "Cora Lite still works for simple lookups. Buy a pack or wait for your monthly refresh.",
        variant: "destructive",
      })
      return
    }

    let confirmExpensiveTask = false
    let pendingAttachmentsOverride: typeof attachmentsForSend | null = null
    let pendingProblemOverride: typeof problemForSend | null = null
    let baseMessage = raw
    if (/^(continue|confirm|yes,? continue)$/i.test(raw.trim())) {
      try {
        const pending = sessionStorage.getItem("coraPendingExpensiveTask")
        if (pending) {
          const parsed = JSON.parse(pending) as {
            message?: string
            attachments?: typeof attachmentsForSend
            problemContext?: typeof problemForSend
          }
          if (parsed.message) {
            baseMessage = parsed.message
            confirmExpensiveTask = true
            if (parsed.attachments) pendingAttachmentsOverride = parsed.attachments
            if (parsed.problemContext) pendingProblemOverride = parsed.problemContext
            sessionStorage.removeItem("coraPendingExpensiveTask")
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (isThreadAtExchangeLimit(messages, resolvedMembershipTier)) {
      toast({
        title: "Exchange limit reached",
        description: `This chat hit the ${getMaxExchangesForTier(resolvedMembershipTier)}-exchange limit for your plan. Start a new chat to continue.`,
        variant: "destructive",
      })
      return
    }

    const forbiddenWrite = detectForbiddenWriteIntent(raw)
    if (forbiddenWrite) {
      const refusal = buildReadOnlyRefusal(forbiddenWrite)
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "welcome"),
        {
          id: Date.now().toString(),
          role: "student" as const,
          content: raw,
          timestamp: new Date(),
        },
        {
          id: (Date.now() + 1).toString(),
          role: "ai" as const,
          content: refusal,
          timestamp: new Date(),
        },
      ])
      setInputValue("")
      return
    }

    shouldAutoScrollRef.current = true

    if (workspaceMode && raw && !raw.startsWith("/")) {
      const intent = detectWorkspaceAction(raw)
      if (intent) {
        setInputValue("")
        setCodeInput("")
        setShowCodeInput(false)
        setPendingAttachments([])
        await runWorkspaceAction(intent, raw)
        return
      }
    }

    let messageContent = baseMessage + buildAttachmentContext(pendingAttachmentsOverride ?? attachmentsForSend)
    
    // Check for commands
    if (messageContent.startsWith("/")) {
      const [command, ...args] = messageContent.split(" ")
      const argsText = args.join(" ")
      if (workspaceMode) {
        const slashIntent = detectWorkspaceAction(`${command}${argsText ? ` ${argsText}` : ""}`)
        if (slashIntent) {
          setInputValue("")
          setCodeInput("")
          setShowCodeInput(false)
          await runWorkspaceAction(slashIntent, messageContent.trim())
          return
        }
      }
      await handleCommand(command, argsText)
      setInputValue("")
      setCodeInput("")
      setShowCodeInput(false)
      return
    }
    
    if (codeInput.trim()) {
      messageContent += `\n\n\`\`\`cpp\n${codeInput.trim()}\n\`\`\``
    }

    if (!messageContent.trim() && problemForSend) {
      messageContent = `Help me work through this question${problemForSend.title ? `: ${problemForSend.title}` : ""}.`
    }

    // Analyze student message for weakness detection
    const analysis = analyzeStudentMessage(messageContent)
    updateSessionMemory(analysis, messageContent)

    const editingId = editingMessageIdRef.current
    if (editingId) {
      editingMessageIdRef.current = null
      let updatedUser: Message | null = null
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === editingId && m.role === "student")
        if (idx < 0) return prev
        const prior = prev[idx]!
        updatedUser = appendUserMessageVersion(prior, {
          content: messageContent,
          importedQuestion: problemForSend ?? prior.importedQuestion,
          importedQuestionLabel:
            importedMeta?.label ??
            problemForSend?.title ??
            prior.importedQuestionLabel,
        })
        return prev.slice(0, idx).concat(updatedUser!)
      })
      setInputValue("")
      setCodeInput("")
      setShowCodeInput(false)
      setPendingAttachments([])
      setImportedProblem(null)
      setImportedMeta(null)
      window.setTimeout(() => {
        if (updatedUser) void requestAssistantForTrailingUser(updatedUser)
      }, 0)
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "student",
      content: messageContent,
      timestamp: new Date(),
      ...(problemForSend
        ? {
            importedQuestion: problemForSend,
            importedQuestionLabel: importedMeta?.label ?? problemForSend.title ?? undefined,
          }
        : {}),
    }

    setMessages(prev => [...prev.filter(m => m.id !== "welcome"), userMessage])
    setInputValue("")
    setCodeInput("")
    setShowCodeInput(false)
    setPendingAttachments([])
    setImportedProblem(null)
    setImportedMeta(null)
    setIsLoading(true)

    const activeFlow = chatConfig.flow

    // Add typing indicator
    const typingMessage: Message = {
      id: "typing",
      role: "ai",
      content: "...",
      timestamp: new Date()
    }
    setMessages(prev => [...prev, typingMessage])

    try {
      // Send conversation history for context
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const response = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageContent || "Please review my attached files.",
          studentId: studentId || sessionStorage.getItem("studentDatabaseId"),
          context: { topic: "auto-detect" },
          conversationHistory,
          threadId: activeConversationIdRef.current ?? currentConversationId ?? null,
          chatConfig,
          sessionMemory,
          analysis,
          studentContext: contextOverride ?? studentContext ?? preparedStudentContext,
          learningMemory: externalLearningMemory,
          tutorPreferences: externalTutorPreferences,
          attachments: imageAttachmentsForApi(pendingAttachmentsOverride ?? attachmentsForSend),
          problemContext: pendingProblemOverride ?? problemForSend,
          useAgent: true,
          confirmExpensiveTask,
          confirmScopeRelated: Boolean(scopeRetryRef.current?.confirm || scopeRetry?.confirm),
          declaredAcademicContext:
            scopeRetryRef.current?.context ?? scopeRetry?.context ?? null,
        }),
      })

      scopeRetryRef.current = null
      if (scopeRetry) setScopeRetry(null)

      if (response.ok) {
        const data = await parseApiJson(response)
        
        const aiContent = String(data.response ?? "")
        const proposals = Array.isArray(data.proposals)
          ? (data.proposals as CoraActionProposal[])
          : undefined
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: aiContent,
          timestamp: new Date(),
          topic: data.detectedTopic as string | undefined,
          proposals,
          scopeFeedback:
            data.scopeRedirect && data.offerScopeFeedback
              ? {
                  eventId: data.scopeEventId != null ? Number(data.scopeEventId) : null,
                  originalMessage: messageContent,
                }
              : null,
        }

        setMessages((prev) => {
          const withoutTyping = prev.filter((msg) => msg.id !== "typing")
          const lastUserIdx = [...withoutTyping].map((m) => m.role).lastIndexOf("student")
          if (lastUserIdx >= 0) {
            const next = [...withoutTyping]
            next[lastUserIdx] = saveAssistantOnActiveVersion(next[lastUserIdx]!, aiContent)
            return [...next, aiMessage]
          }
          return [...withoutTyping, aiMessage]
        })

        if (activeFlow === "study_plan") {
          setChatConfig((prev) => ({ ...prev, flow: undefined }))
          void loadStudentContext()
        }
      } else {
        let errorData: Record<string, unknown> = {}
        try {
          errorData = await parseApiJson(response)
        } catch (parseError) {
          throw parseError
        }
        
        // Large task confirmation — show estimate and offer one-click continue
        if (errorData.needsConfirmation || response.status === 409) {
          const low = errorData.estimateLow
          const high = errorData.estimateHigh
          const bal = errorData.creditsRemaining
          const confirmMsg = String(
            errorData.response ||
              `Large Cora task — estimated ${low}–${high} credits (you have ${bal}). Reply **continue** or tap Continue.`,
          )
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: "ai",
            content: `${confirmMsg}\n\n_Send **continue** to confirm this large task._`,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev.filter((msg) => msg.id !== "typing"), errorMessage])
          // Stash last prompt for a confirmed retry
          try {
            sessionStorage.setItem(
              "coraPendingExpensiveTask",
              JSON.stringify({
                message: messageContent || "Please review my attached files.",
                attachments: imageAttachmentsForApi(attachmentsForSend),
                problemContext: problemForSend,
              }),
            )
          } catch {
            /* ignore */
          }
          return
        }

        // If access denied, refresh membership data (in case user just upgraded/donated)
        if (errorData.accessDenied || response.status === 403) {
          const studentDbId = studentId || sessionStorage.getItem("studentDatabaseId")
          if (studentDbId) {
            // Refresh membership data in background
            studentApiFetch(`/api/student/membership/refresh?studentId=${studentDbId}`)
              .then(res => res.json())
              .then(data => {
                if (data.tier) {
                  sessionStorage.setItem("studentMembershipTier", data.tier)
                  localStorage.setItem("studentMembershipTier", data.tier)
                }
                // If they now have donation access, show a message encouraging them to try again
                if (data.hasDonationAccess && errorData.accessDenied) {
                  toast({
                    title: "Access Granted!",
                    description: "Your membership has been updated. Please try sending your message again.",
                  })
                }
              })
              .catch(err => console.error("Failed to refresh membership:", err))
          }
        }
        
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: String(errorData.response || "Sorry, I encountered an error. Please try again."),
          timestamp: new Date()
        }
        setMessages(prev => [...prev.filter(msg => msg.id !== "typing"), errorMessage])
      }
    } catch (error) {
      console.error("Failed to send message:", error)
      setMessages(prev => prev.filter(msg => msg.id !== "typing"))
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: error instanceof Error && error.message.includes("temporarily unavailable")
          ? `❌ **Service unavailable**\n\n${error.message}`
          : "❌ **Connection Error**\n\nI'm having trouble connecting right now. Please refresh the page and try again.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const copyMessage = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content)
    setCopiedMessageId(messageId)
    setTimeout(() => setCopiedMessageId(null), 2000)
    toast({
      title: "Copied!",
      description: "Message copied to clipboard"
    })
  }

  const toggleBookmark = (messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, isBookmarked: !msg.isBookmarked } : msg
    ))
    toast({
      title: "Pinned",
      description: workspaceMode
        ? "Added to session artifacts"
        : "Message saved for quick reference",
    })
  }

  const upsertCurrentConversation = useCallback(
    (savable: Message[], previous: SavedConversation[]): SavedConversation[] => {
      let id = activeConversationIdRef.current
      if (!id) {
        id = `cora-${Date.now()}`
        activeConversationIdRef.current = id
        setCurrentConversationId(id)
      }

      const existing = previous.find((conversation) => conversation.id === id)
      const conversation: SavedConversation = {
        id,
        title: conversationTitle(savable),
        messages: savable,
        createdAt: existing?.createdAt ?? new Date(),
        lastUpdated: new Date(),
        archivedAt: existing?.archivedAt,
        capabilityId: activeCapabilityIdRef.current ?? existing?.capabilityId,
      }

      return [conversation, ...previous.filter((candidate) => candidate.id !== id)]
    },
    [],
  )

  const saveConversation = () => {
    const savable = messages.filter((msg) => msg.id !== "typing" && msg.id !== "welcome")
    if (savable.length === 0) return

    const updated = upsertCurrentConversation(savable, savedConversationsRef.current)
    commitSavedConversations(updated)

    toast({
      title: "Conversation Saved",
      description: "You can access this conversation anytime",
    })
  }

  useEffect(() => {
    if (!workspaceMode) return
    const savable = messages.filter((msg) => msg.id !== "typing" && msg.id !== "welcome")
    if (savable.length === 0) return

    const timeout = window.setTimeout(() => {
      const base = readMergedStoredConversations()
      const updated = upsertCurrentConversation(savable, base)
      commitSavedConversations(updated)
    }, 400)

    return () => window.clearTimeout(timeout)
  }, [messages, workspaceMode, upsertCurrentConversation, commitSavedConversations, readMergedStoredConversations])

  const flushCurrentConversationToStorage = useCallback((): SavedConversation[] => {
    const savable = messages.filter((msg) => msg.id !== "typing" && msg.id !== "welcome")
    if (savable.length === 0) return readMergedStoredConversations()

    const updated = upsertCurrentConversation(savable, readMergedStoredConversations())
    return commitSavedConversations(updated)
  }, [messages, upsertCurrentConversation, commitSavedConversations, readMergedStoredConversations])

  const loadConversation = useCallback(
    (conversationId: string) => {
      if (conversationId === activeConversationIdRef.current) return

      const list = flushCurrentConversationToStorage()
      const conversation = list.find((c) => c.id === conversationId)
      if (!conversation) return

      setMessages(
        conversation.messages.map((msg) => ({
          ...msg,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
        })),
      )
      setCurrentConversationId(conversationId)
      activeConversationIdRef.current = conversationId
      activeCapabilityIdRef.current = conversation.capabilityId
      setInputValue("")
      setPendingAttachments([])
      setImportedProblem(null)
      setImportedMeta(null)
      shouldAutoScrollRef.current = true
      toast({
        title: "Conversation loaded",
        description: conversation.title,
      })
    },
    [flushCurrentConversationToStorage, toast],
  )

  const startNewConversation = useCallback(() => {
    flushCurrentConversationToStorage()

    const newId = `cora-${Date.now()}`
    activeConversationIdRef.current = newId
    setCurrentConversationId(newId)
    if (!bootstrap?.capabilityId) activeCapabilityIdRef.current = undefined

    setMessages([])
    setInputValue("")
    setCodeInput("")
    setPendingAttachments([])
    setImportedProblem(null)
    setImportedMeta(null)
    shouldAutoScrollRef.current = true

    toast({
      title: "New conversation",
      description:
        messages.some((m) => m.id !== "typing" && m.id !== "welcome")
          ? "Previous chat saved to history."
          : "Start typing when you're ready.",
    })
  }, [messages, flushCurrentConversationToStorage, toast, bootstrap?.capabilityId])

  const runStudyPlanAutomation = useCallback(
    async (threadMessages: Message[]) => {
      const exportMessages = threadMessages
        .filter((m) => m.id !== "typing" && m.id !== "welcome" && m.content.trim())
        .map((m) => ({
          role: m.role,
          content: m.content,
          id: m.id,
          timestamp: m.timestamp,
        }))

      if (exportMessages.length === 0) return

      setStudyPlanAutomationStatus("running")
      try {
        const res = await fetch("/api/cora/workspace-actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "automate_study_plan",
            messages: exportMessages,
            title: "My Study Plan",
            reminderMinutes: 30,
            confirmed: true,
          }),
        })
        const data = await parseApiJson(res)
        if (!res.ok) throw new Error(String(data.error ?? "Automation failed"))

        setStudyPlanAutomationStatus("done")
        const deckCount = Array.isArray(data.flashcardDecks) ? data.flashcardDecks.length : 0
        const quizCount = Array.isArray(data.practiceQuizzes) ? data.practiceQuizzes.length : 0
        toast({
          title: "Study plan scheduled",
          description: String(
            data.message ??
              `Saved with ${data.eventsCreated ?? 0} sessions, ${deckCount} flashcard deck(s), and ${quizCount} Practice Hub quiz(es).`,
          ),
        })
      } catch (error) {
        setStudyPlanAutomationStatus("error")
        toast({
          title: "Automation incomplete",
          description:
            error instanceof Error
              ? error.message
              : "Could not save calendar sessions. Try exporting to notes from the chat menu.",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  // Study plan + calendar assistant — always start a fresh Cora conversation
  useEffect(() => {
    const launchFlowChat = async (flow: CoraChatFlow, prompt: string) => {
      const ctx = await loadStudentContext()
      startNewConversation()
      setStudyPlanAutomationStatus("idle")
      setChatConfig({ learningGoal: "prepare", flow })
      onStudyPlanRequested?.()
      window.setTimeout(() => {
        void handleSendMessage(prompt, ctx ?? undefined)
      }, 80)
    }

    const handleStudyPlan = () => void launchFlowChat("study_plan", STUDY_PLAN_GENERATION_PROMPT)
    const handleCalendarAssistant = () => void launchFlowChat("calendar_assistant", CALENDAR_ASSISTANT_PROMPT)
    const handleWeeklyReview = () => void launchFlowChat("weekly_review", WEEKLY_REVIEW_PROMPT)
    const handleExamCountdown = () => void launchFlowChat("exam_countdown", EXAM_COUNTDOWN_PROMPT)

    window.addEventListener("generate-study-plan", handleStudyPlan as EventListener)
    window.addEventListener("open-calendar-assistant", handleCalendarAssistant as EventListener)
    window.addEventListener("cora-weekly-review", handleWeeklyReview as EventListener)
    window.addEventListener("cora-exam-countdown", handleExamCountdown as EventListener)
    return () => {
      window.removeEventListener("generate-study-plan", handleStudyPlan as EventListener)
      window.removeEventListener("open-calendar-assistant", handleCalendarAssistant as EventListener)
      window.removeEventListener("cora-weekly-review", handleWeeklyReview as EventListener)
      window.removeEventListener("cora-exam-countdown", handleExamCountdown as EventListener)
    }
  }, [onStudyPlanRequested, startNewConversation, loadStudentContext, handleSendMessage])

  const deleteConversation = (conversationId: string) => {
    const updated = savedConversationsRef.current.filter((c) => c.id !== conversationId)
    commitSavedConversations(updated)
    void deleteCoraWorkspaceConversationFromApi(conversationId).catch((error) => {
      console.warn("[Cora] Failed to delete conversation on server:", error)
    })

    if (currentConversationId === conversationId || activeConversationIdRef.current === conversationId) {
      setCurrentConversationId(null)
      activeConversationIdRef.current = null
      setMessages([])
    }

    toast({
      title: "Conversation Deleted",
      description: "The conversation has been removed",
    })
  }

  const archiveConversation = (conversationId: string) => {
    const updated = savedConversationsRef.current.map((c) =>
      c.id === conversationId ? { ...c, archivedAt: new Date(), lastUpdated: new Date() } : c,
    )
    commitSavedConversations(updated)
    if (currentConversationId === conversationId || activeConversationIdRef.current === conversationId) {
      startNewConversation()
    }
    toast({ title: "Archived", description: "Conversation moved to Archived." })
  }

  const restoreConversation = (conversationId: string) => {
    const updated = savedConversationsRef.current.map((c) =>
      c.id === conversationId ? { ...c, archivedAt: undefined, lastUpdated: new Date() } : c,
    )
    commitSavedConversations(updated)
    toast({ title: "Restored", description: "Conversation moved back to Chat history." })
  }

  const renameConversation = (conversationId: string, title: string) => {
    const nextTitle = title.trim()
    if (!nextTitle) return
    const updated = savedConversationsRef.current.map((c) =>
      c.id === conversationId ? { ...c, title: nextTitle, lastUpdated: new Date() } : c,
    )
    commitSavedConversations(updated)
    toast({ title: "Renamed", description: "Conversation title updated." })
  }

  const editUserMessage = (message: Message) => {
    if (isLoading || message.role !== "student") return
    const index = messages.findIndex((entry) => entry.id === message.id)
    if (index < 0) return

    let updatedUser = message
    const assistantAfter = messages[index + 1]
    if (assistantAfter?.role === "ai" && assistantAfter.content.trim()) {
      updatedUser = saveAssistantOnActiveVersion(message, assistantAfter.content)
    }

    editingMessageIdRef.current = message.id
    setMessages(messages.slice(0, index + 1).map((entry, i) => (i === index ? updatedUser : entry)))
    setInputValue(getActiveUserVersion(updatedUser).content)
    toast({ title: "Editing message", description: "Update your message and send to create a new version." })
  }

  const handleUserMessageMenuAction = (message: Message, action: CoraUserMessageMenuAction) => {
    if (action === "copy") {
      void copyMessage(message.content, message.id)
      return
    }
    if (action === "edit") {
      editUserMessage(message)
      return
    }
    if (action === "select-text") {
      const range = document.createRange()
      const selection = window.getSelection()
      const node = document.querySelector(`[data-cora-message-id="${message.id}"]`)
      if (node && selection) {
        range.selectNodeContents(node)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      return
    }
    if (action === "reattach-import") {
      setReattachTargetMessageId(message.id)
      setShowQuestionImport(true)
    }
  }

  const navigateUserMessageVersion = (messageId: string, direction: -1 | 1) => {
    setMessages((prev) => {
      const userIndex = prev.findIndex((m) => m.id === messageId && m.role === "student")
      if (userIndex < 0) return prev
      const user = prev[userIndex]!
      const versions = getUserMessageVersions(user)
      if (versions.length <= 1) return prev
      const nextIdx = getActiveUserVersionIndex(user) + direction
      if (nextIdx < 0 || nextIdx >= versions.length) return prev
      const updatedUser = applyUserMessageVersion(user, nextIdx)
      return rebuildThreadAfterVersionChange(prev, userIndex, updatedUser, (content, versionIndex) => ({
        id: `${user.id}-assistant-v${versionIndex}`,
        role: "ai" as const,
        content,
        timestamp: new Date(),
      }))
    })
  }

  const regenerateFromUserMessage = async (userMessage: Message) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === userMessage.id)
      if (idx < 0) return prev
      return prev.slice(0, idx + 1)
    })
    await requestAssistantForTrailingUser(userMessage)
  }

  const requestAssistantForTrailingUser = async (userMessage: Message) => {
    shouldAutoScrollRef.current = true
    setIsLoading(true)
    const typingMessage: Message = {
      id: "typing",
      role: "ai",
      content: "...",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev.filter((m) => m.id !== "typing"), typingMessage])

    try {
      const historyBase = messages
        .filter((m) => m.id !== "typing" && m.id !== "welcome")
      const userIdx = historyBase.findIndex((m) => m.id === userMessage.id)
      const conversationHistory = (userIdx >= 0 ? historyBase.slice(0, userIdx + 1) : [...historyBase, userMessage])
        .slice(-10)
        .map((msg) => ({ role: msg.role, content: msg.content }))

      const response = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content || "Please review my attached files.",
          studentId: studentId || sessionStorage.getItem("studentDatabaseId"),
          context: { topic: "auto-detect" },
          conversationHistory,
          threadId: activeConversationIdRef.current ?? currentConversationId ?? null,
          chatConfig,
          sessionMemory,
          studentContext: studentContext ?? preparedStudentContext,
          learningMemory: externalLearningMemory,
          tutorPreferences: externalTutorPreferences,
          problemContext: userMessage.importedQuestion,
          useAgent: true,
        }),
      })

      if (response.ok) {
        const data = await parseApiJson(response)
        const aiContent = String(data.response ?? "")
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: aiContent,
          timestamp: new Date(),
          topic: data.detectedTopic as string | undefined,
        }
        setMessages((prev) => {
          const withoutTyping = prev.filter((msg) => msg.id !== "typing")
          const lastUserIdx = [...withoutTyping].map((m) => m.role).lastIndexOf("student")
          if (lastUserIdx >= 0) {
            const next = [...withoutTyping]
            next[lastUserIdx] = saveAssistantOnActiveVersion(next[lastUserIdx]!, aiContent)
            return [...next, aiMessage]
          }
          return [...withoutTyping, aiMessage]
        })
      } else {
        const errorData = await parseApiJson(response).catch(() => ({}))
        setMessages((prev) => [
          ...prev.filter((msg) => msg.id !== "typing"),
          {
            id: (Date.now() + 1).toString(),
            role: "ai",
            content: String((errorData as { response?: string }).response || "Sorry, I encountered an error. Please try again."),
            timestamp: new Date(),
          },
        ])
      }
    } catch (error) {
      console.error("Failed to regenerate:", error)
      setMessages((prev) => prev.filter((msg) => msg.id !== "typing"))
    } finally {
      setIsLoading(false)
    }
  }

  const handleAssistantMenuAction = async (message: Message, action: CoraMessageMenuActionId) => {
    const lastAi = [...messages].reverse().find((m) => m.role === "ai" && m.id !== "typing" && m.id !== "welcome")
    const isLast = lastAi?.id === message.id

    switch (action) {
      case "copy":
        copyMessage(message.content, message.id)
        break
      case "regenerate": {
        if (!isLast) return
        const priorUser = [...messages].reverse().find((m) => m.role === "student")
        if (!priorUser) return
        const nextUser = appendUserMessageVersion(priorUser, {
          content: priorUser.content,
          importedQuestion: priorUser.importedQuestion,
          importedQuestionLabel: priorUser.importedQuestionLabel,
        })
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === priorUser.id)
          if (idx < 0) return prev
          return prev.slice(0, idx).concat(nextUser)
        })
        await requestAssistantForTrailingUser(nextUser)
        break
      }
      case "explain-simpler":
        await handleSendMessage("Explain that more simply, using clearer language and a shorter example.")
        break
      case "double-check":
        await handleSendMessage("Double-check your last answer for mistakes and correct anything that looks wrong.")
        break
      case "create-flashcards":
        await runWorkspaceAction(
          { type: "create_flashcards", topic: "this conversation" },
          "create flashcards from this conversation",
        )
        break
      case "save-note":
        await runWorkspaceAction({ type: "export_note" }, "save this chat to my notes")
        break
      case "branch-chat": {
        const branchMessages = messages.filter((m) => m.id !== "typing" && m.id !== "welcome")
        flushCurrentConversationToStorage()
        const newId = `cora-${Date.now()}`
        activeConversationIdRef.current = newId
        setCurrentConversationId(newId)
        setMessages(branchMessages)
        toast({ title: "Branched", description: "Opened a new chat from this thread." })
        break
      }
      case "report-concern":
        toast({
          title: "Thanks for the report",
          description: "We've noted your concern about this response.",
        })
        break
      default:
        break
    }
  }

  useEffect(() => {
    if (!bootstrap?.nonce || !workspaceMode) return
    if (bootstrap.capabilityId) activeCapabilityIdRef.current = bootstrap.capabilityId
    if (bootstrap.resumeConversationId) {
      loadConversation(bootstrap.resumeConversationId)
      return
    }
    if (bootstrap.prompt) {
      startNewConversation()
      window.setTimeout(() => {
        void handleSendMessage(bootstrap.prompt)
      }, 80)
    } else if (bootstrap.capabilityId) {
      startNewConversation()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per bootstrap nonce
  }, [bootstrap?.nonce])

  const newConversation = () => {
    if (workspaceMode) {
      startNewConversation()
      return
    }

    setMessages([])
    setCurrentConversationId(null)
    activeConversationIdRef.current = null
    const welcomeMessage: Message = {
      id: "welcome",
      role: "ai",
      content: "# Welcome back! 🤖\n\nHow can I help you today?",
      timestamp: new Date(),
    }
    setMessages([welcomeMessage])
  }

  useEffect(() => {
    if (!workspaceMode || !workspaceSessionRef) return
    workspaceSessionRef.current = {
      scrollToMessage: (messageId: string) => {
        shouldAutoScrollRef.current = false
        const scrollEl = chatScrollRef.current
        const target = scrollEl?.querySelector(`[data-cora-message-id="${messageId}"]`)
        if (target instanceof HTMLElement) {
          target.scrollIntoView({ behavior: "smooth", block: "center" })
          target.classList.add("ring-2", "ring-violet-400/60", "rounded-2xl")
          window.setTimeout(() => {
            target.classList.remove("ring-2", "ring-violet-400/60", "rounded-2xl")
          }, 1600)
        }
      },
      getExportMessages: () =>
        messages
          .filter((m) => m.id !== "typing" && m.id !== "welcome")
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
      loadSavedConversation: (conversationId: string) => {
        loadConversation(conversationId)
      },
      saveCurrentConversation: () => {
        saveConversation()
      },
      startNewConversation: () => {
        startNewConversation()
      },
      archiveConversation: (conversationId: string) => {
        archiveConversation(conversationId)
      },
      restoreConversation: (conversationId: string) => {
        restoreConversation(conversationId)
      },
      deleteConversation: (conversationId: string) => {
        deleteConversation(conversationId)
      },
      renameConversation: (conversationId: string, title: string) => {
        renameConversation(conversationId, title)
      },
    }
    return () => {
      workspaceSessionRef.current = null
    }
  }, [workspaceMode, workspaceSessionRef, messages, loadConversation, startNewConversation])

  const exportToPDF = async () => {
    const { default: jsPDF } = await import("jspdf")
    const doc = new jsPDF()
    let yPosition = 20
    
    doc.setFontSize(18)
    doc.text("AI Tutor Conversation", 20, yPosition)
    yPosition += 10
    
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPosition)
    yPosition += 15

    messages.forEach(msg => {
      if (msg.id === "typing") return
      
      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.text(msg.role === 'student' ? 'You:' : 'AI:', 20, yPosition)
      yPosition += 7
      
      doc.setFont(undefined, 'normal')
      doc.setFontSize(10)
      
      const lines = doc.splitTextToSize(msg.content, 170)
      lines.forEach((line: string) => {
        if (yPosition > 270) {
          doc.addPage()
          yPosition = 20
        }
        doc.text(line, 20, yPosition)
        yPosition += 5
      })
      
      yPosition += 5
    })

    doc.save('ai-tutor-chat.pdf')
    toast({
      title: "PDF Exported",
      description: "Conversation downloaded successfully"
    })
  }

  const filteredMessages = searchQuery
    ? messages.filter(msg => 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.topic?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages

  const isWorkspaceEmpty =
    workspaceMode &&
    messages.length <= 1 &&
    (messages.length === 0 || messages[0]?.id === "welcome")

  const visibleMessages = isWorkspaceEmpty
    ? []
    : workspaceMode
      ? filteredMessages.filter((m) => m.id !== "welcome")
      : filteredMessages

  const renderMessage = (msg: Message) => {
    const isThinking = msg.id === "typing"
    const isUser = msg.role === "student"

    if (workspaceMode) {
      if (isThinking) {
        return (
          <motion.div
            key={msg.id}
            data-cora-message-id={msg.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="mb-8"
          >
            <CoraThinkingIndicator active learningGoal={chatConfig.learningGoal} />
          </motion.div>
        )
      }

      const userFooter = isUser ? (
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {userMessageHasMultipleVersions(msg) ? (
            <div className="mr-1 flex items-center gap-0.5 text-[11px] text-neutral-500">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => navigateUserMessageVersion(msg.id, -1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span>
                {getActiveUserVersionIndex(msg) + 1}/{getUserMessageVersions(msg).length}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => navigateUserMessageVersion(msg.id, 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
          <CoraUserMessageMenu
            hasImportedQuestion={Boolean(msg.importedQuestion)}
            onAction={(action) => handleUserMessageMenuAction(msg, action)}
          />
        </div>
      ) : null

      const assistantFooter =
        !isUser && msg.id !== "welcome" ? (
          <div className="mt-1 flex items-center gap-1 opacity-50 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-white/[0.06]"
              title="Good response"
            >
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-white/[0.06]"
              title="Bad response"
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyMessage(msg.content, msg.id)}
              className="h-8 w-8 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-white/[0.06]"
              title="Copy"
            >
              {copiedMessageId === msg.id ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleBookmark(msg.id)}
              className="h-8 w-8 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-white/[0.06]"
              title="Pin to session artifacts"
            >
              {msg.isBookmarked ? (
                <BookmarkCheck className="h-4 w-4 text-amber-500" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => speakMessage(msg.content)}
              className="h-8 w-8 rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-white/[0.06]"
              title="Read aloud"
            >
              <Volume2 className="h-4 w-4" />
            </Button>
            <CoraAssistantMessageMenu
              isLastAssistant={
                [...messages].reverse().find((m) => m.role === "ai" && m.id !== "typing" && m.id !== "welcome")
                  ?.id === msg.id
              }
              onAction={(action) => void handleAssistantMenuAction(msg, action)}
            />
          </div>
        ) : null

      return (
        <motion.div
          key={msg.id}
          data-cora-message-id={msg.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {isUser && msg.importedQuestion ? (
            <div className="mb-2 ml-auto max-w-[min(92%,560px)]">
              <CoraImportedQuestionPreview
                label={msg.importedQuestionLabel}
                problem={msg.importedQuestion}
                compact
              />
            </div>
          ) : null}
          {isUser &&
          (!msg.content.trim() || /^Help me work through this question/i.test(msg.content.trim())) ? (
            <div className="group mb-8 flex justify-end">
              <div className="opacity-100">{userFooter}</div>
            </div>
          ) : (
            <CoraChatBubble
              role={isUser ? "student" : "ai"}
              footer={isUser ? userFooter : assistantFooter}
            >
              {isUser
                ? msg.content
                : renderMessageContent(msg.content, msg.role)}
            </CoraChatBubble>
          )}
          {!isUser && msg.proposals && msg.proposals.length > 0 ? (
            <div className="mb-6 space-y-2">
              {msg.proposals.map((proposal) => (
                <CoraActionCard
                  key={proposal.actionId}
                  proposal={proposal}
                  portal="student"
                />
              ))}
            </div>
          ) : null}
          {!isUser && msg.scopeFeedback ? (
            <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Was this actually related to your studies?</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => {
                  void (async () => {
                    const note =
                      typeof window !== "undefined"
                        ? window.prompt(
                            "Optional: briefly how this relates to your studies or academic work",
                          )
                        : null
                    const sid =
                      studentId ||
                      (typeof window !== "undefined"
                        ? sessionStorage.getItem("studentDatabaseId")
                        : null)
                    try {
                      await fetch("/api/cora/scope/feedback", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...(sid ? { "x-student-id": String(sid) } : {}),
                        },
                        body: JSON.stringify({
                          related: true,
                          eventId: msg.scopeFeedback?.eventId,
                          note: note || undefined,
                          role: "student",
                        }),
                      })
                    } catch {
                      /* ignore */
                    }
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === msg.id ? { ...m, scopeFeedback: null } : m,
                      ),
                    )
                    setScopeRetry({ confirm: true, context: note?.trim() || null })
                    scopeRetryRef.current = {
                      confirm: true,
                      context: note?.trim() || null,
                    }
                    await handleSendMessage(msg.scopeFeedback!.originalMessage)
                  })()
                }}
              >
                Yes
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => {
                  void (async () => {
                    const sid =
                      studentId ||
                      (typeof window !== "undefined"
                        ? sessionStorage.getItem("studentDatabaseId")
                        : null)
                    try {
                      await fetch("/api/cora/scope/feedback", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...(sid ? { "x-student-id": String(sid) } : {}),
                        },
                        body: JSON.stringify({
                          related: false,
                          eventId: msg.scopeFeedback?.eventId,
                          role: "student",
                        }),
                      })
                    } catch {
                      /* ignore */
                    }
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === msg.id ? { ...m, scopeFeedback: null } : m,
                      ),
                    )
                  })()
                }}
              >
                No
              </Button>
            </div>
          ) : null}
        </motion.div>
      )
    }

    return (
      <motion.div
        key={msg.id}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        layout
        className={`flex gap-3 ${msg.role === 'student' ? 'justify-end' : 'justify-start'} mb-5`}
      >
        {msg.role === 'ai' && (
          <div className="relative shrink-0">
            {isThinking && (
              <motion.span
                className="absolute inset-0 rounded-2xl bg-violet-500/30"
                animate={{ scale: [1, 1.35, 1], opacity: [0.45, 0, 0.45] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <div className={`relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/20 ${isThinking ? "ring-2 ring-violet-400/40" : ""}`}>
              <Bot className="h-5 w-5 text-white" />
            </div>
          </div>
        )}
        
        <div className={`max-w-[min(78%,640px)] ${msg.role === 'student' ? 'order-first' : ''}`}>
          <Card className={`overflow-hidden p-4 shadow-sm ${
            msg.role === 'student'
              ? 'rounded-2xl rounded-br-md border-0 bg-gradient-to-br from-[#582c83] to-[#6b3d96] text-white'
              : isThinking
                ? 'rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--muted)]/20 text-[var(--cc-text)]'
                : msg.id === 'welcome'
                  ? 'rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--background)] text-[var(--cc-text)]'
                  : 'rounded-2xl rounded-bl-md border-0 bg-transparent text-[var(--cc-text)]'
          }`}>
            {isThinking ? (
              <CoraThinkingIndicator active learningGoal={chatConfig.learningGoal} />
            ) : (
              <div className="space-y-3">
                {/* Render premium message types */}
                {msg.messageType === 'lessonBlock' && msg.lessonBlock && (
                  <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Micro-Lesson
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <strong>Definition:</strong> {msg.lessonBlock.definition}
                      </div>
                      <div>
                        <strong>Why it matters:</strong> {msg.lessonBlock.whyItMatters}
                      </div>
                      <div>
                        <strong>Example:</strong>
                        <pre className="mt-1 p-2 bg-slate-100 dark:bg-slate-900 rounded text-xs">{msg.lessonBlock.example}</pre>
                      </div>
                      <div>
                        <strong>Visual:</strong> {msg.lessonBlock.visualExplanation}
                      </div>
                      <div>
                        <strong>Quiz:</strong> {msg.lessonBlock.quizQuestion}
                      </div>
                      <div>
                        <strong>Next Step:</strong> {msg.lessonBlock.nextStep}
                      </div>
                    </div>
                  </div>
                )}
                
                {msg.messageType === 'visualizer' && msg.visualizerData && (
                  <div className="space-y-2 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Visual Execution Trace
                    </h4>
                    <div className="space-y-2 text-sm font-mono">
                      {msg.visualizerData.steps.map((step, idx) => (
                        <div key={idx} className="p-2 bg-white dark:bg-slate-800 rounded border">
                          <div className="font-bold">Step {step.step}:</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">{step.state}</div>
                          <div className="mt-1">{step.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {msg.messageType === 'rubricFeedback' && msg.rubricFeedback && (
                  <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Reasoning Evaluation
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div>Logical Consistency: {msg.rubricFeedback.logicalConsistency}/10</div>
                      <div>Completeness: {msg.rubricFeedback.completeness}/10</div>
                      <div>Correctness: {msg.rubricFeedback.correctness}/10</div>
                      {msg.rubricFeedback.misconceptions.length > 0 && (
                        <div>
                          <strong>Misconceptions:</strong>
                          <ul className="list-disc ml-4">
                            {msg.rubricFeedback.misconceptions.map((m, idx) => (
                              <li key={idx}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {msg.messageType === 'debugTrace' && msg.debugTrace && (
                  <div className="space-y-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <h4 className="font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
                      <Bug className="w-4 h-4" />
                      Debug Trace
                    </h4>
                    <div className="space-y-3 text-sm">
                      {msg.debugTrace.map((trace, idx) => (
                        <div key={idx} className="p-2 bg-white dark:bg-slate-800 rounded border">
                          <div className="font-bold">Line {trace.lineNumber}:</div>
                          <div className="text-red-600 dark:text-red-400">Issue: {trace.issue}</div>
                          <div className="text-green-600 dark:text-green-400">Fix: {trace.fix}</div>
                          {trace.memoryMap && (
                            <div className="mt-2 text-xs font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded">
                              {trace.memoryMap}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {msg.messageType === 'mistakeSimulation' && msg.mistakeSimulation && (
                  <div className="space-y-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <h4 className="font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Common Mistake Analysis
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div>
                        <strong>Wrong Implementation:</strong>
                        <pre className="mt-1 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs">{msg.mistakeSimulation.wrongCode}</pre>
                      </div>
                      <div>
                        <strong>Why it's wrong:</strong> {msg.mistakeSimulation.explanation}
                      </div>
                      <div>
                        <strong>Correct Version:</strong>
                        <pre className="mt-1 p-2 bg-green-100 dark:bg-green-900/30 rounded text-xs">{msg.mistakeSimulation.correctCode}</pre>
                      </div>
                      <div>
                        <strong>Takeaways:</strong>
                        <ul className="list-disc ml-4">
                          {msg.mistakeSimulation.takeaways.map((takeaway, idx) => (
                            <li key={idx}>{takeaway}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Weakness Insight */}
                {msg.weaknessInsight && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 mb-1">
                      <HelpCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-xs font-semibold text-yellow-900 dark:text-yellow-100">Weakness Detected</span>
                    </div>
                    <div className="text-sm text-yellow-800 dark:text-yellow-200">{msg.weaknessInsight}</div>
                  </div>
                )}
                
                {/* Render message with markdown and code highlighting */}
                {renderMessageContent(msg.content, msg.role)}
                
                {/* Message metadata */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200/20">
                  <span className="text-xs opacity-70">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                  {msg.topic && msg.topic !== "Welcome" && (
                    <Badge variant="outline" className="text-xs">
                      <Tag className="w-3 h-3 mr-1" />
                      {msg.topic}
                    </Badge>
                  )}
                  {msg.meta?.difficulty && (
                    <Badge variant="outline" className="text-xs">
                      {msg.meta.difficulty}
                    </Badge>
                  )}
                  {msg.isBookmarked && (
                    <BookmarkCheck className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
              </div>
            )}
          </Card>
          
          {/* Message actions */}
          {msg.id !== "typing" && msg.id !== "welcome" && (
            <div className="flex flex-wrap gap-1 mt-2 justify-end">
              {/* Basic actions */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyMessage(msg.content, msg.id)}
                className="h-7 px-2"
                title="Copy message"
              >
                {copiedMessageId === msg.id ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleBookmark(msg.id)}
                className="h-7 px-2"
                title="Bookmark message"
              >
                {msg.isBookmarked ? (
                  <BookmarkCheck className="w-3 h-3 text-yellow-500" />
                ) : (
                  <Bookmark className="w-3 h-3" />
                )}
              </Button>

              {/* Interactive Learning Actions (AI messages only) */}
              {msg.role === 'ai' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => speakMessage(msg.content)}
                    className="h-7 px-2"
                    title={isSpeaking ? "Stop speaking" : "Read aloud"}
                  >
                    {isSpeaking ? (
                      <Square className="w-3 h-3 text-blue-500" />
                    ) : (
                      <Volume2 className="w-3 h-3" />
                    )}
                  </Button>
                  
                  {msg.mode !== 'step-by-step' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => askForStepByStep(msg.content)}
                      className="h-7 px-2"
                      title="Break into steps"
                    >
                      <ListOrdered className="w-3 h-3 text-purple-500" />
                    </Button>
                  )}
                  
                  {msg.mode !== 'eli5' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => askForELI5(msg.content)}
                      className="h-7 px-2"
                      title="Simplify explanation"
                    >
                      <Baby className="w-3 h-3 text-pink-500" />
                    </Button>
                  )}
                  
                  {msg.topic && msg.topic !== 'General' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => generateQuiz(msg.topic!)}
                        className="h-7 px-2"
                        title="Generate quiz"
                      >
                        <Brain className="w-3 h-3 text-green-500" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => generateVisualExplanation(msg.topic!)}
                        className="h-7 px-2"
                        title="Visual diagram"
                      >
                        <BarChart3 className="w-3 h-3 text-cyan-500" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Show code playground if message contains code */}
          {msg.id !== "typing" && msg.content.includes('```cpp') && showPlayground === msg.id && (
            <div className="mt-4">
              <CodePlaygroundInline 
                initialCode={extractCodeFromMessage(msg.content)}
                language="cpp"
              />
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  const extractCodeFromMessage = (content: string): string => {
    const codeMatch = content.match(/```cpp\n([\s\S]*?)```/)
    return codeMatch ? codeMatch[1] : ''
  }

  const renderMessageContent = (content: string, role: string) => {
    if (role === "ai") {
      return (
        <FeedbackTextRenderer
          text={content}
          className="cora-ai-reply text-[15px] leading-[1.7] [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex-display]:text-left [&_li]:leading-relaxed"
        />
      )
    }

    const parts = content.split(/(```[\s\S]*?```)/g)
    
    return parts.map((part, index) => {
      // Check if this is a code block
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.split('\n')
        const language = lines[0].replace('```', '').trim() || 'cpp'
        const code = lines.slice(1, -1).join('\n')
        
        return (
          <div key={index} className="my-3 relative group">
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(code)
                  toast({ title: "Code copied!" })
                }}
                className="h-7 px-2 bg-slate-700/50 hover:bg-slate-700"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
              {language === 'cpp' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Add code playground inline
                    const messageId = `playground-${Date.now()}`
                    const playgroundMsg: Message = {
                      id: messageId,
                      role: "ai",
                      content: part,
                      timestamp: new Date(),
                      hasCodePlayground: true
                    }
                    // Find parent message and add playground
                    setShowPlayground(messageId)
                  }}
                  className="h-7 px-2 bg-green-700/50 hover:bg-green-700"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Run
                </Button>
              )}
            </div>
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              customStyle={{
                borderRadius: '0.5rem',
                padding: '1rem',
                fontSize: '0.875rem'
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        )
      }
      
      // Regular text with markdown support
      return (
        <div key={index} className="prose prose-sm max-w-none dark:prose-invert text-slate-900 dark:text-slate-100">
          {part.split('\n').map((line, i) => {
            // Bold text
            if (line.startsWith('# ')) {
              return <h1 key={i} className="text-xl font-bold mb-2">{line.substring(2)}</h1>
            }
            if (line.startsWith('## ')) {
              return <h2 key={i} className="text-lg font-semibold mb-2">{line.substring(3)}</h2>
            }
            if (line.startsWith('### ')) {
              return <h3 key={i} className="text-base font-semibold mb-1">{line.substring(4)}</h3>
            }
            if (line.startsWith('- ')) {
              return <li key={i} className="ml-4">{line.substring(2)}</li>
            }
            
            // Bold inline
            const boldPattern = /\*\*(.*?)\*\*/g
            const inlineCodePattern = /`([^`]+)`/g
            
            let formattedLine: any = line
            formattedLine = formattedLine.split(boldPattern).map((part: string, idx: number) => 
              idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
            )
            
            return <p key={i} className="mb-2 leading-relaxed">{formattedLine}</p>
          })}
        </div>
      )
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Interactive Learning Features

  const askForStepByStep = async (originalMessage: string) => {
    const stepByStepPrompt = `Break down this concept into simple, numbered steps:\n\n${originalMessage}`
    await sendAIRequest(stepByStepPrompt, 'step-by-step')
  }

  const askForELI5 = async (originalMessage: string) => {
    const eli5Prompt = `Explain this concept in the simplest possible way, as if explaining to a 5-year-old (but still technically accurate):\n\n${originalMessage}`
    await sendAIRequest(eli5Prompt, 'eli5')
  }

  const generateQuiz = async (topic: string) => {
    const quizPrompt = `Generate a 5-question multiple choice quiz about ${topic}. Format each question clearly with 4 options (A, B, C, D) and indicate the correct answer at the end.`
    await sendAIRequest(quizPrompt, 'normal')
    toast({
      title: "Quiz Generated!",
      description: "Practice questions created based on this topic"
    })
  }

  const generateChallenge = async () => {
    const challengePrompt = `Give me a fun, gamified coding challenge in C++. Make it engaging with a story/scenario, clear requirements, example input/output, and difficulty rating. Make it challenging but achievable for a beginner.`
    await sendAIRequest(challengePrompt, 'normal')
  }

  const generateVisualExplanation = async (topic: string) => {
    const visualPrompt = `Create a text-based visual diagram or ASCII art to explain ${topic}. Use arrows, boxes, and clear layout to show the concept visually. Then explain the diagram.`
    await sendAIRequest(visualPrompt, 'normal')
  }

  const sendAIRequest = async (prompt: string, mode: 'normal' | 'step-by-step' | 'eli5' = 'normal') => {
    setIsLoading(true)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "student",
      content: prompt,
      timestamp: new Date(),
      mode
    }

    setMessages(prev => [...prev, userMessage])

    const typingMessage: Message = {
      id: "typing",
      role: "ai",
      content: "...",
      timestamp: new Date()
    }
    setMessages(prev => [...prev, typingMessage])

    try {
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const response = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          studentId: studentId || sessionStorage.getItem("studentDatabaseId"),
          context: { topic: "auto-detect", mode },
          conversationHistory,
          threadId: activeConversationIdRef.current ?? currentConversationId ?? null,
          useAgent: true,
        }),
      })

      setMessages(prev => prev.filter(msg => msg.id !== "typing"))

      if (response.ok) {
        const data = await parseApiJson(response)
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: String(data.response ?? ""),
          timestamp: new Date(),
          topic: data.detectedTopic as string | undefined,
          mode
        }

        setMessages(prev => [...prev, aiMessage])
      } else {
        const errorData = await parseApiJson(response)
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: String(errorData.response || "Sorry, I encountered an error."),
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.id !== "typing"))
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: "❌ Connection error. Please try again.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Voice Features
  const toggleVoiceInput = () => {
    if (!isRecording) {
      startVoiceRecognition()
    } else {
      stopVoiceRecognition()
    }
  }

  const startVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: "Not Supported",
        description: "Voice input is not supported in this browser",
        variant: "destructive"
      })
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsRecording(true)
      toast({
        title: "Listening...",
        description: "Speak your question now"
      })
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInputValue(transcript)
      setIsRecording(false)
    }

    recognition.onerror = () => {
      setIsRecording(false)
      toast({
        title: "Error",
        description: "Voice recognition failed",
        variant: "destructive"
      })
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsRecording(false)
    }
  }

  const speakMessage = (text: string) => {
    if (!('speechSynthesis' in window)) {
      toast({
        title: "Not Supported",
        description: "Text-to-speech is not supported in this browser",
        variant: "destructive"
      })
      return
    }

    // Stop any ongoing speech
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    // Clean markdown from text
    const cleanText = text
      .replace(/```[\s\S]*?```/g, '[code block]')
      .replace(/[#*_`]/g, '')
      .replace(/\n+/g, ' ')

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    speechSynthesisRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-transparent", className)}>
      {/* Header */}
      {!hideHeader && (
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Programming Tutor</h3>
            <p className="text-xs text-purple-100">Always here to help</p>
          </div>
        </div>
        
        {/* Premium Features Config Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (onSettingsClick) {
              onSettingsClick()
            } else {
              setShowConfigPanel(!showConfigPanel)
            }
          }}
          className="text-white hover:bg-white/10"
          title="Tutor Settings"
        >
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 h-9 bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
            <Search className="w-4 h-4 absolute right-2 top-2.5 text-white/50" />
          </div>

          {/* Saved Conversations Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                <Clock className="w-4 h-4 mr-2" />
                History ({activeCoraConversations(savedConversations).length})
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              {savedConversations.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  No saved conversations yet
                </div>
              ) : (
                activeCoraConversations(savedConversations).map(conv => (
                  <DropdownMenuItem
                    key={conv.id}
                    className="flex items-center justify-between p-3 cursor-pointer"
                  >
                    <div className="flex-1 mr-2" onClick={() => loadConversation(conv.id)}>
                      <p className="font-medium text-sm truncate">{conv.title}</p>
                      <p className="text-xs text-slate-500">
                        {conv.messages.length} messages • {conv.lastUpdated.toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        archiveConversation(conv.id)
                      }}
                      className="h-7 w-7 p-0"
                      title="Archive"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export */}
          <Button
            variant="ghost"
            size="sm"
            onClick={exportToPDF}
            className="text-white hover:bg-white/10"
            disabled={messages.length <= 1}
          >
            <Download className="w-4 h-4" />
          </Button>

          {/* Save */}
          <Button
            variant="ghost"
            size="sm"
            onClick={saveConversation}
            className="text-white hover:bg-white/10"
            disabled={messages.length <= 1}
          >
            <Bookmark className="w-4 h-4" />
          </Button>

          {/* New Chat */}
          <Button
            variant="ghost"
            size="sm"
            onClick={newConversation}
            className="text-white hover:bg-white/10"
          >
            <Sparkles className="w-4 h-4" />
          </Button>
        </div>
        </div>
      )}

      {/* Premium Features Config Panel */}
      <AnimatePresence>
        {showConfigPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Learning goal</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfigPanel(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <p className="text-xs text-neutral-500 mb-3">How can I help you today? Cora adapts to your course automatically.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CORA_LEARNING_GOALS.map((goal) => (
                  <Button
                    key={goal.id}
                    variant={chatConfig.learningGoal === goal.id ? "default" : "outline"}
                    size="sm"
                    className="h-auto flex-col items-start gap-1 py-2.5 text-left"
                    onClick={() => setChatConfig({ learningGoal: goal.id })}
                  >
                    <span className="text-sm font-medium">{goal.emoji} {goal.label}</span>
                    <span className="text-xs font-normal opacity-80">{goal.tagline}</span>
                  </Button>
                ))}
              </div>
              
              {/* Quick Actions */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <Label className="text-xs font-medium mb-2 block">Quick Actions</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const prompt = "Generate a micro-lesson about the current topic"
                      setInputValue(prompt)
                      setShowConfigPanel(false)
                    }}
                    className="text-xs"
                  >
                    <Lightbulb className="w-3 h-3 mr-1" />
                    Micro-Lesson
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const prompt = "show_common_mistakes"
                      setInputValue(`/${prompt}`)
                      setShowConfigPanel(false)
                    }}
                    className="text-xs"
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Common Mistakes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const prompt = "Generate a study plan based on our conversation"
                      setInputValue(prompt)
                      setShowConfigPanel(false)
                    }}
                    className="text-xs"
                  >
                    <Target className="w-3 h-3 mr-1" />
                    Study Plan
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Workspace empty: welcome + starters up top, input pinned at bottom */}
      {workspaceMode && isWorkspaceEmpty && !hideFooter ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="absolute inset-0 overflow-y-auto overscroll-contain"
            >
              <CoraWorkspaceWelcome
                studentFirstName={studentFirstName}
                activeGoal={chatConfig.learningGoal}
                onSelectGoal={(goal, prompt) => {
                  setChatConfig({ learningGoal: goal })
                  void handleSendMessage(prompt)
                }}
              />
            </div>
          </div>
          <div className="relative z-20 shrink-0 overflow-visible px-4 pb-4 pt-2">
            <div className="mx-auto max-w-2xl">
              {studyPlanAutomationStatus !== "idle" ? (
                <StudyPlanAutomationBanner
                  status={studyPlanAutomationStatus === "running" ? "running" : studyPlanAutomationStatus}
                  onRetry={
                    studyPlanAutomationStatus === "error"
                      ? () => void runStudyPlanAutomation(messages)
                      : undefined
                  }
                />
              ) : null}
              <BottomToolBar
                variant="workspace"
                inputValue={inputValue}
                onInputChange={setInputValue}
                onSendMessage={(msg) => void handleSendMessage(msg)}
                onQuickAction={handleQuickAction}
                attachments={pendingAttachments}
                onRemoveAttachment={(id) =>
                  setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
                }
                onFilesSelected={handleFilesSelected}
                onImportCourseQuestion={() => setShowQuestionImport(true)}
                importedQuestion={importedProblem}
                importedQuestionLabel={importedMeta?.label ?? null}
                onClearImportedQuestion={() => {
                  setImportedProblem(null)
                  setImportedMeta(null)
                }}
                learningGoal={chatConfig.learningGoal}
                onLearningGoalChange={(goal) => setChatConfig({ learningGoal: goal })}
                isLoading={isLoading}
                placeholder="How can I help you today?"
                creditsLabel={
                  credits
                    ? credits.isUnlimited
                      ? "Unlimited credits"
                      : `${credits.credits} credits remaining`
                    : null
                }
                creditsExhausted={Boolean(credits && !credits.isUnlimited && credits.credits <= 0)}
              />
            </div>
          </div>
        </div>
      ) : workspaceMode ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="absolute inset-0 overflow-y-auto overscroll-contain"
            >
              <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <AnimatePresence mode="popLayout">
                  {visibleMessages.map((msg) => renderMessage(msg))}
                </AnimatePresence>
                <div ref={messagesEndRef} className="h-px" aria-hidden />
              </div>
            </div>
          </div>

          {!hideFooter && (
            <>
              <AnimatePresence>
                {showCodeInput && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="shrink-0 border-t border-slate-200 p-4 dark:border-slate-700"
                  >
                    <div className="relative mx-auto max-w-2xl">
                      <Textarea
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value)}
                        placeholder="Paste your C++ code here..."
                        className="min-h-[120px] font-mono text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowCodeInput(false)
                          setCodeInput("")
                        }}
                        className="absolute right-2 top-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative z-20 shrink-0 overflow-visible px-4 pb-4 pt-2">
                <div className="mx-auto max-w-2xl">
                  {studyPlanAutomationStatus !== "idle" ? (
                    <StudyPlanAutomationBanner
                      status={
                        studyPlanAutomationStatus === "running" ? "running" : studyPlanAutomationStatus
                      }
                      onRetry={
                        studyPlanAutomationStatus === "error"
                          ? () => void runStudyPlanAutomation(messages)
                          : undefined
                      }
                    />
                  ) : null}
                  {(() => {
                    const used = countUserExchanges(messages)
                    const max = getMaxExchangesForTier(resolvedMembershipTier)
                    const atLimit = used >= max
                    return (
                      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                        <span>
                          Exchanges {used}/{max}
                          {atLimit ? " · Limit reached — start a new chat" : ""}
                        </span>
                        {atLimit ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full text-[11px]"
                            onClick={() => startNewConversation()}
                          >
                            New chat
                          </Button>
                        ) : null}
                      </div>
                    )
                  })()}
                  <BottomToolBar
                    variant="workspace"
                    inputValue={inputValue}
                    onInputChange={setInputValue}
                    onSendMessage={(msg) => void handleSendMessage(msg)}
                    onQuickAction={handleQuickAction}
                    attachments={pendingAttachments}
                    onRemoveAttachment={(id) =>
                      setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
                    }
                    onFilesSelected={handleFilesSelected}
                    onImportCourseQuestion={() => setShowQuestionImport(true)}
                    importedQuestion={importedProblem}
                    importedQuestionLabel={importedMeta?.label ?? null}
                    onClearImportedQuestion={() => {
                      setImportedProblem(null)
                      setImportedMeta(null)
                    }}
                    learningGoal={chatConfig.learningGoal}
                    onLearningGoalChange={(goal) => setChatConfig({ learningGoal: goal })}
                    isLoading={isLoading || isThreadAtExchangeLimit(messages, resolvedMembershipTier)}
                    placeholder="Ask a follow-up…"
                    creditsLabel={
                      credits
                        ? credits.isUnlimited
                          ? "Unlimited credits"
                          : `${credits.credits} credits remaining`
                        : null
                    }
                    creditsExhausted={Boolean(credits && !credits.isUnlimited && credits.credits <= 0)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <ScrollArea className="relative flex-1 min-h-0">
            <div className={cn("mx-auto max-w-2xl px-4 py-6 sm:px-6", workspaceMode && "py-8")}>
              <AnimatePresence mode="popLayout">
                {visibleMessages.map((msg) => renderMessage(msg))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {!hideFooter && (
            <>
              <AnimatePresence>
                {showCodeInput && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-200 p-4 dark:border-slate-700"
                  >
                    <div className="relative mx-auto max-w-2xl">
                      <Textarea
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value)}
                        placeholder="Paste your C++ code here..."
                        className="min-h-[120px] font-mono text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowCodeInput(false)
                          setCodeInput("")
                        }}
                        className="absolute right-2 top-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={cn("px-4 pb-4 pt-2", workspaceMode && "border-0 bg-transparent")}>
                <div className="mx-auto max-w-2xl">
                  <BottomToolBar
                    variant={workspaceMode ? "workspace" : "default"}
                    inputValue={inputValue}
                    onInputChange={setInputValue}
                    onSendMessage={(msg) => void handleSendMessage(msg)}
                    onQuickAction={handleQuickAction}
                    attachments={pendingAttachments}
                    onRemoveAttachment={(id) =>
                      setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
                    }
                    onFilesSelected={handleFilesSelected}
                    onImportCourseQuestion={() => setShowQuestionImport(true)}
                    importedQuestion={importedProblem}
                    importedQuestionLabel={importedMeta?.label ?? null}
                    onClearImportedQuestion={() => {
                      setImportedProblem(null)
                      setImportedMeta(null)
                    }}
                    learningGoal={chatConfig.learningGoal}
                    onLearningGoalChange={(goal) => setChatConfig({ learningGoal: goal })}
                    isLoading={isLoading}
                    placeholder="Ask a follow-up…"
                    creditsLabel={
                      credits
                        ? credits.isUnlimited
                          ? "Unlimited credits"
                          : `${credits.credits} credits remaining`
                        : null
                    }
                    creditsExhausted={Boolean(credits && !credits.isUnlimited && credits.credits <= 0)}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Tool Modals and Drawers */}
      <ConceptModal
        isOpen={showConceptModal}
        onClose={() => setShowConceptModal(false)}
        onSelectConcept={handleConceptSelect}
      />

      <MiniLessonDrawer
        isOpen={showMiniLessonDrawer}
        onClose={() => setShowMiniLessonDrawer(false)}
        onGenerate={handleMiniLessonGenerate}
      />

      <DebugPanel
        isOpen={showDebugPanel}
        onClose={() => setShowDebugPanel(false)}
        onAnalyze={handleDebugAnalyze}
      />

      <DebugTraceModal
        isOpen={showDebugTraceModal}
        onClose={() => setShowDebugTraceModal(false)}
        onTrace={handleDebugTrace}
      />

      <DocGeneratorPanel
        isOpen={showDocGeneratorPanel}
        onClose={() => setShowDocGeneratorPanel(false)}
        onGenerate={handleDocGenerate}
      />

      <MoreToolsDrawer
        isOpen={showMoreToolsDrawer}
        onClose={() => setShowMoreToolsDrawer(false)}
        onSelectTool={handleMoreToolSelect}
      />

      <CoraQuestionImportDialog
        open={showQuestionImport}
        onClose={() => {
          setShowQuestionImport(false)
          setReattachTargetMessageId(null)
        }}
        studentId={studentId || sessionStorage.getItem("studentDatabaseId") || undefined}
        onImport={(problem, item) => {
          if (reattachTargetMessageId) {
            const targetId = reattachTargetMessageId
            setReattachTargetMessageId(null)
            setShowQuestionImport(false)
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === targetId && m.role === "student")
              if (idx < 0) return prev
              const user = prev[idx]!
              const updatedUser = attachImportedQuestionToMessage(
                user,
                problem,
                item?.label ?? problem.title ?? "Imported question",
              )
              return prev.map((m, i) => (i === idx ? updatedUser : m))
            })
            toast({
              title: "Import reattached",
              description: "Course question attached to this message. Use Regenerate if you want a new answer.",
            })
            return
          }
          setImportedProblem(problem)
          setImportedMeta(item)
          if (problem.source === "quiz" || problem.source === "practice_hub") {
            setChatConfig({ learningGoal: "solve_together" })
          } else if (problem.source === "lecture_workspace" || problem.source === "classroom_points") {
            setChatConfig({ learningGoal: "review" })
          }
        }}
      />
    </div>
  )
}


