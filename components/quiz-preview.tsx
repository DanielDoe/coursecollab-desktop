"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, Eye } from "lucide-react"
import Link from "next/link"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { QuestionStemWithMedia } from "@/components/question-media-display"
import { QuestionRenderer } from "@/components/question-renderer"
import { QuizResults } from "@/components/quiz-results"
import {
  groupQuestionsBySections,
  getSectionForQuestionIndex,
  shouldUseAssessmentQuestionSections,
  type QuestionSection,
} from "@/lib/assessment-sections"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import {
  assessmentPreviewLabel,
  QuizPreviewActionBar,
  QuizPreviewFeedbackPanel,
  QuizPreviewInstructions,
  QuizPreviewLoading,
  QuizPreviewNavigator,
  QuizPreviewToolbar,
} from "@/components/assessments/quiz-preview-chrome"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/assessments/assessment-management-surface-classes"
import { cn } from "@/lib/utils"
import { scoreSelectAllQuestion } from "@/lib/select-all-scoring"

function isFacultyQuizPreviewPath(pathname: string): boolean {
  return pathname.includes("/instructor") || pathname.includes("/faculty")
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
  question_type: string
  question_media?: unknown
  circuit_spec?: unknown
  subquestions?: unknown
  time_limit: number | null
  max_points?: number
  points?: number
  sample_answers?: Array<{ approach: string; description: string; code: string }>
}

interface Quiz {
  id: number
  title: string
  description: string
  time_per_question: number
  section_config?: Array<{ title: string; question_types: string[]; weight_percent: number }> | null
}

function computeIsCorrect(
  q: Question,
  selected: string | null,
  multi: string[],
  isMulti: boolean,
  isText: boolean
): boolean {
  let correctText = q.correct_answer
  if (isMulti) {
    try {
      let correctAnswers: string[] = []
      try {
        const parsed = JSON.parse(q.correct_answer)
        correctAnswers = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        correctAnswers = [q.correct_answer]
      }
      const allLetters = correctAnswers.every((a: string) => typeof a === "string" && /[A-E]/i.test(a.trim()))
      if (allLetters) {
        correctAnswers = correctAnswers.map((l: string) => (q as any)[`option_${l.trim().toLowerCase()}`]).filter(Boolean)
      }
      const opts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(Boolean)
      const correctInOpts = correctAnswers.filter((a: string) => opts.includes(a))
      const selectedTexts = multi.map((l) => (q as any)[`option_${l.toLowerCase()}`])
      return correctInOpts.length === selectedTexts.length && correctInOpts.every((a: string) => selectedTexts.includes(a))
    } catch {
      return false
    }
  }
  if (isText) {
    return (selected || "").trim().toLowerCase() === (correctText || "").trim().toLowerCase()
  }
  try {
    const parsed = JSON.parse(correctText)
    if (Array.isArray(parsed) && parsed[0]) {
      const first = parsed[0]
      if (typeof first === "string" && /[A-E]/i.test(first)) {
        correctText = (q as any)[`option_${first.toLowerCase()}`] ?? correctText
      } else {
        correctText = first
      }
    }
  } catch {
    if (correctText?.length === 1 && /[A-E]/i.test(correctText)) {
      correctText = (q as any)[`option_${correctText.toLowerCase()}`] ?? correctText
    }
  }
  return (selected || "").trim() === (correctText || "").trim()
}

export function QuizPreview({
  quizId,
  assessmentType = "quiz",
  embedInDashboard = false,
}: {
  quizId: string
  assessmentType?: string
  embedInDashboard?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  // Removed usePreventBack to allow natural back navigation
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [selectedMultiAnswers, setSelectedMultiAnswers] = useState<string[]>([])
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean
    explanation: string
    earnedPoints: number
    totalPoints: number
  } | null>(null)
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isTimerActive, setIsTimerActive] = useState(false)
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set())
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set())
  const [showNavigator, setShowNavigator] = useState(false)
  const [code, setCode] = useState(`#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`)

  // Plot upload state for code_write_plot questions
  const [uploadedPlot, setUploadedPlot] = useState<string | null>(null)
  const [plotByQuestion, setPlotByQuestion] = useState<Record<number, string>>({})
  const [codeByQuestion, setCodeByQuestion] = useState<Record<number, string>>({})
  const [showInstructions, setShowInstructions] = useState(true)
  const [previewResults, setPreviewResults] = useState<any>(null)
  // Track answered results for mock results view: questionId -> { pointsEarned, isCorrect, selected_answer }
  const [previewAnswers, setPreviewAnswers] = useState<Record<number, { pointsEarned: number; isCorrect: boolean; selected_answer?: string }>>({})

  useEffect(() => {
    console.log("[v0] QuizPreview mounted, quizId:", quizId)
    
    // Check for both admin and instructor authentication
    const adminId = sessionStorage.getItem("adminId")
    const instructorSession = localStorage.getItem("instructorSession")
    
    console.log("[v0] Admin ID from session:", adminId)
    console.log("[v0] Instructor session from storage:", instructorSession)
    
    if (!adminId && !instructorSession) {
      console.log("[v0] No authentication found, redirecting to login")
      // Determine redirect based on current path
      const isInstructorPath = isFacultyQuizPreviewPath(pathname)
      router.push(isInstructorPath ? "/faculty/login" : "/admin/login")
      return
    }

    fetchQuiz()
  }, [quizId, router, pathname])

  // Set code template based on question type
  useEffect(() => {
    if (questions.length > 0 && questions[currentQuestionIndex]) {
      const currentQuestion = questions[currentQuestionIndex]
      const questionType = currentQuestion.question_type?.toLowerCase()
      
      // Restore plot for code_write_plot questions
      const savedPlot = plotByQuestion[currentQuestion.id]
      if (questionType === "code_write_plot") {
        setUploadedPlot(savedPlot || null)
        
        // Set MATLAB template if no saved code
        const savedCode = code || ""
        if (!savedCode || savedCode.includes("#include")) {
          const matlabTemplate = `% MATLAB Script\n% Start your code here\n\ndisp('Hello, MATLAB!');\n`
          setCode(matlabTemplate)
          console.log("[Preview] Set MATLAB template for question", currentQuestion.id)
        }
      } else {
        setUploadedPlot(null)
      }
    }
  }, [currentQuestionIndex, questions, plotByQuestion])

  useEffect(() => {
    if (isTimerActive && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && isTimerActive) {
      handleTimeUp()
    }
  }, [timeLeft, isTimerActive])

  const fetchQuiz = async () => {
    console.log("[v0] Fetching quiz data for ID:", quizId)
    try {
      const isInstructorPath = isFacultyQuizPreviewPath(pathname)
      const apiUrl = isInstructorPath ? `/api/instructor/quizzes/${quizId}` : `/api/admin/quizzes/${quizId}`
      const response = await fetch(
        apiUrl,
        isInstructorPath ? { headers: buildInstructorApiHeaders() } : undefined,
      )
      console.log("[v0] Quiz API response status:", response.status)
      const data = await response.json()
      console.log("[v0] Quiz data received:", data)

      const quizData = data.quiz || data
      const questionsData = data.questions || quizData?.questions || []
      setQuiz(quizData)
      setQuestions(Array.isArray(questionsData) ? questionsData : [])

      const firstQuestionTime = questionsData[0]?.time_limit || quizData?.time_per_question
      setTimeLeft(firstQuestionTime || 60)
    } catch (error) {
      console.error("[v0] Failed to fetch quiz:", error)
      toast({
        title: "Failed to load quiz",
        description: "An error occurred while loading the quiz preview.",
        variant: "destructive",
      })
      const isInstructorPath = isFacultyQuizPreviewPath(pathname)
      const backPath = embedInDashboard
        ? "/faculty/dashboard/assessments/quizzes"
        : isInstructorPath
          ? "/faculty/dashboard/assessments/quizzes"
          : "/admin/quizzes"
      router.push(backPath)
    } finally {
      setLoading(false)
    }
  }

  const startTimer = () => {
    setIsTimerActive(true)
  }

  const handleTimeUp = () => {
    setIsTimerActive(false)
    setShowFeedback(true)
    toast({
      title: "Time's up!",
      description: "The time limit for this question has been reached.",
      variant: "destructive",
    })
  }

  const handleAnswerSelect = (answer: string) => {
    if (!showFeedback) {
      setSelectedAnswer(answer || "")
      markQuestionAsAnswered(currentQuestionIndex)
      console.log("[v0] Answer selected:", answer)
    }
  }

  const toggleMultiAnswer = (option: string) => {
    if (showFeedback) return

    setSelectedMultiAnswers((prev) => {
      const newAnswers = prev.includes(option) ? prev.filter((a) => a !== option) : [...prev, option]

      if (newAnswers.length > 0) {
        markQuestionAsAnswered(currentQuestionIndex)
      }

      return newAnswers
    })
  }

  const handleCodeChange = (value: string) => {
    setCode(value)
    if (questions[currentQuestionIndex]) {
      setCodeByQuestion((prev) => ({ ...prev, [questions[currentQuestionIndex].id]: value }))
    }
  }

  // Handlers for plot upload (code_write_plot questions)
  const handlePlotUpload = (file: File, base64: string) => {
    if (questions[currentQuestionIndex]) {
      const currentQuestion = questions[currentQuestionIndex]
      setUploadedPlot(base64)
      setPlotByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: base64,
      }))
      console.log("[Preview] Plot uploaded for question:", currentQuestion.id)
    }
  }

  const handlePlotRemove = () => {
    if (questions[currentQuestionIndex]) {
      const currentQuestion = questions[currentQuestionIndex]
      setUploadedPlot(null)
      setPlotByQuestion((prev) => {
        const updated = { ...prev }
        delete updated[currentQuestion.id]
        return updated
      })
      console.log("[Preview] Plot removed for question:", currentQuestion.id)
    }
  }

  // AI evaluation function
  const callAIEvaluation = async (question: Question, studentCode: string, plotImage?: string) => {
    console.log("[Preview] callAIEvaluation STARTED")
    console.log("[Preview] Setting isSubmittingAnswer to TRUE")
    setIsSubmittingAnswer(true)
    console.log("[Preview] isSubmittingAnswer should now be TRUE")
    
    try {
      console.log("[Preview] Calling AI evaluation with:", {
        questionId: question.id,
        questionType: question.question_type,
        codeLength: studentCode.length,
        hasPlot: !!plotImage,
        plotImageSize: plotImage ? plotImage.length : 0,
        plotImagePreview: plotImage ? plotImage.substring(0, 50) + "..." : null
      })

      const requestBody = {
        questionId: question.id,
        answer: studentCode,
        questionType: question.question_type,
        plotImage: plotImage, // Include plot for code_write_plot questions
      }
      
      console.log("[Preview] Request body keys:", Object.keys(requestBody))
      console.log("[Preview] plotImage in request:", !!requestBody.plotImage)

      const response = await fetch("/api/quiz/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`AI evaluation failed: ${response.statusText}`)
      }

      const result = await response.json()
      console.log("[Preview] AI evaluation result:", result)
      console.log("[Preview] isCorrect:", result.isCorrect)
      console.log("[Preview] pointsEarned:", result.pointsEarned)
      console.log("[Preview] maxPoints:", result.maxPoints)
      console.log("[Preview] score (percentage):", result.score)
      console.log("[Preview] Full feedback:", result.feedback)
      console.log("[Preview] Question points:", question.points)

      const earned = result.pointsEarned ?? 0
      const total = result.maxPoints ?? question.points ?? 10
      setFeedback({
        isCorrect: result.isCorrect || false,
        explanation: result.feedback || "No feedback available",
        earnedPoints: earned,
        totalPoints: total,
      })
      setShowFeedback(true)
      setPreviewAnswers((prev) => ({
        ...prev,
        [question.id]: {
          pointsEarned: earned,
          isCorrect: result.isCorrect || false,
          selected_answer: studentCode,
        },
      }))

      toast({
        title: result.isCorrect ? "Correct!" : "Needs Improvement",
        description: `You earned ${result.pointsEarned || 0}/${result.maxPoints || question.points || 10} points`,
        variant: result.isCorrect ? "default" : "destructive",
      })
    } catch (error) {
      console.error("[v0] AI evaluation error:", error)
      toast({
        title: "Evaluation Error",
        description: "Failed to evaluate your code. Please try again.",
        variant: "destructive",
      })
      
      // Show error feedback
      setFeedback({
        isCorrect: false,
        explanation: "Error during AI evaluation. Please contact your instructor.",
        earnedPoints: 0,
        totalPoints: question.points || 10,
      })
      setShowFeedback(true)
    } finally {
      console.log("[Preview] Setting isSubmittingAnswer to FALSE (finally block)")
      setIsSubmittingAnswer(false)
      console.log("[Preview] isSubmittingAnswer should now be FALSE")
    }
  }

  const handleSubmitAnswer = () => {
    console.log("[Preview] handleSubmitAnswer CALLED")
    console.log("[Preview] isSubmittingAnswer state:", isSubmittingAnswer)
    
    const currentQuestion = questions[currentQuestionIndex]
    const questionType = currentQuestion.question_type?.toLowerCase() || "mcq"
    const isMultiSelect = questionType === "multi_output" || questionType === "select_all"
    const isTextInput = ["fill_blank", "code_output", "trace_output", "trace_logic", "scenario_match"].includes(
      questionType,
    )
    const isSingleSelect = questionType === "mcq" || questionType === "true_false"
    const isCodeQuestion = [
      "code_write",
      "code_write_plot", 
      "code_explain",
      "code_problem",
      "debug_code",
      "code_debug"
    ].includes(questionType)

    console.log("[Preview] Submitting answer:")
    console.log("[Preview]   Question type:", questionType)
    console.log("[Preview]   Is code question:", isCodeQuestion)
    console.log("[Preview]   Selected answer:", selectedAnswer)
    console.log("[Preview]   Selected multi answers:", selectedMultiAnswers)
    console.log("[Preview]   Code length:", code?.length || 0)
    console.log("[Preview]   Code preview:", code?.substring(0, 50))
    console.log("[Preview]   Has plot:", !!uploadedPlot)

    // For AI-graded questions (code_write, code_write_plot, etc), call AI evaluation
    if (isCodeQuestion) {
      // Validate code is present
      if (!code || code.length < 10) {
        toast({
          title: "No code provided",
          description: "Please write your code before submitting.",
          variant: "destructive",
        })
        return
      }

      // For code_write_plot, validate plot is uploaded
      if (questionType === "code_write_plot" && !uploadedPlot) {
        console.log("[Preview] ❌ VALIDATION FAILED: No plot uploaded for code_write_plot question")
        toast({
          title: "⚠️ Plot Required",
          description: "For code_write_plot questions, you must upload a plot image before submitting. Please use the 'Upload Plot' section above.",
          variant: "destructive",
        })
        alert("Please upload a plot image before submitting this code_write_plot question!")
        return
      }

      // Call AI evaluation API
      console.log("[Preview] About to call AI evaluation")
      toast({
        title: "Evaluating with AI...",
        description: "Sending your code to AI for grading. This may take a moment.",
      })

      setIsTimerActive(false)
      markQuestionAsAnswered(currentQuestionIndex)

      // Call AI evaluation
      console.log("[Preview] Calling callAIEvaluation now...")
      callAIEvaluation(currentQuestion, code, uploadedPlot)
      console.log("[Preview] callAIEvaluation triggered")
      return
    }

    if (!isMultiSelect && !isTextInput && !isCodeQuestion && !selectedAnswer) {
      toast({
        title: "No answer selected",
        description: "Please select an answer before submitting.",
        variant: "destructive",
      })
      return
    }

    if (isMultiSelect && selectedMultiAnswers.length === 0) {
      toast({
        title: "No answers selected",
        description: "Please select at least one answer before submitting.",
        variant: "destructive",
      })
      return
    }

    if (isTextInput && !selectedAnswer) {
      toast({
        title: "No answer provided",
        description: "Please provide an answer before submitting.",
        variant: "destructive",
      })
      return
    }

    setIsTimerActive(false)
    setShowFeedback(true)
    markQuestionAsAnswered(currentQuestionIndex)
    const maxPts = Number(currentQuestion.max_points ?? currentQuestion.points ?? 1) || 1

    if (isMultiSelect) {
      let correctAnswers: string[] = []
      try {
        const parsed = JSON.parse(currentQuestion.correct_answer)
        correctAnswers = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)]
      } catch {
        correctAnswers = [String(currentQuestion.correct_answer ?? "")]
      }
      const allLetters = correctAnswers.every(
        (a) => typeof a === "string" && a.trim().length === 1 && /^[A-E]$/i.test(a.trim()),
      )
      const correctTexts = (
        allLetters
          ? correctAnswers.map((letter) => {
              const key = `option_${letter.trim().toLowerCase()}` as keyof Question
              return currentQuestion[key] as string
            })
          : correctAnswers
      ).filter(Boolean)
      const selectedTexts = selectedMultiAnswers
        .map((letter) => {
          const key = `option_${letter.toLowerCase()}` as keyof Question
          return currentQuestion[key] as string
        })
        .filter(Boolean)

      const scored = scoreSelectAllQuestion(selectedTexts, correctTexts, maxPts)
      const explanation = scored.isFullyCorrect
        ? "Correct! You selected all the right answers and no incorrect ones."
        : scored.points > 0
          ? `Partial credit: ${scored.correctSelected} of ${scored.correctCount} correct selected` +
            (scored.incorrectSelected > 0 ? `, ${scored.incorrectSelected} incorrect` : "") +
            `. Score = max(0, (C−I)/T) × points.`
          : scored.incorrectSelected > 0 && scored.correctSelected === 0
            ? "Incorrect — only wrong options were selected."
            : "Incorrect — check the highlighted answers."

      setFeedback({
        isCorrect: scored.isFullyCorrect,
        explanation,
        earnedPoints: scored.points,
        totalPoints: maxPts,
      })
      setPreviewAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          pointsEarned: scored.points,
          isCorrect: scored.isFullyCorrect,
          selected_answer: JSON.stringify(selectedMultiAnswers),
        },
      }))
      return
    }

    const computedCorrect = computeIsCorrect(
      currentQuestion,
      selectedAnswer,
      selectedMultiAnswers,
      isMultiSelect,
      isTextInput,
    )
    const earned = computedCorrect ? maxPts : 0
    setFeedback(null)
    setPreviewAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        pointsEarned: earned,
        isCorrect: computedCorrect,
        selected_answer: selectedAnswer ?? "",
      },
    }))
  }

  const handleRetry = () => {
    setShowFeedback(false)
    setSelectedAnswer("")
    const currentQuestionTime = questions[currentQuestionIndex].time_limit || quiz!.time_per_question
    setTimeLeft(currentQuestionTime)
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      navigateToQuestion(currentQuestionIndex + 1)
    } else {
      toast({
        title: "Preview complete",
        description: "You've reached the end of the quiz preview.",
      })
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      navigateToQuestion(currentQuestionIndex - 1)
    }
  }

  const navigateToQuestion = (index: number) => {
    if (questions[currentQuestionIndex]) {
      const q = questions[currentQuestionIndex]
      setCodeByQuestion((prev) => ({ ...prev, [q.id]: code }))
    }
    setCurrentQuestionIndex(index)
    setSelectedAnswer(null)
    setSelectedMultiAnswers([])
    setShowFeedback(false)
    setShowNavigator(false)
    setFeedback(null)
    const q = questions[index]
    const savedCode = q ? codeByQuestion[q.id] : null
    setCode(savedCode || (q?.question_type?.toLowerCase() === "code_write_plot" ? `% MATLAB Script\n% Start your code here\n\ndisp('Hello, MATLAB!');\n` : `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`))
    const questionTime = questions[index].time_limit || quiz!.time_per_question
    setTimeLeft(questionTime)
    setIsTimerActive(false)
  }

  const markQuestionAsAnswered = (index: number) => {
    setAnsweredQuestions((prev) => new Set(prev).add(index))
  }

  const toggleFlag = () => {
    setFlaggedQuestions((prev) => {
      const newFlags = new Set(prev)
      if (newFlags.has(currentQuestionIndex)) {
        newFlags.delete(currentQuestionIndex)
      } else {
        newFlags.add(currentQuestionIndex)
      }
      return newFlags
    })
  }

  const handleCompletePreview = () => {
    const totalPoints = questions.reduce((s, q) => s + (q.max_points ?? q.points ?? 1), 0)
    const score = questions.reduce((s, q) => s + (previewAnswers[q.id]?.pointsEarned ?? 0), 0)
    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 1000) / 10 : 0
    const questionsWithAnswers = questions.map((q) => ({
      ...q,
      points_earned: previewAnswers[q.id]?.pointsEarned ?? 0,
      is_correct: previewAnswers[q.id]?.isCorrect ?? false,
      selected_answer: previewAnswers[q.id]?.selected_answer ?? null,
      max_points: q.max_points ?? q.points ?? 1,
    }))
    setPreviewResults({
      student_name: "Preview (Instructor)",
      student_id: "—",
      section: "—",
      quiz_id: quiz!.id,
      quiz_title: quiz!.title,
      assessment_type: assessmentType,
      score,
      total_questions: questions.length,
      total_points: totalPoints,
      percentage,
      questions: questionsWithAnswers,
      correct_answers: questionsWithAnswers.filter((q) => q.is_correct).length,
    })
  }

  const sections = useMemo((): QuestionSection[] => {
    if (!questions?.length) return []
    if (!shouldUseAssessmentQuestionSections(assessmentType, quiz?.section_config)) return []
    return groupQuestionsBySections(questions, quiz?.section_config ?? null)
  }, [questions, quiz?.section_config, assessmentType])

  const currentSection = getSectionForQuestionIndex(currentQuestionIndex, sections)
  const isFirstInSection = currentSection !== null && currentQuestionIndex === currentSection.startIndex

  console.log("[v0] QuizPreview render - loading:", loading, "quiz:", quiz, "questions:", questions.length)

  if (loading) {
    return <QuizPreviewLoading embedded={embedInDashboard} />
  }

  if (!quiz || questions.length === 0) {
    console.log("[v0] No quiz or questions found")
    const isInstructorPath = isFacultyQuizPreviewPath(pathname)
    const backPath = embedInDashboard
      ? "/faculty/dashboard/assessments/quizzes"
      : isInstructorPath
        ? "/faculty/dashboard/assessments/quizzes"
        : "/admin/quizzes"
    
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">No questions found in this quiz.</p>
          <Link href={backPath}>
            <Button className="mt-4">Back to Quizzes</Button>
          </Link>
        </div>
      </div>
    )
  }

  const getBackUrl = () => {
    if (embedInDashboard) {
      const pathParts = pathname.split("/")
      const assessmentsIdx = pathParts.indexOf("assessments")
      const assessmentSegment = assessmentsIdx >= 0 ? pathParts[assessmentsIdx + 1] : "quizzes"
      return `/faculty/dashboard/assessments/${assessmentSegment}`
    }
    const pathParts = pathname.split("/")
    const userTypeIndex = pathParts.findIndex((part) => part === "admin" || part === "instructor")
    const userType = pathParts[userTypeIndex] || "admin"
    const assessmentIndex = userTypeIndex + 1
    const assessmentTypeFromPath = pathParts[assessmentIndex]
    return `/${userType}/${assessmentTypeFromPath || "quizzes"}`
  }
  const backUrl = getBackUrl()

  if (previewResults) {
    return (
      <div
        className={
          embedInDashboard
            ? "flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-y-auto bg-[var(--background)]"
            : "min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
        }
      >
        <div className={cn("border-b px-3 py-2.5 sm:px-5 sm:py-3", embedInDashboard ? "border-[var(--border)] bg-[var(--card)]" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900")}>
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPreviewResults(null)}
              className={cn("shrink-0 px-2", embedInDashboard ? "text-[var(--cc-text)] hover:text-[var(--cc-accent)]" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white")}
            >
              <ArrowLeft className="mr-1.5 size-4" />
              Back to questions
            </Button>
            <div className={cn("hidden h-6 w-px shrink-0 sm:block", embedInDashboard ? "bg-[var(--border)]" : "bg-slate-200 dark:bg-slate-700")} />
            <Badge variant="outline" className={embedInDashboard ? "gap-1 border-[var(--cc-accent)]/25 text-[var(--cc-accent)]" : "gap-1 border-[#582c83]/25 text-[#582c83]"}>
              <Eye className="size-3" />
              Preview results
            </Badge>
          </div>
        </div>
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-5">
          <QuizResults
            attemptId="preview"
            assessmentType={assessmentType}
            resultsOverride={previewResults}
            isAdminView={true}
            userType="instructor"
          />
        </div>
      </div>
    )
  }

  if (showInstructions) {
    return (
      <QuizPreviewInstructions
        title={quiz.title}
        description={quiz.description}
        questionCount={questions.length}
        assessmentLabel={assessmentPreviewLabel(assessmentType)}
        timePerQuestion={quiz.time_per_question}
        backUrl={backUrl}
        onStart={() => setShowInstructions(false)}
        embedded={embedInDashboard}
      />
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  let selectedAnswerText = ""
  let correctAnswerText = currentQuestion.correct_answer

  const questionType = currentQuestion.question_type?.toLowerCase() || "mcq"
  const isMultiSelect = questionType === "multi_output" || questionType === "select_all"
  const isTextInput = ["fill_blank", "code_output", "trace_output", "trace_logic", "scenario_match"].includes(
    questionType,
  )
  const isSingleSelect = questionType === "mcq" || questionType === "true_false"

  if (isTextInput) {
    selectedAnswerText = selectedAnswer || ""
    console.log("[v0] Text input - Selected answer:", selectedAnswerText)
  } else if (isSingleSelect && selectedAnswer) {
    const optionKey = `option_${selectedAnswer.toLowerCase()}` as keyof Question
    selectedAnswerText = currentQuestion[optionKey] as string
    console.log("[v0] Single select - Selected answer letter:", selectedAnswer)
    console.log("[v0] Single select - Selected answer text:", selectedAnswerText)
  }

  console.log("[v0] Correct answer (raw):", correctAnswerText)
  console.log("[v0] Correct answer type:", typeof correctAnswerText)

  if (isSingleSelect && correctAnswerText) {
    try {
      // Try to parse as JSON first (handles ["False"] format from mid-semester)
      const parsed = JSON.parse(correctAnswerText)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // If it's an array, take the first element
        const firstElement = parsed[0]
        // Check if it's a letter (A, B, C, D, E) or the actual answer text
        if (typeof firstElement === "string" && firstElement.length === 1 && /[A-E]/i.test(firstElement)) {
          // It's a letter, convert to text
          const optionKey = `option_${firstElement.toLowerCase()}` as keyof Question
          correctAnswerText = currentQuestion[optionKey] as string
        } else {
          // It's already the answer text
          correctAnswerText = firstElement
        }
        console.log("[v0] Parsed correct answer from JSON array:", correctAnswerText)
      } else if (typeof parsed === "string") {
        // If it's a string after parsing, use it directly
        correctAnswerText = parsed
        console.log("[v0] Parsed correct answer from JSON string:", correctAnswerText)
      }
    } catch (e) {
      // Not JSON, treat as plain string
      // Check if it's a single letter (A, B, C, D, E)
      if (correctAnswerText.length === 1 && /[A-E]/i.test(correctAnswerText)) {
        const optionKey = `option_${correctAnswerText.toLowerCase()}` as keyof Question
        correctAnswerText = currentQuestion[optionKey] as string
        console.log("[v0] Converted correct answer letter to text:", correctAnswerText)
      }
      console.log("[v0] Correct answer is plain string:", correctAnswerText)
    }
  } else if (isTextInput) {
    try {
      const parsed = JSON.parse(correctAnswerText)
      if (Array.isArray(parsed)) {
        correctAnswerText = parsed[0] || ""
        console.log("[v0] Parsed correct answer from array:", correctAnswerText)
      }
    } catch (e) {
      console.log("[v0] Correct answer is plain string:", correctAnswerText)
    }
  }

  let isCorrect = false
  let correctAnswersInOptions: string[] = []

  if (isMultiSelect) {
    try {
      // Handle different correct_answer formats
      let correctAnswers: string[] = []
      
      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(currentQuestion.correct_answer)
        if (Array.isArray(parsed)) {
          correctAnswers = parsed
        } else if (typeof parsed === "string") {
          correctAnswers = [parsed]
        }
      } catch {
        // If JSON parsing fails, treat as a simple string
        correctAnswers = [currentQuestion.correct_answer]
      }

      console.log("[Preview] Select All - Raw correct answers:", correctAnswers)

      // Check if correct answers are letters (A, B, C, D, E) and convert to option text
      const allLetters = correctAnswers.every((ans: string) => 
        typeof ans === 'string' && ans.trim().length === 1 && /[A-E]/i.test(ans.trim())
      )

      if (allLetters) {
        console.log("[Preview] Select All - Correct answers are LETTERS, converting to option text")
        correctAnswers = correctAnswers.map((letter: string) => {
          const optionKey = `option_${letter.trim().toLowerCase()}` as keyof Question
          return currentQuestion[optionKey] as string
        }).filter(Boolean)
      } else {
        console.log("[Preview] Select All - Correct answers are VALUES (already option text)")
      }

      const availableOptions = [
        currentQuestion.option_a,
        currentQuestion.option_b,
        currentQuestion.option_c,
        currentQuestion.option_d,
        currentQuestion.option_e,
      ].filter(Boolean)

      console.log("[Preview] Select All - Processed correct answers:", correctAnswers)
      console.log("[Preview] Select All - Available options:", availableOptions)

      correctAnswersInOptions = correctAnswers.filter((ans: string) => availableOptions.includes(ans))

      const selectedTexts = selectedMultiAnswers.map((letter) => {
        const optionKey = `option_${letter.toLowerCase()}` as keyof Question
        return currentQuestion[optionKey] as string
      })

      console.log("[Preview] Select All - Correct answers in options:", correctAnswersInOptions)
      console.log("[Preview] Select All - Selected texts:", selectedTexts)

      isCorrect =
        correctAnswersInOptions.length === selectedTexts.length &&
        correctAnswersInOptions.every((ans: string) => selectedTexts.includes(ans))
      
      console.log("[Preview] Select All - Is correct:", isCorrect)
    } catch (e) {
      console.error("[v0] Failed to parse multi-select correct_answer:", e)
      isCorrect = false
    }
  } else if (isTextInput) {
    console.log("[v0] Comparing text input answers:")
    console.log("[v0]   Selected:", selectedAnswerText)
    console.log("[v0]   Correct:", correctAnswerText)

    const normalizedSelected = selectedAnswerText.trim().toLowerCase()
    const normalizedCorrect = correctAnswerText.trim().toLowerCase()

    console.log("[v0]   Normalized selected:", normalizedSelected)
    console.log("[v0]   Normalized correct:", normalizedCorrect)

    isCorrect = normalizedSelected === normalizedCorrect
    console.log("[v0] Final isCorrect:", isCorrect)
  } else {
    console.log("[v0] Comparing answers:")
    console.log("[v0]   Selected:", selectedAnswerText, "(type:", typeof selectedAnswerText, ")")
    console.log("[v0]   Correct:", correctAnswerText, "(type:", typeof correctAnswerText, ")")
    console.log("[v0]   Trimmed selected:", selectedAnswerText?.trim())
    console.log("[v0]   Trimmed correct:", correctAnswerText?.trim())
    console.log("[v0]   Are they equal?:", selectedAnswerText === correctAnswerText)
    console.log("[v0]   Are they equal (trimmed)?:", selectedAnswerText?.trim() === correctAnswerText?.trim())

    isCorrect = selectedAnswerText?.trim() === correctAnswerText?.trim()
    console.log("[v0] Final isCorrect:", isCorrect)
  }

  const questionTime = currentQuestion.time_limit || quiz.time_per_question

  const assessmentLabel = assessmentPreviewLabel(assessmentType)

  return (
    <div
      className={
        embedInDashboard
          ? "flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-[var(--background)]"
          : "mx-auto max-w-6xl space-y-6 px-4 py-6"
      }
    >
      <QuizPreviewToolbar
        title={quiz.title}
        assessmentLabel={assessmentLabel}
        currentIndex={currentQuestionIndex}
        questionCount={questions.length}
        timeLeft={timeLeft}
        isTimerActive={isTimerActive}
        isFlagged={flaggedQuestions.has(currentQuestionIndex)}
        showNavigator={showNavigator}
        backUrl={backUrl}
        onToggleFlag={toggleFlag}
        onToggleNavigator={() => setShowNavigator((open) => !open)}
        onComplete={handleCompletePreview}
        embedded={embedInDashboard}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className={cn("hidden w-72 shrink-0 overflow-y-auto border-r p-4 lg:block", embedInDashboard ? "border-[var(--border)] bg-[var(--card)]" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900")}>
          <QuizPreviewNavigator
            questionCount={questions.length}
            currentIndex={currentQuestionIndex}
            answeredQuestions={answeredQuestions}
            flaggedQuestions={flaggedQuestions}
            sections={sections}
            onNavigate={navigateToQuestion}
            embedded={embedInDashboard}
          />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {showNavigator ? (
            <div className={cn("border-b p-4 lg:hidden", embedInDashboard ? "border-[var(--border)] bg-[var(--card)]" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900")}>
              <QuizPreviewNavigator
                questionCount={questions.length}
                currentIndex={currentQuestionIndex}
                answeredQuestions={answeredQuestions}
                flaggedQuestions={flaggedQuestions}
                sections={sections}
                onNavigate={(idx) => {
                  navigateToQuestion(idx)
                  setShowNavigator(false)
                }}
                compact
                embedded={embedInDashboard}
              />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="mx-auto max-w-3xl space-y-5">
              {isFirstInSection && currentSection ? (
                <div className={cn("rounded-xl border px-4 py-3", embedInDashboard ? "border-[var(--cc-accent)]/25 bg-[var(--cc-accent)]/10" : "border-violet-200/80 bg-violet-50/80 dark:border-violet-900 dark:bg-violet-950/30")}>
                  <p className={cn("text-sm font-semibold", embedInDashboard ? "text-[var(--cc-accent)]" : "text-[#582c83] dark:text-violet-200")}>
                    {currentSection.title}
                    {currentSection.weightPercent > 0 ? (
                      <span className={cn("ml-1 font-normal", embedInDashboard ? PORTAL_TEXT_MUTED : "text-violet-700/80 dark:text-violet-300/80")}>
                        ({currentSection.weightPercent}% of grade)
                      </span>
                    ) : null}
                  </p>
                </div>
              ) : null}

              <div className={cn("rounded-2xl p-5 sm:p-6", embedInDashboard ? PORTAL_CARD : "border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900")}>
                {questionType !== "circuit_submission" ? (
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <QuestionStemWithMedia question={currentQuestion}>
                        <QuestionTextRenderer
                          text={currentQuestion.question_text}
                          className="text-lg font-medium leading-relaxed sm:text-xl"
                        />
                      </QuestionStemWithMedia>
                    </div>
                    {currentQuestion.time_limit ? (
                      <Badge variant="secondary" className="shrink-0">
                        {currentQuestion.time_limit}s
                      </Badge>
                    ) : null}
                  </div>
                ) : currentQuestion.time_limit ? (
                  <div className="mb-5 flex justify-end">
                    <Badge variant="secondary" className="shrink-0">
                      {currentQuestion.time_limit}s
                    </Badge>
                  </div>
                ) : null}

                <QuestionRenderer
                  question={currentQuestion}
                  selectedAnswer={selectedAnswer || ""}
                  selectedMultiAnswers={selectedMultiAnswers}
                  code={code}
                  showFeedback={showFeedback}
                  isSubmittingAnswer={isSubmittingAnswer}
                  isCorrect={isCorrect}
                  partialCreditPoints={
                    showFeedback && feedback && !feedback.isCorrect && feedback.earnedPoints > 0
                      ? feedback.earnedPoints / Math.max(feedback.totalPoints, 1)
                      : null
                  }
                  onAnswerChange={handleAnswerSelect}
                  onMultiAnswerToggle={toggleMultiAnswer}
                  onCodeChange={handleCodeChange}
                  isPreviewMode={true}
                  sampleAnswers={currentQuestion.sample_answers}
                  uploadedPlot={uploadedPlot}
                  onPlotUpload={handlePlotUpload}
                  onPlotRemove={handlePlotRemove}
                />

                {showFeedback ? (
                  <div className="mt-5">
                    <QuizPreviewFeedbackPanel
                      feedback={feedback}
                      isCorrect={isCorrect}
                      isMultiSelect={isMultiSelect}
                      correctAnswerText={correctAnswerText}
                    />
                  </div>
                ) : null}

                <div className="mt-6">
                  <QuizPreviewActionBar
                    isFirst={currentQuestionIndex === 0}
                    isLast={currentQuestionIndex === questions.length - 1}
                    showFeedback={showFeedback}
                    isTimerActive={isTimerActive}
                    isSubmitting={isSubmittingAnswer}
                    isTextInput={isTextInput}
                    isCorrect={isCorrect}
                    onPrevious={handlePreviousQuestion}
                    onNext={handleNextQuestion}
                    onStartTimer={startTimer}
                    onSubmit={handleSubmitAnswer}
                    onRetry={handleRetry}
                    onNextAfterFeedback={handleNextQuestion}
                    onComplete={handleCompletePreview}
                  />
                </div>
              </div>

              <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                <Eye className="mt-0.5 size-4 shrink-0 text-[#582c83]" />
                Preview mode — navigate freely, flag questions, and test the full student flow. No
                responses are saved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
