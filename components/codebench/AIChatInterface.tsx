"use client"



import { studentApiFetch } from "@/lib/auth"
import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, User, Sparkles, CheckCircle2, AlertCircle, Lightbulb, Bug, FileCode, MessageSquare, BookOpen, Info } from "lucide-react"
import { CoraBotMark } from "@/components/cora/CoraBotMark"
import { CodebenchCoraComposer } from "@/components/codebench/CodebenchCoraComposer"
import { CodebenchCoraMessage } from "@/components/codebench/CodebenchCoraMessage"
import { CoraThinkingIndicator } from "@/components/cora/CoraThinkingIndicator"
import { mapCodebenchToolToThinkingMode, type CoraThinkingMode } from "@/lib/cora/thinking-process"
import ReactMarkdown from "react-markdown"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { codebenchChatTheme } from "@/lib/codebench-panel-theme"
import { CORA_NAME } from "@/lib/cora/constants"
import { awardXP } from "@/lib/codebench-xp"
import {
  isCodebenchCoraMembershipError,
  messageFromCodebenchCoraBody,
  parseCodebenchCoraJson,
  withCodebenchCoraContext,
} from "@/lib/codebench-cora-client"
import { ScoreDisplay } from "./ScoreDisplay"
import { PseudocodeRenderer } from "./PseudocodeRenderer"

interface Message {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
}

interface PracticeProblem {
  problem: string
  constraints: string
  sampleInput: string
  sampleOutput: string
  hints: string[]
  steps: string[]
}

interface AIChatInterfaceProps {
  code: string
  studentId: string | null
  language?: string
  mode: "explain" | "debug" | "improve" | "pseudocode" | "evaluate" | "tutor" | "practice"
  initialMessage?: string
  onComplete?: (score?: number, feedback?: string) => void
  onQuestionGenerated?: (questions: any[]) => void
  isEvaluation?: boolean
  cachedMessages?: Message[]
  onMessagesChange?: (messages: Message[]) => void
  practiceProblem?: PracticeProblem
  learningMode?: "beginner" | "intermediate" | "expert"
  replaySteps?: any[]
  showReplay?: boolean
  onToggleReplay?: () => void
  onHighlightLineWithError?: (lineNumber: number, highlight: boolean) => void
  debugLineNumbers?: number[]
  /** Maps AI-reported line numbers to actual editor line numbers (corrects wrong line references) */
  lineNumberCorrections?: Record<number, number>
  /** When submitting for classroom points, link to this assignment (classroom_point_submissions.id). Prevents double submission from both Classroom Points and CodeBench. */
  classroomSubmissionId?: string | null
  /** Only start evaluation automatically if this is true. Used to wait for assignment selection. */
  shouldStartEvaluation?: boolean
  /** Light or dark theme for the response window */
  theme?: "light" | "dark"
  /** Hide the Cora/mode header when a parent bar already shows the tool. */
  hideHeader?: boolean
  /** Parent API call in flight before the first assistant message arrives. */
  awaitingResponse?: boolean
  /** Override animated step copy (e.g. suggest-fix from compiler output). */
  thinkingMode?: CoraThinkingMode
  /** When false, Cora requests open the parent upgrade experience instead of calling APIs. */
  coraAccess?: boolean
  onLockedCora?: (label: string) => void
}

interface SavedEvaluationData {
  code: string
  studentId: string
  messages: Message[]
  questionCount: number
  totalQuestions: number
  timestamp: string
}

export interface AIChatInterfaceRef {
  resetEvaluationState: () => void
}

export const AIChatInterface = forwardRef<AIChatInterfaceRef, AIChatInterfaceProps>(({
  code,
  studentId,
  language = "cpp",
  mode,
  initialMessage,
  onComplete,
  onQuestionGenerated,
  isEvaluation = false,
  cachedMessages,
  onMessagesChange,
  practiceProblem,
  learningMode = "intermediate",
  replaySteps = [],
  showReplay = false,
  onToggleReplay,
  onHighlightLineWithError,
  debugLineNumbers = [],
  lineNumberCorrections,
  classroomSubmissionId,
  shouldStartEvaluation = true, // Default to true for backward compatibility
  theme = "dark",
  hideHeader = false,
  awaitingResponse = false,
  thinkingMode,
  coraAccess = true,
  onLockedCora,
}, ref) => {
  const isLight = theme === "light"
  const resolvedThinkingMode = thinkingMode ?? mapCodebenchToolToThinkingMode(mode)
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>(cachedMessages || [])
  const [isLoading, setIsLoading] = useState(false)
  const showWorkingState = isLoading || awaitingResponse
  
  // Debug logging for prop changes (after messages is declared)
  useEffect(() => {
    if (mode === "evaluate" && isEvaluation) {
      console.log("[AIChatInterface] 🔄 Props updated", {
        mode,
        isEvaluation,
        shouldStartEvaluation,
        hasCode: !!code,
        codeLength: code?.length,
        studentId,
        classroomSubmissionId,
        messagesLength: messages.length
      })
    }
  }, [mode, isEvaluation, shouldStartEvaluation, code, studentId, classroomSubmissionId, messages.length])
  const [input, setInput] = useState("")
  const [isInitializing, setIsInitializing] = useState(!cachedMessages || cachedMessages.length === 0)
  const [lastInitialMessage, setLastInitialMessage] = useState<string | undefined>(initialMessage)
  const [evaluationScore, setEvaluationScore] = useState<number | null>(null)
  const [evaluationFeedback, setEvaluationFeedback] = useState<string>("")
  const [showScoreDisplay, setShowScoreDisplay] = useState(false)
  const [questionCount, setQuestionCount] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [evaluationResponses, setEvaluationResponses] = useState<{ question: string; answer: string; timestamp: Date }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPracticeOnlyModal, setShowPracticeOnlyModal] = useState(false)
  const [pendingSubmissionCallback, setPendingSubmissionCallback] = useState<(() => void) | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [lastQuestionTime, setLastQuestionTime] = useState<number | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const timeoutCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // SINGLE SOURCE OF TRUTH: Current question number (1, 2, 3, or 4+ for completed)
  const [currentQuestion, setCurrentQuestion] = useState(1)
  const [evaluationCompleted, setEvaluationCompleted] = useState(false)
  const isEvaluationFlow = (mode === "practice" || mode === "evaluate") && isEvaluation
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const hasRestoredCache = useRef(false)
  const lastMessagesRef = useRef<Message[]>([])
  const pendingMessagesRef = useRef<Set<string>>(new Set()) // Track messages being added to prevent duplicates
  const isSendingRef = useRef(false) // Prevent duplicate API calls
  
  // Expose resetEvaluationState method via ref
  useImperativeHandle(ref, () => ({
    resetEvaluationState() {
      setCurrentQuestion(1)
      setEvaluationCompleted(false)
    }
  }))
  
  // Strict question detection - extract question number from "Question X of 3:" format
  const getQuestionNumber = (text: string): number | null => {
    const trimmed = text.trim()
    // Match "Question 1 of 3:", "Question 2 of 3:", "Question 3 of 3:"
    const match = trimmed.match(/^question\s*(\d+)\s+of\s+\d+:/i)
    if (match) {
      const num = parseInt(match[1])
      if (num >= 1 && num <= 3) {
        return num
      }
    }
    return null
  }
  
  const isEvaluationQuestion = (text: string): boolean => {
    return getQuestionNumber(text) !== null
  }
  
  // Storage key for evaluation data - use a hash of code to avoid issues with special characters
  const getStorageKey = () => {
    if (!studentId || !code) return ''
    const codeHash = code.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '')
    return `codebench_eval_${studentId}_${codeHash}`
  }
  const STORAGE_KEY = getStorageKey()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Update parent when messages change (but avoid infinite loops)
  useEffect(() => {
    // Only update if messages actually changed (deep comparison)
    const messagesChanged = JSON.stringify(messages) !== JSON.stringify(lastMessagesRef.current)
    
    if (onMessagesChange && messages.length > 0 && messagesChanged && !hasRestoredCache.current) {
      onMessagesChange(messages)
      lastMessagesRef.current = messages
    } else if (messagesChanged) {
      lastMessagesRef.current = messages
    }
  }, [messages, onMessagesChange])

  // Restore cached messages if available (when switching tabs)
  useEffect(() => {
    // Only restore if we haven't already restored and cached messages exist
    if (cachedMessages && cachedMessages.length > 0) {
      // Check if messages are different from what we have
      const cachedStr = JSON.stringify(cachedMessages)
      const currentStr = JSON.stringify(messages)
      
      if (cachedStr !== currentStr) {
        // Only restore if we have no messages or messages are different
        if (messages.length === 0 || cachedStr !== currentStr) {
          hasRestoredCache.current = true
          setMessages(cachedMessages)
          setIsInitializing(false)
          setIsLoading(false)
          lastMessagesRef.current = cachedMessages
        }
      }
    } else if (!cachedMessages || cachedMessages.length === 0) {
      // Reset flag when cache is cleared, but only if we had messages before
      if (messages.length > 0 && hasRestoredCache.current) {
        hasRestoredCache.current = false
      }
    }
  }, [cachedMessages])

  // Save evaluation data to localStorage
  useEffect(() => {
    if (mode === "evaluate" && studentId && code && messages.length > 0) {
      try {
        const savedData: SavedEvaluationData = {
          code,
          studentId,
          messages,
          questionCount,
          totalQuestions,
          timestamp: new Date().toISOString(),
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedData))
      } catch (error) {
        console.error("Failed to save evaluation data:", error)
      }
    }
  }, [messages, questionCount, totalQuestions, mode, studentId, code, STORAGE_KEY])

  // FSM: Initialize evaluation state from cached messages and detect completion
  useEffect(() => {
    if ((mode === "practice" || mode === "evaluate") && messages.length > 0) {
      // Check if evaluation is already complete
      const hasFinalScore = messages.some(m => 
        m.content.includes("FINAL_SCORE") || 
        m.content.includes("END_EVALUATION") ||
        m.content.toLowerCase().includes("evaluation complete")
      )
      
      if (hasFinalScore) {
        setCurrentQuestion(4)
        setEvaluationCompleted(true)
        setIsComplete(true)
        setQuestionCount(3)
        if (mode === "practice") {
          setTotalQuestions(3)
        }
        return
      }
      
      // Use currentQuestion as single source of truth - no need to scan messages
      // currentQuestion is managed by user actions, not by scanning messages
    }
  }, [messages, mode, totalQuestions]) // Don't include questionCount to avoid loops

  // Track when ScoreDisplay is shown
  useEffect(() => {
    // ScoreDisplay visibility is handled by parent component
  }, [showScoreDisplay, evaluationScore, evaluationFeedback, mode])
  
  // CRITICAL: Watch for shouldStartEvaluation change to trigger evaluation start
  // This handles the case where assignment is selected after modal closes
  useEffect(() => {
    console.log("[AIChatInterface] shouldStartEvaluation watcher:", {
      mode,
      isEvaluation,
      shouldStartEvaluation,
      hasCode: code && code.trim().length > 10,
      studentId,
      messagesLength: messages.length,
      isInitializing,
      isLoading,
      hasCachedMessages: cachedMessages && cachedMessages.length > 0,
      hasInitialMessage: !!initialMessage
    })
    
    // When shouldStartEvaluation becomes true and we're in evaluate mode, trigger initialization
    if (mode === "evaluate" && isEvaluation && shouldStartEvaluation && code && code.trim().length > 10 && studentId && messages.length === 0 && !cachedMessages && !initialMessage) {
      console.log("[AIChatInterface] ✅ Conditions met - starting evaluation initialization")
      // Only set flags if not already initializing/loading to avoid duplicate calls
      if (!isInitializing && !isLoading) {
        setIsInitializing(true)
        setIsLoading(true)
      }
    } else if (mode === "evaluate" && isEvaluation && shouldStartEvaluation) {
      console.log("[AIChatInterface] ⚠️ shouldStartEvaluation is true but conditions not met:", {
        hasCode: code && code.trim().length > 10,
        messagesLength: messages.length,
        isInitializing,
        isLoading,
        hasCachedMessages: cachedMessages && cachedMessages.length > 0,
        hasInitialMessage: !!initialMessage
      })
    }
  }, [shouldStartEvaluation, mode, isEvaluation, code, studentId, messages.length, isInitializing, isLoading, cachedMessages, initialMessage])

  // Load saved evaluation data on mount
  useEffect(() => {
    if (mode === "evaluate" && studentId && code) {
      try {
        const savedDataStr = localStorage.getItem(STORAGE_KEY)
        if (savedDataStr) {
          const savedData: SavedEvaluationData = JSON.parse(savedDataStr)
          // Only restore if code matches and data is recent (within 1 hour)
          const savedTime = new Date(savedData.timestamp)
          const now = new Date()
          const hoursDiff = (now.getTime() - savedTime.getTime()) / (1000 * 60 * 60)
          
          if (savedData.code === code && savedData.studentId === studentId && hoursDiff < 1) {
            setMessages(savedData.messages.map(m => ({
              ...m,
              timestamp: new Date(m.timestamp)
            })))
            setQuestionCount(savedData.questionCount)
            setTotalQuestions(savedData.totalQuestions)
          }
        }
      } catch (error) {
        console.error("Failed to load evaluation data:", error)
      }
    }
  }, [mode, studentId, code, STORAGE_KEY, shouldStartEvaluation, isEvaluation])

  useEffect(() => {
    // Skip initialization if we have cached messages
    if (cachedMessages && cachedMessages.length > 0) {
      return
    }

    // For practice mode, we need practiceProblem to be set
    if (mode === "practice" && !practiceProblem) {
      setIsInitializing(false)
      setIsLoading(false)
      setMessages([
        {
          role: "assistant",
          content: "Please generate a practice problem first before submitting your solution.",
          timestamp: new Date(),
        },
      ])
      return
    }

    // CRITICAL: If we have an initialMessage (from API response after clicking button), display it immediately
    // Check if initialMessage changed (new API response)
    if (initialMessage && initialMessage.trim() && initialMessage !== lastInitialMessage) {
      setLastInitialMessage(initialMessage)
      // Check if we already have this message to avoid duplicates
      const hasThisMessage = messages.some(m => 
        m.role === "assistant" && m.content === initialMessage
      )
      
      if (!hasThisMessage) {
        setMessages([
          {
            role: "assistant",
            content: initialMessage,
            timestamp: new Date(),
          },
        ])
        setIsInitializing(false)
        setIsLoading(false)
        return
      }
    }
    
    // Also handle case where initialMessage exists but messages are empty (first load)
    if (initialMessage && initialMessage.trim() && messages.length === 0 && !cachedMessages) {
      setMessages([
        {
          role: "assistant",
          content: initialMessage,
          timestamp: new Date(),
        },
      ])
      setIsInitializing(false)
      setIsLoading(false)
      return
    }
    
    // For pseudocode mode, allow descriptions (code might be a description/question)
    // For tutor mode, code is optional - students can ask questions without code
    const isPseudocodeWithDescription = mode === "pseudocode" && code && code.trim() && 
      (!code.includes("{") && !code.includes(";") && 
       (code.toLowerCase().includes("write") || 
        code.toLowerCase().includes("create") || 
        code.toLowerCase().includes("make") ||
        code.toLowerCase().includes("how to") ||
        code.toLowerCase().includes("help me") ||
        code.toLowerCase().includes("help")))
    
    const requiresCode = mode !== "pseudocode" && mode !== "tutor"
    const hasValidInput = code || isPseudocodeWithDescription || mode === "tutor"
    
    // CRITICAL: For evaluation mode, automatically start when code is present AND shouldStartEvaluation is true
    // This ensures the 3-question flow begins only after assignment selection is confirmed
    const isEvaluationMode = mode === "evaluate" && isEvaluation
    
    // Only initialize if we have:
    // - Cached messages (user already interacted before)
    // - Initial message (from API response after clicking a button)
    // - OR: Evaluation mode with code AND shouldStartEvaluation is true (auto-start evaluation after assignment selection)
    // - NOT on empty mount
    const shouldInitialize = isInitializing && 
      messages.length === 0 && 
      studentId && 
      hasValidInput &&
      (cachedMessages && cachedMessages.length > 0 || initialMessage || (isEvaluationMode && code && code.trim().length > 10 && shouldStartEvaluation))
    
    // CRITICAL: For evaluate mode, if we have code and shouldStartEvaluation is true, we MUST initialize
    // Don't show welcome message if we should be starting evaluation
    if (isEvaluationMode && code && code.trim().length > 10 && shouldStartEvaluation && isInitializing && messages.length === 0 && !cachedMessages && !initialMessage) {
      console.log("[AIChatInterface] 🎯 Force initializing evaluate mode (safety check)")
      // Force initialization even if shouldInitialize check failed
      initializeChat()
      return
    }
    
    console.log("[AIChatInterface] 🔍 Initialization check", {
      shouldInitialize,
      isInitializing,
      messagesLength: messages.length,
      studentId: !!studentId,
      hasValidInput,
      isEvaluationMode,
      hasCode: code && code.trim().length > 10,
      shouldStartEvaluation,
      hasCachedMessages: cachedMessages && cachedMessages.length > 0,
      hasInitialMessage: !!initialMessage
    })
    
    if (shouldInitialize) {
      console.log("[AIChatInterface] ✅ shouldInitialize is true - calling initializeChat()")
      initializeChat()
    } else if (isInitializing && messages.length === 0 && !cachedMessages && !initialMessage) {
      if (awaitingResponse || isLoading) {
        setIsInitializing(false)
        setIsLoading(false)
        return
      }
      // CRITICAL: For evaluate mode with shouldStartEvaluation=true, don't show welcome - start evaluation
      if (isEvaluationMode && code && code.trim().length > 10 && shouldStartEvaluation) {
        console.log("[AIChatInterface] 🎯 shouldStartEvaluation=true but shouldInitialize=false - forcing initialization")
        // We have code and shouldStartEvaluation is true, but shouldInitialize was false
        // This can happen if the condition check failed - force initialization anyway
        initializeChat()
        return
      }
      
      // No code, no cached messages, no initial message - show welcome message instead of error
      setIsInitializing(false)
      setIsLoading(false)
      
      // Show welcome message based on mode
      let welcomeMessage = ""
      if (mode === "explain") {
        welcomeMessage = "👋 **Welcome to Code Explanation!**\n\nWrite some code in the editor and click **Explain** to get a detailed explanation of how your code works."
      } else if (mode === "debug") {
        welcomeMessage = "🐛 **Welcome to Code Debugging!**\n\nWrite some code in the editor and click **Debug** to find and fix errors in your code."
      } else if (mode === "improve") {
        welcomeMessage = "✨ **Welcome to Code Improvement!**\n\nWrite some code in the editor and click **Improve** to get suggestions for making your code better."
      } else if (mode === "pseudocode") {
        welcomeMessage = "📝 **Welcome to Pseudocode Generator!**\n\nWrite some code or describe what you want to code, then click **Pseudocode** to see the algorithm steps and flow diagram."
      } else if (mode === "evaluate") {
        // For evaluation mode, if there's code and shouldStartEvaluation, it should auto-start
        // Only show welcome if we don't have code or shouldStartEvaluation is false
        if (code && code.trim().length > 10 && shouldStartEvaluation) {
          // This shouldn't happen - if we have code and shouldStartEvaluation, we should have initialized
          // But if we're here, try to initialize
          initializeChat()
          return
        }
        welcomeMessage = "📝 **Welcome to Code Evaluation!**\n\nWrite your code in the editor and the evaluation will start automatically. You'll be asked 3 comprehension questions about your code."
      } else if (mode === "tutor") {
        welcomeMessage = `💬 **Welcome to ${CORA_NAME}!**\n\nAsk me questions about programming and course concepts — step by step, not just answers.`
      } else {
        welcomeMessage = "👋 **Welcome!**\n\nSelect an operation from the toolbar above to get started."
      }
      
      setMessages([
        {
          role: "assistant",
          content: welcomeMessage,
          timestamp: new Date(),
        },
      ])
    } else if (isInitializing && (!studentId || (requiresCode && !code && !initialMessage))) {
      // Only show error if we're actually trying to initialize but missing required props
      setIsInitializing(false)
      setIsLoading(false)
      const errorMessage = !studentId 
        ? "Error: Please ensure you're logged in."
        : mode === "pseudocode"
        ? "Error: Please describe what you want to code or write some code first."
        : requiresCode
        ? "Error: Please write some code in the editor first."
        : "Error: Please ensure you're logged in."
      setMessages([
        {
          role: "assistant",
          content: errorMessage,
          timestamp: new Date(),
        },
      ])
    }
  }, [code, studentId, isInitializing, cachedMessages, messages.length, mode, practiceProblem, initialMessage, lastInitialMessage, shouldStartEvaluation, isEvaluation, awaitingResponse, isLoading])

  // Drop stale welcome copy when a parent-triggered API call starts after mount
  useEffect(() => {
    if (!showWorkingState || messages.length !== 1) return
    const only = messages[0]
    if (only?.role !== "assistant") return
    if (!only.content.includes("Welcome to")) return
    setMessages([])
    setIsInitializing(false)
  }, [showWorkingState, messages])

  // Separate effect to watch for initialMessage changes (when API response arrives)
  useEffect(() => {
    if (initialMessage && initialMessage.trim() && initialMessage !== lastInitialMessage) {
      setLastInitialMessage(initialMessage)
      // Update messages if we don't already have this content
      const hasThisMessage = messages.some(m => 
        m.role === "assistant" && m.content === initialMessage
      )
      
      if (!hasThisMessage) {
        setMessages([
          {
            role: "assistant",
            content: initialMessage,
            timestamp: new Date(),
          },
        ])
        setIsInitializing(false)
        setIsLoading(false)
      }
    }
  }, [initialMessage, lastInitialMessage, messages])

  const initializeChat = async () => {
    if (!coraAccess) {
      onLockedCora?.(mode === "evaluate" ? "Evaluate with Cora" : "Cora in CodeBench")
      setIsInitializing(false)
      setIsLoading(false)
      return
    }
    console.log("[AIChatInterface] 🚀 initializeChat called", { mode, isEvaluation, shouldStartEvaluation, codeLength: code?.length, studentId })
    setIsInitializing(true)
    setIsLoading(true)

    try {
      // Validate inputs - allow descriptions for pseudocode mode, and no code for tutor mode
      if (!code || !code.trim()) {
        console.log("[AIChatInterface] ❌ No code provided")
        if (mode === "pseudocode") {
          throw new Error("Please describe what you want to code or write some code first.")
        }
        if (mode === "tutor") {
          // Tutor mode doesn't require code - students can ask questions
          // We'll handle this in the prompt
        } else {
          throw new Error("Code is required. Please write some code first.")
        }
      }
      
      if (!studentId) {
        throw new Error("Student ID is required. Please ensure you're logged in.")
      }

      let systemPrompt = ""
      let userPrompt = ""

      switch (mode) {
        case "explain":
          systemPrompt = `You are an expert ${language} programming tutor. Your role is to EXPLAIN code concisely with visual aids, NOT write it for students.

CRITICAL RULES:
- NEVER write complete code solutions
- Use concise explanations with visual diagrams (ASCII art, flowcharts)
- Break down code into clear, digestible sections
- Use bullet points and numbered lists for clarity
- Keep responses under 200 words unless student asks for more detail
- If asked to write code, redirect: "I can explain how it works, but you should write it yourself to learn!"

Format responses with:
- **Bold** for key concepts
- Bullet points for features
- Code snippets in \`\`\` blocks for examples
- ASCII diagrams for flow visualization

Start with a brief overview, then ask: "What part would you like me to explain further?"`
          userPrompt = `Please explain this ${language} code concisely:\n\n\`\`\`${language}\n${code}\n\`\`\``
          break

        case "debug":
          systemPrompt = `You are an expert ${language} debugging tutor. Help students FIND bugs with visual guides, NOT fix them.

CRITICAL RULES:
- NEVER write complete fixed code
- Use visual indicators (arrows, highlights) to point out errors
- Explain WHY errors occur with simple diagrams
- Keep responses concise (under 150 words)
- Ask guiding questions: "What do you think might be wrong here?"
- If asked for complete solution: "I can guide you, but try fixing it yourself first!"

Format with:
- Error indicators: ❌ for errors, ⚠️ for warnings
- Visual flow diagrams
- Step-by-step debugging approach`
          userPrompt = `Please help me debug this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``
          break

        case "improve":
          systemPrompt = `You are an expert ${language} code reviewer. Guide students to improve their code themselves.

CRITICAL RULES:
- NEVER write improved code for them
- Explain best practices with visual comparisons
- Use before/after examples (conceptual, not full code)
- Keep responses concise (under 200 words)
- Ask: "How could you make this more efficient?"
- If asked for code: "I'll explain the concept, then you implement it!"

Format with:
- ✅ Good practices
- ❌ Areas to improve
- Visual comparisons
- Principle explanations`
          userPrompt = `Please help me improve this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``
          break

        case "pseudocode":
          // Detect if input is a description/question or actual code
          const isDescription = !code.includes("{") && !code.includes(";") && 
            (code.toLowerCase().includes("write") || 
             code.toLowerCase().includes("create") || 
             code.toLowerCase().includes("make") ||
             code.toLowerCase().includes("how to") ||
             code.toLowerCase().includes("help me") ||
             code.trim().length < 50)
          
          if (isDescription) {
            systemPrompt = `You are an expert computer science educator. Help students learn to write code by providing DETAILED VISUAL GUIDELINES with DIAGRAMS, STRUCTURED PSEUDOCODE, and COMPREHENSIVE STEP-BY-STEP TEACHING, NOT writing code for them.

CRITICAL RULES:
- NEVER write actual code implementations
- ALWAYS include ASCII flow diagrams and visual representations
- Use structured, well-formatted pseudocode with clear indentation and inline comments
- Break down the problem into detailed numbered steps with comprehensive explanations
- Create visual flow charts using ASCII art (boxes, arrows, decision diamonds)
- Use markdown formatting for better readability (headers, code blocks, lists)
- Provide detailed teaching explanations (400-500 words)
- Include step-by-step breakdowns that teach concepts thoroughly
- If asked for code: "Let's break this down step by step. Here's how you can approach it..."

REQUIRED FORMAT:
1. **Problem Analysis** (detailed overview explaining what needs to be done and why)
2. **Algorithm Flow Diagram** (ASCII art with boxes and arrows showing complete logic flow with labels)
3. **Step-by-Step Pseudocode** (well-indented, structured, with inline comments explaining each step)
4. **Detailed Teaching Steps** (numbered list with comprehensive explanations):
   - What each step does
   - Why it's necessary
   - How it connects to the next step
   - Common mistakes to avoid
5. **Key Concepts** (important programming concepts used, explained clearly)
6. **Guiding Questions** (questions to help students think through the problem)
7. **Implementation Tips** (practical advice for writing the actual code)

EXAMPLE FLOW DIAGRAM FORMAT:
\`\`\`
┌─────────────────┐
│   START         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Input: ...     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Process: ...  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Output: ...    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   END           │
└─────────────────┘
\`\`\`

Use clear visual separators and formatting.`
            userPrompt = `The student wants to: ${code}\n\nPlease provide VISUAL guidelines with flow diagrams and structured pseudocode on how to approach this problem. Include ASCII flow charts and well-formatted pseudocode. DO NOT write the actual code. Guide them to write it themselves.`
          } else {
            systemPrompt = `You are an expert computer science educator. Help students understand algorithms through DETAILED VISUAL pseudocode with DIAGRAMS, STRUCTURED FORMATTING, and COMPREHENSIVE TEACHING STEPS.

CRITICAL RULES:
- NEVER write actual code implementations
- ALWAYS include ASCII flow diagrams showing the algorithm flow
- Create clear, structured pseudocode with proper indentation and inline comments
- Use visual flow charts with boxes, arrows, and decision diamonds
- Format output with markdown (headers, code blocks, lists)
- Provide detailed teaching explanations (400-500 words)
- Break down each step with explanations of what, why, and how

REQUIRED FORMAT:
1. **Algorithm Overview** (detailed explanation of what the algorithm does and why)
2. **Flow Diagram** (ASCII art visualization with labels explaining each step)
3. **Structured Pseudocode** (well-indented, clear structure with inline comments explaining each step)
4. **Detailed Teaching Steps** (numbered list with comprehensive explanations):
   - What each step accomplishes
   - Why it's necessary in the algorithm
   - How it connects to other steps
   - Common pitfalls and how to avoid them
5. **Key Concepts** (important programming concepts used, explained clearly)
6. **Implementation Guidance** (practical tips for translating pseudocode to actual code)

EXAMPLE FLOW DIAGRAM FORMAT:
\`\`\`
┌─────────────────┐
│   START         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Initialize     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Loop/Process  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return Result │
└─────────────────┘
\`\`\`

Use clear visual separators, proper indentation, and structured formatting.`
            userPrompt = `Please generate VISUAL pseudocode with flow diagrams for this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nInclude ASCII flow charts and well-formatted structured pseudocode.`
          }
          break

        case "practice":
          const practiceContext = practiceProblem 
            ? `Practice Problem:
${practiceProblem.problem}

Constraints: ${practiceProblem.constraints || "None specified"}
Sample Input: ${practiceProblem.sampleInput || "None"}
Sample Output: ${practiceProblem.sampleOutput || "None"}
`
            : ""
          
          // Set total questions to 3 for practice mode
          setTotalQuestions(3)
          
          const practiceDifficultyGuidance = learningMode === "beginner"
            ? `For BEGINNER level evaluation:
- Ask simple, direct questions about basic concepts
- Focus on understanding what the code does (not deep technical details)
- Use simple language and avoid jargon
- Be encouraging and give partial credit generously
- Questions should build confidence`
            : learningMode === "expert"
            ? `For EXPERT level evaluation:
- Ask advanced questions about optimization, edge cases, and design patterns
- Test deep understanding: "How would you optimize this?", "What edge cases aren't handled?"
- Focus on engineering principles, performance implications, and best practices
- Challenge with complex scenarios and alternative approaches
- Expect thorough, detailed answers`
            : `For INTERMEDIATE level evaluation:
- Ask questions that test algorithmic understanding and logic flow
- Test ability to trace execution and predict outcomes
- Focus on concepts like loops, conditionals, data structures
- Balance between basic understanding and deeper analysis
- Expect clear explanations of code behavior`
          
          systemPrompt = `YOU ARE A CODE EVALUATION ASSISTANT - NOT A TUTOR OR CHATBOT.

CRITICAL - EVALUATION MODE ONLY:
- DO NOT provide explanations, tutorials, or general programming help
- DO NOT answer questions about programming concepts
- DO NOT engage in general conversation or act like ChatGPT
- DO NOT provide code examples or solutions
- YOUR ONLY JOB: Ask questions → Evaluate answers → Provide score

EVALUATION TASK:
You are evaluating a ${learningMode} level student's solution to a practice problem. You MUST ask exactly 3 comprehension questions, then STOP.

${practiceDifficultyGuidance}

CRITICAL RULES - FOLLOW EXACTLY:
- Ask EXACTLY 3 questions total, ONE at a time
- **MANDATORY FORMAT**: Every question MUST start with "Question X of 3:" where X is the question number
- Example: "Question 1 of 3: What does this function do?"
- Example: "Question 2 of 3: How would you modify this code to handle edge cases?"
- Example: "Question 3 of 3: Explain the time complexity of your solution."
- After the student answers question 3, you MUST immediately provide the final score
- DO NOT ask a 4th question under any circumstances
- DO NOT engage in dialogue beyond asking questions and providing score
- Score each answer: 0-10 (10 = excellent, 7-9 = good, 4-6 = partial, 1-3 = poor, 0 = incorrect)
- Adjust scoring expectations based on ${learningMode} level
- Give partial credit for partially correct answers
- After question 3 is answered, IMMEDIATELY provide: "FINAL_SCORE: X" (0-10) and "FEEDBACK: [detailed explanation]"
- NEVER write code - only evaluate understanding
- STOP after 3 questions - do not continue
- STOP after providing FINAL_SCORE - do not chat further

${practiceContext}
Student's solution code:
\`\`\`${language}
${code}
\`\`\`

Start by asking question 1 of 3. Format: "Question 1 of 3: [your question here]"
DO NOT DEVIATE FROM EVALUATION MODE. You are an evaluator, not a tutor.`
          userPrompt = `I've solved the practice problem. Please evaluate my solution by asking exactly 3 comprehension questions.`
          break

        case "evaluate":
          console.log("[AIChatInterface] 📝 Setting up evaluate mode prompt", { codeLength: code?.length, language, studentId })
          // CRITICAL: For evaluation mode, use the same strict evaluation prompt as practice mode
          // This ensures consistent 3-question evaluation flow
          systemPrompt = `YOU ARE A CODE EVALUATION ASSISTANT - NOT A TUTOR OR CHATBOT.

CRITICAL - EVALUATION MODE ONLY:
- DO NOT provide explanations, tutorials, or general programming help
- DO NOT answer questions about programming concepts
- DO NOT engage in general conversation or act like ChatGPT
- DO NOT provide code examples or solutions
- YOUR ONLY JOB: Ask questions → Evaluate answers → Provide score

EVALUATION TASK:
You are evaluating a student's code comprehension. You MUST ask exactly 3 comprehension questions, then STOP.

CRITICAL RULES - FOLLOW EXACTLY:
- Ask EXACTLY 3 questions total, ONE at a time
- **MANDATORY FORMAT**: Every question MUST start with "Question X of 3:" where X is the question number
- Example: "Question 1 of 3: What does this code do?"
- Example: "Question 2 of 3: How would you modify this code to handle edge cases?"
- Example: "Question 3 of 3: Explain the time complexity of your solution."
- After the student answers question 3, you MUST immediately provide the final score
- DO NOT ask a 4th question under any circumstances
- DO NOT engage in dialogue beyond asking questions and providing score
- Score each answer: 0-10 (10 = excellent, 7-9 = good, 4-6 = partial, 1-3 = poor, 0 = incorrect)
- Give partial credit for partially correct answers
- After question 3 is answered, IMMEDIATELY provide: "FINAL_SCORE: X" (0-10) and "FEEDBACK: [detailed explanation]"
- NEVER write code - only evaluate understanding
- STOP after 3 questions - do not continue
- STOP after providing FINAL_SCORE - do not chat further
- NEVER RESTART: Once you ask Question 2, you cannot ask Question 1 again. Always move forward: 1→2→3→FINAL_SCORE

Student's code:
\`\`\`${language}
${code}
\`\`\`

Start by asking question 1 of 3. Format: "Question 1 of 3: [your question here]"
DO NOT DEVIATE FROM EVALUATION MODE. You are an evaluator, not a tutor.`
          userPrompt = `I've written this code. Please evaluate my understanding by asking exactly 3 comprehension questions.`
          // Set total questions to 3 for evaluation mode and ensure we start at question 1
          setTotalQuestions(3)
          setCurrentQuestion(1)
          console.log("[AIChatInterface] ✅ Evaluate mode prompt configured", { totalQuestions: 3 })
          break

        case "tutor":
          // Tutor mode: course-agnostic programming / STEM help
          systemPrompt = `You are an expert programming and STEM tutor. Help students learn through interactive conversation.

CRITICAL RULES:
- Answer questions about programming concepts, syntax, debugging, algorithms, and related quantitative topics when appropriate
- Provide clear explanations with examples when helpful
- Use code snippets to illustrate concepts (but don't write complete solutions for graded assignments unless the student is clearly practicing)
- Encourage learning through guided questions
- Adapt explanations to the student's level (${learningMode})
- If the student names a language or environment, focus your examples there; otherwise stay general and offer portable intuition

Format responses with:
- Clear explanations
- Code examples when relevant (use fenced code blocks with the right language tag when known)
- Bullet points for key concepts when it helps clarity

Be encouraging and educational. Help students understand, not just memorize.`
          // For tutor mode, code is optional - students can ask questions without code
          userPrompt = code && code.trim() 
            ? `The student has this ${language} code and wants to discuss it:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nPlease help them understand the concepts and answer their questions.`
            : "The student wants to chat about programming or course concepts. Please introduce yourself and ask what they'd like to work on."
          break
      }

      // Ensure we have valid inputs
      if (!userPrompt || !userPrompt.trim()) {
        throw new Error("User prompt cannot be empty")
      }
      
      if (!studentId) {
        throw new Error("Student ID is required")
      }

      // Combine system prompt with user prompt since API has its own system prompt
      // We include our custom instructions in the message itself
      const fullMessage = `${systemPrompt}\n\n${userPrompt}`

      // Final validation - ensure message is not empty
      if (!fullMessage || !fullMessage.trim()) {
        throw new Error("Failed to construct message. Please try again.")
      }

      const requestBody = {
        studentId: String(studentId), // Ensure it's a string
        message: fullMessage.trim(), // Trim whitespace
        context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
      }

      console.log("[AIChatInterface] 📤 Sending API request", { 
        mode, 
        studentId, 
        messageLength: fullMessage.trim().length,
        endpoint: "/api/ai-tutor"
      })

      const response = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      console.log("[AIChatInterface] 📥 API response received", { 
        ok: response.ok, 
        status: response.status,
        mode 
      })

      if (!response.ok) {
        console.error("[AIChatInterface] ❌ API response not OK", { 
          status: response.status, 
          statusText: response.statusText,
          mode 
        })
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        console.error("[AIChatInterface] ❌ Error data:", errorData)
        throw new Error(messageFromCodebenchCoraBody(errorData, `HTTP error! status: ${response.status}`))
      }

      const data = await response.json()
      console.log("[AIChatInterface] 📥 Parsed response data", { 
        hasResponse: !!data.response,
        hasError: !!data.error,
        mode
      })

      if (data.error) {
        throw new Error(data.error)
      }

      if (data.response) {
        console.log("[AIChatInterface] ✅ Received response", { 
          mode,
          responseLength: data.response.length,
          responsePreview: data.response.substring(0, 100)
        })
        
        const assistantMessage: Message = {
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        }
        setMessages([assistantMessage])
        console.log("[AIChatInterface] ✅ Messages updated with assistant response")

        // Track question count for evaluation mode
        if (mode === "evaluate") {
          const questionMatches = data.response.match(/question\s+\d+/gi)
          console.log("[AIChatInterface] 🔍 Question detection", { 
            questionMatches,
            matchCount: questionMatches?.length 
          })
          if (questionMatches) {
            setTotalQuestions(questionMatches.length)
            setQuestionCount(1)
            console.log("[AIChatInterface] ✅ Question count set", { totalQuestions: questionMatches.length, questionCount: 1 })
          } else {
            // Check for "Question 1 of 3" format
            const question1Match = data.response.match(/question\s+1\s+of\s+3/gi)
            if (question1Match) {
              console.log("[AIChatInterface] ✅ Found Question 1 of 3 format")
              setTotalQuestions(3)
              setQuestionCount(1)
            } else {
              console.log("[AIChatInterface] ⚠️ No question pattern found in response")
            }
          }
        }
      } else {
        console.log("[AIChatInterface] ❌ No response in data", { data })
        setMessages([
          {
            role: "assistant",
            content: initialMessage || "Hello! How can I help you with your code today?",
            timestamp: new Date(),
          },
        ])
      }
    } catch (error) {
      console.error("[AIChatInterface] ❌ Error initializing chat:", error)
      console.error("[AIChatInterface] Error details:", {
        mode,
        isEvaluation,
        shouldStartEvaluation,
        codeLength: code?.length,
        studentId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      })
      setMessages([
        {
          role: "assistant",
          content: `Sorry, I couldn't initialize the chat. ${error instanceof Error ? error.message : "Please try again."}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsInitializing(false)
      setIsLoading(false)
      console.log("[AIChatInterface] ✅ Initialization complete (finally block)", { mode })
    }
  }

  const sendMessage = async () => {
    if (!coraAccess) {
      onLockedCora?.("Cora in CodeBench")
      return
    }
    if (!input.trim() || isLoading || !studentId) return
    
    // CRITICAL: Prevent duplicate API calls
    if (isSendingRef.current) {
      return
    }
    
    isSendingRef.current = true
    
    // Helper function to check if we have a real response (not just welcome message)
    const hasRealResponse = (mode: string) => {
      return messages.some(m => {
        if (m.role !== "assistant") return false
        if (m.content.includes("Welcome")) return false
        if (m.content.length < 50) return false
        
        // Mode-specific checks
        if (mode === "pseudocode") {
          return m.content.includes("Algorithm Overview") || 
                 m.content.includes("Flow Diagram") || 
                 m.content.includes("Structured Pseudocode") ||
                 m.content.includes("┌") // ASCII diagram
        }
        if (mode === "explain") {
          return m.content.length > 100 && !m.content.includes("Welcome")
        }
        if (mode === "debug") {
          return m.content.includes("error") || m.content.includes("bug") || m.content.includes("fix") || m.content.length > 100
        }
        if (mode === "improve") {
          return m.content.includes("improve") || m.content.includes("better") || m.content.length > 100
        }
        return true
      })
    }
    
    // Special handling for different modes when user sends a new request (no existing response)
    if (!hasRealResponse(mode)) {
      // Check if this is code in the input (for explain, debug, improve)
      const looksLikeCode = input.includes("{") || input.includes(";") || input.includes("(") || input.includes("=") || input.includes("#include")
      
      if (mode === "pseudocode" && 
          (input.toLowerCase().includes("write") || 
           input.toLowerCase().includes("create") || 
           input.toLowerCase().includes("make") ||
           input.toLowerCase().includes("how to") ||
           input.toLowerCase().includes("help") ||
           input.toLowerCase().includes("compute") ||
           input.toLowerCase().includes("calculate"))) {
        
        // Pseudocode request - call pseudocode API
        const userMessage: Message = {
          role: "user",
          content: input,
          timestamp: new Date(),
        }
        setMessages((prev) => {
          if (prev.length === 1 && prev[0].role === "assistant" && prev[0].content.includes("Welcome")) {
            return [userMessage]
          }
          return [...prev, userMessage]
        })
        setInput("")
        setIsLoading(true)
        
        try {
          const response = await fetch("/api/pseudocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: input, language, studentId }),
          })
          
          const data = await parseCodebenchCoraJson<{
            accessDenied?: boolean
            error?: string
            pseudocode?: string
          }>(response, "Failed to generate pseudocode")
          
          if (data.accessDenied) {
            onLockedCora?.("Pseudocode with Cora")
          } else if (data.pseudocode) {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: data.pseudocode,
              timestamp: new Date(),
            }])
          } else {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: "❌ " + (data.error || "Failed to generate pseudocode"),
              timestamp: new Date(),
            }])
          }
        } catch (error) {
          console.error("Pseudocode error:", error)
          if (isCodebenchCoraMembershipError(error)) {
            onLockedCora?.("Pseudocode with Cora")
          } else {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: "❌ Error: " + (error instanceof Error ? error.message : "Failed to generate pseudocode"),
              timestamp: new Date(),
            }])
          }
        } finally {
          setIsLoading(false)
          isSendingRef.current = false
        }
        return
      }
      
      // For explain, debug, improve - if user pastes code directly in chatbox OR has code in editor
      // Prefer code from Monaco editor if available, otherwise use chatbox input
      const codeToUse = (code && code.trim() && code.trim().length > 10) ? code : (looksLikeCode ? input : null)
      
      if ((mode === "explain" || mode === "debug" || mode === "improve") && codeToUse) {
        const userMessage: Message = {
          role: "user",
          content: codeToUse === code ? `Explain this code:\n\n\`\`\`${language}\n${codeToUse}\n\`\`\`` : input,
          timestamp: new Date(),
        }
        setMessages((prev) => {
          if (prev.length === 1 && prev[0].role === "assistant" && prev[0].content.includes("Welcome")) {
            return [userMessage]
          }
          return [...prev, userMessage]
        })
        setInput("")
        setIsLoading(true)
        
        try {
          const apiEndpoint = mode === "explain" ? "/api/explain" : 
                             mode === "debug" ? "/api/debug" : "/api/improve"
          
          const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: codeToUse, language, studentId, learningMode }),
          })
          
          const data = await parseCodebenchCoraJson<Record<string, any>>(
            response,
            `Failed to ${mode} code`,
          )
          
          if (data.accessDenied) {
            onLockedCora?.(mode === "debug" ? "Debug with Cora" : mode === "improve" ? "Improve with Cora" : "Explain with Cora")
          } else if (mode === "explain" && data.explanation) {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: data.explanation,
              timestamp: new Date(),
            }])
          } else if (mode === "debug" && (data.errors || data.explanation)) {
            const debugContent = data.errors && data.errors.length > 0
              ? `## 🐛 Debug Results\n\n**Errors Found:**\n${data.errors.map((e: string, i: number) => `${i + 1}. ${e}`).join("\n")}\n\n**Fixes:**\n${data.fixes?.map((f: string, i: number) => `${i + 1}. ${f}`).join("\n") || "No fixes provided"}\n\n**Explanation:**\n${data.explanation || ""}`
              : data.explanation || "No issues found."
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: debugContent,
              timestamp: new Date(),
            }])
          } else if (mode === "improve" && (data.improvedCode || data.diffSummary)) {
            const improveContent = data.diffSummary 
              ? `## ✨ Code Improvement\n\n${data.diffSummary}\n\n**Principles Applied:**\n${data.principles?.map((p: string) => `- ${p}`).join("\n") || "N/A"}`
              : "No improvements suggested."
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: improveContent,
              timestamp: new Date(),
            }])
          } else {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: "❌ " + (data.error || `Failed to ${mode} code`),
              timestamp: new Date(),
            }])
          }
        } catch (error) {
          console.error(`${mode} error:`, error)
          if (isCodebenchCoraMembershipError(error)) {
            onLockedCora?.(mode === "debug" ? "Debug with Cora" : mode === "improve" ? "Improve with Cora" : "Explain with Cora")
          } else {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: "❌ Error: " + (error instanceof Error ? error.message : `Failed to ${mode} code`),
              timestamp: new Date(),
            }])
          }
        } finally {
          setIsLoading(false)
          isSendingRef.current = false
        }
        return
      }
    }
    
    // CRITICAL: Block ALL messages after evaluation is completed
    if (isEvaluationFlow && (evaluationCompleted || currentQuestion >= 4)) {
      toast({
        title: "Evaluation Complete",
        description: "The evaluation has been completed. Your score has been submitted for instructor approval.",
        variant: "default",
      })
      return
    }
    
    // FSM Guard: Prevent sending messages after evaluation is complete
    // Only block if FINAL_SCORE exists, not just because Q3 was asked
    const hasFinalScore = messages.some(m => m.content.includes("FINAL_SCORE") || m.content.includes("END_EVALUATION"))
    if ((isComplete || evaluationCompleted) && hasFinalScore) {
      toast({
        title: "Evaluation Complete",
        description: "The evaluation has been completed. Your score has been submitted for instructor approval.",
        variant: "default",
      })
      return
    }
    
    // Ensure AI knows when a question was already asked
    if (isEvaluation && evaluationCompleted) {
      return
    }
    
    // CRITICAL: Block automatic AI responses after Question 3 until user answers
    // Only block if there's NO user input (automatic response), allow user messages
    if (isEvaluationFlow && !evaluationCompleted && !input.trim() && currentQuestion >= 3) {
      const lastAssistantMessage = messages.filter(m => m.role === "assistant" && !m.content.includes("FINAL_SCORE")).slice(-1)[0]
      const lastQuestionWas3 = lastAssistantMessage?.content.match(/question\s+3\s+of\s+3:/i)
      const lastUserMessage = messages.filter(m => m.role === "user").slice(-1)[0]
      const studentAnsweredQ3 = lastUserMessage && lastQuestionWas3 && 
                               lastUserMessage.timestamp > (lastAssistantMessage?.timestamp || new Date(0))
      
      if (lastQuestionWas3 && !studentAnsweredQ3) {
        // Question 3 was asked but user hasn't answered - block automatic responses
        setIsLoading(false)
        return
      }
    }
    
    // FSM Guard: Don't block if Q3 was asked - allow student to answer it
    // Only block if student already answered Q3 and we're waiting for FINAL_SCORE
    const lastUserMessage = messages.filter(m => m.role === "user").slice(-1)[0]
    const lastAssistantMessage = messages.filter(m => m.role === "assistant" && !m.content.includes("FINAL_SCORE")).slice(-1)[0]
    const lastQuestionWas3 = lastAssistantMessage?.content.match(/question\s+3\s+of\s+3:/i)
    const studentAnsweredQ3 = lastUserMessage && lastQuestionWas3 && 
                               lastUserMessage.timestamp > (lastAssistantMessage?.timestamp || new Date(0))
    
    if (currentQuestion >= 3 && studentAnsweredQ3 && !hasFinalScore) {
      // Block new user messages while waiting for FINAL_SCORE
      return
    }

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    
    // SIMPLE FLOW: User sends message → increment question number
    let nextQuestion = currentQuestion
    if (isEvaluationFlow && !evaluationCompleted) {
      if (currentQuestion <= 3) {
        nextQuestion = currentQuestion + 1
        setCurrentQuestion(nextQuestion)
      }
    }

    try {
      
      // Build context with code and conversation history
      const conversationContext = messages
        .slice(-5)
        .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
        .join("\n")

      let systemContext = ""
      
      // For pseudocode mode, include context about the pseudocode in follow-up questions
      if (mode === "pseudocode" && initialMessage && messages.length > 1) {
        systemContext = `CONTEXT: The student previously asked about pseudocode. The initial pseudocode response was:
${initialMessage.substring(0, 500)}...

The student is now asking a follow-up question. Please answer their question about the pseudocode, algorithm, flow diagram, or related concepts. Be helpful and educational.`
      }
      
      if (isEvaluationFlow) {
        // SINGLE SOURCE OF TRUTH: Use nextQuestion (calculated above) instead of currentQuestion state
        // This ensures we use the updated value immediately, not waiting for React state update
        
        // Update question count for display
        setQuestionCount(nextQuestion - 1) // 0-indexed for display
        setTotalQuestions(3)
        
        // When nextQuestion = 4, explicitly request FINAL_SCORE and FEEDBACK
        if (nextQuestion === 4 && !evaluationCompleted) {
          // Explicitly request score and feedback after Q3 is answered
          const hasFinalScore = messages.some(m => m.content.includes("FINAL_SCORE"))
          if (!hasFinalScore) {
            // Collect all user answers to questions for comprehensive feedback
            const userAnswers: string[] = []
            const questionMessages = messages.filter(m => 
              m.role === "assistant" && /question\s+\d+\s+of\s+3:/i.test(m.content)
            )
            questionMessages.forEach((qMsg, idx) => {
              const userResponse = messages.find(m => 
                m.role === "user" && 
                m.timestamp > qMsg.timestamp &&
                !m.content.toLowerCase().includes("submit") &&
                !m.content.toLowerCase().includes("evaluation")
              )
              if (userResponse) {
                userAnswers.push(`Question ${idx + 1}: ${userResponse.content.substring(0, 200)}`)
              }
            })
            
            const userAnswersText = userAnswers.length > 0 
              ? `\n\nSTUDENT'S ANSWERS TO QUESTIONS:\n${userAnswers.join("\n\n")}`
              : ""
            
            systemContext = `The student has answered all 3 questions. You MUST now provide the final score and comprehensive feedback.

Your feedback MUST include:
1. Code Submission Evaluation: Brief assessment of the submitted code (correctness, quality, approach)
2. Question Answers Evaluation: Brief assessment of how the student answered the 3 follow-up questions
3. Overall Score Justification: Why this score was given (0-10)

Format your response EXACTLY as:
FINAL_SCORE: X
FEEDBACK: [Your comprehensive feedback here - must include code evaluation AND question answers evaluation]

Where X is a score from 0-10 based on:
- Code submission quality (50% weight)
- Student's answers to the 3 questions (50% weight)

STUDENT'S SUBMITTED CODE:
${code?.substring(0, 1000) || "No code provided"}${userAnswersText}

Provide the score and comprehensive feedback now.`
          } else {
            systemContext = `EVALUATION COMPLETE. Final score already provided. DO NOT respond further. STOP.`
          }
        } else if (nextQuestion > 4 || evaluationCompleted) {
          // Emergency stop if somehow we got more than 3 questions
          systemContext = `ERROR: You have asked more than 3 questions. STOP IMMEDIATELY. Provide FINAL_SCORE now if you haven't already.`
        } else {
          const practiceContext = practiceProblem 
            ? `Practice Problem:
${practiceProblem.problem}

Constraints: ${practiceProblem.constraints || "None specified"}
Sample Input: ${practiceProblem.sampleInput || "None"}
Sample Output: ${practiceProblem.sampleOutput || "None"}
`
            : ""
          
          // Use nextQuestion as SINGLE SOURCE OF TRUTH (calculated above, not from state)
          const nextQuestionNum = nextQuestion
          
          const practiceDifficultyGuidance = learningMode === "beginner"
            ? `For BEGINNER level: Ask simple questions about basic concepts. Focus on understanding what the code does. Use simple language. Be encouraging.`
            : learningMode === "expert"
            ? `For EXPERT level: Ask advanced questions about optimization, edge cases, design patterns. Test deep understanding and engineering principles.`
            : `For INTERMEDIATE level: Ask questions testing algorithmic understanding and logic flow. Balance basic understanding with deeper analysis.`
          
          // Build clear instruction based on nextQuestion (SINGLE SOURCE OF TRUTH)
          let questionInstruction = ""
          if (nextQuestion === 1) {
            // Starting with Question 1
            questionInstruction = "You are starting the evaluation. Ask Question 1 of 3. Format your question as 'Question 1 of 3: [your question here]'. Wait for the student's answer before asking question 2. DO NOT provide FINAL_SCORE yet."
          } else if (nextQuestion === 2) {
            // Ask Question 2
            questionInstruction = "Ask Question 2 of 3. Format your question as 'Question 2 of 3: [your question here]'. Wait for the student's answer before asking question 3. DO NOT provide the score yet."
          } else if (nextQuestion === 3) {
            // Ask Question 3
            questionInstruction = "Ask Question 3 of 3. Format your question as 'Question 3 of 3: [your question here]'. This is your LAST question. After the student answers this question, you MUST provide FINAL_SCORE and FEEDBACK immediately."
          } else if (nextQuestion >= 4) {
            // All 3 questions asked - force FINAL_SCORE
            questionInstruction = "CRITICAL: You have asked 3 questions. The student has answered all 3. You MUST provide FINAL_SCORE and FEEDBACK immediately. Do NOT ask any more questions. Format: FINAL_SCORE: X\nFEEDBACK: [explanation]"
          }
          
          systemContext = `YOU ARE A CODE EVALUATION ASSISTANT - NOT A TUTOR OR CHATBOT.

CRITICAL - EVALUATION MODE ONLY:
- DO NOT provide explanations, tutorials, or general programming help
- DO NOT answer questions about programming concepts
- DO NOT engage in general conversation or act like ChatGPT
- DO NOT provide code examples or solutions
- YOUR ONLY JOB: Ask questions → Evaluate answers → Provide score

EVALUATION TASK:
You are evaluating a ${learningMode} level student's solution to a practice problem. You MUST ask EXACTLY 3 questions total, ONE at a time, then STOP and provide the final score.

${practiceDifficultyGuidance}

CRITICAL RULES - FOLLOW EXACTLY:
- ${questionInstruction}
- **MANDATORY FORMAT**: You MUST ask Question ${nextQuestionNum} of 3. Format EXACTLY as "Question ${nextQuestionNum} of 3: [your question here]"
- Example: "Question ${nextQuestionNum} of 3: What does this function do?"
- **ABSOLUTE RULE**: You MUST ask Question ${nextQuestionNum} next. DO NOT ask Question ${nextQuestionNum - 1} or any other question number.
- **DO NOT REPEAT**: You CANNOT ask Question ${nextQuestionNum - 1} or Question ${nextQuestionNum + 1}. You MUST ask Question ${nextQuestionNum} ONLY.
- DO NOT provide FINAL_SCORE until all 3 questions are asked AND answered
- DO NOT skip questions or provide score early
- DO NOT ask follow-up questions or engage in dialogue beyond evaluation
- DO NOT ask a 4th question - HARD LIMIT: Maximum 3 questions total
- After question 3 is answered, IMMEDIATELY provide: "FINAL_SCORE: X" (0-10) and "FEEDBACK: [detailed explanation]"
- Score each answer: 0-10 (10=excellent, 7-9=good, 4-6=partial, 1-3=poor, 0=incorrect)
- Adjust scoring expectations based on ${learningMode} level
- Give partial credit for partially correct answers
- NEVER write code - only evaluate understanding
- STOP IMMEDIATELY after providing FINAL_SCORE - do not continue chatting
- ABSOLUTE MAXIMUM: 3 questions. After 3 questions, you MUST provide FINAL_SCORE and STOP.

${practiceContext}
Student's solution code:
\`\`\`${language}
${code}
\`\`\`

Recent conversation:
${conversationContext}

REMEMBER: ${questionInstruction}
**CRITICAL**: Format your question as "Question ${nextQuestionNum} of 3: [your question here]"
Example: "Question ${nextQuestionNum} of 3: What does this function do?"
**DO NOT REPEAT**: You must ask Question ${nextQuestionNum} next, NOT a previous question.
**NEVER RESTART**: You CANNOT ask Question 1 again after the student has answered. Always move forward: 1→2→3→FINAL_SCORE.
DO NOT DEVIATE FROM EVALUATION MODE. You are an evaluator, not a tutor.`
        }
      } else if (mode === "pseudocode") {
        // Follow-up question about existing pseudocode
        const pseudocodeContext = initialMessage 
          ? `\n\nCONTEXT - Initial Pseudocode Response:\n${initialMessage.substring(0, 1000)}${initialMessage.length > 1000 ? '...' : ''}\n\n`
          : ""
        
        // If there's code in the editor, include it for context
        const codeContext = code && code.trim() && code.trim().length > 10
          ? `\n\nStudent's Code:\n\`\`\`${language}\n${code.substring(0, 500)}\n\`\`\`\n\n`
          : ""
        
        systemContext = `You are helping a student understand pseudocode, algorithms, and flow diagrams.

CRITICAL: NEVER write actual code implementations. Focus on pseudocode concepts, algorithm steps, and flow diagrams.

${pseudocodeContext}${codeContext}Recent conversation:
${conversationContext}

The student is asking a follow-up question about the pseudocode, algorithm, flow diagram, or related concepts. Answer their question clearly and help them understand. Reference the pseudocode, algorithm steps, or flow diagram when relevant.`
      } else if (mode === "explain") {
        // Explain mode - use code from editor if available, otherwise from conversation
        const codeToExplain = code && code.trim() && code.trim().length > 10 ? code : 
          (input.includes("{") || input.includes(";") ? input : null)
        
        systemContext = `You are helping a student understand their ${language} code. 

CRITICAL: NEVER write complete code solutions. Only explain, guide, and teach concisely.

${codeToExplain ? `Current code:\n\`\`\`${language}\n${codeToExplain.substring(0, 1000)}\n\`\`\`\n\n` : ""}Recent conversation:
${conversationContext}

Continue the conversation naturally. Keep responses concise and visual. If they ask for code, guide them instead.`
      } else if (mode === "debug") {
        // Debug mode - use code from editor if available
        const codeToDebug = code && code.trim() && code.trim().length > 10 ? code : 
          (input.includes("{") || input.includes(";") ? input : null)
        
        systemContext = `You are helping a student debug their ${language} code. 

CRITICAL: NEVER write complete fixed code. Guide them to find and fix errors themselves.

${codeToDebug ? `Current code:\n\`\`\`${language}\n${codeToDebug.substring(0, 1000)}\n\`\`\`\n\n` : ""}Recent conversation:
${conversationContext}

Help them identify errors and guide them to fix them. Use visual indicators and ask guiding questions.`
      } else if (mode === "improve") {
        // Improve mode - use code from editor if available
        const codeToImprove = code && code.trim() && code.trim().length > 10 ? code : 
          (input.includes("{") || input.includes(";") ? input : null)
        
        systemContext = `You are helping a student improve their ${language} code. 

CRITICAL: NEVER write complete improved code. Guide them to improve it themselves.

${codeToImprove ? `Current code:\n\`\`\`${language}\n${codeToImprove.substring(0, 1000)}\n\`\`\`\n\n` : ""}Recent conversation:
${conversationContext}

Explain best practices and guide them to improve their code. Use visual comparisons and ask guiding questions.`
      } else {
        systemContext = `You are helping a student with their ${language} code. 

CRITICAL: NEVER write complete code solutions. Only explain, guide, and teach concisely.

${code && code.trim() && code.trim().length > 10 ? `Current code:\n\`\`\`${language}\n${code.substring(0, 1000)}\n\`\`\`\n\n` : ""}Recent conversation:
${conversationContext}

Continue the conversation naturally. Keep responses concise and visual. If they ask for code, guide them instead.`
      }

      // Build the full message with context
      // Include system instructions in the message since API has its own system prompt
      const fullMessage = `${systemContext}\n\nStudent: ${input}`
      
      if (!fullMessage.trim() || !input.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Please enter a message to continue the conversation.",
            timestamp: new Date(),
          },
        ])
        setIsLoading(false)
        return
      }
      
      // Create AbortController for timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      let response: Response | undefined
      let retryCount = 0
      const maxRetries = 2
      
      // Retry logic for network issues
      while (retryCount <= maxRetries) {
        try {
          response = await fetch("/api/ai-tutor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId,
              message: fullMessage,
              context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
            }),
            signal: controller.signal,
          })
          
          clearTimeout(timeoutId)
          
          if (response.ok) {
            break // Success, exit retry loop
          }
          
          const errorData = await response?.json().catch(() => ({ error: `HTTP ${response?.status || 'unknown'}` })) || { error: 'Unknown error' }
          
          if (retryCount < maxRetries) {
            const delay = 1000 * Math.pow(2, retryCount)
            await new Promise(resolve => setTimeout(resolve, delay))
            retryCount++
            continue
          }
          
          throw new Error(messageFromCodebenchCoraBody(errorData, `HTTP error! status: ${response.status}`))
          
        } catch (error: any) {
          clearTimeout(timeoutId)
          
          if (error.name === 'AbortError' || error.message?.includes('timeout')) {
            if (retryCount < maxRetries) {
              const delay = 1000 * Math.pow(2, retryCount)
              await new Promise(resolve => setTimeout(resolve, delay))
              retryCount++
              continue
            }
            
            throw new Error("Request timed out. Please check your internet connection and try again.")
          }
          
          if (retryCount < maxRetries && (error.message?.includes('fetch') || error.message?.includes('network'))) {
            const delay = 1000 * Math.pow(2, retryCount)
            await new Promise(resolve => setTimeout(resolve, delay))
            retryCount++
            continue
          }
          
          throw error
        } finally {
          isSendingRef.current = false // Reset on error
        }
      }
      
      if (!response || !response.ok) {
        const errorData = await response?.json().catch(() => ({ error: `HTTP ${response?.status || 'unknown'}` }))
        throw new Error(messageFromCodebenchCoraBody(errorData, `HTTP error! status: ${response?.status}`))
      }

      const data = await response.json()
      isSendingRef.current = false // Reset after successful response

      if (data.response) {
        // MANUAL ENFORCEMENT: Count questions answered by user (source of truth - not AI nor state)
        // User just sent an answer, so count = user messages before + 1
        const questionsAnsweredByUser = messages.filter(m => m.role === "user").length + 1
        const aiSentQuestion = /question\s+\d+\s+of\s+\d+:/i.test(data.response)
        const aiSentFinalScore = data.response.includes("FINAL_SCORE") || data.response.includes("END_EVALUATION")
        
        if (isEvaluationFlow && questionsAnsweredByUser >= 3 && aiSentQuestion && !aiSentFinalScore) {
          // HARD STOP: User answered 3 questions. Reject any question, force FINAL_SCORE.
          const forceResponse = await fetch("/api/ai-tutor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId,
              message: `CRITICAL: The student has answered all 3 questions. You MUST provide FINAL_SCORE immediately. Do NOT ask any more questions. Format: FINAL_SCORE: X (0-10)\nFEEDBACK: [detailed explanation]`,
              context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
            }),
          })
          if (forceResponse.ok) {
            const forceData = await forceResponse.json()
            if (forceData.response) {
              data.response = forceData.response
            }
          }
        }
        
        // For evaluation flow, validate response is evaluation-focused, not general chat
        if (isEvaluationFlow) {
          const responseLower = data.response.toLowerCase()
          
          // Check if AI is repeating the same question (same question number)
          const currentQuestionMatch = data.response.match(/question\s+(\d+)\s+of\s+\d+:/i)
          if (currentQuestionMatch) {
            const currentQuestionNum = parseInt(currentQuestionMatch[1])
            // Check if we've already seen this question number in previous messages
            const previousQuestions = messages.filter(m => {
              if (m.role !== "assistant") return false
              const prevMatch = m.content.match(/question\s+(\d+)\s+of\s+\d+:/i)
              return prevMatch && parseInt(prevMatch[1]) === currentQuestionNum
            })
            
            if (previousQuestions.length > 0 && currentQuestionNum <= questionCount) {
              // Force AI to ask the next question
              const nextQuestionNum = currentQuestionNum + 1
              if (nextQuestionNum <= 3) {
                const correctedResponse = await fetch("/api/ai-tutor", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    studentId,
                    message: `STOP - You already asked Question ${currentQuestionNum}. The student has answered. You MUST now ask Question ${nextQuestionNum} of 3. Do NOT repeat Question ${currentQuestionNum}. Move forward to the next question.`,
                    context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
                  }),
                })
                
                if (correctedResponse.ok) {
                  const correctedData = await correctedResponse.json()
                  if (correctedData.response) {
                    data.response = correctedData.response
                  }
                }
              } else {
                // Should provide final score instead
                const correctedResponse = await fetch("/api/ai-tutor", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    studentId,
                    message: `STOP - You have already asked 3 questions. You MUST provide FINAL_SCORE immediately. Format: FINAL_SCORE: X\nFEEDBACK: [explanation]`,
                    context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
                  }),
                })
                
                if (correctedResponse.ok) {
                  const correctedData = await correctedResponse.json()
                  if (correctedData.response) {
                    data.response = correctedData.response
                  }
                }
              }
            }
          }
          
          // Check if AI is trying to act like a tutor/chatbot instead of evaluator
          const isGeneralChat = (
            responseLower.includes("let me help") ||
            responseLower.includes("i can help") ||
            responseLower.includes("here's how") ||
            responseLower.includes("let me explain") ||
            responseLower.includes("i'll explain") ||
            (responseLower.includes("here") && responseLower.includes("example")) ||
            (responseLower.includes("let's") && !responseLower.includes("question"))
          ) && !responseLower.includes("question") && !responseLower.includes("evaluate")
          
          if (isGeneralChat) {
            // Force it back to evaluation mode
            const correctedResponse = await fetch("/api/ai-tutor", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                studentId,
                message: `STOP - You are an EVALUATOR, not a tutor. You must ask evaluation questions only. Do NOT provide explanations or tutorials. Ask a question about the student's code comprehension.`,
                context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
              }),
            })
            
            if (correctedResponse.ok) {
              const correctedData = await correctedResponse.json()
              if (correctedData.response) {
                data.response = correctedData.response
              }
            }
          }
        }
        
        // SINGLE SOURCE OF TRUTH: Use currentQuestion to validate
        if (isEvaluationFlow) {
          // Block if currentQuestion >= 4 (all questions answered) and no FINAL_SCORE
          if (currentQuestion >= 4 && !data.response.includes("FINAL_SCORE") && !data.response.includes("END_EVALUATION")) {
            // Check if response contains FINAL_SCORE, if not force it
            if (!data.response.includes("FINAL_SCORE") && !data.response.includes("END_EVALUATION")) {
              const forceScoreMessage = `CRITICAL STOP - Evaluation is complete. You have already asked 3 questions. You MUST provide FINAL_SCORE immediately.

Format:
FINAL_SCORE: X (where X is 0-10)
FEEDBACK: [detailed explanation]
END_EVALUATION`
              
              const forceResponse = await fetch("/api/ai-tutor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  studentId,
                  message: forceScoreMessage,
                  context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
                }),
              })
              
              if (forceResponse.ok) {
                const forceData = await forceResponse.json()
                if (forceData.response) {
                  const forceAssistantMessage: Message = {
                    role: "assistant",
                    content: forceData.response,
                    timestamp: new Date(),
                  }
                  setMessages((prev) => [...prev, forceAssistantMessage])
                }
              }
            }
            // Don't return if response contains FINAL_SCORE - we need to process it
            if (!data.response.includes("FINAL_SCORE") && !data.response.includes("END_EVALUATION")) {
              return // Only return if no FINAL_SCORE in response
            }
            // If response has FINAL_SCORE, continue processing it below
          }
          
        }
        
        const assistantMessage: Message = {
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
        }
        
        // CRITICAL: Check for duplicate questions FIRST, before any other processing
        const detectedQuestionNum = getQuestionNumber(assistantMessage.content)
        
        // CRITICAL: Check if this exact message content was already added (prevents duplicate renders)
        // Use a hash of the first 150 chars to identify duplicates
        const messageContentHash = assistantMessage.content.trim().substring(0, 150).toLowerCase()
        
        // Check both in messages state AND in pending messages ref (catches async duplicates)
        const alreadyInMessages = messages.some(m => 
          m.role === "assistant" && 
          !m.content.includes("FINAL_SCORE") &&
          m.content.trim().substring(0, 150).toLowerCase() === messageContentHash
        )
        
        const alreadyPending = pendingMessagesRef.current.has(messageContentHash)
        
        if (alreadyInMessages || alreadyPending) {
          setIsLoading(false)
          return
        }
        
        // Mark this message as pending
        pendingMessagesRef.current.add(messageContentHash)
        
        // CRITICAL: Block questions that don't match currentQuestion (SINGLE SOURCE OF TRUTH)
        if (isEvaluationFlow && !evaluationCompleted) {
          // If currentQuestion >= 4, all questions answered - force FINAL_SCORE
          if (currentQuestion >= 4 && detectedQuestionNum !== null) {
            setIsLoading(false)
            // Force FINAL_SCORE immediately
            const forceScoreResponse = await fetch("/api/ai-tutor", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                studentId,
                message: `CRITICAL: The student has answered Question 3 of 3. You MUST provide FINAL_SCORE immediately. Do NOT ask any more questions. Format your response EXACTLY as:\n\nFINAL_SCORE: X\nFEEDBACK: [detailed explanation]`,
                context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
              }),
            })
            
            if (forceScoreResponse.ok) {
              const forceData = await forceScoreResponse.json()
              if (forceData.response) {
                const forcedScoreMatch = forceData.response.match(/FINAL_SCORE:\s*([0-9.]+)/i)
                const forcedFeedbackMatch = forceData.response.match(/FEEDBACK:\s*([^\n]+(?:\n(?!FINAL_SCORE)[^\n]+)*)/i)
                
                if (forcedScoreMatch && onComplete) {
                  const score = parseFloat(forcedScoreMatch[1])
                  const normalizedScore = Math.max(0, Math.min(10, score))
                  const feedback = forcedFeedbackMatch ? forcedFeedbackMatch[1].trim() : "Evaluation completed"
                  
                    setCurrentQuestion(4)
                    setEvaluationCompleted(true)
                  setEvaluationScore(normalizedScore)
                  setEvaluationFeedback(feedback)
                  
                  const feedbackMessage = feedback.replace(/FINAL_SCORE:\s*[0-9.]+/gi, '').trim()
                  if (feedbackMessage) {
                    setMessages((prev) => [...prev, {
                      role: "assistant",
                      content: feedbackMessage,
                      timestamp: new Date(),
                    }])
                  }
                  
                  setTimeout(() => {
                    setShowScoreDisplay(true)
                    onComplete(normalizedScore, feedback)
                  }, 500)
                  
                  return
                }
              }
            }
            return
          }
        }
        
        // CRITICAL: Block questions that don't match nextQuestion (use nextQuestion, not currentQuestion!)
        // nextQuestion is calculated above and reflects the updated value immediately
        if (isEvaluationFlow && !evaluationCompleted && detectedQuestionNum !== null) {
          // Block if AI asks wrong question number - MUST use nextQuestion, not currentQuestion!
          // HARD BLOCK: Reject "Question 1" when we've already passed it (prevents restart loop)
          if (detectedQuestionNum !== nextQuestion || (detectedQuestionNum === 1 && nextQuestion > 1)) {
            setIsLoading(false)
            return // Don't add wrong question
          }
          
          // When nextQuestion = 4, only allow FINAL_SCORE responses (block any questions)
          if (nextQuestion === 4) {
            const hasFinalScore = data.response.includes("FINAL_SCORE") || data.response.includes("END_EVALUATION")
            if (!hasFinalScore && detectedQuestionNum !== null) {
              setIsLoading(false)
              return
            }
          }
        }
        
        // CRITICAL: After Question 3 is asked, stop and wait for user response
        if (isEvaluationFlow && detectedQuestionNum === 3 && nextQuestion === 3 && !evaluationCompleted) {
          // Question 3 is being added - add it and STOP, wait for user answer
          setMessages((prev) => [...prev, assistantMessage])
          setIsLoading(false)
          return // Stop here - wait for user to answer Question 3
        }
        
        // FINAL duplicate check right before adding to state - catch any that slipped through
        if (detectedQuestionNum !== null && isEvaluationFlow) {
          const questionText = assistantMessage.content.trim()
          const isDuplicate = messages.some(m => {
            if (m.role !== "assistant" || m.content.includes("FINAL_SCORE")) return false
            const qNum = getQuestionNumber(m.content)
            if (qNum === detectedQuestionNum) {
              // Check if content is identical or very similar
              const existingText = m.content.trim()
              if (questionText === existingText) return true
              // Check first 50 chars for similarity (catches near-duplicates)
              if (questionText.length > 20 && existingText.length > 20) {
                const questionStart = questionText.substring(0, Math.min(50, questionText.length)).toLowerCase()
                const existingStart = existingText.substring(0, Math.min(50, existingText.length)).toLowerCase()
                if (questionStart === existingStart) return true
              }
            }
            return false
          })
          
          if (isDuplicate) {
            setIsLoading(false)
            return
          }
        }
        
        setMessages((prev) => {
          // Final check using the latest state AND pending ref
          const messageContentHash = assistantMessage.content.trim().substring(0, 150).toLowerCase()
          const isDuplicate = prev.some(m => {
            if (m.role !== "assistant" || m.content.includes("FINAL_SCORE")) return false
            const existingHash = m.content.trim().substring(0, 150).toLowerCase()
            return existingHash === messageContentHash
          })
          
          const isPending = pendingMessagesRef.current.has(messageContentHash)
          
          if (isDuplicate || isPending) {
            // Remove from pending since we're not adding it
            pendingMessagesRef.current.delete(messageContentHash)
            return prev // Don't add duplicate
          }
          
          // Remove from pending since we're adding it successfully
          pendingMessagesRef.current.delete(messageContentHash)
          return [...prev, assistantMessage]
        })
        
        // Award XP for tutor questions (only for tutor mode, not for first message or evaluation modes)
        if (mode === "tutor" && messages.length > 0 && input.trim()) {
          const earnedXP = awardXP("TUTOR_QUESTION")
          toast({
            title: "AI Response",
            description: `+${earnedXP} XP for asking a question`,
          })
        }

        // Check if this is evaluation completion
        if (mode === "evaluate" || mode === "practice") {
          // Save student's answer
          const lastUserMessage = messages[messages.length - 1]
          if (lastUserMessage && lastUserMessage.role === "user") {
            setEvaluationResponses(prev => [...prev, {
              question: messages[messages.length - 2]?.content || "Question",
              answer: lastUserMessage.content,
              timestamp: new Date()
            }])
          }

          // For evaluation flow, count questions and enforce limit
          if (isEvaluationFlow) {
            // Count questions asked (including the one just received)
            // STRICT: Only count messages with exact "Question X of 3:" format
            const allMessages = [...messages, assistantMessage]
            
            // Track which question numbers have been asked (to prevent duplicates and out-of-order)
            const askedQuestionNumbers = new Set<number>()
            let questionsAsked = 0 // Declare at block scope
            const questionsList = allMessages
              .filter(m => {
                if (m.role !== "assistant" || m.content.includes("FINAL_SCORE")) return false
                const content = m.content.trim()
                const strictQuestionPattern = /^.*?question\s+(\d+)\s+of\s+(\d+):/i
                const match = content.match(strictQuestionPattern)
                if (match) {
                  const questionNum = parseInt(match[1])
                  const totalNum = parseInt(match[2])
                  return questionNum > 0 && questionNum <= totalNum && 
                         !content.toLowerCase().includes("reminder") &&
                         !content.toLowerCase().includes("error") &&
                         !content.toLowerCase().includes("feedback:") &&
                         !content.toLowerCase().includes("final_score")
                }
                return false
              })
              .map(m => {
                const match = m.content.match(/question\s+(\d+)\s+of\s+(\d+):/i)
                return match ? parseInt(match[1]) : null
              })
              .filter((num): num is number => num !== null)
            
            // Track unique question numbers asked
            questionsList.forEach(num => askedQuestionNumbers.add(num))
            questionsAsked = askedQuestionNumbers.size // Update the variable, don't redeclare
            
            // Check if current response contains a question
            const currentQuestionMatch = data.response.match(/question\s+(\d+)\s+of\s+(\d+):/i)
            const currentQuestionNum = currentQuestionMatch ? parseInt(currentQuestionMatch[1]) : null
            
            // BLOCK: If trying to ask a question that was already asked
            if (currentQuestionNum !== null && askedQuestionNumbers.has(currentQuestionNum)) {
              
              // If we've asked 3 unique questions, force final score
              if (questionsAsked >= 3) {
                // Force final score immediately
                const cleanedResponse = data.response.replace(/question\s+\d+\s+of\s+\d+:.*/gi, '').trim()
                const blockedMessage: Message = {
                  role: "assistant",
                  content: cleanedResponse + "\n\n⚠️ You have already asked 3 questions. Providing FINAL_SCORE now.",
                  timestamp: new Date(),
                }
                setMessages((prev) => [...prev, blockedMessage])
                
                // Force final score request
                setTimeout(async () => {
                  const forceScoreMessage = `STOP - You have already asked 3 unique questions (${Array.from(askedQuestionNumbers).sort().join(', ')}). You MUST provide FINAL_SCORE immediately. Do NOT ask any more questions.

Format:
FINAL_SCORE: X (where X is 0-10)
FEEDBACK: [detailed explanation]`
                  
                  const forceResponse = await fetch("/api/ai-tutor", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      studentId,
                      message: forceScoreMessage,
                      context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
                    }),
                  })
                  
                  if (forceResponse.ok) {
                    const forceData = await forceResponse.json()
                    if (forceData.response) {
                      const forceAssistantMessage: Message = {
                        role: "assistant",
                        content: forceData.response,
                        timestamp: new Date(),
                      }
                      setMessages((prev) => [...prev, forceAssistantMessage])
                    }
                  }
                }, 500)
                
                return // Don't add the duplicate question
              } else {
                // Force next question number
                const nextQuestionNum = Math.max(...Array.from(askedQuestionNumbers)) + 1
                if (nextQuestionNum <= 3) {
                  const correctedResponse = await fetch("/api/ai-tutor", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      studentId,
                      message: `STOP - You already asked Question ${currentQuestionNum}. You must ask Question ${nextQuestionNum} of 3 next. Do NOT repeat questions.`,
                      context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
                    }),
                  })
                  
                  if (correctedResponse.ok) {
                    const correctedData = await correctedResponse.json()
                    if (correctedData.response) {
                      data.response = correctedData.response
                    }
                  }
                }
              }
            }
            
            // BLOCK: If trying to ask a question out of order (e.g., Question 2 after Question 3)
            if (currentQuestionNum !== null && askedQuestionNumbers.size > 0) {
              const maxAsked = Math.max(...Array.from(askedQuestionNumbers))
              if (currentQuestionNum < maxAsked) {
                const nextQuestionNum = maxAsked + 1
                if (nextQuestionNum <= 3) {
                  const correctedResponse = await fetch("/api/ai-tutor", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      studentId,
                      message: `STOP - You cannot go backwards. You already asked Question ${maxAsked}. You must ask Question ${nextQuestionNum} of 3 next.`,
                      context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
                    }),
                  })
                  
                  if (correctedResponse.ok) {
                    const correctedData = await correctedResponse.json()
                    if (correctedData.response) {
                      data.response = correctedData.response
                    }
                  }
                } else {
                  // Should provide final score
                  const correctedResponse = await fetch("/api/ai-tutor", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      studentId,
                      message: `STOP - You have already asked 3 questions. You MUST provide FINAL_SCORE immediately. Format: FINAL_SCORE: X\nFEEDBACK: [explanation]`,
                      context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
                    }),
                  })
                  
                  if (correctedResponse.ok) {
                    const correctedData = await correctedResponse.json()
                    if (correctedData.response) {
                      data.response = correctedData.response
                    }
                  }
                }
              }
            }
            
            // HARD STOP: If we've already asked 3 unique questions, reject any new questions
            if (askedQuestionNumbers.size >= 3 && currentQuestionNum !== null) {
              // Check if final score already exists
              const hasFinalScore = allMessages.some(m => m.content.includes("FINAL_SCORE"))
              
              if (!hasFinalScore) {
                // Remove the question and force final score instead
                const cleanedResponse = data.response.replace(/question\s+\d+\s+of\s+\d+:.*/gi, '').trim()
                const blockedMessage: Message = {
                  role: "assistant",
                  content: cleanedResponse + "\n\n⚠️ You have already asked 3 questions. Providing FINAL_SCORE now.",
                  timestamp: new Date(),
                }
                setMessages((prev) => [...prev, blockedMessage])
                
                // Force final score request
                setTimeout(async () => {
                  const forceScoreMessage = `STOP - You have already asked 3 unique questions (${Array.from(askedQuestionNumbers).sort().join(', ')}). You MUST provide FINAL_SCORE immediately. Do NOT ask any more questions.

Format:
FINAL_SCORE: X (where X is 0-10)
FEEDBACK: [detailed explanation]`
                  
                  const forceResponse = await fetch("/api/ai-tutor", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      studentId,
                      message: forceScoreMessage,
                      context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
                    }),
                  })
                  
                  if (forceResponse.ok) {
                    const forceData = await forceResponse.json()
                    if (forceData.response) {
                      const forceAssistantMessage: Message = {
                        role: "assistant",
                        content: forceData.response,
                        timestamp: new Date(),
                      }
                      setMessages((prev) => [...prev, forceAssistantMessage])
                    }
                  }
                }, 500)
              }
              
              return // Don't add the blocked question
            }
            
            // Update question count and track last question time
            setQuestionCount(askedQuestionNumbers.size)
            setTotalQuestions(3)
            setLastQuestionTime(Date.now())
            
            // Check if AI already provided final score in this response
            const finalScoreMatch = data.response.match(/FINAL_SCORE:\s*([0-9.]+)/i)
            
            // Also check if AI is trying to ask a question when we've already asked 3
            const hasQuestionPattern = /question\s+(\d+)\s+of\s+(\d+):/i.test(data.response)
            if (hasQuestionPattern && askedQuestionNumbers.size >= 3) {
              // Extract question number to see if it's > 3
              const questionMatch = data.response.match(/question\s+(\d+)\s+of\s+(\d+):/i)
              if (questionMatch) {
                const questionNum = parseInt(questionMatch[1])
                if (questionNum > 3) {
                  // Block this question and force final score
                  const cleanedResponse = data.response.replace(/question\s+\d+\s+of\s+\d+:.*/gi, '').trim()
                  const blockedMessage: Message = {
                    role: "assistant",
                    content: cleanedResponse + "\n\n⚠️ You have already asked 3 questions. Please provide FINAL_SCORE now.",
                    timestamp: new Date(),
                  }
                  setMessages((prev) => [...prev, blockedMessage])
                  setIsLoading(false)
                  
                  // Force final score
                  setTimeout(async () => {
                    const forceScoreMessage = `STOP - You have asked 3 questions. Provide FINAL_SCORE immediately.`
                    
                    const forceResponse = await fetch("/api/ai-tutor", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        studentId,
                        message: forceScoreMessage,
                        context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
                      }),
                    })
                    
                    if (forceResponse.ok) {
                      const forceData = await forceResponse.json()
                      if (forceData.response) {
                        const forceAssistantMessage: Message = {
                          role: "assistant",
                          content: forceData.response,
                          timestamp: new Date(),
                        }
                        setMessages((prev) => [...prev, forceAssistantMessage])
                      }
                    }
                  }, 500)
                  
                  return
                }
              }
            }
            
            // If AI sent FINAL_SCORE but we haven't asked 3 questions yet, reject it and force next question
            const questionsAskedCount = askedQuestionNumbers.size
            if (finalScoreMatch && questionsAskedCount < 3) {
              // Remove FINAL_SCORE from the message and add instruction to ask next question
              const cleanedResponse = data.response.replace(/FINAL_SCORE:\s*[0-9.]+/gi, '').replace(/FEEDBACK:\s*.*/gi, '').trim()
              
              // Add a message telling AI to ask the next question
              const nextQuestionNum = questionsAskedCount + 1
              const reminderMessage = `\n\n⚠️ REMINDER: You must ask question ${nextQuestionNum} of 3 before providing the final score. Please ask question ${nextQuestionNum} now.`
              
              const correctedMessage: Message = {
                role: "assistant",
                content: cleanedResponse + reminderMessage,
                timestamp: new Date(),
              }
              
              setMessages((prev) => [...prev, correctedMessage])
              setIsLoading(false)
              
              // Automatically send a follow-up to force the next question
              setTimeout(async () => {
                const practiceContext = practiceProblem 
                  ? `Practice Problem: ${practiceProblem.problem}\nStudent's solution:\n\`\`\`${language}\n${code}\n\`\`\``
                  : ""
                
                const forceQuestionMessage = `You have asked ${questionsAskedCount} question(s) so far. You MUST ask question ${nextQuestionNum} of 3 now. 

${practiceContext}

Do NOT provide FINAL_SCORE yet. Ask question ${nextQuestionNum} of 3.`
                
                const forceResponse = await fetch("/api/ai-tutor", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    studentId,
                    message: forceQuestionMessage,
                    context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
                  }),
                })
                
                if (forceResponse.ok) {
                  const forceData = await forceResponse.json()
                  if (forceData.response) {
                    const forceAssistantMessage: Message = {
                      role: "assistant",
                      content: forceData.response,
                      timestamp: new Date(),
                    }
                    setMessages((prev) => [...prev, forceAssistantMessage])
                  }
                }
              }, 500)
              
              return
            }
            
            // HARD STOP: If we've asked 3 or more questions, force final score and prevent more questions
            if (askedQuestionNumbers.size >= 3 && !finalScoreMatch) {
              // Check if student just answered question 3
              const lastUserMessage = messages[messages.length - 1]
              if (lastUserMessage && lastUserMessage.role === "user") {
                // Student answered question 3, force final score immediately
                setTimeout(async () => {
                  const practiceContext = practiceProblem 
                    ? `Practice Problem: ${practiceProblem.problem}\nStudent's solution:\n\`\`\`${language}\n${code}\n\`\`\``
                    : ""
                  
                  const forceScoreMessage = `STOP - You have asked 3 questions and the student has answered all 3. You MUST now provide the final score immediately.

${practiceContext}

Format your response as:
FINAL_SCORE: X (where X is 0-10)
FEEDBACK: [detailed explanation of scoring]

Provide the final score NOW. Do NOT ask any more questions.`
                  
                  const forceResponse = await fetch("/api/ai-tutor", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      studentId,
                      message: forceScoreMessage,
                      context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
                    }),
                  })
                  
                  if (forceResponse.ok) {
                    const forceData = await forceResponse.json()
                    if (forceData.response) {
                      const forceAssistantMessage: Message = {
                        role: "assistant",
                        content: forceData.response,
                        timestamp: new Date(),
                      }
                      setMessages((prev) => [...prev, forceAssistantMessage])
                      
                      // Check for final score in forced response
                      const forcedScoreMatch = forceData.response.match(/FINAL_SCORE:\s*([0-9.]+)/i)
                      const forcedFeedbackMatch = forceData.response.match(/FEEDBACK:\s*([^\n]+(?:\n(?!FINAL_SCORE)[^\n]+)*)/i)
                      
                      if (forcedScoreMatch && onComplete && !isSubmitting) {
                        const score = parseFloat(forcedScoreMatch[1])
                        const normalizedScore = Math.max(0, Math.min(10, score))
                        const feedback = forcedFeedbackMatch ? forcedFeedbackMatch[1].trim() : "Evaluation completed"
                        
                        // Add feedback message to chat first
                        const feedbackMessage = feedback.replace(/FINAL_SCORE:\s*[0-9.]+/gi, '').trim()
                        if (feedbackMessage && feedbackMessage.length > 0) {
                          setMessages((prev) => [
                            ...prev,
                            {
                              role: "assistant",
                              content: feedbackMessage,
                              timestamp: new Date(),
                            },
                          ])
                        }
                        
                        setEvaluationScore(normalizedScore)
                        setEvaluationFeedback(feedback)
                        
                        // Mark evaluation as complete to prevent further questions
                        setIsComplete(true)
                        
                        // Show ScoreDisplay after feedback
                        setTimeout(() => {
                          setShowScoreDisplay(true)
                          if (mode === "practice" || mode === "evaluate") {
                            onComplete(normalizedScore, feedback)
                          }
                        }, 500)
                      }
                    }
                  }
                }, 1000)
              }
            }
          }

          const finalScoreMatch = data.response.match(/FINAL_SCORE:\s*([0-9.]+)/i)
          const feedbackMatch = data.response.match(/FEEDBACK:\s*([^\n]+(?:\n(?!FINAL_SCORE)[^\n]+)*)/i)
          
          // CRITICAL: If Question 3 was answered but response doesn't contain FINAL_SCORE, force it
          if (mode === "practice" && isEvaluation && !finalScoreMatch && !evaluationCompleted && currentQuestion >= 4) {
            // Check if the user message we just sent was answering Question 3
            const lastAssistantBeforeUser = messages.filter(m => m.role === "assistant" && !m.content.includes("FINAL_SCORE")).slice(-1)[0]
            const lastQ3 = lastAssistantBeforeUser?.content.match(/question\s+3\s+of\s+3:/i)
            const lastUserMsg = messages.filter(m => m.role === "user").slice(-1)[0]
            const studentAnsweredQ3 = lastQ3 && lastUserMsg && lastUserMsg.timestamp > (lastAssistantBeforeUser?.timestamp || new Date(0))
            
            // Count unique questions asked
            const askedQuestionNumbers = new Set<number>()
            const allMessagesWithNew = [...messages, assistantMessage]
            allMessagesWithNew.forEach(m => {
              if (m.role === "assistant" && !m.content.includes("FINAL_SCORE")) {
                const qNum = getQuestionNumber(m.content)
                if (qNum !== null) {
                  askedQuestionNumbers.add(qNum)
                }
              }
            })
            const questionsAsked = askedQuestionNumbers.size
            
            // Check if student just answered Question 3 OR if we've asked 3 questions
            if ((studentAnsweredQ3 && questionsAsked >= 3) || (questionsAsked >= 3 && currentQuestion >= 3)) {
              // Add the assistant message first
              setMessages((prev) => [...prev, assistantMessage])
              
              // Force FINAL_SCORE via another API call
              const forceScoreResponse = await fetch("/api/ai-tutor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  studentId,
                  message: `CRITICAL: The student has answered Question 3 of 3. You MUST provide FINAL_SCORE immediately. Do NOT ask any more questions. Format your response EXACTLY as:\n\nFINAL_SCORE: X\nFEEDBACK: [detailed explanation]`,
                  context: withCodebenchCoraContext({ topic: mode, ...(classroomSubmissionId ? { classroomSubmissionId } : {}) }),
                }),
              })
              
              if (forceScoreResponse.ok) {
                const forceData = await forceScoreResponse.json()
                if (forceData.response) {
                  const forcedScoreMatch = forceData.response.match(/FINAL_SCORE:\s*([0-9.]+)/i)
                  const forcedFeedbackMatch = forceData.response.match(/FEEDBACK:\s*([^\n]+(?:\n(?!FINAL_SCORE)[^\n]+)*)/i)
                  
                  if (forcedScoreMatch && onComplete) {
                    const score = parseFloat(forcedScoreMatch[1])
                    const normalizedScore = Math.max(0, Math.min(10, score))
                    const feedback = forcedFeedbackMatch ? forcedFeedbackMatch[1].trim() : "Evaluation completed"
                    
                    setCurrentQuestion(4)
                    setEvaluationCompleted(true)
                    setEvaluationScore(normalizedScore)
                    setEvaluationFeedback(feedback)
                    
                    const feedbackMessage = feedback.replace(/FINAL_SCORE:\s*[0-9.]+/gi, '').trim()
                    if (feedbackMessage) {
                      setMessages((prev) => [...prev, {
                        role: "assistant",
                        content: feedbackMessage,
                        timestamp: new Date(),
                      }])
                    }
                    
                    setTimeout(() => {
                      setShowScoreDisplay(true)
                      onComplete(normalizedScore, feedback)
                    }, 500)
                    
                    setIsLoading(false)
                    return
                  } else {
                    console.error("[AIChatInterface] ❌ Forced FINAL_SCORE missing or onComplete not available:", {
                      hasForcedScoreMatch: !!forcedScoreMatch,
                      hasOnComplete: !!onComplete,
                      forcedResponse: forceData.response?.substring(0, 200)
                    })
                  }
                }
              }
            }
          }
          
          // Add assistant message (if not already added in the force FINAL_SCORE logic above)
          setMessages((prev) => [...prev, assistantMessage])
          
          if (finalScoreMatch) {
            // Only process FINAL_SCORE if evaluation not already completed
            if (evaluationCompleted) {
              setIsLoading(false)
              return
            }
            
            // Only accept FINAL_SCORE if nextQuestion = 4 (all 3 questions asked and answered)
            if (mode === "practice" && nextQuestion !== 4) {
              setIsLoading(false)
              return
            }
            
            const score = parseFloat(finalScoreMatch[1])
            const normalizedScore = Math.max(0, Math.min(10, score))
            const feedback = feedbackMatch ? feedbackMatch[1].trim() : "Evaluation completed"
            
            // Mark evaluation as completed
            setCurrentQuestion(4)
            setEvaluationCompleted(true)
            
            // First, add the feedback message to chat (without FINAL_SCORE) so user sees it
            const feedbackMessage = feedback.replace(/FINAL_SCORE:\s*[0-9.]+/gi, '').trim()
            if (feedbackMessage && feedbackMessage.length > 0) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: feedbackMessage,
                  timestamp: new Date(),
                },
              ])
            }
            
            // Then set score and show ScoreDisplay after a brief delay to let feedback render
            setEvaluationScore(normalizedScore)
            setEvaluationFeedback(feedback)
            
            // Show ScoreDisplay after feedback is displayed (small delay to ensure feedback renders first)
            setTimeout(() => {
              setShowScoreDisplay(true)
            }, 500)
            
            // Call onComplete to notify parent components (PracticeGenerator/DailyChallenge)
            if (onComplete && !isSubmitting && !evaluationCompleted) {
              if (mode === "practice") {
                // Mark evaluation as complete FIRST to prevent further state updates
                setEvaluationCompleted(true)
                setIsComplete(true)
                // For practice mode, call onComplete so parent (PracticeGenerator/DailyChallenge) can show ScoreDisplay with submit button
                onComplete(normalizedScore, feedback)
              } else if (mode === "evaluate") {
                // Mark evaluation as complete to prevent further questions
                setIsComplete(true)
                // For evaluate mode, ScoreDisplay is shown in this component with submit button
                onComplete(normalizedScore, feedback)
              } else {
                // Mark evaluation as complete to prevent further questions
                setIsComplete(true)
                // For other modes, ScoreDisplay is shown in this component
              }
            }
            
            // Ensure evaluation is marked as completed
            if (!evaluationCompleted) {
                    setCurrentQuestion(4)
                    setEvaluationCompleted(true)
            }
          }
        }
      } else {
        const fallbackContent = data?.response?.trim()
          ? `Model returned unexpected format: ${data.response.substring(0, 200)}${data.response.length > 200 ? "…" : ""}`
          : "Model failed: empty or invalid response. Please try again."
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: fallbackContent,
            timestamp: new Date(),
          },
        ])
      }
    } catch (error) {
      console.error("Error sending message:", error)
      if (isCodebenchCoraMembershipError(error)) {
        onLockedCora?.("Cora in CodeBench")
        return
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Model failed: ${errorMessage}. Please try again.`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // Submit evaluation with retry logic and fallback
  const submitEvaluationWithRetry = async (score: number, feedback: string, maxRetries = 3) => {
    if (!code || !studentId) {
      console.error("Cannot submit: missing code or studentId")
      setIsSubmitting(false)
      toast({
        title: "Submission Error",
        description: "Missing required information. Please refresh and try again.",
        variant: "destructive",
      })
      return
    }

    // CRITICAL: For evaluate mode, require assignment selection before submission
    // The modal should have ensured selection, but double-check here
    if (mode === "evaluate" && isEvaluation) {
      // Assignment selection is handled by the modal - if we reach here without selection,
      // it means user explicitly chose "practice only" which is allowed
      // No additional validation needed as modal ensures selection
    }

    // CRITICAL: Prevent multiple simultaneous submissions
    if (isSubmitting) {
      console.warn("[AIChatInterface] Submission already in progress, ignoring duplicate call")
      return
    }

    setIsSubmitting(true)
    let lastError: Error | null = null
    let success = false
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        setRetryCount(attempt + 1)
        
        const assignmentId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get("assignmentId") : null
        // Prefer prop from parent (CodeBench assignment dropdown), else URL param
        const submissionId = classroomSubmissionId ?? (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get("submissionId") : null)
        
        console.log("[AIChatInterface] 📤 Submitting evaluation", {
          studentId,
          submissionId,
          assignmentId,
          score,
          hasFeedback: !!feedback
        })
        const response = await fetch("/api/codebench/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            assignmentId,
            submissionId: submissionId ? parseInt(submissionId, 10) : null,
            studentId,
            score,
            feedback: feedback || "Comprehension evaluation completed",
            evaluationResponses: evaluationResponses, // Include all Q&A pairs
          }),
        })

        if (!response.ok) {
          // Check if response is JSON or HTML
          const contentType = response.headers.get("content-type")
          let errorData
          if (contentType && contentType.includes("application/json")) {
            errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
          } else {
            // HTML error page - extract error message
            const text = await response.text().catch(() => "")
            errorData = { error: `HTTP ${response.status}: ${text.substring(0, 100)}` }
          }
          throw new Error(messageFromCodebenchCoraBody(errorData, `HTTP error! status: ${response.status}`))
        }

        // Check content type before parsing JSON
        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text()
          throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 200)}`)
        }

        const data = await response.json()

        if (data.success) {
          // Success! Clear saved data
          try {
            localStorage.removeItem(STORAGE_KEY)
            localStorage.removeItem(`${STORAGE_KEY}_backup`)
          } catch (e) {
            console.error("Failed to clear saved data:", e)
          }
          
          setRetryCount(0)
          
          // Show success message
          // Practice: 2.5 pts. Assignment: 2.5 (code) + (score/10)*2.5 (evaluation) = max 5
          const awardedPoints = data.pointsAwarded ?? data.evaluation?.pointsAwarded ?? (
            classroomSubmissionId
              ? 2.5 + (score / 10) * 2.5
              : 2.5
          )
          
          console.log("[AIChatInterface] ✅ Submission successful", { score, awardedPoints })
          
          toast({
            title: "Submission Successful!",
            description: classroomSubmissionId
              ? `Score: ${score.toFixed(1)}/10 - ${awardedPoints.toFixed(2)} points pending instructor approval.`
              : `${awardedPoints.toFixed(2)} points pending (practice).`,
          })
          
          // Call onComplete with success data for parent to show modal
          if (onComplete) {
            onComplete(score, feedback)
          }
          
          // Store success data for modal display (isAssignment = 2x multiplier applied)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('codebench-submission-success', {
              detail: { score, pointsAwarded: awardedPoints, isAssignment: !!classroomSubmissionId }
            }))
          }
          
          success = true
          return // Success, exit retry loop
        } else {
          console.error("[AIChatInterface] ❌ Submission failed:", data.error)
          throw new Error(data.error || "Submission failed")
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error")
        console.error(`Submission attempt ${attempt + 1} failed:`, lastError)
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
      }
    }

    // All retries failed - use fallback to award points anyway
    if (!success) {
      const fallbackSuccess = await submitFallbackPoints(score, feedback, lastError)
      
      if (!fallbackSuccess) {
        // Even fallback failed - ensure we still show completion
        setIsSubmitting(false)
        toast({
          title: "Submission Failed",
          description: lastError?.message || "Failed to submit. Please try again later.",
          variant: "destructive",
        })
        if (onComplete) {
          onComplete(score, feedback)
        }
      } else {
        // Fallback succeeded
        setIsSubmitting(false)
      }
    }
    // Note: If success was true, isSubmitting is already set to false above
  }

  // Fallback: Award points even if submission fails
  const submitFallbackPoints = async (score: number, feedback: string, error: Error | null): Promise<boolean> => {
    if (!code || !studentId) {
      console.error("Cannot submit fallback: missing code or studentId")
      setIsSubmitting(false)
      return false
    }

    try {
      // Try to create a pending point directly via classroom-points API
      const assignmentId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get("assignmentId") : null
      
      // Points calculation: 2.5 code submission (50%) + (score/10) * 2.5 evaluation (50%)
      const codeSubmissionPoints = 2.5
      const evaluationPoints = (score / 10) * 2.5
      const awardedPoints = codeSubmissionPoints + evaluationPoints
      
      // Get student info
      const studentResponse = await studentApiFetch(`/api/student/profile?studentId=${studentId}`)
      if (!studentResponse.ok) {
        throw new Error("Failed to fetch student profile")
      }
      const contentType = studentResponse.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Student profile API returned non-JSON response")
      }
      const studentData = await studentResponse.json()
      
      if (studentData.student) {
        // Ensure points are always > 0 to satisfy database constraint
        // Minimum is 2.5 (code submission) even if evaluation score is 0
        const finalPoints = Math.max(2.5, parseFloat(awardedPoints.toFixed(2)))

        const pointResponse = await studentApiFetch("/api/classroom-points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: studentData.student.id,
            points: finalPoints,
            reason: `Code Submission - Score: ${score.toFixed(1)}/10 - ${feedback || "Comprehension evaluation"} (Network issue fallback)`,
            category: "code_submission",
            session: studentData.student.section,
          }),
        })

        if (pointResponse.ok) {
          // Save to local storage as backup
          try {
            const backupData = {
              code,
              studentId,
              score,
              feedback,
              points: awardedPoints,
              timestamp: new Date().toISOString(),
              error: error?.message || "Network error",
              evaluationResponses,
            }
            localStorage.setItem(`${STORAGE_KEY}_backup`, JSON.stringify(backupData))
          } catch (e) {
            console.error("Failed to save backup:", e)
          }

          setIsSubmitting(false)
          setRetryCount(0)
          
          if (onComplete) {
            onComplete(score, feedback)
          }
          
          // Show success message with note about fallback
          toast({
            title: "Submitted Successfully! (Fallback Mode)",
            description: `Score: ${score.toFixed(1)}/10 - ${finalPoints.toFixed(2)} points (${codeSubmissionPoints} code submission + ${evaluationPoints.toFixed(2)} evaluation) pending approval. Note: Used fallback due to network issues.`,
          })
          
          return true // Success
        } else {
          throw new Error("Failed to create fallback points")
        }
      } else {
        throw new Error("Student data not found")
      }
    } catch (fallbackError) {
      console.error("Fallback submission also failed:", fallbackError)
      setIsSubmitting(false)
      
      // Save to localStorage as last resort
      try {
        // Points calculation: 2.5 code submission (50%) + (score/10) * 2.5 evaluation (50%)
        const codeSubmissionPoints = 2.5
        const evaluationPoints = (score / 10) * 2.5
        const totalPoints = codeSubmissionPoints + evaluationPoints
        
        const lastResortData = {
          code,
          studentId,
          score,
          feedback,
          points: totalPoints,
          timestamp: new Date().toISOString(),
          error: error?.message || "Complete submission failure",
          evaluationResponses,
          needsManualReview: true,
        }
        localStorage.setItem(`${STORAGE_KEY}_manual`, JSON.stringify(lastResortData))
      } catch (e) {
        console.error("Failed to save manual review data:", e)
      }
      
      // Show error but don't lose the score
      const codeSubmissionPoints = 2.5
      const evaluationPoints = (score / 10) * 2.5
      const totalPoints = codeSubmissionPoints + evaluationPoints
      
      toast({
        title: "Submission Saved Locally",
        description: `Your submission was saved locally. Score: ${score.toFixed(1)}/10, Points: ${totalPoints.toFixed(2)} (${codeSubmissionPoints} code submission + ${evaluationPoints.toFixed(2)} evaluation). Please contact your instructor to manually award points.`,
        variant: "destructive",
      })
      
      // Still call onComplete so UI updates
      if (onComplete) {
        onComplete(score, feedback)
      }
      
      return false // Failed but saved locally
    }
  }

  const ct = codebenchChatTheme(isLight)

  return (
    <div className={cn("flex h-full min-h-0 flex-col", ct.root)}>
      {!hideHeader ? (
      <div className={cn("shrink-0 border-b px-3 py-2.5 sm:px-4", ct.header)}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 shrink-0 items-center justify-center">
            <CoraBotMark size="sm" idle decorative />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={cn("text-sm font-bold", ct.headerTitle)}>{CORA_NAME}</h3>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", ct.modeBadge)}>
                {mode}
              </span>
            </div>
            <p className={cn("mt-0.5 truncate text-xs", ct.headerSubtitle)}>
              {isEvaluation ? "Answer each question thoughtfully" : "Ask follow-ups about your code"}
            </p>
          </div>
          {mode === "explain" && replaySteps.length > 0 && onToggleReplay && !showReplay ? (
            <button
              type="button"
              onClick={onToggleReplay}
              className="shrink-0 rounded-full border border-[#eaaa00]/30 bg-[#eaaa00]/10 px-3 py-1.5 text-xs font-semibold text-[#eaaa00]"
            >
              ▶ Replay
            </button>
          ) : null}
        </div>
      </div>
      ) : mode === "explain" && replaySteps.length > 0 && onToggleReplay && !showReplay ? (
        <div className={cn("flex shrink-0 justify-end border-b px-2.5 py-1", ct.header)}>
          <button
            type="button"
            onClick={onToggleReplay}
            className="shrink-0 rounded-full border border-[#eaaa00]/30 bg-[#eaaa00]/10 px-3 py-1 text-xs font-semibold text-[#eaaa00]"
          >
            ▶ Replay
          </button>
        </div>
      ) : null}

      {/* Messages */}
      <div
        ref={chatContainerRef}
        className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:p-4 [scrollbar-gutter:stable]", ct.messages)}
      >
        {isInitializing ? (
          <div className="flex h-full items-center justify-center p-3">
            <CoraThinkingIndicator
              mode={resolvedThinkingMode}
              theme={isLight ? "light" : "dark"}
              className="w-full max-w-md"
            />
          </div>
        ) : messages.length === 0 && showWorkingState ? (
          <div className="flex h-full items-center justify-center p-3">
            <CoraThinkingIndicator
              mode={resolvedThinkingMode}
              theme={isLight ? "light" : "dark"}
              className="w-full max-w-md"
            />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <CoraBotMark size="lg" idle className="mb-4" decorative />
            <p className={cn("text-sm font-semibold", ct.emptyTitle)}>Ready when you are</p>
            <p className={cn("mt-1 max-w-xs text-xs leading-relaxed", ct.emptySubtitle)}>
              Tap a tool above or type a question about your code.
            </p>
          </div>
        ) : (
          messages
            .filter((message) => {
              // Hide messages that contain FINAL_SCORE or FEEDBACK - we'll show ScoreDisplay instead
              if (message.content.includes("FINAL_SCORE") || (message.content.includes("FEEDBACK:") && message.content.includes("FINAL_SCORE"))) {
                return false
              }
              return true
            })
            .map((message, i) => (
              <CodebenchCoraMessage
                key={i}
                role={message.role}
                content={message.content}
                theme={isLight ? "light" : "dark"}
                mode={mode}
                timestamp={message.timestamp}
              />
            ))
        )}
        {showWorkingState && messages.length > 0 ? (
          <CoraThinkingIndicator
            mode={resolvedThinkingMode}
            theme={isLight ? "light" : "dark"}
            compact
            className="max-w-md"
          />
        ) : null}
        {/* Show engaging ScoreDisplay as an assistant message in the chat */}
        {evaluationScore !== null && showScoreDisplay && (
          <div className="flex gap-3 justify-start">
            <div className="self-start shrink-0 pt-0.5">
              <CoraBotMark size="sm" idle decorative />
            </div>
            <div className="max-w-[85%] rounded-xl p-0 shadow-lg bg-transparent border-0">
              {mode === "evaluate" && (
                <ScoreDisplay
                  score={evaluationScore}
                  maxScore={10}
                  pointsAwarded={2.5 + (evaluationScore / 10) * 2.5}
                  maxPoints={5.0}
                  feedback={evaluationFeedback || (evaluationScore >= 7 ? "Great understanding demonstrated! Your code shows solid comprehension." : evaluationScore >= 4 ? "Good effort! Continue practicing to improve your understanding." : "Keep practicing! Review the concepts and try again.")}
                  showSubmitButton={true}
                  onSubmit={async () => {
                    // Prevent multiple clicks
                    if (isSubmitting) {
                      console.warn("[AIChatInterface] Submission already in progress")
                      return
                    }
                    
                    // For evaluate mode, ensure assignment is selected (or practice-only is confirmed)
                    if (mode === "evaluate" && isEvaluation && !classroomSubmissionId) {
                      // No assignment selected - show custom modal for practice-only confirmation
                      setPendingSubmissionCallback(() => async () => {
                        setIsSubmitting(true)
                        try {
                          await submitEvaluationWithRetry(evaluationScore, evaluationFeedback)
                          setShowScoreDisplay(false)
                        } catch (error) {
                          console.error("[AIChatInterface] ❌ Submission failed:", error)
                          setIsSubmitting(false)
                        }
                      })
                      setShowPracticeOnlyModal(true)
                      return
                    }
                    
                    setIsSubmitting(true)
                    try {
                      await submitEvaluationWithRetry(evaluationScore, evaluationFeedback)
                      setShowScoreDisplay(false)
                    } catch (error) {
                      console.error("[AIChatInterface] ❌ Submission failed:", error)
                      setIsSubmitting(false)
                    }
                  }}
                  isSubmitting={isSubmitting}
                />
              )}
              {/* Show ScoreDisplay for practice mode - this is a fallback if parent component doesn't show it */}
              {mode === "practice" && (
                <ScoreDisplay
                  score={evaluationScore}
                  maxScore={10}
                  pointsAwarded={1.25 + (evaluationScore / 10) * 1.25}
                  maxPoints={2.5}
                  feedback={evaluationFeedback || (evaluationScore >= 7 ? "Great understanding demonstrated! Your code shows solid comprehension." : evaluationScore >= 4 ? "Good effort! Continue practicing to improve your understanding." : "Keep practicing! Review the concepts and try again.")}
                />
              )}
              {mode !== "practice" && mode !== "evaluate" && (
                <ScoreDisplay
                  score={evaluationScore}
                  maxScore={10}
                  pointsAwarded={evaluationScore * 0.5}
                  maxPoints={5.0}
                  feedback={evaluationFeedback || (evaluationScore >= 7 ? "Great understanding demonstrated! Your code shows solid comprehension." : evaluationScore >= 4 ? "Good effort! Continue practicing to improve your understanding." : "Keep practicing! Review the concepts and try again.")}
                />
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className={cn("shrink-0 border-t p-3 sm:p-4", ct.composer)}>
        <CodebenchCoraComposer
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          placeholder={isEvaluation ? "Type your answer…" : "Ask about your code…"}
          isLoading={isLoading || isInitializing}
          disabled={
            !studentId ||
            (isEvaluationFlow && (evaluationCompleted || currentQuestion >= 4)) ||
            (isComplete && messages.some((m) => m.content.includes("FINAL_SCORE")))
          }
          theme={isLight ? "light" : "dark"}
          footer={
            isEvaluation ? (
              <p className="flex items-center gap-1 text-[11px] text-slate-500">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span className="line-clamp-2">
                  {(isEvaluationFlow && (evaluationCompleted || currentQuestion >= 4)) ||
                  (isComplete && messages.some((m) => m.content.includes("FINAL_SCORE")))
                    ? "Evaluation complete"
                    : "Thoughtful answers improve your score (0–10)"}
                </span>
              </p>
            ) : null
          }
        />
      </div>

      {/* Practice Only Confirmation Modal */}
      <Dialog open={showPracticeOnlyModal} onOpenChange={setShowPracticeOnlyModal}>
        <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Info className="h-5 w-5 text-amber-400" />
              </div>
              <DialogTitle className="text-lg font-semibold text-slate-100">
                No Assignment Selected
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-400 pt-2">
              This submission will be for <span className="font-semibold text-amber-400">practice only</span> and will not count towards classroom points.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="flex items-start gap-3 p-3 bg-slate-700/50 rounded-lg border border-slate-600/50">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-medium mb-1">What this means:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Your code will be evaluated and scored</li>
                  <li>You'll receive feedback on your submission</li>
                  <li>No points will be awarded to your classroom grade</li>
                </ul>
              </div>
            </div>
            
            <div className="text-sm text-slate-400">
              <p>
                To submit for classroom points, select an assignment from the dropdown above before submitting.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowPracticeOnlyModal(false)
                setPendingSubmissionCallback(null)
                toast({
                  title: "Assignment Required",
                  description: "Please select an assignment from the dropdown before submitting.",
                  variant: "destructive",
                })
              }}
              className="w-full sm:w-auto border-slate-500 bg-slate-700/50 text-slate-200 hover:bg-slate-600 hover:text-white hover:border-slate-500"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowPracticeOnlyModal(false)
                if (pendingSubmissionCallback) {
                  pendingSubmissionCallback()
                  setPendingSubmissionCallback(null)
                }
              }}
              className="w-full sm:w-auto bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
            >
              Submit as Practice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

AIChatInterface.displayName = "AIChatInterface"
