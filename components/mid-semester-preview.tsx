"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, Eye, Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Flag, Grid3x3 } from "lucide-react"
import Link from "next/link"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { QuestionRenderer } from "@/components/question-renderer"

interface Question {
  id: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e?: string
  correct_answer: string | string[]
  question_type: string
  time_limit: number | null
}

interface MidSemester {
  id: number
  title: string
  description: string
  time_per_question: number
}

export function MidSemesterPreview({ examId }: { examId: string }) {
  const router = useRouter()
  usePreventBack("/admin/login")
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState<MidSemester | null>(null)
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

  useEffect(() => {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      router.push("/admin/login")
      return
    }

    fetchExam()
  }, [examId, router])

  useEffect(() => {
    if (isTimerActive && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && isTimerActive) {
      handleTimeUp()
    }
  }, [timeLeft, isTimerActive])

  const fetchExam = async () => {
    try {
      const response = await fetch(`/api/admin/mid-semesters/${examId}`)
      const data = await response.json()

      setExam(data.exam)
      setQuestions(data.questions)

      const firstQuestionTime = data.questions[0]?.time_limit || data.exam.time_per_question
      setTimeLeft(firstQuestionTime)
    } catch (error) {
      console.error("Failed to fetch exam:", error)
      toast({
        title: "Failed to load exam",
        description: "An error occurred while loading the exam preview.",
        variant: "destructive",
      })
      router.push("/admin/mid-semester-exams")
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
      console.log("[MidPreview] Plot uploaded for question:", currentQuestion.id)
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
      console.log("[MidPreview] Plot removed for question:", currentQuestion.id)
    }
  }

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
          console.log("[MidPreview] Set MATLAB template for question", currentQuestion.id)
        }
      } else {
        setUploadedPlot(null)
      }
    }
  }, [currentQuestionIndex, questions, plotByQuestion])

  // AI evaluation function
  const callAIEvaluation = async (question: Question, studentCode: string, plotImage?: string) => {
    setIsSubmittingAnswer(true)
    
    try {
      console.log("[v0] Calling AI evaluation with:", {
        questionId: question.id,
        questionType: question.question_type,
        codeLength: studentCode.length,
        hasPlot: !!plotImage,
      })

      const response = await fetch("/api/quiz/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          answer: studentCode,
          questionType: question.question_type,
          plotImage: plotImage, // Include plot for code_write_plot questions
        }),
      })

      if (!response.ok) {
        throw new Error(`AI evaluation failed: ${response.statusText}`)
      }

      const result = await response.json()
      console.log("[Preview] AI evaluation result:", result)
      console.log("[Preview] isCorrect:", result.isCorrect)
      console.log("[Preview] pointsEarned:", result.pointsEarned)
      console.log("[Preview] maxPoints:", result.maxPoints)

      // Show feedback (API returns camelCase)
      setFeedback({
        isCorrect: result.isCorrect || false,
        explanation: result.feedback || "No feedback available",
        earnedPoints: result.pointsEarned || 0,
        totalPoints: result.maxPoints || question.points || 10,
      })
      setShowFeedback(true)

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
      setIsSubmittingAnswer(false)
    }
  }

  const handleSubmitAnswer = () => {
    const currentQuestion = questions[currentQuestionIndex]
    const questionType = currentQuestion.question_type?.toLowerCase() || "mcq"
    const isMultiSelect = questionType === "multi_output" || questionType === "select_all"
    const isTextInput = ["fill_blank", "code_output", "trace_output", "trace_logic", "scenario_match"].includes(
      questionType,
    )
    const isCodeQuestion = [
      "code_write",
      "code_write_plot",
      "code_explain",
      "code_problem",
      "debug_code",
      "code_debug",
    ].includes(questionType)

    console.log("[v0] Submit answer - Question type:", questionType)
    console.log("[v0]   Selected answer:", selectedAnswer)
    console.log("[v0]   Selected multi answers:", selectedMultiAnswers)
    console.log("[v0]   Code:", code?.substring(0, 50))
    console.log("[v0]   Has plot:", !!uploadedPlot)

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
      toast({
        title: "Evaluating with AI...",
        description: "Sending your code to AI for grading. This may take a moment.",
      })

      setIsTimerActive(false)
      markQuestionAsAnswered(currentQuestionIndex)

      // Call AI evaluation
      callAIEvaluation(currentQuestion, code, uploadedPlot)
      return
    }

    if (!isMultiSelect && !isTextInput && !selectedAnswer) {
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
  }

  const handleRetry = () => {
    setShowFeedback(false)
    setSelectedAnswer("")
    const currentQuestionTime = questions[currentQuestionIndex].time_limit || exam!.time_per_question
    setTimeLeft(currentQuestionTime)
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      navigateToQuestion(currentQuestionIndex + 1)
    } else {
      toast({
        title: "Preview complete",
        description: "You've reached the end of the exam preview.",
      })
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      navigateToQuestion(currentQuestionIndex - 1)
    }
  }

  const navigateToQuestion = (index: number) => {
    setCurrentQuestionIndex(index)
    setSelectedAnswer(null)
    setSelectedMultiAnswers([])
    setShowFeedback(false)
    setShowNavigator(false)

    const questionTime = questions[index].time_limit || exam!.time_per_question
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

  const handleCodeChange = (value: string) => {
    setCode(value)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading exam preview...</div>
      </div>
    )
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">No questions found in this exam.</p>
          <Link href="/admin/mid-semester-exams">
            <Button className="mt-4">Back to Exams</Button>
          </Link>
        </div>
      </div>
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
  } else if (isSingleSelect && selectedAnswer) {
    const optionKey = `option_${selectedAnswer.toLowerCase()}` as keyof Question
    selectedAnswerText = currentQuestion[optionKey] as string
  }

  if (isTextInput) {
    // Handle array format: ["answer"] or string format: "answer"
    if (Array.isArray(correctAnswerText)) {
      correctAnswerText = correctAnswerText[0] || ""
    } else if (typeof correctAnswerText === "string") {
      try {
        const parsed = JSON.parse(correctAnswerText)
        if (Array.isArray(parsed)) {
          correctAnswerText = parsed[0] || ""
        }
      } catch (e) {
        // Keep as plain string
      }
    }
  } else if (isSingleSelect) {
    // Handle array format: ["False"] or string format: "False" or "A"
    let answerValue = correctAnswerText

    if (Array.isArray(correctAnswerText)) {
      answerValue = correctAnswerText[0] || ""
    } else if (typeof correctAnswerText === "string") {
      try {
        const parsed = JSON.parse(correctAnswerText)
        if (Array.isArray(parsed)) {
          answerValue = parsed[0] || ""
        } else {
          answerValue = correctAnswerText
        }
      } catch (e) {
        answerValue = correctAnswerText
      }
    }

    // If it's a single letter (A, B, C, D), convert to option text
    if (typeof answerValue === "string" && answerValue.length === 1 && /[A-E]/i.test(answerValue)) {
      const optionKey = `option_${answerValue.toLowerCase()}` as keyof Question
      correctAnswerText = currentQuestion[optionKey] as string
    } else {
      correctAnswerText = answerValue
    }
  }

  let isCorrect = false
  let correctAnswersInOptions: string[] = []

  if (isMultiSelect) {
    try {
      // Handle both array and string formats
      let correctAnswers = currentQuestion.correct_answer
      if (typeof correctAnswers === "string") {
        correctAnswers = JSON.parse(correctAnswers)
      }

      console.log("[Preview] Mid-Semester Select All - Raw correct answers:", correctAnswers)

      // Check if correct answers are letters (A, B, C, D, E) and convert to option text
      const allLetters = Array.isArray(correctAnswers) && correctAnswers.every((ans: string) => 
        typeof ans === 'string' && ans.trim().length === 1 && /[A-E]/i.test(ans.trim())
      )

      if (allLetters) {
        console.log("[Preview] Mid-Semester Select All - Correct answers are LETTERS, converting to option text")
        correctAnswers = correctAnswers.map((letter: string) => {
          const optionKey = `option_${letter.trim().toLowerCase()}` as keyof Question
          return currentQuestion[optionKey] as string
        }).filter(Boolean)
      } else {
        console.log("[Preview] Mid-Semester Select All - Correct answers are VALUES (already option text)")
      }

      const availableOptions = [
        currentQuestion.option_a,
        currentQuestion.option_b,
        currentQuestion.option_c,
        currentQuestion.option_d,
        currentQuestion.option_e,
      ].filter(Boolean)

      console.log("[Preview] Mid-Semester Select All - Processed correct answers:", correctAnswers)
      console.log("[Preview] Mid-Semester Select All - Available options:", availableOptions)

      correctAnswersInOptions = correctAnswers.filter((ans: string) => availableOptions.includes(ans))

      const selectedTexts = selectedMultiAnswers.map((letter) => {
        const optionKey = `option_${letter.toLowerCase()}` as keyof Question
        return currentQuestion[optionKey] as string
      })

      console.log("[Preview] Mid-Semester Select All - Correct answers in options:", correctAnswersInOptions)
      console.log("[Preview] Mid-Semester Select All - Selected texts:", selectedTexts)

      isCorrect =
        correctAnswersInOptions.length === selectedTexts.length &&
        correctAnswersInOptions.every((ans: string) => selectedTexts.includes(ans))
      
      console.log("[Preview] Mid-Semester Select All - Is correct:", isCorrect)
    } catch (e) {
      console.error("[Preview] Mid-Semester Select All - Failed to parse correct_answer:", e)
      isCorrect = false
    }
  } else if (isTextInput) {
    const normalizedSelected = selectedAnswerText.trim().toLowerCase()
    const normalizedCorrect = String(correctAnswerText).trim().toLowerCase()
    isCorrect = normalizedSelected === normalizedCorrect
  } else {
    isCorrect = selectedAnswerText?.trim() === String(correctAnswerText)?.trim()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-5 w-5 text-primary" />
            <Badge variant="outline">Preview Mode</Badge>
          </div>
          <h2 className="text-3xl font-bold text-foreground">{exam.title}</h2>
          <p className="text-muted-foreground mt-1">{exam.description}</p>
        </div>
        <Link href="/admin/mid-semester-exams">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Exit Preview
          </Button>
        </Link>
      </div>

      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-foreground">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <Button variant="outline" size="sm" onClick={() => setShowNavigator(!showNavigator)}>
                <Grid3x3 className="h-4 w-4 mr-2" />
                {showNavigator ? "Hide" : "Show"} Navigator
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant={flaggedQuestions.has(currentQuestionIndex) ? "default" : "outline"}
                size="sm"
                onClick={toggleFlag}
              >
                <Flag className="h-4 w-4 mr-2" />
                {flaggedQuestions.has(currentQuestionIndex) ? "Flagged" : "Flag"}
              </Button>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span
                  className={`text-sm font-medium ${timeLeft <= 10 && isTimerActive ? "text-destructive" : "text-foreground"}`}
                >
                  {timeLeft}s
                </span>
              </div>
            </div>
          </div>

          {showNavigator && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-10 gap-2">
                {questions.map((_, index) => {
                  const isAnswered = answeredQuestions.has(index)
                  const isFlagged = flaggedQuestions.has(index)
                  const isCurrent = index === currentQuestionIndex

                  return (
                    <button
                      key={index}
                      onClick={() => navigateToQuestion(index)}
                      className={`relative aspect-square rounded-lg border-2 flex items-center justify-center text-sm font-medium transition-all ${
                        isCurrent
                          ? "border-primary bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                          : isAnswered
                            ? "border-green-500 bg-green-50 text-green-700 hover:bg-green-100"
                            : "border-orange-500 bg-orange-50 text-orange-700 hover:bg-orange-100"
                      }`}
                    >
                      {index + 1}
                      {isFlagged && <Flag className="absolute -top-1 -right-1 h-3 w-3 fill-red-500 text-red-500" />}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-2 border-green-500 bg-green-50" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-2 border-orange-500 bg-orange-50" />
                  <span>Unanswered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border-2 border-primary bg-primary" />
                  <span>Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 fill-red-500 text-red-500" />
                  <span>Flagged</span>
                </div>
              </div>
            </div>
          )}

          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardContent className="pt-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <QuestionTextRenderer text={currentQuestion.question_text} className="text-xl font-medium" />
              {currentQuestion.time_limit && <Badge variant="secondary">Custom: {currentQuestion.time_limit}s</Badge>}
            </div>

            <QuestionRenderer
              question={currentQuestion}
              selectedAnswer={selectedAnswer || ""}
              selectedMultiAnswers={selectedMultiAnswers}
              code={code}
              showFeedback={showFeedback}
              isSubmittingAnswer={false}
              isCorrect={isCorrect}
              partialCreditPoints={null}
              onAnswerChange={handleAnswerSelect}
              onMultiAnswerToggle={toggleMultiAnswer}
              onCodeChange={handleCodeChange}
              isPreviewMode={true}
              sampleAnswers={currentQuestion.sample_answers}
              uploadedPlot={uploadedPlot}
              onPlotUpload={handlePlotUpload}
              onPlotRemove={handlePlotRemove}
            />
          </div>

          {showFeedback && (
            <div
              className={`p-4 rounded-lg border-2 ${
                feedback ? (
                  feedback.isCorrect 
                    ? "bg-green-50 border-green-500" 
                    : "bg-amber-50 border-amber-500"
                ) : (
                  isCorrect ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500"
                )
              }`}
            >
              {feedback ? (
                // AI-graded feedback
                <div className="space-y-2 w-full">
                  <div className="flex items-center gap-3">
                    {feedback.isCorrect ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-700">
                          Excellent! ({feedback.earnedPoints}/{feedback.totalPoints} points)
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-amber-600" />
                        <span className="font-semibold text-amber-700">
                          Needs Improvement ({feedback.earnedPoints}/{feedback.totalPoints} points)
                        </span>
                      </>
                    )}
                  </div>
                  <div className="pl-8 text-sm text-gray-700">
                    <p className="font-medium mb-1">AI Feedback:</p>
                    <p className="whitespace-pre-wrap">{feedback.explanation}</p>
                  </div>
                </div>
              ) : (
                // Regular feedback
                <div className="flex items-center gap-3">
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-700">Correct!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-semibold text-red-700">
                        {isMultiSelect
                          ? `Incorrect. Check the highlighted correct answers.`
                          : `Incorrect. The correct answer is: ${correctAnswerText}`}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              {!isTimerActive && !showFeedback && (
                <Button onClick={startTimer} variant="outline">
                  <Clock className="h-4 w-4 mr-2" />
                  Start Timer
                </Button>
              )}

              {!showFeedback && (
                <Button 
                  onClick={handleSubmitAnswer} 
                  disabled={isSubmittingAnswer}
                  className="bg-accent hover:bg-accent/90"
                >
                  {isSubmittingAnswer ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Evaluating with AI...
                    </span>
                  ) : (
                    "Submit Answer"
                  )}
                </Button>
              )}

              {showFeedback && isTextInput && !isCorrect && (
                <Button onClick={handleRetry} variant="outline">
                  Try Again
                </Button>
              )}

              {showFeedback && currentQuestionIndex < questions.length - 1 && (
                <Button onClick={handleNextQuestion} className="bg-accent hover:bg-accent/90">
                  Next Question
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}

              {showFeedback && currentQuestionIndex === questions.length - 1 && (
                <Link href="/admin/mid-semester-exams">
                  <Button className="bg-accent hover:bg-accent/90">Finish Preview</Button>
                </Link>
              )}
            </div>

            <Button
              variant="outline"
              onClick={handleNextQuestion}
              disabled={currentQuestionIndex === questions.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Eye className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-1">Preview Mode Information</p>
              <p className="text-sm text-muted-foreground">
                This is how students will see the exam. You can navigate between questions using the Previous/Next
                buttons or the question navigator grid, flag questions for review, and test the exam flow exactly as
                students experience it.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
