"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle2, XCircle, Eye, EyeOff, BookOpen, Lightbulb, Info, GraduationCap } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Question {
  question_id: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e: string // Include option E
  correct_answer: string
  selected_answer: string | null
  question_type: string
  is_correct: boolean
  hint: string | null
  explanation: string | null
  topic: string | null
  difficulty: string | null
}

interface ReviewData {
  quiz_title: string
  score: number
  total_questions: number
  completed_at: string
  attempt_number: number
  questions: Question[]
}

export function ReviewIncorrect({ attemptId }: { attemptId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  usePreventBack("/student/login")
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showOnlyIncorrect, setShowOnlyIncorrect] = useState(searchParams.get("incorrect") === "true")
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentId")
    if (!studentId) {
      router.push("/student/login")
      return
    }
    fetchReviewQuestions()
  }, [attemptId, router])

  const fetchReviewQuestions = async () => {
    try {
      const response = await studentApiFetch(`/api/student/review/${attemptId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load review questions")
      }

      setReviewData(data)
    } catch (error) {
      console.error("[v0] Failed to fetch review questions:", error)
      router.push("/student/dashboard")
    } finally {
      setLoading(false)
    }
  }

  const filteredQuestions = reviewData?.questions.filter((q) => !showOnlyIncorrect || !q.is_correct) || []

  const handleNextQuestion = () => {
    if (currentQuestionIndex < filteredQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setRevealAnswer(false)
      setShowHint(false)
      setShowExplanation(false)
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
      setRevealAnswer(false)
      setShowHint(false)
      setShowExplanation(false)
    }
  }

  const toggleIncorrectOnly = () => {
    setShowOnlyIncorrect(!showOnlyIncorrect)
    setCurrentQuestionIndex(0)
    setRevealAnswer(false)
    setShowHint(false)
    setShowExplanation(false)
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading review questions...</div>
  }

  if (!reviewData || reviewData.questions.length === 0) {
    return (
      <Card className="border border-emerald-200/60 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-emerald-900/30 max-w-2xl mx-auto mt-8 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
        <CardContent className="text-center py-6">
          <div className="p-4 bg-emerald-100/80 dark:bg-emerald-800/80 rounded-2xl w-fit mx-auto mb-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">No Questions Found</h3>
          <p className="mb-6 text-slate-600 dark:text-slate-400">Unable to load quiz questions for review.</p>
          <Button onClick={() => router.push("/student/dashboard")} variant="outline" className="gap-2 rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (filteredQuestions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => router.push(`/student/results/${attemptId}`)} className="gap-2 rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80">
            <ArrowLeft className="h-4 w-4" />
            Back to Results
          </Button>
        </div>
        <Card className="border border-emerald-200/60 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-emerald-900/30 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
          <CardContent className="text-center py-8">
            <div className="p-4 bg-emerald-100/80 dark:bg-emerald-800/80 rounded-2xl w-fit mx-auto mb-4">
              <CheckCircle2 className="h-16 w-16 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Perfect Score!</h3>
            <p className="mb-6 text-slate-600 dark:text-slate-400">You answered all questions correctly. Nothing to review!</p>
            <Button onClick={() => setShowOnlyIncorrect(false)} variant="outline" className="rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80">
              Show All Questions
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentQuestion = filteredQuestions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / filteredQuestions.length) * 100
  const incorrectCount = reviewData.questions.filter((q) => !q.is_correct).length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.push(`/student/results/${attemptId}`)} className="gap-2 rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80">
          <ArrowLeft className="h-4 w-4" />
          Back to Results
        </Button>
        <Button variant={showOnlyIncorrect ? "default" : "outline"} onClick={toggleIncorrectOnly} className={`gap-2 rounded-full ${showOnlyIncorrect ? "bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white shadow-lg" : "bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80"}`}>
          {showOnlyIncorrect ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {showOnlyIncorrect ? "Show All Questions" : "Show Only Incorrect"}
        </Button>
      </div>

      <Card className="border border-blue-200/60 dark:border-blue-700/60 bg-blue-50/80 dark:bg-blue-900/30 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100/80 dark:bg-blue-800/80 rounded-xl">
                <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  {showOnlyIncorrect ? "Review Incorrect Answers" : "Review All Questions"} - Attempt #
                  {reviewData.attempt_number}
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Score: {reviewData.score}/{reviewData.total_questions} (
                  {Math.round((reviewData.score / reviewData.total_questions) * 100)}%)
                  {incorrectCount > 0 && ` • ${incorrectCount} incorrect`}
                </p>
              </div>
            </div>
            <Badge variant={showOnlyIncorrect ? "destructive" : "secondary"} className={`rounded-full ${showOnlyIncorrect ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"}`}>
              {showOnlyIncorrect ? `${filteredQuestions.length} Incorrect` : `${filteredQuestions.length} Total`}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl">
        <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-700/80">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-2xl text-slate-800 dark:text-slate-200">{reviewData.quiz_title}</CardTitle>
            <div className="flex items-center gap-2">
              {currentQuestion.topic && (
                <Badge variant="outline" className="gap-1 rounded-full border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                  <GraduationCap className="h-3 w-3" />
                  {currentQuestion.topic}
                </Badge>
              )}
              {currentQuestion.difficulty && (
                <Badge
                  variant="secondary"
                  className={`rounded-full ${
                    currentQuestion.difficulty === "easy"
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : currentQuestion.difficulty === "medium"
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  }`}
                >
                  {currentQuestion.difficulty}
                </Badge>
              )}
              <Badge variant={currentQuestion.is_correct ? "default" : "destructive"} className={`text-sm rounded-full ${currentQuestion.is_correct ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}>
                {currentQuestion.is_correct ? "✓ Correct" : "✗ Incorrect"}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>
                Question {currentQuestionIndex + 1} of {filteredQuestions.length}
              </span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <QuestionTextRenderer text={currentQuestion.question_text} className="text-xl font-medium text-slate-800 dark:text-slate-200" />
                {currentQuestion.selected_answer && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Your answer:{" "}
                    <span className={`font-semibold ${currentQuestion.is_correct ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {currentQuestion.selected_answer}
                    </span>
                  </p>
                )}
              </div>

              {currentQuestion.hint && (
                <div>
                  <Button onClick={() => setShowHint(!showHint)} variant="outline" size="sm" className="gap-2 mb-2 rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80">
                    <Lightbulb className="h-4 w-4" />
                    {showHint ? "Hide Hint" : "Show Hint"}
                  </Button>
                  <AnimatePresence>
                    {showHint && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <Alert className="bg-amber-50/80 dark:bg-amber-900/30 border-amber-200/60 dark:border-amber-700/60 rounded-xl">
                          <div className="p-2 bg-amber-100/80 dark:bg-amber-800/80 rounded-xl">
                            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <AlertDescription className="text-amber-900 dark:text-amber-100">{currentQuestion.hint}</AlertDescription>
                        </Alert>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="space-y-3">
                {["A", "B", "C", "D", "E"].map((option, index) => {
                  const optionText = currentQuestion[`option_${option.toLowerCase()}` as keyof Question] as string
                  if (!optionText) return null // Skip if option doesn't exist

                  const isSelected = currentQuestion.selected_answer === option
                  const isCorrectOption = option === currentQuestion.correct_answer
                  const showCorrect = revealAnswer && isCorrectOption
                  const showWrong = revealAnswer && isSelected && !currentQuestion.is_correct

                  return (
                    <motion.div
                      key={option}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.3 }}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        showCorrect
                          ? "border-green-500 bg-green-50"
                          : showWrong
                            ? "border-red-500 bg-red-50"
                            : isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold ${
                            showCorrect
                              ? "border-green-500 bg-green-500 text-white"
                              : showWrong
                                ? "border-red-500 bg-red-500 text-white"
                                : isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border text-muted-foreground"
                          }`}
                        >
                          {showCorrect ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : showWrong ? (
                            <XCircle className="h-5 w-5" />
                          ) : (
                            option
                          )}
                        </div>
                        <span className="text-foreground">{optionText}</span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              <AnimatePresence>
                {revealAnswer && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={`flex items-center gap-3 p-4 rounded-lg ${
                      currentQuestion.is_correct
                        ? "bg-green-50 border-2 border-green-500"
                        : "bg-red-50 border-2 border-red-500"
                    }`}
                  >
                    {currentQuestion.is_correct ? (
                      <>
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                        <span className="font-semibold text-green-700">
                          Correct! You selected {currentQuestion.selected_answer}.
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-6 w-6 text-red-600" />
                        <span className="font-semibold text-red-700">
                          You selected {currentQuestion.selected_answer}. The correct answer is{" "}
                          {currentQuestion.correct_answer}.
                        </span>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {currentQuestion.explanation && (
                <div>
                  <Button
                    onClick={() => setShowExplanation(!showExplanation)}
                    variant="outline"
                    size="sm"
                    className="gap-2 mb-2"
                  >
                    <Info className="h-4 w-4" />
                    {showExplanation ? "Hide Explanation" : "Show Explanation"}
                  </Button>
                  <AnimatePresence>
                    {showExplanation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <Alert className="bg-blue-50 border-blue-200">
                          <Info className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-900">
                            <strong className="block mb-1">Explanation:</strong>
                            {currentQuestion.explanation}
                          </AlertDescription>
                        </Alert>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="flex justify-between items-center gap-3 pt-4">
                <Button
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  variant="outline"
                  className="px-6 rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80"
                >
                  Previous
                </Button>
                <Button
                  onClick={() => setRevealAnswer(!revealAnswer)}
                  variant={revealAnswer ? "secondary" : "default"}
                  className={`px-6 rounded-full ${revealAnswer ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" : "bg-gradient-to-r from-purple-700 to-purple-800 hover:from-purple-800 hover:to-purple-900 text-white shadow-lg"}`}
                >
                  {revealAnswer ? "Hide Answer" : "Show Answer"}
                </Button>
                <Button
                  onClick={handleNextQuestion}
                  disabled={currentQuestionIndex === filteredQuestions.length - 1}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 rounded-full shadow-lg"
                >
                  Next
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      <Card className="border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] rounded-2xl">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
            {filteredQuestions.map((q, idx) => (
              <button
                key={q.question_id}
                onClick={() => {
                  setCurrentQuestionIndex(idx)
                  setRevealAnswer(false)
                  setShowHint(false)
                  setShowExplanation(false)
                }}
                className={`w-10 h-10 rounded-xl border-2 font-semibold transition-all ${
                  idx === currentQuestionIndex
                    ? "border-purple-500 bg-purple-500 text-white shadow-lg"
                    : q.is_correct
                      ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:border-emerald-500 dark:hover:border-emerald-500"
                      : "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:border-red-500 dark:hover:border-red-500"
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
