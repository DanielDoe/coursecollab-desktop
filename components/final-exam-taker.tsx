"use client"



import { studentApiFetch } from "@/lib/auth"
import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  Shield,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Sparkles,
  Maximize2,
  Minimize2,
  FileText
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { QuizTaker } from "./quiz-taker"
import { useAntiCheat, type AntiCheatConfig } from "@/hooks/use-anti-cheat"
import { AntiCheatWarning } from "@/components/anti-cheat-warning"
import { shouldActivateAntiCheat, getAntiCheatSettings } from "@/lib/antiCheatConfig"
import type { SectionConfig } from "@/lib/assessment-sections"
import { useGeminiDetector } from "@/hooks/use-gemini-detector"
import { isBrowserAiEnforcementPlatform, applyBrowserAiPlatformPolicy } from "@/lib/device-utils"
import { isDesktopElectronAssessmentClient } from "@/lib/desktop-anticheat-policy"
import confetti from "canvas-confetti"

interface FinalExamTakerProps {
  examId: string
  assessmentType?: string
}

export function FinalExamTaker({ examId, assessmentType = "final" }: FinalExamTakerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenLocked, setFullscreenLocked] = useState(false)
  const [examStarted, setExamStarted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(60 * 60) // 60 minutes in seconds
  const [examLocked, setExamLocked] = useState(false)
  const [examStartTime, setExamStartTime] = useState<Date | null>(null)
  const [heartbeatInterval, setHeartbeatInterval] = useState<NodeJS.Timeout | null>(null)
  const [autoSaveInterval, setAutoSaveInterval] = useState<NodeJS.Timeout | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [violations, setViolations] = useState(0)
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState<any>(null)
  const [examSectionConfig, setExamSectionConfig] = useState<SectionConfig[] | null>(null)
  const [isMatlabMode, setIsMatlabMode] = useState(false)
  const [antiCheatEnabled, setAntiCheatEnabled] = useState(true)
  const [geminiDetected, setGeminiDetected] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Anti-cheat configuration - dynamically updated based on current question
  const [antiCheatConfig, setAntiCheatConfig] = useState<AntiCheatConfig>({
    strictModeEnabled: true,
    blockCopyPaste: true,
    trackTabSwitches: true,
    trackMouseMovement: true,
    warnOnTabSwitch: true,
    maxTabSwitches: 5,
    autoSubmitOnViolations: true,
    trackGeminiWindow: true,
    maxGeminiStrikes: 5
  })

  // Update anti-cheat config based on current question
  useEffect(() => {
    if (currentQuestion && examStarted) {
      const questionType = currentQuestion.question_type?.toLowerCase() || ''
      const antiCheatExempt = currentQuestion.anti_cheat_exempt === true
      
      // Use the centralized anti-cheat config to determine if anti-cheat should be active
      const order1Based =
        typeof currentQuestion.question_order === "number" && currentQuestion.question_order > 0
          ? currentQuestion.question_order
          : 1
      const antiCheatCtx = {
        questionOrder1Based: order1Based,
        sectionConfig: examSectionConfig,
      }
      const shouldActivate = shouldActivateAntiCheat(questionType, antiCheatExempt, antiCheatCtx)
      const settings = getAntiCheatSettings(questionType, antiCheatExempt, antiCheatCtx)
      
      const isMatlab = questionType === 'code_write_plot' || 
                      questionType.includes('matlab') ||
                      (questionType === 'code_problem' && currentQuestion.question_text?.toLowerCase().includes('matlab')) ||
                      antiCheatExempt
      
      setIsMatlabMode(isMatlab)
      
      if (!shouldActivate || isMatlab) {
        // Disable anti-cheat for exempt questions
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
        }))
        setAntiCheatEnabled(false)
        
        // Allow exiting fullscreen for exempt questions
        setFullscreenLocked(false)
        
        if (isMatlab || antiCheatExempt) {
          toast({
            title: "⚙️ Anti-Cheat Exempt",
            description: "Anti-cheat protections are temporarily disabled. You may use external tools or resources as needed.",
          })
        }
      } else {
        // Re-enable anti-cheat for non-exempt questions
        setAntiCheatConfig(prev => applyBrowserAiPlatformPolicy({
          ...prev,
          strictModeEnabled: true,
          blockCopyPaste: settings.disableCopyPaste,
          trackTabSwitches: true,
          warnOnTabSwitch: true,
          autoSubmitOnViolations: true,
          maxTabSwitches: settings.tabSwitchLimit,
          trackGeminiWindow: settings.trackGeminiWindow,
        }))
        setAntiCheatEnabled(true)
        
        // Re-lock fullscreen for non-exempt questions
        if (settings.requireFullscreen) {
          setFullscreenLocked(true)
          // Re-enter fullscreen if not already
          if (!isFullscreen) {
            requestFullscreen()
          }
        }
      }
    }
  }, [currentQuestion, examStarted, examSectionConfig, isFullscreen, requestFullscreen, toast])

  const logViolation = useCallback((type: string, details: string) => {
    setViolations(prev => prev + 1)
  }, [])

  // Gemini detection callbacks
  const handleGeminiDetected = useCallback((reason: string) => {
    if (!isBrowserAiEnforcementPlatform()) return
    setGeminiDetected(true)
    logViolation("gemini_window", reason)
    toast({
      title: "⚠️ Browser AI Tool Detected",
      description: "A browser AI side-panel (like Gemini) has been detected. Please close it to continue.",
      variant: "destructive",
      duration: 5000,
    })
  }, [logViolation, toast])

  const handleGeminiCleared = useCallback(() => {
    setGeminiDetected(false)
  }, [])

  // Gemini detection - desktop Windows/macOS only
  useGeminiDetector({
    enabled:
      (antiCheatConfig.trackGeminiWindow && isBrowserAiEnforcementPlatform()) ||
      (isDesktopElectronAssessmentClient() && antiCheatConfig.requireFullscreen === true),
    onDetected: handleGeminiDetected,
    onCleared: handleGeminiCleared,
    requireFullscreen: antiCheatConfig.requireFullscreen,
    skipBrowserAiHeuristics: isDesktopElectronAssessmentClient(),
  })

  const { state: antiCheatState, closeWarning } = useAntiCheat({
    config: antiCheatConfig,
    onViolation: (violation) => {
      logViolation(violation.type, violation.details || "")
    },
    onMaxViolations: () => {
      toast({
        title: "Maximum Violations Reached",
        description: "Your exam will be auto-submitted due to multiple violations.",
        variant: "destructive"
      })
      // Auto-submit logic would go here
    }
  })

  // Request fullscreen
  const requestFullscreen = useCallback(async () => {
    try {
      const element = containerRef.current || document.documentElement
      if (element.requestFullscreen) {
        await element.requestFullscreen()
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen()
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen()
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen()
      }
      setIsFullscreen(true)
      setFullscreenLocked(true)
    } catch (error) {
      setShowFullscreenWarning(true)
    }
  }, [])

  // Exit fullscreen (only if not locked)
  const exitFullscreen = useCallback(async () => {
    if (fullscreenLocked && examStarted) {
      toast({
        title: "Fullscreen Locked",
        description: "You cannot exit fullscreen during the exam.",
        variant: "destructive"
      })
      return
    }

    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen()
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen()
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen()
      }
      setIsFullscreen(false)
    } catch (error) {
      // Error handled silently
    }
  }, [fullscreenLocked, examStarted, toast])

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      )
      setIsFullscreen(isCurrentlyFullscreen)

      if (examStarted && fullscreenLocked && !isCurrentlyFullscreen) {
        // User exited fullscreen during exam
        toast({
          title: "Fullscreen Required",
          description: "Please return to fullscreen to continue the exam.",
          variant: "destructive"
        })
        requestFullscreen()
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
    document.addEventListener("mozfullscreenchange", handleFullscreenChange)
    document.addEventListener("MSFullscreenChange", handleFullscreenChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange)
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange)
    }
  }, [examStarted, fullscreenLocked, requestFullscreen, toast])

  // Timer countdown
  useEffect(() => {
    if (!examStarted || timeRemaining <= 0) return

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - auto submit
          toast({
            title: "Time's Up!",
            description: "Your exam will be automatically submitted.",
            variant: "destructive"
          })
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [examStarted, timeRemaining, toast])

  // Format time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // Check exam availability and start time
  useEffect(() => {
    const checkExamAvailability = async () => {
      try {
        const response = await instructorApiFetch(`/api/instructor/quizzes?id=${examId}`)
        if (response.ok) {
          const data = await response.json()
          const quiz = data.quiz || data.quizzes?.[0]
          if (quiz) {
            const now = new Date()
            const startTime = quiz.available_from ? new Date(quiz.available_from) : null
            const endTime = quiz.available_until ? new Date(quiz.available_until) : null

            if (startTime && now < startTime) {
              setExamLocked(true)
              setExamStartTime(startTime)
            } else if (endTime && now > endTime) {
              setExamLocked(true)
              toast({
                title: "Exam Closed",
                description: "This exam has ended.",
                variant: "destructive"
              })
            } else {
              setExamLocked(false)
            }
          }
        }
      } catch (error) {
        // Error handled silently
      }
    }

    checkExamAvailability()
    const interval = setInterval(checkExamAvailability, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [examId, toast])

  // Block right-click context menu (only when anti-cheat is enabled)
  useEffect(() => {
    if (!examStarted || !antiCheatEnabled) return

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      logViolation("copy_paste", "Right-click context menu blocked")
      toast({
        title: "Context Menu Disabled",
        description: "Right-click is disabled during the exam.",
        variant: "destructive"
      })
    }

    document.addEventListener("contextmenu", handleContextMenu)
    return () => document.removeEventListener("contextmenu", handleContextMenu)
  }, [examStarted, antiCheatEnabled])

  // Heartbeat tracking (every 10 seconds) - only when anti-cheat enabled
  useEffect(() => {
    if (!examStarted || !antiCheatEnabled) return

    const sendHeartbeat = async () => {
      try {
        let studentId = sessionStorage.getItem("studentDatabaseId")
        
        // If missing, try to recover from API
        if (!studentId) {
          const studentIdFromStorage = sessionStorage.getItem("studentId")
          if (studentIdFromStorage) {
            try {
              const infoResponse = await studentApiFetch(`/api/student/info?student_id=${studentIdFromStorage}`)
              const infoData = await infoResponse.json()
              if (infoResponse.ok && infoData.student?.id) {
                studentId = infoData.student.id.toString()
                sessionStorage.setItem("studentDatabaseId", studentId)
              }
            } catch (error) {
              // Error handled silently
            }
          }
        }
        
        if (studentId) {
          await fetch("/api/quiz/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              examId,
              studentId,
              timestamp: new Date().toISOString(),
              isActive: document.hasFocus() && !document.hidden
            })
          })
        }
      } catch (error) {
        // Error handled silently
      }
    }

    const interval = setInterval(sendHeartbeat, 10000) // Every 10 seconds
    setHeartbeatInterval(interval)
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [examStarted, examId])

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!examStarted) return

    const autoSave = async () => {
      try {
        // Get current answers from QuizTaker component
        // This would need to be passed as a prop or accessed via ref
        let studentId = sessionStorage.getItem("studentDatabaseId")
        
        // If missing, try to recover from API
        if (!studentId) {
          const studentIdFromStorage = sessionStorage.getItem("studentId")
          if (studentIdFromStorage) {
            try {
              const infoResponse = await studentApiFetch(`/api/student/info?student_id=${studentIdFromStorage}`)
              const infoData = await infoResponse.json()
              if (infoResponse.ok && infoData.student?.id) {
                studentId = infoData.student.id.toString()
                sessionStorage.setItem("studentDatabaseId", studentId)
              }
            } catch (error) {
              // Error handled silently
            }
          }
        }
        
        if (studentId) {
          // Auto-save logic would go here
          setLastSaved(new Date())
        }
      } catch (error) {
        // Error handled silently
      }
    }

    const interval = setInterval(autoSave, 30000) // Every 30 seconds
    setAutoSaveInterval(interval)
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [examStarted])

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval)
      if (autoSaveInterval) clearInterval(autoSaveInterval)
    }
  }, [heartbeatInterval, autoSaveInterval])

  // Start exam
  const handleStartExam = async () => {
    if (examLocked) {
      if (examStartTime) {
        const timeUntilStart = Math.max(0, examStartTime.getTime() - Date.now())
        const minutes = Math.floor(timeUntilStart / 60000)
        toast({
          title: "Exam Not Available Yet",
          description: `The exam will start in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
          variant: "destructive"
        })
      }
      return
    }

    // Check if Gemini is detected before starting
    if (geminiDetected) {
      toast({
        title: "⚠️ Browser AI Tool Detected",
        description: "Please close any browser AI side-panels (like Gemini) before starting the exam.",
        variant: "destructive",
        duration: 5000,
      })
      return
    }

    await requestFullscreen()
    setExamStarted(true)
    toast({
      title: "Exam Started",
      description: "Good luck! Fullscreen mode is now locked.",
    })
  }

  // Handle exam completion with confetti
  const handleExamComplete = useCallback((score: number, totalPoints: number) => {
    const percentage = (score / totalPoints) * 100
    
    // Trigger confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    })

    // Show badge based on score
    if (percentage >= 90) {
      toast({
        title: "🏆 Excellent!",
        description: `You scored ${score}/${totalPoints} (${percentage.toFixed(1)}%) - Outstanding work!`,
      })
    } else if (percentage >= 80) {
      toast({
        title: "🎉 Great Job!",
        description: `You scored ${score}/${totalPoints} (${percentage.toFixed(1)}%) - Well done!`,
      })
    } else if (percentage >= 70) {
      toast({
        title: "✅ Good Work!",
        description: `You scored ${score}/${totalPoints} (${percentage.toFixed(1)}%) - Keep it up!`,
      })
    }

    // Exit fullscreen after delay
    setTimeout(() => {
      if (fullscreenLocked) {
        setFullscreenLocked(false)
        exitFullscreen()
      }
    }, 3000)
  }, [fullscreenLocked, exitFullscreen, toast])

  if (!examStarted) {
    return (
      <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
        <Card className="max-w-2xl mx-auto mt-20">
          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <FileText className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h1 className="text-3xl font-bold">Final Exam</h1>
              <p className="text-muted-foreground">
                Spring 2025 - C++, MATLAB, and Programming Fundamentals
              </p>
            </div>

            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Duration</span>
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  60 minutes
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Questions</span>
                <Badge variant="outline">23</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Points</span>
                <Badge variant="outline">100</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Anti-Cheat</span>
                <Badge variant="outline">
                  <Shield className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Important Instructions</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Fullscreen mode will be required and locked during the exam</li>
                    <li>Copy/paste and right-click are disabled</li>
                    <li>Tab switching is monitored (max 5 changes allowed)</li>
                    <li>Your progress is auto-saved every 30 seconds</li>
                    <li>Questions and answer options are randomized per student</li>
                    <li>Session heartbeat tracking is active</li>
                  </ul>
                </div>
              </div>
            </div>

            {examLocked && examStartTime ? (
              <div className="space-y-2">
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                    Exam starts at {examStartTime.toLocaleString('en-US', { 
                      timeZone: 'America/Chicago',
                      dateStyle: 'long',
                      timeStyle: 'short'
                    })}
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    Please return at the scheduled time.
                  </p>
                </div>
                <Button
                  onClick={handleStartExam}
                  size="lg"
                  className="w-full"
                  disabled
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Exam Locked Until Start Time
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleStartExam}
                size="lg"
                className="w-full"
                disabled={geminiDetected}
              >
                <Lock className="mr-2 h-4 w-4" />
                {geminiDetected ? "⚠️ Close AI Tools First" : "Start Exam (Fullscreen Required)"}
              </Button>
            )}

            {geminiDetected && (
              <div className="mt-4 p-3 bg-red-100/50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-800 dark:text-red-200">
                    Browser AI Tool Detected
                  </span>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Please close any browser AI side-panels (like Gemini) before starting. 
                  Entering fullscreen mode will automatically close them.
                </p>
              </div>
            )}
            
            {lastSaved && (
              <p className="text-xs text-center text-muted-foreground">
                Last saved: {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header with progress and timer */}
      <div className="sticky top-0 z-50 bg-white dark:bg-slate-800 border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="gap-2">
                <Shield className="h-3 w-3" />
                Protected
              </Badge>
              {violations > 0 && (
                <Badge variant="destructive" className="gap-2">
                  <AlertTriangle className="h-3 w-3" />
                  {violations} violation{violations !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono font-semibold">
                  {formatTime(timeRemaining)}
                </span>
              </div>
              {isFullscreen ? (
                <Badge variant="outline" className="gap-2">
                  <Maximize2 className="h-3 w-3" />
                  Fullscreen
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={requestFullscreen}
                  className="gap-2"
                >
                  <Maximize2 className="h-3 w-3" />
                  Enter Fullscreen
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* MATLAB Mode Notice */}
      {isMatlabMode && (
        <div className="container mx-auto px-4 pt-4">
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    ⚙️ MATLAB Plot Mode
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                    You may open MATLAB or another window to generate your plot. Save your plot as an image (PNG, JPG, or JPEG) and upload it below. Anti-cheat protections are temporarily disabled for this question.
                  </p>
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Accepted formats:</strong> PNG, JPG, JPEG (max 10MB)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main exam content */}
      <div className="container mx-auto px-4 py-6">
        <QuizTaker
          quizId={examId}
          assessmentType={assessmentType}
          onQuestionChange={(question: any, meta?: { section_config?: SectionConfig[] | null }) => {
            setCurrentQuestion(question)
            if (meta && "section_config" in meta) {
              setExamSectionConfig(meta.section_config ?? null)
            }
          }}
        />
      </div>

      {/* Anti-cheat warning */}
      <AntiCheatWarning
        show={antiCheatState.showWarning}
        type={antiCheatState.warningType}
        message={antiCheatState.warningMessage}
        onClose={closeWarning}
      />

      {/* Fullscreen warning */}
      <AnimatePresence>
        {showFullscreenWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <Card className="max-w-md mx-4">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  <h3 className="font-semibold">Fullscreen Required</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  This exam requires fullscreen mode. Please allow fullscreen access to continue.
                </p>
                <Button onClick={() => {
                  setShowFullscreenWarning(false)
                  requestFullscreen()
                }} className="w-full">
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


