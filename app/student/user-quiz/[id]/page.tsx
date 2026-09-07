"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, LogOut, Clock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { logoutStudent, studentApiFetch } from "@/lib/auth"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"

interface Question {
  id: number
  question_text: string
  question_type: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e?: string | null
  correct_answer: string
  time_limit: number | null
}

interface Quiz {
  id: number
  title: string
  description: string
  time_per_question: number
  creator_name: string
}

export default function UserQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: quizId } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const homeLink = useSmartHomeLink()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [score, setScore] = useState(0)

  useEffect(() => {
    const studentId = sessionStorage.getItem("studentId")
    if (!studentId) {
      router.push("/student/login")
      return
    }

    fetchQuiz()
  }, [router, quizId])

  useEffect(() => {
    if (!quizStarted || quizCompleted) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleNextQuestion()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [quizStarted, quizCompleted, currentQuestionIndex])

  const fetchQuiz = async () => {
    try {
      const response = await studentApiFetch(`/api/student/quizzes/${quizId}`)
      if (!response.ok) throw new Error("Failed to fetch quiz")

      const data = await response.json()
      setQuiz(data.quiz)
      setQuestions(data.questions)
    } catch (error) {
      console.error("[v0] Failed to fetch quiz:", error)
      toast({
        title: "Error",
        description: "Failed to load quiz.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const startQuiz = () => {
    setQuizStarted(true)
    const currentQuestion = questions[0]
    setTimeLeft(currentQuestion.time_limit || quiz?.time_per_question || 60)
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1
      setCurrentQuestionIndex(nextIndex)
      const nextQuestion = questions[nextIndex]
      setTimeLeft(nextQuestion.time_limit || quiz?.time_per_question || 60)
    } else {
      submitQuiz()
    }
  }

  const submitQuiz = async () => {
    setQuizCompleted(true)

    // Calculate score
    let correctCount = 0
    questions.forEach((question) => {
      const userAnswer = answers[question.id]
      if (userAnswer === question.correct_answer) {
        correctCount++
      }
    })

    setScore(correctCount)

    // Submit to backend
    try {
      await studentApiFetch("/api/student/quizzes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quizId,
          answers,
          score: correctCount,
          totalQuestions: questions.length,
        }),
      })
    } catch (error) {
      console.error("[v0] Failed to submit quiz:", error)
    }
  }

  const handleLogout = () => {
    logoutStudent()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <p className="text-muted-foreground">Loading quiz...</p>
      </div>
    )
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Quiz not found or has no questions.</p>
            <Button onClick={() => router.push("/student/browse-quizzes")} className="mt-4">
              Back to Browse
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href={homeLink} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <GraduationCap className="h-8 w-8 text-[var(--cc-accent-dark)]" />
              <h1 className="text-2xl font-bold text-[var(--cc-accent-dark)]">CourseCollab</h1>
            </Link>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!quizStarted ? (
          <Card className="max-w-2xl mx-auto border-2">
            <CardHeader>
              <CardTitle className="text-2xl">{quiz.title}</CardTitle>
              <p className="text-muted-foreground">{quiz.description}</p>
              <p className="text-sm text-muted-foreground">Created by {quiz.creator_name}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Total Questions:</strong> {questions.length}
                </p>
                <p className="text-sm">
                  <strong>Time per Question:</strong> {quiz.time_per_question} seconds
                </p>
              </div>
              <Button onClick={startQuiz} className="w-full bg-accent hover:bg-accent/90">
                Start Quiz
              </Button>
            </CardContent>
          </Card>
        ) : quizCompleted ? (
          <Card className="max-w-2xl mx-auto border-2">
            <CardHeader>
              <CardTitle className="text-2xl">Quiz Completed!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-8">
                <div className="text-6xl font-bold text-[var(--cc-accent-dark)] mb-4">
                  {score}/{questions.length}
                </div>
                <p className="text-xl text-muted-foreground">
                  You scored {Math.round((score / questions.length) * 100)}%
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => router.push("/student/browse-quizzes")} variant="outline" className="flex-1">
                  Browse More Quizzes
                </Button>
                <Button
                  onClick={() => router.push("/student/dashboard")}
                  className="flex-1 bg-accent hover:bg-accent/90"
                >
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Question {currentQuestionIndex + 1} of {questions.length}
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4" />
                {timeLeft}s
              </div>
            </div>

            <Progress value={progress} className="h-2" />

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">{currentQuestion.question_text}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentQuestion.question_type === "MCQ" && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(value) => setAnswers({ ...answers, [currentQuestion.id]: value })}
                  >
                    {["A", "B", "C", "D", "E"].map((option) => {
                      const optionKey = `option_${option.toLowerCase()}` as keyof Question
                      const optionText = currentQuestion[optionKey] as string
                      if (!optionText) return null

                      return (
                        <div key={option} className="flex items-center space-x-2 p-3 rounded-lg hover:bg-secondary">
                          <RadioGroupItem value={option} id={`option-${option}`} />
                          <Label htmlFor={`option-${option}`} className="flex-1 cursor-pointer text-slate-900 dark:text-slate-100">
                            {option}. {optionText}
                          </Label>
                        </div>
                      )
                    })}
                  </RadioGroup>
                )}

                {currentQuestion.question_type === "TRUE_FALSE" && (
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(value) => setAnswers({ ...answers, [currentQuestion.id]: value })}
                  >
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-secondary">
                      <RadioGroupItem value="A" id="option-true" />
                      <Label htmlFor="option-true" className="flex-1 cursor-pointer text-slate-900 dark:text-slate-100">
                        True
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-secondary">
                      <RadioGroupItem value="B" id="option-false" />
                      <Label htmlFor="option-false" className="flex-1 cursor-pointer text-slate-900 dark:text-slate-100">
                        False
                      </Label>
                    </div>
                  </RadioGroup>
                )}

                <Button onClick={handleNextQuestion} className="w-full bg-accent hover:bg-accent/90">
                  {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Submit Quiz"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
