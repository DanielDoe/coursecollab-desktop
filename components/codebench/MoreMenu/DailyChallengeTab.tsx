"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Target, CheckCircle2, Zap, Code, BookOpen, Send, Loader2, X, MessageSquare } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { awardXP } from "@/lib/codebench-xp"
import { setCodebenchChallengeHandoff } from "@/lib/codebench-challenge-handoff"
import { AIChatInterface } from "@/components/codebench/AIChatInterface"
import { ScoreDisplay } from "@/components/codebench/ScoreDisplay"
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"
import { getCodebenchLanguage, readStoredCodebenchLanguageId } from "@/lib/codebench-languages"
import { CodebenchChallengeSkeleton } from "@/components/codebench/CodebenchSkeletons"

interface DailyChallengeTabProps {
  code: string
  studentId: string | null
  embedInDashboard?: boolean
  onXpEarned: (amount: number) => void
}

interface Challenge {
  id: string
  title: string
  description: string
  difficulty: "Easy" | "Medium" | "Hard"
  xpReward: number
  completed: boolean
  date: string
}

export function DailyChallengeTab({ code, studentId, embedInDashboard, onXpEarned }: DailyChallengeTabProps) {
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [challengeCode, setChallengeCode] = useState("")
  const [showChat, setShowChat] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [evaluationScore, setEvaluationScore] = useState<number | null>(null)
  const [evaluationFeedback, setEvaluationFeedback] = useState<string>("")
  const [editorLanguage, setEditorLanguage] = useState("cpp")

  useEffect(() => {
    const lang = getCodebenchLanguage(readStoredCodebenchLanguageId())
    setEditorLanguage(lang.apiLanguage)
  }, [])
  const [showScoreDisplay, setShowScoreDisplay] = useState(false)
  const { toast } = useToast()
  
  // Ensure submitting state resets whenever chat mode is exited
  useEffect(() => {
    if (!showChat) {
      setIsSubmitting(false)
    }
  }, [showChat])
  
  // When ScoreDisplay closes, ensure submitting status resets
  useEffect(() => {
    if (!showScoreDisplay) {
      setIsSubmitting(false)
    }
  }, [showScoreDisplay])

  useEffect(() => {
    const loadChallenge = async () => {
      if (!studentId) {
        setLoading(false)
        return
      }

      try {
        const today = new Date().toISOString().split("T")[0]
        
        // Check if challenge already completed today
        const saved = localStorage.getItem(`codebench_challenge_${today}`)
        if (saved) {
          try {
            const savedData = JSON.parse(saved)
            if (savedData.completed) {
              // Load challenge but mark as completed
              // Get learning mode from localStorage (set by CodeBench toolbar)
              const learningMode = localStorage.getItem("codebench_learning_mode") || "intermediate"
              
              const response = await fetch("/api/codebench/daily-challenge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId, code, learningMode }),
              })
              
              if (response.ok) {
                const data = await response.json()
                setChallenge({ ...data, completed: true })
                setLoading(false)
                return
              }
            }
          } catch (e) {
            // Continue to load new challenge
          }
        }

        // Get learning mode from localStorage (set by CodeBench toolbar)
        const learningMode = localStorage.getItem("codebench_learning_mode") || "intermediate"
        
        const response = await fetch("/api/codebench/daily-challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, code, learningMode }),
        })

        if (response.ok) {
          const data = await response.json()
          setChallenge(data)
        }
      } catch (error) {
        console.error("Failed to load challenge:", error)
      } finally {
        setLoading(false)
      }
    }

    loadChallenge()
  }, [studentId, code])

  const handleSubmitCode = async () => {
    if (!challengeCode.trim() || !challenge || !studentId) {
      toast({
        title: "Error",
        description: "Please write your solution code first",
        variant: "destructive",
      })
      return
    }

    // CRITICAL FIX: Don't set isSubmitting here - that's only for submitting the final score
    // isSubmitting should only be true when handleSubmitScore is called (when user clicks "Submit for Instructor Approval")
    setIsSubmitting(false)
    setShowChat(true)
  }

  const handleEvaluationComplete = async (score?: number, feedback?: string) => {
    if (!challenge || !studentId || score === undefined) {
      console.error("[DailyChallenge] ❌ Missing required data:", { challenge: !!challenge, studentId, score })
      return
    }

    // Show score display first, don't submit yet
    // CRITICAL: Ensure isSubmitting is FALSE when showing ScoreDisplay
    // ScoreDisplay should only show "Submitting..." when user clicks submit button
    setIsSubmitting(false)
    setEvaluationScore(score)
    setEvaluationFeedback(feedback || "")
    setShowScoreDisplay(true)
  }

  const handleSubmitScore = async () => {
    if (!challenge || !studentId || evaluationScore === null) {
      console.error("[DailyChallenge] ❌ Missing required data for submission:", {
        hasChallenge: !!challenge,
        studentId,
        evaluationScore
      })
      return
    }

    setIsSubmitting(true)
    let timeoutId: NodeJS.Timeout | null = null
    try {
      // Create AbortController for timeout handling
      const controller = new AbortController()
      timeoutId = setTimeout(() => {
        console.error("[DailyChallenge] ⏱️ Request timeout after 30 seconds")
        controller.abort()
      }, 30000) // 30 second timeout
      
      const response = await fetch("/api/codebench/daily-challenge/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          code: challengeCode,
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          challengeDescription: challenge.description,
          score: evaluationScore,
          feedback: evaluationFeedback,
        }),
        signal: controller.signal,
      })
      
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      if (!response.ok) {
        const contentType = response.headers.get("content-type")
        let errorData
        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        } else {
          const text = await response.text().catch(() => "")
          errorData = { error: `HTTP ${response.status}: ${text.substring(0, 100)}` }
        }
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json().catch(async (parseError) => {
        console.error("[DailyChallenge] ❌ Failed to parse JSON response:", parseError)
        const text = await response.text().catch(() => "Unable to read response")
        console.error("[DailyChallenge] Raw response:", text.substring(0, 500))
        throw new Error(`Invalid response format: ${parseError.message}`)
      })

      if (data.success || data.evaluation) {
        // CRITICAL FIX: Reset submitting state IMMEDIATELY to prevent UI from getting stuck
        setIsSubmitting(false)
        
        const pointsAwarded = data.evaluation?.pointsAwarded || data.pointsAwarded || (1.25 + (evaluationScore! / 10) * 1.25)
        
        // Award XP
        awardXP("DAILY_CHALLENGE", challenge.xpReward)
        onXpEarned(challenge.xpReward)

        // Mark as completed
        setChallenge({ ...challenge, completed: true })
        localStorage.setItem(
          `codebench_challenge_${challenge.date}`,
          JSON.stringify({ completed: true, completedAt: Date.now() })
        )

        toast({
          title: "Challenge Submitted!",
          description: `Score: ${evaluationScore!.toFixed(1)}/10 - ${pointsAwarded.toFixed(2)} practice points pending instructor approval. You also earned ${challenge.xpReward} XP!`,
        })
        
        // RESET UI PROPERLY - Hide score display after successful submission
        setShowScoreDisplay(false)
        setEvaluationScore(null)
        setEvaluationFeedback("")
        setChatMessages([])
        setShowChat(false)
        // Ensure submitting state is cleared (redundant but safe)
        setIsSubmitting(false)
      } else {
        console.error("[DailyChallenge] ❌ Submission failed:", data.error || "Unknown error")
        throw new Error(data.error || "Submission failed")
      }
    } catch (error: any) {
      console.error("[DailyChallenge] ❌ Error submitting challenge:", error)
      console.error("[DailyChallenge] Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 200)
      })
      
      // Clear timeout if still active
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      
      let errorMessage = "Failed to submit challenge"
      if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('aborted')) {
        errorMessage = "Submission timed out. Please check your internet connection and try again."
      } else if (error.message) {
        errorMessage = error.message
      }
      
      toast({
        title: "Submission Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      // Always reset submitting state, even if there was an error
      setIsSubmitting(false)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }

  // Format challenge description with markdown
  const formatDescription = (description: string) => {
    // Check if already formatted
    if (description.includes("##") || description.includes("**") || description.includes("```")) {
      return description
    }
    
    // Basic formatting
    let formatted = description
    // Add bold for key phrases
    formatted = formatted.replace(/\b(Input|Output|Constraints|Example|Note):/gi, "**$1:**")
    // Add code blocks for code-like content
    formatted = formatted.replace(/`([^`]+)`/g, "`$1`")
    
    return formatted
  }

  if (loading) {
    return <CodebenchChallengeSkeleton />
  }

  if (!challenge) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">No challenge available</div>
      </div>
    )
  }

  const difficultyColors = embedInDashboard
    ? {
        Easy: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20",
        Medium: "text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20",
        Hard: "text-red-700 dark:text-red-400 bg-red-500/10 border border-red-500/20",
      }
    : {
        Easy: "text-green-400 bg-green-500/20",
        Medium: "text-yellow-400 bg-yellow-500/20",
        Hard: "text-red-400 bg-red-500/20",
      }

  // If chat is shown, render the chat interface
  if (showChat && challenge && !challenge.completed) {
    const practiceProblem = {
      problem: challenge.description,
      constraints: "",
      sampleInput: "",
      sampleOutput: "",
      hints: [],
      steps: [],
    }

    return (
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-xl border",
          embedInDashboard
            ? "border-[var(--border)] bg-[var(--card)]"
            : "rounded-lg bg-slate-900/50",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between border-b p-3",
            embedInDashboard
              ? "border-[var(--border)] bg-[var(--muted)]/30"
              : "border-slate-700/50 bg-slate-800/50",
          )}
        >
          <div className="flex items-center gap-2">
            <Target
              className={cn(
                "h-5 w-5",
                embedInDashboard ? "text-[var(--cc-accent-dark)]" : "text-blue-400",
              )}
            />
            <h3
              className={cn(
                "font-semibold",
                embedInDashboard ? "text-[var(--foreground)]" : "text-slate-200",
              )}
            >
              Daily Challenge — Submit Solution
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChat(false)}
              className={
                embedInDashboard
                  ? "text-[var(--cc-text-muted)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
                  : "text-slate-300 hover:text-slate-100 hover:bg-slate-700/50"
              }
            >
              View Challenge
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowChat(false)
                setShowScoreDisplay(false)
                setEvaluationScore(null)
                setEvaluationFeedback("")
              }}
              className={
                embedInDashboard
                  ? "rounded-full p-1.5 text-[var(--cc-text-muted)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
                  : "text-slate-300 hover:text-slate-100 hover:bg-slate-700/50 rounded-full p-1.5"
              }
              title="Close chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          {showScoreDisplay && evaluationScore !== null ? (
            <div className="flex-1 overflow-y-auto p-4">
              <ScoreDisplay
                score={evaluationScore}
                maxScore={10}
                pointsAwarded={1.25 + (evaluationScore / 10) * 1.25}
                maxPoints={2.5}
                feedback={evaluationFeedback}
                showSubmitButton={true}
                onSubmit={handleSubmitScore}
                isSubmitting={isSubmitting}
              />
            </div>
          ) : (
            <AIChatInterface
              code={challengeCode}
              studentId={studentId}
              language={editorLanguage}
              mode="practice"
              isEvaluation={true}
              practiceProblem={practiceProblem}
              cachedMessages={chatMessages.length > 0 ? chatMessages : undefined}
              onMessagesChange={(messages) => {
                setChatMessages(messages)
              }}
              onComplete={handleEvaluationComplete}
            />
          )}
        </div>
      </div>
    )
  }

  if (embedInDashboard) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)]">
              <Target className="h-4 w-4 text-[var(--cc-accent-dark)]" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Today&apos;s Challenge</h2>
          </div>
          <span
            className={`rounded-lg px-3 py-1 text-xs font-semibold ${difficultyColors[challenge.difficulty]}`}
          >
            {challenge.difficulty}
          </span>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-4 sm:p-5">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
            <BookOpen className="h-4 w-4 text-[var(--cc-accent-dark)]" aria-hidden />
            {challenge.title}
          </h3>
          <div className="prose prose-sm max-w-none text-[var(--cc-text-muted)] dark:prose-invert prose-code:rounded prose-code:bg-[var(--muted)] prose-code:px-1 prose-code:text-[var(--foreground)]">
            <ReactMarkdown>{formatDescription(challenge.description)}</ReactMarkdown>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)]/60 p-3">
          <Zap className="h-4 w-4 shrink-0 text-[var(--cc-accent-dark)]" aria-hidden />
          <span className="text-sm text-[var(--cc-text-muted)]">
            Reward:{" "}
            <span className="font-semibold text-[var(--cc-accent-dark)]">{challenge.xpReward} XP</span>
            {" + "}
            <span className="font-semibold text-[var(--cc-accent-dark)]">1.25–2.5 Practice Points</span>
            {" (pending instructor approval)"}
          </span>
        </div>

        {challenge.completed ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Challenge Completed!</span>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                <Code className="h-4 w-4 text-[var(--cc-accent-dark)]" aria-hidden />
                Your Solution Code
              </label>
              <Textarea
                value={challengeCode}
                onChange={(e) => setChallengeCode(e.target.value)}
                placeholder="Write your solution code here..."
                className="min-h-[200px] rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--cc-text-muted)] focus-visible:ring-[var(--cc-accent)]/30"
              />
            </div>

            <Button
              onClick={handleSubmitCode}
              disabled={!challengeCode.trim() || isSubmitting}
              className="w-full border-0 bg-[var(--cc-accent)] py-6 text-base font-semibold text-white shadow-none hover:bg-[var(--cc-accent-hover)]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" />
                  Submit Code for AI Review
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 rounded-xl"
              onClick={() => {
                setCodebenchChallengeHandoff({
                  id: challenge.id,
                  title: challenge.title,
                  description: challenge.description,
                  difficulty: challenge.difficulty,
                  xpReward: challenge.xpReward,
                  completed: challenge.completed,
                  date: challenge.date,
                  intent: "tutor",
                })
                window.location.href = "/student/dashboard-v2/codebench"
                try {
                  sessionStorage.setItem("codebench_hub_tool", "tutor")
                  sessionStorage.setItem("codebench_hub_browse", "editor")
                } catch {
                  // ignore
                }
              }}
            >
              <MessageSquare className="h-4 w-4" />
              Ask Cora for a hint
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-slate-700/50 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Target className="h-5 w-5 text-blue-400" />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Today's Challenge
            </span>
          </CardTitle>
          <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${difficultyColors[challenge.difficulty]}`}>
            {challenge.difficulty}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Challenge Description */}
        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
          <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-400" />
            {challenge.title}
          </h3>
          <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed">
            <ReactMarkdown>
              {formatDescription(challenge.description)}
            </ReactMarkdown>
          </div>
        </div>

        {/* Rewards Info */}
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <Zap className="h-4 w-4 text-yellow-400" />
          <span className="text-sm text-slate-300">
            Reward: <span className="font-semibold text-yellow-400">{challenge.xpReward} XP</span>
            {" + "}
            <span className="font-semibold text-yellow-400">1.25-2.5 Practice Points</span>
            {" (pending instructor approval)"}
          </span>
        </div>

        {challenge.completed ? (
          <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <span className="text-green-400 font-semibold">Challenge Completed!</span>
          </div>
        ) : (
          <>
            {/* Code Editor */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Code className="h-4 w-4" />
                Your Solution Code
              </label>
              <Textarea
                value={challengeCode}
                onChange={(e) => setChallengeCode(e.target.value)}
                placeholder="Write your solution code here..."
                className="min-h-[200px] font-mono text-sm bg-slate-900/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-blue-500/20"
              />
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmitCode}
              disabled={!challengeCode.trim() || isSubmitting}
              className="w-full border-0 bg-[#582c83] py-6 text-base font-semibold text-white shadow-md shadow-[#582c83]/25 hover:bg-[#48256d]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Submit Code for AI Review
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
