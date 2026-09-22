"use client"

import { useEffect, useState, useRef, useMemo, useCallback, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useNotification } from "@/components/notification-provider"
import {
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Code,
  Flag,
  AlertCircle,
  TriangleAlert,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  Lock,
  Loader2,
  RotateCcw,
  Shield,
  Sparkles,
  Droplets,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { Badge } from "@/components/ui/badge"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { QuestionRenderer } from "@/components/question-renderer"
import { QuizInstructions } from "@/components/quiz-instructions"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"
import { QuizTakerChrome } from "@/components/quiz-taker-chrome"
import { StudentQuizQuestionNavigator } from "@/components/student-quiz-question-navigator"
import { useNativeApp } from "@/hooks/use-native-app"
import { cn } from "@/lib/utils"
import { useAssessment } from "@/context/assessment-context" // Import useAssessment
import { useAntiCheat, type AntiCheatConfig } from "@/hooks/use-anti-cheat"
import { AntiCheatWarning } from "@/components/anti-cheat-warning"
import { WaitingRoom } from "@/components/waiting-room"
import { FullscreenRequirement } from "@/components/fullscreen-requirement"
import { LocationRequirement } from "@/components/location-requirement"
import { distanceMeters } from "@/lib/geolocation"
import { SaveAndFinishLaterUpgradeModal } from "@/components/save-and-finish-later-upgrade-modal"
import { logEvent, queueEvent, logError, logPerformance, resetSessionId } from "@/lib/observability"
import { isCircuitQuestionType } from "@/lib/engineering-circuit-types"
import { CircuitAssessmentStem } from "@/components/circuit-assessment-stem"
import { CoraAskDrawer } from "@/components/cora/CoraAskDrawer"
import { canStudentAskCora } from "@/lib/cora/ask-cora-eligibility"
import { coraContextFromQuestion } from "@/lib/cora/question-context"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { QuestionStemWithMedia } from "@/components/question-media-display"
import { serverLog } from "@/lib/server-log"
import {
  shouldActivateAntiCheat,
  getAntiCheatSettings,
  isQuizLevelAntiCheatActive,
  applyStrictModeIntegrityDefaults,
  applyUnconfiguredQuizIntegrityDefaults,
} from "@/lib/antiCheatConfig"
import { applySuperpowerOverrides } from "@/lib/superpowers-apply"
import { SUPERPOWER_CONFIG } from "@/lib/superpowers-constants"
import type { MembershipTier } from "@/lib/membership-constants"
import { useBrowserAIBlocker } from "@/hooks/use-browser-ai-blocker"
import { useAIProtection } from "@/hooks/use-ai-protection"
import { useGeminiDetector } from "@/hooks/use-gemini-detector"
import { isMacOSDesktop, isBrowserAiEnforcementPlatform, applyBrowserAiPlatformPolicy, isPhoneOrTabletDevice } from "@/lib/device-utils"
import { isDesktopElectronAssessmentClient } from "@/lib/desktop-anticheat-policy"
import { isDesktopNativeAssessmentLockdownActive } from "@/lib/desktop-assessment-lockdown-active"
import { useDesktopAssessmentLockdown } from "@/hooks/use-desktop-assessment-lockdown"
import { isQuizAntiCheatDisabledForTesting } from "@/lib/quiz-anticheat-test-mode"
import {
  getDashboardPath,
  getHomeworkPath,
  getMidSemesterExamsPath,
  getFinalExamsPath,
  getPracticePath,
} from "@/lib/student-dashboard-paths"
import { useStudentError } from "@/components/student-error-context"
import {
  groupQuestionsBySections,
  getSectionForQuestionIndex,
  parseAssessmentSectionConfig,
  shortSectionNavigatorTitle,
  shouldUseAssessmentQuestionSections,
  type QuestionSection,
  type SectionConfig,
} from "@/lib/assessment-sections"
import {
  allowsSubmissionReplacement,
  canNavigateToQuestionIndex,
  EXAM_SHARED_TIMER_SECTION_KEY,
  getExamSharedTimerSeconds,
  getSectionConfigForQuestionIndex,
  getSectionIndexForQuestion,
  isPerQuestionTimerSection,
  isSectionTimerSection,
  questionHasCircuitDiagram,
  readExamSharedSectionSeconds,
  resolveQuestionTimeLimitSeconds,
  resolveSectionTotalTimeSeconds,
  syncExamSharedSectionTimers,
  coerceExamWideSectionConfig,
  usesExamSharedTimer,
  usesPerQuestionCountdown,
  usesSectionCountdown,
  formatTimerMmSs,
} from "@/lib/assessment-timer"
import { sanitizeAttemptTimerState } from "@/lib/sanitize-attempt-timer-state"
import {
  circuitQuestionEditableWhilePoolActive,
  repairStaleSectionPoolSeconds,
} from "@/lib/section-circuit-pool"
import { WaterBreakDurationDialog, WaterBreakOverlay } from "@/components/quiz-water-break"
import { SectionQuestionPickToggle } from "@/components/section-question-pick-controls"
import type { SectionQuestionSelections } from "@/lib/section-pick-scoring"
import type { StudentPickSectionSummary } from "@/lib/section-pick-scoring"
import { formatApiErrorMessage } from "@/lib/format-api-error-message"
import { isServerGradedQuestionType } from "@/lib/server-graded-question-types"
import { sectionPickRequiredCount } from "@/lib/section-pick-scoring"
import {
  multiPartMissingOptionalSolutionUpload,
  multiPartOffersSolutionUpload,
  multiPartStudentAnswerHasUpload,
} from "@/lib/solution-upload"
import { deriveMultiPartGradingPolicy } from "@/lib/multi-part-grading-policy"
import { isUntimedMultiPartQuestion } from "@/lib/multi-part-time-limit"
import { emptyMultiPartAnswer, getGradableSubquestions, parseSubquestions } from "@/lib/multi-part-question"
import {
  circuitSubmissionFileCount,
  circuitSubmissionHasRequiredUpload,
  compactCircuitSubmissionForAutoSave,
  compactCircuitSubmissionForSubmit,
  parseCircuitSubmissionAnswer,
  parseCircuitSubmissionConfig,
  resolveCircuitAnswerJsonForEval,
  resolveCircuitEvalDisplayPoints,
} from "@/lib/circuit-submission"

function circuitProvisionalToastDescription(displayPts: number, maxPoints: number): string {
  return `${displayPts}/${maxPoints} pts preview — not your final grade. Your instructor will review your work; you do not need to resubmit.`
}
import { workspaceHasContent } from "@/lib/circuit-workspace"
import { exportCircuitWorkspaceUploads } from "@/lib/circuit-workspace-export"
import { flattenStoredAiFeedback } from "@/lib/flatten-stored-ai-feedback"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import {
  getContinueLaterDialogBody,
  getContinueLaterDialogTitle,
  getContinueLaterSavedToastDescription,
} from "@/lib/quiz-resume-utils"

/** Module-level set to dedupe "Resuming Quiz" toast across Strict Mode remounts / double fetchQuiz */
const resumeToastShownForAttempts = new Set<number>()

/** Dedupe submission/evaluation toasts across retries, queue sync, and background eval. */
const submissionNotifyOnceKeys = new Set<string>()

function notifySubmissionOnce(
  toast: (opts: {
    title: ReactNode
    description?: ReactNode
    variant?: "default" | "destructive" | "success"
    duration?: number
    className?: string
  }) => string,
  key: string,
  opts: Parameters<typeof toast>[0],
) {
  if (submissionNotifyOnceKeys.has(key)) return
  submissionNotifyOnceKeys.add(key)
  toast(opts)
}

function parseStoredAiFeedback(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null
  const fb = raw as Record<string, unknown>
  if (fb.feedback === "Processing...") return null
  const feedbackText = typeof fb.feedback === "string" ? fb.feedback : ""
  const hasContent =
    fb.aiGraded === true ||
    fb.multiPartMcqGraded === true ||
    fb.multiPartAiGraded === true ||
    Boolean(fb.solutionFeedback) ||
    (Array.isArray(fb.strengths) && fb.strengths.length > 0) ||
    (Array.isArray(fb.improvements) && fb.improvements.length > 0) ||
    (feedbackText.length > 0 &&
      feedbackText !== "Evaluation failed - use Re-evaluate on results page")
  return hasContent ? fb : null
}

function isMultiPartGradedEval(evalData: Record<string, unknown> | null | undefined): boolean {
  if (!evalData) return false
  return Boolean(
    evalData.multiPartMcqGraded ||
      evalData.multiPartAiGraded ||
      (evalData.questionType === "multi_part" && evalData.feedback),
  )
}

function hasEvalFeedbackContent(evalData: Record<string, unknown> | null | undefined): boolean {
  return parseStoredAiFeedback(evalData) !== null
}

/** Code questions where students may revise and resubmit for a better score. */
function allowsResubmitForBetterScore(questionType: string): boolean {
  const qt = (questionType || "").toLowerCase()
  return qt === "code_write" || qt === "code_write_plot"
}

function circuitSubmissionAnswerIsFinalized(raw: unknown): boolean {
  const status = parseCircuitSubmissionAnswer(raw).submission_status
  return status === "submitted" || status === "graded" || status === "returned"
}

function evalDisplayPointsForUi(
  evalData: Record<string, unknown>,
  questionType?: string,
): number {
  const qt = (questionType || evalData.questionType || "").toString().toLowerCase()
  if (qt === "circuit_submission") {
    const provisional = resolveCircuitEvalDisplayPoints(
      evalData,
      Number(evalData.maxPoints) || undefined,
    )
    if (provisional != null) return provisional
  }
  return Number(evalData.pointsEarned) || 0
}

function shouldShowEvalFeedbackPanel(evalData: Record<string, unknown> | null | undefined): boolean {
  return hasEvalFeedbackContent(evalData)
}

/** Quiz Master / instructor feedback that should stay visible (not auto-dismiss like MCQ hints). */
function isPersistentEvalFeedback(
  evalData: Record<string, unknown> | null | undefined,
  questionType?: string,
): boolean {
  if (!evalData) return false
  if (evalData.aiGraded === true || evalData.multiPartMcqGraded === true) return true
  const qt = (questionType || evalData.questionType || "").toString().toLowerCase()
  if (qt === "circuit_submission" && hasEvalFeedbackContent(evalData)) return true
  if (evalData.requiresManualReview === true && hasEvalFeedbackContent(evalData)) return true
  return isMultiPartGradedEval(evalData)
}

function buildAiFeedbackForSave(
  evalData: Record<string, unknown> | null | undefined,
  questionType: string,
): Record<string, unknown> | null {
  if (!evalData) return null
  const qt = (questionType || "").toLowerCase()
  const shouldPersist =
    evalData.aiGraded === true ||
    evalData.requiresManualReview === true ||
    isMultiPartGradedEval(evalData) ||
    (qt === "multi_part" && evalData.feedback != null) ||
    (qt === "circuit_submission" && hasEvalFeedbackContent(evalData))
  if (!shouldPersist) return null
  const flattened = flattenStoredAiFeedback(evalData) ?? evalData
  return {
    ...flattened,
    questionType: flattened.questionType || (qt === "multi_part" ? "multi_part" : undefined),
    aiGraded: Boolean(flattened.aiGraded),
    requiresManualReview: Boolean(flattened.requiresManualReview),
  }
}

type ObjectiveGradeSnapshot = {
  isCorrect: boolean
  pointsEarned: number
  score?: number
  feedback?: string
  maxPoints?: number
  correctLetters?: string[]
}

function isObjectiveAutoGradedType(questionType: string): boolean {
  const qt = (questionType || "").toLowerCase()
  return qt === "mcq" || qt === "true_false" || qt === "select_all" || qt === "multi_output"
}

function evalDataFromSubmitResponse(
  submitResponse: Record<string, unknown>,
  questionType: string,
  fallbackMaxPoints?: number,
): Record<string, unknown> {
  const pointsEarned = Number(submitResponse.pointsEarned ?? 0)
  const maxPoints = Math.max(
    1,
    Number(submitResponse.maxPoints ?? fallbackMaxPoints ?? 1) || 1,
  )
  const score = maxPoints > 0 ? (pointsEarned / maxPoints) * 100 : 0
  const isCorrect =
    typeof submitResponse.isCorrect === "boolean"
      ? submitResponse.isCorrect
      : pointsEarned >= maxPoints - 0.001
  return {
    isCorrect,
    pointsEarned,
    maxPoints,
    score,
    feedback: typeof submitResponse.feedback === "string" ? submitResponse.feedback : "",
    aiGraded: false,
    locallyVerified: true,
    requiresManualReview: Boolean(submitResponse.requiresReview),
    questionType,
  }
}

interface Question {
  id: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e?: string
  correct_answer: string
  question_order: number
  question_type: string
  requires_code?: boolean
  hint?: string
  /** Take payloads omit hint text (fetched via /api/student/use-hint) and set this flag instead. */
  has_hint?: boolean
  hint_penalty?: number
  expected_answer?: string
  explanation?: string
  bank_question_id?: number
  time_limit?: number
  anti_cheat_exempt?: boolean
  max_points?: number
  points?: number
  sample_answers?: Array<{
    approach: string
    description: string
    code: string
  }>
  circuit_spec?: unknown
  question_media?: unknown
  bank_question_media?: unknown
}

interface QuizData {
  id: number
  title: string
  time_per_question: number
  available_until?: string | null
  questions: Question[]
  section_config?: SectionConfig[] | null
  course_timer?: {
    objective_mcq_seconds?: number
    objective_true_false_seconds?: number
    objective_select_all_seconds?: number
    time_per_question_default?: number
    hybrid_circuit_section_pooled_seconds?: number
    circuit_only_seconds_per_question?: number
  } | null
  antiCheatConfig?: AntiCheatConfig
  geo_required?: boolean
  geo_lat?: number | null
  geo_lng?: number | null
  geo_radius_meters?: number | null
}

/**
 * Normalize assessment type to match API route format
 */
function normalizeAssessmentType(type: string): string {
  const mapping: Record<string, string> = {
    'quiz': 'quiz',
    'homework': 'homework',
    'mid_semester': 'midsem',
    'midsem': 'midsem',
    'final': 'final',
    'finals': 'final',
    'practice': 'practice',
    'playground': 'points',
    'points': 'points'
  }
  return mapping[type.toLowerCase()] || 'quiz'
}

export function QuizTaker({ 
  quizId, 
  assessmentType = "quiz",
  onQuestionChange
}: { 
  quizId: string
  assessmentType?: string
  onQuestionChange?: (
    question: Question | null,
    meta?: { section_config?: SectionConfig[] | null },
  ) => void
}) {
  // Normalize assessment type for API routes
  const normalizedType = normalizeAssessmentType(assessmentType)
  const antiCheatDisabledForTesting = isQuizAntiCheatDisabledForTesting()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNativeApp = useNativeApp()
  const { isDark } = useAppearance()
  const fromDetail = searchParams.get("fromDetail") === "1"
  const detailAction = searchParams.get("action")
  usePreventBack("/student/login")
  const { toast, dismiss } = useNotification()
  const { showError } = useStudentError()
  const homeLink = useSmartHomeLink()
  const [showInstructions, setShowInstructions] = useState(() => !fromDetail)
  const [geoRequired, setGeoRequired] = useState(false)
  const [enableSuperpowers, setEnableSuperpowers] = useState(false)
  const [allowedSuperpowers, setAllowedSuperpowers] = useState<string[]>([])
  const [isBlockedByLocation, setIsBlockedByLocation] = useState(false)
  const [locationVerifying, setLocationVerifying] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [studentPickSections, setStudentPickSections] = useState<StudentPickSectionSummary[]>([])
  const [sectionPoolSizes, setSectionPoolSizes] = useState<Record<number, number>>({})
  
  // Fetch quiz config (geo_required, antiCheatConfig, superpowers) — not gated on instructions so resume/quick paths still see correct flags.
  useEffect(() => {
    setConfigLoaded(false)
    
    const fetchQuizConfig = async () => {
      try {
        const typeMap: Record<string, string> = {
          'quiz': 'quiz',
          'homework': 'homework',
          'mid_semester': 'midsem',
          'midsem': 'midsem',
          'final': 'final',
          'practice': 'practice'
        }
        const normalizedType = typeMap[assessmentType] || 'quiz'
        const configUrl = `/api/${normalizedType}/config/${quizId}`
        
        const response = await fetch(configUrl)
        if (!response.ok) {
          // Config API is the source of truth for geo; avoid calling take (which requires an active attempt).
          setConfigLoaded(true)
          return
        }
        
        const data = await response.json()
        if (data.geo_required) {
          setGeoRequired(true)
        }
        if (data.antiCheatConfig) {
          setAntiCheatConfig(prev => applyBrowserAiPlatformPolicy({ ...prev, ...data.antiCheatConfig }))
        }
        setEnableSuperpowers(Boolean(data.enable_superpowers))
        setAllowedSuperpowers(
          Boolean(data.enable_superpowers) && Array.isArray(data.allowed_superpowers)
            ? data.allowed_superpowers
            : [],
        )
        if (Array.isArray(data.student_pick_sections)) {
          setStudentPickSections(data.student_pick_sections as StudentPickSectionSummary[])
        }
        if (data.section_pool_sizes && typeof data.section_pool_sizes === "object") {
          setSectionPoolSizes(data.section_pool_sizes as Record<number, number>)
        }
      } catch (error) {
        // Silently fail - default config will be used
      } finally {
        setConfigLoaded(true)
      }
    }
    
    fetchQuizConfig()
  }, [quizId, assessmentType])

  // Add no-index meta tags to prevent AI indexing
  useEffect(() => {
    // Remove existing robots meta tag if present
    const existingMeta = document.querySelector('meta[name="robots"]')
    if (existingMeta) {
      existingMeta.remove()
    }

    // Add no-index meta tag
    const metaRobots = document.createElement('meta')
    metaRobots.name = 'robots'
    metaRobots.content = 'noindex, nofollow, noarchive, nosnippet'
    document.head.appendChild(metaRobots)

    // Copy/paste / context menu: do not block at document level here — that duplicated
    // useBrowserAIBlocker (non-editable only) and useAntiCheat (when blockCopyPaste),
    // and broke paste into inputs even when superpowers allowed copy/paste.

    return () => {
      if (metaRobots.parentNode) {
        metaRobots.parentNode.removeChild(metaRobots)
      }
    }
  }, [])
  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const continueLaterDialogCopy = useMemo(
    () => getContinueLaterDialogBody(quiz?.available_until),
    [quiz?.available_until],
  )
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string>("")
  const [selectedMultiAnswers, setSelectedMultiAnswers] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const answersRef = useRef(answers)
  answersRef.current = answers
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(false) // Start as false, only set true when user starts quiz
  const [quizStarted, setQuizStarted] = useState(false) // Track if quiz loading has been initiated
  const [loadingStep, setLoadingStep] = useState(0) // Track which loading step we're on (0-3)
  const [submitting, setSubmitting] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [attemptId, setAttemptId] = useState<number | null>(null)
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)
  // Safety: never block > 90s - unblock if any code path forgets to clear
  useEffect(() => {
    if (!isSubmittingAnswer) return
    const id = setTimeout(() => setIsSubmittingAnswer(false), 90000)
    return () => clearTimeout(id)
  }, [isSubmittingAnswer])
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [showSubmitConfirmDialog, setShowSubmitConfirmDialog] = useState(false)
  const [showWaterBreakPicker, setShowWaterBreakPicker] = useState(false)
  const [coraDrawerOpen, setCoraDrawerOpen] = useState(false)
  const [waterBreakActive, setWaterBreakActive] = useState(false)
  const [waterBreakTotalSeconds, setWaterBreakTotalSeconds] = useState(0)
  const [showSubmissionStalledModal, setShowSubmissionStalledModal] = useState(false)
  const [submissionStalledFinalizeSucceeded, setSubmissionStalledFinalizeSucceeded] = useState(false)
  const stalledAnswersRef = useRef<Array<{ questionId: number; answer: any; questionType: string; plotImage?: string; typingReplay?: any; timeSpentSeconds?: number }>>([])
  const [finalizationErrorModal, setFinalizationErrorModal] = useState<{
    title: string
    message: string
    errorType?: string
  } | null>(null)

  const [showCompiler, setShowCompiler] = useState(false)
  const TRAILBLAZER_TEMPLATE = `#include <iostream>\nusing namespace std;\n\nint main() {\n    //Your code goes in here....\n    return 0;\n}`
  const HELLO_WORLD = `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Start your code here\n    cout << "Hello, world!" << endl;\n    return 0;\n}`

  const membershipGetsCodeWriteBoilerplate = () =>
    membershipTier === "Explorer" || membershipTier === "Trailblazer"

  /** code_write editor default: boilerplate for Explorer/Trailblazer; empty for Scholar and other tiers. */
  const getCodeTemplate = () => (membershipGetsCodeWriteBoilerplate() ? TRAILBLAZER_TEMPLATE : "")

  const isTemplateCode = (codeToCheck: string, questionType?: string) => {
    if (questionType === "code_write") {
      const t = (codeToCheck || "").trim()
      const expected = getCodeTemplate().trim()
      if (!t) {
        return !membershipGetsCodeWriteBoilerplate()
      }
      if (expected && t === expected) return true
      if (!membershipGetsCodeWriteBoilerplate() && t === TRAILBLAZER_TEMPLATE.trim()) return true
      return false
    }
    if (!codeToCheck || !codeToCheck.trim()) return false
    return codeToCheck.trim() === HELLO_WORLD.trim()
  }
  
  const getCodeStorageKey = (questionId: number) => `code_${attemptId || "unknown"}_${questionId}`
  const persistCodeValue = (questionId: number, value: string) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(getCodeStorageKey(questionId), value || "")
      }
    } catch (error) {
      // Failed to persist code
    }
  }
  const [code, setCode] = useState("") // Will be initialized based on membership tier
  const [compilerOutput, setCompilerOutput] = useState("")
  const [isCompiling, setIsCompiling] = useState(false)
  const [codeByQuestion, setCodeByQuestion] = useState<Record<number, string>>({})

  // Plot upload state for code_write_plot questions
  const [uploadedPlot, setUploadedPlot] = useState<string | null>(null)
  const [plotByQuestion, setPlotByQuestion] = useState<Record<number, string>>({})


  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set())
  const [partialCreditPoints, setPartialCreditPoints] = useState<number | null>(null)

  const [lockedQuestions, setLockedQuestions] = useState<Set<number>>(new Set())
  const [timerExpiredForQuestion, setTimerExpiredForQuestion] = useState<Set<number>>(new Set())
  const [timerStarting, setTimerStarting] = useState(false)
  const [inWaitingList, setInWaitingList] = useState(false)
  const [waitingListPosition, setWaitingListPosition] = useState(0)

  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(new Set())
  const [aiGradedQuestionsSubmitted, setAiGradedQuestionsSubmitted] = useState<Set<number>>(new Set())
  const [questionsWithStoredEval, setQuestionsWithStoredEval] = useState<Set<number>>(new Set())
  const [questionsWithObjectiveGrade, setQuestionsWithObjectiveGrade] = useState<Set<number>>(new Set())

  const [usedHints, setUsedHints] = useState<Set<number>>(new Set())
  const [showHint, setShowHint] = useState(false)
  /** Hint text fetched from /api/student/use-hint, keyed by question id (take payloads omit hint text). */
  const [hintTextByQuestionId, setHintTextByQuestionId] = useState<Record<number, string>>({})

  const [attemptCount, setAttemptCount] = useState<Record<number, number>>({})
  const [aiFeedback, setAiFeedback] = useState<any>(null)
  const evalByQuestionRef = useRef<Record<number, Record<string, unknown>>>({})
  const objectiveGradeByQuestionRef = useRef<Record<number, ObjectiveGradeSnapshot>>({})
  const [pendingEvaluations, setPendingEvaluations] = useState<Set<number>>(new Set())
  const evaluationControllersRef = useRef<Map<number, AbortController>>(new Map())
  const circuitEvalPromisesRef = useRef<Map<number, Promise<unknown>>>(new Map())
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const timerStartDelayRef = useRef<NodeJS.Timeout | null>(null)
  // Per-question timers: only the visible question counts down (paused when navigating away).
  const globalQuestionTimersRef = useRef<Record<number, number>>({})
  const visitedPerQuestionTimerRef = useRef<Set<number>>(new Set())
  const questionGraceEndsAtRef = useRef<Record<number, number>>({})
  const globalSectionTimersRef = useRef<Record<number, number>>({})
  const sectionGraceEndsAtRef = useRef<Record<number, number>>({})
  const parsedSectionConfigRef = useRef<SectionConfig[] | null>(null)
  const sectionsRef = useRef<QuestionSection[]>([])
  const expiredSectionsRef = useRef<Set<number>>(new Set())
  const globalTimerTickRef = useRef<NodeJS.Timeout | null>(null)
  const waterBreakPausedRef = useRef(false)
  const resumeFromSaveLaterRef = useRef(false)
  const quizForTimerRef = useRef<typeof quiz>(null)
  const currentQuestionIndexForTimerRef = useRef(0)
  const timerExpiredForQuestionRef = useRef<Set<number>>(new Set())
  const lockedQuestionsForTimerRef = useRef<Set<number>>(new Set())
  // Refs for timer expiry - avoid stale closure when timer fires (answers not saving on time-out)
  const latestAnswerRef = useRef<{ selectedAnswer: string; code: string; codeByQuestion: Record<number, string>; selectedMultiAnswers: string[] }>({
    selectedAnswer: '', code: '', codeByQuestion: {}, selectedMultiAnswers: []
  })
  // Sync ref - updated in handleCodeChange for immediate capture (fixes Q1 race with timer)
  const codeSyncRef = useRef<string>("")
  // Typing replay per question for anti-cheat (code write replay)
  const typingReplayByQuestionRef = useRef<Record<number, { startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }> }>>({})
  // Ref to Monaco editor - read getValue() on timer expiry for authoritative code (fixes Q1 data loss)
  const codeEditorRef = useRef<{ getValue: () => string } | null>(null)
  const circuitAnswerSnapshotRef = useRef<(() => string) | null>(null)
  const circuitPrepareSubmitRef = useRef<(() => void | Promise<void>) | null>(null)
  const circuitAnswersByQuestionRef = useRef<Record<number, string>>({})

  const assessmentContext = useAssessment()
  const effectiveType = assessmentType || assessmentContext?.type || "quiz"
  const effectiveLabel = assessmentContext?.label || "Quiz"

  const parsedSectionConfig = useMemo(() => {
    const parsed = coerceExamWideSectionConfig(
      parseAssessmentSectionConfig(quiz?.section_config),
      effectiveType,
    )
    parsedSectionConfigRef.current = parsed
    return parsed
  }, [quiz?.section_config, effectiveType])

  const sections = useMemo((): QuestionSection[] => {
    if (!quiz?.questions?.length) {
      sectionsRef.current = []
      return []
    }
    if (!shouldUseAssessmentQuestionSections(effectiveType, parsedSectionConfig)) {
      sectionsRef.current = []
      return []
    }
    const grouped = groupQuestionsBySections(quiz.questions, parsedSectionConfig)
    sectionsRef.current = grouped
    return grouped
  }, [quiz?.questions, parsedSectionConfig, effectiveType])

  const currentSectionConfig = useMemo(
    () => getSectionConfigForQuestionIndex(currentQuestionIndex, sections, parsedSectionConfig),
    [currentQuestionIndex, sections, parsedSectionConfig],
  )

  const currentSectionIndex = useMemo(
    () => getSectionIndexForQuestion(currentQuestionIndex, sections),
    [currentQuestionIndex, sections],
  )

  const currentSectionQuestionCount = useMemo(() => {
    if (currentSectionIndex == null) return 0
    const sec = sections.find((s) => s.sectionIndex === currentSectionIndex)
    return sec?.questionIndices.length ?? 0
  }, [currentSectionIndex, sections])

  const sectionTimerContext = useMemo(
    () => ({
      questionCountInSection: currentSectionQuestionCount,
      allSections: parsedSectionConfig,
      courseTimer: quiz?.course_timer ?? undefined,
    }),
    [currentSectionQuestionCount, parsedSectionConfig, quiz?.course_timer],
  )

  const courseTimer = quiz?.course_timer ?? undefined

  const getSectionConfigAt = useCallback(
    (questionIndex: number) =>
      getSectionConfigForQuestionIndex(questionIndex, sectionsRef.current, parsedSectionConfigRef.current),
    [],
  )

  const questionUsesPerQuestionTimer = useCallback(
    (questionType: string, questionIndex: number) =>
      usesPerQuestionCountdown(
        questionType,
        getSectionConfigAt(questionIndex),
        parsedSectionConfigRef.current,
        effectiveType,
      ),
    [getSectionConfigAt, effectiveType],
  )

  const circuitEditableInSectionPool = useCallback(
    (questionIndex: number, questionType?: string) => {
      const q = quiz?.questions?.[questionIndex]
      const qt = questionType ?? q?.question_type ?? "mcq"
      return circuitQuestionEditableWhilePoolActive(
        questionIndex,
        qt,
        sectionsRef.current,
        parsedSectionConfigRef.current,
        sectionTimeRemainingRef.current,
        expiredSectionsRef.current,
      )
    },
    [quiz],
  )

  const canNavigateToIndex = useCallback(
    (targetIndex: number) =>
      canNavigateToQuestionIndex(
        targetIndex,
        currentQuestionIndex,
        sectionsRef.current,
        parsedSectionConfigRef.current,
        effectiveType,
      ),
    [currentQuestionIndex, effectiveType],
  )

  const getCircuitAnswerJson = useCallback(
    (fallback?: string) => circuitAnswerSnapshotRef.current?.() ?? fallback ?? selectedAnswer ?? "{}",
    [selectedAnswer],
  )

  const getCircuitAnswerForQuestion = useCallback(
    (questionId: number, isCurrent: boolean): string | null => {
      if (isCurrent) {
        circuitPrepareSubmitRef.current?.()
        const json = getCircuitAnswerJson()
        return json && json !== "{}" ? json : null
      }
      const cached = circuitAnswersByQuestionRef.current[questionId] ?? answers[questionId]
      return cached && cached !== "{}" ? cached : null
    },
    [answers, getCircuitAnswerJson],
  )
  useEffect(() => {
    latestAnswerRef.current = {
      selectedAnswer: selectedAnswer || '',
      code: code || '',
      codeByQuestion: { ...codeByQuestion },
      selectedMultiAnswers: [...selectedMultiAnswers]
    }
  }, [selectedAnswer, code, codeByQuestion, selectedMultiAnswers])
  
  // Offline/connectivity handling
  const [isOnline, setIsOnline] = useState(true)
  const [answerQueue, setAnswerQueue] = useState<any[]>([])
  const [questionRendered, setQuestionRendered] = useState(false)
  const [retryingSubmission, setRetryingSubmission] = useState(false)
  const [aiGradingFailed, setAiGradingFailed] = useState(false)
  const [failedQuestionData, setFailedQuestionData] = useState<any>(null)
  const [aiGradingStatus, setAiGradingStatus] = useState<"idle" | "checking" | "success" | "error" | "partial">("idle")
  const [isViolationSubmission, setIsViolationSubmission] = useState(false)
  const [violationReason, setViolationReason] = useState<string | null>(null)
  const [isLockedDueToViolations, setIsLockedDueToViolations] = useState(false)

  const [isQuizFinalized, setIsQuizFinalized] = useState(false)

  const [membershipTier, setMembershipTier] = useState<string>("Scholar")
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [resumeAttemptId, setResumeAttemptId] = useState<number | null>(null)
  /** Superpowers persisted on the incomplete attempt (resume dialog → Continue Quiz hydrates start-quiz payload). */
  const [resumeAttemptSuperpowers, setResumeAttemptSuperpowers] = useState<string[]>([])
  const [resumeCanRestart, setResumeCanRestart] = useState(true)
  const [resumeRestartBlockedReason, setResumeRestartBlockedReason] = useState<string | null>(null)
  const [hasSaveAndFinishLaterAccess, setHasSaveAndFinishLaterAccess] = useState(false)
  const [showSaveLaterUpgradeModal, setShowSaveLaterUpgradeModal] = useState(false)
  /** Shown before save-and-leave: remind students of the resume window (does not change save API behavior) */
  const [showContinueLaterWarningDialog, setShowContinueLaterWarningDialog] = useState(false)

  // Fetch membership tier on mount
  useEffect(() => {
    const fetchMembershipTier = async () => {
      try {
        const storedTier = sessionStorage.getItem("studentMembershipTier")
        if (storedTier) {
          setMembershipTier(storedTier)
          return
        }

        const studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
        if (!studentDatabaseId) {
          const studentId = sessionStorage.getItem("studentId")
          if (!studentId) return

          const infoResponse = await studentApiFetch(`/api/student/info?student_id=${studentId}`)
          const infoData = await infoResponse.json()
          if (infoResponse.ok && infoData.student?.id) {
            sessionStorage.setItem("studentDatabaseId", infoData.student.id.toString())
            const tier = infoData.student.membership_tier || "Scholar"
            setMembershipTier(tier)
            sessionStorage.setItem("studentMembershipTier", tier)
          }
        } else {
          const membershipResponse = await studentApiFetch(`/api/student/membership?studentId=${studentDatabaseId}`)
          const membershipData = await membershipResponse.json()
          if (membershipResponse.ok && membershipData.membership?.tier) {
            const tier = membershipData.membership.tier
            setMembershipTier(tier)
            sessionStorage.setItem("studentMembershipTier", tier)
          }
        }
      } catch (error) {
        // Failed to fetch membership, default to Scholar
        console.error("[Quiz Taker] Failed to fetch membership:", error)
      }
    }

    fetchMembershipTier()
  }, [])
  const autoSubmitTriggeredRef = useRef(false)
  const autoSubmitOnceRef = useRef(false) // Prevent multiple auto-submit calls per page load
  const isStartingQuizRef = useRef(false) // Prevent multiple start-quiz API calls
  /** Superpowers from instructions screen — keep for fetchQuiz() calls that omit args (second start-quiz, Continue Quiz). */
  const selectedSuperpowersForAttemptRef = useRef<string[]>([])

  useEffect(() => {
    selectedSuperpowersForAttemptRef.current = []
    setResumeAttemptSuperpowers([])
  }, [quizId])

  // Track state changes for violations
  useEffect(() => {
    if (isLockedDueToViolations || isQuizFinalized) {
    }
  }, [isLockedDueToViolations, isQuizFinalized, violationReason])

  // Anti-cheat system integration - dynamically updated based on current question
  // CRITICAL: Initialize with default values, not quiz?.antiCheatConfig (quiz is null initially)
  const [antiCheatConfig, setAntiCheatConfig] = useState<AntiCheatConfig>({
    strictModeEnabled: false,
    blockCopyPaste: false,
    trackTabSwitches: false,
    trackMouseMovement: false,
    trackGeminiWindow: false,
    maxGeminiStrikes: 5,
    warnOnTabSwitch: false,
    maxTabSwitches: 5,
    keystrokePlaybackEnforced: true,
    autoSubmitOnViolations: false,
  })
  const [antiCheatEnabled, setAntiCheatEnabled] = useState(true)
  /** While the native solution-upload file picker is open, pause strict anti-cheat. */
  const [solutionUploadSuspendingAntiCheat, setSolutionUploadSuspendingAntiCheat] = useState(false)
  const solutionUploadSuspendingRef = useRef(false)
  const solutionUploadCooldownUntilRef = useRef(0)

  const isSolutionUploadAntiCheatPaused = useCallback(() => {
    return (
      solutionUploadSuspendingRef.current ||
      Date.now() < solutionUploadCooldownUntilRef.current
    )
  }, [])

  const setSolutionUploadAntiCheatSuspension = useCallback((suspended: boolean) => {
    solutionUploadSuspendingRef.current = suspended
    setSolutionUploadSuspendingAntiCheat(suspended)
    if (!suspended) {
      solutionUploadCooldownUntilRef.current = Date.now() + 8000
    }
  }, [])

  const activeAntiCheatConfig = useMemo(
    () => ({ ...antiCheatConfig, suspended: solutionUploadSuspendingAntiCheat }),
    [antiCheatConfig, solutionUploadSuspendingAntiCheat],
  )

  const desktopNativeLockdownActive = useMemo(
    () =>
      isDesktopNativeAssessmentLockdownActive({
        disabledForTesting: antiCheatDisabledForTesting,
        quizStarted,
        loading,
        antiCheatEnabled,
        config: activeAntiCheatConfig,
      }),
    [
      antiCheatDisabledForTesting,
      quizStarted,
      loading,
      antiCheatEnabled,
      activeAntiCheatConfig,
    ],
  )
  useDesktopAssessmentLockdown(desktopNativeLockdownActive)

  useEffect(() => {
    setSolutionUploadAntiCheatSuspension(false)
  }, [currentQuestionIndex, setSolutionUploadAntiCheatSuspension])

  // Update anti-cheat config based on current question
  useEffect(() => {
    if (quiz && quiz.questions && quiz.questions[currentQuestionIndex]) {
      const currentQuestion = quiz.questions[currentQuestionIndex]
      const questionType = currentQuestion.question_type?.toLowerCase() || ''
      const antiCheatExempt = currentQuestion.anti_cheat_exempt === true
      const order1Based =
        typeof currentQuestion.question_order === "number" && currentQuestion.question_order > 0
          ? currentQuestion.question_order
          : currentQuestionIndex + 1
      const antiCheatCtx = {
        questionOrder1Based: order1Based,
        sectionConfig: quiz.section_config ?? null,
      }

      // Use the centralized anti-cheat config to determine if anti-cheat should be active
      const shouldActivate = shouldActivateAntiCheat(questionType, antiCheatExempt, antiCheatCtx)
      const settings = getAntiCheatSettings(questionType, antiCheatExempt, antiCheatCtx)
      
      const isMatlab = questionType === 'code_write_plot' || 
                      questionType.includes('matlab') ||
                      (questionType === 'code_problem' && currentQuestion.question_text?.toLowerCase().includes('matlab')) ||
                      antiCheatExempt
      
      const quizAc = applyUnconfiguredQuizIntegrityDefaults(
        (quiz as any).antiCheatConfig ?? {},
        assessmentType,
        quiz.title,
      )
      const quizLevelActive = isQuizLevelAntiCheatActive(quizAc)

      if (!shouldActivate || isMatlab) {
        // Disable anti-cheat for exempt questions (e.g., code_write_plot for MATLAB)
        setAntiCheatConfig(prev => ({
          ...prev,
          strictModeEnabled: false,
          blockCopyPaste: false,
          trackTabSwitches: false,
          trackMouseMovement: false,
          warnOnTabSwitch: false,
          autoSubmitOnViolations: false,
          maxTabSwitches: Infinity,
          trackGeminiWindow: false,
          maxGeminiStrikes: Infinity,
          requireFullscreen: false,
        }))
        setAntiCheatEnabled(false)
      } else {
        const withSuperpowers = applySuperpowerOverrides(quizAc, {
          superpowers: Array.isArray((quiz as any)?.activeSuperpowers)
            ? (quiz as any).activeSuperpowers
            : [],
        })
        const quizMaxGeminiStrikes = Number(withSuperpowers.maxGeminiStrikes) || settings.maxGeminiStrikes || 5
        const quizMaxTabSwitches = Number(withSuperpowers.maxTabSwitches) || settings.tabSwitchLimit
        
        setAntiCheatConfig(prev => applyBrowserAiPlatformPolicy({
          ...prev,
          strictModeEnabled: Boolean(withSuperpowers.strictModeEnabled || quizLevelActive),
          blockCopyPaste: Boolean(withSuperpowers.blockCopyPaste),
          trackTabSwitches: antiCheatDisabledForTesting ? false : Boolean(withSuperpowers.trackTabSwitches),
          warnOnTabSwitch: Boolean(withSuperpowers.warnOnTabSwitch),
          autoSubmitOnViolations: antiCheatDisabledForTesting ? false : Boolean(withSuperpowers.autoSubmitOnViolations),
          maxTabSwitches: quizMaxTabSwitches,
          trackGeminiWindow: antiCheatDisabledForTesting ? false : Boolean(withSuperpowers.trackGeminiWindow),
          maxGeminiStrikes: quizMaxGeminiStrikes,
          requireFullscreen: antiCheatDisabledForTesting ? false : Boolean(withSuperpowers.requireFullscreen),
        }))
        setAntiCheatEnabled(true)
      }
    }
  }, [currentQuestionIndex, quiz, assessmentType, antiCheatDisabledForTesting])

  // SECURITY: violation counts restored from the server on attempt load — refreshing the page
  // must not reset progress toward the auto-submit threshold.
  const [restoredViolationCounts, setRestoredViolationCounts] = useState<{
    tabSwitchCount: number
    geminiStrikes: number
    copyPasteAttempts: number
  } | null>(null)

  // Ref to access latest anti-cheat config in callbacks (avoids stale closures)
  const antiCheatConfigRef = useRef(antiCheatConfig)
  useEffect(() => {
    antiCheatConfigRef.current = antiCheatConfig
  }, [antiCheatConfig])

  // Declare savedAnswers early so it can be used in autoSaveAnswer and finalizeQuizWithViolation
  const [savedAnswers, setSavedAnswers] = useState<Set<number>>(new Set()) // Track answers actually saved to database
  /** Primary /api/submit failed but fallback save-answer recorded the work */
  const [submissionPendingQuestions, setSubmissionPendingQuestions] = useState<Set<number>>(new Set())
  const [questionTimeSpent, setQuestionTimeSpent] = useState<Record<number, number>>({})
  const questionStartTimeRef = useRef<number>(Date.now())

  /** Cap time at question's time_limit (students cannot exceed per-question limit). Includes extra_time superpower for code questions. */
  const capTimeSpent = useCallback((questionId: number, seconds: number): number => {
    const q = quiz?.questions?.find((x) => x.id === questionId)
    if (!q) return seconds
    const qIndex = quiz?.questions?.findIndex((x) => x.id === questionId) ?? -1
    if (!questionUsesPerQuestionTimer(q.question_type, qIndex >= 0 ? qIndex : currentQuestionIndex)) {
      return seconds
    }
    const sectionCfg = getSectionConfigAt(qIndex >= 0 ? qIndex : currentQuestionIndex)
    const baseLimit = resolveQuestionTimeLimitSeconds(
      q.question_type,
      q.time_limit,
      quiz?.time_per_question,
      sectionCfg,
      courseTimer,
      { hasDiagram: questionHasCircuitDiagram(q) },
    )
    const extraTime = (quiz as any)?.extraTimePerQuestion || 0
    const isCodeQ = q && ["code_write", "code_problem", "debug_code"].includes((q.question_type || "").toLowerCase())
    const limit = baseLimit + (isCodeQ ? extraTime : 0)
    if (limit > 0 && seconds > limit) return limit
    return seconds
  }, [quiz, questionUsesPerQuestionTimer, getSectionConfigAt, currentQuestionIndex, courseTimer])

  // SECURITY: single-active-session token issued by the take API. Sent on attempt writes so
  // the server can reject a superseded window/device (the newest take fetch owns the attempt).
  const attemptSessionTokenRef = useRef<string | null>(null)
  const isSessionSupersededRef = useRef(false)
  const serverDeadlineExpiredRef = useRef(false)
  const [serverIntegrityStop, setServerIntegrityStop] = useState<
    "deadline_expired" | "session_superseded" | null
  >(null)

  const attemptApiHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (attemptSessionTokenRef.current) {
      headers["x-attempt-session"] = attemptSessionTokenRef.current
    }
    return headers
  }, [])

  /** Shared handling for server-side integrity rejections (hard deadline / superseded session). */
  const handleAttemptWriteRejection = useCallback(
    (status: number, payload: { code?: string }): boolean => {
      if (status === 423 && payload.code === "deadline_expired") {
        if (!serverDeadlineExpiredRef.current) {
          serverDeadlineExpiredRef.current = true
          setServerIntegrityStop("deadline_expired")
        }
        return true
      }
      if (status === 409 && payload.code === "session_superseded") {
        if (!isSessionSupersededRef.current) {
          isSessionSupersededRef.current = true
          setServerIntegrityStop("session_superseded")
        }
        return true
      }
      return false
    },
    [],
  )

  /**
   * Auto-save function for immediate persistence
   * Lightweight save that doesn't evaluate answers
   * Used for auto-save on answer selection and navigation
   * @param typingReplay - For code questions: keystroke replay for anti-cheat (prevents overwriting with empty data)
   */
  const autoSaveAnswer = useCallback(async (
    questionId: number,
    answer: any,
    questionType: string,
    typingReplay?: { startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }> } | null,
    timeSpentSeconds?: number,
    finalize = false,
  ) => {
    if (!attemptId) return

    try {
      // CRITICAL: Increase timeout during auto-submission to prevent premature failures
      // Use a longer timeout (15s) to handle slow network conditions during auto-submit
      const timeoutDuration = isViolationSubmission ? 15000 : 5000

      const body: Record<string, unknown> = {
        attemptId,
        questionId,
        answer,
        questionType,
        autoSave: !finalize,
      }
      if (typingReplay?.events?.length) {
        body.typingReplay = typingReplay
      }
      if (timeSpentSeconds != null && timeSpentSeconds >= 0) {
        body.timeSpentSeconds = timeSpentSeconds
      }

      const response = await studentApiFetch("/api/student/save-answer", {
        method: "POST",
        headers: attemptApiHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutDuration),
      })

      if (!response.ok) {
        let payload: { locked?: boolean; error?: string; code?: string } = {}
        try {
          payload = await response.json()
        } catch {
          /* ignore */
        }
        // Server-side integrity stop (deadline expired / session superseded) — handled globally.
        if (handleAttemptWriteRejection(response.status, payload)) {
          return
        }
        if (response.status === 409 && payload.locked) {
          setSavedAnswers((prev) => new Set(prev).add(questionId))
          setLockedQuestions((prev) => new Set(prev).add(questionId))
          setSubmittedQuestions((prev) => new Set(prev).add(questionId))
          return
        }
        const lockable = ["mcq", "true_false", "select_all", "multi_output"].includes(
          (questionType || "").toLowerCase(),
        )
        if (lockable) {
          notifySubmissionOnce(toast, `autosave-fail-${attemptId}-${questionId}`, {
            title: "Answer not saved",
            description:
              "Your selection could not be saved. It will be included when you submit the assignment.",
            variant: "destructive",
            duration: 5000,
          })
        }
        throw new Error(`Auto-save failed: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        setSavedAnswers(prev => new Set(prev).add(questionId))
      }
    } catch (err: any) {
      // Silent failure for auto-save - don't show toast or block UI
      // During auto-submission, we're more lenient - just log and continue
      if (isViolationSubmission) {
        // During violation submission, don't queue - just log and continue
        // The finalization will proceed regardless
        return
      }
      
      // Fallback to offline queue if network fails (normal operation)
      if (err.name === 'AbortError' || !navigator.onLine) {
        setAnswerQueue(prev => [
          ...prev,
          {
            attemptId,
            questionId,
            answer,
            questionType,
            timestamp: Date.now(),
            autoSave: true,
            typingReplay: typingReplay?.events?.length ? typingReplay : undefined
          }
        ])
      }
    }
  }, [attemptId, isViolationSubmission])

  // CRITICAL: Atomic auto-submit pipeline - MUST be defined before useAntiCheat
  const finalizeQuizWithViolation = useCallback(async (reason: string) => {
    if (!attemptId) {
      return
    }
    
    if (autoSubmitTriggeredRef.current) {
      return
    }
    
    autoSubmitTriggeredRef.current = true

    // CRITICAL: Freeze UI IMMEDIATELY
    setIsLockedDueToViolations(true)
    setIsQuizFinalized(true)
    setIsViolationSubmission(true)
    setViolationReason(reason)

    try {
      // 1️⃣ Save ALL answers - including current question's answer from state
      if (quiz) {
        const savePromises: Promise<void>[] = []
        const questionsToSave = new Set<number>() // Track which questions we're saving to avoid duplicates
        const currentQuestion = quiz.questions[currentQuestionIndex]
        
        // First, save current question's answer if it exists in state but not yet in answers
        if (currentQuestion) {
          const questionType = currentQuestion.question_type?.toLowerCase() || "mcq"
          let currentAnswer: string | null = null
          
          // Check selectedAnswer for MCQ/true_false
          if (selectedAnswer && (questionType === "mcq" || questionType === "true_false")) {
            currentAnswer = selectedAnswer
          }
          // Check selectedMultiAnswers for multi-select
          else if (selectedMultiAnswers.length > 0 && (questionType === "select_all" || questionType === "multi_output")) {
            currentAnswer = JSON.stringify(selectedMultiAnswers)
          }
          // Check code for code questions - use editor/ref for most reliable capture
          else if (["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(questionType)) {
            const codeVal = codeEditorRef.current?.getValue?.() ?? codeSyncRef.current ?? codeByQuestion[currentQuestion.id] ?? code
            if (codeVal && codeVal.trim() !== HELLO_WORLD.trim()) {
              currentAnswer = codeVal
            }
          }
          else if (questionType === "circuit_submission") {
            circuitPrepareSubmitRef.current?.()
            const circuitJson = getCircuitAnswerJson()
            if (circuitJson && circuitJson !== "{}") {
              currentAnswer = circuitJson
            }
          }
          
          // Save current question answer if it exists
          if (currentAnswer) {
            questionsToSave.add(currentQuestion.id)
            const raw = Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[currentQuestion.id] || 0)
            savePromises.push(
              autoSaveAnswer(currentQuestion.id, currentAnswer, questionType, undefined, capTimeSpent(currentQuestion.id, raw)).catch(() => {})
            )
          }
        }
        
        // Save all answers from answers state (skip if already saving current question)
        for (const q of quiz.questions) {
          if (questionsToSave.has(q.id)) continue // Skip if already saving
          
          const answer = answers[q.id] ?? null
          const questionType = q.question_type?.toLowerCase() || "mcq"
          let answerToSave: string | null = answer

          if (questionType === "circuit_submission") {
            if (q.id === currentQuestion?.id) {
              circuitPrepareSubmitRef.current?.()
              const circuitJson = getCircuitAnswerJson()
              if (circuitJson && circuitJson !== "{}") answerToSave = circuitJson
            } else {
              const cached = circuitAnswersByQuestionRef.current[q.id] ?? answer
              if (cached && cached !== "{}") answerToSave = cached
            }
          }

          if (answerToSave !== null) {
            questionsToSave.add(q.id)
            const raw = q.id === currentQuestion?.id
              ? Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[q.id] || 0)
              : (questionTimeSpent[q.id] || 0)
            savePromises.push(
              autoSaveAnswer(q.id, answerToSave, questionType, undefined, capTimeSpent(q.id, raw)).catch(() => {})
            )
          }
        }
        
        // Also check circuitAnswersByQuestionRef for workspace ink not yet in answers state
        for (const [questionId, circuitAnswer] of Object.entries(circuitAnswersByQuestionRef.current)) {
          const qId = Number(questionId)
          if (questionsToSave.has(qId)) continue

          const question = quiz.questions.find((q) => q.id === qId)
          if (question && circuitAnswer && circuitAnswer !== "{}") {
            questionsToSave.add(qId)
            const raw =
              qId === currentQuestion?.id
                ? Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) +
                  (questionTimeSpent[qId] || 0)
                : questionTimeSpent[qId] || 0
            savePromises.push(
              autoSaveAnswer(
                qId,
                compactCircuitSubmissionForAutoSave(circuitAnswer),
                "circuit_submission",
                undefined,
                capTimeSpent(qId, raw),
              ).catch(() => {}),
            )
          }
        }

        // Also check codeByQuestion for any code answers not already saved
        for (const [questionId, codeAnswer] of Object.entries(codeByQuestion)) {
          const qId = Number(questionId)
          if (questionsToSave.has(qId)) continue // Skip if already saving
          
          const question = quiz.questions.find(q => q.id === qId)
          if (question && codeAnswer && codeAnswer.trim() !== HELLO_WORLD.trim()) {
            const questionType = question.question_type?.toLowerCase() || "mcq"
            questionsToSave.add(qId)
            const replay = antiCheatConfig.keystrokePlaybackEnforced !== false ? typingReplayByQuestionRef.current[qId] : undefined
            const raw = qId === currentQuestion?.id
              ? Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[qId] || 0)
              : (questionTimeSpent[qId] || 0)
            savePromises.push(
              autoSaveAnswer(qId, codeAnswer, questionType, replay, capTimeSpent(qId, raw)).catch(() => {})
            )
          }
        }
        
        if (savePromises.length > 0) {
          // CRITICAL: During auto-submission, we need to be lenient with timeouts
          // Use Promise.allSettled with a maximum wait time to prevent hanging
          // Individual saves already have their own timeouts (5s for autoSaveAnswer)
          const saveTimeout = 30000 // 30 seconds max for all saves combined
          const saveTimeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve()
            }, saveTimeout)
          })
          
          // Race between all saves completing and timeout
          await Promise.race([
            Promise.allSettled(savePromises),
            saveTimeoutPromise
          ])
          
          // Give extra time for database to commit (only if saves completed)
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }

      // 2️⃣ Finalize attempt - ALWAYS proceed even if 0 answers (violations can occur before any answers)
      // SECURITY: keepalive lets the request complete even if the student closes the tab
      // to escape the violation auto-submit.
      const res = await studentApiFetch("/api/student/finalize-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          attemptId,
          autoSubmitted: true,
          violationReason: reason,
        }),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Finalize failed: ${res.status}`)
      }

      const result = await res.json()
      const { reportPath } = result

      // 3️⃣ Redirect
      window.location.href = reportPath

    } catch (err: any) {
      if (attemptId) {
        const reportPath = `/student/results/${attemptId}`
        window.location.href = reportPath
      }
    }
  }, [attemptId, quiz, answers, selectedAnswer, selectedMultiAnswers, code, codeByQuestion, currentQuestionIndex, autoSaveAnswer, questionTimeSpent, capTimeSpent, getCircuitAnswerJson, antiCheatConfig.keystrokePlaybackEnforced])

  // CRITICAL: Save current answer on exit/refresh/interruption (visibility change, tab close, refresh)
  // Ensures student code and answers are never lost
  const saveOnExitRef = useRef<{
    getPayload: () => { attemptId: number; questionId: number; answer: string; questionType: string } | null
    saveAll: () => void
  }>({ getPayload: () => null, saveAll: () => {} })
  useEffect(() => {
    const getPayload = () => {
      if (!attemptId || !quiz || isQuizFinalized || isLockedDueToViolations) return null
      const q = quiz.questions[currentQuestionIndex]
      if (!q) return null
      const qt = (q.question_type || "mcq").toLowerCase()
      let answer: string | null = null
      // All question types that use selectedAnswer (single string): mcq, true_false, fill_blank, code_output, trace_output, fill_code, trace_logic, scenario_match
      const textInputTypes = ["mcq", "true_false", "fill_blank", "code_output", "trace_output", "fill_code", "trace_logic", "scenario_match",
        "multi_part",
        "circuit_numeric", "circuit_worked_solution", "circuit_diagram_analysis", "circuit_multi_part", "circuit_fill_equation",
        "circuit_transfer_function", "circuit_phasor_power", "circuit_transient_response", "circuit_upload_work",
        "circuit_submission",
      ]
      if (textInputTypes.includes(qt)) {
        const sel = latestAnswerRef.current?.selectedAnswer ?? selectedAnswer
        if (sel !== undefined && sel !== null) answer = String(sel)
      } else if (qt === "select_all" || qt === "multi_output") {
        const multi = (latestAnswerRef.current?.selectedMultiAnswers?.length ? latestAnswerRef.current.selectedMultiAnswers : selectedMultiAnswers) || []
        if (multi.length > 0) answer = JSON.stringify(multi)
      } else if (["code_write", "code_problem", "debug_code", "code_write_plot", "code_explain", "code_debug"].includes(qt)) {
        const fromEditor = codeEditorRef.current?.getValue?.()
        const saved = latestAnswerRef.current?.codeByQuestion?.[q.id] ?? codeByQuestion[q.id]
        const codeState = latestAnswerRef.current?.code ?? code
        const raw = (fromEditor ?? saved ?? codeState ?? codeSyncRef.current ?? "") || ""
        if (qt === "code_write_plot" && plotByQuestion[q.id]) {
          answer = JSON.stringify({ code: raw, plotImage: plotByQuestion[q.id] })
        } else {
          answer = raw
        }
      }
      // For text types, allow empty string to save (student may have cleared)
      const codeTypes = ["code_write", "code_problem", "debug_code", "code_write_plot", "code_explain", "code_debug"]
      if (answer === null && !codeTypes.includes(qt)) return null
      const raw = Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[q.id] || 0)
      return { attemptId, questionId: q.id, answer: answer ?? "", questionType: qt, timeSpentSeconds: capTimeSpent(q.id, raw) }
    }
    const saveAll = () => {
      if (!attemptId || !quiz || isQuizFinalized || isLockedDueToViolations) return
      const current = quiz.questions[currentQuestionIndex]
      const saveOne = (qId: number, ans: string, qt: string, timeSpentSec?: number) => {
        const body: Record<string, unknown> = { attemptId, questionId: qId, answer: ans, questionType: qt, autoSave: true }
        if (timeSpentSec != null && timeSpentSec >= 0) body.timeSpentSeconds = timeSpentSec
        studentApiFetch("/api/student/save-answer", {
          method: "POST",
          headers: attemptApiHeaders(),
          body: JSON.stringify(body),
        }).catch(() => {})
      }
      if (current) {
        const p = getPayload()
        if (p) saveOne(p.questionId, p.answer, p.questionType, (p as { timeSpentSeconds?: number }).timeSpentSeconds)
      }
      for (const q of quiz.questions) {
        if (q.id === current?.id) continue
        const ans = answers[q.id] ?? codeByQuestion[q.id] ?? null
        if (ans != null) {
          const qt = (q.question_type || "mcq").toLowerCase()
          const toSave = typeof ans === "string" ? ans : (qt === "code_write_plot" && plotByQuestion[q.id] ? JSON.stringify({ code: ans, plotImage: plotByQuestion[q.id] }) : String(ans))
          const raw = questionTimeSpent[q.id] ?? 0
          saveOne(q.id, toSave, qt, capTimeSpent(q.id, raw))
        }
      }
    }
    saveOnExitRef.current = { getPayload, saveAll }
  }, [attemptId, quiz, currentQuestionIndex, isQuizFinalized, isLockedDueToViolations, selectedAnswer, selectedMultiAnswers, code, codeByQuestion, plotByQuestion, answers, questionTimeSpent, capTimeSpent])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveOnExitRef.current.saveAll()
      }
    }
    const handleBeforeUnload = () => {
      const p = saveOnExitRef.current.getPayload()
      if (p) {
        const body: Record<string, unknown> = { attemptId: p.attemptId, questionId: p.questionId, answer: p.answer, questionType: p.questionType, autoSave: true }
        if ((p as { timeSpentSeconds?: number }).timeSpentSeconds != null) body.timeSpentSeconds = (p as { timeSpentSeconds?: number }).timeSpentSeconds
        studentApiFetch("/api/student/save-answer", { method: "POST", headers: attemptApiHeaders(), body: JSON.stringify(body), keepalive: true }).catch(() => {})
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [])

  const { state: antiCheatState, closeWarning, logViolation, incrementGeminiStrike } = useAntiCheat({
    config: activeAntiCheatConfig,
    isAntiCheatSuspended: isSolutionUploadAntiCheatPaused,
    initialCounts: restoredViolationCounts ?? undefined,
    onViolation: () => {
      // Violation detected
    },
    onMaxViolations: (violationType: "tab_switch" | "gemini_window", count: number) => {
      // ✅ CRITICAL: Check guard FIRST (before any async operations) to prevent race conditions
      // This must be synchronous to prevent multiple calls from both reading false
      if (autoSubmitOnceRef.current) {
        // Already triggered - silently return (no logging to avoid spam)
        return
      }
      
      // ✅ ATOMIC: Set lock immediately (synchronous operation)
      autoSubmitOnceRef.current = true

      const currentConfig = antiCheatConfigRef.current
      
      // CRITICAL: For Gemini violations, finalize quiz and redirect to results (like Windows system)
      // This ensures students are redirected when max violations are reached
      if (violationType === "gemini_window") {
        console.log("[ANTI-CHEAT] ⚠️ Max Gemini strikes reached - finalizing quiz and redirecting to results", {
          count,
          maxStrikes: currentConfig.maxGeminiStrikes,
          timestamp: new Date().toISOString()
        })
        
        // Show warning message
        const violationEmoji = "🤖"
        toast({
          title: `${violationEmoji} Maximum Violations Reached! ${violationEmoji}`,
          description: "Your quiz has been finalized due to maximum AI tool violations. Redirecting to results...",
          variant: "destructive",
          duration: 3000,
          className: "bg-red-600 text-white border-2 border-red-300",
        })
        
        // Finalize quiz and redirect to results (same as Windows system)
        const reason = "AI tool usage (Gemini detected) - Maximum violations reached"
        finalizeQuizWithViolation(reason)
        return
      }
      
      // CRITICAL: Verify auto-submit is enabled before proceeding (for tab switches)
      if (!currentConfig.autoSubmitOnViolations) {
        return
      }

      const reason = violationType === "gemini_window"
        ? "AI tool usage (Gemini detected)"
        : "Excessive tab switching"

      // Creative and hilarious toast notification
      const violationEmoji = violationType === "gemini_window" ? "🤖" : "🔄"
      const violationMessage = violationType === "gemini_window" 
        ? "AI tools detected! Quiz guardian activated! 🎭"
        : "Too many tab switches! Quiz said 'That's enough!' 🎪"
      
      toast({
        title: `${violationEmoji} Quiz Auto-Submitted! ${violationEmoji}`,
        description: violationMessage,
        variant: "destructive",
        duration: 3000,
        className: "bg-[var(--cc-accent)] text-white border-2 border-purple-300",
      })

      // CRITICAL: Trigger auto-submission immediately
      finalizeQuizWithViolation(reason)
    },
    attemptId: attemptId?.toString(),
  })

  // SECURITY: react to server-side integrity stops. A hard-deadline expiry auto-submits the
  // saved work; a superseded session (attempt resumed in another window/device) freezes this
  // window with a notice — the newest window continues normally.
  useEffect(() => {
    if (!serverIntegrityStop) return
    if (serverIntegrityStop === "deadline_expired") {
      toast({
        title: "Time is up",
        description: "The assessment time limit has been reached. Your saved answers are being submitted.",
        variant: "destructive",
        duration: 6000,
      })
      finalizeQuizWithViolation("Time limit exceeded (server deadline reached)")
    } else {
      toast({
        title: "Attempt opened elsewhere",
        description:
          "This attempt was resumed in another window or device, so this window can no longer save answers. Continue in the newest window.",
        variant: "destructive",
        duration: 10000,
      })
    }
  }, [serverIntegrityStop, finalizeQuizWithViolation, toast])

  // Track Gemini detection state for blocking
  const [isGeminiBlocking, setIsGeminiBlocking] = useState(false)
  const lastStrikeIncrementRef = useRef<number>(0)
  const strikeDebounceDelay = 500 // Minimal debounce - only prevent rapid-fire duplicate events (500ms)
  const isCurrentlyHandlingGeminiRef = useRef<boolean>(false) // Track if we're already handling a detection
  const geminiCurrentlyDetectedRef = useRef<boolean>(false) // Track current detection state for use in callbacks
  const lastPopUpDismissedTimeRef = useRef<number>(0) // Track when pop-up was last dismissed

  // Stable callback to prevent infinite loops and double strikes
  const handleGeminiDetected = useCallback((reason: string) => {
    if (isSolutionUploadAntiCheatPaused()) {
      return
    }
    if (!isBrowserAiEnforcementPlatform()) {
      return
    }
    // CRITICAL: If Gemini tracking is disabled, do NOT process violations
    // This prevents violations from being counted when trackGeminiWindow is false
    if (!antiCheatConfig.trackGeminiWindow) {
      serverLog("QuizTaker", "Gemini detection ignored - tracking disabled")
      return
    }

    const now = Date.now()
    
    // CRITICAL: Only prevent duplicate strikes from the SAME pop-up opening
    // If pop-up was dismissed and reopened, it's a NEW violation - allow it immediately
    const timeSinceDismissal = now - lastPopUpDismissedTimeRef.current
    const timeSinceLastIncrement = now - lastStrikeIncrementRef.current
    
    // If pop-up was dismissed recently (within 1 second), this is a NEW pop-up - allow detection
    // Otherwise, use minimal debounce to prevent duplicate events from same pop-up
    const isNewPopUp = timeSinceDismissal > 0 && timeSinceDismissal < 1000
    const shouldDebounce = !isNewPopUp && timeSinceLastIncrement < strikeDebounceDelay
    
    if (shouldDebounce) {
      serverLog("QuizTaker", "Gemini detection debounced (same pop-up)", { timeSinceLastIncrement })
      return
    }
    
    // CRITICAL: If this is a new pop-up (dismissed and reopened), reset handling flag immediately
    if (isNewPopUp) {
      serverLog("QuizTaker", "✅ New pop-up detected after dismissal - resetting flags for new violation", {
        timeSinceDismissal
      })
      isCurrentlyHandlingGeminiRef.current = false
    }
    
    // Only block if we're currently handling the SAME pop-up (not a new one)
    if (isCurrentlyHandlingGeminiRef.current && !isNewPopUp) {
      serverLog("QuizTaker", "Gemini detection ignored - already handling current pop-up")
      return
    }

    serverLog("QuizTaker", "🚨 Processing Gemini POP-UP DETECTION: " + reason, {
      timestamp: new Date().toISOString(),
      attemptId: quiz?.id,
      currentStrikes: antiCheatState.geminiStrikes,
      maxStrikes: antiCheatConfig.maxGeminiStrikes,
      isNewPopUp,
      timeSinceDismissal
    })

    lastStrikeIncrementRef.current = now

    // Set flag to prevent multiple detections from the SAME pop-up opening
    // This flag will be reset when handleGeminiCleared is called
    isCurrentlyHandlingGeminiRef.current = true

    // CRITICAL: Block quiz interaction immediately when Gemini is detected
    // This ensures the screen is blurred and quiz is blocked while Gemini is active
    setIsGeminiBlocking(true)

    // Use the anti-cheat system's increment function which handles:
    // - Incrementing strike count (logs "detected" event to server)
    // - Logging violation
    // - Showing warning modal with strike count
    // - Auto-submitting if max strikes reached
    // CRITICAL: Always call incrementGeminiStrike - it will handle auto-submission internally
    // DO NOT log "active" here - only log "detected" when first detected (in incrementGeminiStrike)
    if (incrementGeminiStrike) {
      incrementGeminiStrike(reason)
      serverLog("QuizTaker", "✅ Violation logged to server - pop-up detected event sent", {
        currentStrikes: antiCheatState.geminiStrikes,
        expectedNewStrikes: antiCheatState.geminiStrikes + 1
      })
    } else {
      serverLog("QuizTaker", "incrementGeminiStrike is not available")
    }
  }, [incrementGeminiStrike, antiCheatConfig.trackGeminiWindow, antiCheatState.geminiStrikes, antiCheatConfig.maxGeminiStrikes, solutionUploadSuspendingAntiCheat])

  // Callback when Gemini is cleared by the detector (focus regained / panel closed)
  const handleGeminiCleared = useCallback(() => {
    geminiCurrentlyDetectedRef.current = false
    isCurrentlyHandlingGeminiRef.current = false
    lastPopUpDismissedTimeRef.current = Date.now()
    setIsGeminiBlocking(false)

    serverLog("QuizTaker", "✅ Gemini warning cleared by detector", {
      timestamp: new Date().toISOString(),
      attemptId: quiz?.id
    })

    if (logViolation && quiz?.id) {
      const dismissalReason = "Gemini pop-up dismissed/closed - detector reported the AI tool is no longer active"
      logViolation("gemini_window", dismissalReason, { eventType: "dismissed" })
    }

    closeWarning?.()
  }, [closeWarning, logViolation, quiz?.id])

  // Gemini detection during quiz - integrates with anti-cheat system
  const { 
    isDetected: geminiCurrentlyDetected, 
    clearDetection: clearGeminiDetection,
    isFullscreen: isInFullscreen,
    isFullscreenRequired: requiresFullscreen 
  } = useGeminiDetector({
    enabled:
      !antiCheatDisabledForTesting &&
      quizStarted &&
      !loading &&
      !isSolutionUploadAntiCheatPaused() &&
      ((antiCheatConfig.trackGeminiWindow && isBrowserAiEnforcementPlatform()) ||
        (antiCheatConfig.requireFullscreen === true && !isPhoneOrTabletDevice()) ||
        (isDesktopElectronAssessmentClient() && antiCheatConfig.requireFullscreen === true)),
    onDetected: handleGeminiDetected,
    onCleared: handleGeminiCleared,
    requireFullscreen: antiCheatDisabledForTesting ? false : antiCheatConfig.requireFullscreen,
    isDetectionPaused: isSolutionUploadAntiCheatPaused,
    // Skip browser-AI heuristics when: Electron shell (no browser panels exist) OR the quiz has
    // Gemini tracking disabled (the hook may still be enabled purely for the fullscreen lock —
    // detections in that mode would blur the quiz without ever showing a dismissible warning).
    skipBrowserAiHeuristics: isDesktopElectronAssessmentClient() || !antiCheatConfig.trackGeminiWindow,
  })

  const handleManualGeminiDismiss = useCallback(() => {
    geminiCurrentlyDetectedRef.current = false
    isCurrentlyHandlingGeminiRef.current = false
    lastPopUpDismissedTimeRef.current = Date.now()

    clearGeminiDetection?.()
    setIsGeminiBlocking(false)

    if (logViolation && quiz?.id) {
      logViolation(
        "gemini_window",
        "Gemini warning dismissed by student after closing the AI tool",
        { eventType: "dismissed", manual: true },
      )
    }

    closeWarning?.()
    serverLog("QuizTaker", "✅ Manual Gemini dismissal — warning closed and quiz unblocked")
  }, [clearGeminiDetection, closeWarning, logViolation, quiz?.id])

  // CRITICAL: On macOS, block quiz interaction if fullscreen is required but not active
  // NOTE: Fullscreen is not required on mobile devices, so this will always be false on mobile
  const isBlockedByFullscreen = requiresFullscreen && !isInFullscreen && quizStarted && !loading

  // Location check when geo is required - same pattern as fullscreen: block until verified
  const runLocationCheck = useCallback(() => {
    if (!quiz?.geo_required || quiz.geo_lat == null || quiz.geo_lng == null || typeof navigator === "undefined" || !navigator.geolocation) {
      return
    }
    const radiusM = Number(quiz.geo_radius_meters) || 100
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = distanceMeters(quiz.geo_lat!, quiz.geo_lng!, pos.coords.latitude, pos.coords.longitude)
        if (dist > radiusM) {
          setIsBlockedByLocation(true)
          setLocationError(`You are approximately ${Math.round(dist)} m away. You must be within ${radiusM} m to continue.`)
        } else {
          setIsBlockedByLocation(false)
          setLocationError(null)
        }
      },
      () => {
        setIsBlockedByLocation(true)
        setLocationError("Could not get your location. Enable location access and try again.")
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    )
  }, [quiz?.geo_required, quiz?.geo_lat, quiz?.geo_lng, quiz?.geo_radius_meters])

  useEffect(() => {
    if (!quizStarted || loading || !quiz?.geo_required || quiz.geo_lat == null || quiz.geo_lng == null) return
    const t = setTimeout(runLocationCheck, 5000)
    const interval = setInterval(runLocationCheck, 45000)
    return () => {
      clearTimeout(t)
      clearInterval(interval)
    }
  }, [quizStarted, loading, quiz?.id, quiz?.geo_required, quiz?.geo_lat, quiz?.geo_lng, quiz?.geo_radius_meters, runLocationCheck])

  // CRITICAL: Update blocking state based on current detection
  // This ensures the screen stays blurred and quiz stays blocked while Gemini is active
  // DO NOT auto-unblock here - only unblock when handleGeminiCleared is explicitly called
  useEffect(() => {
    // Update ref for use in callbacks
    geminiCurrentlyDetectedRef.current = geminiCurrentlyDetected
    
    // If Gemini is detected, keep the quiz blocked unless the student just dismissed.
    // Never block when Gemini tracking is disabled for this quiz — blocking without tracking
    // would blur the quiz without a warning modal or strikes (invisible lockout).
    if (geminiCurrentlyDetected && antiCheatConfigRef.current.trackGeminiWindow && !isSolutionUploadAntiCheatPaused()) {
      const justDismissed = Date.now() - lastPopUpDismissedTimeRef.current < 8000
      if (justDismissed) {
        return
      }
      setIsGeminiBlocking(true)
      serverLog("QuizTaker", "Gemini is active - keeping quiz blocked and blurred", {
        isGeminiBlocking: true,
        geminiCurrentlyDetected: true
      })
    } else {
      // CRITICAL: Only unblock if we're not currently handling a detection
      // This prevents unblocking while a detection is being processed
      // The handleGeminiCleared callback will explicitly unblock when dismissal is confirmed
      if (!isCurrentlyHandlingGeminiRef.current) {
        serverLog("QuizTaker", "Gemini not detected and not handling - checking if should unblock", {
          isGeminiBlocking,
          isCurrentlyHandling: isCurrentlyHandlingGeminiRef.current
        })
        // Only unblock if handleGeminiCleared was called (which resets the flag)
        // This ensures we don't unblock prematurely
      }
    }
    // DO NOT auto-unblock here - only unblock when handleGeminiCleared is called
    // This ensures the warning stays open and quiz stays blocked until Gemini is actually dismissed
  }, [geminiCurrentlyDetected, isGeminiBlocking])

  // CRITICAL: Block on window blur (macOS) only after a grace period to avoid false positives.
  // System overlays (Dictionary, Spotlight, right-click menu) cause brief blur; only block if
  // focus is lost for longer than BLUR_GRACE_MS so we don't punish accidental triggers.
  const BLUR_GRACE_MS = 2500
  useEffect(() => {
    if (!antiCheatConfig.trackGeminiWindow || !isBrowserAiEnforcementPlatform() || !quizStarted || loading) return
    if (isSolutionUploadAntiCheatPaused()) return

    let blurGraceTimer: ReturnType<typeof setTimeout> | null = null

    const handleWindowBlur = () => {
      if (isSolutionUploadAntiCheatPaused()) return
      if (typeof navigator === "undefined") return
      if (!isMacOSDesktop()) return

      const isVisible = typeof document !== "undefined" && !document.hidden
      if (!isVisible) return

      // Only block after grace period so Dictionary/Spotlight/menus don't trigger
      blurGraceTimer = setTimeout(() => {
        blurGraceTimer = null
        console.log("[ANTI-CHEAT] Window blur sustained (macOS) - blocking quiz after grace period", {
          isVisible,
          hasFocus: document.hasFocus(),
          timestamp: new Date().toISOString()
        })
        setIsGeminiBlocking(true)
      }, BLUR_GRACE_MS)
    }

    const handleWindowFocus = () => {
      if (blurGraceTimer) {
        clearTimeout(blurGraceTimer)
        blurGraceTimer = null
      }
    }

    window.addEventListener("blur", handleWindowBlur)
    window.addEventListener("focus", handleWindowFocus)

    return () => {
      window.removeEventListener("blur", handleWindowBlur)
      window.removeEventListener("focus", handleWindowFocus)
      if (blurGraceTimer) clearTimeout(blurGraceTimer)
    }
  }, [antiCheatConfig.trackGeminiWindow, quizStarted, loading, solutionUploadSuspendingAntiCheat, isSolutionUploadAntiCheatPaused])

  // Auto-Dismiss Logic: Listen for window regaining focus on macOS
  // When focus is regained, safely assume the student has finished interacting with the external tool
  useEffect(() => {
    const handleWindowFocus = () => {
      // If the warning is currently showing, and it's specifically for Gemini
      if (antiCheatState.showWarning && antiCheatState.warningType === "gemini_window") {
        console.log("[ANTI-CHEAT] ✅ Focus regained. Auto-dismissing macOS Gemini warning.", {
          showWarning: antiCheatState.showWarning,
          warningType: antiCheatState.warningType,
          timestamp: new Date().toISOString()
        })
        
        // Clear detection state in hook to allow future detections
        if (clearGeminiDetection) {
          clearGeminiDetection()
        }
        
        // Reset handling flag
        isCurrentlyHandlingGeminiRef.current = false
        lastPopUpDismissedTimeRef.current = Date.now() // Track dismissal time to detect new pop-ups
        
        // Unblock the quiz
        setIsGeminiBlocking(false)
        
        // Log dismissal event to server
        if (logViolation && quiz?.id) {
          const dismissalReason = "Gemini pop-up dismissed/closed - window focus regained (auto-dismiss)"
          logViolation("gemini_window", dismissalReason, { eventType: "dismissed", autoDismissed: true })
          console.log("[ANTI-CHEAT] ✅ Auto-dismissal logged to server", {
            reason: dismissalReason,
            attemptId: quiz.id
          })
        }
        
        // We use a small delay to ensure the OS has fully handed focus back
        setTimeout(() => {
          if (closeWarning) {
            closeWarning()
            console.log("[ANTI-CHEAT] Warning dismissed after focus regained")
          }
        }, 400)
      } else if (isGeminiBlocking && !antiCheatState.showWarning) {
        // Focus regained but warning not showing - unblock immediately
        console.log("[ANTI-CHEAT] ✅ Focus regained - unblocking quiz (no warning shown)", {
          isGeminiBlocking,
          timestamp: new Date().toISOString()
        })
        
        setIsGeminiBlocking(false)
        
        // Clear detection state
        if (clearGeminiDetection) {
          clearGeminiDetection()
        }
        
        // Reset handling flag
        isCurrentlyHandlingGeminiRef.current = false
        lastPopUpDismissedTimeRef.current = Date.now() // Track dismissal time to detect new pop-ups
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    
    return () => {
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [antiCheatState.showWarning, antiCheatState.warningType, closeWarning, clearGeminiDetection, logViolation, quiz?.id, isGeminiBlocking])

  // Track last event handling time to prevent duplicate processing
  const lastEventHandledRef = useRef<number>(0)
  const eventHandlingDebounce = 5000 // Only handle events once every 5 seconds

  // Listen for Gemini detections from question-renderer components
  useEffect(() => {
    if (!antiCheatConfig.trackGeminiWindow || !isBrowserAiEnforcementPlatform() || !quizStarted || loading) return

    const handleGeminiDetected = (event: CustomEvent) => {
      if (isSolutionUploadAntiCheatPaused()) return
      // Debounce: prevent handling the same detection multiple times
      const now = Date.now()
      if (now - lastEventHandledRef.current < eventHandlingDebounce) {
        return
      }
      lastEventHandledRef.current = now

      // Also check strike debounce to prevent double strikes
      if (now - lastStrikeIncrementRef.current < strikeDebounceDelay) {
        return
      }
      lastStrikeIncrementRef.current = now

      const { questionId, reason } = event.detail
      
      // Block quiz interaction
      setIsGeminiBlocking(true)
      
      // Use the anti-cheat system's increment function which handles:
      // - Incrementing strike count
      // - Logging violation
      // - Showing warning modal with strike count
      // - Auto-submitting if max strikes reached
      // CRITICAL: Always call incrementGeminiStrike - it will handle auto-submission internally
      if (incrementGeminiStrike) {
        incrementGeminiStrike(`Question ${questionId}: ${reason}`)
      } else {
        // incrementGeminiStrike is not available
      }
    }

    window.addEventListener("gemini-detected", handleGeminiDetected as EventListener)

    return () => {
      window.removeEventListener("gemini-detected", handleGeminiDetected as EventListener)
    }
  }, [antiCheatConfig.trackGeminiWindow, quizStarted, loading, incrementGeminiStrike, eventHandlingDebounce, strikeDebounceDelay, solutionUploadSuspendingAntiCheat])

  const [questionTimeRemaining, setQuestionTimeRemaining] = useState<Record<number, number>>({})
  const [sectionTimeRemaining, setSectionTimeRemaining] = useState<Record<number, number>>({})
  const [sectionQuestionSelections, setSectionQuestionSelections] = useState<SectionQuestionSelections>({})
  const sectionQuestionSelectionsRef = useRef<SectionQuestionSelections>({})
  const [expiredSections, setExpiredSections] = useState<Set<number>>(new Set())
  const [currentSectionTimeLeft, setCurrentSectionTimeLeft] = useState(-1)
  const [sectionTimerStarting, setSectionTimerStarting] = useState(false)

  useEffect(() => {
    quizForTimerRef.current = quiz
  }, [quiz])

  useEffect(() => {
    currentQuestionIndexForTimerRef.current = currentQuestionIndex
  }, [currentQuestionIndex])

  useEffect(() => {
    timerExpiredForQuestionRef.current = timerExpiredForQuestion
  }, [timerExpiredForQuestion])

  useEffect(() => {
    lockedQuestionsForTimerRef.current = lockedQuestions
  }, [lockedQuestions])

  useEffect(() => {
    expiredSectionsRef.current = expiredSections
  }, [expiredSections])

  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set())
  // savedAnswers moved earlier (before autoSaveAnswer) - see line 393
  const [showQuestionNav, setShowQuestionNav] = useState(false)
  const [showUnsavedAnswersDialog, setShowUnsavedAnswersDialog] = useState(false)
  const [unsavedQuestionIds, setUnsavedQuestionIds] = useState<number[]>([])
  const [skipSolutionUploadDialog, setSkipSolutionUploadDialog] = useState<{
    uploadMaxPoints: number
    onConfirm: () => void
  } | null>(null)
  const confirmedSkipSolutionUploadRef = useRef<Set<number>>(new Set())

  // Block browser AI tools during assessments (excludes CodeBench)
  useBrowserAIBlocker({
    enabled: !antiCheatDisabledForTesting,
    assessmentType: effectiveType,
  })

  // Comprehensive AI content protection
  useAIProtection(!antiCheatDisabledForTesting)

  // Clear clipboard when copy/paste is blocked (pre-scoped paste exploit)
  useEffect(() => {
    if (!quizStarted || antiCheatConfig.blockCopyPaste !== true) return

    const clearClipboard = async () => {
      try {
        if (typeof document !== "undefined" && !document.hasFocus()) return
        await navigator.clipboard?.writeText?.("")
      } catch {
        /* NotAllowedError when document is not focused or clipboard permission denied */
      }
    }

    void clearClipboard()
    const onFocus = () => {
      void clearClipboard()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [quizStarted, antiCheatConfig.blockCopyPaste])

  // const [answerQueue, setAnswerQueue] = useState<
  //   Array<{
  //     questionId: number
  //     answer: any
  //     questionType: string
  //     attemptNumber: number
  //     timestamp: number
  //   }>
  // >([])
  // const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const handleUseHint = async (questionId: number, hintPenalty: number) => {
    if (!attemptId) return
    const alreadyUsed = usedHints.has(questionId)
    // Allow a re-fetch when the hint was used but the text is missing locally
    // (e.g. after a refresh) — the server records usage/penalty only once.
    if (alreadyUsed && hintTextByQuestionId[questionId] != null) return

    setShowHint(true)
    setUsedHints((prev) => new Set(prev).add(questionId))

    try {
      const response = await studentApiFetch("/api/student/use-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          questionId,
          hintPenalty,
        }),
      })

      // SECURITY: hint text is not in the take payload — the server reveals it
      // here, after the usage/penalty has been recorded.
      if (response.ok) {
        const data = await response.json().catch(() => null)
        if (data && typeof data.hint === "string" && data.hint.trim().length > 0) {
          setHintTextByQuestionId((prev) => ({ ...prev, [questionId]: data.hint }))
        }
      }

      if (!alreadyUsed) {
        toast({
          title: "Hint Revealed",
          description: `A penalty of ${hintPenalty} point(s) has been applied.`,
          variant: "default",
        })
      }
    } catch (error) {
      // Failed to use hint
    }
  }

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      toast({
        title: "✅ Connection Restored",
        description: "You're back online. Syncing your answers...",
      })
      // Process queued answers
      processAnswerQueue()
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast({
        title: "⚠️ Connection Lost",
        description: "You're offline. Your answers will be saved locally and synced when connection is restored.",
        variant: "destructive",
        duration: 10000,
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check initial status
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentId")
    if (!studentId) {
      router.push("/student/login")
      return
    }

    checkPasswordStatus(studentId)
  }, [quizId, router])

  // Resume check: If we have an incomplete attempt for this quiz, show dialog (Continue Quiz | Restart Quiz)
  const resumeCheckRef = useRef(false)
  const detailLaunchRef = useRef(false)
  useEffect(() => {
    if (resumeCheckRef.current) return

    const checkResume = async () => {
      await new Promise((r) => setTimeout(r, 400))
      const studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
      serverLog("QuizTaker RESUME", "checkResume running", { quizId, studentDatabaseId, assessmentType: normalizedType })
      if (!studentDatabaseId || !quizId) {
        serverLog("QuizTaker RESUME", "early return - no studentId or quizId")
        return
      }

      try {
        const url = `/api/student/quiz-attempt/${quizId}?studentId=${studentDatabaseId}`
        serverLog("QuizTaker RESUME", "fetching", { url })
        const res = await fetch(url)
        const data = await res.json()
        serverLog("QuizTaker RESUME", "attempt API response", {
          ok: res.ok,
          attemptId: data.attemptId,
          completedAt: data.completedAt,
          hasSaveAndFinishLaterAccess: data.hasSaveAndFinishLaterAccess,
        })
        if (!res.ok) {
          serverLog("QuizTaker RESUME", "API not ok, skipping resume")
          return
        }
        if (data.hasSaveAndFinishLaterAccess !== undefined) {
          setHasSaveAndFinishLaterAccess(data.hasSaveAndFinishLaterAccess)
        }
        if (data.attemptId && !data.completedAt) {
          if (fromDetail && detailAction === "continue") {
            serverLog("QuizTaker RESUME", "fromDetail continue - auto-resuming", { attemptId: data.attemptId })
            resumeCheckRef.current = true
            setShowResumeDialog(false)
            setShowInstructions(false)
            setResumeAttemptId(data.attemptId)
            const sp = Array.isArray(data.superpowers)
              ? data.superpowers.filter((x: unknown): x is string => typeof x === "string")
              : []
            setResumeAttemptSuperpowers(sp)
            if (enableSuperpowers && sp.length > 0) {
              selectedSuperpowersForAttemptRef.current = [...sp]
            }
            setLoading(true)
            setQuizStarted(true)
            resetSessionId()
            queueEvent("quiz", "lifecycle", "QUIZ_RESUME", { quizId, assessmentType: normalizedType }, "info")
            setTimeout(() => fetchQuiz(), 100)
            return
          }
          if (fromDetail && (detailAction === "start" || detailAction === "retake")) {
            resumeCheckRef.current = true
            setShowResumeDialog(false)
            serverLog("QuizTaker RESUME", "fromDetail fresh start - skipping resume dialog")
            return
          }
          serverLog("QuizTaker RESUME", "Incomplete attempt found - showing resume dialog")
          resumeCheckRef.current = true
          setResumeAttemptId(data.attemptId)
          setResumeCanRestart(data.canRestart !== false)
          setResumeRestartBlockedReason(
            typeof data.restartBlockedReason === "string" ? data.restartBlockedReason : null,
          )
          const sp = Array.isArray(data.superpowers)
            ? data.superpowers.filter((x: unknown): x is string => typeof x === "string")
            : []
          setResumeAttemptSuperpowers(sp)
          setShowResumeDialog(true)
        } else {
          setResumeAttemptSuperpowers([])
          setResumeCanRestart(true)
          setResumeRestartBlockedReason(null)
          serverLog("QuizTaker RESUME", "no incomplete attempt - will show instructions", { attemptId: data.attemptId, completedAt: data.completedAt })
        }
      } catch (err) {
        serverLog("QuizTaker RESUME", "error", { err: String(err) })
      }
    }

    checkResume()
  }, [quizId, fromDetail, detailAction, enableSuperpowers, normalizedType])

  useEffect(() => {
    if (!fromDetail || !configLoaded || detailLaunchRef.current) return
    if (detailAction !== "start" && detailAction !== "retake") return
    if (geoRequired || enableSuperpowers) {
      setShowInstructions(true)
      return
    }
    if (showResumeDialog) return

    detailLaunchRef.current = true
    resetSessionId()
    queueEvent("quiz", "lifecycle", "QUIZ_START", { quizId, assessmentType: effectiveType }, "info")
    setShowInstructions(false)
    setLoading(true)
    setQuizStarted(true)
    setTimeout(() => fetchQuiz(), 100)
  }, [
    fromDetail,
    detailAction,
    configLoaded,
    geoRequired,
    enableSuperpowers,
    showResumeDialog,
    quizId,
    effectiveType,
  ])

  // Animate through loading steps
  useEffect(() => {
    if (!loading) {
      setLoadingStep(0)
      return
    }

    // Progress through steps: 0 -> 1 -> 2 -> 3
    const intervals = [
      500,  // Step 0 (session verified) -> Step 1 (loading questions) after 500ms
      800,  // Step 1 -> Step 2 (initializing timer) after 800ms
      600,  // Step 2 -> Step 3 (setting up environment) after 600ms
    ]

    const timers: NodeJS.Timeout[] = []
    let currentStep = 0

    intervals.forEach((delay, index) => {
      const timer = setTimeout(() => {
        currentStep = index + 1
        setLoadingStep(currentStep)
      }, intervals.slice(0, index + 1).reduce((a, b) => a + b, 0))
      timers.push(timer)
    })

    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [loading])

  // Mark question as rendered after a short delay
  useEffect(() => {
    setQuestionRendered(false)
    const renderTimeout = setTimeout(() => {
      setQuestionRendered(true)
    }, 500) // Wait for DOM to render

    return () => clearTimeout(renderTimeout)
  }, [currentQuestionIndex])

  useEffect(() => {
    if (!quiz?.questions?.[currentQuestionIndex]) return
    const q = quiz.questions[currentQuestionIndex]
    if (
      !canStudentAskCora(q.question_type, {
        subquestionTypes: parseSubquestions(q.subquestions).map((sq) => sq.type),
      })
    ) {
      setCoraDrawerOpen(false)
    }
  }, [currentQuestionIndex, quiz])

  // Notify parent component when question changes
  const onQuestionChangeRef = useRef(onQuestionChange)
  onQuestionChangeRef.current = onQuestionChange

  useEffect(() => {
    const notify = onQuestionChangeRef.current
    if (quiz && quiz.questions && quiz.questions[currentQuestionIndex] && notify) {
      const currentQuestion = quiz.questions[currentQuestionIndex]
      notify(currentQuestion, {
        section_config: quiz.section_config ?? null,
      })
    } else if (notify) {
      notify(null, { section_config: null })
    }
  }, [currentQuestionIndex, quiz])

  // Persist quiz progress to database (enables resume on refresh / browser close-reopen)
  const progressSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedIndexRef = useRef<number | null>(null)
  const attemptIdRef = useRef<number | null>(null)
  const currentIndexRef = useRef(0)
  const questionTimeRemainingRef = useRef<Record<string, number>>({})
  const sectionTimeRemainingRef = useRef<Record<string, number>>({})
  attemptIdRef.current = attemptId
  currentIndexRef.current = currentQuestionIndex
  const isViewingQuestionIndex = (questionIndex: number) =>
    questionIndex >= 0 && currentIndexRef.current === questionIndex
  questionTimeRemainingRef.current = questionTimeRemaining
  sectionTimeRemainingRef.current = sectionTimeRemaining
  sectionQuestionSelectionsRef.current = sectionQuestionSelections

  const persistSectionQuestionSelections = useCallback(
    (next: SectionQuestionSelections) => {
      setSectionQuestionSelections(next)
      sectionQuestionSelectionsRef.current = next
      if (!attemptId || isQuizFinalized) return
      studentApiFetch("/api/student/quiz-progress", {
        method: "POST",
        headers: attemptApiHeaders(),
        body: JSON.stringify({ attemptId, sectionQuestionSelections: next }),
      }).catch(() => {})
    },
    [attemptId, isQuizFinalized],
  )

  /** Freeze the active per-question timer before navigating away. */
  const pauseActivePerQuestionTimer = useCallback(() => {
    if (!quiz) return
    const currentQ = quiz.questions[currentQuestionIndex]
    if (!currentQ) return
    if (!questionUsesPerQuestionTimer(currentQ.question_type, currentQuestionIndex)) return
    const remaining =
      globalQuestionTimersRef.current[currentQ.id] ??
      questionTimeRemainingRef.current[currentQ.id] ??
      timeLeft
    if (remaining < 0) return
    globalQuestionTimersRef.current[currentQ.id] = remaining
    setQuestionTimeRemaining((prev) =>
      prev[currentQ.id] === remaining ? prev : { ...prev, [currentQ.id]: remaining },
    )
  }, [quiz, currentQuestionIndex, timeLeft, questionUsesPerQuestionTimer])

  const getSanitizedTimerPayload = useCallback(() => {
    if (!quiz?.questions?.length) {
      return {
        questionTimeRemaining: questionTimeRemainingRef.current,
        sectionTimeRemaining: sectionTimeRemainingRef.current,
      }
    }
    return sanitizeAttemptTimerState(
      quiz.questions.map((q) => ({
        id: q.id,
        question_type: q.question_type,
        question_order: (q as { question_order?: number }).question_order,
      })),
      parsedSectionConfig,
      questionTimeRemainingRef.current,
      sectionTimeRemainingRef.current,
      undefined,
      effectiveType,
    )
  }, [quiz, parsedSectionConfig, effectiveType])

  /** Persist live timer refs immediately (Continue Later must not lose section/exam pool time). */
  const flushQuizProgressNow = useCallback(async () => {
    if (!quiz?.id || !attemptId || isQuizFinalized) return
    if (progressSaveRef.current) {
      clearTimeout(progressSaveRef.current)
      progressSaveRef.current = null
    }
    const { questionTimeRemaining: qtr, sectionTimeRemaining: str } = sanitizeAttemptTimerState(
      quiz.questions.map((q) => ({
        id: q.id,
        question_type: q.question_type,
        question_order: (q as { question_order?: number }).question_order,
      })),
      parsedSectionConfigRef.current ?? parsedSectionConfig,
      globalQuestionTimersRef.current,
      globalSectionTimersRef.current,
      { fillMissingToFull: false },
      effectiveType,
    )
    await studentApiFetch("/api/student/quiz-progress", {
      method: "POST",
      headers: attemptApiHeaders(),
      body: JSON.stringify({
        attemptId,
        currentQuestionIndex,
        questionTimeRemaining: qtr,
        sectionTimeRemaining: str,
        sectionQuestionSelections: sectionQuestionSelectionsRef.current,
      }),
    })
    return { questionTimeRemaining: qtr, sectionTimeRemaining: str }
  }, [quiz, attemptId, currentQuestionIndex, isQuizFinalized, parsedSectionConfig])

  useEffect(() => {
    if (!quiz?.id || !attemptId || isQuizFinalized) return
    const { questionTimeRemaining: qtr, sectionTimeRemaining: str } = getSanitizedTimerPayload()
    const payload = {
      attemptId,
      currentQuestionIndex,
      questionTimeRemaining: qtr,
      sectionTimeRemaining: str,
      sectionQuestionSelections: sectionQuestionSelectionsRef.current,
    }
    if (lastSavedIndexRef.current !== currentQuestionIndex) {
      lastSavedIndexRef.current = currentQuestionIndex
      studentApiFetch("/api/student/quiz-progress", {
        method: "POST",
        headers: attemptApiHeaders(),
        body: JSON.stringify(payload),
      }).catch(() => {})
      return
    }
    if (progressSaveRef.current) clearTimeout(progressSaveRef.current)
    progressSaveRef.current = setTimeout(() => {
      progressSaveRef.current = null
      studentApiFetch("/api/student/quiz-progress", {
        method: "POST",
        headers: attemptApiHeaders(),
        body: JSON.stringify(payload),
      }).catch(() => {})
    }, 800)
    return () => {
      if (progressSaveRef.current) clearTimeout(progressSaveRef.current)
    }
  }, [quiz?.id, attemptId, currentQuestionIndex, questionTimeRemaining, sectionTimeRemaining, isQuizFinalized, getSanitizedTimerPayload])

  // Save progress on visibilitychange / beforeunload so refresh/close preserves state
  useEffect(() => {
    const saveProgress = () => {
      const aid = attemptIdRef.current
      const idx = currentIndexRef.current
      if (!aid || idx < 0) return
      const { questionTimeRemaining: qtr, sectionTimeRemaining: str } = getSanitizedTimerPayload()
      studentApiFetch("/api/student/quiz-progress", {
        method: "POST",
        headers: attemptApiHeaders(),
        body: JSON.stringify({
          attemptId: aid,
          currentQuestionIndex: idx,
          questionTimeRemaining: qtr,
          sectionTimeRemaining: str,
        }),
        keepalive: true,
      }).catch(() => {})
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") saveProgress()
    }
    const handleBeforeUnload = () => saveProgress()
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [getSanitizedTimerPayload])

  useEffect(() => {
    if (!quiz) return
    if (!questionRendered) return

    const currentQuestion = quiz.questions?.[currentQuestionIndex]
    if (!currentQuestion) return

    const sectionCfg = getSectionConfigAt(currentQuestionIndex)
    const perQuestion = questionUsesPerQuestionTimer(currentQuestion.question_type, currentQuestionIndex)
    const sectionTimed = usesSectionCountdown(sectionCfg, effectiveType)

    if (sectionTimed && currentSectionIndex != null) {
      setTimeLeft(-1)
      setTimerStarting(false)
      if (expiredSectionsRef.current.has(currentSectionIndex)) {
        setCurrentSectionTimeLeft(0)
        setSectionTimerStarting(false)
        return
      }
      const parsedCfg = parsedSectionConfigRef.current
      const examShared = getExamSharedTimerSeconds(parsedCfg)
      const timerKey =
        examShared != null ? EXAM_SHARED_TIMER_SECTION_KEY : currentSectionIndex
      const totalSec = examShared ?? resolveSectionTotalTimeSeconds(sectionCfg, sectionTimerContext)
      const existingSection =
        readExamSharedSectionSeconds(globalSectionTimersRef.current, parsedCfg) ??
        globalSectionTimersRef.current[timerKey] ??
        sectionTimeRemainingRef.current[timerKey] ??
        sectionTimeRemainingRef.current[currentSectionIndex]
      let initialSection =
        existingSection !== undefined ? existingSection : totalSec
      // Stale persisted 0 (e.g. mis-grouped per-question expiry) must not instantly lock Section II.
      if (
        initialSection <= 0 &&
        !expiredSectionsRef.current.has(currentSectionIndex) &&
        totalSec > 0 &&
        !resumeFromSaveLaterRef.current
      ) {
        const sec = sectionsRef.current.find((s) => s.sectionIndex === currentSectionIndex)
        const allCircuitLocked =
          sec?.questionIndices.every((qi) => {
            const q = quiz.questions[qi]
            return q && lockedQuestionsForTimerRef.current.has(q.id)
          }) ?? false
        if (!allCircuitLocked) {
          initialSection = totalSec
        }
      }
      if (examShared != null) {
        syncExamSharedSectionTimers(globalSectionTimersRef.current, parsedCfg, initialSection)
      } else {
        globalSectionTimersRef.current[timerKey] = initialSection
      }
      if (sectionGraceEndsAtRef.current[currentSectionIndex] === undefined) {
        sectionGraceEndsAtRef.current[currentSectionIndex] = Date.now() + 2000
      }
      setSectionTimeRemaining((prev) => {
        if (examShared != null) {
          const next = { ...prev, [EXAM_SHARED_TIMER_SECTION_KEY]: initialSection }
          parsedCfg?.forEach((cfg, idx) => {
            if (usesSectionCountdown(cfg, effectiveType)) next[idx] = initialSection
          })
          return next
        }
        return prev[currentSectionIndex] === initialSection
          ? prev
          : { ...prev, [currentSectionIndex]: initialSection }
      })
      setCurrentSectionTimeLeft(initialSection)
      setSectionTimerStarting(
        Date.now() < (sectionGraceEndsAtRef.current[currentSectionIndex] ?? 0),
      )
      delete globalQuestionTimersRef.current[currentQuestion.id]
      return
    }

    if (!perQuestion) {
      delete globalQuestionTimersRef.current[currentQuestion.id]
      delete questionGraceEndsAtRef.current[currentQuestion.id]
      setTimeLeft(-1)
      setTimerStarting(false)
      setCurrentSectionTimeLeft(-1)
      return
    }

    const extraTime = (quiz as any).extraTimePerQuestion || 0
    const isCodeQuestion = ["code_write", "code_problem", "debug_code"].includes(
      (currentQuestion.question_type || "").toLowerCase(),
    )
    const timeLimit =
      resolveQuestionTimeLimitSeconds(
        currentQuestion.question_type,
        currentQuestion.time_limit,
        quiz.time_per_question,
        sectionCfg,
        courseTimer,
        { hasDiagram: questionHasCircuitDiagram(currentQuestion) },
      ) + (isCodeQuestion ? extraTime : 0)

    if (timerExpiredForQuestion.has(currentQuestion.id) || lockedQuestions.has(currentQuestion.id)) {
      setTimeLeft(0)
      setTimerStarting(false)
      setCurrentSectionTimeLeft(-1)
      return
    }

    if (questionStartTimeRef.current) {
      const timeSpent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000)
      setQuestionTimeSpent((prev) => ({
        ...prev,
        [currentQuestion.id]: (prev[currentQuestion.id] || 0) + timeSpent,
      }))
    }

    const existingTimeRemaining =
      globalQuestionTimersRef.current[currentQuestion.id] ??
      questionTimeRemainingRef.current[currentQuestion.id]
    const wasVisitedBefore = visitedPerQuestionTimerRef.current.has(currentQuestion.id)
    const initialTime = wasVisitedBefore
      ? existingTimeRemaining !== undefined
        ? existingTimeRemaining
        : timeLimit
      : timeLimit

    visitedPerQuestionTimerRef.current.add(currentQuestion.id)
    globalQuestionTimersRef.current[currentQuestion.id] = initialTime
    if (!wasVisitedBefore || questionGraceEndsAtRef.current[currentQuestion.id] === undefined) {
      questionGraceEndsAtRef.current[currentQuestion.id] = Date.now() + 2000
    }

    setTimeLeft(initialTime)
    setCurrentSectionTimeLeft(-1)
    setQuestionTimeRemaining((prev) =>
      prev[currentQuestion.id] === initialTime
        ? prev
        : { ...prev, [currentQuestion.id]: initialTime },
    )
    questionStartTimeRef.current = Date.now()

    setTimerStarting(Date.now() < (questionGraceEndsAtRef.current[currentQuestion.id] ?? 0))
    if (timerStartDelayRef.current) {
      clearTimeout(timerStartDelayRef.current)
    }
    timerStartDelayRef.current = setTimeout(() => {
      setTimerStarting(false)
    }, Math.max(0, (questionGraceEndsAtRef.current[currentQuestion.id] ?? Date.now()) - Date.now()))
  }, [
    currentQuestionIndex,
    quiz,
    timerExpiredForQuestion,
    lockedQuestions,
    questionRendered,
    currentSectionIndex,
    getSectionConfigAt,
    questionUsesPerQuestionTimer,
    expiredSections,
    sectionTimerContext,
    courseTimer,
  ])

  // REMOVED: Duplicate code restoration logic - handled in the main useEffect below

  // useEffect(() => {
  //   autoSaveIntervalRef.current = setInterval(() => {
  //     if (answerQueue.length > 0) {
  //       batchSaveAnswers()
  //     }
  //   }, 30000) // 30 seconds

  //   return () => {
  //     if (autoSaveIntervalRef.current) {
  //       clearInterval(autoSaveIntervalRef.current)
  //     }
  //   }
  // }, [answerQueue])

  // useEffect(() => {
  //   return () => {
  //     if (answerQueue.length > 0) {
  //       batchSaveAnswers()
  //     }
  //   }
  // }, [answerQueue])

  const applyEvalFeedbackForQuestion = useCallback((questionId: number) => {
    if (pendingEvaluations.has(questionId)) return
    const stored = evalByQuestionRef.current[questionId]
    const parsed = parseStoredAiFeedback(stored)
    if (parsed) {
      setAiFeedback(parsed)
      setShowFeedback(true)
      return
    }
    setShowFeedback(false)
    setAiFeedback(null)
  }, [pendingEvaluations])

  const rememberObjectiveGrade = useCallback(
    (questionId: number, evalData: Record<string, unknown> | null | undefined, maxPointsFallback?: number) => {
      if (!evalData) return
      const pointsEarned = Number(evalData.pointsEarned ?? 0)
      const maxPoints = Math.max(
        0,
        Number(evalData.maxPoints ?? maxPointsFallback ?? 0) || (pointsEarned > 0 ? pointsEarned : 1),
      )
      let isCorrect: boolean | null =
        typeof evalData.isCorrect === "boolean" ? evalData.isCorrect : null
      if (isCorrect == null && evalData.pointsEarned != null) {
        isCorrect = pointsEarned >= maxPoints - 0.001
      }
      if (isCorrect == null) return
      const score =
        typeof evalData.score === "number"
          ? evalData.score
          : maxPoints > 0
            ? (pointsEarned / maxPoints) * 100
            : isCorrect
              ? 100
              : 0
      const feedbackObj =
        evalData.aiFeedback && typeof evalData.aiFeedback === "object"
          ? (evalData.aiFeedback as Record<string, unknown>)
          : null
      const correctLetters = Array.isArray(evalData.correctLetters)
        ? evalData.correctLetters.map(String).filter(Boolean)
        : Array.isArray(feedbackObj?.correctLetters)
          ? feedbackObj.correctLetters.map(String).filter(Boolean)
          : undefined
      objectiveGradeByQuestionRef.current[questionId] = {
        isCorrect,
        pointsEarned,
        score,
        feedback: typeof evalData.feedback === "string" ? evalData.feedback : undefined,
        maxPoints: maxPoints || undefined,
        correctLetters: correctLetters?.length ? correctLetters : undefined,
      }
      setQuestionsWithObjectiveGrade((prev) => new Set(prev).add(questionId))
    },
    [],
  )

  const applyObjectiveGradeForQuestion = useCallback(
    (questionId: number, questionType?: string, maxPointsFallback?: number) => {
      const qt = (questionType || "").toLowerCase()
      if (!isObjectiveAutoGradedType(qt)) return false
      const grade = objectiveGradeByQuestionRef.current[questionId]
      if (!grade) return false
      setIsCorrect(grade.isCorrect)
      setPartialCreditPoints(grade.pointsEarned)
      const isSelectAllType = qt === "select_all" || qt === "multi_output"
      setShowFeedback(!isSelectAllType)
      if (!isSelectAllType && grade.feedback && grade.feedback !== "Processing...") {
        setAiFeedback({
          feedback: grade.feedback,
          isCorrect: grade.isCorrect,
          pointsEarned: grade.pointsEarned,
          score: grade.score,
          maxPoints: grade.maxPoints ?? maxPointsFallback,
          locallyVerified: true,
        })
      } else {
        setAiFeedback(null)
      }
      return true
    },
    [],
  )

  const rememberEvalFeedback = useCallback((questionId: number, evalData: Record<string, unknown> | null | undefined, maxPointsFallback?: number) => {
    rememberObjectiveGrade(questionId, evalData, maxPointsFallback)
    const parsed = parseStoredAiFeedback(evalData)
    if (parsed) {
      evalByQuestionRef.current[questionId] = parsed
      setQuestionsWithStoredEval((prev) => new Set(prev).add(questionId))
    }
  }, [rememberObjectiveGrade])

  // Auto-dismiss non-AI instant feedback; keep Quiz Master / instructor feedback restorable per question
  useEffect(() => {
    if (!showFeedback || !aiFeedback) return
    const qt = (
      quiz?.questions?.[currentQuestionIndex]?.question_type ||
      aiFeedback.questionType ||
      ""
    )
      .toString()
      .toLowerCase()
    if (isPersistentEvalFeedback(aiFeedback, qt)) {
      const hide = () => setShowFeedback(false)
      const handler = () => hide()
      window.addEventListener("cc-feedback-close" as any, handler)
      return () => window.removeEventListener("cc-feedback-close" as any, handler)
    }
    const close = () => {
      setShowFeedback(false)
      setAiFeedback(null)
    }
    const timer = setTimeout(close, 20000)
    const handler = () => close()
    window.addEventListener("cc-feedback-close" as any, handler)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("cc-feedback-close" as any, handler)
    }
  }, [showFeedback, aiFeedback, quiz, currentQuestionIndex])

  const checkPasswordStatus = async (studentId: string) => {
    try {
      const response = await studentApiFetch(`/api/student/info?student_id=${studentId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      if (data.student?.id && !sessionStorage.getItem("studentDatabaseId")) {
        sessionStorage.setItem("studentDatabaseId", data.student.id.toString())
      }

      if (!data.has_changed_password) {
        toast({
          title: "Password Change Required",
          description: "You must change your password before taking quizzes.",
          variant: "default",
        })
        router.push("/student/change-password")
        return
      }

      // Don't fetch quiz here - wait for user to click "Start Exam"
      // This ensures the preloading screen shows after instructions
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify your account. Please try logging in again.",
        variant: "destructive",
      })
      router.push("/student/login")
    }
  }

  const fetchQuiz = async (verifiedLocation?: { lat: number; lng: number }, selectedSuperpowers?: string[]) => {
    // Add minimum display time for preloading screen (2 seconds)
    const startTime = Date.now()
    const minDisplayTime = 2000 // 2 seconds minimum
    
    // Log quiz fetch start
    queueEvent("quiz", "api", "QUIZ_FETCH_START", {
      quizId,
      assessmentType
    }, "info")
    
    try {
      let studentDatabaseId = sessionStorage.getItem("studentDatabaseId")

      if (!studentDatabaseId) {
        const studentId = sessionStorage.getItem("studentId")

        if (!studentId) {
          throw new Error("Student ID not found in session")
        }

        const infoResponse = await studentApiFetch(`/api/student/info?student_id=${studentId}`)
        const infoData = await infoResponse.json()

        if (!infoResponse.ok) {
          throw new Error(infoData.error)
        }

        studentDatabaseId = infoData.student.id.toString()
        if (studentDatabaseId) {
        sessionStorage.setItem("studentDatabaseId", studentDatabaseId)
        }
      }

      if (selectedSuperpowers != null) {
        selectedSuperpowersForAttemptRef.current = Array.isArray(selectedSuperpowers)
          ? [...selectedSuperpowers]
          : []
        if (enableSuperpowers) {
          try {
            sessionStorage.setItem(
              `quizSuperpowers:${quizId}`,
              JSON.stringify(selectedSuperpowersForAttemptRef.current),
            )
          } catch {
            /* ignore */
          }
        }
      } else if (enableSuperpowers) {
        try {
          const raw = sessionStorage.getItem(`quizSuperpowers:${quizId}`)
          if (raw != null) {
            const parsed = JSON.parse(raw) as unknown
            if (Array.isArray(parsed)) {
              selectedSuperpowersForAttemptRef.current = [...parsed]
            }
          }
        } catch {
          /* ignore */
        }
      }
      const superpowersPayload =
        enableSuperpowers ? [...selectedSuperpowersForAttemptRef.current] : []

      const fetchTakeApi = async (lat?: number, lng?: number, attemptIdForTake?: number) => {
        let url = `/api/${normalizedType}/take/${quizId}?studentId=${studentDatabaseId}`
        if (attemptIdForTake != null && Number.isFinite(attemptIdForTake)) {
          url += `&attemptId=${attemptIdForTake}`
        }
        if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
          url += `&lat=${lat}&lng=${lng}`
        }
        // Auth header required — the take route now verifies the caller owns
        // the studentId in the query string.
        return fetch(url, { headers: getStudentAuthHeaders() })
      }

      // Single attempt-creation path: start-quiz BEFORE take (prevents orphan attempts on load failure).
      if (isStartingQuizRef.current) {
        return
      }
      isStartingQuizRef.current = true
      let activeAttemptId: number | null = null
      try {
        const startResponse = await studentApiFetch("/api/student/start-quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getStudentAuthHeaders() },
          body: JSON.stringify({
            studentId: studentDatabaseId,
            quizId,
            ...(enableSuperpowers ? { superpowers: superpowersPayload } : {}),
          }),
        })
        const startData = await startResponse.json()

        if (startData.inWaitingList) {
          setInWaitingList(true)
          setWaitingListPosition(startData.position || 0)
          toast({
            title: "Waiting Room",
            description:
              startData.message ||
              "You are in the waiting list. You will be admitted automatically when a spot opens.",
            variant: "default",
            duration: 5000,
          })
          return
        }

        if (!startResponse.ok && startData.partialScoreSubmitted && startData.attemptId) {
          showError("partial_score_submitted", {
            redirectTo: `/student/results/${startData.attemptId}`,
          })
          return
        }

        if (!startResponse.ok && startData.error) {
          const errText = String(startData.error)
          const isRetakeOrAccess =
            startData.upgradeRequired === true ||
            startData.canRetake === false ||
            /retake|membership|Explorer|Trailblazer|Scholar|attempt limit|donate/i.test(errText)
          showError(isRetakeOrAccess ? "generic" : "technical_difficulty", {
            message: errText,
            redirectTo: getDashboardPath(),
          })
          return
        }

        if (startData.attemptId) {
          activeAttemptId = Number(startData.attemptId)
          setAttemptId(activeAttemptId)
        }
      } finally {
        isStartingQuizRef.current = false
      }

      if (!activeAttemptId) {
        throw new Error("Failed to start quiz session. Please try again.")
      }

      let response = await fetchTakeApi(verifiedLocation?.lat, verifiedLocation?.lng, activeAttemptId)
      let data = await response.json()

      // If 403 with geo_required, request location and retry
      if (response.status === 403 && data?.geo_required) {
        const location = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
          if (!navigator.geolocation) {
            resolve(null)
            return
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
          )
        })
        if (!location) {
          toast({
            title: "Location Required",
            description: formatApiErrorMessage(
              data.error,
              "This assessment can only be taken at the designated location. Please enable location access in your browser and try again.",
            ),
            variant: "destructive",
          })
          setLoading(false)
          return
        }
        response = await fetchTakeApi(location.lat, location.lng, activeAttemptId)
        data = await response.json()
        if (response.status === 403) {
          toast({
            title: "Location Not Allowed",
            description: formatApiErrorMessage(
              data.error,
              "You must be at the designated location to take this assessment.",
            ),
            variant: "destructive",
          })
          setLoading(false)
          return
        }
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Server returned non-JSON response. Content-Type: ${contentType}`)
      }

      // Detect metadata-only response (questions missing or not an array)
      let questions = data.questions
      if (!Array.isArray(questions) || questions.length === 0) {
        try {
          // Try fetching questions from separate endpoint
          const questionsUrl = `/api/${normalizedType}/${quizId}/questions?studentId=${studentDatabaseId}`
          const questionsResponse = await fetch(questionsUrl)
          
          if (questionsResponse.ok) {
            const questionsData = await questionsResponse.json()
            questions = Array.isArray(questionsData) ? questionsData : (questionsData.questions || [])
          } else {
            questions = []
          }
        } catch (questionsError) {
          // Error fetching questions separately
          questions = []
        }
      }

      if (!response.ok) {
        try {
          console.error(
            JSON.stringify({
              tag: "[assessment-take-client]",
              phase: "take_failed",
              ts: new Date().toISOString(),
              status: response.status,
              quizId: Number(quizId),
              assessmentType: normalizedType,
              attemptId: activeAttemptId,
              error: data?.error ?? null,
              code: data?.code ?? null,
              details: data?.details ?? null,
              studentMessage: data?.studentMessage ?? null,
            }),
          )
        } catch {
          /* ignore logging errors */
        }
        if (response.status === 428 && data?.code === "attempt_required") {
          throw new Error(
            data.studentMessage ||
              data.error ||
              "Quiz session not ready. Please go back and click Start Quiz again.",
          )
        }
        if (response.status === 403) {
          if (data.error.includes("already completed")) {
            toast({
              title: "Quiz Already Completed",
              description: "You have already completed this quiz. Redirecting to dashboard...",
              variant: "default",
            })
            setTimeout(() => router.push(getDashboardPath()), 2000)
            return
          } else if (data.error.includes("not yet available") || data.error.includes("not available") || data.error.includes("will be available")) {
            toast({
              title: "Assessment Not Yet Available",
              description: formatApiErrorMessage(
                data.error,
                "This assessment is not available at this time. Please check back later.",
              ),
              variant: "default",
            })
            // Redirect to appropriate page based on assessment type
            const redirectPath = assessmentType === "final" ? getFinalExamsPath() 
              : assessmentType === "mid_semester" ? getMidSemesterExamsPath()
              : assessmentType === "homework" ? getHomeworkPath()
              : getDashboardPath()
            setTimeout(() => router.push(redirectPath), 2000)
            return
          } else if (data.error.includes("maximum number of attempts") || data.error.includes("Retake limit")) {
            toast({
              title: "Attempt Limit Reached",
              description: formatApiErrorMessage(
                data.error,
                "You have used all available attempts for this quiz.",
              ),
              variant: "default",
            })
            setTimeout(() => router.push(getDashboardPath()), 2000)
            return
          } else if (data.error.includes("expired") || data.error.includes("no longer available")) {
            toast({
              title: "Assessment Expired",
              description: formatApiErrorMessage(
                data.error,
                "This assessment is no longer available.",
              ),
              variant: "default",
            })
            // Redirect to appropriate page based on assessment type
            const redirectPath = assessmentType === "final" ? getFinalExamsPath() 
              : assessmentType === "mid_semester" ? getMidSemesterExamsPath()
              : assessmentType === "homework" ? getHomeworkPath()
              : getDashboardPath()
            setTimeout(() => router.push(redirectPath), 2000)
            return
          } else if (data.access_restricted || (data.error && data.error.includes("in class to take"))) {
            toast({
              title: "In-Class Assessment Only",
              description: formatApiErrorMessage(
                data.error,
                "You must be in class to take this assessment. You cannot take it this way. Please contact your instructor if you were absent.",
              ),
              variant: "destructive",
            })
            const redirectPath = assessmentType === "final" ? getFinalExamsPath() 
              : assessmentType === "mid_semester" ? getMidSemesterExamsPath()
              : assessmentType === "homework" ? getHomeworkPath()
              : getDashboardPath()
            setTimeout(() => router.push(redirectPath), 2500)
            return
          }
        }
        const apiMessage =
          (typeof data.studentMessage === "string" && data.studentMessage.trim()) ||
          (typeof data.details === "string" && data.details.trim()) ||
          (typeof data.error === "string" && data.error.trim()) ||
          `Request failed (${response.status})`
        throw new Error(apiMessage)
      }

      // Normalize quiz state - handle both legacy and new API response formats
      const quizData = data.quiz || {
        id: data.quizId || data.id,
        title: data.quizTitle || data.title,
        description: data.description,
        time_per_question: data.time_per_question || 60,
        retake_enabled: data.retake_enabled,
        retake_limit: data.retake_limit,
        retake_policy: data.retake_policy || "best"
      }
      
      // Ensure questions is always an array
      const normalizedQuestions = Array.isArray(questions) ? questions : []
      
      // Defensive guard - never allow quiz.questions to be undefined
      if (!normalizedQuestions || normalizedQuestions.length === 0) {
        throw new Error("Quiz loaded with zero questions")
      }
      
      const finalQuizData = {
        ...quizData,
        questions: normalizedQuestions, // Always an array, never undefined
        section_config: parseAssessmentSectionConfig(
          data.quiz?.section_config ?? quizData.section_config ?? null,
        ),
        extraTimePerQuestion: data.quiz?.extraTimePerQuestion ?? 0,
        activeSuperpowers: data.quiz?.activeSuperpowers ?? [],
        // Ensure anti-cheat config is preserved from API response
        // CRITICAL: Default auto_submit_on_violations to true if not explicitly set
        auto_submit_on_violations: data.quiz?.auto_submit_on_violations !== null && data.quiz?.auto_submit_on_violations !== undefined
          ? data.quiz.auto_submit_on_violations
          : (quizData.auto_submit_on_violations !== null && quizData.auto_submit_on_violations !== undefined
            ? quizData.auto_submit_on_violations
            : true),
        max_tab_switches: data.quiz?.max_tab_switches ?? quizData.max_tab_switches ?? 5,
        track_tab_switches: data.quiz?.track_tab_switches ?? quizData.track_tab_switches ?? false,
        track_gemini_window: data.quiz?.track_gemini_window ?? quizData.track_gemini_window ?? false,
        max_gemini_strikes: data.quiz?.max_gemini_strikes ?? quizData.max_gemini_strikes ?? 5,
        antiCheatConfig: data.quiz?.antiCheatConfig || applyStrictModeIntegrityDefaults({
          strictModeEnabled: Boolean(data.quiz?.strict_mode_enabled),
          blockCopyPaste: Boolean(data.quiz?.block_copy_paste),
          trackTabSwitches: Boolean(data.quiz?.track_tab_switches),
          trackMouseMovement: Boolean(data.quiz?.track_mouse_movement),
          warnOnTabSwitch: Boolean(data.quiz?.warn_on_tab_switch),
          autoSubmitOnViolations: data.quiz?.auto_submit_on_violations !== null && data.quiz?.auto_submit_on_violations !== undefined
            ? Boolean(data.quiz.auto_submit_on_violations)
            : true,
          maxTabSwitches: data.quiz?.max_tab_switches ?? 5,
          trackGeminiWindow: Boolean(data.quiz?.track_gemini_window),
          maxGeminiStrikes: data.quiz?.max_gemini_strikes ?? 5,
          requireFullscreen: data.quiz?.require_fullscreen === true,
        })
      }
      
      setQuiz(finalQuizData)
      setTimeLeft(quizData.time_per_question || 60)

      // Set Save and Finish Later access from take API (available immediately, no need to wait for attempt API)
      if (data.hasSaveAndFinishLaterAccess !== undefined) {
        setHasSaveAndFinishLaterAccess(data.hasSaveAndFinishLaterAccess)
      }
      
      // Update anti-cheat config from quiz data (in case it wasn't loaded in instructions)
      if (data.quiz?.antiCheatConfig) {
        setAntiCheatConfig(prev =>
          applyBrowserAiPlatformPolicy({ ...prev, ...data.quiz.antiCheatConfig }),
        )
      } else if (data.quiz) {
        // Fallback: construct config from quiz data fields
        const quizConfig = applyStrictModeIntegrityDefaults({
          strictModeEnabled: data.quiz.strict_mode_enabled || false,
          blockCopyPaste: data.quiz.block_copy_paste || false,
          trackTabSwitches: antiCheatDisabledForTesting ? false : data.quiz.track_tab_switches || false,
          trackMouseMovement: data.quiz.track_mouse_movement || false,
          warnOnTabSwitch: data.quiz.warn_on_tab_switch || false,
          maxTabSwitches: data.quiz.max_tab_switches || 5,
          autoSubmitOnViolations: antiCheatDisabledForTesting
            ? false
            : data.quiz.auto_submit_on_violations || false,
          trackGeminiWindow: antiCheatDisabledForTesting
            ? false
            : (data.quiz.track_gemini_window ?? true),
          maxGeminiStrikes: data.quiz.max_gemini_strikes || 5,
          requireFullscreen: antiCheatDisabledForTesting
            ? false
            : data.quiz.require_fullscreen === true,
          keystrokePlaybackEnforced: data.quiz.keystroke_playback_enforced !== false,
        })
        setAntiCheatConfig(prev => applyBrowserAiPlatformPolicy({ ...prev, ...quizConfig }))
      }
      
      // Log successful quiz load
      logPerformance("quiz", "api", "QUIZ_FETCH_COMPLETE", startTime, {
        quizId,
        questionCount: normalizedQuestions.length,
        timePerQuestion: quizData.time_per_question || 60
      })

      if (quizData && quizData.id) {
        // SECURITY: adopt the session token issued by the take API (newest window owns the attempt)
        if (typeof data.attemptSessionToken === "string" && data.attemptSessionToken) {
          attemptSessionTokenRef.current = data.attemptSessionToken
          isSessionSupersededRef.current = false
        }
        const attemptIdFromTake = data.attemptId
        const attemptUrl = attemptIdFromTake
          ? `/api/student/quiz-attempt/${quizData.id}?studentId=${studentDatabaseId}&attemptId=${attemptIdFromTake}`
          : `/api/student/quiz-attempt/${quizData.id}?studentId=${studentDatabaseId}`
        serverLog("QuizTaker FETCH", "quiz-attempt URL", { attemptUrl, quizId, quizDataId: quizData.id, attemptIdFromTake })
        const attemptResponse = await fetch(attemptUrl)

        const attemptContentType = attemptResponse.headers.get("content-type") || ""
        let attemptData: Awaited<ReturnType<typeof attemptResponse.json>> | null = null
        if (attemptContentType.includes("application/json")) {
          attemptData = await attemptResponse.json()
        } else {
          const attemptBody = (await attemptResponse.text()).trim().slice(0, 240)
          serverLog("QuizTaker FETCH", "quiz-attempt non-JSON", {
            status: attemptResponse.status,
            contentType: attemptContentType,
            body: attemptBody,
          })
          if (attemptIdFromTake) {
            setAttemptId(Number(attemptIdFromTake))
            toast({
              title: "Resume data unavailable",
              description:
                "Your attempt is active, but saved progress could not be loaded. You can keep working; refresh if answers look wrong.",
              variant: "default",
              duration: 8000,
            })
          } else {
            throw new Error(
              `Quiz attempt API returned non-JSON response (HTTP ${attemptResponse.status}). Content-Type: ${attemptContentType || "text/plain"}`,
            )
          }
        }

        if (attemptData) {
        serverLog("QuizTaker FETCH", "attemptData from API", {
          attemptId: attemptData.attemptId,
          completedAt: attemptData.completedAt,
          submittedQuestionIds: attemptData.submittedQuestionIds,
          lockedQuestionIds: attemptData.lockedQuestionIds,
          currentQuestionIndex: attemptData.currentQuestionIndex,
          answeredQuestionIds: attemptData.answeredQuestionIds,
        })
        }

        if (attemptData?.attemptId) {
          setAttemptId(attemptData.attemptId)
          resumeFromSaveLaterRef.current = Boolean(attemptData.savedForLaterAt)
          if (attemptData.hasSaveAndFinishLaterAccess !== undefined) {
            setHasSaveAndFinishLaterAccess(attemptData.hasSaveAndFinishLaterAccess)
          }

          // Check if attempt is already finalized - if so, redirect to results
          if (attemptData.completedAt || attemptData.completed_at || attemptData.is_finalized) {
            try {
              sessionStorage.removeItem(`quiz_resume_${quizId}_${normalizedType}`)
            } catch (_) {}
            const reportPath =
              effectiveType === "practice"
                ? `/student/practice/report/${attemptData.attemptId}`
                : effectiveType === "final"
                ? `/student/results/${attemptData.attemptId}`
                : `/student/${effectiveType}/report/${attemptData.attemptId}`
            router.replace(reportPath)
            return
          }
          
          if (attemptData.flaggedQuestionIds) {
            setFlaggedQuestions(new Set(attemptData.flaggedQuestionIds))
          }
          if (attemptData.usedHintQuestionIds) {
            setUsedHints(new Set(attemptData.usedHintQuestionIds))
          }
          // SECURITY: seed anti-cheat counters from server-persisted counts so a refresh
          // cannot reset violation progress (see useAntiCheat initialCounts).
          if (
            typeof attemptData.tabSwitchCount === "number" ||
            typeof attemptData.geminiStrikes === "number" ||
            typeof attemptData.copyPasteAttempts === "number"
          ) {
            setRestoredViolationCounts({
              tabSwitchCount: Number(attemptData.tabSwitchCount) || 0,
              geminiStrikes: Number(attemptData.geminiStrikes) || 0,
              copyPasteAttempts: Number(attemptData.copyPasteAttempts) || 0,
            })
          }
          // Initialize attempt count from existing data
          if (attemptData.questionAttemptCounts) {
            setAttemptCount(attemptData.questionAttemptCounts)
          }
          // Initialize answered questions from existing data
          if (attemptData.answeredQuestionIds) {
            setAnsweredQuestions(new Set(attemptData.answeredQuestionIds))
          }
          // Initialize saved answers by verifying which answers exist in the database
          // This ensures we only track answers that were actually saved
          if (attemptData.attemptId) {
            try {
              const verifyResponse = await studentApiFetch(`/api/student/verify-saved-answers?attemptId=${attemptData.attemptId}`)
              if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json()
                if (verifyData.savedQuestionIds) {
                  setSavedAnswers(new Set(verifyData.savedQuestionIds))
                }
              }
            } catch (error) {
              // Failed to verify saved answers
              // Continue without verification - will check on submit
            }
            
          }
          // Initialize question time remaining from server (only for questions already reached)
          const resumeSectionConfig = parseAssessmentSectionConfig(
            data.quiz?.section_config ?? quizData.section_config ?? null,
          )
          const serverTimeRemaining = attemptData.questionTimeRemaining
          const submittedIdsForResume = attemptData.submittedQuestionIds ?? []
          const submittedSetForResume = new Set(submittedIdsForResume)
          let resumeQuestionIndex =
            typeof attemptData.currentQuestionIndex === "number" ? attemptData.currentQuestionIndex : 0
          if (resumeQuestionIndex >= 0 && resumeQuestionIndex < normalizedQuestions.length) {
            const qAtResume = normalizedQuestions[resumeQuestionIndex]
            if (qAtResume && submittedSetForResume.has(qAtResume.id)) {
              const nextUnanswered = normalizedQuestions.findIndex((q) => !submittedSetForResume.has(q.id))
              if (nextUnanswered >= 0) resumeQuestionIndex = nextUnanswered
            }
            resumeQuestionIndex = Math.min(resumeQuestionIndex, normalizedQuestions.length - 1)
          }
          if (serverTimeRemaining && typeof serverTimeRemaining === "object") {
            const filteredTimeRemaining: Record<number, number> = {}
            const rawTimeRemaining = serverTimeRemaining as Record<string | number, number>
            normalizedQuestions.forEach((q, idx) => {
              if (!questionUsesPerQuestionTimer(q.question_type, idx)) return
              if (idx > resumeQuestionIndex) return
              const remaining = rawTimeRemaining[q.id] ?? rawTimeRemaining[String(q.id)]
              if (remaining === undefined || remaining <= 0) return
              if (submittedSetForResume.has(q.id)) return
              filteredTimeRemaining[q.id] = remaining
              visitedPerQuestionTimerRef.current.add(q.id)
            })
            setQuestionTimeRemaining(filteredTimeRemaining)
            globalQuestionTimersRef.current = {
              ...globalQuestionTimersRef.current,
              ...filteredTimeRemaining,
            }
            // Drop any stale circuit / section-pool keys left in the ref
            normalizedQuestions.forEach((q, idx) => {
              if (!questionUsesPerQuestionTimer(q.question_type, idx)) {
                delete globalQuestionTimersRef.current[q.id]
              }
            })
          }
          const serverSectionTime = attemptData.sectionTimeRemaining
          const resumeSections =
            resumeSectionConfig?.length && normalizedQuestions.length
              ? groupQuestionsBySections(normalizedQuestions, resumeSectionConfig)
              : []
          if (serverSectionTime && typeof serverSectionTime === "object") {
            const sectionTimes: Record<number, number> = {}
            for (const [key, val] of Object.entries(serverSectionTime as Record<string | number, number>)) {
              const idx = Number(key)
              if (!Number.isFinite(idx)) continue
              const sec = resumeSections.find((s) => s.sectionIndex === idx)
              const repaired = repairStaleSectionPoolSeconds(
                idx,
                Number(val),
                resumeSectionConfig,
                sec?.questionIndices.length ?? 0,
              )
              if (repaired <= 0) continue
              sectionTimes[idx] = repaired
            }
            setSectionTimeRemaining(sectionTimes)
            globalSectionTimersRef.current = {
              ...globalSectionTimersRef.current,
              ...sectionTimes,
            }
            sectionTimeRemainingRef.current = {
              ...sectionTimeRemainingRef.current,
              ...sectionTimes,
            }
          } else if (resumeSectionConfig?.length && normalizedQuestions.length > 0) {
            const fallback = sanitizeAttemptTimerState(
              normalizedQuestions.map((q) => ({
                id: q.id,
                question_type: q.question_type,
                question_order: (q as { question_order?: number }).question_order,
              })),
              resumeSectionConfig,
              {},
              {},
              undefined,
              effectiveType,
            )
            if (Object.keys(fallback.sectionTimeRemaining).length > 0) {
              const sectionTimes: Record<number, number> = {}
              for (const [key, val] of Object.entries(fallback.sectionTimeRemaining)) {
                sectionTimes[Number(key)] = val
              }
              setSectionTimeRemaining(sectionTimes)
              globalSectionTimersRef.current = {
                ...globalSectionTimersRef.current,
                ...sectionTimes,
              }
            }
          }
          const serverSelections = attemptData.sectionQuestionSelections
          if (serverSelections && typeof serverSelections === "object") {
            setSectionQuestionSelections(serverSelections as SectionQuestionSelections)
            sectionQuestionSelectionsRef.current = serverSelections as SectionQuestionSelections
          }
          // Restore answers and position from server for resume (refresh/computer died)
          let restoredCircuitLockedIds: number[] = []
          try {
            const answersRes = await studentApiFetch(`/api/student/attempt/${attemptData.attemptId}/answers`, {
              headers: getStudentAuthHeaders(),
            })
            if (answersRes.ok) {
              const savedAnswersList = await answersRes.json()
              if (Array.isArray(savedAnswersList) && savedAnswersList.length > 0 && normalizedQuestions.length > 0) {
                const restoredAnswers: Record<number, string> = {}
                const restoredCodeByQuestion: Record<number, string> = {}
                const restoredPlotByQuestion: Record<number, string> = {}
                const codeTypes = ["code_write", "code_problem", "debug_code", "code_write_plot", "code_explain", "code_debug"]
                for (const item of savedAnswersList) {
                  const qId = typeof item.questionId === "number" ? item.questionId : parseInt(String(item.questionId), 10)
                  if (isNaN(qId)) continue
                  const parsedEval = parseStoredAiFeedback(item.aiFeedback)
                  if (parsedEval) {
                    evalByQuestionRef.current[qId] = parsedEval
                    setQuestionsWithStoredEval((prev) => new Set(prev).add(qId))
                  }
                  let ans = item.answer ?? ""
                  if (ans == null || ans === "") continue
                  const q = normalizedQuestions.find((qu) => qu.id === qId)
                  const qt = (q?.question_type || "").toLowerCase()
                  if (qt === "circuit_submission" && (circuitSubmissionAnswerIsFinalized(ans) || parsedEval)) {
                    restoredCircuitLockedIds.push(qId)
                    setAiGradedQuestionsSubmitted((prev) => new Set(prev).add(qId))
                  }
                  let codeStr = typeof ans === "string" ? ans : JSON.stringify(ans)
                  if (qt === "code_write_plot" && typeof ans === "string") {
                    try {
                      const parsed = JSON.parse(ans)
                      if (parsed && typeof parsed.code === "string") {
                        codeStr = parsed.code
                        if (parsed.plotImage) restoredPlotByQuestion[qId] = parsed.plotImage
                      }
                    } catch (_) {}
                  }
                  restoredAnswers[qId] = typeof ans === "string" ? ans : JSON.stringify(ans)
                  if (qt === "circuit_submission") {
                    circuitAnswersByQuestionRef.current[qId] = restoredAnswers[qId]
                  }
                  if (codeTypes.includes(qt) && codeStr.trim()) {
                    restoredCodeByQuestion[qId] = codeStr
                    try {
                      if (typeof window !== "undefined") {
                        localStorage.setItem(`code_${attemptData.attemptId}_${qId}`, codeStr)
                      }
                    } catch (_) {}
                  }
                }
                if (Object.keys(restoredAnswers).length > 0) {
                  setAnswers((prev) => ({ ...prev, ...restoredAnswers }))
                }
                if (Object.keys(restoredCodeByQuestion).length > 0) {
                  setCodeByQuestion((prev) => ({ ...prev, ...restoredCodeByQuestion }))
                }
                if (Object.keys(restoredPlotByQuestion).length > 0) {
                  setPlotByQuestion((prev) => ({ ...prev, ...restoredPlotByQuestion }))
                }
              }
            }
          } catch (_) {}

          // Section II circuit problems never use per-question timers — clear stale expiry flags.
          normalizedQuestions.forEach((q, idx) => {
            if (questionUsesPerQuestionTimer(q.question_type, idx)) return
            delete globalQuestionTimersRef.current[q.id]
            delete questionGraceEndsAtRef.current[q.id]
            setTimerExpiredForQuestion((prev) => {
              if (!prev.has(q.id)) return prev
              const next = new Set(prev)
              next.delete(q.id)
              return next
            })
          })

          const filterCircuitLocksIfPoolActive = (ids: number[]) =>
            ids.filter((id) => {
              const qi = normalizedQuestions.findIndex((q) => q.id === id)
              if (qi < 0) return true
              const q = normalizedQuestions[qi]
              return !circuitQuestionEditableWhilePoolActive(
                qi,
                q.question_type || "mcq",
                resumeSections.length ? resumeSections : sectionsRef.current,
                resumeSectionConfig,
                globalSectionTimersRef.current,
                expiredSectionsRef.current,
              )
            })

          const submittedIds = submittedIdsForResume
          const lockedIds = filterCircuitLocksIfPoolActive(
            attemptData.lockedQuestionIds ?? submittedIds ?? [],
          )
          serverLog("QuizTaker FETCH", "setting locked/submitted", {
            submittedIds,
            lockedIds,
            questionIdsInQuiz: normalizedQuestions.map((q) => q.id),
          })
          if (lockedIds.length > 0) setLockedQuestions(new Set(lockedIds))
          if (submittedIds.length > 0) {
            setSubmittedQuestions(
              new Set(filterCircuitLocksIfPoolActive(submittedIds)),
            )
          }
          if (restoredCircuitLockedIds.length > 0) {
            const circuitLocks = filterCircuitLocksIfPoolActive(restoredCircuitLockedIds)
            if (circuitLocks.length > 0) {
              setLockedQuestions((prev) => new Set([...prev, ...circuitLocks]))
              setSubmittedQuestions((prev) => new Set([...prev, ...circuitLocks]))
            }
          }

          const attemptIdNum = attemptData.attemptId ? Number(attemptData.attemptId) : 0
          if ((submittedIds.length > 0 || lockedIds.length > 0) && attemptIdNum && !resumeToastShownForAttempts.has(attemptIdNum)) {
            resumeToastShownForAttempts.add(attemptIdNum)
            toast({
              title: "Resuming Quiz",
              description: resumeFromSaveLaterRef.current
                ? "Your previous answers were saved. Questions you already completed stay locked—you cannot change them."
                : "Your previous answers were saved. Multiple-choice questions you already submitted stay locked; you can keep editing code and other open-ended questions.",
              variant: "default",
              duration: 5000,
            })
          }

          // Restore currentQuestionIndex: skip to first unanswered question (don't land on already-submitted)
          const submittedSet = new Set([
            ...filterCircuitLocksIfPoolActive(submittedIdsForResume),
            ...filterCircuitLocksIfPoolActive(restoredCircuitLockedIds),
          ])
          let idx = resumeQuestionIndex
          if (idx >= 0 && idx < normalizedQuestions.length) {
            const qAtIdx = normalizedQuestions[idx]
            if (qAtIdx && submittedSet.has(qAtIdx.id)) {
              const nextUnanswered = normalizedQuestions.findIndex((q) => !submittedSet.has(q.id))
              if (nextUnanswered >= 0) idx = nextUnanswered
            }
            const finalIdx = Math.min(idx, normalizedQuestions.length - 1)
            serverLog("QuizTaker FETCH", "restoring currentQuestionIndex", { idx, finalIdx, submittedSet: [...submittedSet] })
            setCurrentQuestionIndex(finalIdx)
          }
        }
      }
    } catch (error) {
      // Log quiz fetch error
      logError("quiz", "api", error instanceof Error ? error : new Error(String(error)), {
        quizId,
        assessmentType,
        phase: "fetch"
      })
      const isNetwork = error instanceof TypeError && error.message?.includes("fetch")
      showError(isNetwork ? "network_error" : "technical_difficulty", {
        message: error instanceof Error ? error.message : "An error occurred while loading the quiz.",
        redirectTo: getDashboardPath(),
      })
    } finally {
      // Ensure minimum display time for preloading screen
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, minDisplayTime - elapsedTime)
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }
      
      setLoading(false)
    }
  }

  // const batchSaveAnswers = async () => { ... }

  const handleTimerExpiry = async () => {
    // CRITICAL: Don't check isSubmittingAnswer here - we need to force submit even if stuck
    // The timer expiry should always proceed to save the answer
    if (showFeedback) return

    const currentQuestion = quiz?.questions[currentQuestionIndex]
    if (!currentQuestion) return

    const sectionCfg = getSectionConfigAt(currentQuestionIndex)
    if (!usesPerQuestionCountdown(currentQuestion.question_type || "mcq", sectionCfg, parsedSectionConfigRef.current, effectiveType)) {
      return
    }

    if (isUntimedMultiPartQuestion(currentQuestion.question_type) &&
        !questionUsesPerQuestionTimer(currentQuestion.question_type, currentQuestionIndex)) return

    if (timerExpiredForQuestion.has(currentQuestion.id)) return

    // Mark timer as expired AND lock the question
    setTimerExpiredForQuestion((prev) => new Set(prev).add(currentQuestion.id))
    setLockedQuestions((prev) => new Set(prev).add(currentQuestion.id))

    const questionType = currentQuestion.question_type || "mcq"
    let answerToSave: any = null

    // CRITICAL: Use refs to avoid stale closure - timer callback may have stale state
    const latest = latestAnswerRef.current

    if (questionType === "mcq" || questionType === "true_false") {
      answerToSave = latest.selectedAnswer || selectedAnswer || null
    } else if (questionType === "multi_output" || questionType === "select_all") {
      const multi = latest.selectedMultiAnswers.length > 0 ? latest.selectedMultiAnswers : selectedMultiAnswers
      answerToSave = multi.length > 0 ? multi : null
    } else if (questionType === "code_problem" || questionType === "debug_code" || questionType === "code_write" || questionType === "code_write_plot") {
      // CRITICAL: Get the most current code state - use ref first to avoid stale closure
      const savedInStorage = latest.codeByQuestion[currentQuestion.id] ?? codeByQuestion[currentQuestion.id]
      const currentCodeState = latest.code || code
      
      const isUnsavedTemplate = (codeToCheck: string | null | undefined): boolean =>
        isTemplateCode(codeToCheck ?? "", questionType)

      // Get the most recent code - PREFER editor.getValue() (source of truth) to fix Q1 data loss
      // Editor may have content before React state/refs sync; codeSyncRef is fallback
      const fromEditor = codeEditorRef.current?.getValue?.()
      let codeToSave = (fromEditor !== undefined && fromEditor !== null ? fromEditor : null) ?? savedInStorage ?? currentCodeState ?? codeSyncRef.current ?? ""
      
      // Also check localStorage as a fallback
      if (!codeToSave && typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem(getCodeStorageKey(currentQuestion.id))
          if (stored) {
            codeToSave = stored
          }
        } catch (e) {
          // localStorage access failed, continue with codeToSave
        }
      }
      
      // CRITICAL: Save WHATEVER they have - never lose data (fixes Q1 data loss)
      // If template, still save it - we have a record. If modified, save their version.
      if (codeToSave && isTemplateCode(codeToSave)) {
        if (currentCodeState && !isTemplateCode(currentCodeState)) {
          codeToSave = currentCodeState
          setCodeByQuestion((prev) => ({ ...prev, [currentQuestion.id]: currentCodeState }))
          persistCodeValue(currentQuestion.id, currentCodeState)
        }
        // Keep codeToSave as-is (template) - do NOT set to "" - we always save something
      }
      
      // For code_write_plot, include plot image if available
      if (questionType === "code_write_plot") {
        const plotImage = plotByQuestion[currentQuestion.id]
        if (plotImage) {
          answerToSave = JSON.stringify({
            code: codeToSave || "",
            plotImage: plotImage
          })
        } else {
          answerToSave = codeToSave || ""
        }
      } else {
        // NEVER use null for code - always save whatever we have (even template/empty)
        answerToSave = codeToSave ?? ""
      }
    } else {
      answerToSave = selectedAnswer || null
    }


    // CRITICAL: Force reset isSubmittingAnswer before auto-submit to prevent blocking
    setIsSubmittingAnswer(false)

    // CRITICAL: Always save code questions immediately - never lose data (fixes Q1 data loss)
    // For code types, save even template/empty - we must have a record
    // AWAIT the save so code is recorded before we proceed (prevents data loss on slow network)
    const isCodeType = ["code_write", "code_problem", "debug_code", "code_write_plot", "code_explain", "code_debug"].includes(questionType)
    if (attemptId && (answerToSave != null || isCodeType)) {
      const toSave = answerToSave != null && answerToSave !== ""
        ? (typeof answerToSave === 'string' ? answerToSave : JSON.stringify(answerToSave))
        : (isCodeType ? "" : null)
      if (toSave !== null || isCodeType) {
        try {
          const raw = Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[currentQuestion.id] || 0)
          const timeSpent = capTimeSpent(currentQuestion.id, raw)
          await studentApiFetch("/api/student/save-answer", {
            method: "POST",
            headers: attemptApiHeaders(),
            body: JSON.stringify({
              attemptId,
              questionId: currentQuestion.id,
              answer: toSave ?? "",
              questionType,
              timeSpentSeconds: timeSpent,
            }),
            signal: AbortSignal.timeout(15000),
          })
          setSavedAnswers((prev) => new Set(prev).add(currentQuestion.id))
        } catch (_) {
          // Non-blocking: continue even if save failed - handleAnswerSubmit may retry
        }
      }
    }

    try {
      // Pass answerToSave - for code, use "" if null so we still submit
      await handleAnswerSubmit(answerToSave ?? (isCodeType ? "" : null), true)
    } catch (error) {
      setIsSubmittingAnswer(false)
    }

    const strictObjective =
      isPerQuestionTimerSection(getSectionConfigAt(currentQuestionIndex)) &&
      ["mcq", "true_false", "select_all", "multi_output"].includes(
        (currentQuestion.question_type || "").toLowerCase(),
      )
    if (strictObjective && currentQuestionIndex < (quiz?.questions.length ?? 0) - 1) {
      setTimeout(() => {
        goToQuestion(currentQuestionIndex + 1)
      }, 400)
    }
  }

  const handleTimerExpiryRef = useRef(handleTimerExpiry)
  handleTimerExpiryRef.current = handleTimerExpiry

  const handleSectionTimerExpiry = async (sectionIndex: number) => {
    const parsedCfg = parsedSectionConfigRef.current
    const examShared = getExamSharedTimerSeconds(parsedCfg)
    if (examShared != null) {
      if (expiredSectionsRef.current.has(EXAM_SHARED_TIMER_SECTION_KEY)) return
    } else if (expiredSectionsRef.current.has(sectionIndex)) {
      return
    }

    const indicesToExpire =
      examShared != null
        ? sectionsRef.current
            .filter((s) => usesSectionCountdown(parsedCfg?.[s.sectionIndex], effectiveType))
            .map((s) => s.sectionIndex)
        : [sectionIndex]

    for (const idx of indicesToExpire) {
      expiredSectionsRef.current.add(idx)
      setExpiredSections((prev) => new Set(prev).add(idx))

      const sec = sectionsRef.current.find((s) => s.sectionIndex === idx)
      if (!sec || !quiz?.questions?.length) continue

      for (let i = sec.startIndex; i <= sec.endIndex; i++) {
        const q = quiz.questions[i]
        if (!q) continue
        setLockedQuestions((prev) => new Set(prev).add(q.id))
      }
      globalSectionTimersRef.current[idx] = 0
      setSectionTimeRemaining((prev) => ({ ...prev, [idx]: 0 }))
    }

    if (examShared != null) {
      expiredSectionsRef.current.add(EXAM_SHARED_TIMER_SECTION_KEY)
      setExpiredSections((prev) => new Set(prev).add(EXAM_SHARED_TIMER_SECTION_KEY))
      globalSectionTimersRef.current[EXAM_SHARED_TIMER_SECTION_KEY] = 0
      setSectionTimeRemaining((prev) => ({ ...prev, [EXAM_SHARED_TIMER_SECTION_KEY]: 0 }))
    }

    setCurrentSectionTimeLeft(0)
    setSectionTimerStarting(false)
  }

  const handleSectionTimerExpiryRef = useRef(handleSectionTimerExpiry)
  handleSectionTimerExpiryRef.current = handleSectionTimerExpiry

  useEffect(() => {
    waterBreakPausedRef.current = waterBreakActive
  }, [waterBreakActive])

  const handleStartWaterBreak = useCallback((minutes: number) => {
    setWaterBreakTotalSeconds(Math.max(60, minutes * 60))
    setShowWaterBreakPicker(false)
    setWaterBreakActive(true)
  }, [])

  const handleResumeFromWaterBreak = useCallback(() => {
    setWaterBreakActive(false)
  }, [])

  // Global timer: per-question and section-level countdowns
  useEffect(() => {
    if (!quiz || !questionRendered || isQuizFinalized) {
      if (globalTimerTickRef.current) {
        clearInterval(globalTimerTickRef.current)
        globalTimerTickRef.current = null
      }
      return
    }

    if (globalTimerTickRef.current) return

    globalTimerTickRef.current = setInterval(() => {
      if (waterBreakPausedRef.current) return

      const quizData = quizForTimerRef.current
      if (!quizData?.questions?.length) return

      const now = Date.now()
      const timers = globalQuestionTimersRef.current
      const sectionTimers = globalSectionTimersRef.current
      const expired = timerExpiredForQuestionRef.current
      const locked = lockedQuestionsForTimerRef.current
      const expiredSecs = expiredSectionsRef.current
      const currentIdx = currentQuestionIndexForTimerRef.current
      const currentQ = quizData.questions[currentIdx]
      let timersChanged = false
      let sectionTimersChanged = false

      quizData.questions.forEach((q, qi) => {
        const sectionCfg = getSectionConfigForQuestionIndex(
          qi,
          sectionsRef.current,
          parsedSectionConfigRef.current,
        )
        if (!usesPerQuestionCountdown(q.question_type, sectionCfg, parsedSectionConfigRef.current, effectiveType)) return
        if (currentQ?.id !== q.id) return
        if (expired.has(q.id) || locked.has(q.id)) return
        if (timers[q.id] === undefined) return

        const graceEnd = questionGraceEndsAtRef.current[q.id] ?? 0
        if (now < graceEnd) return

        if (timers[q.id] <= 1) {
          timers[q.id] = 0
          timersChanged = true
          setTimerExpiredForQuestion((prev) => new Set(prev).add(q.id))
          setLockedQuestions((prev) => new Set(prev).add(q.id))
          delete timers[q.id]
          if (currentQ?.id === q.id) {
            void handleTimerExpiryRef.current()
          }
        } else {
          timers[q.id] -= 1
          timersChanged = true
        }
      })

      const examShared = getExamSharedTimerSeconds(parsedSectionConfigRef.current)
      if (examShared != null) {
        const key = EXAM_SHARED_TIMER_SECTION_KEY
        if (
          !expiredSecs.has(key) &&
          sectionTimers[key] !== undefined
        ) {
          const graceEnd = sectionGraceEndsAtRef.current[0] ?? 0
          if (now >= graceEnd) {
            if (sectionTimers[key] <= 1) {
              syncExamSharedSectionTimers(sectionTimers, parsedSectionConfigRef.current, 0)
              sectionTimersChanged = true
              void handleSectionTimerExpiryRef.current(0)
            } else {
              syncExamSharedSectionTimers(
                sectionTimers,
                parsedSectionConfigRef.current,
                sectionTimers[key] - 1,
              )
              sectionTimersChanged = true
            }
          }
        }
      } else {
        for (const sec of sectionsRef.current) {
          const idx = sec.sectionIndex
          const cfg = parsedSectionConfigRef.current?.[idx]
          if (!usesSectionCountdown(cfg, effectiveType)) continue
          if (expiredSecs.has(idx)) continue
          if (sectionTimers[idx] === undefined) continue

          const graceEnd = sectionGraceEndsAtRef.current[idx] ?? 0
          if (now < graceEnd) continue

          if (sectionTimers[idx] <= 1) {
            sectionTimers[idx] = 0
            sectionTimersChanged = true
            void handleSectionTimerExpiryRef.current(idx)
          } else {
            sectionTimers[idx] -= 1
            sectionTimersChanged = true
          }
        }
      }

      if (timersChanged) {
        setQuestionTimeRemaining((prev) => {
          const next = { ...prev }
          for (const q of quizData.questions) {
            if (timers[q.id] !== undefined) next[q.id] = timers[q.id]
            else if (expired.has(q.id) || locked.has(q.id)) next[q.id] = 0
          }
          return next
        })
      }

      if (sectionTimersChanged) {
        setSectionTimeRemaining((prev) => {
          const next = { ...prev }
          for (const sec of sectionsRef.current) {
            const idx = sec.sectionIndex
            if (sectionTimers[idx] !== undefined) next[idx] = sectionTimers[idx]
            else if (expiredSecs.has(idx)) next[idx] = 0
          }
          return next
        })
      }

      if (currentQ && timers[currentQ.id] !== undefined) {
        setTimeLeft(timers[currentQ.id])
      } else if (currentQ && (expired.has(currentQ.id) || locked.has(currentQ.id))) {
        setTimeLeft(0)
      }

      const activeSecIdx = getSectionIndexForQuestion(currentIdx, sectionsRef.current)
      const examSharedLeft = readExamSharedSectionSeconds(
        sectionTimers,
        parsedSectionConfigRef.current,
      )
      if (examSharedLeft !== undefined && usesExamSharedTimer(parsedSectionConfigRef.current)) {
        setCurrentSectionTimeLeft(examSharedLeft)
        if (now >= (sectionGraceEndsAtRef.current[0] ?? 0)) {
          setSectionTimerStarting(false)
        }
      } else if (activeSecIdx != null && sectionTimers[activeSecIdx] !== undefined) {
        setCurrentSectionTimeLeft(sectionTimers[activeSecIdx])
        if (now >= (sectionGraceEndsAtRef.current[activeSecIdx] ?? 0)) {
          setSectionTimerStarting(false)
        }
      } else if (activeSecIdx != null && expiredSecs.has(activeSecIdx)) {
        setCurrentSectionTimeLeft(0)
      }
    }, 1000)

    return () => {
      if (globalTimerTickRef.current) {
        clearInterval(globalTimerTickRef.current)
        globalTimerTickRef.current = null
      }
    }
  }, [quiz, questionRendered, isQuizFinalized])

  // CRITICAL FIX: Auto-save answers immediately when selected
  // This prevents data loss if student selects answer but doesn't click Next
  const handleAnswerChange = async (answer: string) => {
    // Block answer changes if locked due to violations
    if (isLockedDueToViolations) return
    
    setSelectedAnswer(answer)
    setAnswers(prev => ({ ...prev, [quiz?.questions[currentQuestionIndex]?.id || 0]: answer }))
    
    // Auto-save immediately to database (lightweight, no evaluation)
    if (!attemptId || !quiz) return
    
    const currentQuestion = quiz.questions[currentQuestionIndex]
    if (!currentQuestion) return

    if (
      submittedQuestions.has(currentQuestion.id) ||
      lockedQuestions.has(currentQuestion.id)
    ) {
      return
    }
    
    const questionType = currentQuestion.question_type?.toLowerCase() || "mcq"
    
    // Circuit workspace ink + uploads — persist immediately on each stroke/upload (like MCQ).
    if (questionType === "circuit_submission" && answer) {
      circuitAnswersByQuestionRef.current[currentQuestion.id] = answer
      try {
        const parsed = parseCircuitSubmissionAnswer(answer)
        const hasUpload = Object.keys(parsed.solution_uploads ?? {}).length > 0
        const hasWorkspace = workspaceHasContent(parsed.workspace)
        if (hasUpload || hasWorkspace) {
          const raw =
            Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) +
            (questionTimeSpent[currentQuestion.id] || 0)
          autoSaveAnswer(
            currentQuestion.id,
            compactCircuitSubmissionForAutoSave(answer),
            questionType,
            undefined,
            capTimeSpent(currentQuestion.id, raw),
          )
        }
      } catch {
        /* ignore malformed draft */
      }
      return
    }

    // Auto-save immediately for mcq, true_false, select_all (single selection)
    // Code types use debounced save; fill_blank/code_output/trace_output etc. use separate debounced save
    const textInputTypes = ["fill_blank", "code_output", "trace_output", "fill_code", "trace_logic", "scenario_match",
      "multi_part",
      "circuit_numeric", "circuit_worked_solution", "circuit_diagram_analysis", "circuit_multi_part", "circuit_fill_equation",
      "circuit_transfer_function", "circuit_phasor_power", "circuit_transient_response", "circuit_upload_work",
      "circuit_submission",
    ]
    const shouldAutoSave = !["code_write", "code_write_plot", "code_problem", "debug_code", "code_explain", "code_debug", ...textInputTypes].includes(questionType)
    
    if (shouldAutoSave && answer) {
      const raw = Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[currentQuestion.id] || 0)
      autoSaveAnswer(currentQuestion.id, answer, questionType, undefined, capTimeSpent(currentQuestion.id, raw))
    }
  }

  const toggleFlag = async (questionId: number) => {
    if (!attemptId) return

    const isFlagged = flaggedQuestions.has(questionId)
    const newFlagged = new Set(flaggedQuestions)

    if (isFlagged) {
      newFlagged.delete(questionId)
    } else {
      newFlagged.add(questionId)
    }

    setFlaggedQuestions(newFlagged)

    studentApiFetch("/api/student/flag-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId,
        questionId,
        isFlagged: !isFlagged,
      }),
    }).catch(() => {
      // Revert on error
      setFlaggedQuestions(flaggedQuestions)
    })
  }

  // Retry system evaluation for a failed question
  const retryAIGrading = async () => {
    if (!failedQuestionData) return
    
    setRetryingSubmission(true)
    setAiGradingFailed(false)
    
        toast({
          title: "🔄 Retrying Evaluation...",
          description: "Attempting to evaluate your answer again.",
        })
    
    if (!attemptId) return
    try {
      const evalResponse = await studentApiFetch(`/api/${normalizedType}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          questionId: failedQuestionData.questionId,
          answer: failedQuestionData.answer,
          questionType: failedQuestionData.questionType,
          typingReplay: antiCheatConfig.keystrokePlaybackEnforced !== false ? (typingReplayByQuestionRef.current[failedQuestionData.questionId] ?? undefined) : undefined,
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      })
      
      const evalData = await evalResponse.json()
      
      if (evalResponse.ok && !evalData.requiresManualReview) {
        // Success!
        rememberEvalFeedback(failedQuestionData.questionId, evalData)
        setAiFeedback(evalData)
        setFailedQuestionData(null)
        
        // Update the display
        setIsCorrect(evalData.isCorrect)
        setPartialCreditPoints(evalDisplayPointsForUi(evalData, questionType))
        
        toast({
          title: "✅ Grading Successful!",
          description: `Your answer has been graded: ${evalData.score}%`,
        })
        
        // Save the updated result
        const timeSpent = capTimeSpent(failedQuestionData.questionId, questionTimeSpent[failedQuestionData.questionId] || 0)
        await saveAnswer(
          failedQuestionData.questionId,
          failedQuestionData.answer,
          failedQuestionData.questionType,
          failedQuestionData.attemptNumber,
          evalData.isCorrect,
          evalData,
          antiCheatConfig.keystrokePlaybackEnforced !== false ? typingReplayByQuestionRef.current[failedQuestionData.questionId] : undefined,
          timeSpent
        )
      } else {
        // Still failing
        setAiGradingFailed(true)
        toast({
          title: "⚠️ Retry Failed",
          description: "System evaluation is still unavailable. Your answer is saved for manual review.",
          variant: "destructive",
        })
      }
    } catch (error) {
      setAiGradingFailed(true)
      toast({
        title: "❌ Retry Failed",
        description: "Could not reach grading service. Your answer is saved for manual review.",
        variant: "destructive",
      })
    } finally {
      setRetryingSubmission(false)
    }
  }

  // Process queued answers when connection is restored or periodically (for slow/intermittent connections)
  const processAnswerQueue = async () => {
    if (answerQueue.length === 0) return

    setRetryingSubmission(true)

    const queue = [...answerQueue]
    setAnswerQueue([])
    let failedCount = 0

    for (const queuedAnswer of queue) {
      try {
        await submitAnswerToServer(queuedAnswer)
      } catch (error) {
        failedCount++
        setAnswerQueue(prev => [...prev, queuedAnswer])
      }
    }

    setRetryingSubmission(false)

    if (failedCount === 0) {
      notifySubmissionOnce(toast, `queue-sync-${attemptId ?? "unknown"}`, {
        title: "✅ All Answers Synced",
        description: "Your answers have been successfully saved to the server.",
      })
    }
  }

  const processAnswerQueueRef = useRef(processAnswerQueue)
  processAnswerQueueRef.current = processAnswerQueue

  // Periodic retry for queued answers (helps slow/intermittent connections that never fire "online")
  useEffect(() => {
    if (answerQueue.length === 0 || !isOnline) return
    const id = setInterval(() => {
      if (answerQueue.length > 0 && isOnline) processAnswerQueueRef.current?.()
    }, 30000)
    return () => clearInterval(id)
  }, [answerQueue.length, isOnline])

  // Submit answer to server with retry logic
  const submitAnswerToServer = async (answerData: any, retryCount = 0): Promise<any> => {
    const maxRetries = 2
    const qt = (answerData?.questionType || '').toLowerCase()
    const isCodeQuestion = ['code_write', 'code_problem', 'code_explain', 'code_write_plot', 'code_debug', 'debug_code'].includes(qt)
    const isMultiPartQuestion = qt === 'multi_part'
    const isCircuitSubmission = qt === 'circuit_submission'
    // Code / multi-part / circuit (vision AI): 3min — evaluation can take 60-90s+
    const timeoutMs =
      isCodeQuestion || isMultiPartQuestion || isCircuitSubmission ? 180000 : 90000

    try {
      const response = await studentApiFetch(`/api/${normalizedType}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answerData),
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      return await response.json()
    } catch (error: any) {
      // Submit attempt failed - retry on timeout, network, or server errors
      const isRetryable =
        error?.name === 'AbortError' ||
        error?.name === 'TimeoutError' ||
        (typeof error?.message === 'string' && (
          error.message.includes('fetch') ||
          error.message.includes('Server error') ||
          error.message.includes('timeout') ||
          error.message.includes('network') ||
          error.message.includes('Failed to fetch')
        ))

      if (retryCount < maxRetries && isRetryable) {
        // Retry silently — no toast; avoid annoying students with retry notifications
        const baseDelay = 2000 * Math.pow(2, retryCount)
        const jitter = Math.random() * 1000
        const delay = Math.min(baseDelay + jitter, 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
        return submitAnswerToServer(answerData, retryCount + 1)
      }

      notifySubmissionOnce(
        toast,
        `submit-continue-${answerData?.attemptId}-${answerData?.questionId}`,
        {
          title: "Continue",
          description:
            "Your answer is saved and will be reviewed. You can continue — re-evaluate on the results page when you're done.",
          variant: "default",
          duration: 6000,
        },
      )

      throw error
    }
  }

  const handleAnswerSubmit = async (answerOverride?: string, isAutoSubmit = false) => {
    // Block if quiz is finalized (allow auto-submit for violation submissions)
    if (isQuizFinalized && !isAutoSubmit) return
    if (isLockedDueToViolations && !isAutoSubmit) return
    // CRITICAL: For auto-submit (timer expiry), don't check isSubmittingAnswer
    // This prevents blocking when timer expires during an ongoing submission
    if (!quiz) return
    if (!isAutoSubmit && isSubmittingAnswer) return

    const currentQuestion = quiz.questions[currentQuestionIndex]
    const questionType = currentQuestion.question_type || "mcq"

    const isFillInType = ["fill_blank", "code_output", "trace_output", "fill_code", "trace_logic"].includes(
      questionType.toLowerCase(),
    )

    const isLockableType = ["mcq", "true_false", "select_all", "multi_output", "multi_part"].includes(
      questionType.toLowerCase(),
    )

    if (
      isLockableType &&
      submittedQuestions.has(currentQuestion.id) &&
      !isAutoSubmit
    ) {
      toast({
        title: "Question Already Attempted",
        description: "You have already submitted an answer for this question and cannot change it.",
        variant: "default",
      })
      return
    }

    if (
      questionType.toLowerCase() === "circuit_submission" &&
      (lockedQuestions.has(currentQuestion.id) || submittedQuestions.has(currentQuestion.id)) &&
      !allowsSubmissionReplacement(questionType, currentSectionConfig) &&
      !isAutoSubmit
    ) {
      toast({
        title: "Submission Locked",
        description:
          "This circuit question was already submitted. You can view feedback but cannot revise or resubmit.",
        variant: "default",
      })
      return
    }

    if (questionType.toLowerCase() === "circuit_submission" && !isAutoSubmit) {
      circuitPrepareSubmitRef.current?.()
      let answerForUploadCheck =
        answerOverride !== undefined ? answerOverride : getCircuitAnswerJson()
      const parsedForExport = parseCircuitSubmissionAnswer(answerForUploadCheck)
      const shouldAutoExportWorkspace =
        parsedForExport.submission_mode === "workspace" &&
        workspaceHasContent(parsedForExport.workspace)
      if (shouldAutoExportWorkspace && attemptId && parsedForExport.workspace) {
        let studentIdRaw =
          typeof window !== "undefined" ? sessionStorage.getItem("studentDatabaseId") : null
        if (!studentIdRaw) {
          const sid = sessionStorage.getItem("studentId")
          if (sid) {
            try {
              const infoRes = await studentApiFetch(`/api/student/info?student_id=${sid}`)
              const infoData = await infoRes.json()
              if (infoRes.ok && infoData.student?.id) {
                studentIdRaw = String(infoData.student.id)
                sessionStorage.setItem("studentDatabaseId", studentIdRaw)
              }
            } catch {
              /* resolve below */
            }
          }
        }
        const studentId = studentIdRaw ? Number(studentIdRaw) : NaN
        if (!Number.isFinite(studentId)) {
          toast({
            title: "Cannot submit workspace",
            description: "Session data is missing. Refresh the page and try again.",
            variant: "destructive",
          })
          return
        }
        try {
          const uploads = await exportCircuitWorkspaceUploads({
            workspace: parsedForExport.workspace,
            attemptId,
            questionId: currentQuestion.id,
            studentDatabaseId: studentId,
          })
          answerForUploadCheck = JSON.stringify({
            ...parsedForExport,
            solution_uploads: uploads,
            submission_status: "draft",
          })
          setSelectedAnswer(answerForUploadCheck)
        } catch (exportErr) {
          const detail =
            exportErr instanceof Error ? exportErr.message : "Could not export your workspace for grading."
          toast({
            title: "Workspace save failed",
            description: `${detail} Tap Save in the workspace, then try again.`,
            variant: "destructive",
          })
          return
        }
      }
      if (
        !circuitSubmissionHasRequiredUpload(
          answerForUploadCheck,
          parseCircuitSubmissionConfig(currentQuestion.solution_upload_config),
        )
      ) {
        const parsedCheck = parseCircuitSubmissionAnswer(answerForUploadCheck)
        const isWorkspace = parsedCheck.submission_mode === "workspace"
        toast({
          title: isWorkspace ? "Workspace required" : "Upload required",
          description: isWorkspace
            ? "Write your solution in the workspace and save before submitting."
            : "Upload at least one solution file before submitting.",
          variant: "destructive",
        })
        return
      }
      if (answerOverride === undefined && answerForUploadCheck !== selectedAnswer) {
        answerOverride = answerForUploadCheck
      }
    }

    if (questionType.toLowerCase() === "multi_part" && !isAutoSubmit) {
      const answerForUploadCheck =
        answerOverride !== undefined ? answerOverride : selectedAnswer || "{}"
      const missingOptional = multiPartMissingOptionalSolutionUpload(
        currentQuestion.subquestions,
        answerForUploadCheck,
        currentQuestion.solution_upload_config,
      )
      if (
        missingOptional.length > 0 &&
        !confirmedSkipSolutionUploadRef.current.has(currentQuestion.id) &&
        multiPartOffersSolutionUpload(currentQuestion)
      ) {
        const uploadMax = deriveMultiPartGradingPolicy(
          currentQuestion.subquestions,
          currentQuestion.solution_upload_config,
        ).upload_total_points
        setSkipSolutionUploadDialog({
          uploadMaxPoints: uploadMax,
          onConfirm: () => {
            confirmedSkipSolutionUploadRef.current.add(currentQuestion.id)
            setSkipSolutionUploadDialog(null)
            void handleAnswerSubmit(answerOverride, isAutoSubmit)
          },
        })
        return
      }
    }

    const currentAttempts = attemptCount[currentQuestion.id] || 0
    const newAttemptCount = currentAttempts + 1


    let answerToSubmit: any
    let plotImage: string | null = null
    
    if (questionType === "mcq" || questionType === "true_false") {
      answerToSubmit = answerOverride !== undefined ? answerOverride : selectedAnswer || ""
    } else if (questionType === "multi_output" || questionType === "select_all") {
      answerToSubmit = selectedMultiAnswers
    } else if (questionType === "code_write_plot") {
      // CRITICAL FIX: For code_write_plot, prioritize saved code over current state
      const savedInStorage = codeByQuestion[currentQuestion.id]
      const currentCodeState = code
      const savedPlot = uploadedPlot || plotByQuestion[currentQuestion.id] || null
      
      // Use saved code if it exists and is not the generic MATLAB template
      const matlabTemplate = `% MATLAB Script\n% Start your code here\n\ndisp('Hello, MATLAB!');\n`
      
      let savedCode
      if (savedInStorage && savedInStorage.trim() !== matlabTemplate.trim()) {
        savedCode = savedInStorage
      } else if (currentCodeState && currentCodeState.trim() !== matlabTemplate.trim()) {
        savedCode = currentCodeState
      } else {
        // Both are generic template or empty - use current state
        savedCode = currentCodeState || savedInStorage || ""
      }
      
      answerToSubmit = savedCode
      plotImage = savedPlot
      
    } else if (questionType === "code_problem" || questionType === "debug_code" || questionType === "code_write" || questionType === "code_explain" || questionType === "code_debug") {
      // For code questions, PREFER editor.getValue() (source of truth) - fixes "typed answer not showing" bug
      // Editor may have content before React state syncs; student can type and click Submit quickly
      const savedInStorage = codeByQuestion[currentQuestion.id]
      const currentCodeState = code
      const fromEditor = codeEditorRef.current?.getValue?.()
      
      const isUnsavedTemplate = (codeToCheck: string | null | undefined): boolean =>
        isTemplateCode(codeToCheck ?? "", questionType)

      // Get the most recent code - PREFER editor (source of truth), then codeByQuestion, code state, codeSyncRef
      let savedCode = (fromEditor != null && fromEditor !== undefined ? fromEditor : null) ?? savedInStorage ?? currentCodeState ?? codeSyncRef.current ?? ""
      
      // Also check localStorage as a fallback
      if (!savedCode && typeof window !== "undefined") {
        try {
          const stored = localStorage.getItem(getCodeStorageKey(currentQuestion.id))
          if (stored) {
            savedCode = stored
          }
        } catch (e) {
          // localStorage access failed, continue with savedCode
        }
      }

      // If we have savedInStorage and it differs from savedCode, prefer savedInStorage
      if (savedInStorage && savedInStorage !== savedCode) {
        savedCode = savedInStorage
      }

      // If no saved code but we have current code state, use it
      if (!savedCode && currentCodeState) {
        savedCode = currentCodeState
      }

      // CRITICAL: If code is just template and student never typed anything, save as empty string
      // This prevents template code from being saved as student's answer
      // However, if student modified the template even slightly, save their version
      if (savedCode && isTemplateCode(savedCode)) {
        // Check if current code state differs from template (student made changes)
        if (currentCodeState && !isTemplateCode(currentCodeState)) {
          // Student modified the code - save their version
          savedCode = currentCodeState
          // Also update codeByQuestion to persist this
          setCodeByQuestion((prev) => ({ ...prev, [currentQuestion.id]: currentCodeState }))
          persistCodeValue(currentQuestion.id, currentCodeState)
        } else {
          // Code is still template - save as empty string to indicate no answer
          savedCode = ""
        }
      }

      // Ensure codeByQuestion is updated if we have current code state
      if (!savedInStorage && currentCodeState && !isTemplateCode(currentCodeState)) {
        setCodeByQuestion((prev) => ({ ...prev, [currentQuestion.id]: currentCodeState }))
        persistCodeValue(currentQuestion.id, currentCodeState)
      }

      answerToSubmit = savedCode
    } else if (questionType.toLowerCase() === "circuit_submission") {
      if (!isAutoSubmit) circuitPrepareSubmitRef.current?.()
      const rawAnswer =
        answerOverride !== undefined ? answerOverride : getCircuitAnswerJson()
      const parsed = parseCircuitSubmissionAnswer(rawAnswer)
      answerToSubmit = compactCircuitSubmissionForSubmit({
        ...parsed,
        submission_status: "submitted",
      })
    } else {
      answerToSubmit = selectedAnswer || ""
    }

    if (answerToSubmit && !(Array.isArray(answerToSubmit) && answerToSubmit.length === 0)) {
      setAnsweredQuestions((prev) => new Set(prev).add(currentQuestion.id))
    }

    const isCodeQ = ["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(questionType?.toLowerCase() || "")
    const hasNoAnswer = !answerToSubmit || (Array.isArray(answerToSubmit) && answerToSubmit.length === 0)
    if (hasNoAnswer) {
      if (isAutoSubmit) {
        // CRITICAL: For code questions, always save even "" so we have a record (fixes Q1 data loss)
        const toSave = isCodeQ ? (answerToSubmit ?? "") : null
        const raw = Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[currentQuestion.id] || 0)
        await saveAnswer(currentQuestion.id, toSave, questionType, newAttemptCount, false, undefined, isCodeQ && antiCheatConfig.keystrokePlaybackEnforced !== false ? typingReplayByQuestionRef.current[currentQuestion.id] : undefined, capTimeSpent(currentQuestion.id, raw))
        return
      } else {
        if (currentQuestionIndex < quiz.questions.length - 1) {
          pauseActivePerQuestionTimer()
          setCurrentQuestionIndex(currentQuestionIndex + 1)
          setSelectedAnswer("")
          setSelectedMultiAnswers([])
          setShowFeedback(false)
        } else {
          handleSubmitQuiz()
        }
        return
      }
    }

    let studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
    let sectionCode = sessionStorage.getItem("studentSection")

    // If missing, try to fetch from API - but don't block submission if fetch fails
    // This allows students to continue even if sessionStorage is cleared
    if (!studentDatabaseId || !sectionCode) {
      const studentId = sessionStorage.getItem("studentId")
      
      if (!studentId) {
        // Session expired - show dialog and auto-logout
        showError("session_expired")
        return
    }

      try {
        // Fetch student info to get missing values (non-blocking)
        const infoResponse = await studentApiFetch(`/api/student/info?student_id=${studentId}`)
        const infoData = await infoResponse.json()

        if (infoResponse.ok) {
          // Update missing values if fetch succeeds
          if (!studentDatabaseId && infoData.student?.id) {
            studentDatabaseId = infoData.student.id.toString()
            sessionStorage.setItem("studentDatabaseId", studentDatabaseId || "")
          }
          
          if (!sectionCode && infoData.student?.section) {
            sectionCode = infoData.student.section
            sessionStorage.setItem("studentSection", sectionCode || "")
          }
        }
      } catch (error) {
        // Log error but don't block - allow submission to continue
        // Failed to retrieve session data, but continuing
        // Try to use attemptId to get studentDatabaseId if available
        if (!studentDatabaseId && attemptId) {
          // We can still proceed - the API will handle missing studentDatabaseId
        }
      }
    }
    
    // Only require studentDatabaseId for API calls, not for navigation
    // If still missing, we'll let the API handle the error rather than blocking here

    // Convert letter answers to option text values for proper evaluation
    const convertLetterToOption = (letter: string): string => {
      const optionMap: Record<string, string> = {
        'A': currentQuestion.option_a,
        'B': currentQuestion.option_b,
        'C': currentQuestion.option_c,
        'D': currentQuestion.option_d,
        'E': currentQuestion.option_e || ""
      }
      return optionMap[letter] || letter
    }

    // Convert answers based on type
    // CRITICAL FIX: Keep answers as letters (A, B, C, D, E) for storage
    // The evaluation API will handle conversion to option texts for comparison
    // This ensures answers are saved correctly and can be displayed properly in reports
    // Converting to option texts before saving causes mismatch issues in reports
    let convertedAnswer = answerToSubmit
    if (Array.isArray(answerToSubmit)) {
      // For select_all, keep letters as-is (don't convert to option texts)
      // This ensures proper storage and display in reports
      convertedAnswer = answerToSubmit
    } else if (typeof answerToSubmit === 'string' && ['A', 'B', 'C', 'D', 'E'].includes(answerToSubmit)) {
      // CRITICAL FIX: Keep MCQ/true_false answers as letters, don't convert to option texts
      // The evaluation API handles both letter and text formats
      // Converting here causes reports to show "not answered" when answers were actually saved
      convertedAnswer = answerToSubmit
    }

    setIsSubmittingAnswer(true)
    
    // Show AI checking status for code questions
    if (isAIGradableQuestion) {
      setAiGradingStatus("checking")
    }

    setAttemptCount({ ...attemptCount, [currentQuestion.id]: newAttemptCount })
    setAnswers({
      ...answers,
      [currentQuestion.id]:
        typeof convertedAnswer === "string"
          ? convertedAnswer
          : JSON.stringify(convertedAnswer),
    })

    // For code questions (code_write, code_write_plot, code_problem, debug_code):
    // Multi-part with solution upload uses the same async AI grading path.
    const isCodeQuestion = ["code_write", "code_write_plot", "code_problem", "debug_code", "code_explain", "code_debug"].includes(questionType.toLowerCase())
    const answerForMultiPartAiCheck =
      answerOverride !== undefined
        ? answerOverride
        : questionType.toLowerCase() === "circuit_submission"
          ? getCircuitAnswerJson()
          : selectedAnswer || "{}"
    const isMultiPartSolutionAi =
      questionType.toLowerCase() === "multi_part" &&
      multiPartStudentAnswerHasUpload(
        answerForMultiPartAiCheck,
        currentQuestion.solution_upload_config,
      )
    const isCircuitSubmissionAi =
      questionType.toLowerCase() === "circuit_submission" &&
      circuitSubmissionHasRequiredUpload(
        answerForMultiPartAiCheck,
        parseCircuitSubmissionConfig(currentQuestion.solution_upload_config),
      )
    const isAsyncAiEvalQuestion = isCodeQuestion || isMultiPartSolutionAi || isCircuitSubmissionAi
    
    if (isAsyncAiEvalQuestion) {
      
      if (!convertedAnswer) {
        // No answer provided, but still allow navigation
        toast({
          title: "No Answer",
          description: "You can continue to the next question.",
          variant: "default",
          duration: 3000,
        })
        setIsSubmittingAnswer(false)
        return
      }

      try {
        // For code_write_plot, include plot image in the answer data
        let answerToSave = convertedAnswer
        if (questionType === "code_write_plot" && plotImage) {
          answerToSave = JSON.stringify({
            code: convertedAnswer,
            plotImage: plotImage
          })
        }
        
        // Save answer with "processing" status first (include plotImage for code_write_plot)
        const raw = Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[currentQuestion.id] || 0)
        const timeSpent = capTimeSpent(currentQuestion.id, raw)
        const saveResult = await saveAnswer(
          currentQuestion.id,
          answerToSave,
          questionType,
          newAttemptCount,
          false, // isCorrect - will be updated after evaluation
          {
            aiGraded: isAIGradableQuestion,
            requiresManualReview: isAIGradableQuestion,
            score: 0,
            feedback: "Processing...",
            plotImage: questionType === "code_write_plot" ? plotImage : undefined
          },
          typingReplayByQuestionRef.current[currentQuestion.id],
          timeSpent
        )

        if (saveResult.outcome === "failed") {
          setIsSubmittingAnswer(false)
          return
        }

        // Track submission only when the server accepted the answer (or fallback recorded it)
        if (
          isAIGradableQuestion &&
          (saveResult.outcome === "saved" || saveResult.outcome === "pending" || saveResult.outcome === "queued")
        ) {
          setAiGradedQuestionsSubmitted((prev) => new Set(prev).add(currentQuestion.id))
        }

        if (
          questionType.toLowerCase() === "circuit_submission" &&
          (saveResult.outcome === "saved" || saveResult.outcome === "pending" || saveResult.outcome === "queued") &&
          !allowsSubmissionReplacement(questionType, currentSectionConfig)
        ) {
          setLockedQuestions((prev) => new Set(prev).add(currentQuestion.id))
          setSubmittedQuestions((prev) => new Set(prev).add(currentQuestion.id))
        }

        // Save first, wait for AI with spinners. On timeout: allow proceed + 1 background retry.
        if (isAIGradableQuestion && (saveResult.outcome === "saved" || saveResult.outcome === "pending")) {
          setShowFeedback(false)
          const FEEDBACK_TIMEOUT_MS = 180000 // 3min - AI can take 60-90s; avoid premature message
          const navTimeout = setTimeout(() => {
            setIsSubmittingAnswer(false)
            notifySubmissionOnce(toast, `eval-continue-${currentQuestion.id}`, {
              title: "Continue",
              description:
                "Your answer is saved. You can proceed to the next question — re-evaluate on the results page when you're done.",
              variant: "default",
              duration: 6000,
            })
          }, FEEDBACK_TIMEOUT_MS)

          evaluateAnswerInBackground(
            currentQuestion.id,
            convertedAnswer,
            questionType,
            newAttemptCount,
            plotImage
          ).then((evalData) => {
            clearTimeout(navTimeout)
            const questionIndex =
              quiz?.questions.findIndex((q) => q.id === currentQuestion.id) ?? -1
            if (isViewingQuestionIndex(questionIndex)) {
              setIsSubmittingAnswer(false)
              if (evalData) {
                rememberEvalFeedback(currentQuestion.id, evalData)
                setAiFeedback(evalData)
                setShowFeedback(true)

                if (evalData.requiresManualReview && evalData.errorType) {
                  setAiGradingStatus("error")
                  setAiGradingFailed(true)
                } else {
                  setAiGradingFailed(false)
                  const score = evalData.score || 0
                  if (score >= 90) {
                    setAiGradingStatus("success")
                  } else if (score > 0 && score < 90) {
                    setAiGradingStatus("partial")
                  } else {
                    setAiGradingStatus("error")
                  }
                }
              }
            } else if (evalData) {
              rememberEvalFeedback(currentQuestion.id, evalData)
            }
          }).catch(() => {
            clearTimeout(navTimeout)
            setIsSubmittingAnswer(false)
            notifySubmissionOnce(toast, `eval-issue-${currentQuestion.id}`, {
              title: "⚠️ Evaluation Issue",
              description: "Your answer was saved and flagged for manual evaluation by your instructor.",
              variant: "default",
              duration: 5000,
            })
          })
          
          return
        } else {
          // Not AI-gradable, just save (no toast - minimal interruption)
          setIsSubmittingAnswer(false)
        }
      } catch (saveError) {
        setIsSubmittingAnswer(false)
        toast({
          title: "⚠️ Save Error",
          description: "Your answer may not have been saved. Please try submitting again or contact your instructor.",
          variant: "destructive",
          duration: 5000,
        })
      }
      
      return
    }

    // For code questions: wait for feedback; allow navigation only after feedback or timeout
    // For non-code: allow navigation immediately
    if (!isAIGradableQuestion) {
      setIsSubmittingAnswer(false)
      setShowFeedback(false)
    }
    
    if (convertedAnswer) {
      // Save and evaluate in background with timeout protection
      const saveAndEvaluatePromise = (async () => {
        try {
          // First, save answer immediately (with placeholder evaluation data)
          let answerToSave = convertedAnswer
          if (questionType === "code_write_plot" && plotImage) {
            answerToSave = JSON.stringify({
              code: convertedAnswer,
              plotImage: plotImage
            })
          }
          
          // Save answer first with placeholder status (include plotImage for code_write_plot)
          const raw = Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[currentQuestion.id] || 0)
        const timeSpent = capTimeSpent(currentQuestion.id, raw)
          const saveResult = await saveAnswer(
            currentQuestion.id,
            answerToSave,
            questionType,
            newAttemptCount,
            false, // isCorrect - will be updated after evaluation
            {
              aiGraded: isAIGradableQuestion,
              requiresManualReview: isAIGradableQuestion,
              score: 0,
              feedback: "Processing...",
              plotImage: questionType === "code_write_plot" ? plotImage : undefined
            },
            antiCheatConfig.keystrokePlaybackEnforced !== false ? typingReplayByQuestionRef.current[currentQuestion.id] : undefined,
            timeSpent
          )

          if (saveResult.outcome === "failed") {
            setIsSubmittingAnswer(false)
            return
          }

          const serverGradesOnSubmit = isServerGradedQuestionType(questionType)
          const submitResponseServerGraded =
            serverGradesOnSubmit &&
            saveResult.submitResponse?.serverGraded === true &&
            saveResult.submitResponse?.success !== false
          let evalResponse: Response | null = null
          let evalData: any = {}

          if (submitResponseServerGraded) {
            evalData = evalDataFromSubmitResponse(
              saveResult.submitResponse!,
              questionType,
              currentQuestion.max_points || currentQuestion.points,
            )
          } else {
          // Then evaluate in background (Evaluation Complete toast shows when done)
      const evalController = new AbortController()
          const evalTimeout = setTimeout(() => evalController.abort(), 180000) // 3min for AI evaluation
      
          try {
      evalResponse = await studentApiFetch(`/api/${normalizedType}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          questionId: currentQuestion.id,
          answer: convertedAnswer,
          questionType,
          plotImage: questionType === "code_write_plot" ? plotImage : undefined,
          typingReplay: antiCheatConfig.keystrokePlaybackEnforced !== false ? (typingReplayByQuestionRef.current[currentQuestion.id] ?? undefined) : undefined,
        }),
        signal: evalController.signal,
      })

      clearTimeout(evalTimeout)
      
      evalData = await evalResponse.json()
          } catch {
            clearTimeout(evalTimeout)
            evalResponse = null
          }
          }

            const evalOk = submitResponseServerGraded
              ? saveResult.submitResponse?.success !== false
              : Boolean(evalResponse?.ok)

            if (evalOk) {
              setIsSubmittingAnswer(false)
              if (!submitResponseServerGraded) {
              // Update saved answer with evaluation results (include plotImage for code_write_plot)
              const rawUpdate = Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[currentQuestion.id] || 0)
        const timeSpentUpdate = capTimeSpent(currentQuestion.id, rawUpdate)
              await saveAnswer(
                currentQuestion.id,
                answerToSave,
                questionType,
                newAttemptCount,
                Boolean(evalData.isCorrect),
                { ...evalData, plotImage: questionType === "code_write_plot" ? plotImage : undefined },
                antiCheatConfig.keystrokePlaybackEnforced !== false ? typingReplayByQuestionRef.current[currentQuestion.id] : undefined,
                timeSpentUpdate
              )
              }
              
              // Update UI if still on this question
              const questionIndex = quiz?.questions.findIndex((q) => q.id === currentQuestion.id) ?? -1
              if (isViewingQuestionIndex(questionIndex)) {
      const showEvalPanel = shouldShowEvalFeedbackPanel(evalData)
      const isAIGraded = evalData.aiGraded || false
      if (showEvalPanel) {
        rememberEvalFeedback(currentQuestion.id, evalData)
        setAiFeedback(evalData)
        setShowFeedback(true)
        setPartialCreditPoints(evalDisplayPointsForUi(evalData, questionType))
        setIsCorrect(evalData.isCorrect)

        if (evalData.requiresManualReview && evalData.errorType) {
          setAiGradingStatus("error")
          setAiGradingFailed(true)
          setFailedQuestionData({
            questionId: currentQuestion.id,
            answer: convertedAnswer,
            questionType,
            attemptNumber: newAttemptCount
          })
        } else {
          setAiGradingFailed(false)
          setFailedQuestionData(null)

          if (evalData.isCorrect || evalData.score >= 90) {
            setAiGradingStatus("success")
          } else if (evalData.score > 0 && evalData.score < 90) {
            setAiGradingStatus("partial")
          } else {
            setAiGradingStatus(isAIGraded ? "error" : "partial")
          }
        }
      } else {
        // For non-AI questions (MCQ, True/False, Select All), show instant feedback
        setAiFeedback(null)
        setAiGradingFailed(false)
        setFailedQuestionData(null)
        setAiGradingStatus("idle")

        setIsCorrect(evalData.isCorrect)
        setShowFeedback(true)
        setPartialCreditPoints(evalDisplayPointsForUi(evalData, questionType))
        rememberObjectiveGrade(
          currentQuestion.id,
          evalData,
          currentQuestion.max_points || currentQuestion.points,
        )

        const isMultiSelectType =
          questionType === "select_all" || questionType === "multi_output"
        if (isMultiSelectType) {
          setShowFeedback(false)
          setAiFeedback(null)
        }

        // Auto-hide feedback after 3 seconds for non-AI questions
        const feedbackQuestionIndex = currentQuestionIndex
        setTimeout(() => {
          if (currentIndexRef.current !== feedbackQuestionIndex) return
          setShowFeedback(false)
          if (!isMultiSelectType) {
            setSelectedAnswer("")
          } else {
            setSelectedMultiAnswers([])
          }
        }, 3000)
      }

                // Show feedback toast
                if (isFillInType) {
                  const partialCredit = newAttemptCount > 3 && evalData.isCorrect 
                    ? Math.max(0, 1 - (newAttemptCount - 3) * 0.1) 
                    : null
                  
                  if (evalData.isCorrect) {
                    const pointsEarned = partialCredit || 1
                    toast({
                      title: "🎉 Evaluation Complete!",
                      description: `${pointsEarned < 1 ? Math.round(pointsEarned * 100) + '% partial credit' : '+' + pointsEarned + ' point' + (pointsEarned > 1 ? 's' : '')} earned!`,
                      variant: "default",
                      className: "border-green-500 bg-emerald-50 dark:bg-emerald-950/30",
                    })
                  }
                } else if (isAIGraded || isMultiPartGradedEval(evalData)) {
                  const maxPoints = evalData.maxPoints || currentQuestion?.points || 100
                  const displayPts = evalDisplayPointsForUi(evalData, questionType)
                  const isCircuitProvisional =
                    questionType.toLowerCase() === "circuit_submission" &&
                    (evalData.provisionalScore === true ||
                      evalData.requiresInstructorApproval === true)

                  toast({
                    title: isCircuitProvisional ? "📋 Provisional preview (not final)" : "📊 Evaluation Complete",
                    description: isCircuitProvisional
                      ? circuitProvisionalToastDescription(displayPts, maxPoints)
                      : `${evalData.score || 0}% (${(evalData.pointsEarned || 0).toFixed(1)}/${maxPoints} pts)`,
                    variant: "default",
                    duration: isCircuitProvisional ? 6000 : 2500,
                  })
                } else {
                  // For non-AI questions, show instant feedback toast
                  if (evalData.isCorrect) {
                    toast({
                      title: "✅ Correct!",
                      description: `Great job! You earned ${evalData.pointsEarned || 0} point${(evalData.pointsEarned || 0) !== 1 ? 's' : ''}.`,
                      variant: "default",
                      className: "border-green-500 bg-emerald-50 dark:bg-emerald-950/30",
                    })
                  } else {
                    toast({
                      title: "❌ Incorrect",
                      description: "Keep trying! You can review the correct answer after submitting.",
                      variant: "default",
                      className: "border-red-500 bg-red-50 dark:bg-red-950/30",
                    })
                  }
                }
                
                // Lock question if applicable (strict objective sections lock on any submit)
        if (
          isLockableType &&
          (!isAutoSubmit || isPerQuestionTimerSection(currentSectionConfig))
        ) {
          setSubmittedQuestions((prev) => new Set(prev).add(currentQuestion.id))
          setLockedQuestions((prev) => new Set(prev).add(currentQuestion.id))
        }
                
                // Track AI-graded submissions
                if (isAIGradableQuestion) {
                  setAiGradedQuestionsSubmitted((prev) => new Set(prev).add(currentQuestion.id))
                }
              }
            } else {
              // evalResponse not ok - answer saved, flagged for instructor
              setIsSubmittingAnswer(false)
              if (isAIGradableQuestion) {
                setAiGradingFailed(true)
                setFailedQuestionData({
                  questionId: currentQuestion.id,
                  answer: convertedAnswer,
                  questionType,
                  attemptNumber: newAttemptCount,
                })
              } else {
                setAiGradingFailed(false)
                setFailedQuestionData(null)
              }
              const errMsg = evalData?.feedback || evalData?.error || "Your answer was saved and flagged for manual evaluation by your instructor."
              notifySubmissionOnce(toast, `eval-issue-${currentQuestion.id}`, {
                title: "⚠️ Evaluation Issue",
                description: errMsg,
                variant: "default",
                duration: 5000,
              })
            }
      } catch (saveError) {
        setIsSubmittingAnswer(false)
        toast({
            title: "⚠️ Save Error",
            description: "Your answer may not have been saved. Please try submitting again.",
          variant: "destructive",
          duration: 5000,
        })
        }
      })()
      
      // For code questions: wait for feedback; on timeout allow navigation and prompt
      const FEEDBACK_TIMEOUT_MS = 60000 // 60 seconds
      if (isAIGradableQuestion) {
        let timeoutId: ReturnType<typeof setTimeout> | null = null
        timeoutId = setTimeout(() => {
          timeoutId = null
          setIsSubmittingAnswer(false)
          toast({
            title: "⏱️ Evaluation Timeout",
            description: "Your answer was saved and flagged for manual evaluation by your instructor.",
            variant: "default",
            duration: 6000,
          })
        }, FEEDBACK_TIMEOUT_MS)
        saveAndEvaluatePromise.finally(() => {
          if (timeoutId) clearTimeout(timeoutId)
        }).catch(() => {
          setIsSubmittingAnswer(false)
        })
      } else {
        saveAndEvaluatePromise.catch(() => {
          setIsSubmittingAnswer(false)
        })
      }
    } else {
      // No answer provided, but still allow navigation
      toast({
        title: "No Answer",
        description: "You can continue to the next question.",
        variant: "default",
        duration: 3000,
      })
    }

    if (
      isLockableType &&
      isPerQuestionTimerSection(currentSectionConfig) &&
      !isAIGradableQuestion &&
      currentQuestionIndex < quiz.questions.length - 1
    ) {
      setTimeout(() => goToQuestion(currentQuestionIndex + 1), 800)
    }
    
    // Allow navigation immediately - don't block
        return
      }

  // Save first, wait for AI. On timeout: allow proceed + 1 background retry. No more retries after that.
  const evaluateAnswerInBackground = async (
    questionId: number,
    answer: any,
    questionType: string,
    attemptNumber: number,
    plotImage?: string | null
  ) => {
    if (!attemptId) return

    const inflight = circuitEvalPromisesRef.current.get(questionId)
    if (inflight) return inflight

    const promise = (async () => {
    evaluationControllersRef.current.set(questionId, new AbortController())
    setPendingEvaluations((prev) => new Set(prev).add(questionId))

    const EVAL_WAIT_MS = 180000 // 3min - AI evaluation can take 60-90s; avoid premature timeout
    const requestBody = {
      attemptId,
      questionId,
      answer: normalizeAnswerForSubmit(answer, questionType),
      questionType,
      plotImage: questionType === "code_write_plot" ? plotImage : undefined,
      typingReplay: antiCheatConfig.keystrokePlaybackEnforced !== false ? (typingReplayByQuestionRef.current[questionId] ?? undefined) : undefined,
    }

    const runOneEval = async (): Promise<Response | null> => {
      const controller = new AbortController()
      evaluationControllersRef.current.set(questionId, controller)
      const evalTimeout = setTimeout(() => controller.abort(), EVAL_WAIT_MS)
      try {
        const res = await studentApiFetch(`/api/${normalizedType}/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        })
        clearTimeout(evalTimeout)
        return res
      } catch {
        clearTimeout(evalTimeout)
        return null
      }
    }

    let evalResponse = await runOneEval()
    if (!evalResponse || !evalResponse.ok) {
      evalResponse = await runOneEval()
    }

    if (!evalResponse || !evalResponse.ok) {
      // Timeout or error: save for manual review, let student proceed — no retry toasts
      evaluationControllersRef.current.delete(questionId)
      setPendingEvaluations((prev) => { const n = new Set(prev); n.delete(questionId); return n })
      const raw = questionTimeSpent[questionId] || 0
      const ans = questionType === "code_write_plot" && plotImage ? JSON.stringify({ code: answer, plotImage }) : answer
      saveAnswer(questionId, ans, questionType, attemptNumber, false, { aiGraded: true, requiresManualReview: true, score: 0, feedback: "Evaluation failed - use Re-evaluate on results page" }, typingReplayByQuestionRef.current[questionId], capTimeSpent(questionId, raw)).catch(() => {})
      return null
    }

    try {
      const evalData = await evalResponse.json()

      const questionIndex = quiz?.questions.findIndex((q) => q.id === questionId) ?? -1

      // Persist to DB immediately (evaluate API also saves server-side; this is the client backup)
      let answerToSave = answer
      if (questionType === "code_write_plot" && plotImage) {
        answerToSave = JSON.stringify({ code: answer, plotImage })
      }
      const rawPersist =
        Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) +
        (questionTimeSpent[questionId] || 0)
      try {
        await saveAnswer(
          questionId,
          answerToSave,
          questionType,
          attemptNumber,
          evalData.isCorrect,
          evalData,
          antiCheatConfig.keystrokePlaybackEnforced !== false
            ? typingReplayByQuestionRef.current[questionId]
            : undefined,
          capTimeSpent(questionId, rawPersist),
        )
        rememberEvalFeedback(questionId, evalData)
      } catch (saveError) {
        console.error("[quiz-taker] Failed to persist evaluation result:", saveError)
      }

      const showEvalPanel = shouldShowEvalFeedbackPanel(evalData)
      const isAIGraded = evalData.aiGraded || false
      const onThisQuestion = isViewingQuestionIndex(questionIndex)
      if (onThisQuestion) {
        if (showEvalPanel) {
          setAiFeedback(evalData)
          setShowFeedback(true)
          setPartialCreditPoints(evalDisplayPointsForUi(evalData, questionType))
          setIsCorrect(evalData.isCorrect)

          if (evalData.requiresManualReview && evalData.errorType) {
            setAiGradingStatus("error")
            setAiGradingFailed(true)
            setFailedQuestionData({
              questionId,
              answer,
              questionType,
              attemptNumber
            })
          } else {
            setAiGradingFailed(false)
            setFailedQuestionData(null)

            if (evalData.isCorrect || evalData.score >= 90) {
              setAiGradingStatus("success")
            } else if (evalData.score > 0 && evalData.score < 90) {
              setAiGradingStatus("partial")
            } else {
              setAiGradingStatus(isAIGraded ? "error" : "partial")
            }
          }
        } else {
          setShowFeedback(false)
          setAiFeedback(null)
          setAiGradingFailed(false)
          setFailedQuestionData(null)
          setAiGradingStatus("idle")
        }
      }

      // Track submitted questions that received eval feedback (includes circuit uploads with aiGraded: false)
      if (isAIGraded || showEvalPanel) {
        setAiGradedQuestionsSubmitted((prev) => new Set(prev).add(questionId))
      }

      if (questionType.toLowerCase() === "circuit_submission") {
        const qIdx =
          questionIndex >= 0
            ? questionIndex
            : quiz?.questions.findIndex((q) => q.id === questionId) ?? -1
        if (qIdx < 0 || !circuitQuestionEditableWhilePoolActive(
          qIdx,
          questionType,
          sectionsRef.current,
          parsedSectionConfigRef.current,
          globalSectionTimersRef.current,
          expiredSectionsRef.current,
        )) {
          setLockedQuestions((prev) => new Set(prev).add(questionId))
          setSubmittedQuestions((prev) => new Set(prev).add(questionId))
        }
      }

      if (onThisQuestion && isAIGraded) {
        const maxPoints = evalData.maxPoints || 100
        const displayPts = evalDisplayPointsForUi(evalData, questionType)
        const isCircuitProvisional =
          questionType.toLowerCase() === "circuit_submission" &&
          (evalData.provisionalScore === true || evalData.requiresInstructorApproval === true)
        notifySubmissionOnce(toast, `eval-complete-${questionId}`, {
          title: isCircuitProvisional ? "📋 Provisional preview (not final)" : "📊 Evaluation Complete",
          description: isCircuitProvisional
            ? circuitProvisionalToastDescription(displayPts, maxPoints)
            : `${evalData.score || 0}% (${(evalData.pointsEarned || 0).toFixed(1)}/${maxPoints} pts)`,
          variant: "default",
          duration: isCircuitProvisional ? 6000 : 2500,
        })
      }

      return evalData
    } catch (error) {
      // Background evaluation error
      
      if (error instanceof Error && error.name === 'AbortError') {
        } else {
        // Show error toast only if still on this question
        const currentQuestion = quiz?.questions.find((q) => q.id === questionId)
        const errQuestionIndex = quiz?.questions.findIndex((q) => q.id === questionId) ?? -1
        if (currentQuestion && isViewingQuestionIndex(errQuestionIndex)) {
          notifySubmissionOnce(toast, `eval-error-${questionId}`, {
            title: "⚠️ Evaluation Error",
            description: "Your answer was saved, but evaluation failed. It will be reviewed manually.",
            variant: "destructive",
            duration: 5000,
          })
        }
      }
      return null
    } finally {
      // Clean up
      evaluationControllersRef.current.delete(questionId)
      setPendingEvaluations((prev) => {
        const next = new Set(prev)
        next.delete(questionId)
        return next
      })
    }
    })()

    circuitEvalPromisesRef.current.set(questionId, promise)
    try {
      return await promise
    } finally {
      circuitEvalPromisesRef.current.delete(questionId)
    }
  }

  type SaveAnswerOutcome = "saved" | "pending" | "queued" | "failed" | "skipped"
  type SaveAnswerResult = {
    outcome: SaveAnswerOutcome
    submitResponse?: Record<string, unknown> | null
  }

  const normalizeAnswerForSubmit = (raw: unknown, qt: string): unknown => {
    if ((qt || "").toLowerCase() === "circuit_submission") {
      return compactCircuitSubmissionForSubmit(raw)
    }
    return raw
  }

  const saveAnswer = async (
    questionId: number,
    answer: any,
    questionType: string,
    attemptNumber: number,
    isCorrect: boolean,
    evalData?: any, // Complete evaluation data (AI or local)
    typingReplay?: { startTime: number; events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }> } | null,
    timeSpentSeconds?: number,
  ): Promise<SaveAnswerResult> => {
    if (!attemptId) return { outcome: "skipped" }

    const answerForServer = normalizeAnswerForSubmit(answer, questionType)

    const answerData = {
          attemptId,
          questionId,
          answer: answerForServer,
          questionType,
          attemptNumber,
          isCorrect,
      timeSpentSeconds: timeSpentSeconds != null && timeSpentSeconds >= 0 ? timeSpentSeconds : undefined,
      typingReplay: (() => {
        const tr = typingReplay?.events?.length ? typingReplay : undefined
        if (["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes((questionType || "").toLowerCase())) {
          console.log("[quiz-taker] [TYPING-REPLAY] saveAnswer called", { questionId, hasReplay: !!tr, eventCount: tr?.events?.length ?? 0 })
        }
        return tr
      })(),
      plotImage: evalData?.plotImage ?? undefined,
      // Pass all evaluation data
      aiFeedback: buildAiFeedbackForSave(evalData, questionType),
      pointsEarned: evalData?.pointsEarned,
      maxPoints: evalData?.maxPoints,
      score: evalData?.score,
      locallyVerified: evalData?.locallyVerified,
      requiresManualReview: evalData?.requiresManualReview,
      errorType: evalData?.errorType,
      technicalError: evalData?.technicalError,
    }

    // Check if online
    if (!isOnline) {
      setAnswerQueue(prev => [...prev, answerData])
      toast({
        title: "📥 Answer Saved Locally",
        description: "Will sync when connection is restored",
        duration: 3000,
      })
      return { outcome: "queued" }
    }

    try {
      const response = await submitAnswerToServer(answerData)
      
      // CRITICAL: Only mark as saved after successful server response
      // Verify the response indicates success
      if (response?.success !== false) {
        setSavedAnswers((prev) => new Set(prev).add(questionId))
        setSubmissionPendingQuestions((prev) => {
          const next = new Set(prev)
          next.delete(questionId)
          return next
        })
        studentApiFetch("/api/student/save-answer", {
          method: "POST",
          headers: attemptApiHeaders(),
          body: JSON.stringify({
            attemptId,
            questionId,
            answer: answerForServer,
            questionType,
            autoSave: true,
            clearSubmissionFailed: true,
          }),
          signal: AbortSignal.timeout(15000),
        }).catch(() => {})
      } else {
        // Answer failed to save
        throw new Error("Save verification failed")
      }
      
      // Show score improvement feedback for AI-graded questions
      if (response?.scoreImproved !== undefined && evalData?.aiGraded) {
        if (response.scoreImproved) {
          toast({
            title: "🎉 Grade Improved!",
            description: response.message || `New score: ${response.currentScore}% (was ${response.previousScore}%)`,
            duration: 4000,
          })
        } else {
          toast({
            title: "📊 Best Score Kept",
            description: response.message || `Your best score: ${response.previousScore}% (current attempt: ${response.currentScore}%)`,
            duration: 4000,
          })
        }
      }
      return { outcome: "saved", submitResponse: response as Record<string, unknown> }
    } catch (error: unknown) {
      // Queue for later if all retries failed
      setAnswerQueue(prev => [...prev, answerData])
      // Remove from saved answers if it was previously marked
      setSavedAnswers((prev) => {
        const next = new Set(prev)
        next.delete(questionId)
        return next
      })
      // CRITICAL: Persist answer to DB so student doesn't lose work - prompt resubmit for grading
      // Don't give automatic 0% - save state and ask them to resubmit
      const err = error instanceof Error ? error : null
      const fallbackPayload = {
        attemptId,
        questionId,
        answer: answerData.answer,
        questionType: answerData.questionType,
        autoSave: true,
        submissionFailed: true,
        submissionErrorType: formatApiErrorMessage(error, err?.name || "Unknown").slice(0, 120),
        submissionRetryCount: 2,
        typingReplay: answerData.typingReplay,
        timeSpentSeconds: answerData.timeSpentSeconds,
      }
      const FALLBACK_TIMEOUT_MS = 30000
      const FALLBACK_MAX_RETRIES = 2
      let fallbackSaved = false
      for (let r = 0; r < FALLBACK_MAX_RETRIES && !fallbackSaved; r++) {
        try {
          const res = await studentApiFetch("/api/student/save-answer", {
            method: "POST",
            headers: attemptApiHeaders(),
            body: JSON.stringify(fallbackPayload),
            signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS),
          })
          if (res.ok) fallbackSaved = true
        } catch (_) {
          if (r < FALLBACK_MAX_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1500 * (r + 1)))
          }
        }
      }
      if (fallbackSaved) {
        setSubmissionPendingQuestions((prev) => new Set(prev).add(questionId))
      }
      notifySubmissionOnce(toast, `save-fail-${questionId}`, {
        title: "⚠️ Submission Failed",
        description: fallbackSaved
          ? "Your answer was saved and flagged for your instructor to evaluate. Don't worry — your work is recorded."
          : "Your answer is cached locally and will sync automatically when your connection improves. It will be reviewed manually when it syncs.",
        variant: "destructive",
        duration: 5000,
      })
      // CRITICAL: Unblock student immediately - answer is saved (or queued for background retry)
      // Non-blocking: let them proceed; processAnswerQueue will resubmit in background
      setIsSubmittingAnswer(false)
      return fallbackSaved ? { outcome: "pending" } : { outcome: "failed" }
    }
  }

  const ensureCircuitSubmissionEvaluated = useCallback(
    async (
      questionId: number,
      answerJson: string,
      solutionUploadConfig: unknown,
      attemptNumber: number,
    ) => {
      if (!attemptId) return null

      const inflight = circuitEvalPromisesRef.current.get(questionId)
      if (inflight) return inflight

      if (questionsWithStoredEval.has(questionId)) return null

      circuitPrepareSubmitRef.current?.()
      const config = parseCircuitSubmissionConfig(solutionUploadConfig)
      const parsed = parseCircuitSubmissionAnswer(answerJson)
      const payload = compactCircuitSubmissionForSubmit({
        ...parsed,
        submission_status: "submitted",
      })

      if (!circuitSubmissionHasRequiredUpload(payload, config)) return null

      const sectionCfg = getSectionConfigAt(
        quiz?.questions.findIndex((q) => q.id === questionId) ?? currentQuestionIndex,
      )
      if (!allowsSubmissionReplacement("circuit_submission", sectionCfg)) {
        setLockedQuestions((prev) => new Set(prev).add(questionId))
        setSubmittedQuestions((prev) => new Set(prev).add(questionId))
      }
      setAiGradedQuestionsSubmitted((prev) => new Set(prev).add(questionId))

      const timeSpent = capTimeSpent(questionId, questionTimeSpent[questionId] || 0)
      const maxPts =
        quiz?.questions.find((q) => q.id === questionId)?.max_points ??
        quiz?.questions.find((q) => q.id === questionId)?.points ??
        10
      await saveAnswer(
        questionId,
        payload,
        "circuit_submission",
        attemptNumber,
        false,
        {
          aiGraded: false,
          requiresManualReview: false,
          score: 0,
          feedback: "Processing...",
          status: "Processing...",
          maxPoints: maxPts,
        },
        undefined,
        timeSpent,
      ).catch(() => {})

      return evaluateAnswerInBackground(
        questionId,
        payload,
        "circuit_submission",
        attemptNumber,
      )
    },
    [
      attemptId,
      pendingEvaluations,
      questionsWithStoredEval,
      saveAnswer,
      capTimeSpent,
      questionTimeSpent,
      quiz,
    ],
  )


  const handleNextQuestion = async () => {
    if (!quiz) return

    if (currentQuestionIndex < quiz.questions.length - 1) {
      await goToQuestion(currentQuestionIndex + 1)
    } else {
      handleSubmitQuiz()
    }
  }

  const goToQuestion = async (index: number) => {
    // Block navigation if quiz is finalized or locked due to violations
    if (isQuizFinalized || isLockedDueToViolations) return
    if (index < 0 || index >= quiz!.questions.length) return
    if (!canNavigateToIndex(index)) {
      return
    }
    
    // Persist live timer state before navigating (timer pauses while on other questions)
    pauseActivePerQuestionTimer()
    const currentQ = quiz!.questions[currentQuestionIndex]
    
    // CRITICAL FIX: Save current answer before navigating away
    if (currentQ && attemptId) {
      const questionType = currentQ.question_type?.toLowerCase() || "mcq"
      const isCodeQuestionForSave = currentQ.requires_code || ["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(questionType)
      const raw = Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[currentQ.id] || 0)

      // Save single answer if exists - NEVER for code questions (prevents MCQ "A" overwriting code)
      if (selectedAnswer && !isCodeQuestionForSave) {
        setAnswers(prev => ({ ...prev, [currentQ.id]: selectedAnswer }))
        autoSaveAnswer(currentQ.id, selectedAnswer, questionType, undefined, capTimeSpent(currentQ.id, raw))
      }

      // Save multi-select answer if exists
      if ((questionType === "select_all" || questionType === "multi_output") && selectedMultiAnswers.length > 0) {
        const multiAnswerStr = JSON.stringify(selectedMultiAnswers)
        setAnswers(prev => ({ ...prev, [currentQ.id]: multiAnswerStr }))
        autoSaveAnswer(currentQ.id, multiAnswerStr, questionType, undefined, capTimeSpent(currentQ.id, raw))
      }

      // Save code answer if exists - use editor/ref for most reliable capture (avoids stale state)
      if (isCodeQuestionForSave) {
        const codeToSave = codeEditorRef.current?.getValue?.() ?? codeSyncRef.current ?? codeByQuestion[currentQ.id] ?? code
        if (codeToSave && codeToSave.trim() !== HELLO_WORLD.trim()) {
          setAnswers(prev => ({ ...prev, [currentQ.id]: codeToSave }))
          setCodeByQuestion((prev) => ({ ...prev, [currentQ.id]: codeToSave }))
          const replay = antiCheatConfig.keystrokePlaybackEnforced !== false ? typingReplayByQuestionRef.current[currentQ.id] : undefined
          autoSaveAnswer(currentQ.id, codeToSave, questionType, replay, capTimeSpent(currentQ.id, raw))
        }
      }

      if (questionType === "circuit_submission") {
        await circuitPrepareSubmitRef.current?.()
        const circuitJson = getCircuitAnswerJson()
        if (circuitJson && circuitJson !== "{}") {
          setAnswers((prev) => ({ ...prev, [currentQ.id]: circuitJson }))
          circuitAnswersByQuestionRef.current[currentQ.id] = circuitJson
          autoSaveAnswer(
            currentQ.id,
            compactCircuitSubmissionForAutoSave(circuitJson),
            questionType,
            undefined,
            capTimeSpent(currentQ.id, raw),
          )
        }
        void ensureCircuitSubmissionEvaluated(
          currentQ.id,
          getCircuitAnswerJson(),
          currentQ.solution_upload_config,
          attemptCount[currentQ.id] ?? 0,
        )
      }

    }
    
    // Dismiss any active toasts when navigating
    dismiss()
    
    // Clean up pending evaluations for the previous question (but keep them running in background)
    const previousQuestion = quiz!.questions[currentQuestionIndex]
    if (previousQuestion) {
      // Don't abort - let evaluations complete in background
      // They will check if we're still on the question before updating UI
    }
    
    setCurrentQuestionIndex(index)
    setShowQuestionNav(false)

    const currentQuestion = quiz!.questions[index]
    setAiGradingStatus("idle") // Reset system evaluation status

    const targetQuestionType = currentQuestion.question_type?.toLowerCase() || "mcq"
    const isTargetAIGradable =
      [
        "code_write",
        "code_write_plot",
        "code_explain",
        "code_problem",
        "debug_code",
        "code_debug",
      ].includes(targetQuestionType) ||
      (targetQuestionType === "multi_part" &&
        multiPartStudentAnswerHasUpload(
          answers[currentQuestion.id] ?? selectedAnswer ?? "{}",
          currentQuestion.solution_upload_config,
        ))
    
    // FIXED: Restore saved code for AI-graded questions instead of resetting to template
    if (isTargetAIGradable) {
      const savedCode = answers[currentQuestion.id]
      const questionType = targetQuestionType
      
      if (savedCode && typeof savedCode === 'string' && savedCode.trim()) {
        // Only restore if it's not just the template
        if (!isTemplateCode(savedCode, questionType)) {
          setCode(savedCode)
        } else {
          const template = questionType === "code_write" ? getCodeTemplate() : HELLO_WORLD
          setCode(template)
        }
      } else {
        const template = questionType === "code_write" ? getCodeTemplate() : HELLO_WORLD
        setCode(template)
      }
    }
  }

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      void goToQuestion(currentQuestionIndex - 1)
    }
  }

  const goToNextQuestion = () => {
    if (currentQuestionIndex < quiz!.questions.length - 1) {
      void goToQuestion(currentQuestionIndex + 1)
    }
  }

  /** Request quiz submission - shows confirmation modal for normal flow, bypasses for violation submissions */
  const requestSubmitQuiz = () => {
    if (isLockedDueToViolations) {
      handleSubmitQuiz()
    } else {
      setShowSubmitConfirmDialog(true)
    }
  }

  const handleSubmitQuiz = async () => {
    // If locked due to violations, bypass normal checks and force submission
    if (isLockedDueToViolations) {
      setSubmitting(true)
      // Skip unsaved answer checks for violation submissions - submit immediately
    } else {
      if (submitting) {
        return
      }
      setSubmitting(true)
    }
    
    // Log quiz submission start
    queueEvent("quiz", "lifecycle", "QUIZ_SUBMIT_START", {
      quizId,
      attemptId,
      answeredCount: answeredQuestions.size,
      totalQuestions: quiz?.questions.length || 0,
      isViolationSubmission: isLockedDueToViolations
    }, "info")
    
    // CRITICAL: Check for unsaved answers before submission
    if (!quiz || !attemptId) {
      // Cannot submit - missing quiz or attemptId
      toast({
        title: "Error",
        description: "No quiz attempt found. Redirecting...",
        variant: "destructive",
      })
      // For violation submissions, still try to redirect
      if (isLockedDueToViolations) {
        router.push(getDashboardPath())
      }
      setSubmitting(false)
      return
    }

    // Build answers payload for consolidated finalize (single request, no internal HTTP fetches)
    const codeTypes = ["code_write", "code_problem", "debug_code", "code_write_plot", "code_explain", "code_debug"]
    const currentQ = quiz.questions[currentQuestionIndex]

    if (currentQ?.question_type?.toLowerCase() === "circuit_submission") {
      circuitPrepareSubmitRef.current?.()
    }

    // Export workspace ink to PNG uploads for every circuit question before finalize
    // (students often skip per-question Submit and only tap Submit Quiz at the end).
    let studentDbIdForWorkspaceExport: number | null = null
    const hasCircuitWorkspace = quiz.questions.some((q) => {
      if ((q.question_type || "").toLowerCase() !== "circuit_submission") return false
      const isCurrent = q.id === currentQ?.id
      const answerJson = getCircuitAnswerForQuestion(q.id, isCurrent)
      if (!answerJson) return false
      const parsed = parseCircuitSubmissionAnswer(answerJson)
      return (
        parsed.submission_mode === "workspace" &&
        workspaceHasContent(parsed.workspace) &&
        !circuitSubmissionHasRequiredUpload(
          answerJson,
          parseCircuitSubmissionConfig(q.solution_upload_config),
        )
      )
    })
    if (hasCircuitWorkspace && attemptId) {
      let studentIdRaw =
        typeof window !== "undefined" ? sessionStorage.getItem("studentDatabaseId") : null
      if (!studentIdRaw) {
        const sid = sessionStorage.getItem("studentId")
        if (sid) {
          try {
            const infoRes = await studentApiFetch(`/api/student/info?student_id=${sid}`)
            const infoData = await infoRes.json()
            if (infoRes.ok && infoData.student?.id) {
              studentIdRaw = String(infoData.student.id)
              sessionStorage.setItem("studentDatabaseId", studentIdRaw)
            }
          } catch {
            /* resolve below */
          }
        }
      }
      const n = studentIdRaw ? Number(studentIdRaw) : NaN
      studentDbIdForWorkspaceExport = Number.isFinite(n) ? n : null
    }
    if (hasCircuitWorkspace && attemptId) {
      for (const q of quiz.questions) {
        const qt = (q.question_type || "").toLowerCase()
        if (qt !== "circuit_submission") continue
        const isCurrent = q.id === currentQ?.id
        if (isCurrent) circuitPrepareSubmitRef.current?.()
        let answerJson = getCircuitAnswerForQuestion(q.id, isCurrent)
        if (!answerJson) continue
        const parsed = parseCircuitSubmissionAnswer(answerJson)
        const config = parseCircuitSubmissionConfig(q.solution_upload_config)
        const needsExport =
          parsed.submission_mode === "workspace" &&
          workspaceHasContent(parsed.workspace) &&
          !circuitSubmissionHasRequiredUpload(answerJson, config)
        if (!needsExport || !parsed.workspace) continue

        let exportedAnswerJson: string | null = null
        if (studentDbIdForWorkspaceExport) {
          try {
            const uploads = await exportCircuitWorkspaceUploads({
              workspace: parsed.workspace,
              attemptId,
              questionId: q.id,
              studentDatabaseId: studentDbIdForWorkspaceExport,
              title: q.title ?? undefined,
            })
            exportedAnswerJson = JSON.stringify({
              ...parsed,
              solution_uploads: uploads,
              submission_status: "draft",
            })
          } catch (exportErr) {
            console.error("[QuizTaker] client workspace export before finalize failed", q.id, exportErr)
          }
        }

        if (!exportedAnswerJson) {
          try {
            const res = await studentApiFetch("/api/student/export-circuit-workspace", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...getStudentAuthHeaders() },
              body: JSON.stringify({
                attemptId,
                questionId: q.id,
                workspace: parsed.workspace,
                title: q.title ?? undefined,
              }),
              signal: AbortSignal.timeout(120_000),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Server workspace export failed")
            exportedAnswerJson =
              typeof data.answerJson === "string" ? data.answerJson : null
          } catch (exportErr) {
            console.error("[QuizTaker] server workspace export before finalize failed", q.id, exportErr)
          }
        }

        if (!exportedAnswerJson) continue

        answerJson = exportedAnswerJson
        circuitAnswersByQuestionRef.current[q.id] = answerJson
        if (isCurrent) setSelectedAnswer(answerJson)
        if (studentDbIdForWorkspaceExport) {
          await autoSaveAnswer(
            q.id,
            compactCircuitSubmissionForAutoSave(answerJson),
            "circuit_submission",
          ).catch(() => {})
        }
      }
    }

    // Persist all in-progress circuit drafts (uploads are not saved until per-question submit or here).
    const circuitDraftSaves: Promise<void>[] = []
    for (const q of quiz.questions) {
      const qt = (q.question_type || "").toLowerCase()
      if (qt !== "circuit_submission") continue
      const isCurrent = q.id === currentQ?.id
      if (isCurrent) circuitPrepareSubmitRef.current?.()
      const answerJson = getCircuitAnswerForQuestion(q.id, isCurrent)
      if (!answerJson) continue
      const config = parseCircuitSubmissionConfig(q.solution_upload_config)
      if (!circuitSubmissionHasRequiredUpload(answerJson, config)) continue
      const raw = capTimeSpent(
        q.id,
        isCurrent
          ? Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) +
              (questionTimeSpent[q.id] || 0)
          : questionTimeSpent[q.id] || 0,
      )
      circuitDraftSaves.push(
        autoSaveAnswer(
          q.id,
          compactCircuitSubmissionForAutoSave(answerJson),
          "circuit_submission",
          undefined,
          raw,
        ).catch(() => {}),
      )
    }
    if (circuitDraftSaves.length > 0) {
      await Promise.allSettled(circuitDraftSaves)
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    const serverAnswersByQid = new Map<
      number,
      { answer?: string | null; answerData?: unknown }
    >()
    if (attemptId) {
      try {
        const restoreRes = await studentApiFetch(`/api/student/attempt/${attemptId}/answers`, {
          headers: getStudentAuthHeaders(),
        })
        if (restoreRes.ok) {
          const savedList = await restoreRes.json()
          if (Array.isArray(savedList)) {
            for (const row of savedList) {
              const qid = Number(row.questionId)
              if (!Number.isFinite(qid)) continue
              serverAnswersByQid.set(qid, {
                answer: row.answer ?? null,
                answerData: row.answerData ?? null,
              })
            }
          }
        }
      } catch {
        /* non-fatal — fall back to in-memory answers */
      }
    }

    const circuitJsonForQuestion = (questionId: number, isCurrent: boolean) =>
      resolveCircuitAnswerJsonForEval([
        isCurrent ? getCircuitAnswerJson() : null,
        circuitAnswersByQuestionRef.current[questionId],
        answers[questionId],
        serverAnswersByQid.get(questionId) ?? null,
      ])

    const answersToFinalize: Array<{ questionId: number; answer: any; questionType: string; plotImage?: string; typingReplay?: any; timeSpentSeconds?: number }> = []

    for (const q of quiz.questions) {
      const qt = (q.question_type || "").toLowerCase()
      const raw = q.id === currentQ?.id
        ? Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[q.id] || 0)
        : (questionTimeSpent[q.id] || 0)
      const timeSec = capTimeSpent(q.id, raw)

      if (codeTypes.includes(qt)) {
        const codeVal = codeByQuestion[q.id] ?? (q.id === currentQ?.id ? code : null) ?? answers[q.id] ?? null
        if (codeVal != null) {
          const toSave = qt === "code_write_plot" && plotByQuestion[q.id]
            ? JSON.stringify({ code: codeVal, plotImage: plotByQuestion[q.id] })
            : codeVal
          const replay = antiCheatConfig.keystrokePlaybackEnforced !== false ? typingReplayByQuestionRef.current[q.id] : undefined
          answersToFinalize.push({
            questionId: q.id,
            answer: toSave,
            questionType: qt,
            plotImage: qt === "code_write_plot" ? plotByQuestion[q.id] : undefined,
            typingReplay: replay,
            timeSpentSeconds: timeSec,
          })
        }
      } else if (qt === "circuit_submission") {
        const answerJson = circuitJsonForQuestion(q.id, q.id === currentQ?.id)
        const config = parseCircuitSubmissionConfig(q.solution_upload_config)
        if (circuitSubmissionHasRequiredUpload(answerJson, config)) {
          answersToFinalize.push({
            questionId: q.id,
            answer: answerJson,
            questionType: qt,
            timeSpentSeconds: timeSec,
          })
        }
      } else {
        let answer: string | null = null
        if (q.id === currentQ?.id) {
          if (qt === "select_all" || qt === "multi_output") {
            const multi = selectedMultiAnswers.length ? selectedMultiAnswers : []
            if (multi.length > 0) answer = JSON.stringify(multi)
          } else {
            const sel = selectedAnswer
            if (sel !== undefined && sel !== null) answer = String(sel)
          }
        }
        if (answer == null) answer = answers[q.id] ?? null
        if (answer != null) {
          answersToFinalize.push({
            questionId: q.id,
            answer: typeof answer === "string" ? answer : String(answer),
            questionType: qt,
            timeSpentSeconds: timeSec,
          })
        }
      }
    }

    // Merge queued answers (from offline/retry) into payload
    for (const queued of answerQueue) {
      const existing = answersToFinalize.find((a) => a.questionId === queued.questionId)
      if (!existing) {
        answersToFinalize.push({
          questionId: queued.questionId,
          answer: queued.answer,
          questionType: queued.questionType || "mcq",
          typingReplay: queued.typingReplay,
          timeSpentSeconds: queued.timeSpentSeconds,
        })
      }
    }
    
    // setSubmitting(true) is already set above for both violation and normal submissions

    // Upload/photo circuit submissions: run AI vision grading before finalize (students may skip per-question Submit)
    const circuitEvalJobs: Promise<unknown>[] = []
    for (const q of quiz.questions) {
      const qt = (q.question_type || "").toLowerCase()
      if (qt !== "circuit_submission") continue
      const answerJson = circuitJsonForQuestion(q.id, q.id === currentQ?.id)
      circuitEvalJobs.push(
        ensureCircuitSubmissionEvaluated(
          q.id,
          answerJson,
          q.solution_upload_config,
          attemptCount[q.id] ?? 0,
        ),
      )
    }
    
    // Auto-finalize the attempt - this ensures the attempt is finalized even if student doesn't click finalize
    // This is especially important for retakes/multiple attempts

    // Clear all timers before submitting
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (timerStartDelayRef.current) {
      clearTimeout(timerStartDelayRef.current)
      timerStartDelayRef.current = null
    }

    // Show violation submission toast if this is due to violations
    if (isViolationSubmission) {
      toast({
        title: "🚨 Submitting Due to Violations",
        description: "Your assessment is being submitted automatically due to policy violations.",
        variant: "destructive",
        duration: 4000,
      })
    }

    if (circuitEvalJobs.length > 0) {
      await Promise.allSettled(circuitEvalJobs)
    }

    const inFlightEvals = Array.from(circuitEvalPromisesRef.current.values())
    if (inFlightEvals.length > 0) {
      toast({
        title: "Finishing AI grading",
        description: "Saving circuit submission scores before submitting your quiz…",
        duration: 4000,
      })
      await Promise.allSettled(inFlightEvals)
    }

    if (submissionPendingQuestions.size > 0 && attemptId && quiz) {
      const pendingRetries: Promise<SaveAnswerResult>[] = []
      for (const qid of submissionPendingQuestions) {
        const q = quiz.questions.find((item) => item.id === qid)
        if (!q) continue
        const qt = (q.question_type || "").toLowerCase()
        const isCurrent = q.id === currentQ?.id
        let ans: unknown = null
        if (qt === "circuit_submission") {
          ans = circuitJsonForQuestion(q.id, isCurrent)
        } else if (codeTypes.includes(qt)) {
          ans = codeByQuestion[q.id] ?? (isCurrent ? code : null) ?? answers[q.id] ?? null
        } else {
          ans = isCurrent ? selectedAnswer : answers[q.id]
        }
        if (ans == null) continue
        pendingRetries.push(
          saveAnswer(
            q.id,
            ans,
            qt,
            1,
            false,
            undefined,
            antiCheatConfig.keystrokePlaybackEnforced !== false
              ? typingReplayByQuestionRef.current[q.id]
              : undefined,
            capTimeSpent(q.id, questionTimeSpent[q.id] || 0),
          ),
        )
      }
      if (pendingRetries.length > 0) {
        await Promise.allSettled(pendingRetries)
      }
    }

    const sendFinalize = async () => {
      // 30s timeout - finalize only persists data, no evaluation (answers already evaluated per-question)
      const SUBMIT_TIMEOUT_MS = 30000
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS)

      const response = await studentApiFetch("/api/student/finalize-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getStudentAuthHeaders() },
        body: JSON.stringify({ 
          attemptId, 
          quizId,
          answers: answersToFinalize,
          violationReason: isViolationSubmission ? violationReason : null,
          autoSubmitted: isViolationSubmission
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const rawBody = await response.text()
      let data: Record<string, unknown> = {}
      if (rawBody.trim()) {
        try {
          data = JSON.parse(rawBody) as Record<string, unknown>
        } catch {
          throw new Error(
            response.ok
              ? "Server returned an invalid response while finalizing your exam."
              : `Submission failed (HTTP ${response.status}). Please try again or contact your instructor.`,
          )
        }
      }
      if (!response.ok) {
        const error = new Error(
          formatApiErrorMessage(data.error, "Failed to finalize quiz"),
        )
        ;(error as any).errorCode = data.errorCode
        ;(error as any).answeredCount = data.answeredCount
        ;(error as any).totalQuestions = data.totalQuestions
        throw error
      }
      return data
    }

    try {
      let tries = 0
      let data: any = null
      while (tries < 3) {
        try {
          data = await sendFinalize()
          break
        } catch (e) {
          tries++
          if (tries >= 3) throw e
          await new Promise((r) => setTimeout(r, tries * 1000))
        }
      }

      // For finals, redirect to the standard results page instead of report page
      const reportPath =
        effectiveType === "practice"
          ? `/student/practice/report/${attemptId}`
          : effectiveType === "final"
          ? `/student/results/${attemptId}` // Use standard results page for finals
          : `/student/${effectiveType}/report/${attemptId}`

      
      // CRITICAL: Reset submitting state BEFORE navigation to prevent button getting stuck
      setSubmitting(false)
      
      // For violation submissions, use replace to prevent back navigation
      if (isViolationSubmission) {
        // Use replace instead of push to prevent back navigation
        // Navigate immediately - don't wait
        try {
          sessionStorage.removeItem(`quiz_resume_${quizId}_${normalizedType}`)
        } catch (_) {}
        router.replace(reportPath)
        // Also clear any session storage related to this quiz
        sessionStorage.removeItem(`quiz_${quizId}_attempt`)
        sessionStorage.removeItem(`quiz_${quizId}_answers`)
        // Return immediately to prevent any further execution
        return
      } else {
        // Small delay to ensure state updates before navigation
        try {
          sessionStorage.removeItem(`quiz_resume_${quizId}_${normalizedType}`)
        } catch (_) {}
        setTimeout(() => {
          router.replace(reportPath)
        }, 100)
      }
    } catch (error: any) {
      // CRITICAL: When finalize stalls or fails, save current state so student doesn't lose work
      const isStallOrTimeout = error?.name === "AbortError" || error?.message?.includes("abort")
      const isNetworkError = error?.message?.includes("Failed to fetch") || error?.message?.includes("NetworkError") || error?.message?.includes("Load failed")
      const isSubmissionStalled = isStallOrTimeout || isNetworkError

      // Best-effort retry: answers already in payload; submissionStalled retry below includes them

      // For violation submissions, still redirect even on error
      if (isViolationSubmission) {
        // Error during violation submission, but redirecting anyway
        const reportPath =
          effectiveType === "practice"
            ? `/student/practice/report/${attemptId}`
            : effectiveType === "final"
            ? `/student/results/${attemptId}`
            : `/student/${effectiveType}/report/${attemptId}`
        try {
          sessionStorage.removeItem(`quiz_resume_${quizId}_${normalizedType}`)
        } catch (_) {}
        router.replace(reportPath)
        return
      }

      // When submission stalls (timeout/network): flag for instructor and show modal instead of toast
      if (isSubmissionStalled && attemptId && quizId) {
        stalledAnswersRef.current = answersToFinalize
        let finalizeSucceeded = false
        try {
          const res = await studentApiFetch("/api/student/finalize-quiz", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getStudentAuthHeaders() },
            body: JSON.stringify({
              attemptId,
              quizId,
              answers: answersToFinalize,
              submissionStalled: true,
            }),
          })
          finalizeSucceeded = res.ok
        } catch (_) {
          // Finalize API failed - record for instructor so they can follow up
          studentApiFetch("/api/student/record-finalization-issue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attemptId,
              quizId,
              errorType: "submission_stalled",
              errorMessage: "Network timeout during finalization. Student answers may be saved. Please verify attempt in results.",
            }),
          }).catch(() => {})
        }
        setSubmitting(false)
        setShowSubmissionStalledModal(true)
        setSubmissionStalledFinalizeSucceeded(finalizeSucceeded)
        return
      }

      // For NO_ANSWERS or other errors: show custom modal and record for instructor
      let errorMessage = "An error occurred while submitting the quiz. Your answers have been saved. Please try submitting again. If this problem persists, your instructor has been notified and can help."
      let errorTitle = "Submission Issue"
      let errorType = "finalization_failed"

      if (error?.message) {
        if (error.message.includes("NO_ANSWERS_SAVED") || error.message.includes("No answers were saved")) {
          errorTitle = "Submission Failed - No Answers Saved"
          errorMessage = "No answers were found in the database. Please try answering at least one question and submit again. Your instructor has been notified and can verify your attempt."
          errorType = "no_answers_saved"
        } else if (error.message.includes("No answers found")) {
          errorTitle = "No Answers to Submit"
          errorMessage = "Please answer at least one question before submitting. Your progress is being saved automatically."
          errorType = "no_answers"
        } else {
          errorMessage = `${error.message} Your answers have been saved. Please try again or contact your instructor—they have been notified.`
        }
      }

      if (error?.errorCode === "NO_ANSWERS_SAVED") {
        errorTitle = "Submission Failed - No Answers Saved"
        errorMessage = `No answers were saved to the database (${error.answeredCount || 0}/${error.totalQuestions || 0} questions). Please try submitting again. Your instructor has been notified and can help.`
        errorType = "no_answers_saved"
      }

      // Record for instructor so they can follow up
      if (attemptId && quizId) {
        studentApiFetch("/api/student/record-finalization-issue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            quizId,
            errorType,
            errorMessage: error?.message || errorTitle,
          }),
        }).catch(() => {})
      }

      setFinalizationErrorModal({ title: errorTitle, message: errorMessage, errorType })
      setSubmitting(false)
    }
  }

  const toggleMultiAnswer = async (option: string) => {
    if (showFeedback || isSubmittingAnswer) return

    const newAnswers = selectedMultiAnswers.includes(option)
      ? selectedMultiAnswers.filter((a) => a !== option)
      : [...selectedMultiAnswers, option]
    
    setSelectedMultiAnswers(newAnswers)
    
    // CRITICAL: Update answers state immediately
    const currentQuestionId = quiz?.questions[currentQuestionIndex]?.id
    if (currentQuestionId) {
      setAnswers(prev => ({ ...prev, [currentQuestionId]: JSON.stringify(newAnswers) }))
    }
    
    // Auto-save immediately to database (lightweight, no evaluation)
    if (!attemptId || !quiz) return
    
    const currentQuestion = quiz.questions[currentQuestionIndex]
    if (!currentQuestion) return
    
    const questionType = currentQuestion.question_type?.toLowerCase() || "select_all"
    
    // Auto-save for multi-select questions (always save, even if empty array)
    if (questionType === "select_all" || questionType === "multi_output") {
      const raw = Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[currentQuestion.id] || 0)
      autoSaveAnswer(currentQuestion.id, JSON.stringify(newAnswers), questionType, undefined, capTimeSpent(currentQuestion.id, raw))
    }
  }

  // Auto-save on question navigation
  useEffect(() => {
    if (!quiz || !attemptId || currentQuestionIndex === 0) return

    const prevIndex = currentQuestionIndex - 1
    if (prevIndex < 0) return

    const prevQuestion = quiz.questions[prevIndex]
    if (!prevQuestion) return

    const prevAnswer = answers[prevQuestion.id]
    if (prevAnswer !== undefined && prevAnswer !== null && prevAnswer !== "") {
      const questionType = prevQuestion.question_type?.toLowerCase() || "mcq"
      const raw = questionTimeSpent[prevQuestion.id] ?? 0
      autoSaveAnswer(prevQuestion.id, prevAnswer, questionType, undefined, capTimeSpent(prevQuestion.id, raw))
    }
  }, [currentQuestionIndex, quiz, attemptId, answers, questionTimeSpent, capTimeSpent, autoSaveAnswer])

  // Debounced auto-save for code questions - saves to DB so report page can display answers
  // CRITICAL: Include ALL code question types (code_explain, code_debug) so answers persist before submission
  useEffect(() => {
    if (!attemptId || !quiz) return

    const currentQuestion = quiz.questions[currentQuestionIndex]
    if (!currentQuestion) return

    const questionType = currentQuestion.question_type?.toLowerCase() || ""
    const isCodeQuestion = currentQuestion.requires_code ||
      ["code_write", "code_write_plot", "code_problem", "debug_code", "code_explain", "code_debug"].includes(questionType)

    if (!isCodeQuestion || !code || code.trim() === HELLO_WORLD.trim()) return

    const timeout = setTimeout(() => {
      // Use most reliable source: codeByQuestion may have latest if React state lags
      const codeToSave = codeByQuestion[currentQuestion.id] ?? code
      if (codeToSave && codeToSave.trim() !== HELLO_WORLD.trim()) {
        const replay = antiCheatConfig.keystrokePlaybackEnforced !== false ? typingReplayByQuestionRef.current[currentQuestion.id] : undefined
        const raw = Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[currentQuestion.id] || 0)
        autoSaveAnswer(currentQuestion.id, codeToSave, questionType, replay, capTimeSpent(currentQuestion.id, raw))
      }
    }, 1000) // 1 second debounce

    return () => clearTimeout(timeout)
  }, [code, codeByQuestion, currentQuestionIndex, quiz, attemptId, antiCheatConfig.keystrokePlaybackEnforced, questionTimeSpent, capTimeSpent, autoSaveAnswer])

  // Debounced auto-save for text input questions (fill_blank, code_output, trace_output, fill_code, trace_logic, scenario_match)
  // Ensures ALL question types are saved to DB for manual evaluation on results report
  useEffect(() => {
    if (!attemptId || !quiz) return

    const currentQuestion = quiz.questions[currentQuestionIndex]
    if (!currentQuestion) return

    const questionType = currentQuestion.question_type?.toLowerCase() || ""
    const textInputTypes = ["fill_blank", "code_output", "trace_output", "fill_code", "trace_logic", "scenario_match",
      "multi_part",
      "circuit_numeric", "circuit_worked_solution", "circuit_diagram_analysis", "circuit_multi_part", "circuit_fill_equation",
      "circuit_transfer_function", "circuit_phasor_power", "circuit_transient_response", "circuit_upload_work",
      "circuit_submission",
    ]
    if (!textInputTypes.includes(questionType)) return

    const value = selectedAnswer ?? ""
    const timeout = setTimeout(() => {
      if (value !== undefined && value !== null) {
        setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }))
        const raw = Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[currentQuestion.id] || 0)
        autoSaveAnswer(currentQuestion.id, value, questionType, undefined, capTimeSpent(currentQuestion.id, raw))
      }
    }, 1000) // 1 second debounce

    return () => clearTimeout(timeout)
  }, [selectedAnswer, currentQuestionIndex, quiz, attemptId, questionTimeSpent, capTimeSpent, autoSaveAnswer])

  // Restore answers from database when quiz and attemptId are available
  useEffect(() => {
    if (!quiz || !attemptId || !quiz.questions || quiz.questions.length === 0) return

    const restoreAnswers = async () => {
      try {
        const savedAnswersRes = await studentApiFetch(`/api/student/attempt/${attemptId}/answers`, {
          headers: getStudentAuthHeaders(),
        })
        if (savedAnswersRes.ok) {
          const savedAnswers = await savedAnswersRes.json()
          
          if (Array.isArray(savedAnswers) && savedAnswers.length > 0) {
            const restoredAnswers: Record<number, string> = {}
            const restoredCodeByQuestion: Record<number, string> = {}
            
            savedAnswers.forEach((a: any) => {
              restoredAnswers[a.questionId] = a.answer

              const parsedEval = parseStoredAiFeedback(a.aiFeedback)
              if (parsedEval) {
                evalByQuestionRef.current[a.questionId] = parsedEval
                setAiGradedQuestionsSubmitted((prev) => new Set(prev).add(a.questionId))
                setQuestionsWithStoredEval((prev) => new Set(prev).add(a.questionId))
              }

              const question = quiz.questions.find(q => q.id === a.questionId)
              if (question && isObjectiveAutoGradedType(question.question_type?.toLowerCase() || "")) {
                rememberObjectiveGrade(
                  a.questionId,
                  {
                    isCorrect: a.isCorrect,
                    pointsEarned: a.pointsEarned,
                    score:
                      typeof a.pointsEarned === "number" && question.points
                        ? (a.pointsEarned / question.points) * 100
                        : undefined,
                    feedback:
                      typeof parsedEval?.feedback === "string"
                        ? parsedEval.feedback
                        : undefined,
                    maxPoints: question.max_points || question.points,
                    correctLetters: Array.isArray(a.correctLetters)
                      ? a.correctLetters
                      : Array.isArray(a.aiFeedback?.correctLetters)
                        ? a.aiFeedback.correctLetters
                        : undefined,
                  },
                  question.max_points || question.points,
                )
              }
              if (
                question?.question_type?.toLowerCase() === "circuit_submission" &&
                (circuitSubmissionAnswerIsFinalized(a.answer) || parsedEval)
              ) {
                setLockedQuestions((prev) => new Set(prev).add(a.questionId))
                setSubmittedQuestions((prev) => new Set(prev).add(a.questionId))
              }
              
              // Check if this is a code question answer
              if (question?.requires_code) {
                restoredCodeByQuestion[a.questionId] = a.answer
              }
            })
            
            setAnswers(restoredAnswers)
            setCodeByQuestion(prev => ({ ...prev, ...restoredCodeByQuestion }))
            
            // Restore selected answer for current question if available
            const currentQ = quiz.questions[currentQuestionIndex]
            if (currentQ && restoredAnswers[currentQ.id]) {
              const questionType = currentQ.question_type?.toLowerCase() || "mcq"
              
              if (questionType === "select_all" || questionType === "multi_output") {
                try {
                  const multiAnswer = JSON.parse(restoredAnswers[currentQ.id])
                  if (Array.isArray(multiAnswer)) {
                    setSelectedMultiAnswers(multiAnswer)
                  }
                } catch (e) {
                  // Not JSON, ignore
                }
              } else if (!["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes((currentQ.question_type || "").toLowerCase())) {
                setSelectedAnswer(restoredAnswers[currentQ.id])
              } else {
                // Code question - restore code (never restore into selectedAnswer)
                const questionType = currentQ.question_type?.toLowerCase()
                const defaultTemplate = questionType === "code_write" ? getCodeTemplate() : HELLO_WORLD
                setCode(restoredAnswers[currentQ.id] || defaultTemplate)
              }
              applyEvalFeedbackForQuestion(currentQ.id)
              applyObjectiveGradeForQuestion(
                currentQ.id,
                currentQ.question_type,
                currentQ.max_points || currentQ.points,
              )
            }
          }
        }
      } catch (error) {
        // Continue without restoration - answers will be empty
      }
    }

    restoreAnswers()
  }, [quiz, attemptId, currentQuestionIndex, applyEvalFeedbackForQuestion, applyObjectiveGradeForQuestion, rememberObjectiveGrade])

  /** Auto-surface Quiz Master feedback when returning to a question that already has evaluation. */
  useEffect(() => {
    if (!quiz?.questions?.length) return
    const q = quiz.questions[currentQuestionIndex]
    if (!q) return
    if (questionsWithStoredEval.has(q.id)) {
      applyEvalFeedbackForQuestion(q.id)
    }
    if (questionsWithObjectiveGrade.has(q.id)) {
      applyObjectiveGradeForQuestion(q.id, q.question_type, q.max_points || q.points)
    }
  }, [
    quiz,
    currentQuestionIndex,
    questionsWithStoredEval,
    questionsWithObjectiveGrade,
    applyEvalFeedbackForQuestion,
    applyObjectiveGradeForQuestion,
  ])

  /** Backfill objective grade when a locked/submitted question has saved scoring but no in-memory grade. */
  useEffect(() => {
    if (!attemptId || !quiz?.questions?.length) return
    const q = quiz.questions[currentQuestionIndex]
    if (!q) return
    const qt = (q.question_type || "").toLowerCase()
    if (!isObjectiveAutoGradedType(qt)) return
    if (questionsWithObjectiveGrade.has(q.id)) return
    const isLockedOrSubmitted =
      submittedQuestions.has(q.id) ||
      lockedQuestions.has(q.id) ||
      timerExpiredForQuestion.has(q.id)
    if (!isLockedOrSubmitted) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await studentApiFetch(`/api/student/attempt/${attemptId}/answers`, {
          headers: getStudentAuthHeaders(),
        })
        if (!res.ok || cancelled) return
        const rows = await res.json()
        if (!Array.isArray(rows)) return
        const row = rows.find((a: { questionId?: number }) => a.questionId === q.id)
        if (!row || cancelled) return
        rememberObjectiveGrade(
          q.id,
          {
            isCorrect: row.isCorrect,
            pointsEarned: row.pointsEarned,
            maxPoints: q.max_points || q.points,
            correctLetters: Array.isArray(row.correctLetters)
              ? row.correctLetters
              : Array.isArray(row.aiFeedback?.correctLetters)
                ? row.aiFeedback.correctLetters
                : undefined,
          },
          q.max_points || q.points,
        )
        if (!cancelled) {
          applyObjectiveGradeForQuestion(q.id, q.question_type, q.max_points || q.points)
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    attemptId,
    currentQuestionIndex,
    quiz,
    submittedQuestions,
    lockedQuestions,
    timerExpiredForQuestion,
    questionsWithObjectiveGrade,
    rememberObjectiveGrade,
    applyObjectiveGradeForQuestion,
  ])

  /** Backfill select_all correctLetters after restore when highlights would otherwise show red. */
  useEffect(() => {
    if (!attemptId || !quiz?.questions?.length) return
    const q = quiz.questions[currentQuestionIndex]
    if (!q) return
    const qt = (q.question_type || "").toLowerCase()
    if (qt !== "select_all" && qt !== "multi_output") return
    const grade = objectiveGradeByQuestionRef.current[q.id]
    if (!grade || (grade.correctLetters?.length ?? 0) > 0) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await studentApiFetch(`/api/student/attempt/${attemptId}/answers`, {
          headers: getStudentAuthHeaders(),
        })
        if (!res.ok || cancelled) return
        const rows = await res.json()
        if (!Array.isArray(rows)) return
        const row = rows.find((a: { questionId?: number }) => a.questionId === q.id)
        const letters = Array.isArray(row?.correctLetters)
          ? row.correctLetters
          : Array.isArray(row?.aiFeedback?.correctLetters)
            ? row.aiFeedback.correctLetters
            : null
        if (!letters?.length || cancelled) return
        rememberObjectiveGrade(q.id, {
          isCorrect: grade.isCorrect,
          pointsEarned: grade.pointsEarned,
          score: grade.score,
          feedback: grade.feedback,
          maxPoints: grade.maxPoints,
          correctLetters: letters.map(String),
        })
      } catch {
        /* non-fatal */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [attemptId, currentQuestionIndex, quiz, rememberObjectiveGrade, questionsWithObjectiveGrade])

  /** Sync visible answer state when navigating between questions (prevents carry-over). */
  useEffect(() => {
    if (!quiz?.questions?.length) return
    const q = quiz.questions[currentQuestionIndex]
    if (!q) return

    // Drop stale submit/eval UI from the previous question; background evals persist via rememberEvalFeedback.
    setIsSubmittingAnswer(false)
    setIsCorrect(false)
    setPartialCreditPoints(null)
    if (!pendingEvaluations.has(q.id)) {
      applyEvalFeedbackForQuestion(q.id)
    } else {
      setShowFeedback(false)
      setAiFeedback(null)
    }
    applyObjectiveGradeForQuestion(q.id, q.question_type, q.max_points || q.points)
    setAiGradingStatus("idle")

    const questionType = (q.question_type || "").toLowerCase()
    const saved = answersRef.current[q.id]
    const codeTypes = [
      "code_write",
      "code_problem",
      "debug_code",
      "code_explain",
      "code_write_plot",
      "code_debug",
    ]

    if (questionType === "select_all" || questionType === "multi_output") {
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setSelectedMultiAnswers(Array.isArray(parsed) ? parsed : [])
        } catch {
          setSelectedMultiAnswers([])
        }
      } else {
        setSelectedMultiAnswers([])
      }
      setSelectedAnswer("")
      return
    }

    if (q.requires_code || codeTypes.includes(questionType)) {
      setSelectedAnswer("")
      setSelectedMultiAnswers([])
      return
    }

    if (questionType === "multi_part") {
      const subs = getGradableSubquestions(q.subquestions)
      setSelectedAnswer(saved ?? JSON.stringify(emptyMultiPartAnswer(subs)))
      setSelectedMultiAnswers([])
      return
    }

    if (questionType === "circuit_submission") {
      setSelectedAnswer(
        saved ??
          JSON.stringify({
            version: 1,
            submission_status: "not_started",
            solution_uploads: {},
          }),
      )
      setSelectedMultiAnswers([])
      return
    }

    setSelectedAnswer(saved ?? "")
    setSelectedMultiAnswers([])
  }, [quiz, currentQuestionIndex, pendingEvaluations, applyEvalFeedbackForQuestion, applyObjectiveGradeForQuestion])

  /** Same behavior as before: save progress and navigate away. Extracted so we can show a 24h notice first. */
  const executeContinueLaterSaveAndLeave = async () => {
    if (!attemptId || !quiz) return
    setSubmitting(true)
    try {
      const codeTypes = ["code_write", "code_problem", "debug_code", "code_write_plot", "code_explain", "code_debug"]
      const savePromises: Promise<void>[] = []
      const currentQ = quiz.questions[currentQuestionIndex]
      for (const q of quiz.questions) {
        const qt = (q.question_type || "").toLowerCase()
        const raw = q.id === currentQ?.id
          ? Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[q.id] || 0)
          : (questionTimeSpent[q.id] || 0)
        const timeSec = capTimeSpent(q.id, raw)
        if (codeTypes.includes(qt)) {
          const codeVal = codeByQuestion[q.id] ?? (q.id === currentQ?.id ? code : null)
          if (codeVal != null) {
            const toSave = qt === "code_write_plot" && plotByQuestion[q.id]
              ? JSON.stringify({ code: codeVal, plotImage: plotByQuestion[q.id] })
              : codeVal
            const replay = antiCheatConfig.keystrokePlaybackEnforced !== false ? typingReplayByQuestionRef.current[q.id] : undefined
            savePromises.push(autoSaveAnswer(q.id, toSave, qt, replay, timeSec).catch(() => {}))
          }
        } else if (qt === "circuit_submission") {
          const isCurrent = q.id === currentQ?.id
          const circuitJson = getCircuitAnswerForQuestion(q.id, isCurrent)
          if (circuitJson) {
            savePromises.push(
              autoSaveAnswer(
                q.id,
                compactCircuitSubmissionForAutoSave(circuitJson),
                qt,
                undefined,
                timeSec,
              ).catch(() => {}),
            )
          }
        } else {
          let answer: string | null = q.id === currentQ?.id
            ? (qt === "select_all" || qt === "multi_output"
              ? (selectedMultiAnswers.length ? JSON.stringify(selectedMultiAnswers) : null)
              : (selectedAnswer != null ? String(selectedAnswer) : null))
            : answers[q.id] ?? null
          if (answer != null) {
            savePromises.push(autoSaveAnswer(q.id, answer, qt, undefined, timeSec).catch(() => {}))
          }
        }
      }
      if (savePromises.length > 0) await Promise.allSettled(savePromises)
      const timerPayload = await flushQuizProgressNow()
      const perQuestionRemaining =
        currentQ && questionUsesPerQuestionTimer(currentQ.question_type, currentQuestionIndex)
          ? (globalQuestionTimersRef.current[currentQ.id] ??
            questionTimeRemainingRef.current[currentQ.id] ??
            (timeLeft > 0 ? timeLeft : currentQ.time_limit || quiz.time_per_question || 60))
          : null
      const res = await studentApiFetch("/api/student/save-and-finish-later", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          currentQuestionIndex,
          remainingTimeSeconds: perQuestionRemaining,
          questionTimeRemaining: timerPayload?.questionTimeRemaining,
          sectionTimeRemaining: timerPayload?.sectionTimeRemaining,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 && data.upgradeRequired) {
          setShowSaveLaterUpgradeModal(true)
        } else {
          toast({ title: "Error", description: formatApiErrorMessage(data.error, "Failed to save"), variant: "destructive" })
        }
        setSubmitting(false)
        return
      }
      toast({
        title: "Progress Saved",
        description: getContinueLaterSavedToastDescription(quiz?.available_until),
        variant: "default",
      })
      const exitPath = effectiveType === "practice" ? getPracticePath() :
        effectiveType === "mid_semester" ? getMidSemesterExamsPath() :
        effectiveType === "final" ? getFinalExamsPath() :
        effectiveType === "homework" ? getHomeworkPath() :
        getDashboardPath()
      router.push(exitPath)
    } catch (e) {
      toast({ title: "Error", description: "Failed to save progress", variant: "destructive" })
      setSubmitting(false)
    }
  }

  const handleExitQuiz = async () => {
    // CRITICAL: Close the dialog immediately to prevent multiple clicks
    setShowExitDialog(false)
    
    if (!attemptId || !quiz) {
      toast({
        title: "Error",
        description: "No quiz attempt found. Redirecting...",
        variant: "destructive",
      })
      const exitPath = effectiveType === "practice" ? getPracticePath() : 
                      effectiveType === "mid_semester" ? getMidSemesterExamsPath() :
                      effectiveType === "final" ? getFinalExamsPath() :
                      effectiveType === "homework" ? getHomeworkPath() :
                      getDashboardPath()
      router.push(exitPath)
      return
    }

    // Prevent multiple submissions
    if (submitting) {
      return
    }
    setSubmitting(true)

    // Clear all timers before exiting
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (timerStartDelayRef.current) {
      clearTimeout(timerStartDelayRef.current)
      timerStartDelayRef.current = null
    }

    const codeTypes = ["code_write", "code_problem", "debug_code", "code_write_plot", "code_explain", "code_debug"]
    let exitAnswers: Array<{ questionId: number; answer: any; questionType: string; plotImage?: string; typingReplay?: any; timeSpentSeconds?: number }> = []

    try {
      // Build answers payload for consolidated finalize (single request, no internal HTTP fetches)
      if (quiz) {
        const currentQ = quiz.questions[currentQuestionIndex]
        for (const q of quiz.questions) {
        const qt = (q.question_type || "").toLowerCase()
        const raw = q.id === currentQ?.id
          ? Math.floor((Date.now() - (questionStartTimeRef.current || Date.now())) / 1000) + (questionTimeSpent[q.id] || 0)
          : (questionTimeSpent[q.id] || 0)
        const timeSec = capTimeSpent(q.id, raw)
        if (codeTypes.includes(qt)) {
          const codeVal = (q.id === currentQ?.id ? (codeEditorRef.current?.getValue?.() ?? codeSyncRef.current) : null)
            ?? codeByQuestion[q.id]
            ?? (q.id === currentQ?.id ? code : null)
            ?? answers[q.id]
            ?? null
          if (codeVal != null) {
            const toSave = qt === "code_write_plot" && plotByQuestion[q.id]
              ? JSON.stringify({ code: codeVal, plotImage: plotByQuestion[q.id] })
              : codeVal
            const replay = antiCheatConfig.keystrokePlaybackEnforced !== false ? typingReplayByQuestionRef.current[q.id] : undefined
            exitAnswers.push({ questionId: q.id, answer: toSave, questionType: qt, plotImage: qt === "code_write_plot" ? plotByQuestion[q.id] : undefined, typingReplay: replay, timeSpentSeconds: timeSec })
          }
        } else {
          let answer: string | null = null
          if (q.id === currentQ?.id) {
            if (qt === "select_all" || qt === "multi_output") {
              const multi = selectedMultiAnswers.length ? selectedMultiAnswers : []
              if (multi.length > 0) answer = JSON.stringify(multi)
            } else {
              const sel = selectedAnswer
              if (sel !== undefined && sel !== null) answer = String(sel)
            }
          }
          if (answer == null) answer = answers[q.id] ?? null
          if (answer != null) exitAnswers.push({ questionId: q.id, answer: typeof answer === "string" ? answer : String(answer), questionType: qt, timeSpentSeconds: timeSec })
        }
        }
        for (const queued of answerQueue) {
          if (!exitAnswers.find((a) => a.questionId === queued.questionId)) {
            exitAnswers.push({ questionId: queued.questionId, answer: queued.answer, questionType: queued.questionType || "mcq", typingReplay: queued.typingReplay, timeSpentSeconds: queued.timeSpentSeconds })
          }
        }
      }

      const response = await studentApiFetch("/api/student/finalize-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getStudentAuthHeaders() },
        body: JSON.stringify({
          attemptId,
          quizId,
          answers: exitAnswers,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to finalize quiz")
      }

      toast({
        title: "Quiz Submitted",
        description: "Your progress has been saved. Redirecting to results...",
      })

      // CRITICAL: Use replace instead of push to prevent back navigation
      try {
        sessionStorage.removeItem(`quiz_resume_${quizId}_${normalizedType}`)
      } catch (_) {}
      router.replace(`/student/results/${attemptId}`)
    } catch (error) {
      // Best-effort retry with same payload
      try {
        await studentApiFetch("/api/student/finalize-quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getStudentAuthHeaders() },
          body: JSON.stringify({ attemptId, quizId, answers: exitAnswers }),
        })
      } catch (_) {
        /* ignore */
      }

      toast({
        title: "Error",
        description: "Failed to submit quiz. Your answers are saved. Redirecting...",
        variant: "destructive",
      })
      router.replace(`/student/results/${attemptId}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    if (!attemptId) {
      sessionStorage.clear()
      router.push("/student/login")
      return
    }

    // if (answerQueue.length > 0) {
    //   await batchSaveAnswers()
    // }

    try {
      await studentApiFetch("/api/student/finalize-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getStudentAuthHeaders() },
        body: JSON.stringify({
          attemptId,
          quizId,
        }),
      })

      toast({
        title: "Quiz terminated",
        description: "Your current progress has been recorded. You can view your results after logging back in.",
      })

      sessionStorage.clear()
      router.push("/student/login")
    } catch (error) {
      sessionStorage.clear()
      router.push("/student/login")
    }
  }

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined && quiz) {
      const currentQuestion = quiz.questions[currentQuestionIndex]
      const isCodeQuestion = currentQuestion.requires_code || 
        ["code_write", "code_problem", "debug_code", "code_debug", "code_explain", "code_write_plot"].includes(
          currentQuestion.question_type?.toLowerCase() || ""
        )
      
      if (isCodeQuestion) {
        codeSyncRef.current = value // Sync immediately for timer expiry (avoids Q1 data loss)
        setCode(value)
        setCodeByQuestion((prev) => ({
          ...prev,
          [currentQuestion.id]: value,
        }))
        persistCodeValue(currentQuestion.id, value)
      }
    }
  }

  // Handlers for plot upload (code_write_plot questions)
  const handlePlotUpload = (file: File, base64: string) => {
    
    if (quiz) {
      const currentQuestion = quiz.questions[currentQuestionIndex]
      
      setUploadedPlot(base64)
      setPlotByQuestion((prev) => {
        const updated = {
          ...prev,
          [currentQuestion.id]: base64,
        }
        return updated
      })
      
    }
  }

  const handlePlotRemove = () => {
    if (quiz) {
      const currentQuestion = quiz.questions[currentQuestionIndex]
      setUploadedPlot(null)
      setPlotByQuestion((prev) => {
        const updated = { ...prev }
        delete updated[currentQuestion.id]
        return updated
      })
      
    }
  }

  // Restore plot and code when navigating between questions
  useEffect(() => {
    if (quiz && quiz.questions[currentQuestionIndex]) {
      const currentQuestion = quiz.questions[currentQuestionIndex]
      const questionType = currentQuestion.question_type?.toLowerCase()
      
      // Restore plot for code_write_plot questions only when changing questions
      // Use setTimeout to ensure plotByQuestion state has updated
      if (questionType === "code_write_plot") {
        setTimeout(() => {
          const savedPlot = plotByQuestion[currentQuestion.id]
          if (savedPlot !== undefined) {
            setUploadedPlot(savedPlot || null)
          }
        }, 0)
      } else {
        setUploadedPlot(null)
      }
      
      // CRITICAL FIX: Restore code properly - check for ALL code question types
      const isCodeQuestion = currentQuestion.requires_code || 
        ["code_write", "code_problem", "debug_code", "code_debug", "code_explain", "code_write_plot"].includes(
          questionType?.toLowerCase() || ""
        )
      
      if (isCodeQuestion) {
        let restoredCode = codeByQuestion[currentQuestion.id]
        if (!restoredCode && typeof window !== "undefined") {
          try {
            const stored = localStorage.getItem(getCodeStorageKey(currentQuestion.id))
            if (stored) {
              restoredCode = stored
              setCodeByQuestion((prev) => ({ ...prev, [currentQuestion.id]: stored }))
            }
          } catch (error) {
            // Failed to load from storage
          }
        }

        if (restoredCode !== undefined && restoredCode !== null) {
          const expectedTemplate = questionType === "code_write" ? getCodeTemplate() : HELLO_WORLD
          if (questionType === "code_write" && isTemplateCode(restoredCode, questionType)) {
            codeSyncRef.current = expectedTemplate
            setCode(expectedTemplate)
            setCodeByQuestion((prev) => ({ ...prev, [currentQuestion.id]: expectedTemplate }))
            persistCodeValue(currentQuestion.id, expectedTemplate)
          } else if (
            questionType === "code_write" &&
            !membershipGetsCodeWriteBoilerplate() &&
            restoredCode.trim() === TRAILBLAZER_TEMPLATE.trim()
          ) {
            codeSyncRef.current = ""
            setCode("")
            setCodeByQuestion((prev) => ({ ...prev, [currentQuestion.id]: "" }))
            persistCodeValue(currentQuestion.id, "")
          } else if (restoredCode.trim() === expectedTemplate.trim()) {
            codeSyncRef.current = restoredCode
            setCode(restoredCode)
          } else {
            codeSyncRef.current = restoredCode
            setCode(restoredCode)
          }
        } else {
          if (questionType === "code_write_plot") {
            const matlabTemplate = `% MATLAB Script\n% Start your code here\n\ndisp('Hello, MATLAB!');\n`
            codeSyncRef.current = matlabTemplate
            setCode(matlabTemplate)
            setCodeByQuestion((prev) => ({ ...prev, [currentQuestion.id]: matlabTemplate }))
            persistCodeValue(currentQuestion.id, matlabTemplate)
          } else if (questionType === "code_write") {
            const template = getCodeTemplate()
            codeSyncRef.current = template
            setCode(template)
            setCodeByQuestion((prev) => ({ ...prev, [currentQuestion.id]: template }))
            persistCodeValue(currentQuestion.id, template)
          } else {
            // For other code question types, use Trailblazer template (backward compatibility)
            codeSyncRef.current = HELLO_WORLD
            setCode(HELLO_WORLD)
            setCodeByQuestion((prev) => ({ ...prev, [currentQuestion.id]: HELLO_WORLD }))
            persistCodeValue(currentQuestion.id, HELLO_WORLD)
          }
        }
      }
    }
  }, [currentQuestionIndex, quiz, plotByQuestion, codeByQuestion])

  const handleRunCode = async () => {
    setIsCompiling(true)
    setCompilerOutput("Compiling and running...")

    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        if (data.stderr || data.compile_output) {
          setCompilerOutput(`Error:\n${data.compile_output || data.stderr}`)
        } else {
          setCompilerOutput(data.stdout || "Program executed successfully with no output.")
        }
      } else {
        setCompilerOutput(`Error: ${data.error || "Failed to compile/run code"}`)
      }
    } catch (error) {
      setCompilerOutput(`Error: ${error instanceof Error ? error.message : "Failed to run code"}`)
    } finally {
      setIsCompiling(false)
    }
  }

  // CRITICAL: Calculate these BEFORE ANY early returns to ensure hooks are always called in same order
  // Hooks must be called unconditionally at the top level - moving them before all early returns
  // Calculate total points for all questions to show percentage weights
  const totalQuizPoints = useMemo(() => {
    if (!quiz?.questions || quiz.questions.length === 0) return 0
    return quiz.questions.reduce((sum, q) => {
      return sum + (q.max_points || q.points || 1)
    }, 0)
  }, [quiz?.questions])
  
  // Calculate current question's weight as percentage
  const currentQuestion = quiz?.questions?.[currentQuestionIndex] || null
  
  useEffect(() => {
    if (quiz) {
      if (!quiz.questions || quiz.questions.length === 0) {
        // Quiz exists but has no questions
      }
      
      if (currentQuestionIndex >= (quiz.questions?.length || 0)) {
        // currentQuestionIndex out of bounds
      }
    }
  }, [quiz, currentQuestionIndex, currentQuestion])
  const questionWeight = useMemo(() => {
    if (!currentQuestion || totalQuizPoints === 0) return 0
    const questionPoints = currentQuestion.max_points || currentQuestion.points || 1
    return (questionPoints / totalQuizPoints) * 100
  }, [currentQuestion, totalQuizPoints])

  // CRITICAL: If locked due to violations, show warning screen with danger colors
  if (isLockedDueToViolations && attemptId) {
    const violationMessage = violationReason?.toLowerCase().includes('tab') 
      ? "Excessive tab switching detected"
      : violationReason?.toLowerCase().includes('ai') || violationReason?.toLowerCase().includes('gemini')
      ? "AI tool usage detected"
      : "Maximum violations reached"
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 dark:from-red-900/40 dark:via-orange-900/40 dark:to-amber-900/40">
        <Card className="p-10 max-w-lg border-2 border-red-400 dark:border-red-600 shadow-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm">
          <CardContent className="text-center space-y-6">
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.1, 1, 1.1, 1]
              }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="flex justify-center mb-4"
            >
              <TriangleAlert className="h-20 w-20 text-red-600 dark:text-red-400" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                <h2 className="text-3xl font-bold text-red-700 dark:text-red-300">
                  Assessment Auto-Submitted
                </h2>
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-lg text-red-800 dark:text-red-200 font-semibold mb-2">
                {violationMessage}
              </p>
              <p className="text-base text-slate-700 dark:text-slate-300">
                Your assessment has been automatically submitted due to policy violations. All answers have been saved.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-2 text-sm text-red-700 dark:text-red-300"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Redirecting to your results...</span>
            </motion.div>
            <div className="pt-4 border-t border-red-200 dark:border-red-700">
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                Your instructor has been notified of this auto-submission.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showInstructions) {
    return (
      <>
        {showResumeDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="max-w-md w-full border-2 border-blue-200 dark:border-blue-700 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-xl text-center">You have an unfinished attempt</CardTitle>
                <p className="text-center text-slate-600 dark:text-slate-400 mt-2">
                  Would you like to continue where you left off or start over?
                </p>
                {!resumeCanRestart && resumeRestartBlockedReason ? (
                  <p className="text-center text-sm text-amber-700 dark:text-amber-300 mt-3 px-2">
                    {resumeRestartBlockedReason}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={async () => {
                    setShowResumeDialog(false)
                    setShowInstructions(false)
                    setLoading(true)
                    setQuizStarted(true)
                    resetSessionId()
                    if (enableSuperpowers && resumeAttemptSuperpowers.length > 0) {
                      selectedSuperpowersForAttemptRef.current = [...resumeAttemptSuperpowers]
                      try {
                        sessionStorage.setItem(
                          `quizSuperpowers:${quizId}`,
                          JSON.stringify(resumeAttemptSuperpowers),
                        )
                      } catch {
                        /* ignore */
                      }
                    }
                    queueEvent("quiz", "lifecycle", "QUIZ_RESUME", { quizId, assessmentType: effectiveType }, "info")
                    setTimeout(() => fetchQuiz(), 100)
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Continue Quiz
                </Button>
                <Button
                  variant="outline"
                  disabled={!resumeCanRestart}
                  title={!resumeCanRestart ? resumeRestartBlockedReason ?? undefined : undefined}
                  onClick={async () => {
                    if (!resumeCanRestart) return
                    setShowResumeDialog(false)
                    const studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
                    if (!studentDatabaseId) {
                      toast({ title: "Error", description: "Session expired. Please log in again.", variant: "destructive" })
                      return
                    }
                    try {
                      let restartSuperpowers =
                        enableSuperpowers ? [...selectedSuperpowersForAttemptRef.current] : []
                      if (enableSuperpowers && restartSuperpowers.length === 0) {
                        try {
                          const raw = sessionStorage.getItem(`quizSuperpowers:${quizId}`)
                          if (raw != null) {
                            const parsed = JSON.parse(raw) as unknown
                            if (Array.isArray(parsed)) restartSuperpowers = [...parsed]
                          }
                        } catch {
                          /* ignore */
                        }
                      }
                      if (enableSuperpowers) {
                        selectedSuperpowersForAttemptRef.current = [...restartSuperpowers]
                      }
                      const res = await studentApiFetch("/api/student/start-quiz", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          studentId: studentDatabaseId,
                          quizId,
                          forceRestart: true,
                          ...(enableSuperpowers ? { superpowers: restartSuperpowers } : {}),
                        }),
                      })
                      const data = await res.json()
                      if (!res.ok) {
                        toast({ title: "Error", description: formatApiErrorMessage(data.error, "Failed to restart"), variant: "destructive" })
                        setShowResumeDialog(true)
                        return
                      }
                      setShowInstructions(false)
                      setLoading(true)
                      setQuizStarted(true)
                      resetSessionId()
                      queueEvent("quiz", "lifecycle", "QUIZ_RESTART", { quizId, assessmentType: effectiveType }, "info")
                      setTimeout(() => fetchQuiz(), 100)
                    } catch (e) {
                      toast({ title: "Error", description: "Failed to restart quiz", variant: "destructive" })
                      setShowResumeDialog(true)
                    }
                  }}
                >
                  Restart Quiz
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
        <QuizInstructions
          quizId={quizId}
          antiCheatConfig={antiCheatConfig}
          geoRequired={geoRequired}
          isResuming={showResumeDialog}
          enableSuperpowers={enableSuperpowers}
          allowedSuperpowers={allowedSuperpowers}
          assessmentType={effectiveType}
          configLoaded={configLoaded}
          membershipTier={membershipTier as MembershipTier}
          studentPickSections={studentPickSections}
          sectionPoolSizes={sectionPoolSizes}
          onStart={(verifiedLocation, selectedSuperpowers) => {
            resetSessionId()
            queueEvent("quiz", "lifecycle", "QUIZ_START", {
              quizId,
              assessmentType: effectiveType
            }, "info")
            setShowInstructions(false)
            setLoading(true)
            setQuizStarted(true)
            setTimeout(() => {
              fetchQuiz(verifiedLocation, selectedSuperpowers)
            }, 100)
          }}
        />
      </>
    )
  }

  // CRITICAL: If locked due to violations during loading, still show warning screen with danger colors
  if (isLockedDueToViolations && attemptId) {
    const violationMessage = violationReason?.toLowerCase().includes('tab') 
      ? "Excessive tab switching detected"
      : violationReason?.toLowerCase().includes('ai') || violationReason?.toLowerCase().includes('gemini')
      ? "AI tool usage detected"
      : "Maximum violations reached"
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 dark:from-red-900/40 dark:via-orange-900/40 dark:to-amber-900/40">
        <Card className="p-10 max-w-lg border-2 border-red-400 dark:border-red-600 shadow-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm">
          <CardContent className="text-center space-y-6">
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.1, 1, 1.1, 1]
              }}
              transition={{ 
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="flex justify-center mb-4"
            >
              <TriangleAlert className="h-20 w-20 text-red-600 dark:text-red-400" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                <h2 className="text-3xl font-bold text-red-700 dark:text-red-300">
                  Assessment Auto-Submitted
                </h2>
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-lg text-red-800 dark:text-red-200 font-semibold mb-2">
                {violationMessage}
              </p>
              <p className="text-base text-slate-700 dark:text-slate-300">
                Your assessment has been automatically submitted due to policy violations. All answers have been saved.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-2 text-sm text-red-700 dark:text-red-300"
            >
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Redirecting to your results...</span>
            </motion.div>
            <div className="pt-4 border-t border-red-200 dark:border-red-700">
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                Your instructor has been notified of this auto-submission.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show preloading screen while quiz is being fetched
  if (loading) {
    return (
      <div
        data-quiz-native-root={isNativeApp ? true : undefined}
        className="relative min-h-[100dvh] w-full overflow-x-hidden"
      >
        {!isNativeApp ? <QuizTakerChrome /> : null}

        <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 sm:px-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl mx-auto px-6"
          >
            <Card className="border-2 border-blue-200 dark:border-blue-700 shadow-2xl bg-white dark:bg-slate-800">
              <CardContent className="p-12">
                {/* Header */}
                <div className="text-center mb-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="inline-block mb-4"
                  >
                    <Loader2 className="h-16 w-16 text-blue-600 dark:text-blue-400" />
                  </motion.div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                    Preparing Your Assessment
                  </h2>
                  <p className="text-slate-700 dark:text-slate-200">
                    Loading questions and setting up your exam environment...
                  </p>
                </div>

                {/* Progress Steps */}
                <div className="space-y-4">
                  {[
                    { icon: CheckCircle2, label: "Verifying your session" },
                    { icon: Loader2, label: "Loading questions" },
                    { icon: Clock, label: "Initializing timer system" },
                    { icon: Shield, label: "Setting up exam environment" },
                  ].map((step, index) => {
                    const isDone = index < loadingStep
                    const isActive = index === loadingStep
                    const isPending = index > loadingStep
                    
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                          isActive
                            ? "bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-300 dark:border-blue-600"
                            : isDone
                            ? "bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-600"
                            : "bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-6 w-6 text-emerald-700 dark:text-emerald-300 flex-shrink-0" />
                        ) : isActive ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                          >
                            <step.icon className="h-6 w-6 text-blue-700 dark:text-blue-300 flex-shrink-0" />
                          </motion.div>
                        ) : (
                          <step.icon className="h-6 w-6 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                        )}
                        <span
                          className={`font-semibold ${
                            isActive
                              ? "text-blue-800 dark:text-blue-100"
                              : isDone
                              ? "text-emerald-800 dark:text-emerald-100"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {step.label}
                        </span>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Progress Bar */}
                <div className="mt-8">
                  <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: "0%" }}
                      animate={{ width: `${(loadingStep / 3) * 100}%` }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                      className="h-full bg-[var(--cc-accent)]"
                    />
                  </div>
                  <p className="text-center text-sm font-medium text-slate-700 dark:text-slate-200 mt-2">
                    {loadingStep === 0 && "Verifying your session..."}
                    {loadingStep === 1 && "Loading all questions..."}
                    {loadingStep === 2 && "Initializing timer system..."}
                    {loadingStep === 3 && "Almost ready..."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    )
  }

  // Show waiting room if student is in waiting list
  if (inWaitingList) {
    const studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
    if (!studentDatabaseId) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-slate-600 dark:text-slate-200 mb-4">Student ID not found</div>
            <Button onClick={() => router.push("/student/login")} variant="outline">
              Back to Login
            </Button>
          </div>
        </div>
      )
    }
    
    return (
      <WaitingRoom
        quizId={quizId}
        studentId={studentDatabaseId}
        onAdmitted={async () => {
          // When admitted, try to start the quiz again
          // CRITICAL: Guard against duplicate start-quiz API calls
          if (isStartingQuizRef.current) {
            return
          }
          
          isStartingQuizRef.current = true
          
          try {
            let waitingSuperpowers =
              enableSuperpowers ? [...selectedSuperpowersForAttemptRef.current] : []
            if (enableSuperpowers && waitingSuperpowers.length === 0) {
              try {
                const raw = sessionStorage.getItem(`quizSuperpowers:${quizId}`)
                if (raw != null) {
                  const parsed = JSON.parse(raw) as unknown
                  if (Array.isArray(parsed)) waitingSuperpowers = [...parsed]
                }
              } catch {
                /* ignore */
              }
            }
            if (enableSuperpowers) {
              selectedSuperpowersForAttemptRef.current = [...waitingSuperpowers]
            }
            const startResponse = await studentApiFetch("/api/student/start-quiz", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                studentId: studentDatabaseId,
                quizId,
                ...(enableSuperpowers ? { superpowers: waitingSuperpowers } : {}),
              }),
            })
            
            const startData = await startResponse.json()
            
            if (startData.attemptId) {
              setAttemptId(startData.attemptId)
              setInWaitingList(false)
              // Reload the quiz to start
              await fetchQuiz(undefined, enableSuperpowers ? waitingSuperpowers : undefined)
            } else if (startData.inWaitingList) {
              // Still in waiting list, update position
              setWaitingListPosition(startData.position || 0)
            }
          } catch (error) {
            toast({
              title: "Error",
              description: "Failed to start quiz after admission. Please try again.",
              variant: "destructive",
            })
          } finally {
            // Reset guard after API call completes (success or failure)
            isStartingQuizRef.current = false
          }
        }}
      />
    )
  }

  // CRITICAL: If locked due to violations or finalized, show warning screen with danger colors
  if (isLockedDueToViolations || isQuizFinalized) {
    const violationMessage = violationReason?.toLowerCase().includes('tab') 
      ? "Excessive tab switching detected"
      : violationReason?.toLowerCase().includes('ai') || violationReason?.toLowerCase().includes('gemini')
      ? "AI tool usage detected"
      : "Maximum violations reached"
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 dark:from-red-900/40 dark:via-orange-900/40 dark:to-amber-900/40">
        <div className="text-center max-w-lg mx-auto p-8 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-2xl border-2 border-red-400 dark:border-red-600 shadow-2xl">
          <motion.div
            animate={{ 
              rotate: [0, -10, 10, -10, 10, 0],
              scale: [1, 1.1, 1, 1.1, 1]
            }}
            transition={{ 
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="flex justify-center mb-6"
          >
            <TriangleAlert className="h-20 w-20 text-red-600 dark:text-red-400" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              <h2 className="text-3xl font-bold text-red-700 dark:text-red-300">
                Assessment Auto-Submitted
              </h2>
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-lg text-red-800 dark:text-red-200 font-semibold mb-2">
              {violationMessage}
            </p>
            <p className="text-base text-slate-700 dark:text-slate-300 mb-4">
              Your assessment has been automatically submitted due to policy violations. All answers have been saved.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-2 text-sm text-red-700 dark:text-red-300 mb-4"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Saving your answers and redirecting to results...</span>
          </motion.div>
          <div className="pt-4 border-t border-red-200 dark:border-red-700">
            <p className="text-xs text-red-700 dark:text-red-300 font-medium">
              Your instructor has been notified of this auto-submission.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-slate-600 dark:text-slate-200 mb-4">Quiz not found or no longer available</div>
          <Button onClick={() => router.push(homeLink)} variant="outline">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // Now we know quiz exists, so we can safely access quiz.questions
  // Safety check: ensure questions exist
  if (!quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-slate-600 dark:text-slate-200 mb-4">No questions found for this assessment</div>
          <Button onClick={() => router.push(homeLink)} variant="outline">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }
  
  // Safety check: ensure currentQuestion exists
  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-slate-600 dark:text-slate-200 mb-4">Question not found</div>
          <Button onClick={() => router.push(homeLink)} variant="outline">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }
  
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100
  const questionType = currentQuestion?.question_type || "mcq"
  const showQuestionTimer =
    questionUsesPerQuestionTimer(questionType, currentQuestionIndex) && timeLeft >= 0
  const showSectionTimer =
    usesSectionCountdown(currentSectionConfig, effectiveType) && currentSectionTimeLeft >= 0
  const extraTime = (quiz as any)?.extraTimePerQuestion || 0
  const isCodeQ = currentQuestion && ["code_write", "code_problem", "debug_code"].includes((currentQuestion.question_type || "").toLowerCase())
  const questionTimeLimit = showQuestionTimer
    ? resolveQuestionTimeLimitSeconds(
        questionType,
        currentQuestion?.time_limit,
        quiz.time_per_question,
        currentSectionConfig,
        courseTimer,
        { hasDiagram: currentQuestion ? questionHasCircuitDiagram(currentQuestion) : false },
      ) + (isCodeQ ? extraTime : 0)
    : 0
  const sectionTimeLimit = showSectionTimer
    ? getExamSharedTimerSeconds(parsedSectionConfigRef.current) ??
      resolveSectionTotalTimeSeconds(currentSectionConfig, sectionTimerContext)
    : 0
  const examSharedTimerActive =
    showSectionTimer && usesExamSharedTimer(parsedSectionConfigRef.current)
  const allowBackNav = currentQuestionIndex > 0 && canNavigateToIndex(currentQuestionIndex - 1)
  const timerProgress = questionTimeLimit > 0 ? (timeLeft / questionTimeLimit) * 100 : 0
  const hasQuestionTimerDisplay = showQuestionTimer && !showSectionTimer
  const hasSectionTimerDisplay = showSectionTimer && !examSharedTimerActive
  const hasExamTimerDisplay = examSharedTimerActive
  const showTimerColumn = hasQuestionTimerDisplay || hasSectionTimerDisplay || hasExamTimerDisplay
  const timerColumnLabel = hasExamTimerDisplay
    ? "Exam time"
    : hasSectionTimerDisplay
      ? "Section time"
      : "Time left"
  const timerColumnValue = hasQuestionTimerDisplay
    ? timerStarting
      ? "…"
      : `${timeLeft}s`
    : sectionTimerStarting
      ? "…"
      : formatTimerMmSs(currentSectionTimeLeft)
  const timerColumnUrgent = hasQuestionTimerDisplay
    ? timeLeft <= 10
    : currentSectionTimeLeft <= 120
  const timerDrainPercent = hasQuestionTimerDisplay
    ? timerProgress
    : sectionTimeLimit > 0
      ? (currentSectionTimeLeft / sectionTimeLimit) * 100
      : 0
  const questionPoints = currentQuestion.max_points || currentQuestion.points
  const isCodingQuestion = ["code_problem", "debug_code", "code_write"].includes(questionType.toLowerCase())
  const isExplainQuestion = questionType.toLowerCase() === "code_explain"
  const isTraceQuestion = questionType.toLowerCase() === "trace_output"
  const isFillBlankQuestion = questionType.toLowerCase() === "fill_blank"
  const isCodeOutputQuestion = questionType.toLowerCase() === "code_output"
  const isMultiSelectQuestion =
    questionType.toLowerCase() === "multi_output" || questionType.toLowerCase() === "select_all"
  const isFlagged = flaggedQuestions.has(currentQuestion.id)
  const flaggedCount = flaggedQuestions.size

  const poolAllowsCircuitEdit = circuitEditableInSectionPool(
    currentQuestionIndex,
    questionType,
  )

  const isQuestionLocked =
    ((lockedQuestions.has(currentQuestion.id) || timerExpiredForQuestion.has(currentQuestion.id)) &&
      !poolAllowsCircuitEdit) ||
    isLockedDueToViolations

  const isQuestionSubmitted = submittedQuestions.has(currentQuestion.id)
  const qType = (currentQuestion?.question_type || "mcq").toLowerCase()
  const isLockableType = ["mcq", "true_false", "select_all", "multi_output", "multi_part"].includes(
    questionType.toLowerCase(),
  )
  
  // Determine if this is an AI-gradable question
  const isAIGradableQuestion =
    [
      "code_write",
      "code_write_plot",
      "code_explain",
      "code_problem",
      "debug_code",
      "code_debug",
    ].includes(questionType.toLowerCase()) ||
    (questionType.toLowerCase() === "multi_part" &&
      multiPartStudentAnswerHasUpload(
        selectedAnswer || "{}",
        currentQuestion.solution_upload_config,
      )) ||
    (questionType.toLowerCase() === "circuit_submission" &&
      (circuitSubmissionHasRequiredUpload(
        selectedAnswer || "{}",
        parseCircuitSubmissionConfig(currentQuestion.solution_upload_config),
      ) ||
        circuitSubmissionHasRequiredUpload(
          answers[currentQuestion.id] || "{}",
          parseCircuitSubmissionConfig(currentQuestion.solution_upload_config),
        ) ||
        questionsWithStoredEval.has(currentQuestion.id) ||
        savedAnswers.has(currentQuestion.id)))

  const hasStoredEvalFeedback =
    currentQuestion != null && questionsWithStoredEval.has(currentQuestion.id)

  const lockedObjectiveGrade =
    currentQuestion != null && questionsWithObjectiveGrade.has(currentQuestion.id)
      ? objectiveGradeByQuestionRef.current[currentQuestion.id] ?? null
      : null

  const isMultiPartUploadEval =
    questionType.toLowerCase() === "multi_part" &&
    multiPartStudentAnswerHasUpload(
      selectedAnswer || "{}",
      currentQuestion.solution_upload_config,
    )

  const isCircuitSubmissionQuestion = questionType.toLowerCase() === "circuit_submission"

  const circuitSubmissionProvisionalLocked =
    isCircuitSubmissionQuestion && isQuestionLocked

  const isSolutionUploadEval = isCircuitSubmissionQuestion || isMultiPartUploadEval

  const canAskCoraOnCurrentQuestion = canStudentAskCora(questionType, {
    subquestionTypes: parseSubquestions(currentQuestion?.subquestions).map((sq) => sq.type),
  })

  // Lock questions if: timer expired OR (lockable type AND submitted) OR (AI-graded AND timer expired)
  const shouldLockQuestion =
    isQuestionLocked || (isLockableType && isQuestionSubmitted)

  // Prefer fetched hint text (take payloads omit the text and set `has_hint`);
  // fall back to question.hint when present (preview/instructor/review payloads).
  const currentHintText =
    hintTextByQuestionId[currentQuestion.id] ?? currentQuestion.hint ?? null
  const hasHint =
    currentQuestion.has_hint === true ||
    Boolean(currentQuestion.hint && currentQuestion.hint.trim().length > 0)
  const hintUsed = usedHints.has(currentQuestion.id)

  const isFillInType = ["fill_blank", "code_output", "trace_output", "fill_code", "trace_logic"].includes(
    questionType.toLowerCase(),
  )

  const unansweredCount = quiz.questions.length - answeredQuestions.size

  const currentSection = getSectionForQuestionIndex(currentQuestionIndex, sections)
  const isFirstInSection =
    currentSection !== null && currentQuestionIndex === currentSection.startIndex

  const studentDatabaseIdForRenderer = (() => {
    if (typeof window === "undefined") return null
    const raw = sessionStorage.getItem("studentDatabaseId")
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  })()

  const isCompactObjectiveQuestion = ["mcq", "multiple_choice", "true_false", "select_all", "multi_output"].includes(
    questionType.toLowerCase(),
  )

  const toolbarChipClass =
    "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-medium sm:px-3"
  const toolbarActionClass =
    "h-9 gap-1.5 rounded-lg px-2.5 text-xs font-medium shadow-none sm:px-3 sm:text-sm"

  const questionNavigator = (
    <StudentQuizQuestionNavigator
      questionCount={quiz.questions.length}
      currentQuestionIndex={currentQuestionIndex}
      questions={quiz.questions}
      answeredQuestionIds={answeredQuestions}
      flaggedQuestionIds={flaggedQuestions}
      sections={sections}
      parsedSectionConfig={parsedSectionConfig}
      sectionQuestionSelections={sectionQuestionSelections}
      onNavigate={(idx) => void goToQuestion(idx)}
    />
  )

  const hasTimerOrSuperpowersInCardHeader =
    showTimerColumn || Boolean((quiz as any)?.activeSuperpowers?.length)
  const showMobileFlagHintInCardHeader = !showQuestionNav

  const questionFlagHintActions = (layout: "sidebar" | "compact") => (
    <div
      className={cn(
        layout === "sidebar" ? "flex flex-col gap-1.5" : "flex flex-wrap items-center gap-1.5 sm:gap-2",
      )}
    >
      <Button
        variant={isFlagged ? "default" : "outline"}
        size="sm"
        onClick={() => toggleFlag(currentQuestion.id)}
        className={cn(
          layout === "sidebar" ? cn(toolbarActionClass, "w-full justify-start") : "h-8 gap-1 rounded-md px-2.5 text-xs",
          isFlagged
            ? "border-transparent bg-amber-500 text-white hover:bg-amber-600"
            : "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]",
        )}
      >
        <Flag className="size-3.5 shrink-0" />
        <span>{isFlagged ? "Flagged for review" : "Flag question"}</span>
      </Button>
      {hasHint ? (
        <Button
          variant={hintUsed ? "secondary" : "default"}
          size="sm"
          onClick={() => {
            if (!hintUsed) {
              handleUseHint(currentQuestion.id, currentQuestion.hint_penalty || 0.25)
            } else if (!showHint && currentHintText == null) {
              // Hint used but text missing locally (e.g. after refresh) — re-fetch it.
              handleUseHint(currentQuestion.id, currentQuestion.hint_penalty || 0.25)
            } else {
              setShowHint(!showHint)
            }
          }}
          className={cn(
            layout === "sidebar" ? cn(toolbarActionClass, "w-full justify-start") : "h-8 gap-1 rounded-md px-2.5 text-xs",
            hintUsed
              ? "border-[var(--cc-sem-warning-border)] bg-[var(--cc-sem-warning-soft)] text-[var(--cc-sem-warning-text)]"
              : "bg-amber-600 text-white hover:bg-amber-700",
          )}
          disabled={
            showFeedback ||
            isQuestionLocked ||
            isLockedDueToViolations ||
            isBlockedByFullscreen ||
            isBlockedByLocation
          }
        >
          <Lightbulb className="size-3.5 shrink-0" />
          <span>
            {hintUsed
              ? showHint
                ? "Hide hint"
                : "Show hint"
              : `Get hint (−${currentQuestion.hint_penalty || 0.25} pts)`}
          </span>
        </Button>
      ) : null}
    </div>
  )

  return (
    <div
      data-quiz-native-root={isNativeApp ? true : undefined}
      data-quiz-taker-root
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,var(--cc-accent-soft),transparent_55%)] opacity-60"
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
      <QuizTakerChrome
        title={isNativeApp ? undefined : quiz.title}
        toolbar={
            <div className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5 sm:gap-3 [scrollbar-width:thin]">
                <div
                  className={cn(
                    toolbarChipClass,
                    "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]",
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cc-text-muted)]">
                    Q
                  </span>
                  <p className="text-sm font-bold tabular-nums leading-none">
                    {currentQuestionIndex + 1}
                    <span className="text-xs font-medium text-[var(--cc-text-muted)]">
                      /{quiz.questions.length}
                    </span>
                  </p>
                </div>

                <div className="flex min-w-[7rem] max-w-xs flex-1 flex-col justify-center gap-0.5 sm:max-w-sm md:max-w-md">
                  <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs">
                    <span className="font-medium text-[var(--cc-text-muted)]">Quiz progress</span>
                    <span className="tabular-nums font-semibold text-[var(--cc-text)]">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)] sm:h-2">
                    <div
                      className="h-full rounded-full bg-[var(--cc-accent)] transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {questionPoints ? (
                    <p className="hidden text-[10px] text-[var(--cc-text-muted)] sm:block">
                      Worth {questionPoints} {questionPoints === 1 ? "pt" : "pts"} ·{" "}
                      {questionWeight.toFixed(1)}% of grade
                    </p>
                  ) : null}
                </div>

                <div className="hidden h-6 w-px shrink-0 bg-[var(--border)] sm:block" aria-hidden />

                <div className="flex shrink-0 items-center gap-1.5">
                {!isOnline && (
                  <span
                    className={cn(
                      toolbarChipClass,
                      "border-[var(--cc-sem-danger-border)] bg-[var(--cc-sem-danger-soft)] text-[var(--cc-sem-danger-text)] animate-pulse",
                    )}
                  >
                    <AlertCircle className="size-3.5 shrink-0" />
                    Offline
                  </span>
                )}
                {answerQueue.length > 0 && (
                  <span
                    className={cn(
                      toolbarChipClass,
                      "border-[var(--cc-sem-warning-border)] bg-[var(--cc-sem-warning-soft)] text-[var(--cc-sem-warning-text)]",
                    )}
                  >
                    <AlertCircle className="size-3.5 shrink-0" />
                    {answerQueue.length} pending
                  </span>
                )}
                {retryingSubmission && (
                  <span
                    className={cn(
                      toolbarChipClass,
                      "border-[var(--cc-sem-info-border)] bg-[var(--cc-sem-info-soft)] text-[var(--cc-sem-info-text)]",
                    )}
                  >
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                    Syncing
                  </span>
                )}
                {unansweredCount > 0 && (
                  <span
                    className={cn(
                      toolbarChipClass,
                      "border-[var(--border)] bg-[var(--muted)]/50 text-[var(--cc-text-secondary)]",
                    )}
                  >
                    <AlertCircle className="size-3.5 shrink-0 text-[var(--cc-sem-warning-text)]" />
                    {unansweredCount} unanswered
                  </span>
                )}
                {flaggedCount > 0 && (
                  <span
                    className={cn(
                      toolbarChipClass,
                      "border-[var(--border)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
                    )}
                  >
                    <Flag className="size-3.5 shrink-0" />
                    {flaggedCount} flagged
                  </span>
                )}
                {sections.length > 0 && (
                  <span
                    className={cn(
                      toolbarChipClass,
                      "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text-secondary)]",
                    )}
                  >
                    {sections.length} sections
                  </span>
                )}
                {isOnline && answerQueue.length === 0 && !retryingSubmission && unansweredCount === 0 && flaggedCount === 0 && sections.length === 0 && (
                  <span
                    className={cn(
                      toolbarChipClass,
                      "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text-muted)]",
                    )}
                  >
                    In progress
                  </span>
                )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuestionNav(!showQuestionNav)}
                  className={cn(
                    toolbarActionClass,
                    "lg:hidden",
                    showQuestionNav
                      ? "border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] hover:bg-[var(--cc-accent-soft)]"
                      : "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]",
                  )}
                >
                  <Grid3x3 className="size-3.5 shrink-0 sm:size-4" />
                  <span className="truncate">{showQuestionNav ? "Hide" : "Questions"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWaterBreakPicker(true)}
                  disabled={submitting || waterBreakActive}
                  className={cn(
                    toolbarActionClass,
                    "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]",
                  )}
                >
                  <Droplets className="size-3.5 shrink-0 sm:size-4" />
                  <span className="truncate hidden sm:inline">Water Break</span>
                  <span className="truncate sm:hidden">Break</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!attemptId || !quiz) return
                    if (!hasSaveAndFinishLaterAccess && membershipTier !== "Explorer" && membershipTier !== "Trailblazer") {
                      setShowSaveLaterUpgradeModal(true)
                      return
                    }
                    setShowContinueLaterWarningDialog(true)
                  }}
                  data-testid="continue-later-btn"
                  disabled={submitting}
                  className={cn(
                    toolbarActionClass,
                    "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]",
                  )}
                >
                  <span className="truncate hidden sm:inline">Continue Later</span>
                  <span className="truncate sm:hidden">Later</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExitDialog(true)}
                  className={cn(
                    toolbarActionClass,
                    "border-[var(--cc-sem-danger-border)] bg-[var(--cc-sem-danger-soft)] text-[var(--cc-sem-danger-text)] hover:bg-[var(--cc-sem-danger-soft)] hover:text-[var(--cc-sem-danger-text)]",
                  )}
                >
                  <span className="truncate hidden sm:inline">Exit Quiz</span>
                  <span className="truncate sm:hidden">Exit</span>
                </Button>
              </div>
            </div>
          }
      />

      <div
        className={cn(
          "flex min-h-0 flex-1 items-stretch overflow-hidden",
          coraDrawerOpen && canAskCoraOnCurrentQuestion && "max-md:flex-col",
        )}
      >
        <aside className="hidden w-[17rem] shrink-0 flex-col gap-4 overflow-y-auto border-r border-[var(--border)] bg-[var(--card)] p-4 lg:flex xl:w-72">
          {questionNavigator}
          <div className="shrink-0 space-y-2 border-t border-[var(--border)] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              Question {currentQuestionIndex + 1}
            </p>
            {questionFlagHintActions("sidebar")}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {showQuestionNav ? (
            <div className="shrink-0 space-y-3 border-b border-[var(--border)] bg-[var(--card)] p-4 lg:hidden">
              <StudentQuizQuestionNavigator
                questionCount={quiz.questions.length}
                currentQuestionIndex={currentQuestionIndex}
                questions={quiz.questions}
                answeredQuestionIds={answeredQuestions}
                flaggedQuestionIds={flaggedQuestions}
                sections={sections}
                parsedSectionConfig={parsedSectionConfig}
                sectionQuestionSelections={sectionQuestionSelections}
                compact
                onNavigate={(idx) => void goToQuestion(idx)}
              />
              {questionFlagHintActions("compact")}
            </div>
          ) : null}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overflow-x-hidden mx-auto w-full px-3 pb-8 pt-4 sm:px-5 sm:pt-5",
          isCompactObjectiveQuestion ? "max-w-3xl lg:max-w-none" : "max-w-5xl lg:max-w-none",
          isNativeApp && "pt-2",
          (isGeminiBlocking || isBlockedByFullscreen || isBlockedByLocation) && quizStarted && "pointer-events-none opacity-50",
        )}
      >
        <div
          className={cn(
            isCompactObjectiveQuestion ? "mx-auto max-w-3xl" : "mx-auto max-w-5xl",
          )}
        >
        <div
          className={cn(
            "relative flex flex-col gap-4 lg:flex-row",
            isCompactObjectiveQuestion && !showCompiler && "justify-center",
          )}
        >
          <div
            className={cn(
              "w-full transition-all duration-300",
              showCompiler ? "lg:w-1/2" : "w-full",
              isCompactObjectiveQuestion && !showCompiler && "mx-auto max-w-3xl",
            )}
          >
            <Card className="gap-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] py-0 shadow-sm sm:rounded-2xl">
              {(hasTimerOrSuperpowersInCardHeader || showMobileFlagHintInCardHeader) ? (
              <CardHeader
                className={cn(
                  "space-y-2 border-b border-[var(--border)] bg-[var(--muted)]/25 px-4 py-2.5 sm:px-5 [.border-b]:pb-2.5",
                  !hasTimerOrSuperpowersInCardHeader && "lg:hidden",
                )}
              >
                {showMobileFlagHintInCardHeader ? (
                  <div className="lg:hidden">{questionFlagHintActions("compact")}</div>
                ) : null}

                {showTimerColumn ? (
                  <div
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 sm:gap-3 sm:px-4",
                      timerColumnUrgent
                        ? "border-[var(--cc-sem-danger-border)] bg-[var(--cc-sem-danger-soft)]"
                        : "border-[var(--border)] bg-[var(--card)]",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                      <div className="shrink-0 text-center">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cc-text-muted)]">
                          {timerColumnLabel}
                        </span>
                        <p
                          className={cn(
                            "text-lg font-bold tabular-nums leading-none sm:text-xl",
                            timerColumnUrgent
                              ? "text-[var(--cc-sem-danger-text)] animate-pulse"
                              : "text-[var(--cc-text)]",
                          )}
                        >
                          {timerColumnValue}
                        </p>
                      </div>
                      {(hasQuestionTimerDisplay && questionTimeLimit > 0) ||
                      (hasSectionTimerDisplay && sectionTimeLimit > 0) ||
                      (hasExamTimerDisplay && sectionTimeLimit > 0) ? (
                        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                            {hasQuestionTimerDisplay && questionTimeLimit > 0 ? (
                              timeLeft <= 0 ? (
                                <div className="h-full w-0 rounded-full bg-[var(--cc-sem-danger)]" />
                              ) : (
                                <motion.div
                                  key={`timer-${currentQuestionIndex}-${timeLeft}`}
                                  initial={{ width: `${Math.max(0, Math.min(100, timerProgress))}%` }}
                                  animate={{ width: "0%" }}
                                  transition={{
                                    duration: timeLeft,
                                    ease: "linear",
                                  }}
                                  className={cn(
                                    "h-full rounded-full",
                                    timeLeft <= 10
                                      ? "bg-[var(--cc-sem-danger)]"
                                      : "bg-[var(--cc-sem-info)]",
                                  )}
                                />
                              )
                            ) : (
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-1000 ease-linear",
                                  timerColumnUrgent
                                    ? "bg-[var(--cc-sem-warning)]"
                                    : "bg-[var(--cc-accent)]",
                                )}
                                style={{ width: `${Math.max(0, Math.min(100, timerDrainPercent))}%` }}
                              />
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {(quiz as any)?.activeSuperpowers?.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-2">
                    {(quiz as any).activeSuperpowers.map((id: string) => {
                      const cfg = SUPERPOWER_CONFIG[id as keyof typeof SUPERPOWER_CONFIG]
                      if (!cfg) return null
                      const label =
                        id === "extra_time" ? "+5 Min Coding" : id === "extra_retake" ? "+1 Retake" : cfg.label
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--cc-sem-warning-border)] bg-[var(--cc-sem-warning-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--cc-sem-warning-text)]"
                        >
                          <span>{cfg.icon}</span>
                          <span className="max-w-[120px] truncate sm:max-w-none">{label}</span>
                        </span>
                      )
                    })}
                  </div>
                ) : null}
              </CardHeader>
              ) : null}
              <CardContent className="relative px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
                {/* Loading Overlay - Show while question is rendering */}
                {!questionRendered && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl sm:rounded-2xl">
                    <div className="text-center px-4">
                      <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-2 sm:mb-3" />
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-200">Loading question...</p>
                      <p className="text-xs text-slate-500 dark:text-slate-200 mt-1">Timer will start after loading</p>
                    </div>
                  </div>
                )}
                
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestionIndex}
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="space-y-4 sm:space-y-5 md:space-y-6"
                    data-nosnippet
                  >
                    {isFirstInSection && currentSection && (
                      <div className="pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-200/60 dark:border-slate-600 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-1 rounded-lg bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 text-sm font-semibold">
                            {shortSectionNavigatorTitle(currentSection.title)}
                          </div>
                          {currentSection.weightPercent > 0 && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {currentSection.weightPercent}% of total score
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {currentSection && (
                      <SectionQuestionPickToggle
                        sectionIndex={currentSection.sectionIndex}
                        questionId={currentQuestion.id}
                        sectionConfig={parsedSectionConfig}
                        selections={sectionQuestionSelections}
                        disabled={isQuizFinalized || submitting}
                        onToggle={persistSectionQuestionSelections}
                        onLimitReached={(message) =>
                          toast({ title: "Selection limit", description: message, variant: "default" })
                        }
                      />
                    )}
                    {questionType.toLowerCase() !== "circuit_submission" ? (
                      <QuestionStemWithMedia question={currentQuestion}>
                        <div
                          className={cn(
                            "mx-auto rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 px-4 py-4 sm:px-5 sm:py-5",
                            isCompactObjectiveQuestion ? "max-w-2xl" : "max-w-3xl",
                          )}
                        >
                          <div className="text-base font-medium leading-relaxed text-slate-900 dark:text-slate-100 sm:text-lg" data-nosnippet>
                          {currentQuestion.question_type &&
                            isCircuitQuestionType(currentQuestion.question_type) &&
                            currentQuestion.question_type.toLowerCase() !== "circuit_submission" && (
                              <CircuitAssessmentStem circuitSpecRaw={currentQuestion.circuit_spec} />
                            )}
                          <QuestionTextRenderer text={currentQuestion.question_text} questionId={currentQuestion.id} />
                          </div>
                        </div>
                      </QuestionStemWithMedia>
                    ) : null}

                    {currentQuestion && canAskCoraOnCurrentQuestion ? (
                      <div className="flex flex-wrap justify-end">
                        <Button
                          type="button"
                          variant={coraDrawerOpen ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "gap-1.5 rounded-full",
                            coraDrawerOpen
                              ? "border-0 bg-[var(--cc-accent)] text-white hover:opacity-90"
                              : "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]",
                          )}
                          onClick={() => setCoraDrawerOpen((open) => !open)}
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0" />
                          <span>{coraDrawerOpen ? "Hide Cora" : "Ask Cora"}</span>
                        </Button>
                      </div>
                    ) : null}

                    {hintUsed && showHint && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl bg-amber-50/80 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/60"
                      >
                        <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                          <div className="p-1.5 sm:p-2 bg-amber-100/80 dark:bg-amber-800/80 rounded-lg sm:rounded-xl shrink-0">
                            <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-amber-700 dark:text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm sm:text-base text-amber-900 dark:text-amber-100 mb-1 sm:mb-2">💡 Hint:</p>
                            <p className="text-xs sm:text-sm md:text-base text-amber-800 dark:text-amber-200 break-words">{currentHintText}</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 sm:mt-3">
                              Note: {currentQuestion.hint_penalty || 0.25} point(s) deducted for using this hint.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* CodeBench removed - compiler not yet implemented */}

                    <QuestionRenderer
                      question={currentQuestion}
                      selectedAnswer={selectedAnswer}
                      selectedMultiAnswers={selectedMultiAnswers}
                      code={code}
                      showFeedback={showFeedback}
                      isSubmittingAnswer={isSubmittingAnswer}
                      isCorrect={isCorrect}
                      partialCreditPoints={partialCreditPoints}
                      onAnswerChange={handleAnswerChange}
                      onMultiAnswerToggle={toggleMultiAnswer}
                      onCodeChange={handleCodeChange}
                      isLocked={shouldLockQuestion}
                      lockedObjectiveGrade={lockedObjectiveGrade}
                      aiFeedback={aiFeedback}
                      uploadedPlot={uploadedPlot}
                      onPlotUpload={handlePlotUpload}
                      onPlotRemove={handlePlotRemove}
                      attemptId={attemptId}
                      studentDatabaseId={studentDatabaseIdForRenderer}
                      circuitAnswerSnapshotRef={circuitAnswerSnapshotRef}
                      circuitPrepareSubmitRef={circuitPrepareSubmitRef}
                      onAntiCheatSuspendChange={setSolutionUploadAntiCheatSuspension}
                      antiCheatSuspendedForSolutionUpload={solutionUploadSuspendingAntiCheat}
                      isAntiCheatSuspended={isSolutionUploadAntiCheatPaused}
                      onTypingReplay={antiCheatConfig.keystrokePlaybackEnforced !== false ? (replay) => {
                        if (currentQuestion?.id) {
                          typingReplayByQuestionRef.current[currentQuestion.id] = replay
                          if (replay.events?.length === 1 || (replay.events?.length && replay.events.length % 20 === 0)) {
                            console.log("[quiz-taker] [TYPING-REPLAY] recording", { questionId: currentQuestion.id, eventCount: replay.events.length })
                          }
                        }
                      } : undefined}
                    />

                    {/* Quiz Master / instructor feedback — always offer when evaluation exists */}
                    {hasStoredEvalFeedback && !showFeedback && !isSubmittingAnswer ? (
                      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-purple-50/80 dark:bg-purple-900/25 border border-purple-200/70 dark:border-purple-700/50">
                        <p className="text-xs sm:text-sm text-purple-900 dark:text-purple-100 flex-1 min-w-0">
                          Quiz Master has feedback on your submitted solution.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 border-purple-300 dark:border-purple-600 text-purple-800 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                          onClick={() => applyEvalFeedbackForQuestion(currentQuestion.id)}
                        >
                          View Quiz Master evaluation
                        </Button>
                      </div>
                    ) : null}

                    {/* Submission still syncing after primary /api/submit failed */}
                    {submissionPendingQuestions.has(currentQuestion.id) && !shouldLockQuestion && !isSubmittingAnswer ? (
                      <div className="mt-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50/80 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/60 flex items-start sm:items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-amber-100/80 dark:bg-amber-800/80 rounded-lg sm:rounded-xl shrink-0">
                          <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-700 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs sm:text-sm md:text-base text-amber-900 dark:text-amber-100">
                            Submission syncing
                          </p>
                          <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 break-words">
                            Your work is recorded. Grading may be delayed until sync completes — tap Submit again if needed, or ask your instructor to re-evaluate.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {/* Answer Saved Message for AI-graded questions that allow resubmit */}
                    {isAIGradableQuestion &&
                      aiGradedQuestionsSubmitted.has(currentQuestion.id) &&
                      savedAnswers.has(currentQuestion.id) &&
                      !submissionPendingQuestions.has(currentQuestion.id) &&
                      !isSubmittingAnswer &&
                      !shouldLockQuestion &&
                      (allowsResubmitForBetterScore(questionType) || isMultiPartUploadEval) && (
                      <div className="mt-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-green-50/80 dark:bg-green-900/30 border border-green-200/60 dark:border-green-700/60 flex items-start sm:items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-green-100/80 dark:bg-green-800/80 rounded-lg sm:rounded-xl shrink-0">
                          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-700 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs sm:text-sm md:text-base text-green-900 dark:text-green-100">✅ Answer Saved & Recorded</p>
                          <p className="text-xs sm:text-sm text-green-700 dark:text-green-300 break-words">
                            {isMultiPartUploadEval
                              ? "Your answer has been saved. You can revise your solution and resubmit for a better score, or move to the next question."
                              : "Your answer has been saved. You can improve your code and resubmit for a better score, or move to the next question."}
                          </p>
                          {hasStoredEvalFeedback && !showFeedback ? (
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 mt-1 text-xs text-green-800 dark:text-green-200 underline"
                              onClick={() => applyEvalFeedbackForQuestion(currentQuestion.id)}
                            >
                              View Quiz Master evaluation
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    )}

                    <AnimatePresence>
                      {showFeedback && !aiFeedback && !lockedObjectiveGrade && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ 
                            opacity: 1, 
                            scale: 1,
                            // Only shake for non-AI questions
                            ...(!aiFeedback && !isCorrect ? { x: [0, -10, 10, -10, 10, 0] } : {})
                          }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={
                            aiFeedback 
                              ? { duration: 0.3, ease: "easeOut" } // Smooth for AI feedback
                              : isCorrect 
                                ? { type: "spring", stiffness: 200 } 
                                : { duration: 0.5 }
                          }
                          className={`flex items-start sm:items-center gap-3 sm:gap-4 p-4 sm:p-6 rounded-xl sm:rounded-2xl border ${
                            isCorrect
                              ? "bg-emerald-50/80 dark:bg-emerald-900/30 border-emerald-200/60 dark:border-emerald-700/60"
                              : partialCreditPoints && partialCreditPoints > 0
                                ? "bg-amber-50/80 dark:bg-amber-900/30 border-amber-200/60 dark:border-amber-700/60"
                                : "bg-red-50/80 dark:bg-red-900/30 border-red-200/60 dark:border-red-700/60"
                          }`}
                        >
                          {isCorrect ? (
                            <>
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: [0, 1.2, 1] }}
                                transition={{ duration: 0.5 }}
                                className="shrink-0"
                              >
                                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
                              </motion.div>
                              <span className="font-semibold text-sm sm:text-base text-emerald-700 dark:text-emerald-300">✅ Correct!</span>
                            </>
                          ) : partialCreditPoints && partialCreditPoints > 0 ? (
                            <>
                              <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-xs sm:text-sm md:text-base text-amber-700 dark:text-amber-300">⚠️ Partial Credit!</span>
                                <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 break-words">
                                  You earned {Math.round(partialCreditPoints * 100)}% of the points after multiple
                                  attempts.
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: [0, 1.2, 1] }}
                                transition={{ duration: 0.5 }}
                                className="shrink-0"
                              >
                                <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                              </motion.div>
                              <div className="flex-1 min-w-0">
                                <span className="font-semibold text-xs sm:text-sm md:text-base text-red-700 dark:text-red-300">❌ Incorrect</span>
                                <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 mt-1 break-words">
                                  {isFillInType
                                    ? "Try again or move to the next question."
                                    : "View correct answers in the detailed report after completing the quiz."}
                                </p>
                              </div>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* AI evaluation in progress */}
                    {isAIGradableQuestion &&
                      !showFeedback &&
                      (pendingEvaluations.has(currentQuestion.id) || aiGradingStatus === "checking") && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-blue-50/80 dark:bg-blue-900/30 border border-blue-200/60 dark:border-blue-700/60 mb-4"
                      >
                        <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                          <div className="p-1.5 sm:p-2 bg-blue-100/80 dark:bg-blue-800/80 rounded-lg sm:rounded-xl shrink-0">
                            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-700 dark:text-blue-400 animate-spin" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs sm:text-sm md:text-base text-blue-900 dark:text-blue-100">
                              {isSolutionUploadEval ? "Evaluating your solution" : "Evaluating your code"}
                            </p>
                            <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 break-words">
                              Your answer has been saved. Evaluation is running in the background. You can continue to the next question.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* AI Grading Retry Button */}
                    {aiGradingFailed &&
                      failedQuestionData &&
                      failedQuestionData.questionId === currentQuestion.id &&
                      isAIGradableQuestion && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-amber-200/80 bg-amber-50 p-4 sm:rounded-2xl sm:p-6 dark:border-amber-500/45 dark:bg-amber-950/55"
                      >
                        <div className="flex items-start gap-2 sm:gap-3 md:gap-4">
                          <div className="shrink-0 rounded-lg bg-amber-100 p-1.5 sm:rounded-xl sm:p-2 dark:bg-amber-900/70">
                            <AlertCircle className="h-4 w-4 text-amber-800 sm:h-5 sm:w-5 dark:text-amber-200" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="mb-1 text-xs font-semibold text-amber-950 sm:mb-2 sm:text-sm md:text-base dark:text-amber-50">
                              System evaluation unavailable
                            </p>
                            <p className="mb-3 break-words text-xs text-amber-900/90 sm:mb-4 sm:text-sm dark:text-amber-100/90">
                              Your answer has been saved and will be manually reviewed. You can try system evaluation again if your connection improves.
                            </p>
                            <Button
                              onClick={retryAIGrading}
                              disabled={retryingSubmission}
                              className="gap-1.5 sm:gap-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
                            >
                              {retryingSubmission ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                                  <span className="hidden sm:inline">Retrying...</span>
                                  <span className="sm:hidden">Retrying</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  <span className="hidden sm:inline">Retry Evaluation</span>
                                  <span className="sm:hidden">Retry</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {!shouldLockQuestion && (
                      <div
                        className={cn(
                          "mt-4 flex items-center gap-2 border-t border-[var(--border)] pt-3",
                          isCompactObjectiveQuestion && "mx-auto max-w-2xl",
                        )}
                      >
                        <Button
                          variant="outline"
                          onClick={goToPreviousQuestion}
                          disabled={!allowBackNav || isSubmittingAnswer || isBlockedByFullscreen || isBlockedByLocation}
                          className="h-10 gap-1 rounded-lg border-[var(--border)] bg-[var(--card)] px-3 text-xs sm:h-11 sm:px-4 sm:text-sm"
                        >
                          <ChevronLeft className="h-4 w-4 shrink-0" />
                          <span className="hidden sm:inline">Previous</span>
                          <span className="sm:hidden">Prev</span>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={goToNextQuestion}
                          disabled={currentQuestionIndex === quiz.questions.length - 1 || isSubmittingAnswer || isLockedDueToViolations || isBlockedByFullscreen || isBlockedByLocation}
                          className="h-10 gap-1 rounded-lg border-[var(--border)] bg-[var(--card)] px-3 text-xs sm:h-11 sm:px-4 sm:text-sm"
                        >
                          <span className="hidden sm:inline">Next</span>
                          <span className="sm:hidden">Next</span>
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        </Button>
                        <Button
                          onClick={() => handleAnswerSubmit()}
                          disabled={isSubmittingAnswer || isBlockedByFullscreen || isBlockedByLocation}
                          className="ml-auto h-10 min-w-[7.5rem] rounded-full bg-[var(--cc-accent)] px-5 text-xs text-white shadow-sm transition-all hover:opacity-90 sm:h-11 sm:min-w-[9rem] sm:px-6 sm:text-sm"
                        >
                            {isSubmittingAnswer ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Submitting…</span>
                              </span>
                            ) : isAIGradableQuestion &&
                              aiGradedQuestionsSubmitted.has(currentQuestion.id) &&
                              allowsResubmitForBetterScore(questionType) ? (
                              <>
                                <span className="hidden md:inline">Resubmit for Better Score</span>
                                <span className="md:hidden">Resubmit</span>
                              </>
                            ) : (
                              <>
                                <span className="hidden md:inline">Submit Answer</span>
                                <span className="md:hidden">Submit</span>
                              </>
                            )}
                          </Button>
                        </div>
                    )}

                    {shouldLockQuestion && (
                      <div className="pt-4 sm:pt-6">
                        {/* Show different message for timeout vs already submitted */}
                        {isQuestionLocked && timerExpiredForQuestion.has(currentQuestion.id) && (
                          <div className="mb-4 sm:mb-6 flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50 p-3 sm:items-center sm:gap-3 sm:rounded-2xl sm:p-4 dark:border-amber-500/45 dark:bg-amber-950/55">
                            <div className="shrink-0 rounded-lg bg-amber-100 p-1.5 sm:rounded-xl sm:p-2 dark:bg-amber-900/70">
                              <Clock className="h-4 w-4 text-amber-800 sm:h-5 sm:w-5 dark:text-amber-200" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-amber-950 sm:text-sm md:text-base dark:text-amber-50">Time expired</p>
                              <p className="break-words text-xs text-amber-900/90 sm:text-sm dark:text-amber-100/90">
                                The time limit for this question has expired. Your answer has been saved. You can review the question but cannot change your answer.
                              </p>
                            </div>
                          </div>
                        )}
                        {isCircuitSubmissionQuestion && isQuestionLocked && !timerExpiredForQuestion.has(currentQuestion.id) && (
                          <div
                            className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-start sm:items-center gap-2 sm:gap-3 ${
                              circuitSubmissionProvisionalLocked
                                ? "bg-amber-50/80 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/60"
                                : "bg-emerald-50/80 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-700/60"
                            }`}
                          >
                            <div
                              className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0 ${
                                circuitSubmissionProvisionalLocked
                                  ? "bg-amber-100/80 dark:bg-amber-800/80"
                                  : "bg-emerald-100/80 dark:bg-emerald-800/80"
                              }`}
                            >
                              <Lock
                                className={`h-4 w-4 sm:h-5 sm:w-5 ${
                                  circuitSubmissionProvisionalLocked
                                    ? "text-amber-700 dark:text-amber-400"
                                    : "text-emerald-700 dark:text-emerald-400"
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`font-semibold text-xs sm:text-sm md:text-base ${
                                  circuitSubmissionProvisionalLocked
                                    ? "text-amber-900 dark:text-amber-200"
                                    : "text-emerald-900 dark:text-emerald-200"
                                }`}
                              >
                                {circuitSubmissionProvisionalLocked
                                  ? "Circuit submission recorded — awaiting instructor review"
                                  : "Circuit submission recorded"}
                              </p>
                              <p
                                className={`text-xs sm:text-sm break-words ${
                                  circuitSubmissionProvisionalLocked
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-emerald-700 dark:text-emerald-300"
                                }`}
                              >
                                {circuitSubmissionProvisionalLocked
                                  ? "Your solution was submitted. Any AI score below is a provisional preview, not your final grade. Your instructor will review your work and may adjust the score. You cannot revise or resubmit."
                                  : "Your solution was submitted and graded. This is a one-time submission — you can review feedback but cannot revise or resubmit."}
                              </p>
                              {hasStoredEvalFeedback && !showFeedback ? (
                                <Button
                                  type="button"
                                  variant="link"
                                  className="h-auto p-0 mt-1 text-xs text-emerald-800 dark:text-emerald-200 underline"
                                  onClick={() => applyEvalFeedbackForQuestion(currentQuestion.id)}
                                >
                                  View Quiz Master evaluation
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        )}
                        {isQuestionLocked && !timerExpiredForQuestion.has(currentQuestion.id) && !isCircuitSubmissionQuestion && !lockedObjectiveGrade && (
                          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50/80 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-700/60 flex items-start sm:items-center gap-2 sm:gap-3">
                            <div className="p-1.5 sm:p-2 bg-emerald-100/80 dark:bg-emerald-800/80 rounded-lg sm:rounded-xl shrink-0">
                              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-700 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-xs sm:text-sm md:text-base text-emerald-900 dark:text-emerald-200">✓ Answer Already Recorded</p>
                              <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 break-words">
                                Your answer was saved before the refresh or interruption. You can review it but cannot change it. Continue to the next question when ready.
                              </p>
                            </div>
                          </div>
                        )}
                        {isQuestionSubmitted && !isQuestionLocked && (
                          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-blue-50/80 dark:bg-blue-900/30 border border-blue-200/60 dark:border-blue-700/60 flex items-start sm:items-center gap-2 sm:gap-3">
                            <div className="p-1.5 sm:p-2 bg-blue-100/80 dark:bg-blue-800/80 rounded-lg sm:rounded-xl shrink-0">
                              <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-700 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-xs sm:text-sm md:text-base text-blue-900 dark:text-blue-200">Question Already Attempted</p>
                              <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 break-words">
                                You have already submitted an answer for this question. You can review it but cannot
                                make changes.
                              </p>
                            </div>
                          </div>
                        )}
                        <div
                          className={cn(
                            "grid grid-cols-2 gap-2 pt-2 md:flex md:gap-3",
                            isCompactObjectiveQuestion && "mx-auto max-w-2xl",
                          )}
                        >
                          <Button
                            variant="outline"
                            onClick={goToPreviousQuestion}
                            disabled={!allowBackNav}
                            className="h-10 gap-1 rounded-lg border-[var(--border)] bg-[var(--card)] px-3 text-xs sm:text-sm"
                          >
                            <ChevronLeft className="h-4 w-4 shrink-0" />
                            <span className="hidden sm:inline">Previous</span>
                            <span className="sm:hidden">Prev</span>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={goToNextQuestion}
                            disabled={currentQuestionIndex === quiz.questions.length - 1}
                            className="h-10 gap-1 rounded-lg border-[var(--border)] bg-[var(--card)] px-3 text-xs sm:text-sm"
                          >
                            <span className="hidden sm:inline">Next</span>
                            <span className="sm:hidden">Next</span>
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {currentQuestionIndex === quiz.questions.length - 1 && (
                      <div className="mt-4 sm:mt-6 p-4 sm:p-6 border border-purple-200/60 dark:border-purple-700/60 rounded-xl sm:rounded-2xl bg-purple-50/80 dark:bg-purple-900/30">
                        <p className="text-xs sm:text-sm text-purple-900 dark:text-purple-200 mb-3 sm:mb-4 break-words">
                          You&apos;re on the last question. Review your answers in the question list, then submit
                          when ready.
                        </p>
                        <Button
                          onClick={requestSubmitQuiz}
                          disabled={submitting}
                          className="w-full bg-purple-700 hover:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-700 rounded-full shadow-lg text-xs sm:text-sm md:text-base py-2 sm:py-2.5"
                        >
                          {submitting 
                            ? (isViolationSubmission 
                                ? (
                                  <>
                                    <span className="hidden sm:inline">🚨 Submitting Due to Violations...</span>
                                    <span className="sm:hidden">🚨 Submitting...</span>
                                  </>
                                )
                                : (
                                  <>
                                    <span className="hidden sm:inline">Submitting Quiz...</span>
                                    <span className="sm:hidden">Submitting</span>
                                  </>
                                )) 
                            : "Submit Quiz"}
                        </Button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>

          {/* CodeBench panel removed - compiler not yet implemented */}
        </div>
        </div>
        </div>

        {/* Question locked modal removed - questions lock silently without blocking navigation */}

        {showExitDialog && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-full max-w-md"
            >
              <Card className="rounded-xl sm:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60">
                <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-red-100/80 dark:bg-red-900/80 rounded-lg sm:rounded-xl">
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-700 dark:text-red-400" />
                    </div>
                    Exit Quiz?
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <p className="mb-4 sm:mb-6 text-sm sm:text-base text-slate-600 dark:text-slate-400">
                    Are you sure you want to exit? Your progress is saved automatically. If you refresh or close the tab by accident, you can return later to continue where you left off—attempted questions stay locked. Clicking Exit will submit your quiz.
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowExitDialog(false)}
                      className="rounded-lg sm:rounded-xl bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleExitQuiz}
                      className="rounded-lg sm:rounded-xl bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 shadow-lg transition-all px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Exit & Submit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {showContinueLaterWarningDialog && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-full max-w-md"
            >
              <Card className="rounded-xl sm:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-blue-200/60 dark:border-blue-800/60">
                <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-blue-100/80 dark:bg-blue-900/80 rounded-lg sm:rounded-xl">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-700 dark:text-blue-400" />
                    </div>
                    {getContinueLaterDialogTitle(quiz?.available_until)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <p className="mb-3 sm:mb-4 text-sm sm:text-base text-slate-600 dark:text-slate-400">
                    {continueLaterDialogCopy.lead}{" "}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {continueLaterDialogCopy.emphasis}
                    </strong>{" "}
                    {continueLaterDialogCopy.footer}
                  </p>
                  <p className="mb-4 sm:mb-6 text-xs sm:text-sm text-slate-500 dark:text-slate-500">
                    {quiz?.available_until
                      ? "You can return anytime before the due date to finish at your own pace."
                      : "Plan to come back soon so you don't lose control of your submission timing."}
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowContinueLaterWarningDialog(false)}
                      className="rounded-lg sm:rounded-xl bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Stay on quiz
                    </Button>
                    <Button
                      onClick={() => {
                        setShowContinueLaterWarningDialog(false)
                        void executeContinueLaterSaveAndLeave()
                      }}
                      className="rounded-lg sm:rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 shadow-lg transition-all px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      I understand — save & leave
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {showSubmitConfirmDialog && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-full max-w-md"
            >
              <Card className="rounded-xl sm:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60">
                <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-purple-100/80 dark:bg-purple-900/80 rounded-lg sm:rounded-xl">
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-purple-700 dark:text-purple-400" />
                    </div>
                    Submit Quiz?
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <p className="mb-4 sm:mb-6 text-sm sm:text-base text-slate-600 dark:text-slate-400">
                    Are you sure you want to submit your quiz? Once submitted, you won&apos;t be able to change your answers. Make sure you&apos;ve reviewed all questions, especially any code you&apos;ve written.
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowSubmitConfirmDialog(false)}
                      className="rounded-lg sm:rounded-xl bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Keep Reviewing
                    </Button>
                    <Button
                      onClick={() => {
                        setShowSubmitConfirmDialog(false)
                        handleSubmitQuiz()
                      }}
                      className="rounded-lg sm:rounded-xl bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 shadow-lg transition-all px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Yes, Submit Quiz
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {submitting && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 text-white"
            >
              <Loader2 className="h-12 w-12 sm:h-14 sm:w-14 animate-spin text-purple-400" />
              <p className="text-base sm:text-lg font-medium text-slate-100">
                Submitting your results...
              </p>
              <p className="text-sm text-slate-400">
                Please wait while we save your answers.
              </p>
            </motion.div>
          </div>
        )}

        {showSubmissionStalledModal && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-[70] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-full max-w-md"
            >
              <Card className="rounded-xl sm:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-amber-200/60 dark:border-amber-700/60">
                <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-amber-100/80 dark:bg-amber-900/80 rounded-lg sm:rounded-xl">
                      <TriangleAlert className="h-4 w-4 sm:h-5 sm:w-5 text-amber-700 dark:text-amber-400" />
                    </div>
                    Submission Issue
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <p className="mb-4 sm:mb-6 text-sm sm:text-base text-slate-600 dark:text-slate-400">
                    Your submission took longer than expected, likely due to a network issue. <strong>Your answers and score have been saved.</strong> This attempt has been flagged for your instructor. {submissionStalledFinalizeSucceeded ? "You can view your results or return to the dashboard." : "Your instructor has been notified and can verify your attempt. You can try finalizing again or leave—your work is preserved."}
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 justify-end">
                    {submissionStalledFinalizeSucceeded && (
                      <Button
                        onClick={() => {
                          setShowSubmissionStalledModal(false)
                          try {
                            sessionStorage.removeItem(`quiz_resume_${quizId}_${normalizedType}`)
                          } catch (_) {}
                          const reportPath = effectiveType === "practice"
                            ? `/student/practice/report/${attemptId}`
                            : effectiveType === "final"
                            ? `/student/results/${attemptId}`
                            : `/student/${effectiveType}/report/${attemptId}`
                          router.push(reportPath)
                        }}
                        className="rounded-lg sm:rounded-xl bg-teal-600 hover:bg-teal-700 shadow-lg transition-all px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                      >
                        View My Results
                      </Button>
                    )}
                    {!submissionStalledFinalizeSucceeded && (
                      <Button
                        onClick={async () => {
                          try {
                            const res = await studentApiFetch("/api/student/finalize-quiz", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", ...getStudentAuthHeaders() },
                              body: JSON.stringify({
                                attemptId,
                                quizId,
                                answers: stalledAnswersRef.current,
                                submissionStalled: true,
                              }),
                            })
                            if (res.ok) {
                              setSubmissionStalledFinalizeSucceeded(true)
                              setShowSubmissionStalledModal(false)
                              try {
                                sessionStorage.removeItem(`quiz_resume_${quizId}_${normalizedType}`)
                              } catch (_) {}
                              const reportPath = effectiveType === "practice"
                                ? `/student/practice/report/${attemptId}`
                                : effectiveType === "final"
                                ? `/student/results/${attemptId}`
                                : `/student/${effectiveType}/report/${attemptId}`
                              router.push(reportPath)
                            }
                          } catch (_) {}
                        }}
                        className="rounded-lg sm:rounded-xl bg-amber-600 hover:bg-amber-700 shadow-lg transition-all px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                      >
                        Finalize & View Results
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowSubmissionStalledModal(false)
                        try {
                          sessionStorage.removeItem(`quiz_resume_${quizId}_${normalizedType}`)
                        } catch (_) {}
                        const exitPath = effectiveType === "practice" ? getPracticePath() :
                          effectiveType === "mid_semester" ? getMidSemesterExamsPath() :
                          effectiveType === "final" ? getFinalExamsPath() :
                          effectiveType === "homework" ? getHomeworkPath() :
                          getDashboardPath()
                        router.push(exitPath)
                      }}
                      className="rounded-lg sm:rounded-xl border-slate-200 dark:border-slate-600 px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Go to Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {finalizationErrorModal && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-[70] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-full max-w-md"
            >
              <Card className="rounded-xl sm:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-amber-200/60 dark:border-amber-700/60">
                <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-amber-100/80 dark:bg-amber-900/80 rounded-lg sm:rounded-xl">
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-700 dark:text-amber-400" />
                    </div>
                    {finalizationErrorModal.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <p className="mb-4 sm:mb-6 text-sm sm:text-base text-slate-600 dark:text-slate-400">
                    {finalizationErrorModal.message}
                  </p>
                  <p className="mb-4 text-xs text-slate-500 dark:text-slate-500">
                    Your instructor has been notified and can help resolve this. Your work is saved.
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setFinalizationErrorModal(null)}
                      className="rounded-lg sm:rounded-xl border-slate-200 dark:border-slate-600 px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Try Again
                    </Button>
                    <Button
                      onClick={() => {
                        setFinalizationErrorModal(null)
                        try {
                          sessionStorage.removeItem(`quiz_resume_${quizId}_${normalizedType}`)
                        } catch (_) {}
                        const exitPath = effectiveType === "practice" ? getPracticePath() :
                          effectiveType === "mid_semester" ? getMidSemesterExamsPath() :
                          effectiveType === "final" ? getFinalExamsPath() :
                          effectiveType === "homework" ? getHomeworkPath() :
                          getDashboardPath()
                        router.push(exitPath)
                      }}
                      className="rounded-lg sm:rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700 shadow-lg transition-all px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Go to Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {showLogoutDialog && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-full max-w-md"
            >
              <Card className="rounded-xl sm:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60">
                <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-red-100/80 dark:bg-red-900/80 rounded-lg sm:rounded-xl">
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-700 dark:text-red-400" />
                    </div>
                    Logout?
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <p className="mb-4 sm:mb-6 text-sm sm:text-base text-slate-600 dark:text-slate-400">
                    Are you sure you want to logout? Your current progress will be saved and you can continue later.
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowLogoutDialog(false)}
                      className="rounded-lg sm:rounded-xl bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleLogout}
                      className="rounded-lg sm:rounded-xl bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 shadow-lg transition-all px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Logout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {skipSolutionUploadDialog && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-full max-w-lg"
            >
              <Card className="rounded-xl sm:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-indigo-200/60 dark:border-indigo-700/60">
                <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-indigo-900 dark:text-indigo-200 flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-indigo-100/80 dark:bg-indigo-900/80 rounded-lg sm:rounded-xl">
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-700 dark:text-indigo-400" />
                    </div>
                    <span className="text-sm sm:text-base md:text-lg">Continue without solution upload?</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <p className="mb-3 sm:mb-4 text-xs sm:text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium">
                    You have not uploaded a worked solution for this question.
                  </p>
                  <p className="mb-4 sm:mb-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
                    You can still submit your MCQ answers, but you will forfeit up to{" "}
                    <strong>{skipSolutionUploadDialog.uploadMaxPoints}</strong> instructor-graded upload
                    points. Upload your work first if you want those points reviewed.
                  </p>
                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setSkipSolutionUploadDialog(null)}
                      className="rounded-lg sm:rounded-xl px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Go back and upload
                    </Button>
                    <Button
                      onClick={skipSolutionUploadDialog.onConfirm}
                      className="rounded-lg sm:rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Submit without upload
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {showUnsavedAnswersDialog && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-full max-w-lg"
            >
              <Card className="rounded-xl sm:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-amber-200/60 dark:border-amber-700/60">
                <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                  <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-amber-900 dark:text-amber-200 flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-amber-100/80 dark:bg-amber-900/80 rounded-lg sm:rounded-xl">
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-700 dark:text-amber-400" />
                    </div>
                    <span className="text-sm sm:text-base md:text-lg">Unsaved Answers Detected</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <p className="mb-3 sm:mb-4 text-xs sm:text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium">
                    ⚠️ Some of your answers have not been saved to the database yet.
                  </p>
                  <p className="mb-3 sm:mb-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
                    You have {unsavedQuestionIds.length} answer(s) that were not successfully saved. Please go back and resubmit these answers before proceeding.
                  </p>
                  <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
                    <p className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
                      Questions with unsaved answers:
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {unsavedQuestionIds.map((qId) => {
                        const question = quiz?.questions.find((q) => q.id === qId)
                        const questionNum = quiz?.questions.findIndex((q) => q.id === qId) ?? -1
                        return (
                          <Button
                            key={qId}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (questionNum >= 0) {
                                goToQuestion(questionNum)
                                setShowUnsavedAnswersDialog(false)
                              }
                            }}
                            className="bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800 text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5"
                          >
                            Q{questionNum + 1}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                  <p className="mb-4 sm:mb-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
                    Click on a question number above to navigate to it and resubmit your answer. Make sure you see the "✅ Answer Saved" confirmation before proceeding.
                  </p>
                  <div className="flex items-center gap-2 sm:gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowUnsavedAnswersDialog(false)}
                      className="rounded-lg sm:rounded-xl bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all px-4 sm:px-6 py-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      Go Back
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
        </div>

        {coraDrawerOpen && currentQuestion && quiz && canAskCoraOnCurrentQuestion ? (
          <CoraAskDrawer
            variant="panel"
            open={coraDrawerOpen}
            onClose={() => setCoraDrawerOpen(false)}
            studentId={studentDatabaseIdForRenderer?.toString() ?? null}
            title="Ask Cora"
            subtitle={`${quiz.title} · Question ${currentQuestionIndex + 1}`}
            theme={isDark ? "dark" : "light"}
            problem={coraContextFromQuestion({
              source: "quiz",
              questionText: currentQuestion.question_text,
              title: `Question ${currentQuestionIndex + 1}`,
              questionType: currentQuestion.question_type,
              hint: hintTextByQuestionId[currentQuestion.id] ?? currentQuestion.hint ?? null,
              questionId: currentQuestion.id,
              bankQuestionId: currentQuestion.bank_question_id,
              quizId: quiz.id,
              attemptId: attemptId ?? undefined,
              studentDatabaseId: studentDatabaseIdForRenderer,
            })}
          />
        ) : null}
      </div>

      {/* Anti-Cheat Warning Modal - only show if anti-cheat is enabled */}
      {/* CRITICAL: Show warning when either showWarning is true OR when blocking (to prevent blank blur screen). */}
      {/* Never gate the blocking modal on trackGeminiWindow — if the quiz is blocked, the student */}
      {/* must always see the modal with its manual-dismiss button (no invisible lockouts). */}
      {antiCheatEnabled && (antiCheatState.showWarning || (isGeminiBlocking && quizStarted)) && (
      <AntiCheatWarning
        show={true}
        message={
          antiCheatState.warningMessage || 
          (isGeminiBlocking && !antiCheatState.showWarning
            ? `⚠️ Browser AI Tool Detected: A browser AI side-panel (like Gemini) has been detected. You have ${Math.max(0, antiCheatConfig.maxGeminiStrikes - antiCheatState.geminiStrikes)} strike${Math.max(0, antiCheatConfig.maxGeminiStrikes - antiCheatState.geminiStrikes) === 1 ? '' : 's'} remaining. Please close it immediately to continue the exam.`
            : antiCheatState.warningMessage || "⚠️ Browser AI Tool Detected")
        }
        type={(antiCheatState.warningType || (isGeminiBlocking ? "gemini_window" : undefined)) as "gemini_window" | "tab_switch" | "copy_paste" | undefined}
        onClose={closeWarning}
        violationCount={
          antiCheatState.warningType === "gemini_window" || isGeminiBlocking
            ? antiCheatState.geminiStrikes 
            : antiCheatState.warningType === "tab_switch"
            ? antiCheatState.tabSwitchCount
            : 0
        }
        maxViolations={
          antiCheatState.warningType === "gemini_window" || isGeminiBlocking
            ? antiCheatConfig.maxGeminiStrikes
            : antiCheatState.warningType === "tab_switch"
            ? antiCheatConfig.maxTabSwitches
            : 5
        }
        isBlocking={antiCheatState.warningType === "gemini_window" || (isGeminiBlocking && antiCheatState.warningType !== "tab_switch")}
        isCleared={!isGeminiBlocking && (antiCheatState.warningType === "gemini_window" || isGeminiBlocking) && !geminiCurrentlyDetected}
        onManualDismiss={
          antiCheatState.warningType === "gemini_window" || isGeminiBlocking
            ? handleManualGeminiDismiss
            : undefined
        }
      />
      )}

      {/* Fullscreen Requirement Modal - shows when fullscreen is required but not active (macOS) */}
      <FullscreenRequirement
        show={isBlockedByFullscreen}
      />

      {/* Location requirement - when geo is required and student is outside allowed area */}
      <LocationRequirement
        show={isBlockedByLocation && !!quiz?.geo_required}
        isVerifying={locationVerifying}
        error={locationError}
        onVerifyLocation={async () => {
          if (!quiz?.geo_required || quiz.geo_lat == null || quiz.geo_lng == null || !navigator.geolocation) return
          setLocationVerifying(true)
          setLocationError(null)
          const radiusM = Number(quiz.geo_radius_meters) || 100
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const dist = distanceMeters(quiz.geo_lat!, quiz.geo_lng!, pos.coords.latitude, pos.coords.longitude)
              if (dist > radiusM) {
                setIsBlockedByLocation(true)
                setLocationError(`You are approximately ${Math.round(dist)} m away. You must be within ${radiusM} m to continue.`)
              } else {
                setIsBlockedByLocation(false)
                setLocationError(null)
              }
              setLocationVerifying(false)
            },
            () => {
              setIsBlockedByLocation(true)
              setLocationError("Could not get your location. Enable location access and try again.")
              setLocationVerifying(false)
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
          )
        }}
      />

      {/* Save and Finish Later Upgrade Modal for Non-Explorer/Trailblazer */}
      <SaveAndFinishLaterUpgradeModal
        open={showSaveLaterUpgradeModal}
        onClose={() => setShowSaveLaterUpgradeModal(false)}
      />

      <WaterBreakDurationDialog
        open={showWaterBreakPicker}
        onOpenChange={setShowWaterBreakPicker}
        description="Step away and hydrate. Your quiz timer pauses until you resume."
        skipLabel="Cancel"
        onStart={handleStartWaterBreak}
      />
      {waterBreakActive && (
        <WaterBreakOverlay
          totalSeconds={waterBreakTotalSeconds}
          onResume={handleResumeFromWaterBreak}
          resumeLabel="Resume quiz"
          activeHint="Quiz timer paused — sip some water, stretch, breathe."
          completeHint="Ready to jump back in? Your quiz timer resumes when you continue."
          skipEarlyLabel="Skip break and resume"
        />
      )}

      </div>
    </div>
  )
}
