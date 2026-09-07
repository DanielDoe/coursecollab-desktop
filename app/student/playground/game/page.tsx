"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { GraduationCap, Trophy, Sparkles } from "lucide-react"
import { PlaygroundQuestionCard } from "@/components/playground/playground-question-card"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { QuestionLeaderboard, type LeaderboardEntry } from "@/components/question-leaderboard"
import { getPlaygroundCorrectOptionLetter, isPlaygroundSelectAll, parsePlaygroundCorrectLetters } from "@/lib/playground-question-utils"
import { getStudentAuthHeaders } from "@/lib/auth"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"
import { cn } from "@/lib/utils"
import {
  clearPlaygroundSessionLock,
  completePlaygroundSessionLock,
  getPlaygroundSessionLock,
  recordPlaygroundAnswerLock,
  upsertPlaygroundSessionLock,
} from "@/lib/playground-session-lock"
import {
  PLAYGROUND_LEAVE_SESSION_MESSAGE,
  PLAYGROUND_LEAVE_SESSION_TITLE,
} from "@/lib/playground-join-guard"

interface Question {
  id: number
  questionText: string
  questionType: string
  options: string[]
}

type PlaygroundPriorAnswer = {
  selectedAnswer: string | null
  isCorrect: boolean
}

interface QuestionLeaderboardEntry extends LeaderboardEntry {}

const CLASSROOM_LEADERBOARD_MS = 5000

export default function PlaygroundGame() {
  const router = useRouter()
  const { toast } = useToast()
  const homeLink = useSmartHomeLink()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])
  const [timeLeft, setTimeLeft] = useState(10)
  const [score, setScore] = useState(0)
  const [isRevealing, setIsRevealing] = useState(false)
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null)
  const [earnedPoints, setEarnedPoints] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionData, setSessionData] = useState<any>(null)
  const [studentData, setStudentData] = useState<any>(null)
  const [gameEnded, setGameEnded] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const questionStartTime = useRef<number>(Date.now())
  const [questionLeaderboard, setQuestionLeaderboard] = useState<QuestionLeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [showStartCountdown, setShowStartCountdown] = useState(true)
  const [startCountdown, setStartCountdown] = useState(5)
  const [showReadyCountdown, setShowReadyCountdown] = useState(false)
  const [readyCountdown, setReadyCountdown] = useState(3)
  const [canAnswer, setCanAnswer] = useState(false)
  const [accumulatedPoints, setAccumulatedPoints] = useState<number | null>(null)
  const [fromDashboardV2, setFromDashboardV2] = useState(false)
  const startCountdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const readyCountdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const sessionEndedRef = useRef(false)
  const sessionEndedPollStreakRef = useRef(0)
  const [answeredByQuestionId, setAnsweredByQuestionId] = useState<Map<number, PlaygroundPriorAnswer>>(new Map())
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)

  const clearPlaygroundSession = useCallback(() => {
    sessionStorage.removeItem("playgroundSession")
    sessionStorage.removeItem("playgroundStudent")
    sessionStorage.removeItem("playgroundFromDashboardV2")
    clearPlaygroundSessionLock()
  }, [])

  const fetchQuestionLeaderboard = useCallback(
    async (questionId: number, { showSpinner = false }: { showSpinner?: boolean } = {}) => {
      if (!sessionData?.sessionId) return
      if (showSpinner) setLeaderboardLoading(true)
      try {
        const response = await fetch(
          `/api/playground/question-leaderboard?sessionId=${sessionData.sessionId}&questionId=${questionId}`,
        )
        if (response.ok) {
          const data = await response.json()
          setQuestionLeaderboard(data.leaderboard || [])
        }
      } catch {
        // non-critical
      } finally {
        if (showSpinner) setLeaderboardLoading(false)
      }
    },
    [sessionData?.sessionId],
  )

  const handleSessionEnded = useCallback(() => {
    if (sessionEndedRef.current) return
    sessionEndedRef.current = true

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (startCountdownTimerRef.current) {
      clearTimeout(startCountdownTimerRef.current)
      startCountdownTimerRef.current = null
    }
    if (readyCountdownTimerRef.current) {
      clearTimeout(readyCountdownTimerRef.current)
      readyCountdownTimerRef.current = null
    }

    const lobbyPath =
      sessionStorage.getItem("playgroundFromDashboardV2") === "true"
        ? "/student/dashboard-v2/playground"
        : "/student/playground"

    clearPlaygroundSession()
    toast({
      title: "Session ended",
      description: "Your instructor closed this playground session.",
    })
    router.replace(lobbyPath)
  }, [clearPlaygroundSession, toast, router])

  useEffect(() => {
    const session = sessionStorage.getItem("playgroundSession")
    const student = sessionStorage.getItem("playgroundStudent")
    const fromV2 = sessionStorage.getItem("playgroundFromDashboardV2") === "true"

    if (!session || !student) {
      router.push(fromV2 ? "/student/dashboard-v2/playground" : "/student/playground")
      return
    }

    setSessionData(JSON.parse(session))
    setStudentData(JSON.parse(student))
    setFromDashboardV2(fromV2)

    const parsed = JSON.parse(session)
    if (parsed.waitingRoom && !parsed.gameStarted) {
      void (async () => {
        try {
          const res = await fetch(
            `/api/playground/lobby?sessionId=${parsed.sessionId}&resultId=${parsed.resultId}`,
          )
          if (res.ok) {
            const data = await res.json()
            if (data.gameStarted && !data.sessionEnded) {
              const updated = {
                ...parsed,
                waitingRoom: false,
                gameStarted: true,
                currentQuestionIndex: 0,
              }
              sessionStorage.setItem("playgroundSession", JSON.stringify(updated))
              setSessionData(updated)
              return
            }
          }
        } catch {
          /* fall through to waiting room */
        }
        router.replace(
          sessionStorage.getItem("playgroundFromDashboardV2") === "true"
            ? "/student/dashboard-v2/playground/waiting"
            : "/student/playground/waiting",
        )
      })()
    }
  }, [router])

  // Fetch accumulated points from trade center
  useEffect(() => {
    const fetchAccumulatedPoints = async () => {
      try {
        // Get student database ID from localStorage
        const studentSessionData = localStorage.getItem("studentSession")
        if (!studentSessionData) return
        
        const sessionData = JSON.parse(studentSessionData)
        const studentDbId = sessionData.databaseId
        // sessionData.section contains the session code (e.g., "ELEG1301P01")
        const sessionCode = sessionData.section || "ALL"
        
        if (!studentDbId) return
        
        const response = await fetch(`/api/trade-center/points?studentId=${studentDbId}&session=${sessionCode}`)
        if (response.ok) {
          const data = await response.json()
          if (data.points) {
            setAccumulatedPoints(data.points.playground_points || 0)
          }
        }
      } catch (error) {
        // Error fetching accumulated points
      }
    }
    
    fetchAccumulatedPoints()
  }, [])

  useEffect(() => {
    if (!sessionData) return

    const fetchQuestions = async () => {
      try {
        const response = await fetch(`/api/playground/questions?sessionId=${sessionData.sessionId}`)
        if (response.status === 403) {
          const data = await response.json().catch(() => ({}))
          if (data.sessionEnded) {
            handleSessionEnded()
            return
          }
        }
        if (!response.ok) throw new Error("Failed to fetch questions")

        const data = await response.json()
        setQuestions(data.questions)

        let answeredMap = new Map<number, PlaygroundPriorAnswer>()
        try {
          const answersRes = await fetch(`/api/playground/my-answers?resultId=${sessionData.resultId}`)
          if (answersRes.ok) {
            const answersData = await answersRes.json()
            for (const row of answersData.answers || []) {
              answeredMap.set(Number(row.questionId), {
                selectedAnswer: row.selectedAnswer ?? null,
                isCorrect: Boolean(row.isCorrect),
              })
            }
            setAnsweredByQuestionId(answeredMap)
          }
        } catch {
          /* non-critical */
        }

        let startIndex = sessionData.currentQuestionIndex > 0 ? sessionData.currentQuestionIndex : 0
        const lock = getPlaygroundSessionLock()
        if (answeredMap.size > 0) {
          const firstUnanswered = data.questions.findIndex(
            (q: Question) => !answeredMap.has(q.id),
          )
          if (firstUnanswered >= 0) {
            startIndex = firstUnanswered
          } else if (data.questions.length > 0) {
            startIndex = data.questions.length - 1
          }
          toast({
            title: "Resuming session",
            description: "Your previous answers are locked. Continuing from the next open question.",
          })
        }

        if (
          lock &&
          !lock.completed &&
          lock.sessionId === sessionData.sessionId &&
          lock.resultId === sessionData.resultId
        ) {
          startIndex = Math.max(startIndex, lock.lockedIndex)
        }

        setCurrentQuestionIndex(startIndex)
        setTimeLeft(sessionData.durationSec)

        if (sessionData.sessionId && sessionData.resultId) {
          upsertPlaygroundSessionLock({
            sessionId: sessionData.sessionId,
            resultId: sessionData.resultId,
            mode: sessionData.mode === "PERSONAL" ? "PERSONAL" : "CLASSROOM",
            startedAt: Date.now(),
            answeredQuestionIds: Array.from(answeredMap.keys()),
            lockedIndex: startIndex,
          })
        }

        if (sessionData.currentQuestionIndex > 0 && answeredMap.size === 0) {
          toast({
            title: "Joined Mid-Game",
            description: `Starting from question ${sessionData.currentQuestionIndex + 1}`,
          })
        }

        questionStartTime.current = Date.now()
        setIsLoading(false)
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load questions",
          variant: "destructive",
        })
      }
    }

    fetchQuestions()
  }, [sessionData, toast, handleSessionEnded])

  useEffect(() => {
    if (isLoading || questions.length === 0) return
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) return
    const prior = answeredByQuestionId.get(currentQuestion.id)
    if (!prior) return

    if (isPlaygroundSelectAll(currentQuestion.questionType)) {
      try {
        const parsed = prior.selectedAnswer ? JSON.parse(prior.selectedAnswer) : []
        setSelectedAnswers(Array.isArray(parsed) ? parsed : [])
      } catch {
        setSelectedAnswers([])
      }
    } else {
      setSelectedAnswer(prior.selectedAnswer)
    }
    setCanAnswer(false)
    setIsRevealing(false)
    const timer = setTimeout(() => {
      void moveToNextQuestion()
    }, 1200)
    return () => clearTimeout(timer)
  }, [currentQuestionIndex, questions, answeredByQuestionId, isLoading])

  useEffect(() => {
    if (!sessionData || sessionData.mode !== "CLASSROOM" || gameEnded || sessionEndedRef.current) {
      return
    }

    const pollSessionStatus = async () => {
      try {
        const studentIdParam = studentData?.studentId
          ? `&studentId=${encodeURIComponent(String(studentData.studentId))}`
          : ""
        const response = await fetch(
          `/api/playground/lobby?sessionId=${sessionData.sessionId}&resultId=${sessionData.resultId}${studentIdParam}`,
          { headers: getStudentAuthHeaders() },
        )
        if (!response.ok) {
          sessionEndedPollStreakRef.current = 0
          return
        }
        const data = await response.json()
        if (data.sessionEnded) {
          sessionEndedPollStreakRef.current += 1
          if (sessionEndedPollStreakRef.current >= 2) {
            handleSessionEnded()
          }
        } else {
          sessionEndedPollStreakRef.current = 0
        }
      } catch {
        sessionEndedPollStreakRef.current = 0
      }
    }

    pollSessionStatus()
    const interval = setInterval(pollSessionStatus, 2000)
    return () => clearInterval(interval)
  }, [sessionData, studentData, gameEnded, handleSessionEnded])

  useEffect(() => {
    if (!isRevealing || sessionData?.mode !== "CLASSROOM") return
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) return

    fetchQuestionLeaderboard(currentQuestion.id, { showSpinner: questionLeaderboard.length === 0 })
    const interval = setInterval(() => {
      fetchQuestionLeaderboard(currentQuestion.id)
    }, 800)
    return () => clearInterval(interval)
  }, [isRevealing, sessionData?.mode, currentQuestionIndex, questions, fetchQuestionLeaderboard])

  useEffect(() => {
    if (!showStartCountdown || isLoading) return

    if (startCountdown > 0) {
      startCountdownTimerRef.current = setTimeout(() => setStartCountdown((prev) => prev - 1), 1000)
    } else {
      setShowStartCountdown(false)
      setShowReadyCountdown(true)
      setReadyCountdown(3)
    }

    return () => {
      if (startCountdownTimerRef.current) {
        clearTimeout(startCountdownTimerRef.current)
      }
    }
  }, [startCountdown, showStartCountdown, isLoading])

  useEffect(() => {
    if (!showReadyCountdown) return

    if (readyCountdown > 0) {
      readyCountdownTimerRef.current = setTimeout(() => setReadyCountdown((prev) => prev - 1), 1000)
    } else {
      setShowReadyCountdown(false)
      setCanAnswer(true)
      questionStartTime.current = Date.now() // Reset timer when answering begins
    }

    return () => {
      if (readyCountdownTimerRef.current) {
        clearTimeout(readyCountdownTimerRef.current)
      }
    }
  }, [readyCountdown, showReadyCountdown])

  useEffect(() => {
    if (isLoading || isRevealing || gameEnded || showStartCountdown || showReadyCountdown || !canAnswer) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeUp()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isLoading, isRevealing, currentQuestionIndex, gameEnded, showStartCountdown, showReadyCountdown, canAnswer])

  const handleTimeUp = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const currentQuestion = questions[currentQuestionIndex]
    const answerPayload = isPlaygroundSelectAll(currentQuestion?.questionType)
      ? JSON.stringify(selectedAnswers)
      : selectedAnswer
    await submitAnswer(answerPayload)
  }

  const submitAnswer = async (answer: string | null) => {
    if (isRevealing) return

    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) return

    setIsRevealing(true)
    const responseTimeMs = Date.now() - questionStartTime.current
    const timeTaken = Math.floor(responseTimeMs / 1000)

    try {
      const response = await fetch("/api/playground/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultId: sessionData.resultId,
          questionId: currentQuestion.id,
          selectedAnswer: answer,
          timeTaken,
          responseTimeMs,
        }),
      })

      if (response.status === 403) {
        const data = await response.json().catch(() => ({}))
        if (data.sessionEnded) {
          handleSessionEnded()
          return
        }
      }

      if (!response.ok) throw new Error("Failed to submit answer")

      const data = await response.json()
      if (data.alreadyAnswered) {
        setAnsweredByQuestionId((prev) => {
          const next = new Map(prev)
          next.set(currentQuestion.id, {
            selectedAnswer: answer,
            isCorrect: Boolean(data.isCorrect),
          })
          return next
        })
        recordPlaygroundAnswerLock(currentQuestion.id, currentQuestionIndex + 1)
        setTimeout(() => {
          moveToNextQuestion()
        }, 800)
        return
      }

      const resolvedCorrect = isPlaygroundSelectAll(currentQuestion.questionType)
        ? parsePlaygroundCorrectLetters(data.correctAnswer).join(",")
        : getPlaygroundCorrectOptionLetter({
            ...currentQuestion,
            correctAnswer: data.correctAnswer,
          }) ??
          (data.correctAnswer != null ? String(data.correctAnswer) : null)
      setCorrectAnswer(resolvedCorrect)
      setEarnedPoints(data.points)
      setScore((prev) => prev + data.points)
      setAnsweredByQuestionId((prev) => {
        const next = new Map(prev)
        next.set(currentQuestion.id, {
          selectedAnswer: answer,
          isCorrect: Boolean(data.isCorrect),
        })
        return next
      })
      recordPlaygroundAnswerLock(currentQuestion.id, currentQuestionIndex + 1)
      
      // Note: Points will be synced when game completes, not after each answer
      // This avoids unnecessary API calls during gameplay

      if (sessionData.mode === "CLASSROOM") {
        await fetchQuestionLeaderboard(currentQuestion.id, { showSpinner: true })
      }

      setTimeout(() => {
        moveToNextQuestion()
      }, sessionData.mode === "CLASSROOM" ? CLASSROOM_LEADERBOARD_MS : 2000)
    } catch (error) {
      setIsRevealing(false)
      toast({
        title: "Error",
        description: "Failed to submit answer",
        variant: "destructive",
      })
    }
  }

  const moveToNextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1
      setCurrentQuestionIndex(nextIndex)
      const lock = getPlaygroundSessionLock()
      if (lock) {
        upsertPlaygroundSessionLock({ ...lock, lockedIndex: Math.max(lock.lockedIndex, nextIndex) })
      }
      setSelectedAnswer(null)
      setSelectedAnswers([])
      setIsRevealing(false)
      setCorrectAnswer(null)
      setEarnedPoints(0)
      setQuestionLeaderboard([])
      setTimeLeft(sessionData.durationSec)
      setCanAnswer(false)
      setShowReadyCountdown(true)
      setReadyCountdown(3)
    } else {
      // Game ended - mark as completed and sync points
      try {
        // First mark as completed
        const completeResponse = await fetch("/api/playground/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resultId: sessionData.resultId,
          }),
        });
        
        if (!completeResponse.ok) {
          throw new Error("Failed to complete game");
        }
        
        // Refresh accumulated points after completion
        const studentSessionData = localStorage.getItem("studentSession")
        if (studentSessionData) {
          const sessionData = JSON.parse(studentSessionData)
          const studentDbId = sessionData.databaseId
          // sessionData.section contains the session code (e.g., "ELEG1301P01")
          const sessionCode = sessionData.section || "ALL"
          
          if (studentDbId) {
            // Force sync by calling the points API which triggers syncActivityPoints
            // Wait a bit for completion to process, then sync and refresh
            setTimeout(async () => {
              try {
                // This will trigger syncActivityPoints which recalculates points
                const pointsResponse = await fetch(`/api/trade-center/points?studentId=${studentDbId}&session=${sessionCode}`)
                const pointsData = await pointsResponse.json()
                if (pointsData.points) {
                  setAccumulatedPoints(pointsData.points.playground_points || 0)
                }
              } catch (err) {
                // Error refreshing points
              }
            }, 2000) // Increased delay to ensure completion is processed
          }
        }
      } catch (error) {
        // Error completing game
      }
      completePlaygroundSessionLock()
      setGameEnded(true);
    }
  }

  const handleAnswerSelect = (answer: string) => {
    const currentQuestion = questions[currentQuestionIndex]
    if (isRevealing || !canAnswer || answeredByQuestionId.has(currentQuestion?.id)) return
    if (isPlaygroundSelectAll(currentQuestion?.questionType)) {
      setSelectedAnswers((prev) =>
        prev.includes(answer) ? prev.filter((a) => a !== answer) : [...prev, answer].sort(),
      )
    } else {
      setSelectedAnswer(answer)
    }
  }

  const handleSubmit = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const currentQuestion = questions[currentQuestionIndex]
    const answerPayload = isPlaygroundSelectAll(currentQuestion?.questionType)
      ? JSON.stringify(selectedAnswers)
      : selectedAnswer
    submitAnswer(answerPayload)
  }

  const handleViewLeaderboard = () => {
    const fromV2 = sessionStorage.getItem("playgroundFromDashboardV2") === "true"
    const base = fromV2 ? "/student/dashboard-v2/playground" : "/student/playground"
    router.push(`${base}/leaderboard?sessionId=${sessionData.sessionId}&mode=${sessionData.mode}`)
  }

  const handleLeaveSession = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (startCountdownTimerRef.current) {
      clearTimeout(startCountdownTimerRef.current)
      startCountdownTimerRef.current = null
    }
    if (readyCountdownTimerRef.current) {
      clearTimeout(readyCountdownTimerRef.current)
      readyCountdownTimerRef.current = null
    }
    clearPlaygroundSession()
    setShowLeaveDialog(false)
    const homePath =
      sessionStorage.getItem("playgroundFromDashboardV2") === "true"
        ? "/student/dashboard-v2/playground"
        : "/student/playground"
    router.replace(homePath)
  }, [clearPlaygroundSession, router])

  useEffect(() => {
    if (isLoading || gameEnded || questions.length === 0) return

    const blockNavigation = () => {
      setShowLeaveDialog(true)
      window.history.pushState(null, "", window.location.href)
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.history.pushState(null, "", window.location.href)
    window.addEventListener("popstate", blockNavigation)
    window.addEventListener("beforeunload", onBeforeUnload)

    return () => {
      window.removeEventListener("popstate", blockNavigation)
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [isLoading, gameEnded, questions.length])

  if (showStartCountdown && !isLoading && questions.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
        <motion.div
          key={startCountdown}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          className="text-center"
        >
          {startCountdown > 0 ? (
            <>
              <div className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold text-[var(--cc-accent-dark)] mb-3 sm:mb-4">{startCountdown}</div>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground">Game starting in...</p>
            </>
          ) : (
            <>
              <div className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold text-accent mb-3 sm:mb-4">GO!</div>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground">Let's play!</p>
            </>
          )}
        </motion.div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--cc-accent)] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    const lobbyLink = sessionStorage.getItem("playgroundFromDashboardV2") === "true"
      ? "/student/dashboard-v2/playground"
      : "/student/playground"
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">No questions available for the playground.</p>
            <Button onClick={() => router.push(lobbyLink)}>Back to Lobby</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (gameEnded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <header className="border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href={homeLink} className="flex items-center gap-2">
                <GraduationCap className="h-8 w-8 text-[var(--cc-accent-dark)]" />
                <h1 className="text-2xl font-bold text-[var(--cc-accent-dark)]">CourseCollab</h1>
              </Link>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto max-w-2xl text-center"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-accent/10 mb-6">
              <Trophy className="h-12 w-12 text-accent" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4">Game Complete!</h2>
            <Card className="border-2 mb-4 sm:mb-5 md:mb-6">
              <CardContent className="pt-4 sm:pt-5 md:pt-6 px-4 sm:px-6">
                <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-[var(--cc-accent-dark)] mb-1 sm:mb-2">{score}</div>
                <p className="text-base sm:text-lg text-muted-foreground">Total Points</p>
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border">
                  <p className="text-xs sm:text-sm text-muted-foreground">{questions.length} questions answered</p>
                </div>
              </CardContent>
            </Card>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center w-full sm:w-auto">
              <Button onClick={handleViewLeaderboard} size="lg" className="w-full sm:w-auto text-sm sm:text-base">
                View Leaderboard
              </Button>
              <Button
                onClick={() =>
                  router.push(sessionStorage.getItem("playgroundFromDashboardV2") === "true" ? "/student/dashboard-v2/playground" : "/student/playground")
                }
                variant="outline"
                size="lg"
                className="w-full sm:w-auto text-sm sm:text-base"
              >
                Play Again
              </Button>
            </div>
          </motion.div>
        </main>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]

  if (!currentQuestion) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    )
  }

  const questionPanel = (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentQuestion.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="space-y-4 sm:space-y-5"
      >
        <PlaygroundQuestionCard
          question={currentQuestion}
          questionIndex={currentQuestionIndex}
          totalQuestions={questions.length}
          selectedAnswer={selectedAnswer}
          selectedAnswers={selectedAnswers}
          onSelectAnswer={handleAnswerSelect}
          onSubmit={handleSubmit}
          isRevealing={isRevealing}
          revealedCorrectAnswer={correctAnswer}
          earnedPoints={earnedPoints}
          canAnswer={canAnswer}
          showReadyCountdown={showReadyCountdown}
          readyCountdown={readyCountdown}
          timeLeft={timeLeft}
          durationSec={sessionData.durationSec}
        />

        {isRevealing && sessionData?.mode === "CLASSROOM" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <QuestionLeaderboard
              entries={questionLeaderboard}
              isLoading={leaderboardLoading}
            />
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )

  const statsBar = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white/75 px-3 py-2.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04] sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100/90 px-3 py-1.5 dark:bg-white/[0.06]">
          <Trophy className={cn("h-4 w-4 shrink-0", timeLeft <= 5 ? "text-red-500" : "text-slate-500")} />
          <div className="leading-tight">
            <p className={cn("text-sm font-bold tabular-nums", timeLeft <= 5 ? "text-red-600" : "text-slate-800 dark:text-slate-100")}>
              {score}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">This session</p>
          </div>
        </div>
        {accumulatedPoints !== null && (
          <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100/90 px-3 py-1.5 dark:bg-white/[0.06]">
            <Sparkles className="h-4 w-4 shrink-0 text-[#582c83] dark:text-[#b8a0e0]" />
            <div className="leading-tight">
              <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{accumulatedPoints}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Total points</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowLeaveDialog(true)}>
          Leave session
        </Button>
      </div>
    </div>
  )

  if (fromDashboardV2) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full min-w-0 max-w-3xl space-y-4 sm:space-y-5"
        >
          {statsBar}
          {questionPanel}
        </motion.div>
        <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{PLAYGROUND_LEAVE_SESSION_TITLE}</AlertDialogTitle>
              <AlertDialogDescription>{PLAYGROUND_LEAVE_SESSION_MESSAGE}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep playing</AlertDialogCancel>
              <AlertDialogAction onClick={handleLeaveSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Leave session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    )
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-50/80 via-background to-slate-100/40 dark:from-[#0B1120] dark:via-background dark:to-slate-950/50">
      <header className="border-b border-slate-200/70 bg-white/75 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-orange-500/10 dark:bg-orange-500/15">
                <GraduationCap className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">Playground</h1>
            </div>
            <div className="w-full sm:w-auto">{statsBar}</div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mx-auto max-w-3xl">{questionPanel}</div>
      </main>
    </div>
    <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{PLAYGROUND_LEAVE_SESSION_TITLE}</AlertDialogTitle>
          <AlertDialogDescription>{PLAYGROUND_LEAVE_SESSION_MESSAGE}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep playing</AlertDialogCancel>
          <AlertDialogAction onClick={handleLeaveSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Leave session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
