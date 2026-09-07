"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useStudentError } from "@/components/student-error-context"

interface PreloadCheckItem {
  id: string
  label: string
  status: "pending" | "loading" | "complete" | "error"
  message?: string
}

interface QuizPreloaderProps {
  quizId: string
  onReady: (quizData: any, attemptId: number) => void
  onError: (error: string) => void
}

export function QuizPreloader({ quizId, onReady, onError }: QuizPreloaderProps) {
  const { showError } = useStudentError()
  const [checks, setChecks] = useState<PreloadCheckItem[]>([
    { id: "connection", label: "Verifying connection", status: "pending" },
    { id: "quiz", label: "Loading quiz data", status: "pending" },
    { id: "questions", label: "Preloading all questions", status: "pending" },
    { id: "attempt", label: "Creating attempt session", status: "pending" },
    { id: "timer", label: "Initializing timer system", status: "pending" },
    { id: "ready", label: "Finalizing setup", status: "pending" },
  ])

  const [progress, setProgress] = useState(0)

  const updateCheck = (id: string, status: PreloadCheckItem["status"], message?: string) => {
    setChecks((prev) =>
      prev.map((check) =>
        check.id === id ? { ...check, status, message } : check
      )
    )
  }

  useEffect(() => {
    const preloadQuiz = async () => {
      try {
        // 1. Connection Check
        updateCheck("connection", "loading")
        await new Promise((resolve) => setTimeout(resolve, 300))
        
        if (!navigator.onLine) {
          updateCheck("connection", "error", "No internet connection")
          showError("network_error")
          onError("Please check your internet connection and try again.")
          return
        }
        
        updateCheck("connection", "complete")
        setProgress(16)

        // 2. Load Quiz Data
        updateCheck("quiz", "loading")
        let studentDatabaseId = localStorage.getItem("studentDatabaseId") || sessionStorage.getItem("studentDatabaseId")
        
        // If missing, try to fetch from API instead of immediately failing
        if (!studentDatabaseId) {
          const studentId = sessionStorage.getItem("studentId") || localStorage.getItem("studentId")
          
          if (!studentId) {
            updateCheck("quiz", "error", "Session expired")
            showError("session_expired")
            return
          }

          try {
            // Fetch student info to get missing value
            const infoResponse = await studentApiFetch(`/api/student/info?student_id=${studentId}`)
            const infoData = await infoResponse.json()

            if (!infoResponse.ok) {
              throw new Error(infoData.error || "Failed to fetch student info")
            }

            // Update missing value in both storages
            if (infoData.student?.id) {
              studentDatabaseId = infoData.student.id.toString()
              localStorage.setItem("studentDatabaseId", studentDatabaseId)
              sessionStorage.setItem("studentDatabaseId", studentDatabaseId)
            }

            // If still missing after fetch, then fail
            if (!studentDatabaseId) {
              throw new Error("Could not retrieve session information")
            }
          } catch (error) {
            console.error("[v0] Failed to retrieve session data:", error)
            updateCheck("quiz", "error", "Session expired")
            showError("session_expired")
            return
          }
        }

        const quizResponse = await fetch(`/api/quiz/${quizId}`)
        
        if (!quizResponse.ok) {
          updateCheck("quiz", "error", "Failed to load quiz")
          showError("technical_difficulty", { message: "Failed to load quiz data. Please try again." })
          return
        }

        const quizData = await quizResponse.json()
        updateCheck("quiz", "complete", `Loaded: ${quizData.title}`)
        setProgress(33)

        // 3. Preload All Questions
        updateCheck("questions", "loading")
        await new Promise((resolve) => setTimeout(resolve, 400))
        
        if (!quizData.questions || quizData.questions.length === 0) {
          updateCheck("questions", "error", "No questions found")
          showError("technical_difficulty", { message: "This quiz has no questions." })
          return
        }

        // Verify all questions have required data
        const missingData = quizData.questions.some(
          (q: any) => !q.question_text || !q.question_type
        )
        
        if (missingData) {
          updateCheck("questions", "error", "Incomplete question data")
          showError("technical_difficulty", { message: "Some questions are missing required data." })
          return
        }

        updateCheck("questions", "complete", `${quizData.questions.length} questions ready`)
        setProgress(50)

        // 4. Create Attempt Session
        updateCheck("attempt", "loading")
        const attemptResponse = await fetch("/api/quiz/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizId,
            studentId: studentDatabaseId,
          }),
        })

        if (!attemptResponse.ok) {
          updateCheck("attempt", "error", "Failed to create session")
          showError("technical_difficulty", { message: "Failed to create quiz attempt. Please try again." })
          return
        }

        const { attemptId } = await attemptResponse.json()
        updateCheck("attempt", "complete", `Session ID: ${attemptId}`)
        setProgress(67)

        // 5. Initialize Timer System
        updateCheck("timer", "loading")
        await new Promise((resolve) => setTimeout(resolve, 300))
        
        // Verify all questions have valid time limits
        const invalidTimers = quizData.questions.some(
          (q: any) => 
            (q.time_limit === null || q.time_limit === undefined) && 
            (quizData.time_per_question === null || quizData.time_per_question === undefined)
        )
        
        if (invalidTimers) {
          updateCheck("timer", "error", "Invalid timer configuration")
          onError("Timer configuration is incomplete.")
          return
        }

        updateCheck("timer", "complete", "Timer system ready")
        setProgress(84)

        // 6. Final Setup
        updateCheck("ready", "loading")
        await new Promise((resolve) => setTimeout(resolve, 400))
        
        // Store session data
        sessionStorage.setItem("attemptId", attemptId.toString())
        sessionStorage.setItem("quizStartTime", Date.now().toString())
        
        updateCheck("ready", "complete", "All systems go!")
        setProgress(100)

        // Small delay before starting
        await new Promise((resolve) => setTimeout(resolve, 500))
        
        onReady(quizData, attemptId)
      } catch (error) {
        console.error("[Preloader] Error:", error)
        const errorCheck = checks.find((c) => c.status === "loading")
        if (errorCheck) {
          updateCheck(errorCheck.id, "error", error instanceof Error ? error.message : "Unknown error")
        }
        onError("An unexpected error occurred. Please refresh and try again.")
      }
    }

    preloadQuiz()
  }, [quizId])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl border border-slate-200/60 dark:border-slate-600 shadow-xl bg-white dark:bg-slate-800">
        <CardContent className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full mb-4"
            >
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </motion.div>
            
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              Preparing Your Assessment
            </h2>
            <p className="text-slate-700 dark:text-slate-200">
              Please wait while we set everything up...
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-600"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-2 text-center">
              {progress}% Complete
            </p>
          </div>

          {/* Checklist */}
          <div className="space-y-3">
            {checks.map((check, index) => (
              <motion.div
                key={check.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${
                  check.status === "complete"
                    ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-600"
                    : check.status === "error"
                    ? "bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-600"
                    : check.status === "loading"
                    ? "bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600"
                    : "bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600"
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {check.status === "complete" && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {check.status === "loading" && (
                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  )}
                  {check.status === "error" && (
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  )}
                  {check.status === "pending" && (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium ${
                      check.status === "complete"
                        ? "text-emerald-800 dark:text-emerald-200"
                        : check.status === "error"
                        ? "text-red-800 dark:text-red-200"
                        : check.status === "loading"
                        ? "text-blue-800 dark:text-blue-200"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {check.label}
                  </p>
                  {check.message && (
                    <p className="text-sm text-slate-600 dark:text-slate-200 mt-0.5">
                      {check.message}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Tip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
          >
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Tip:</strong> Once the quiz starts, your timer will begin immediately. 
              Make sure you're ready and have a stable connection.
            </p>
          </motion.div>
        </CardContent>
      </Card>
    </div>
  )
}

