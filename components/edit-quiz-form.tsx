"use client"

import type React from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Trash2, ArrowLeft, GripVertical, Shield, AlertTriangle, TestTube, MessageSquare, Unlock, MapPin, Sparkles, RotateCcw, LayoutList, Zap, Scale, Clock } from "lucide-react"
import Link from "next/link"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { AddQuestionModal } from "@/components/add-question-modal"
import { convertBankQuestionToQuizQuestion } from "@/lib/quiz-bank-question-import"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import {
  facultyAssessmentsListPath,
  isFacultyInstructorPortalPath,
} from "@/lib/faculty-dashboard-path"
import { useAssessment } from "@/context/assessment-context"
import { ManageScoresPanel } from "@/components/manage-scores-panel"
import { ManageTimeSettingsPanel } from "@/components/manage-time-settings-panel"
import { InstructorQuizIssues } from "@/components/instructor-quiz-issues"
import { AttemptOverrideManager } from "@/components/attempt-override-manager"
import { ManageGeolocationPanel } from "@/components/manage-geolocation-panel"
import { ManageWhoCanAccessPanel } from "@/components/manage-who-can-access-panel"
import { ManagePlatformAccessPanel } from "@/components/manage-platform-access-panel"
import {
  DEFAULT_ASSESSMENT_PLATFORM_FLAGS,
  parseAssessmentPlatformOverride,
  type AssessmentPlatformFlags,
} from "@/lib/assessment-platform-access"
import { ManageRolloverPanel } from "@/components/manage-rollover-panel"
import { GrantRolloverToStudentPanel } from "@/components/grant-rollover-to-student-panel"
import { CourseAssessmentDefaultsBanner } from "@/components/instructor/CourseAssessmentDefaultsBanner"
import { EditAssessmentPageHeader } from "@/components/instructor/EditAssessmentPageHeader"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { Skeleton } from "@/components/ui/skeleton"
import { AM_PANEL, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/assessments/assessment-management-surface-classes"
import { parseAssessmentPolicy, type AssessmentPolicy } from "@/lib/assessment-policy-settings"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { isQuestionTypeExempt, isHomeworkAssessment, isStrictIntegrityAssessment } from "@/lib/antiCheatConfig"
import { AI_EVALUATION_MODES, getDefaultEvaluationMode, type AIEvaluationMode, type EvaluationModeConfig } from "@/lib/config/ai-evaluation-modes"
import {
  AssessmentAiModelPicker,
} from "@/components/assessment-ai-model-picker"
import {
  DEFAULT_OPUS_CONFIDENCE_THRESHOLD,
  parseAiModelByTask,
  parseAiModelPreset,
  type AiGradingTask,
  type AiModelPreset,
} from "@/lib/ai-model-catalog"
import { SectionConfigEditor } from "@/components/section-config-editor"
import {
  DEFAULT_FINAL_SECTION_CONFIG,
  DEFAULT_SECTION_CONFIG,
  assessmentUsesSectionWeightedGrade,
  type SectionConfig,
} from "@/lib/assessment-sections"
import {
  applyExamSharedTimerConfig,
  coerceExamWideSectionConfig,
  defaultExamWideTimerSeconds,
  getExamSharedTimerSeconds,
} from "@/lib/assessment-timer"
import { SUPERPOWER_IDS, SUPERPOWER_CONFIG, type SuperpowerId } from "@/lib/superpowers-constants"
import {
  AI_CODE_LANGUAGE_OPTIONS,
  QUESTION_TYPES_WITH_PER_QUESTION_AI_LANGUAGE,
  formatQuizDefaultLanguagesLabel,
  parseQuizAllowedLanguagesForEditor,
} from "@/lib/ai-code-languages"
import { getGradableSubquestions } from "@/lib/multi-part-question"
import { SuperpowersUsageTable } from "@/components/superpowers-usage-table"
import { normalizeAllowedStudentIds } from "@/lib/normalize-allowed-student-ids"
import { cn } from "@/lib/utils"
import { normalizeQuizQuestionCorrectAnswerForSave } from "@/lib/question-bank-normalize"
import { isCircuitQuestionType, parseCircuitSpec } from "@/lib/engineering-circuit-types"
import { CircuitQuestionEditor, readCircuitSpecFromQuestion } from "@/components/circuit-question-editor"
import { QuestionMediaPanel } from "@/components/question-media-panel"
import type { QuestionMedia } from "@/lib/question-media"
import { convertCentralDateTimeToUtcISO } from "@/lib/timezone"
import { formatInTimeZone } from "date-fns-tz"
import { CENTRAL_TIMEZONE, ensureUtcDate } from "@/lib/timezone"

interface Question {
  id?: number
  question_text: string
  time_limit?: number | null
  question_type?: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e?: string
  correct_answer: string
  max_points?: number | null
  points?: number | null
  anti_cheat_exempt?: boolean
  /** Per-question AI grading language; null = use quiz-level code_language */
  ai_code_language?: string | null
  circuit_spec?: Record<string, unknown> | null
  question_media?: QuestionMedia | Record<string, unknown> | null
  subquestions?: unknown
  solution_upload_config?: unknown
  bank_question_id?: number | null
}

const TEXT_ANSWER_QUESTION_TYPES = new Set([
  "fill_blank",
  "code_output",
  "trace_output",
  "trace_logic",
  "fill_code",
  "scenario_match",
  "debug_code",
  "code_explain",
  "code_reorder",
  "code_problem",
  "code_write",
  "code_write_plot",
  "code_debug",
])

/** Postgres/Neon JSON can surface booleans in a few shapes — keep Switch `checked` in sync with DB. */
function parseDbBool(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (value === false || value === 0) return false
  if (typeof value === "string") {
    const s = value.trim().toLowerCase()
    return s === "true" || s === "t" || s === "1" || s === "yes"
  }
  return false
}

/** DB `counts_toward_course_grade`: default on; only explicit false/0/"false" turns practice mode off for grading. */
function parseCountsTowardCourseGrade(value: unknown): boolean {
  if (value === false || value === 0) return false
  if (typeof value === "string" && value.trim().toLowerCase() === "false") return false
  return true
}

/** Replaces browser constraint validation (broken with required fields inside hidden tabs). */
function getEditQuizSaveValidationMessage(
  quizData: { title: string; coverage?: string },
  questions: Question[],
  assessmentType: string,
): string | null {
  if (!quizData.title?.trim()) {
    return "Please enter a title for this assessment."
  }
  if (
    (assessmentType === "mid_semester" || assessmentType === "final") &&
    !String(quizData.coverage ?? "").trim()
  ) {
    return "Please enter coverage (chapters/lectures) for this exam."
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const idx = i + 1
    if (!q.question_text?.trim()) {
      return `Question ${idx}: enter question text.`
    }
    const qt = (q.question_type || "mcq").toLowerCase()
    if (isCircuitQuestionType(qt)) {
      if (qt === "circuit_numeric") {
        const sp = parseCircuitSpec(q.circuit_spec)
        const exp =
          String(sp.expectedAnswer ?? "").trim() || String(q.correct_answer ?? "").trim()
        if (!exp) {
          return `Question ${idx}: circuit_numeric needs expectedAnswer (Engineering/Circuits panel or correct answer field).`
        }
      }
      if (qt === "circuit_fill_equation") {
        const sp = parseCircuitSpec(q.circuit_spec)
        if (!sp.equationExpected || Object.keys(sp.equationExpected).length === 0) {
          return `Question ${idx}: circuit_fill_equation needs equationExpected (slot map) in Engineering/Circuits panel.`
        }
      }
      if (qt === "circuit_multi_part") {
        const subs = parseCircuitSpec(q.circuit_spec).subQuestions ?? []
        if (!subs.length) {
          return `Question ${idx}: circuit_multi_part needs subQuestions configured in Engineering/Circuits panel.`
        }
      }
      continue
    }
    if (qt === "multi_part") {
      if (getGradableSubquestions(q.subquestions).length === 0) {
        return `Question ${idx}: multi_part needs at least one configured sub-question.`
      }
      continue
    }
    if (TEXT_ANSWER_QUESTION_TYPES.has(qt)) {
      if (!String(q.correct_answer ?? "").trim()) {
        return `Question ${idx}: enter the correct answer.`
      }
    } else {
      if (!String(q.option_a ?? "").trim() || !String(q.option_b ?? "").trim()) {
        return `Question ${idx}: options A and B are required.`
      }
      if (qt === "mcq" && (!String(q.option_c ?? "").trim() || !String(q.option_d ?? "").trim())) {
        return `Question ${idx}: options A–D are required for multiple choice.`
      }
      if (
        (qt === "select_all" || qt === "multi_output") &&
        !String(q.correct_answer ?? "").trim()
      ) {
        return `Question ${idx}: enter correct answers as a JSON array of option text.`
      }
    }
  }
  return null
}

function ResetAllRolloversButton({
  userType,
  onSuccess,
  onError,
}: {
  userType: string
  onSuccess: () => void
  onError: (message: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const runReset = async () => {
    setLoading(true)
    try {
      const url = userType === "instructor" ? "/api/instructor/rollover/reset-all" : "/api/admin/rollover/reset-all"
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (userType === "instructor") {
        const session = typeof localStorage !== "undefined" ? localStorage.getItem("instructorSession") : null
        const instructorId = typeof localStorage !== "undefined" ? localStorage.getItem("instructorId") : null
        if (session) headers["Authorization"] = session
        if (instructorId) headers["x-instructor-id"] = instructorId
      } else {
        const adminId = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("adminId") : null
        if (adminId) headers["x-admin-id"] = adminId
      }
      const res = await fetch(url, { method: "POST", headers })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onError(data?.error || "Reset failed")
        setOpen(false)
        return
      }
      setOpen(false)
      onSuccess()
    } catch (e) {
      onError(e instanceof Error ? e.message : "Reset failed")
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={loading}
        className="gap-2 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
      >
        <RotateCcw className="h-4 w-4" />
        {loading ? "Resetting…" : "Reset all rollovers"}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all rollovers?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all student rollover records. Students will be able to use their one-time extend again. Use this for testing only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                runReset()
              }}
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-500"
            >
              {loading ? "Resetting…" : "Reset all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function EditQuizForm({ 
  quizId, 
  assessmentType: propAssessmentType,
  embedInDashboard = false,
}: { 
  quizId: string
  assessmentType?: string
  embedInDashboard?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const assessmentContext = useAssessment()
  const isInstructorPath = isFacultyInstructorPortalPath(pathname)
  const userType = isInstructorPath ? "instructor" : "admin"
  const basePath = isInstructorPath ? "/faculty" : "/admin"
  
  // Get assessment type from prop, URL, or context (in priority order)
  // Normalize URL paths: 'final-exams' -> 'final', 'mid-semester-exams' -> 'mid_semester'
  // Handle dashboard-v2 path: /instructor/dashboard-v2/assessments/homework/[id]/edit
  const pathParts = pathname.split('/')
  const isDashboardV2 = pathParts.includes('dashboard-v2') && pathParts.includes('assessments')
  const urlAssessmentType = isDashboardV2
    ? (pathParts[pathParts.indexOf('assessments') + 1] || pathParts[2])
    : pathParts[2]
  const normalizedUrlType = urlAssessmentType === 'final-exams' || urlAssessmentType === 'finals' ? 'final' :
                            urlAssessmentType === 'mid-semester-exams' || urlAssessmentType === 'mid-semester' ? 'mid_semester' :
                            urlAssessmentType === 'homeworks' || urlAssessmentType === 'homework' ? 'homework' :
                            urlAssessmentType === 'quizzes' || urlAssessmentType === 'quiz' ? 'quiz' :
                            urlAssessmentType
  const assessmentType = propAssessmentType || normalizedUrlType || assessmentContext?.type || "quiz"
  const isSingleSittingExam = assessmentType === "mid_semester" || assessmentType === "final"
  const homeworkIntegrityExempt = isHomeworkAssessment(assessmentType)
  const strictIntegrityDefault = isStrictIntegrityAssessment(assessmentType)
  const assessmentLabel = assessmentContext?.label || (
    assessmentType === 'homework' ? 'Homework' :
    assessmentType === 'mid_semester' ? 'Mid-Semester Exam' :
    assessmentType === 'final' ? 'Final Exam' : 'Quiz'
  )
  const assessmentPluralLabel = assessmentContext?.pluralLabel || (
    assessmentType === 'homework' ? 'Homework Assignments' :
    assessmentType === 'mid_semester' ? 'Mid-Semester Exams' :
    assessmentType === 'final' ? 'Final Exams' : 'Quizzes'
  )

  const listPath = facultyAssessmentsListPath(pathname, assessmentType)

  const facultyModuleId =
    assessmentType === "homework"
      ? "homeworks"
      : assessmentType === "mid_semester"
        ? "mid-semester"
        : assessmentType === "final"
          ? "final-exams"
          : "quizzes"
  const embedChrome = embedInDashboard ? facultyEmbedChrome(facultyModuleId) : null
  const tabListClass = embedInDashboard
    ? "min-h-11 w-full flex flex-nowrap gap-1 justify-start overflow-x-auto rounded-xl border border-[var(--border)] !bg-[var(--card)] p-1 shadow-none"
    : "bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 p-1 rounded-xl min-h-11 w-full flex flex-nowrap gap-1 justify-start overflow-x-auto"
  const tabTriggerClass = embedInDashboard
    ? cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shrink-0 border border-transparent shadow-none",
        "text-[var(--cc-text-secondary)] hover:bg-[var(--muted)]/40 hover:text-[var(--cc-text)]",
        "data-[state=active]:border-[var(--cc-accent)]/30 data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:!text-white data-[state=active]:shadow-sm",
      )
    : "flex items-center gap-2 px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 rounded-lg transition-all text-sm font-medium shrink-0"
  const subTabListClass = embedInDashboard
    ? "grid w-full grid-cols-2 mb-6 !bg-[var(--card)] border border-[var(--border)] rounded-xl p-1 shadow-none"
    : "grid w-full grid-cols-2 mb-6"
  const eCard =
    embedInDashboard && embedChrome
      ? embedChrome.card
      : "border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl overflow-hidden"
  const eCardHeader = embedInDashboard
    ? "border-b border-[var(--border)] py-4"
    : "bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 py-4"
  const eTitle = embedInDashboard
    ? cn("text-base font-semibold", PORTAL_TEXT)
    : "text-base font-semibold text-slate-900 dark:text-slate-100"
  const eMuted = embedInDashboard
    ? cn("text-sm", PORTAL_TEXT_MUTED, "mt-0.5")
    : "text-sm text-slate-500 dark:text-slate-400 mt-0.5"
  const eLabel = embedInDashboard
    ? cn("text-sm font-medium", PORTAL_TEXT)
    : "text-sm font-medium text-slate-700 dark:text-slate-300"
  const eInput = embedInDashboard
    ? "h-11 rounded-lg border-[var(--border)] bg-[var(--card)] focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/25 focus-visible:border-[var(--cc-accent)] transition-colors"
    : "h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
  const eTextarea = embedInDashboard
    ? "rounded-lg border-[var(--border)] bg-[var(--card)] focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]/25 focus-visible:border-[var(--cc-accent)] transition-colors min-h-[100px] resize-none"
    : "rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors min-h-[100px] resize-none"
  const eHint = embedInDashboard
    ? cn("text-xs", PORTAL_TEXT_MUTED)
    : "text-xs text-slate-500 dark:text-slate-400"
  const eSwitchRow = embedInDashboard
    ? "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border border-[var(--border)] bg-muted/30 px-4 py-3"
    : "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/40 px-4 py-3"
  const eSwitchLabel = embedInDashboard
    ? cn("text-sm font-medium", PORTAL_TEXT)
    : "text-sm font-medium text-slate-800 dark:text-slate-200"
  const eStickyBar =
    embedInDashboard && embedChrome
      ? cn(embedChrome.card, "sticky bottom-4 z-30 shadow-lg")
      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg rounded-xl sticky bottom-4 z-30"

  usePreventBack(isInstructorPath ? "/faculty/login" : "/admin/login")
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [courseAssessmentPolicy, setCourseAssessmentPolicy] = useState<AssessmentPolicy | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState("details")
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false)
  const [deleteQuestionIndex, setDeleteQuestionIndex] = useState<number | null>(null)
  const [quizData, setQuizData] = useState({
    title: "",
    description: "",
    coverage: "",
    time_per_question: 60,
    is_active: false,
    available_from: "",
    available_until: "",
    retake_enabled: false,
    retake_limit: 0,
    retake_policy: "best",
    review_before_retake: false,
    forfeit_retake_on_report_view: true,
    lock_student_results_review: false,
    // Quizzes, mid-semesters, and finals start in Strict Mode. Homework is exempt.
    strict_mode_enabled: strictIntegrityDefault,
    block_copy_paste: strictIntegrityDefault,
    track_tab_switches: strictIntegrityDefault,
    track_mouse_movement: assessmentType === 'final',
    warn_on_tab_switch: strictIntegrityDefault,
    max_tab_switches: 5,
    auto_submit_on_violations: strictIntegrityDefault,
    track_gemini_window: strictIntegrityDefault,
    max_gemini_strikes: 5,
    keystroke_playback_enforced: true,
    require_fullscreen: strictIntegrityDefault,
    beta_only: false,
    max_concurrent_students: null, // NULL means unlimited
    geo_required: false,
    geo_lat: null as number | null,
    geo_lng: null as number | null,
    geo_radius_meters: 100,
    rollover_enabled: false,
    rollover_hours: 1,
    ai_evaluation_mode: getDefaultEvaluationMode(assessmentType),
    ai_model: "auto" as AiModelPreset,
    ai_model_by_task: null as Partial<Record<AiGradingTask, AiModelPreset>> | null,
    ai_enable_opus_fallback: false,
    ai_opus_confidence_threshold: DEFAULT_OPUS_CONFIDENCE_THRESHOLD,
    code_language: "cpp" as string,
    allowed_ai_code_languages: ["cpp"] as string[],
    section_config: [] as SectionConfig[],
    enable_superpowers: assessmentType === "quiz" || assessmentType === "homework",
    allowed_superpowers: ["copy_paste", "disable_tab_tracking", "disable_ai_detection", "increase_strikes", "extra_retake", "extra_time"] as SuperpowerId[],
    restrict_access_to_students: assessmentType === 'final',
    allowed_student_ids: [] as number[],
    access_restriction_session_id: null as number | null,
    inherit_platform_access: true,
    platform_access: { ...DEFAULT_ASSESSMENT_PLATFORM_FLAGS } as AssessmentPlatformFlags,
    counts_toward_course_grade: true,
  })
  const [questions, setQuestions] = useState<Question[]>([])
  const [sendNotifications, setSendNotifications] = useState(true)
  const quizDataRef = useRef(quizData)
  const questionsRef = useRef(questions)
  const sendNotificationsRef = useRef(sendNotifications)
  quizDataRef.current = quizData
  questionsRef.current = questions
  sendNotificationsRef.current = sendNotifications

  useEffect(() => {
    // Check for both admin and instructor authentication
    const adminId = sessionStorage.getItem("adminId")
    const instructorSession = localStorage.getItem("instructorSession")
    
    if (!adminId && !instructorSession) {
      router.push(`${basePath}/login`)
      return
    }

    fetchQuiz()
    if (isInstructorPath) {
      void fetchCourseAssessmentPolicy()
    }
  }, [quizId, router, basePath, isInstructorPath])

  const fetchCourseAssessmentPolicy = async () => {
    try {
      const res = await instructorApiFetch("/api/instructor/courses/policies", {
        headers: buildInstructorApiHeaders(),
      })
      if (!res.ok) return
      const data = await res.json()
      setCourseAssessmentPolicy(parseAssessmentPolicy(data.assessment_policy))
    } catch {
      // Non-blocking — editor still works without course defaults banner
    }
  }

  const fetchQuiz = async () => {
    try {
      const apiUrl = `/api/${userType}/quizzes/${quizId}`
      const response = await fetch(
        apiUrl,
        isInstructorPath ? { headers: buildInstructorApiHeaders() } : undefined,
      )
      
      if (!response.ok) {
        let errorMsg = `Failed to fetch quiz (${response.status})`
        try {
          const errorData = await response.json()
          errorMsg = errorData.error || errorMsg
        } catch (e) {
          // Error response couldn't be parsed
        }
        throw new Error(errorMsg)
      }
      
      const data = await response.json()

      const formatDateTimeLocal = (dateString: string | null) => {
        if (!dateString) return ""
        return formatInTimeZone(ensureUtcDate(dateString), CENTRAL_TIMEZONE, "yyyy-MM-dd'T'HH:mm")
      }

      // Handle both admin and instructor API response formats
      const quizData = data.quiz || data
      const questionsData = data.quiz?.questions || data.questions || []

      if (!quizData || !quizData.title) {
        console.error("[Edit Quiz Form] Invalid quiz data structure:", data)
        throw new Error("Invalid quiz data received from API")
      }

      setQuizData({
        title: quizData.title,
        description: quizData.description,
        coverage: quizData.coverage || "",
        time_per_question: quizData.time_per_question,
        is_active: quizData.is_active,
        available_from: formatDateTimeLocal(quizData.available_from),
        available_until: formatDateTimeLocal(quizData.available_until),
        retake_enabled: parseDbBool(quizData.retake_enabled),
        retake_limit: quizData.retake_limit ?? 0,
        retake_policy: quizData.retake_policy || "best",
        review_before_retake: parseDbBool(quizData.review_before_retake),
        forfeit_retake_on_report_view: quizData.forfeit_retake_on_report_view ?? true,
        lock_student_results_review: parseDbBool(quizData.lock_student_results_review),
        // Quizzes / mid-semesters / finals default to Strict Mode when the row is unset.
        strict_mode_enabled: quizData.strict_mode_enabled ?? strictIntegrityDefault,
        block_copy_paste: quizData.block_copy_paste ?? strictIntegrityDefault,
        track_tab_switches: quizData.track_tab_switches ?? strictIntegrityDefault,
        track_mouse_movement: quizData.track_mouse_movement ?? (assessmentType === 'final'),
        warn_on_tab_switch: quizData.warn_on_tab_switch ?? strictIntegrityDefault,
        max_tab_switches: quizData.max_tab_switches || 5,
        auto_submit_on_violations: quizData.auto_submit_on_violations ?? strictIntegrityDefault,
        track_gemini_window: quizData.track_gemini_window ?? strictIntegrityDefault,
        max_gemini_strikes: quizData.max_gemini_strikes || 5,
        keystroke_playback_enforced: parseDbBool(
          (quizData as { keystroke_playback_enforced?: unknown }).keystroke_playback_enforced,
        ),
        require_fullscreen: quizData.require_fullscreen ?? strictIntegrityDefault,
        beta_only: Boolean(quizData.beta_only), // Explicitly convert to boolean (handles null, undefined, 0, 1, etc.)
        max_concurrent_students: quizData.max_concurrent_students ?? null,
        geo_required: Boolean(quizData.geo_required),
        geo_lat: quizData.geo_lat ?? null,
        geo_lng: quizData.geo_lng ?? null,
        geo_radius_meters: quizData.geo_radius_meters ?? 100,
        rollover_enabled: Boolean(quizData.rollover_enabled),
        rollover_hours: Math.max(1, Math.min(72, Number(quizData.rollover_hours) || 1)),
        ai_evaluation_mode: (quizData.ai_evaluation_mode || getDefaultEvaluationMode(assessmentType)) as AIEvaluationMode,
        ai_model: parseAiModelPreset((quizData as { ai_model?: string }).ai_model, "auto"),
        ai_model_by_task: parseAiModelByTask((quizData as { ai_model_by_task?: unknown }).ai_model_by_task),
        ai_enable_opus_fallback: Boolean((quizData as { ai_enable_opus_fallback?: boolean }).ai_enable_opus_fallback),
        ai_opus_confidence_threshold: Number(
          (quizData as { ai_opus_confidence_threshold?: number }).ai_opus_confidence_threshold,
        ) || DEFAULT_OPUS_CONFIDENCE_THRESHOLD,
        code_language: (quizData.code_language || "") as string,
        allowed_ai_code_languages: parseQuizAllowedLanguagesForEditor(
          (quizData as { allowed_ai_code_languages?: unknown }).allowed_ai_code_languages,
          quizData.code_language,
        ),
        section_config: Array.isArray(quizData.section_config) && (quizData.section_config as SectionConfig[]).length > 0
          ? (quizData.section_config as SectionConfig[])
          : [],
        enable_superpowers:
          (assessmentType === "quiz" ||
            assessmentType === "homework" ||
            assessmentType === "mid_semester") &&
          Boolean(
            quizData.enable_superpowers ??
              (assessmentType === "quiz" || assessmentType === "homework"),
          ),
        allowed_superpowers:
          assessmentType === "quiz" ||
          assessmentType === "homework" ||
          assessmentType === "mid_semester"
            ? Array.isArray(quizData.allowed_superpowers)
              ? (quizData.allowed_superpowers as SuperpowerId[]).filter((s) => SUPERPOWER_IDS.includes(s) && s !== "none")
              : ["copy_paste", "disable_tab_tracking", "disable_ai_detection", "increase_strikes", "extra_retake", "extra_time"]
            : [],
        restrict_access_to_students: Boolean(quizData.restrict_access_to_students),
        allowed_student_ids: normalizeAllowedStudentIds(quizData.allowed_student_ids),
        access_restriction_session_id: quizData.access_restriction_session_id ?? null,
        inherit_platform_access:
          parseAssessmentPlatformOverride(
            (quizData as { platform_access?: unknown }).platform_access,
          ) == null,
        platform_access:
          parseAssessmentPlatformOverride(
            (quizData as { platform_access?: unknown }).platform_access,
          ) ?? { ...DEFAULT_ASSESSMENT_PLATFORM_FLAGS },
        counts_toward_course_grade: parseCountsTowardCourseGrade(
          (quizData as { counts_toward_course_grade?: unknown }).counts_toward_course_grade,
        ),
      } as Parameters<typeof setQuizData>[0])

      const processedQuestions = questionsData.map((q: Question) => {
        let correctAnswerLetter = q.correct_answer

        // Trim whitespace from correct_answer
        if (correctAnswerLetter) {
          correctAnswerLetter = correctAnswerLetter.trim()
        }

        const questionType = q.question_type?.toLowerCase() || "mcq"
        const isTextInput = [
          "fill_blank",
          "code_output",
          "trace_output",
          "trace_logic",
          "fill_code",
          "scenario_match",
          "debug_code",
          "code_explain",
          "code_reorder",
          "code_problem",
          "code_write",
          "code_write_plot",
          "code_debug",
        ].includes(questionType)

        if (questionType === "select_all" || questionType === "multi_output") {
          // CRITICAL: For select_all, correct_answer should be stored as JSON array of option TEXT
          // (e.g., ["return 5.2;", "return 10;"]), not letters
          // The evaluation system handles both formats, but TEXT is preferred
          try {
            const parsed = JSON.parse(correctAnswerLetter)
            if (Array.isArray(parsed)) {
              // Check if it's an array of letters - convert to option text
              const allLetters = parsed.every((ans: string) => {
                const normalized = String(ans).trim().toUpperCase()
                return ['A', 'B', 'C', 'D', 'E'].includes(normalized)
              })
              
              if (allLetters) {
                return {
                  ...q,
                  anti_cheat_exempt: q.anti_cheat_exempt ?? false,
                  option_a: (q.option_a ?? "") || "",
                  option_b: (q.option_b ?? "") || "",
                  option_c: (q.option_c ?? "") || "",
                  option_d: (q.option_d ?? "") || "",
                  option_e: (q.option_e ?? "") || "",
                  correct_answer: correctAnswerLetter,
                  max_points: q.max_points || q.points || null,
                  points: q.points || q.max_points || null,
                }
              } else {
                // Already an array of option text, keep as-is
                return {
                  ...q,
                  anti_cheat_exempt: q.anti_cheat_exempt ?? false,
                  option_a: (q.option_a ?? "") || "",
                  option_b: (q.option_b ?? "") || "",
                  option_c: (q.option_c ?? "") || "",
                  option_d: (q.option_d ?? "") || "",
                  option_e: (q.option_e ?? "") || "",
                  correct_answer: correctAnswerLetter,
                  max_points: q.max_points || q.points || null,
                  points: q.points || q.max_points || null,
                }
              }
            }
          } catch {
            // Not valid JSON, might be a single letter or text - handle accordingly
            const upperLetter = String(correctAnswerLetter).trim().toUpperCase()
            if (["A", "B", "C", "D", "E"].includes(upperLetter)) {
              // Single letter - convert to option text array
              let optionText = ""
              if (upperLetter === 'A') optionText = q.option_a || ""
              else if (upperLetter === 'B') optionText = q.option_b || ""
              else if (upperLetter === 'C') optionText = q.option_c || ""
              else if (upperLetter === 'D') optionText = q.option_d || ""
              else if (upperLetter === 'E') optionText = q.option_e || ""
              
              return {
                ...q,
                anti_cheat_exempt: q.anti_cheat_exempt ?? false,
                option_a: (q.option_a ?? "") || "",
                option_b: (q.option_b ?? "") || "",
                option_c: (q.option_c ?? "") || "",
                option_d: (q.option_d ?? "") || "",
                option_e: (q.option_e ?? "") || "",
                correct_answer: JSON.stringify([optionText].filter(Boolean)),
                max_points: q.max_points || q.points || null,
                points: q.points || q.max_points || null,
              }
            }
          }
        }

        // For text input questions, keep the correct_answer as-is (don't convert to letter)
        if (isTextInput) {
          return {
            ...q,
            anti_cheat_exempt: q.anti_cheat_exempt ?? false,
            option_a: (q.option_a ?? "") || "",
            option_b: (q.option_b ?? "") || "",
            option_c: (q.option_c ?? "") || "",
            option_d: (q.option_d ?? "") || "",
            option_e: (q.option_e ?? "") || "",
            correct_answer: correctAnswerLetter,
            max_points: q.max_points || q.points || null,
            points: q.points || q.max_points || null,
          }
        }

        // If correct_answer is already a letter (A, B, C, D, E), use it directly
        if (["A", "B", "C", "D", "E"].includes(correctAnswerLetter)) {
          return {
            ...q,
            anti_cheat_exempt: q.anti_cheat_exempt ?? false,
            option_a: (q.option_a ?? "") || "",
            option_b: (q.option_b ?? "") || "",
            option_c: (q.option_c ?? "") || "",
            option_d: (q.option_d ?? "") || "",
            option_e: (q.option_e ?? "") || "",
            correct_answer: correctAnswerLetter,
            max_points: q.max_points || q.points || null,
            points: q.points || q.max_points || null,
          }
        }

        // Otherwise, find which option matches the correct_answer text
        if (correctAnswerLetter === q.option_a) correctAnswerLetter = "A"
        else if (correctAnswerLetter === q.option_b) correctAnswerLetter = "B"
        else if (correctAnswerLetter === q.option_c) correctAnswerLetter = "C"
        else if (correctAnswerLetter === q.option_d) correctAnswerLetter = "D"
        else if (correctAnswerLetter === q.option_e) correctAnswerLetter = "E"
        else {
          console.warn(
            `[v0] Could not match correct_answer "${correctAnswerLetter}" to any option for question ${q.id}`,
          )
          correctAnswerLetter = "A" // Default to A if no match found
        }

        return {
          ...q,
          anti_cheat_exempt: q.anti_cheat_exempt ?? false,
          option_a: (q.option_a ?? "") || "",
          option_b: (q.option_b ?? "") || "",
          option_c: (q.option_c ?? "") || "",
          option_d: (q.option_d ?? "") || "",
          option_e: (q.option_e ?? "") || "",
          correct_answer: correctAnswerLetter,
          max_points: q.max_points || q.points || null,
          points: q.points || q.max_points || null,
        }
      })
      
      setQuestions(processedQuestions)
    } catch (error: any) {
      console.error("[Edit Quiz Form] Error fetching quiz:", error)
      toast({
        title: "Failed to load quiz",
        description: error.message || "An error occurred while loading the quiz.",
        variant: "destructive",
      })
      router.push(listPath)
    } finally {
      setLoading(false)
    }
  }

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: "",
        time_limit: null,
        question_type: "mcq",
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        option_e: "",
        correct_answer: "A",
        anti_cheat_exempt: false,
        ai_code_language: null,
        circuit_spec: null,
        question_media: null,
      },
    ])
  }

  const requestRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      toast({
        title: "Cannot remove question",
        description: "A quiz must have at least one question.",
        variant: "destructive",
      })
      return
    }
    setDeleteQuestionIndex(index)
  }

  const confirmRemoveQuestion = () => {
    if (deleteQuestionIndex == null) return
    const index = deleteQuestionIndex
    setDeleteQuestionIndex(null)
    if (questionsRef.current.length <= 1) return
    setQuestions((prev) => {
      const next = prev.filter((_, i) => i !== index)
      questionsRef.current = next
      return next
    })
  }

  const updateQuestion = (
    index: number,
    field: keyof Question,
    value: string | number | boolean | null | Record<string, unknown>,
  ) => {
    const updated = [...questions]
    if (
      field === "option_a" ||
      field === "option_b" ||
      field === "option_c" ||
      field === "option_d" ||
      field === "option_e" ||
      field === "question_text" ||
      field === "correct_answer"
    ) {
      updated[index] = { ...updated[index], [field]: value ?? "" }
    } else if (field === "anti_cheat_exempt") {
      // Handle boolean values
      updated[index] = { ...updated[index], [field]: value === true }
    } else if (field === "ai_code_language") {
      const raw = typeof value === "string" ? value.trim() : ""
      updated[index] = {
        ...updated[index],
        ai_code_language: raw === "" || raw === "__quiz_default__" ? null : raw,
      }
    } else if (field === "circuit_spec") {
      updated[index] = {
        ...updated[index],
        circuit_spec:
          value && typeof value === "object" ? (value as Record<string, unknown>) : null,
      }
    } else if (field === "question_media") {
      updated[index] = {
        ...updated[index],
        question_media:
          value && typeof value === "object" ? (value as QuestionMedia) : null,
      }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setQuestions(updated)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newQuestions = [...questions]
    const draggedQuestion = newQuestions[draggedIndex]
    newQuestions.splice(draggedIndex, 1)
    newQuestions.splice(index, 0, draggedQuestion)

    setQuestions(newQuestions)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const persistQuiz = useCallback(
    async (opts: { notify?: boolean; navigate?: boolean; silent?: boolean } = {}) => {
      const silent = opts.silent === true
      const navigate = opts.navigate === true
      const notify = opts.notify === true
      const quizDataNow = quizDataRef.current
      const questionsNow = questionsRef.current

      if (savingRef.current) return false

      const basicError = getEditQuizSaveValidationMessage(quizDataNow, questionsNow, assessmentType)
      if (basicError) {
        if (!silent) {
          toast({
            title: "Fix required fields",
            description: basicError,
            variant: "destructive",
          })
        }
        return false
      }

      if (Array.isArray(quizDataNow.section_config) && quizDataNow.section_config.length > 0) {
        const totalWeight = quizDataNow.section_config.reduce(
          (s, x) => s + (Number(x.weight_percent) || 0),
          0,
        )
        if (Math.abs(totalWeight - 100) >= 0.01) {
          if (!silent) {
            toast({
              title: "Invalid Section Weights",
              description: `Section weights must sum to 100%. Current total: ${totalWeight}%. Open the Sections tab and adjust weights.`,
              variant: "destructive",
            })
          }
          return false
        }
      }

      if (
        assessmentType === "final" &&
        !assessmentUsesSectionWeightedGrade(assessmentType, quizDataNow.section_config)
      ) {
        const totalPoints = questionsNow.reduce(
          (sum, q) => sum + Number(q.max_points ?? q.points ?? 1),
          0,
        )
        if (totalPoints !== 100) {
          if (!silent) {
            toast({
              title: "Invalid Point Allocation",
              description: `This final is not using section weights (or weights do not total 100%). In that mode, question points must sum to 100. Current total: ${totalPoints}.`,
              variant: "destructive",
            })
          }
          return false
        }
      }

      savingRef.current = true
      setSaving(true)

      try {
        const questionsToSave = questionsNow.map((q) => ({
          ...q,
          correct_answer: normalizeQuizQuestionCorrectAnswerForSave(q),
          anti_cheat_exempt: q.anti_cheat_exempt ?? false,
          max_points: q.max_points || q.points || null,
          points: q.points || q.max_points || 1,
        }))

        const convertToUTC = (dateTimeLocal: string) => {
          if (!dateTimeLocal) return null
          const [date, time] = dateTimeLocal.split("T")
          return convertCentralDateTimeToUtcISO(date, time)
        }

        const updatePayload = {
          title: quizDataNow.title,
          description: quizDataNow.description || null,
          coverage: quizDataNow.coverage || null,
          time_per_question: quizDataNow.time_per_question,
          available_from: convertToUTC(quizDataNow.available_from),
          available_until: convertToUTC(quizDataNow.available_until),
          questions: questionsToSave,
          sendNotifications: notify,
          retake_enabled: quizDataNow.retake_enabled,
          retake_limit: quizDataNow.retake_limit,
          retake_policy: quizDataNow.retake_policy,
          review_before_retake: quizDataNow.review_before_retake,
          forfeit_retake_on_report_view: quizDataNow.forfeit_retake_on_report_view ?? true,
          lock_student_results_review: quizDataNow.lock_student_results_review,
          strict_mode_enabled: homeworkIntegrityExempt ? false : quizDataNow.strict_mode_enabled,
          block_copy_paste: homeworkIntegrityExempt ? false : quizDataNow.block_copy_paste,
          track_tab_switches: homeworkIntegrityExempt ? false : quizDataNow.track_tab_switches,
          track_mouse_movement: quizDataNow.track_mouse_movement,
          warn_on_tab_switch: homeworkIntegrityExempt ? false : quizDataNow.warn_on_tab_switch,
          max_tab_switches: quizDataNow.max_tab_switches,
          auto_submit_on_violations: homeworkIntegrityExempt ? false : quizDataNow.auto_submit_on_violations,
          track_gemini_window: homeworkIntegrityExempt ? false : quizDataNow.track_gemini_window,
          max_gemini_strikes: quizDataNow.max_gemini_strikes,
          keystroke_playback_enforced: quizDataNow.keystroke_playback_enforced ?? true,
          require_fullscreen: homeworkIntegrityExempt ? false : (quizDataNow.require_fullscreen ?? false),
          beta_only: quizDataNow.beta_only,
          max_concurrent_students: quizDataNow.max_concurrent_students,
          geo_required: quizDataNow.geo_required,
          geo_lat: quizDataNow.geo_lat,
          geo_lng: quizDataNow.geo_lng,
          geo_radius_meters: quizDataNow.geo_radius_meters ?? 100,
          rollover_enabled: quizDataNow.rollover_enabled,
          rollover_hours: Math.max(1, Math.min(72, quizDataNow.rollover_hours || 1)),
          ai_evaluation_mode: quizDataNow.ai_evaluation_mode || getDefaultEvaluationMode(assessmentType),
          ai_model: quizDataNow.ai_model || "auto",
          ai_model_by_task: quizDataNow.ai_model_by_task,
          ai_enable_opus_fallback: quizDataNow.ai_enable_opus_fallback,
          ai_opus_confidence_threshold: quizDataNow.ai_opus_confidence_threshold,
          code_language:
            quizDataNow.allowed_ai_code_languages?.length > 0
              ? quizDataNow.allowed_ai_code_languages[0]
              : "",
          allowed_ai_code_languages: quizDataNow.allowed_ai_code_languages ?? [],
          section_config:
            Array.isArray(quizDataNow.section_config) &&
            quizDataNow.section_config.length > 0 &&
            Math.abs(
              quizDataNow.section_config.reduce((s, x) => s + (Number(x.weight_percent) || 0), 0) - 100,
            ) < 0.01
              ? coerceExamWideSectionConfig(quizDataNow.section_config, assessmentType)
              : null,
          enable_superpowers: Boolean(quizDataNow.enable_superpowers),
          allowed_superpowers:
            quizDataNow.enable_superpowers && Array.isArray(quizDataNow.allowed_superpowers)
              ? quizDataNow.allowed_superpowers
              : null,
          restrict_access_to_students: Boolean(quizDataNow.restrict_access_to_students),
          allowed_student_ids: quizDataNow.restrict_access_to_students
            ? normalizeAllowedStudentIds(quizDataNow.allowed_student_ids)
            : null,
          // Session + roster are optional while drafting — empty allowed_student_ids is valid until exam day.
          access_restriction_session_id: quizDataNow.access_restriction_session_id ?? null,
          platform_access: quizDataNow.inherit_platform_access ? null : quizDataNow.platform_access,
          counts_toward_course_grade: quizDataNow.counts_toward_course_grade !== false,
          ...(isSingleSittingExam ? { retake_enabled: false, retake_limit: 0, rollover_enabled: false } : {}),
          ...(assessmentType === "final"
            ? {
                rollover_enabled: false,
                enable_superpowers: false,
                allowed_superpowers: null,
              }
            : {}),
        }

        const response = await fetch(`/api/${userType}/quizzes/${quizId}/update`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(isInstructorPath ? buildInstructorApiHeaders() : {}),
          },
          body: JSON.stringify(updatePayload),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const message =
            errorData.code === "QUIZ_HAS_ATTEMPTS"
              ? errorData.message ||
                "This quiz has student attempts. Clone the quiz to change questions, or edit questions in place."
              : errorData.error || errorData.message || `Failed to update quiz (${response.status})`
          throw new Error(message)
        }

        const data = await response.json().catch(() => ({}))
        if (Array.isArray(data.syncedQuestions) && data.syncedQuestions.length > 0) {
          setQuestions((prev) => {
            const next = prev.map((q, i) => {
              const synced = data.syncedQuestions[i] as { id?: number } | undefined
              return synced?.id ? { ...q, id: Number(synced.id) } : q
            })
            questionsRef.current = next
            return next
          })
        }

        if (!silent) {
          toast({
            title: "Success!",
            description:
              data.message ||
              (data.insertedCount > 0
                ? `Added ${data.insertedCount} question(s). ${assessmentLabel} updated successfully.`
                : `${assessmentLabel} updated successfully.`),
          })
        }
        if (navigate) router.push(listPath)
        return true
      } catch (error: any) {
        console.error("[Edit Quiz Form] Error:", error)
        if (!silent) {
          toast({
            title: "Error",
            description: error.message || "Failed to update quiz. Please try again.",
            variant: "destructive",
          })
        }
        return false
      } finally {
        savingRef.current = false
        setSaving(false)
      }
    },
    [
      assessmentType,
      assessmentLabel,
      isInstructorPath,
      isSingleSittingExam,
      listPath,
      quizId,
      router,
      toast,
      userType,
    ],
  )

  const persistQuestionMedia = useCallback(
    async (questionId: number, media: QuestionMedia, questionType?: string) => {
      try {
        const res = await instructorApiFetch(`/api/instructor/quizzes/${quizId}/questions/${questionId}/media`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(isInstructorPath ? buildInstructorApiHeaders() : {}),
          },
          body: JSON.stringify({
            question_media: media,
            question_type: questionType ?? null,
          }),
        })
        return res.ok
      } catch {
        return false
      }
    },
    [quizId, isInstructorPath],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await persistQuiz({
      notify: sendNotificationsRef.current,
      navigate: true,
      silent: false,
    })
  }

  const addQuestionFromBank = async (bankQuestion: any) => {
    const imported = convertBankQuestionToQuizQuestion(bankQuestion, {
      assessmentType,
    }) as Question
    setQuestions((prev) => {
      const next = [...prev, imported]
      questionsRef.current = next
      return next
    })
    const ok = await persistQuiz({ notify: false, navigate: false, silent: true })
    toast({
      title: ok ? "Question added" : "Added — save needed",
      description: ok
        ? "Saved to this assessment."
        : "Could not auto-save. Click Save Changes to keep it.",
      variant: ok ? "default" : "destructive",
    })
  }

  if (loading) {
    if (embedInDashboard) {
      return (
        <div className="space-y-4 py-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <div className="h-12 w-12 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-blue-600 dark:border-t-blue-500 animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-slate-900 dark:text-slate-100 font-medium">Loading {assessmentLabel}...</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Fetching questions and settings</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("w-full min-w-0 space-y-5 pb-24", embedInDashboard ? "" : "max-w-6xl mx-auto")}>
      <EditAssessmentPageHeader
        title={quizData.title}
        assessmentType={assessmentType}
        assessmentLabel={assessmentLabel}
        assessmentPluralLabel={assessmentPluralLabel}
        listPath={listPath}
        embedInDashboard={embedInDashboard}
        questionCount={questions.length}
        sectionCount={quizData.section_config?.length ?? 0}
        isActive={quizData.is_active}
      />

      {isInstructorPath ? (
        <CourseAssessmentDefaultsBanner policy={courseAssessmentPolicy} dismissKey={quizId} />
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Modern Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={tabListClass}>
            <TabsTrigger value="details" className={tabTriggerClass}>
              {assessmentLabel} Details
            </TabsTrigger>
            <TabsTrigger value="questions" className={tabTriggerClass}>
              Questions ({questions.length})
            </TabsTrigger>
            <TabsTrigger value="sections" className={tabTriggerClass}>
              <LayoutList className="h-4 w-4" />
              Sections
            </TabsTrigger>
            <TabsTrigger value="time" className={tabTriggerClass}>
              Time Settings
            </TabsTrigger>
            <TabsTrigger value="settings" className={tabTriggerClass}>
              <Shield className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="scores" className={tabTriggerClass}>
              <Plus className="h-4 w-4" />
              Scores & Issues
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-6">
            {/* Basic Information Card */}
            <Card className={eCard}>
              <CardHeader className={eCardHeader}>
                <CardTitle className={eTitle}>
                  Basic Information
                </CardTitle>
                <p className={eMuted}>Title, description, and default timing</p>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="title" className={eLabel}>
                    {assessmentLabel} Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={quizData.title}
                    onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
                    required
                    className={eInput}
                    placeholder={`e.g. Week 3 Quiz, Midterm 1`}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className={eLabel}>
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={quizData.description || ""}
                    onChange={(e) => setQuizData({ ...quizData, description: e.target.value })}
                    className={eTextarea}
                    placeholder={`Brief description shown to students before they start...`}
                  />
                </div>

                {/* Coverage field - only show for mid-semester and final exams */}
                {(assessmentType === "mid_semester" || assessmentType === "final") && (
                  <div className="space-y-2">
                    <Label htmlFor="coverage" className={eLabel}>
                      Coverage (Chapters/Lectures) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="coverage"
                      value={quizData.coverage || ""}
                      onChange={(e) => setQuizData({ ...quizData, coverage: e.target.value })}
                      className={eInput}
                      placeholder="e.g. Ch. 1-5, Lectures 1-10"
                      required
                    />
                    <p className={eHint}>
                      What material this assessment covers
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  {assessmentType === "homework" ? (
                    <>
                      <Label className={eLabel}>
                        Timing
                      </Label>
                      <p className="text-sm text-slate-600 dark:text-slate-300 rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/30 px-4 py-3 leading-snug">
                        Homework uses one countdown for the whole assignment. Set the total under Sections.
                        Students decide how to spend that time. Availability still controls when it opens and when it is due.
                      </p>
                    </>
                  ) : (
                    <>
                      <Label htmlFor="time" className={eLabel}>
                        Default Time per Question <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="time"
                          type="number"
                          min="10"
                          value={Number.isFinite(Number(quizData.time_per_question)) ? Number(quizData.time_per_question) : ""}
                          onChange={(e) => {
                            const v = e.target.value
                            const n = v === "" ? 60 : parseInt(v, 10)
                            setQuizData({ ...quizData, time_per_question: Number.isFinite(n) ? n : 60 })
                          }}
                          required
                          className={cn(eInput, "pr-16")}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400">
                          seconds
                        </span>
                      </div>
                      <p className={eHint}>
                        Students share one clock for the whole assessment. Set that total under Sections. This per-question default is not the sitting timer.
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className={eCard}>
              <CardHeader className={eCardHeader}>
                <CardTitle className={cn(eTitle, "flex items-center gap-2")}>
                  <Scale className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  Course grade
                </CardTitle>
                <p className={eMuted}>
                  Practice or mock assessments can stay visible to students but be excluded from averages and totals.
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <div className={eSwitchRow}>
                  <div className="space-y-1 min-w-0">
                    <Label htmlFor="counts_toward_course_grade" className={eSwitchLabel}>
                      Count toward course grade
                    </Label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                      When off, scores do not affect quiz, homework, midterm, or final category calculations (e.g. mock finals).
                    </p>
                  </div>
                  <Switch
                    id="counts_toward_course_grade"
                    checked={quizData.counts_toward_course_grade !== false}
                    onCheckedChange={(checked) =>
                      setQuizData({ ...quizData, counts_toward_course_grade: checked })
                    }
                    className="shrink-0 data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Availability Schedule Card */}
            <Card className={eCard}>
              <CardHeader className={eCardHeader}>
                <CardTitle className={eTitle}>
                  Availability Schedule
                </CardTitle>
                <p className={eMuted}>When students can access this assessment</p>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="available_from" className={eLabel}>
                      Available From
                    </Label>
                    <Input
                      id="available_from"
                      type="datetime-local"
                      value={quizData.available_from}
                      onChange={(e) => setQuizData({ ...quizData, available_from: e.target.value })}
                      className={eInput}
                    />
                    <p className={eHint}>Empty = immediately available</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="available_until" className={eLabel}>
                      Available Until
                    </Label>
                    <Input
                      id="available_until"
                      type="datetime-local"
                      value={quizData.available_until}
                      onChange={(e) => setQuizData({ ...quizData, available_until: e.target.value })}
                      className={eInput}
                    />
                    <p className={eHint}>Empty = no expiration</p>
                  </div>
                </div>

                {/* Who Can Access - restrict to selected students (in-class exams) */}
                {(["quiz", "homework", "mid_semester", "final"].includes(assessmentType)) && (
                  <ManageWhoCanAccessPanel
                    restrictAccessToStudents={quizData.restrict_access_to_students}
                    allowedStudentIds={quizData.allowed_student_ids}
                    selectedSessionId={quizData.access_restriction_session_id}
                    onRestrictChange={(v) => setQuizData((prev) => ({ ...prev, restrict_access_to_students: v }))}
                    onAllowedStudentsChange={(ids) => setQuizData((prev) => ({ ...prev, allowed_student_ids: ids }))}
                    onSessionChange={(id) => setQuizData((prev) => ({ ...prev, access_restriction_session_id: id }))}
                    assessmentLabel={assessmentLabel.toLowerCase()}
                    userType={userType as "instructor" | "admin"}
                    embedded
                  />
                )}

                {(["quiz", "homework", "mid_semester", "final"].includes(assessmentType)) && (
                  <ManagePlatformAccessPanel
                    assessmentType={assessmentType}
                    inherit={quizData.inherit_platform_access}
                    flags={quizData.platform_access}
                    courseAccess={courseAssessmentPolicy?.access.platform_access}
                    onInheritChange={(v) =>
                      setQuizData((prev) => ({ ...prev, inherit_platform_access: v }))
                    }
                    onFlagsChange={(next) =>
                      setQuizData((prev) => ({ ...prev, platform_access: next }))
                    }
                  />
                )}

                {/* Location Restriction - for quiz, homework, mid-semester, final */}
                {(["quiz", "quizzes", "homework", "mid_semester", "final"].includes(assessmentType)) && (
                  <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                    <ManageGeolocationPanel
                      geoRequired={quizData.geo_required}
                      geoLat={quizData.geo_lat}
                      geoLng={quizData.geo_lng}
                      geoRadiusMeters={quizData.geo_radius_meters}
                      onGeoRequiredChange={(v) => setQuizData((prev) => ({ ...prev, geo_required: v }))}
                      onGeoLatChange={(v) => setQuizData((prev) => ({ ...prev, geo_lat: v }))}
                      onGeoLngChange={(v) => setQuizData((prev) => ({ ...prev, geo_lng: v }))}
                      onGeoRadiusChange={(v) => setQuizData((prev) => ({ ...prev, geo_radius_meters: v }))}
                      assessmentLabel={assessmentLabel}
                      embedded
                    />
                  </div>
                )}

                {/* Fullscreen & Beta - compact toggles */}
                <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">Require Fullscreen</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {homeworkIntegrityExempt
                          ? "Homework is exempt from fullscreen lock."
                          : "Students must stay in fullscreen on desktop and web. Strict Mode turns this on automatically."}
                      </p>
                    </div>
                    <Switch
                      checked={homeworkIntegrityExempt ? false : (quizData.require_fullscreen ?? false)}
                      disabled={homeworkIntegrityExempt}
                      onCheckedChange={(v) => setQuizData((prev) => ({ ...prev, require_fullscreen: v }))}
                      className="data-[state=checked]:bg-blue-600 shrink-0"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">Beta-Only Mode</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Visible only to beta testers (e.g. DEMO001). Use for testing before release.</p>
                    </div>
                    <Switch
                      checked={Boolean(quizData.beta_only)}
                      onCheckedChange={(v) => setQuizData((prev) => ({ ...prev, beta_only: v }))}
                      className="data-[state=checked]:bg-orange-500 shrink-0"
                    />
                  </div>
                </div>

                {/* Membership / instructor rollover — not used for mid-semester or final exams */}
                {isSingleSittingExam ? (
                  <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700 rounded-xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 p-4">
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">Mid-semester &amp; final exams</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Rollover extensions, membership Extend, and superpowers are disabled. Students get one attempt within the exam window — no post-deadline rollover. Use <strong>Who Can Access</strong> above to allow only students present in class.
                    </p>
                  </div>
                ) : (
                  <>
                    <ManageRolloverPanel
                      rolloverEnabled={quizData.rollover_enabled}
                      rolloverHours={quizData.rollover_hours}
                      onRolloverEnabledChange={(v) => setQuizData((prev) => ({ ...prev, rollover_enabled: v }))}
                      onRolloverHoursChange={(v) => setQuizData((prev) => ({ ...prev, rollover_hours: v }))}
                      assessmentLabel={assessmentLabel}
                      embedded
                    />
                    <GrantRolloverToStudentPanel
                      quizId={quizId}
                      assessmentLabel={assessmentLabel}
                      defaultHours={quizData.rollover_hours}
                      resetButton={
                        <ResetAllRolloversButton
                          userType={userType}
                          onSuccess={() => toast({ title: "Rollovers reset", description: "All rollover records have been cleared." })}
                          onError={(msg) => toast({ title: "Reset failed", description: msg, variant: "destructive" })}
                        />
                      }
                    />
                  </>
                )}

                {/* Superpowers: quiz, homework, mid-semester when enabled (not finals) */}
                {assessmentType === "quiz" || assessmentType === "homework" || assessmentType === "mid_semester" ? (
                <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">Superpowers Configuration</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Let Explorer/Trailblazer students choose runtime modifiers (copy/paste, extra time, etc.) before starting. When off, the superpowers menu is hidden from students.
                      </p>
                    </div>
                    <Switch
                      checked={quizData.enable_superpowers}
                      onCheckedChange={(v) => setQuizData((prev) => ({ ...prev, enable_superpowers: v }))}
                      className="data-[state=checked]:bg-violet-600 shrink-0"
                    />
                  </div>
                  {quizData.enable_superpowers && (
                    <div className="mt-4 space-y-2">
                      <Label className={eLabel}>Allowed Superpowers</Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Select which superpowers students can choose from. Scholar: none. Explorer: exactly 1. Trailblazer: up to 2.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allIds = ["copy_paste", "disable_tab_tracking", "disable_ai_detection", "increase_strikes", "extra_retake", "extra_time"] as const
                            const allSelected = allIds.every((id) => quizData.allowed_superpowers.includes(id))
                            setQuizData((prev) => ({
                              ...prev,
                              allowed_superpowers: allSelected ? [] : [...allIds],
                            }))
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          {(["copy_paste", "disable_tab_tracking", "disable_ai_detection", "increase_strikes", "extra_retake", "extra_time"] as const).every((id) =>
                            quizData.allowed_superpowers.includes(id)
                          )
                            ? "Deselect All"
                            : "Select All"}
                        </button>
                        {(["copy_paste", "disable_tab_tracking", "disable_ai_detection", "increase_strikes", "extra_retake", "extra_time"] as const).map((id) => {
                          const cfg = SUPERPOWER_CONFIG[id]
                          const isChecked = quizData.allowed_superpowers.includes(id)
                          return (
                            <label
                              key={id}
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                isChecked
                                  ? "bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700"
                                  : "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...quizData.allowed_superpowers, id]
                                    : quizData.allowed_superpowers.filter((s) => s !== id)
                                  setQuizData((prev) => ({ ...prev, allowed_superpowers: next }))
                                }}
                                className="rounded border-slate-300"
                              />
                              <span className="text-sm font-medium">{cfg.icon} {cfg.label}</span>
                            </label>
                          )
                        })}
                      </div>
                      <SuperpowersUsageTable
                        quizId={quizId}
                        userType={userType as "instructor" | "admin"}
                        enabled={true}
                      />
                    </div>
                  )}
                </div>
                ) : (
                <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-800 dark:text-slate-200">Superpowers</span> are available for quizzes, homework, and mid-semester exams when enabled above. Final exams always use the assessment anti-cheat settings without student-chosen modifiers.
                  </p>
                </div>
                )}
              </CardContent>
            </Card>

            {/* Notifications Card */}
            <Card className={eCard}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Label htmlFor="sendNotifications" className="cursor-pointer font-medium text-slate-900 dark:text-slate-100">
                      Notify students about changes
                    </Label>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Email students who haven't completed this {assessmentLabel.toLowerCase()} when you save changes
                    </p>
                  </div>
                  <Switch
                    id="sendNotifications"
                    checked={sendNotifications}
                    onCheckedChange={setSendNotifications}
                    className="data-[state=checked]:bg-blue-600 shrink-0"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Retake Configuration Card */}
            <Card className={eCard}>
              <CardHeader className={eCardHeader}>
                <CardTitle className={eTitle}>
                  Retake Configuration
                </CardTitle>
                <p className={eMuted}>
                  {isSingleSittingExam ? (
                    <>
                      Mid-semester and final exams are single-attempt only. Explorer, Trailblazer, and donation perks do not add retakes.
                    </>
                  ) : (
                    <>
                      Allow multiple attempts for eligible students (Explorer / Trailblazer / donation); limits below combine with membership perks.
                    </>
                  )}
                </p>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                {isSingleSittingExam ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
                    Retakes are disabled for this exam type. Each student gets one attempt unless you grant an individual make-up via attempt overrides.
                  </p>
                ) : (
                <>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Label htmlFor="retake_enabled" className="cursor-pointer font-medium text-slate-900 dark:text-slate-100">
                    Allow retakes for eligible students (membership perks apply)
                  </Label>
                  <Switch
                    id="retake_enabled"
                    checked={quizData.retake_enabled}
                    onCheckedChange={(checked) =>
                      setQuizData((prev) => ({ ...prev, retake_enabled: Boolean(checked) }))
                    }
                    className="data-[state=checked]:bg-blue-600 shrink-0"
                  />
                </div>

                {quizData.retake_enabled && (
                  <div className="space-y-5 pl-2 border-l-4 border-blue-500 ml-2">
                    <div className="pl-4 space-y-2">
                      <Label htmlFor="retake_limit" className={eLabel}>
                        Maximum Retakes
                      </Label>
                      <Input
                        id="retake_limit"
                        type="number"
                        min="0"
                        max="10"
                        value={Number.isFinite(Number(quizData.retake_limit)) ? Number(quizData.retake_limit) : ""}
                        onChange={(e) => {
                          const v = e.target.value
                          const n = v === "" ? 0 : parseInt(v, 10)
                          setQuizData((prev) => ({
                            ...prev,
                            retake_limit: Number.isFinite(n) ? n : 0,
                          }))
                        }}
                        className={eInput}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                        <span className="font-semibold">Examples:</span> 0 = no retakes (1 attempt), 1 = one retake (2 attempts), 2 = two retakes (3 attempts)
                      </p>
                    </div>

                    <div className="pl-4 space-y-2">
                      <Label htmlFor="retake_policy" className={eLabel}>
                        Grading Policy
                      </Label>
                      <Select
                        value={quizData.retake_policy}
                        onValueChange={(value) => setQuizData({ ...quizData, retake_policy: value })}
                      >
                        <SelectTrigger id="retake_policy" className="h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="best" className="rounded-lg">🏆 Best Score (Highest attempt counts)</SelectItem>
                          <SelectItem value="latest" className="rounded-lg">⏱️ Latest Score (Most recent attempt counts)</SelectItem>
                          <SelectItem value="average" className="rounded-lg">📊 Average Score (Average of all attempts)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className={eHint}>
                        Choose which score will be used for student's final grade
                      </p>
                    </div>

                    {/* Attempt Override Manager */}
                    <div className="pl-4 mt-4">
                      <AttemptOverrideManager quizId={quizId} userType={userType} />
                    </div>

                    <div className="pl-4 flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl">
                      <Label htmlFor="review_before_retake" className="cursor-pointer font-normal text-sm text-slate-700 dark:text-slate-300">
                        Require students to review incorrect answers before retaking
                      </Label>
                      <Switch
                        id="review_before_retake"
                        checked={quizData.review_before_retake}
                        onCheckedChange={(checked) => setQuizData({ ...quizData, review_before_retake: checked })}
                        className="data-[state=checked]:bg-blue-600 shrink-0"
                      />
                    </div>

                    <div className="pl-4 flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl">
                      <div>
                        <Label htmlFor="forfeit_retake_on_report_view" className="cursor-pointer font-normal text-sm text-slate-700 dark:text-slate-300">
                          Forfeit retake upon report view
                        </Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          When on, viewing the report forfeits retake (recommended for MCQ/select-all). Turn off for code-only quizzes where answers aren&apos;t revealed.
                        </p>
                      </div>
                      <Switch
                        id="forfeit_retake_on_report_view"
                        checked={quizData.forfeit_retake_on_report_view ?? true}
                        onCheckedChange={(checked) => setQuizData({ ...quizData, forfeit_retake_on_report_view: checked })}
                        className="data-[state=checked]:bg-blue-600 shrink-0"
                      />
                    </div>
                  </div>
                )}
                </>
                )}

                <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-900/40">
                  <div className="space-y-1 pr-2">
                    <Label htmlFor="lock_student_results_review" className="cursor-pointer font-medium text-slate-900 dark:text-slate-100">
                      Lock detailed results until you release them
                    </Label>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      While on, students still see their score, but they cannot open per-question review or download the results
                      PDF—useful for finals so early finishers cannot share questions and answers. Turn off when everyone has
                      completed to restore review and PDF.
                    </p>
                  </div>
                  <Switch
                    id="lock_student_results_review"
                    checked={Boolean(quizData.lock_student_results_review)}
                    onCheckedChange={(checked) =>
                      setQuizData((prev) => ({ ...prev, lock_student_results_review: Boolean(checked) }))
                    }
                    className="data-[state=checked]:bg-blue-600 shrink-0"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Waiting Room Configuration */}
            <Card className={eCard}>
              <CardHeader className={eCardHeader}>
                <CardTitle className={eTitle}>
                  Waiting Room
                </CardTitle>
                <p className={eMuted}>Limit simultaneous takers</p>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="max_concurrent_students" className={eLabel}>
                    Maximum Concurrent Students
                  </Label>
                  <Input
                    id="max_concurrent_students"
                    type="number"
                    min="1"
                    placeholder="Leave empty for unlimited"
                    value={quizData.max_concurrent_students != null && Number.isFinite(Number(quizData.max_concurrent_students)) ? Number(quizData.max_concurrent_students) : ""}
                    onChange={(e) => {
                      const v = e.target.value
                      const value = v === "" ? null : (parseInt(v, 10) || null)
                      setQuizData({ ...quizData, max_concurrent_students: value === null || Number.isFinite(value) ? value : null })
                    }}
                    className={eInput}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                    <span className="font-semibold">Purpose:</span> Limits how many students can take this assessment simultaneously. 
                    Other students will be placed in a waiting room and admitted automatically when spots open. 
                    This helps prevent data loss and reduces server congestion. 
                    <span className="font-semibold block mt-2">Recommended:</span> 20 students for finals, 30-50 for homeworks/quizzes. 
                    Leave empty for unlimited (no waiting room).
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-6 mt-6">
            {/* Questions Header Card */}
            <Card className={eCard}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Manage Questions
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {questions.length} question{questions.length !== 1 ? 's' : ''} • Drag to reorder
                    </p>
                    {assessmentType === 'final' && (() => {
                      const totalPoints = questions.reduce((sum, q) => {
                        const points = q.max_points || q.points || 1
                        return sum + points
                      }, 0)
                      const isValid = totalPoints === 100
                      return (
                        <div className={`mt-2 flex items-center gap-2 text-sm font-semibold ${isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          <span>Total Points: {totalPoints} / 100</span>
                          {isValid ? (
                            <span className="text-green-600 dark:text-green-400">✓</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">⚠️ Must equal 100</span>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                  <Button 
                    type="button" 
                    onClick={() => setShowAddQuestionModal(true)} 
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </CardContent>
            </Card>

            {questions.map((question, index) => (
              <Card
                key={index}
                className={`border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl overflow-hidden transition-all ${draggedIndex === index ? "opacity-50 scale-[0.98] ring-2 ring-blue-400" : "hover:shadow-md"}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              >
                <CardHeader className="border-b border-slate-100 dark:border-slate-700 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="cursor-grab active:cursor-grabbing p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        <GripVertical className="h-5 w-5 text-slate-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          Question {index + 1}
                        </CardTitle>
                        <p className={eMuted}>
                          {question.question_type || "MCQ"}
                        </p>
                      </div>
                    </div>
                    {questions.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => requestRemoveQuestion(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor={`type-${index}`} className={eLabel}>
                      Question Type
                    </Label>
                    <Select
                      value={question.question_type || "mcq"}
                      onValueChange={(value) => updateQuestion(index, "question_type", value)}
                    >
                      <SelectTrigger id={`type-${index}`} className="h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectGroup>
                          <SelectLabel className="text-[11px] uppercase tracking-wide">General</SelectLabel>
                          <SelectItem value="mcq" className="rounded-lg">📝 Multiple Choice</SelectItem>
                          <SelectItem value="true_false" className="rounded-lg">✅ True/False</SelectItem>
                          <SelectItem value="select_all" className="rounded-lg">☑️ Select All That Apply</SelectItem>
                          <SelectItem value="fill_blank" className="rounded-lg">✏️ Fill in the Blank</SelectItem>
                          <SelectItem value="scenario_match" className="rounded-lg">🔗 Scenario Match</SelectItem>
                          <SelectItem value="code_output" className="rounded-lg">💻 Code Output</SelectItem>
                          <SelectItem value="trace_logic" className="rounded-lg">🔍 Trace Logic</SelectItem>
                          <SelectItem value="trace_output" className="rounded-lg">📊 Trace Output</SelectItem>
                          <SelectItem value="multi_output" className="rounded-lg">📋 Multi Output</SelectItem>
                          <SelectItem value="fill_code" className="rounded-lg">⌨️ Fill Code</SelectItem>
                          <SelectItem value="code_reorder" className="rounded-lg">🔀 Code Reorder</SelectItem>
                          <SelectItem value="code_problem" className="rounded-lg">🧩 Code Problem</SelectItem>
                          <SelectItem value="code_debug" className="rounded-lg">🐛 Code Debug</SelectItem>
                          <SelectItem value="debug_code" className="rounded-lg">🔧 Debug Code</SelectItem>
                          <SelectItem value="code_write" className="rounded-lg">✍️ Code Write</SelectItem>
                          <SelectItem value="code_explain" className="rounded-lg">💡 Code Explain</SelectItem>
                          <SelectItem value="code_write_plot" className="rounded-lg">📈 Code Write + Plot (MATLAB)</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel className="text-[11px] uppercase tracking-wide text-amber-800 dark:text-amber-200">
                            Engineering / Circuits
                          </SelectLabel>
                          <SelectItem value="circuit_numeric" className="rounded-lg">Ω Circuit Numeric</SelectItem>
                          <SelectItem value="circuit_worked_solution" className="rounded-lg">∑ Circuit Worked Solution</SelectItem>
                          <SelectItem value="circuit_diagram_analysis" className="rounded-lg">⎍ Circuit Diagram Analysis (legacy — use media panel)</SelectItem>
                          <SelectItem value="circuit_multi_part" className="rounded-lg">(a–d) Circuit Multi-Part</SelectItem>
                          <SelectItem value="circuit_fill_equation" className="rounded-lg">□ Circuit Equation Fill</SelectItem>
                          <SelectItem value="circuit_transfer_function" className="rounded-lg">H(s) Transfer Function</SelectItem>
                          <SelectItem value="circuit_phasor_power" className="rounded-lg">∠ AC Phasor / Power</SelectItem>
                          <SelectItem value="circuit_transient_response" className="rounded-lg">τ Transient Response</SelectItem>
                          <SelectItem value="circuit_upload_work" className="rounded-lg">📎 Upload Written Work</SelectItem>
                          <SelectItem value="circuit_submission" className="rounded-lg">⚡ Circuit Submission</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {QUESTION_TYPES_WITH_PER_QUESTION_AI_LANGUAGE.has(
                    (question.question_type || "").toLowerCase(),
                  ) && (
                    <div className="space-y-2">
                      <Label
                        htmlFor={`ai-lang-${index}`}
                        className={eLabel}
                      >
                        AI grading language
                      </Label>
                      <Select
                        value={
                          question.ai_code_language
                            ? String(question.ai_code_language)
                            : "__quiz_default__"
                        }
                        onValueChange={(v) => updateQuestion(index, "ai_code_language", v)}
                      >
                        <SelectTrigger
                          id={`ai-lang-${index}`}
                          className="h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <SelectValue placeholder="Use quiz default" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="__quiz_default__" className="rounded-lg">
                            Use quiz default (
                            {formatQuizDefaultLanguagesLabel(
                              quizData.allowed_ai_code_languages,
                              quizData.code_language,
                            )}
                            )
                          </SelectItem>
                          {AI_CODE_LANGUAGE_OPTIONS.map((lang) => (
                            <SelectItem key={lang.id} value={lang.id} className="rounded-lg">
                              {lang.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className={eHint}>
                        Overrides the assessment-wide &quot;Code Language&quot; on the Settings tab for this question
                        only (e.g. MATLAB prompts on a mostly C++ quiz).
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className={eLabel}>
                      Question Text <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      value={question.question_text || ""}
                      onChange={(e) => updateQuestion(index, "question_text", e.target.value)}
                      required
                      className="rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[120px] resize-none"
                      placeholder="Enter your question here..."
                    />
                  </div>

                  <QuestionMediaPanel
                    media={question.question_media}
                    onChange={(media) => updateQuestion(index, "question_media", media as unknown as Record<string, unknown>)}
                    onPersist={
                      question.id
                        ? (media) => persistQuestionMedia(question.id!, media, question.question_type)
                        : undefined
                    }
                  />

                  {isCircuitQuestionType(question.question_type || "") && (
                    <CircuitQuestionEditor
                      spec={readCircuitSpecFromQuestion(question)}
                      onChange={(spec) => updateQuestion(index, "circuit_spec", spec as unknown as Record<string, unknown>)}
                    />
                  )}

                  {/* Points Input - Critical for Finals */}
                  {assessmentType === 'final' && (
                    <div className="space-y-2">
                      <Label htmlFor={`points-${index}`} className={eLabel}>
                        Points <span className="text-red-500">*</span>
                        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                          (Total must equal 100)
                        </span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`points-${index}`}
                          type="number"
                          min="0.5"
                          max="100"
                          step="0.5"
                          value={Number.isFinite(Number(question.max_points ?? question.points)) ? Number(question.max_points ?? question.points) : ""}
                          onChange={(e) => {
                            const v = e.target.value
                            const value = v === "" ? 1 : (parseFloat(v) || 1)
                            updateQuestion(index, "max_points", value)
                            updateQuestion(index, "points", value)
                          }}
                          className="h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 w-32"
                          placeholder="1"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          = {((question.max_points || question.points || 1) / 100 * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Anti-Cheat Exemption Toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex-1">
                      <Label htmlFor={`anti-cheat-exempt-${index}`} className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const questionType = (question.question_type || "").toLowerCase()
                            const isExempt = isQuestionTypeExempt(questionType) || 
                                           (question.anti_cheat_exempt === true)
                            return isExempt ? (
                              <Unlock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                            )
                          })()}
                          <span>Anti-Cheat Protection</span>
                        </div>
                      </Label>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {(() => {
                          const questionType = (question.question_type || "").toLowerCase()
                          const isExempt = isQuestionTypeExempt(questionType) || 
                                         (question.anti_cheat_exempt === true)
                          return isExempt 
                            ? "Disabled - Students can use external tools/resources"
                            : "Enabled - Full anti-cheat protections active"
                        })()}
                      </p>
                    </div>
                    <Switch
                      id={`anti-cheat-exempt-${index}`}
                      checked={(() => {
                        const questionType = (question.question_type || "").toLowerCase()
                        // If question type is automatically exempt, always show as checked
                        if (isQuestionTypeExempt(questionType)) {
                          return true
                        }
                        return question.anti_cheat_exempt === true
                      })()}
                      onCheckedChange={(checked) => {
                        const questionType = (question.question_type || "").toLowerCase()
                        // Don't allow unchecking if question type is automatically exempt
                        if (isQuestionTypeExempt(questionType) && !checked) {
                          toast({
                            title: "Cannot Disable",
                            description: `This question type (${questionType}) is automatically exempt from anti-cheat.`,
                            variant: "default"
                          })
                          return
                        }
                        updateQuestion(index, "anti_cheat_exempt", checked)
                      }}
                      disabled={(() => {
                        const questionType = (question.question_type || "").toLowerCase()
                        return isQuestionTypeExempt(questionType)
                      })()}
                      className="data-[state=checked]:bg-amber-500"
                    />
                  </div>

                  {(() => {
                    const questionType = question.question_type?.toLowerCase() || "mcq"
                    const isTextInput = [
                      "fill_blank",
                      "code_output",
                      "trace_output",
                      "trace_logic",
                      "fill_code",
                      "scenario_match",
                      "debug_code",
                      "code_explain",
                      "code_reorder",
                      "code_problem",
                      "code_write",
                      "code_write_plot",
                      "code_debug",
                    ].includes(questionType)

                    if (questionType === "multi_part") {
                      const partCount = getGradableSubquestions(question.subquestions).length
                      return (
                        <p className="text-sm text-muted-foreground rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 px-4 py-3">
                          Multi-part stem — options A–E are not used here. This question has{" "}
                          <strong>{partCount}</strong> graded sub-part{partCount === 1 ? "" : "s"} configured in the
                          question bank. Edit sub-parts from the question bank if needed.
                        </p>
                      )
                    }

                    if (questionType === "circuit_submission") {
                      return (
                        <p className="text-sm text-muted-foreground rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 px-4 py-3">
                          Circuit submission — students upload worked solutions for manual grading. No answer options or
                          auto-grading. Configure the figure, statement, and upload instructions in the question bank.
                        </p>
                      )
                    }

                    if (isTextInput) {
                      return (
                        <div className="space-y-2">
                          <Label>Correct Answer</Label>
                          {questionType === "scenario_match" ? (
                            <>
                              <Textarea
                                value={question.correct_answer}
                                onChange={(e) => updateQuestion(index, "correct_answer", e.target.value)}
                                placeholder="Enter matching pairs (e.g., A-1, B-2, C-3)"
                                rows={4}
                                required
                                className="rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[100px] resize-none"
                              />
                              <p className="text-sm text-muted-foreground">
                                Enter the correct matching pairs or use JSON format for complex matches
                              </p>
                            </>
                          ) : (
                            <>
                              <Input
                                value={question.correct_answer}
                                onChange={(e) => updateQuestion(index, "correct_answer", e.target.value)}
                                placeholder="Enter the correct answer..."
                                required
                                className="h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20"
                              />
                              <p className="text-sm text-muted-foreground">
                                For multiple acceptable answers, use JSON array format: ["answer1", "answer2"]
                              </p>
                            </>
                          )}
                        </div>
                      )
                    }

                    return (
                      <>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Option A</Label>
                            <Input
                              value={question.option_a ?? ""}
                              onChange={(e) => updateQuestion(index, "option_a", e.target.value)}
                              required
                              className="h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Option B</Label>
                            <Input
                              value={question.option_b ?? ""}
                              onChange={(e) => updateQuestion(index, "option_b", e.target.value)}
                              required
                              className="h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Option C</Label>
                            <Input
                              value={question.option_c ?? ""}
                              onChange={(e) => updateQuestion(index, "option_c", e.target.value)}
                              required={questionType === "mcq"}
                              className="h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Option D</Label>
                            <Input
                              value={question.option_d ?? ""}
                              onChange={(e) => updateQuestion(index, "option_d", e.target.value)}
                              required={questionType === "mcq"}
                              className="h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Option E</Label>
                            <Input
                              value={question.option_e ?? ""}
                              onChange={(e) => updateQuestion(index, "option_e", e.target.value)}
                              placeholder="Leave empty if only 4 options needed"
                              className="h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Correct Answer</Label>
                          {questionType === "select_all" || questionType === "multi_output" ? (
                            <div className="space-y-2">
                              <Input
                                value={question.correct_answer}
                                onChange={(e) => updateQuestion(index, "correct_answer", e.target.value)}
                                placeholder='Enter as JSON array of letters: ["A","C","E"]'
                                required
                                className="h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20"
                              />
                              <p className="text-sm text-muted-foreground">
                                Enter correct answers as a JSON array of option letters (A–E), e.g.{" "}
                                {`["A","C"]`}. Full option text also works but letters are preferred.
                              </p>
                            </div>
                          ) : (
                            <Select
                              value={question.correct_answer}
                              onValueChange={(value) => updateQuestion(index, "correct_answer", value)}
                            >
                              <SelectTrigger className="h-11 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="A">A</SelectItem>
                                <SelectItem value="B">B</SelectItem>
                                {questionType !== "true_false" && (
                                  <>
                                    <SelectItem value="C">C</SelectItem>
                                    <SelectItem value="D">D</SelectItem>
                                    <SelectItem value="E">E</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="sections" className="space-y-6 mt-6">
            <Card className="border border-slate-200 dark:border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Sectionized scoring</CardTitle>
                    <CardDescription className="mt-1">
                      Turn on weighted sections for this exam. Each section’s <strong>percentage below</strong> is how much
                      of the <strong>0–100 exam score</strong> comes from that section’s performance (points earned in the
                      section ÷ points possible there, then scaled). You can use <strong>1 raw point per question</strong> on
                      the Questions tab; changing section % here does not require re-tuning every question’s points.
                      Quizzes and homework stay flat points-based when this is off.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="use-section-config" className={eLabel}>
                      Use sections
                    </Label>
                    <Switch
                      id="use-section-config"
                      checked={quizData.section_config.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setQuizData({
                            ...quizData,
                            section_config:
                              quizData.section_config.length > 0
                                ? coerceExamWideSectionConfig(quizData.section_config, assessmentType) ??
                                  quizData.section_config
                                : applyExamSharedTimerConfig(
                                    assessmentType === "final"
                                      ? DEFAULT_FINAL_SECTION_CONFIG
                                      : [...DEFAULT_SECTION_CONFIG],
                                    defaultExamWideTimerSeconds(assessmentType),
                                  ),
                          })
                        } else {
                          setQuizData({ ...quizData, section_config: [] })
                        }
                      }}
                      disabled={saving}
                    />
                  </div>
                </div>
              </CardHeader>
              {quizData.section_config.length > 0 && (
                <CardContent className="pt-0 space-y-4">
                  <SectionConfigEditor
                    sections={quizData.section_config}
                    assessmentType={assessmentType}
                    onChange={(sections) => setQuizData({ ...quizData, section_config: sections })}
                    disabled={saving}
                  />
                  {(assessmentType === "final" || assessmentType === "mid_semester") && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/40 px-4 py-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Optional: set every question to <strong>1</strong> max point for a simple raw count per section.
                        The exam score still comes only from the section percentages above.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={saving || questions.length === 0}
                        onClick={() => {
                          setQuestions(
                            questions.map((q) => ({
                              ...q,
                              max_points: 1,
                              points: 1,
                            })),
                          )
                          toast({
                            title: "Question points updated",
                            description: `All ${questions.length} questions are set to 1 raw point. Adjust any question if you need a different weight inside a section.`,
                          })
                        }}
                      >
                        Set all to 1 raw point
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* Time Settings Tab */}
          <TabsContent value="time" className="space-y-6 mt-6">
            <Tabs defaultValue="individual" className="w-full">
              <TabsList className={subTabListClass}>
                <TabsTrigger value="individual" className={tabTriggerClass}>Individual Questions</TabsTrigger>
                <TabsTrigger value="defaults" className={tabTriggerClass}>Default Time Settings</TabsTrigger>
              </TabsList>
              
              <TabsContent value="individual" className="space-y-6">
                {/* Time Settings Info Card */}
                <Card
                  className={
                    embedInDashboard
                      ? eCard
                      : "bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10 border border-orange-200 dark:border-orange-800/30 shadow-sm rounded-2xl"
                  }
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      {embedInDashboard && embedChrome ? (
                        <div className={embedChrome.iconBadge("sm")}>
                          <Clock className="size-4" aria-hidden />
                        </div>
                      ) : (
                        <span className="text-2xl" aria-hidden>
                          ⏱️
                        </span>
                      )}
                      <div className="min-w-0">
                        <h3
                          className={
                            embedInDashboard
                              ? cn("font-semibold", PORTAL_TEXT)
                              : "font-semibold text-orange-900 dark:text-orange-100"
                          }
                        >
                          Time configuration
                        </h3>
                        <p
                          className={
                            embedInDashboard
                              ? cn("text-sm mt-1 text-[var(--cc-text-secondary)] leading-relaxed")
                              : "text-sm text-orange-700 dark:text-orange-300 mt-1"
                          }
                        >
                          <>
                            Entire assessment uses one shared pool of{" "}
                            <span className="font-semibold">
                              {Math.round(
                                (getExamSharedTimerSeconds(quizData.section_config) ??
                                  defaultExamWideTimerSeconds(assessmentType)) / 60,
                              )}{" "}
                              minutes
                            </span>
                            . Students manage that time themselves. Change the total under Sections. Per-question limits below are not the sitting clock.
                          </>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Questions Time List */}
                <Card className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 shadow-sm rounded-2xl">
                  <CardHeader className="border-b border-slate-100 dark:border-slate-700 pb-4">
                    <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span className="text-xl">⏰</span>
                      Question Time Limits
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-6">
                    {questions.map((question, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl hover:shadow-md transition-all">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 space-y-2">
                          <p className="text-sm font-medium line-clamp-2 text-slate-900 dark:text-slate-100">
                            {question.question_text || "Untitled Question"}
                          </p>
                          <div className="flex gap-2 items-center">
                            <Badge variant="outline" className="text-xs rounded-full">
                              {question.question_type || "mcq"}
                            </Badge>
                            {(() => {
                              const questionType = (question.question_type || "").toLowerCase()
                              const isExempt = isQuestionTypeExempt(questionType) || 
                                             (question as any).anti_cheat_exempt === true
                              if (isExempt) {
                                return (
                                  <Badge variant="outline" className="text-xs rounded-full bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                                    <Unlock className="h-3 w-3 mr-1" />
                                    Anti-Cheat Exempt
                                  </Badge>
                                )
                              } else {
                                return (
                                  <Badge variant="outline" className="text-xs rounded-full bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Anti-Cheat Active
                                  </Badge>
                                )
                              }
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <Label htmlFor={`time-${index}`} className="text-sm whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                            ⏱️ Time:
                          </Label>
                          <div className="relative">
                            <Input
                              id={`time-${index}`}
                              type="number"
                              min="10"
                              max="600"
                              placeholder={Number.isFinite(Number(quizData.time_per_question)) ? String(quizData.time_per_question) : "60"}
                              value={question.time_limit !== null && question.time_limit !== undefined && Number.isFinite(Number(question.time_limit)) ? Number(question.time_limit) : ""}
                              onChange={(e) => {
                                const value = e.target.value
                                updateQuestion(index, "time_limit", value === "" ? null : (parseInt(value, 10) || null))
                              }}
                              className="h-10 w-24 rounded-lg border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 pr-10"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400">
                              sec
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="defaults">
                <ManageTimeSettingsPanel userType={userType} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Settings Tab - Anti-Cheat + AI Evaluation */}
          <TabsContent value="settings" className="space-y-6 mt-6">
            {/* Code Language for AI Evaluation */}
            <Card className="border-0 shadow-sm bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/40">
                    <Zap className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  Code languages (AI grading)
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                  Select all languages students may use on AI-graded code questions (for example C++ and MATLAB on the
                  same exam), or choose <strong>None</strong> for non-coding courses. The first selected language is
                  also stored as the legacy single default. On each question card you can still override for types like
                  Code Write.
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuizData((prev) => ({
                        ...prev,
                        allowed_ai_code_languages: [],
                        code_language: "",
                      }))
                    }}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all
                      ${(quizData.allowed_ai_code_languages?.length ?? 0) === 0
                        ? "border-slate-500 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 ring-2 ring-slate-500/50"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300"
                      }`}
                  >
                    None
                    <span className="ml-1.5 text-xs text-slate-500">(no AI code grading)</span>
                  </button>
                  {AI_CODE_LANGUAGE_OPTIONS.map((lang) => {
                    const cur = quizData.allowed_ai_code_languages ?? []
                    const isSelected = cur.includes(lang.id)
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => {
                          setQuizData((prev) => {
                            const base = [...(prev.allowed_ai_code_languages ?? [])]
                            const has = base.includes(lang.id)
                            let next: string[]
                            if (has) {
                              next = base.filter((x) => x !== lang.id)
                            } else {
                              next = [...base, lang.id]
                            }
                            return {
                              ...prev,
                              allowed_ai_code_languages: next,
                              code_language: next[0] || "",
                            }
                          })
                        }}
                        className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all
                          ${isSelected
                            ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 ring-2 ring-cyan-500/50"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300"
                          }`}
                      >
                        {lang.label}
                        {lang.id === "cpp" && <span className="ml-1.5 text-xs text-slate-500">(common default)</span>}
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* AI Model Selection */}
            <Card className="border-0 shadow-sm bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                    <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  AI Grading Model
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                  Choose which AI model grades this assessment. Use Claude Sonnet for ELEG programming
                  courses; smart routing balances cost across code, circuit, and vision tasks.
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <AssessmentAiModelPicker
                  value={{
                    ai_model: quizData.ai_model || "auto",
                    ai_model_by_task: quizData.ai_model_by_task,
                    ai_enable_opus_fallback: quizData.ai_enable_opus_fallback,
                    ai_opus_confidence_threshold: quizData.ai_opus_confidence_threshold,
                  }}
                  onChange={(patch) =>
                    setQuizData((prev) => ({
                      ...prev,
                      ...patch,
                    }))
                  }
                />
              </CardContent>
            </Card>

            {/* AI Evaluation Mode */}
            <Card className="border-0 shadow-sm bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40">
                    <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  AI Grading Strictness
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
                  Choose how strictly the AI evaluates code questions. Relaxed is forgiving for practice; Very Strict is for high-stakes exams.
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(Object.values(AI_EVALUATION_MODES) as EvaluationModeConfig[]).map((mode) => {
                    const isSelected = (quizData.ai_evaluation_mode || getDefaultEvaluationMode(assessmentType)) === mode.id
                    const modeStyleById: Record<
                      string,
                      { border: string; bg: string; ring: string; text: string }
                    > = {
                      relaxed: {
                        border: "border-emerald-500",
                        bg: "bg-emerald-50 dark:bg-emerald-900/20",
                        ring: "ring-emerald-500/50",
                        text: "text-emerald-700 dark:text-emerald-400",
                      },
                      standard: {
                        border: "border-blue-500",
                        bg: "bg-blue-50 dark:bg-blue-900/20",
                        ring: "ring-blue-500/50",
                        text: "text-blue-700 dark:text-blue-400",
                      },
                      strict: {
                        border: "border-amber-500",
                        bg: "bg-amber-50 dark:bg-amber-900/20",
                        ring: "ring-amber-500/50",
                        text: "text-amber-700 dark:text-amber-400",
                      },
                      very_strict: {
                        border: "border-rose-500",
                        bg: "bg-rose-50 dark:bg-rose-900/20",
                        ring: "ring-rose-500/50",
                        text: "text-rose-700 dark:text-rose-400",
                      },
                    }
                    const colors =
                      modeStyleById[mode.id] ??
                      modeStyleById.standard
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setQuizData((prev) => ({ ...prev, ai_evaluation_mode: mode.id }))}
                        className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md
                          ${isSelected 
                            ? `${colors.border} ${colors.bg} shadow-md ring-2 ${colors.ring}` 
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          </div>
                        )}
                        <div className={`font-semibold text-slate-900 dark:text-slate-100 mb-1 ${isSelected ? colors.text : ''}`}>
                          {mode.label.replace(/ \(.*\)/, '')}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
                          {mode.description}
                        </p>
                        <span className="inline-block text-xs px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700/70 text-slate-600 dark:text-slate-400">
                          Best for: {mode.bestFor}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Default for this {assessmentLabel.toLowerCase()}: <strong>{AI_EVALUATION_MODES[getDefaultEvaluationMode(assessmentType)]?.label}</strong>
                </p>
              </CardContent>
            </Card>

            {/* Anti-Cheat */}
            {/* Anti-Cheat Info Card */}
            <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/10 border border-purple-200 dark:border-purple-800/30 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">Assessment Integrity Features</h3>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Enable anti-cheat features to maintain academic integrity during assessments. 
                      All violations will be logged and visible in the results.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Strict Mode Master Switch */}
            <Card className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border-2 border-purple-200 dark:border-purple-800/50 shadow-md rounded-2xl">
              <CardHeader className="border-b border-purple-100 dark:border-purple-800/30 pb-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-t-2xl">
                <CardTitle className="text-xl font-bold text-purple-900 dark:text-purple-100 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/50">
                    <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span>Strict Mode</span>
                      <Switch
                        checked={homeworkIntegrityExempt ? false : quizData.strict_mode_enabled}
                        disabled={homeworkIntegrityExempt}
                        onCheckedChange={(checked) =>
                          setQuizData((prev) => ({
                            ...prev,
                            strict_mode_enabled: checked,
                            ...(checked
                              ? {
                                  block_copy_paste: true,
                                  track_tab_switches: true,
                                  warn_on_tab_switch: true,
                                  auto_submit_on_violations: true,
                                  track_gemini_window: true,
                                  require_fullscreen: true,
                                }
                              : {}),
                          }))
                        }
                      />
                    </div>
                    <p className="text-sm font-normal text-purple-600 dark:text-purple-400 mt-1">
                      {homeworkIntegrityExempt
                        ? "Homework is exempt — fullscreen, tab tracking, and browser-tool locks stay off"
                        : quizData.strict_mode_enabled
                        ? "Enabled — fullscreen, tab tracking, copy/paste block, browser-tool lock, and auto-submit are on"
                        : "Disabled — turn on individual features below, or enable Strict Mode to activate all of them"}
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Copy/Paste Protection */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">📋</span>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">Block Copy/Paste</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Prevents students from copying questions or pasting answers from external sources. 
                        Keyboard shortcuts (Ctrl+C, Ctrl+V) will be disabled.
                      </p>
                    </div>
                    <Switch
                      checked={quizData.block_copy_paste}
                      onCheckedChange={(checked) =>
                        setQuizData((prev) => ({ ...prev, block_copy_paste: checked }))
                      }
                    />
                  </div>
                </div>

                {/* Keystroke Playback Enforcement */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">⌨️</span>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">Keystroke Playback Enforcement</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Records how students type code for AI evaluation. Suspicious patterns (e.g. large pastes) may trigger score deductions based on AI evaluation mode.
                      </p>
                    </div>
                    <Switch
                      checked={quizData.keystroke_playback_enforced ?? true}
                      onCheckedChange={(checked) =>
                        setQuizData((prev) => ({ ...prev, keystroke_playback_enforced: checked }))
                      }
                    />
                  </div>
                </div>

                {/* Tab Switching Tracking */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🔄</span>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">Track Tab Switches</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Monitors when students switch to other browser tabs. Violations are logged and can trigger warnings.
                      </p>
                      
                      {/* Sub-options */}
                      {quizData.track_tab_switches && (
                        <div className="space-y-3 mt-3 pl-4 border-l-2 border-purple-300 dark:border-purple-700">
                          {/* Warn on Tab Switch */}
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className={eLabel}>
                                Show Warning Modal
                              </p>
                              <p className={eHint}>
                                Display a warning when student switches tabs
                              </p>
                            </div>
                            <Switch
                              checked={quizData.warn_on_tab_switch}
                              onCheckedChange={(checked) =>
                                setQuizData((prev) => ({ ...prev, warn_on_tab_switch: checked }))
                              }
                            />
                          </div>

                          {/* Max Tab Switches */}
                          <div className="space-y-2">
                            <Label htmlFor="max-tab-switches" className={eLabel}>
                              Maximum Tab Switches
                            </Label>
                            <div className="flex items-center gap-3">
                              <Input
                                id="max-tab-switches"
                                type="number"
                                min="1"
                                max="20"
                                value={Number.isFinite(Number(quizData.max_tab_switches)) ? Number(quizData.max_tab_switches) : ""}
                                onChange={(e) => {
                                  const v = e.target.value
                                  const n = v === "" ? 5 : parseInt(v, 10)
                                  setQuizData((prev) => ({ ...prev, max_tab_switches: Number.isFinite(n) ? n : 5 }))
                                }}
                                className="w-20"
                              />
                              <span className="text-sm text-slate-600 dark:text-slate-400">violations allowed</span>
                            </div>
                          </div>

                          {/* Auto Submit on Violations */}
                          <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                                Auto-Submit on Max Violations
                              </p>
                              <p className="text-xs text-red-700 dark:text-red-300">
                                Automatically submit assessment when max violations reached
                              </p>
                            </div>
                            <Switch
                              checked={quizData.auto_submit_on_violations}
                              onCheckedChange={(checked) =>
                                setQuizData((prev) => ({ ...prev, auto_submit_on_violations: checked }))
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <Switch
                      checked={quizData.track_tab_switches}
                      onCheckedChange={(checked) =>
                        setQuizData((prev) => ({ ...prev, track_tab_switches: checked }))
                      }
                    />
                  </div>
                </div>

                {/* Question Exemptions */}
                <div className="space-y-3 pt-4 border-t border-purple-200 dark:border-purple-800/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Unlock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">Question Exemptions</h4>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    Select questions that should be exempt from anti-cheat protections. These questions will allow students to use external tools or resources (e.g., MATLAB for plot generation).
                  </p>
                  
                  {/* Questions List */}
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {questions.map((question, index) => {
                      const questionType = (question.question_type || "").toLowerCase()
                      const isAutoExempt = isQuestionTypeExempt(questionType)
                      const isExempt = isAutoExempt || (question.anti_cheat_exempt === true)
                      
                      return (
                        <div
                          key={index}
                          className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                            isExempt
                              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"
                              : "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <div className="flex-shrink-0 mt-1">
                            {isAutoExempt ? (
                              <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                                Auto
                              </Badge>
                            ) : (
                              <Switch
                                checked={question.anti_cheat_exempt === true}
                                onCheckedChange={(checked) => {
                                  updateQuestion(index, "anti_cheat_exempt", checked)
                                }}
                                disabled={isAutoExempt}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Question {index + 1}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {question.question_type || "mcq"}
                                  </Badge>
                                  {isExempt && (
                                    <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                                      <Unlock className="h-3 w-3 mr-1" />
                                      Exempt
                                    </Badge>
                                  )}
                                  {!isExempt && (
                                    <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300">
                                      <Shield className="h-3 w-3 mr-1" />
                                      Protected
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                  {question.question_text || "No question text"}
                                </p>
                                {isAutoExempt && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                    This question type is automatically exempt from anti-cheat.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {questions.length === 0 && (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                      <p>No questions available. Add questions in the Questions tab first.</p>
                    </div>
                  )}
                </div>

                {/* Mouse Movement Tracking */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🖱️</span>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">Track Mouse Movement</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Logs when the mouse leaves the assessment window. Useful for detecting potential external resource usage.
                      </p>
                    </div>
                    <Switch
                      checked={quizData.track_mouse_movement}
                      onCheckedChange={(checked) =>
                        setQuizData((prev) => ({ ...prev, track_mouse_movement: checked }))
                      }
                    />
                  </div>
                </div>

                {/* Gemini/Browser AI Detection */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🤖</span>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100">Detect Browser AI Tools</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Detects browser AI side-panels (like Gemini) by monitoring viewport changes and window dimensions. 
                        Violations are logged and can trigger auto-submission.
                      </p>
                      
                      {/* Sub-options */}
                      {quizData.track_gemini_window && (
                        <div className="space-y-3 mt-3 pl-4 border-l-2 border-purple-300 dark:border-purple-700">
                          {/* Max Gemini Strikes */}
                          <div className="space-y-2">
                            <Label htmlFor="max-gemini-strikes" className={eLabel}>
                              Maximum Gemini Strikes
                            </Label>
                            <div className="flex items-center gap-3">
                              <Input
                                id="max-gemini-strikes"
                                type="number"
                                min="1"
                                max="10"
                                value={Number.isFinite(Number(quizData.max_gemini_strikes)) ? Number(quizData.max_gemini_strikes) : ""}
                                onChange={(e) => {
                                  const v = e.target.value
                                  const n = v === "" ? 5 : parseInt(v, 10)
                                  setQuizData((prev) => ({ ...prev, max_gemini_strikes: Number.isFinite(n) ? n : 5 }))
                                }}
                                className="w-20"
                              />
                              <span className="text-sm text-slate-600 dark:text-slate-400">strikes before auto-submit</span>
                            </div>
                            <p className={eHint}>
                              Assessment will be automatically submitted when this limit is reached (if auto-submit is enabled).
                            </p>
                          </div>

                          {/* Auto Submit Note */}
                          {quizData.auto_submit_on_violations && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg">
                              <p className="text-xs text-red-700 dark:text-red-300">
                                ⚠️ Auto-submit is enabled. Students will be automatically submitted after {quizData.max_gemini_strikes} Gemini detections.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <Switch
                      checked={quizData.track_gemini_window}
                      onCheckedChange={(checked) =>
                        setQuizData((prev) => ({ ...prev, track_gemini_window: checked }))
                      }
                    />
                  </div>
                </div>

                {/* Important Note */}
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                        Important: Communicate with Students
                      </h5>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        Always inform students in advance when anti-cheat features are enabled. 
                        This helps prevent confusion and ensures a fair assessment environment.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scores & Issues Tab */}
          <TabsContent value="scores" className="space-y-6 mt-6">
            <ManageScoresPanel userType={userType} assessmentType={assessmentType} />
            <InstructorQuizIssues assessmentId={parseInt(quizId)} assessmentType={assessmentType} />
          </TabsContent>
        </Tabs>

        {/* Submit Buttons - Sticky Footer */}
        <Card className={eStickyBar}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 order-2 sm:order-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
                <span className="hidden sm:inline"> • </span>
                <span className="hidden sm:inline">
                  {quizData.retake_enabled ? `Retakes: ${Number(quizData.retake_limit) === 0 ? 'None' : (Number.isFinite(Number(quizData.retake_limit)) ? quizData.retake_limit : 0)}` : 'No retakes'}
                  {' • '}
                </span>
                {Number.isFinite(Number(quizData.time_per_question)) ? quizData.time_per_question : 60}s default
              </div>
              <div className="flex gap-3 justify-end order-1 sm:order-2">
                <Link href={listPath}>
                  <Button type="button" variant="outline" className="rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800">
                    Back
                  </Button>
                </Link>
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-md px-6 sm:px-8 font-medium min-w-[140px]" 
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      💾 Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      <AddQuestionModal
        open={showAddQuestionModal}
        onClose={() => setShowAddQuestionModal(false)}
        onAddNew={addQuestion}
        onAddFromBank={addQuestionFromBank}
        useInstructorBank={isInstructorPath}
      />

      <AlertDialog
        open={deleteQuestionIndex != null}
        onOpenChange={(open) => {
          if (!open) setDeleteQuestionIndex(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete question {(deleteQuestionIndex ?? 0) + 1}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the question from this assessment. You can still cancel if this was a
              mistake.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveQuestion}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete question
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
