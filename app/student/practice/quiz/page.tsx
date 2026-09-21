"use client"


import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  CheckCircle2,
  ArrowLeft,
  Grid3x3,
  Sparkles,
} from "lucide-react"
import { StudentHeader } from "@/components/student-header"
import { useToast } from "@/hooks/use-toast"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { getPracticePath } from "@/lib/student-dashboard-paths"
import { cn } from "@/lib/utils"
import { QuestionRenderer } from "@/components/question-renderer"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { QuestionStemWithMedia } from "@/components/question-media-display"
import { motion } from "framer-motion"
import { CoraAskDrawer } from "@/components/cora/CoraAskDrawer"
import { canStudentAskCora } from "@/lib/cora/ask-cora-eligibility"
import { coraContextFromQuestion } from "@/lib/cora/question-context"
import { CORA_NAME } from "@/lib/cora/constants"
import { isPracticePartialCredit, type PracticeAnswerReview } from "@/lib/practice-answer-review"
import { getStudentCourseIdFromSession } from "@/lib/student-session-ids"
import { getPracticeCompactLayoutPreference } from "@/lib/practice-hub-preferences"
import {
  calculatePracticeQuestionXp,
  DEFAULT_PRACTICE_HUB_POLICY,
  parsePracticeHubPolicy,
  type PracticeHubPolicy,
} from "@/lib/practice-hub-policy-settings"
import {
  circuitSubmissionHasRequiredUpload,
  parseCircuitSubmissionConfig,
} from "@/lib/circuit-submission"
import {
  allGuidedPartsVerified,
  parseGuidedMultiPartConfig,
} from "@/lib/guided-multi-part"
import { parseMultiPartStudentAnswer, getGradableSubquestions, parseSubquestions } from "@/lib/multi-part-question"
import { QuestionPrepareGate } from "@/components/question-prepare-gate"

interface Question {
  id: number
  question_text: string
  question_type: string
  hint: string | null
  difficulty: string
  topic: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e?: string
  correct_answer: string
  question_media?: unknown
  subquestions?: unknown
  solution_upload_config?: unknown
  alreadyAttempted?: boolean
  priorAnswer?: string | string[]
  priorIsCorrect?: boolean
  answerReview?: PracticeAnswerReview
}

function isSelfContainedQuestionType(type: string): boolean {
  const t = type.toLowerCase()
  return t === "circuit_submission" || t === "multi_part"
}

function questionTypeHint(type: string): string {
  const t = type.toLowerCase()
  if (t === "select_all" || t === "multi_output") return "Select all that apply"
  if (t === "circuit_submission") return "Upload your worked solution"
  if (t === "multi_part") return "Answer each part below"
  return "Select one answer"
}

function isPracticeItemLocked(
  question: Pick<Question, "id" | "alreadyAttempted"> | undefined,
  reviewOnly: boolean,
  lockedQuestions: Set<number>,
): boolean {
  if (!question) return true
  return reviewOnly || question.alreadyAttempted === true || lockedQuestions.has(question.id)
}

export default function PracticeQuizPage({ embedded = false }: { embedded?: boolean }) {
  const practiceHref = embedded ? getPracticePath() : "/student/practice"
  const router = useRouter()
  const { toast } = useToast()

  const [studentId, setStudentId] = useState<number | null>(null)
  const [attemptId, setAttemptId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({})
  const [showHint, setShowHint] = useState(false)
  const [startTime] = useState(Date.now())
  const [submitting, setSubmitting] = useState(false)
  
  // Additional state for QuestionRenderer compatibility
  const [selectedAnswer, setSelectedAnswer] = useState<string>("")
  const [selectedMultiAnswers, setSelectedMultiAnswers] = useState<string[]>([])
  const [code, setCode] = useState("")
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)
  const [partialCreditPoints, setPartialCreditPoints] = useState<number | null>(null)
  const [aiFeedback, setAiFeedback] = useState<Record<string, unknown> | null>(null)
  const [attemptCount, setAttemptCount] = useState<Record<number, number>>({})
  const [questionStartTime, setQuestionStartTime] = useState<Record<number, number>>({})
  const [questionResponseTime, setQuestionResponseTime] = useState<Record<number, number>>({})
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set())
  const [lockedQuestions, setLockedQuestions] = useState<Set<number>>(new Set())
  const [answerReviews, setAnswerReviews] = useState<Record<number, PracticeAnswerReview>>({})
  const [compactLayout] = useState(() =>
    typeof window !== "undefined" ? getPracticeCompactLayoutPreference() : true,
  )
  const [hubPolicy, setHubPolicy] = useState<PracticeHubPolicy>(DEFAULT_PRACTICE_HUB_POLICY)
  const [hydrating, setHydrating] = useState(true)
  const [coraDrawerOpen, setCoraDrawerOpen] = useState(false)
  const [reviewOnly, setReviewOnly] = useState(false)

  useEffect(() => {
    let cancelled = false
    const studentData = getStudentData()
    if (!studentData || !studentData.databaseId) {
      router.push("/student/login")
      return
    }

    const dbId = Number.parseInt(studentData.databaseId)
    setStudentId(dbId)

    const courseId = getStudentCourseIdFromSession()
    const courseQs = courseId != null ? `&courseId=${courseId}` : ""
    const sessionQs = studentData.section
      ? `&session=${encodeURIComponent(studentData.section)}`
      : ""
    void studentApiFetch(`/api/practice/config?studentId=${dbId}${courseQs}`)
      .then((r) => r.json())
      .then((data) => {
        const s = data.policy?.scoring
        const ux = data.policy?.ux
        if (s) {
          setHubPolicy(
            parsePracticeHubPolicy({
              ...DEFAULT_PRACTICE_HUB_POLICY,
              points_easy: s.pointsEasy,
              points_medium: s.pointsMedium,
              points_hard: s.pointsHard,
              speed_bonus_max: s.speedBonusMax,
              speed_bonus_window_ms: s.speedBonusWindowMs,
              first_attempt_bonus: s.firstAttemptBonus,
              xp_multiplier: s.xpMultiplier,
              allow_hints: ux?.allowHints ?? DEFAULT_PRACTICE_HUB_POLICY.allow_hints,
              max_attempts_per_question:
                ux?.maxAttemptsPerQuestion ?? DEFAULT_PRACTICE_HUB_POLICY.max_attempts_per_question,
              show_explanations_after_wrong:
                ux?.showExplanationsAfterWrong ?? DEFAULT_PRACTICE_HUB_POLICY.show_explanations_after_wrong,
            }),
          )
        }
      })
      .catch(() => {})

    const storedAttemptId = sessionStorage.getItem("practiceAttemptId")
    const storedReviewOnly = sessionStorage.getItem("practiceReviewOnly") === "1"
    const storedQuestions =
      sessionStorage.getItem("practiceQuestions") ??
      (storedAttemptId ? sessionStorage.getItem(`practiceQuestions:${storedAttemptId}`) : null)

    if (!storedQuestions || (!storedAttemptId && !storedReviewOnly)) {
      setHydrating(false)
      toast({
        title: "No practice session found",
        description: "Please start a new practice session",
        variant: "destructive",
      })
      router.push(practiceHref)
      return
    }

    const attemptNum =
      storedAttemptId && storedAttemptId !== "0" ? Number.parseInt(storedAttemptId, 10) : null
    if (attemptNum && Number.isFinite(attemptNum)) {
      setAttemptId(attemptNum)
    }
    setReviewOnly(storedReviewOnly)

    void (async () => {
      try {
        const parsedQuestions = JSON.parse(storedQuestions) as Question[]
        const restoredAnswers: Record<number, string | string[]> = {}
        const restoredAnswered = new Set<number>()
        const restoredLocked = new Set<number>()
        const restoredReviews: Record<number, PracticeAnswerReview> = {}

        const lockQuestion = (
          questionId: number,
          priorAnswer?: string | string[] | null,
          answerReview?: PracticeAnswerReview | null,
        ) => {
          restoredAnswered.add(questionId)
          restoredLocked.add(questionId)
          if (priorAnswer != null) restoredAnswers[questionId] = priorAnswer
          if (answerReview) restoredReviews[questionId] = answerReview
        }

        for (const q of parsedQuestions) {
          if (!q.alreadyAttempted && !q.answerReview) continue
          lockQuestion(q.id, q.priorAnswer, q.answerReview)
        }

        const questionIds = parsedQuestions
          .map((q) => Number(q.id))
          .filter((id) => Number.isFinite(id) && id > 0)

        const hydrateFromPriors =
          questionIds.length === 0
            ? Promise.resolve()
            : studentApiFetch(
                `/api/practice/prior-answers?studentId=${dbId}&questionIds=${questionIds.join(",")}${courseQs}${sessionQs}`,
              )
                .then(async (response) => {
                  if (!response.ok) return
                  const data = await response.json()
                  const rows = Array.isArray(data.answers) ? data.answers : []
                  for (const row of rows as Array<{
                    questionId?: number
                    priorAnswer?: string | string[]
                    answerReview?: PracticeAnswerReview | null
                  }>) {
                    const questionId = Number(row.questionId)
                    if (!Number.isFinite(questionId) || questionId < 1) continue
                    lockQuestion(questionId, row.priorAnswer, row.answerReview)
                  }
                })
                .catch(() => {})

        const hydrateFromAttempt =
          storedReviewOnly || !attemptNum || !Number.isFinite(attemptNum)
            ? Promise.resolve()
            : studentApiFetch(`/api/practice/attempt/${attemptNum}/state`)
                .then(async (response) => {
                  if (!response.ok) return
                  const data = await response.json()
                  if (data.completedAt) {
                    sessionStorage.removeItem("practiceAttemptId")
                    sessionStorage.removeItem("practiceQuestions")
                    sessionStorage.removeItem("practiceReviewOnly")
                    router.push(`/student/practice/results/${attemptNum}`)
                    return
                  }
                  if (!Array.isArray(data.answers)) return
                  for (const row of data.answers as Array<{
                    questionId: number
                    studentAnswer: string | string[]
                  }>) {
                    lockQuestion(row.questionId, row.studentAnswer)
                  }
                })
                .catch(() => {})

        await Promise.all([hydrateFromPriors, hydrateFromAttempt])
        if (cancelled) return

        setQuestions(
          parsedQuestions.map((q) =>
            restoredLocked.has(q.id)
              ? {
                  ...q,
                  alreadyAttempted: true,
                  priorAnswer: restoredAnswers[q.id] ?? q.priorAnswer,
                  answerReview: restoredReviews[q.id] ?? q.answerReview,
                }
              : q,
          ),
        )
        setAnswers((prev) => ({ ...prev, ...restoredAnswers }))
        setAnsweredQuestions((prev) => new Set([...prev, ...restoredAnswered]))
        setLockedQuestions((prev) => new Set([...prev, ...restoredLocked]))
        setAnswerReviews((prev) => ({ ...prev, ...restoredReviews }))
      } catch {
        if (cancelled) return
        toast({
          title: "Could not load practice session",
          description: "Please start a new practice session",
          variant: "destructive",
        })
        router.push(practiceHref)
      } finally {
        if (!cancelled) setHydrating(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router, toast, practiceHref])

  const prepareTexts = useMemo(() => {
    return questions.flatMap((q) => {
      const parts = [q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.hint]
      return parts.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    })
  }, [questions])

  // Sync QuestionRenderer state when currentIndex changes
  useEffect(() => {
    if (questions.length > 0 && currentIndex < questions.length) {
      const currentQuestion = questions[currentIndex]
      const savedAnswer = answers[currentQuestion.id]
      
      // Track question start time (once per visit)
      setQuestionStartTime(prev => ({
        ...prev,
        [currentQuestion.id]: prev[currentQuestion.id] ?? Date.now(),
      }))
      
      if (typeof savedAnswer === 'string') {
        setSelectedAnswer(savedAnswer)
        setSelectedMultiAnswers([])
      } else if (Array.isArray(savedAnswer)) {
        setSelectedMultiAnswers(savedAnswer)
        setSelectedAnswer("")
      } else {
        setSelectedAnswer("")
        setSelectedMultiAnswers([])
      }
      
      const review = answerReviews[currentQuestion.id]
      if (review) {
        setShowFeedback(true)
        setIsCorrect(review.isCorrect)
        setPartialCreditPoints(
          isPracticePartialCredit(review) && typeof review.pointsEarned === "number"
            ? review.pointsEarned
            : null,
        )
      } else {
        setShowFeedback(false)
        setIsCorrect(false)
        setPartialCreditPoints(null)
      }
      setIsSubmittingAnswer(false)
      setAiFeedback(null)
    }
  }, [currentIndex, questions, answerReviews, hydrating])

  const currentQuestion = questions[currentIndex]
  const progress = ((currentIndex + 1) / questions.length) * 100
  const canAskCoraOnCurrentQuestion = canStudentAskCora(currentQuestion?.question_type, {
    subquestionTypes: parseSubquestions(currentQuestion?.subquestions).map((sq) => sq.type),
  })

  useEffect(() => {
    if (!canAskCoraOnCurrentQuestion) setCoraDrawerOpen(false)
  }, [canAskCoraOnCurrentQuestion, currentQuestion?.id])

  const coraStudentWork = useMemo(() => {
    if (!currentQuestion) return ""
    const qType = currentQuestion.question_type.toLowerCase()
    if (qType === "code_write" || qType === "code_write_plot") return code
    if (qType === "select_all" || qType === "multi_output") {
      return selectedMultiAnswers.length > 0 ? selectedMultiAnswers.join(", ") : ""
    }
    const saved = answers[currentQuestion.id]
    if (Array.isArray(saved)) return saved.join(", ")
    return selectedAnswer || (typeof saved === "string" ? saved : "")
  }, [answers, code, currentQuestion, selectedAnswer, selectedMultiAnswers])

  const handleAnswer = (value: string | string[]) => {
    if (isPracticeItemLocked(currentQuestion, reviewOnly, lockedQuestions)) return
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }))

    if (typeof value === "string") {
      setSelectedAnswer(value)
      setSelectedMultiAnswers([])
    } else {
      setSelectedMultiAnswers(value)
      setSelectedAnswer("")
    }
  }

  const handleAnswerSelect = (answer: string) => {
    handleAnswer(answer)
  }

  const handleMultiAnswerToggle = (option: string) => {
    const current = Array.isArray(answers[currentQuestion.id])
      ? answers[currentQuestion.id] as string[]
      : []
    
    const newAnswers = current.includes(option)
      ? current.filter((a) => a !== option)
      : [...current, option]
    
    handleAnswer(newAnswers)
  }

  const handleCodeChange = (value: string | undefined) => {
    if (isPracticeItemLocked(currentQuestion, reviewOnly, lockedQuestions)) return
    if (value !== undefined) {
      setCode(value)
    }
  }

  const submitAnswer = async () => {
    if (!currentQuestion || isSubmittingAnswer) return
    if (isPracticeItemLocked(currentQuestion, reviewOnly, lockedQuestions)) {
      toast({
        title: "Already attempted",
        description: "This question is locked. Review your previous answer below.",
      })
      return
    }

    const qType = currentQuestion.question_type.toLowerCase()
    let answerToSubmit: string | string[] =
      qType === "select_all" || qType === "multi_output"
        ? selectedMultiAnswers
        : selectedAnswer || code

    if (qType === "circuit_submission") {
      const raw = selectedAnswer || String(answers[currentQuestion.id] ?? "")
      const cfg = parseCircuitSubmissionConfig(currentQuestion.solution_upload_config)
      if (!circuitSubmissionHasRequiredUpload(raw, cfg)) {
        toast({
          title: "No solution uploaded",
          description: "Attach at least one file before submitting.",
          variant: "destructive",
        })
        return
      }
      answerToSubmit = raw
    } else if (qType === "multi_part") {
      const raw = selectedAnswer || String(answers[currentQuestion.id] ?? "")
      if (!raw || raw === "{}") {
        toast({
          title: "Incomplete answer",
          description: "Answer the parts below before submitting.",
          variant: "destructive",
        })
        return
      }
      const guided = parseGuidedMultiPartConfig(currentQuestion.solution_upload_config)
      if (guided.enabled) {
        const subs = getGradableSubquestions(currentQuestion.subquestions)
        const parsed = parseMultiPartStudentAnswer(raw, subs)
        if (!allGuidedPartsVerified(currentQuestion.subquestions, parsed.guided_verified, guided)) {
          toast({
            title: "Finish the guided steps",
            description: "Check each step in order before submitting the full question.",
            variant: "destructive",
          })
          return
        }
      }
      answerToSubmit = raw
    } else if (
      !answerToSubmit ||
      (Array.isArray(answerToSubmit) && answerToSubmit.length === 0)
    ) {
      toast({
        title: "No answer selected",
        description: "Please select an answer before submitting.",
        variant: "destructive",
      })
      return
    }

    // Convert letter answers to option text values (MCQ-style only)
    const convertLetterToOption = (letter: string): string => {
      const optionMap: Record<string, string> = {
        A: currentQuestion.option_a,
        B: currentQuestion.option_b,
        C: currentQuestion.option_c,
        D: currentQuestion.option_d,
        E: currentQuestion.option_e || "",
      }
      return optionMap[letter] || letter
    }

    if (qType !== "circuit_submission" && qType !== "multi_part") {
      if (Array.isArray(answerToSubmit)) {
        answerToSubmit = answerToSubmit.map(convertLetterToOption)
      } else if (
        typeof answerToSubmit === "string" &&
        ["A", "B", "C", "D", "E"].includes(answerToSubmit)
      ) {
        answerToSubmit = convertLetterToOption(answerToSubmit)
      }
    }

    setIsSubmittingAnswer(true)
    const newAttemptCount = (attemptCount[currentQuestion.id] || 0) + 1

    if (
      hubPolicy.max_attempts_per_question > 0 &&
      newAttemptCount > hubPolicy.max_attempts_per_question
    ) {
      toast({
        title: "Attempt limit reached",
        description: `You can try this question up to ${hubPolicy.max_attempts_per_question} time(s) per session.`,
        variant: "destructive",
      })
      setIsSubmittingAnswer(false)
      return
    }

    // Calculate response time
    const startTime = questionStartTime[currentQuestion.id] || Date.now()
    const responseTime = Date.now() - startTime

    const { totalPoints, xp: calculatedXP } = calculatePracticeQuestionXp(hubPolicy, {
      difficulty: currentQuestion.difficulty,
      responseTimeMs: responseTime,
      attemptNumber: newAttemptCount,
    })

    console.log("[Practice Quiz] Submitting answer:", {
      questionId: currentQuestion.id,
      originalAnswer: currentQuestion.question_type === "select_all" || currentQuestion.question_type === "multi_output"
        ? selectedMultiAnswers
        : selectedAnswer || code,
      convertedAnswer: answerToSubmit,
      attempt: newAttemptCount,
      responseTime: responseTime,
      calculatedXP: calculatedXP,
      difficulty: currentQuestion.difficulty
    })

    try {
      const isUploadType =
        currentQuestion.question_type === "circuit_submission" ||
        currentQuestion.question_type === "multi_part"

      const response = await studentApiFetch("/api/practice/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer: answerToSubmit,
          questionType: currentQuestion.question_type,
          attemptId,
          responseTimeMs: Math.round(responseTime),
          xpEarned: calculatedXP,
          difficulty: currentQuestion.difficulty,
        }),
        signal: isUploadType ? AbortSignal.timeout(180000) : undefined,
      })

      const evalData = await response.json()
      console.log("[Practice Quiz] Evaluation response:", evalData)

      if (response.status === 409 || evalData.alreadyAttempted === true) {
        setAnsweredQuestions((prev) => new Set(prev).add(currentQuestion.id))
        setLockedQuestions((prev) => new Set(prev).add(currentQuestion.id))
        if (evalData.priorAnswer != null) {
          setAnswers((prev) => ({ ...prev, [currentQuestion.id]: evalData.priorAnswer }))
        }
        setIsCorrect(Boolean(evalData.isCorrect))
        setShowFeedback(true)
        if (evalData.answerReview) {
          setAnswerReviews((prev) => ({
            ...prev,
            [currentQuestion.id]: evalData.answerReview as PracticeAnswerReview,
          }))
        }
        toast({
          title: "Already attempted",
          description: "This question was already answered. Your previous result is shown below.",
        })
        setIsSubmittingAnswer(false)
        return
      }

      if (!response.ok) {
        throw new Error(evalData.error || "Failed to evaluate answer")
      }

      const isAIGraded = evalData.aiGraded === true
      const review = evalData.answerReview as PracticeAnswerReview | undefined
      const isPartial = review ? isPracticePartialCredit(review) : false

      if (isAIGraded) {
        setAiFeedback(evalData)
        setPartialCreditPoints(
          typeof evalData.pointsEarned === "number" ? evalData.pointsEarned : null,
        )
      } else if (isPartial && typeof evalData.pointsEarned === "number") {
        setAiFeedback(null)
        setPartialCreditPoints(evalData.pointsEarned)
      } else {
        setAiFeedback(null)
        setPartialCreditPoints(null)
      }

      // Update attempt count and response time
      setAttemptCount(prev => ({
        ...prev,
        [currentQuestion.id]: newAttemptCount
      }))

      setQuestionResponseTime(prev => ({
        ...prev,
        [currentQuestion.id]: responseTime
      }))

      // Lock the question and mark as answered
      setAnsweredQuestions(prev => new Set(prev).add(currentQuestion.id))
      setLockedQuestions(prev => new Set(prev).add(currentQuestion.id))

      // Show feedback immediately
      setIsCorrect(evalData.isCorrect)
      setShowFeedback(true)
      if (evalData.answerReview) {
        setAnswerReviews((prev) => ({
          ...prev,
          [currentQuestion.id]: evalData.answerReview as PracticeAnswerReview,
        }))
      }

      const awardedXp = typeof evalData.xpEarned === "number" ? evalData.xpEarned : calculatedXP

      if (evalData.attemptFinalized === true) {
        sessionStorage.removeItem("practiceAttemptId")
        sessionStorage.removeItem("practiceQuestions")
        toast({
          title: "🎯 Practice Complete!",
          description: `You scored ${evalData.finalScore ?? 0}% (${evalData.finalCorrectCount ?? 0}/${evalData.attemptProgress?.total ?? questions.length})`,
        })
        router.push(`/student/practice/results/${attemptId}`)
        return
      }

      // Calculate XP and update progress
      if (evalData.isCorrect) {
        toast({
          title: evalData.autoApproved ? "Points awarded!" : "🎉 Excellent Work!",
          description: isAIGraded && evalData.feedback
            ? String(evalData.feedback).slice(0, 200)
            : `+${totalPoints} points • +${awardedXp} XP • ${Math.round(responseTime / 1000)}s`,
          variant: "default",
          className: "border-green-500 bg-gradient-to-r from-green-50 to-emerald-50",
        })
      } else if (isPartial) {
        const scorePct =
          typeof evalData.score === "number"
            ? Math.round(evalData.score)
            : typeof evalData.pointsEarned === "number" && typeof evalData.maxPoints === "number"
              ? Math.round((evalData.pointsEarned / evalData.maxPoints) * 100)
              : null
        toast({
          title: "Partial credit",
          description:
            scorePct != null
              ? `You earned ${scorePct}% of the points for this question.`
              : "Some of your selections were correct.",
          variant: "default",
          className: "border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50",
        })
      } else {
        toast({
          title: isAIGraded ? "AI feedback ready" : "💪 Keep Learning!",
          description: isAIGraded && evalData.feedback
            ? String(evalData.feedback).slice(0, 200)
            : "Every mistake is a step closer to mastery. Try again!",
          variant: isAIGraded ? "default" : "destructive",
          className: isAIGraded
            ? "border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50"
            : "border-red-500 bg-gradient-to-r from-red-100 to-orange-100 text-red-900 shadow-lg",
        })
      }

      const feedbackDelay = isAIGraded ? 12000 : 2500
      if (evalData.isCorrect) {
        setTimeout(() => {
          setAiFeedback(null)
          setIsSubmittingAnswer(false)
          if (currentIndex < questions.length - 1) {
            handleNext()
          }
        }, feedbackDelay)
      } else {
        setIsSubmittingAnswer(false)
      }

    } catch (error) {
      console.error("[Practice Quiz] Evaluation error:", error)
      toast({
        title: "Submission failed",
        description: "Failed to submit answer. Please try again.",
        variant: "destructive",
      })
      setIsSubmittingAnswer(false)
    }
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setShowHint(false)
      setShowFeedback(false)
      setIsCorrect(false)
      setIsSubmittingAnswer(false)
      setAiFeedback(null)
      // Sync QuestionRenderer state
      const nextQuestion = questions[currentIndex + 1]
      if (nextQuestion) {
        const savedAnswer = answers[nextQuestion.id]
        if (typeof savedAnswer === 'string') {
          setSelectedAnswer(savedAnswer)
          setSelectedMultiAnswers([])
        } else if (Array.isArray(savedAnswer)) {
          setSelectedMultiAnswers(savedAnswer)
          setSelectedAnswer("")
        } else {
          setSelectedAnswer("")
          setSelectedMultiAnswers([])
        }
      }
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setShowHint(false)
      setShowFeedback(false)
      setIsCorrect(false)
      setIsSubmittingAnswer(false)
      setAiFeedback(null)
      // Sync QuestionRenderer state
      const prevQuestion = questions[currentIndex - 1]
      if (prevQuestion) {
        const savedAnswer = answers[prevQuestion.id]
        if (typeof savedAnswer === 'string') {
          setSelectedAnswer(savedAnswer)
          setSelectedMultiAnswers([])
        } else if (Array.isArray(savedAnswer)) {
          setSelectedMultiAnswers(savedAnswer)
          setSelectedAnswer("")
        } else {
          setSelectedAnswer("")
          setSelectedMultiAnswers([])
        }
      }
    }
  }

  const handleSubmit = async () => {
    if (reviewOnly || !attemptId) {
      sessionStorage.removeItem("practiceAttemptId")
      sessionStorage.removeItem("practiceQuestions")
      sessionStorage.removeItem("practiceReviewOnly")
      router.push(practiceHref)
      return
    }
    if (answeredQuestions.size === 0) {
      toast({
        title: "No answers submitted",
        description: "Submit at least one answer before completing practice.",
        variant: "destructive",
      })
      return
    }

    console.log("[Practice Quiz] Submitting answers:", answers)
    console.log("[Practice Quiz] Questions:", questions.map(q => ({
      id: q.id,
      question_type: q.question_type,
      correct_answer: q.correct_answer,
      correct_answer_type: typeof q.correct_answer
    })))

    setSubmitting(true)

    try {
      const response = await studentApiFetch("/api/student/practice/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-student-id": studentId?.toString() || "",
        },
        body: JSON.stringify({
          attemptId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to submit practice")
      }

      const result = await response.json()

      toast({
        title: "🎯 Practice Complete!",
        description: `You scored ${result.score}% (${result.correctCount}/${result.totalQuestions})`,
      })

      // Clear session storage
      sessionStorage.removeItem("practiceAttemptId")
      sessionStorage.removeItem("practiceQuestions")
      sessionStorage.removeItem("practiceReviewOnly")

      // Redirect to practice hub with success message
      router.push(`/student/practice/results/${attemptId}`)
    } catch (error) {
      console.error("Failed to submit practice:", error)
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!currentQuestion) {
    return (
      <div
        className={cn(
          embedded || compactLayout
            ? "relative text-slate-900 dark:text-slate-100"
            : "relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100",
        )}
      >
        {!embedded && <StudentHeader />}
        <div
          className={cn(
            "relative container mx-auto max-w-4xl min-h-[420px] px-3 sm:px-4",
            embedded ? "py-4 sm:py-6" : "py-6 sm:py-8",
          )}
        >
          <QuestionPrepareGate
            fetching={hydrating || questions.length === 0}
            texts={prepareTexts}
            title="Preparing practice"
            subtitle="Loading questions, math, and answer choices"
          >
            <div className="min-h-[360px]" />
          </QuestionPrepareGate>
        </div>
      </div>
    )
  }

  const selfContained = isSelfContainedQuestionType(currentQuestion.question_type)
  /** circuit_submission renders its diagram inside submission fields (same as quiz taker). */
  const showStemWithMedia =
    currentQuestion.question_type.toLowerCase() !== "circuit_submission"

  return (
    <div
      className={cn(
        embedded || compactLayout ? "text-slate-900 dark:text-slate-100" : "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100",
      )}
    >
      {/* Glass Header */}
      {!embedded && <StudentHeader />}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch",
          coraDrawerOpen && canAskCoraOnCurrentQuestion && "md:max-w-none",
        )}
      >
      <main
        className={cn(
          "relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-4",
          coraDrawerOpen && canAskCoraOnCurrentQuestion
            ? "container mx-auto max-w-4xl md:max-w-none md:px-5"
            : "container mx-auto max-w-4xl",
          embedded ? "py-4 sm:py-6 min-h-[420px]" : "py-6 sm:py-8",
        )}
      >
        <QuestionPrepareGate
          fetching={hydrating}
          texts={prepareTexts}
          title="Preparing practice"
          subtitle="Loading questions, math, and answer choices"
        >
        {/* Top Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Practice Mode
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
              Test your skills — each question counts!
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 rounded-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
            onClick={() => router.push(practiceHref)}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Hub
          </Button>
        </div>

        {/* Question Navigation */}
        <div className="mb-6">
          <Card className="border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 backdrop-blur-sm rounded-xl shadow-sm dark:shadow-slate-950/40 transition-all duration-300">
            <CardHeader className="pb-3 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950/60 rounded-lg">
                    <Grid3x3 className="h-4 w-4 text-indigo-700 dark:text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Question Navigator</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Click any question to jump to it</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-base font-bold text-slate-900 dark:text-slate-100">{answeredQuestions.size}/{questions.length}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">Completed</div>
                  </div>
                  <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-950/70 dark:to-indigo-900/40 flex items-center justify-center shadow-sm border border-indigo-200/80 dark:border-indigo-700/60">
                    <div className="text-center">
                      <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300 leading-none">
                        {Math.round((answeredQuestions.size / questions.length) * 100)}%
                      </div>
                      <div className="text-[7px] text-indigo-600/80 dark:text-indigo-400/90 font-medium leading-none mt-0.5">Done</div>
                    </div>
                    {answeredQuestions.size === questions.length && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory sm:grid sm:grid-cols-10 sm:overflow-visible sm:mx-0 sm:px-0 mb-4">
                {questions.map((question, index) => {
                  const isCurrent = index === currentIndex
                  const isAnswered = answeredQuestions.has(question.id)
                  const isSkipped = !isAnswered && index < currentIndex
                  
                  return (
                    <motion.button
                      key={question.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.03 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setCurrentIndex(index)
                        setShowFeedback(false)
                        setIsSubmittingAnswer(false)
                      }}
                      className={`
                        relative snap-start shrink-0 w-10 h-10 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm
                        ${isCurrent 
                          ? 'bg-indigo-600 dark:bg-indigo-500 text-white ring-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 shadow-lg scale-105' 
                          : isAnswered 
                            ? 'bg-gradient-to-br from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md' 
                            : isSkipped
                              ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-md'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-500'
                        }
                      `}
                      title={`Question ${index + 1}: ${isAnswered ? 'Answered' : isSkipped ? 'Skipped' : 'Not attempted'}`}
                    >
                      {index + 1}
                      {isAnswered && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1 }}
                          className="absolute -top-1 -right-1 w-3 h-3 bg-green-700 rounded-full flex items-center justify-center shadow-sm"
                        >
                          <CheckCircle2 className="w-2 h-2 text-white" />
                        </motion.div>
                      )}
                      {isSkipped && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1 }}
                          className="absolute -top-1 -right-1 w-3 h-3 bg-amber-700 rounded-full flex items-center justify-center shadow-sm"
                        >
                          <span className="text-[8px] text-white font-bold">?</span>
                        </motion.div>
                      )}
                      {isCurrent && (
                        <motion.div
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 rounded-lg border border-indigo-400/40 dark:border-indigo-300/50"
                        />
                      )}
                    </motion.button>
                  )
                })}
              </div>
              
              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Progress</span>
                  <span>{answeredQuestions.size} of {questions.length} questions</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(answeredQuestions.size / questions.length) * 100}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                  />
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 text-xs flex-wrap">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gradient-to-br from-green-500 to-green-600 rounded shadow-sm"></div>
                  <span className="text-slate-600 dark:text-slate-400">Answered</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded shadow-sm"></div>
                  <span className="text-slate-600 dark:text-slate-400">Skipped</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded"></div>
                  <span className="text-slate-600 dark:text-slate-400">Not attempted</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-indigo-600 dark:bg-indigo-500 rounded shadow-sm"></div>
                  <span className="text-slate-600 dark:text-slate-400">Current</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Question {currentIndex + 1} of {questions.length}
              {answeredQuestions.has(currentQuestion.id) && (
                <span className="ml-2 text-green-600 dark:text-emerald-400 font-medium">✓ Completed</span>
              )}
            </span>
            <Badge variant="outline" className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800">
              {currentQuestion.topic}
            </Badge>
          </div>
          <Progress value={(answeredQuestions.size / questions.length) * 100} className="h-2" />
        </div>

        {reviewOnly || currentQuestion.alreadyAttempted || (lockedQuestions.has(currentQuestion.id) && answerReviews[currentQuestion.id]) ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-semibold">Already attempted</p>
            <p className="mt-0.5 text-amber-900/90 dark:text-amber-100/90">
              You already answered this question. It is locked and your previous result is shown below.
            </p>
          </div>
        ) : null}

        {/* Question Card */}
        <Card className="border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl shadow-sm dark:shadow-slate-950/40 transition-all duration-300">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-4">
                  {showStemWithMedia ? (
                    <QuestionStemWithMedia question={currentQuestion} size="medium">
                      <QuestionTextRenderer
                        text={currentQuestion.question_text}
                        className="text-lg sm:text-xl font-medium"
                      />
                    </QuestionStemWithMedia>
                  ) : (
                    <CardTitle className="text-lg sm:text-xl text-slate-900 dark:text-slate-100">
                      {currentQuestion.hint?.trim() || currentQuestion.topic}
                    </CardTitle>
                  )}
                </div>
                <CardDescription className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                  <Badge
                    variant={
                      currentQuestion.difficulty === "easy"
                        ? "default"
                        : currentQuestion.difficulty === "medium"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {currentQuestion.difficulty}
                  </Badge>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {questionTypeHint(currentQuestion.question_type)}
                  </span>
                </CardDescription>
              </div>
              {hubPolicy.allow_hints && currentQuestion.hint && !selfContained && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHint(!showHint)}
                  className={cn(
                    "ml-4 rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800",
                    showHint && "bg-yellow-100/60 dark:bg-amber-950/50"
                  )}
                >
                  <Lightbulb
                    className={cn("h-4 w-4", showHint && "text-yellow-500")}
                  />
                </Button>
              )}
            </div>

            {hubPolicy.allow_hints && showHint && currentQuestion.hint && !selfContained && (
              <div className="mt-4 p-3 border border-yellow-200 dark:border-amber-700/50 bg-yellow-50 dark:bg-amber-950/30 rounded-lg">
                <p className="text-sm text-yellow-900 dark:text-amber-100">
                  💡 <strong>Hint:</strong> {currentQuestion.hint}
                </p>
              </div>
            )}

            {canAskCoraOnCurrentQuestion ? (
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant={coraDrawerOpen ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCoraDrawerOpen((open) => !open)}
                  className={cn(
                    "gap-1.5 rounded-full",
                    coraDrawerOpen
                      ? "border-0 bg-[var(--cc-accent)] text-white hover:opacity-90"
                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {coraDrawerOpen ? `Hide ${CORA_NAME}` : `Ask ${CORA_NAME}`}
                </Button>
              </div>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-6">
            <QuestionRenderer
              question={{
                ...currentQuestion,
                hint: currentQuestion.hint || undefined,
              }}
              selectedAnswer={selectedAnswer}
              selectedMultiAnswers={selectedMultiAnswers}
              code={code}
              showFeedback={showFeedback}
              isSubmittingAnswer={isSubmittingAnswer}
              isCorrect={isCorrect}
              partialCreditPoints={partialCreditPoints}
              aiFeedback={aiFeedback ?? undefined}
              onAnswerChange={handleAnswerSelect}
              onMultiAnswerToggle={handleMultiAnswerToggle}
              onCodeChange={handleCodeChange}
              isPreviewMode={false}
              isLocked={lockedQuestions.has(currentQuestion.id)}
              attemptId={attemptId}
              studentDatabaseId={studentId}
              answerReview={answerReviews[currentQuestion.id] ?? null}
            />
          </CardContent>

          {/* Footer Buttons */}
          <CardFooter className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="h-9 rounded-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
              {currentIndex > 0 && answeredQuestions.has(questions[currentIndex - 1].id) && (
                <CheckCircle2 className="h-3 w-3 ml-2 text-green-600 dark:text-emerald-400" />
              )}
            </Button>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {lockedQuestions.has(currentQuestion.id) ? (
                isCorrect ? (
                  <div className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-green-200 bg-green-100 px-4 text-sm font-medium text-green-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Correct</span>
                  </div>
                ) : (
                  <div className="inline-flex h-9 shrink-0 items-center rounded-full border border-amber-200 bg-amber-100 px-4 text-sm font-medium text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
                    <span>Review the answer above, then continue</span>
                  </div>
                )
              ) : (
                <Button
                  onClick={submitAnswer}
                  disabled={
                    isSubmittingAnswer ||
                    (!answers[currentQuestion.id] && !selfContained)
                  }
                  variant="secondary"
                  className="h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600"
                >
                  {isSubmittingAnswer ? "Submitting..." : "Submit Answer"}
                </Button>
              )}

              {currentIndex === questions.length - 1 ? (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="h-9 rounded-full bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-slate-900"
                >
                  {submitting ? "Submitting..." : reviewOnly ? "Back to Practice Hub" : "Complete Practice"}
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  className="h-9 rounded-full bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-slate-900"
                >
                  {answeredQuestions.has(currentQuestion.id) ? "Next Question" : "Skip Question"}
                  <ChevronRight className="h-4 w-4 ml-2" />
                  {currentIndex < questions.length - 1 && answeredQuestions.has(questions[currentIndex + 1].id) && (
                    <CheckCircle2 className="h-3 w-3 ml-1 text-green-600 dark:text-emerald-400" />
                  )}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
        </QuestionPrepareGate>
      </main>

      {coraDrawerOpen && currentQuestion && studentId && canAskCoraOnCurrentQuestion ? (
        <CoraAskDrawer
          variant="panel"
          open={coraDrawerOpen}
          onClose={() => setCoraDrawerOpen(false)}
          studentId={String(studentId)}
          title={`Ask ${CORA_NAME}`}
          subtitle={`Practice · ${currentQuestion.topic || currentQuestion.question_type}`}
          problem={coraContextFromQuestion({
            source: "practice_hub",
            questionText: currentQuestion.question_text,
            title: currentQuestion.topic || "Practice question",
            questionType: currentQuestion.question_type,
            hint: currentQuestion.hint,
            studentAnswer: coraStudentWork || null,
            questionId: currentQuestion.id,
            bankQuestionId: currentQuestion.id,
            attemptId: attemptId ?? undefined,
            studentDatabaseId: studentId,
          })}
        />
      ) : null}
      </div>
    </div>
  )
}
