"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { BookOpen, Loader2, Send, Bot, User, CheckCircle2, MessageSquare, X, AlertCircle, RotateCcw } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import ReactMarkdown from "react-markdown"
import { AIChatInterface, AIChatInterfaceRef } from "./AIChatInterface"
import { withCodebenchCoraContext } from "@/lib/codebench-cora-client"
import { ScoreDisplay } from "./ScoreDisplay"
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

interface PracticeProblem {
  problem: string
  constraints: string
  sampleInput: string
  sampleOutput: string
  hints: string[]
  steps: string[]
}

interface PracticeGeneratorProps {
  code: string
  studentId: string | null
  language?: string
  cachedProblem?: PracticeProblem | null
  onProblemGenerated?: (problem: PracticeProblem) => void
  getCacheKey?: (mode: string, code: string) => string
  getCachedChat?: (mode: string, code: string) => any[] | null
  setCachedChat?: (mode: string, code: string, messages: any[]) => void
  learningMode?: "beginner" | "intermediate" | "expert"
  coraAccess?: boolean
  onLockedCora?: () => void
}

export function PracticeGenerator({ 
  code, 
  studentId, 
  language = "cpp",
  cachedProblem,
  onProblemGenerated,
  getCacheKey,
  getCachedChat,
  setCachedChat,
  learningMode = "intermediate",
  coraAccess = true,
  onLockedCora,
}: PracticeGeneratorProps) {
  const [problem, setProblem] = useState<PracticeProblem | null>(cachedProblem || null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([]) // Preserve chat messages
  const [evaluationScore, setEvaluationScore] = useState<number | null>(null)
  const [evaluationFeedback, setEvaluationFeedback] = useState<string>("")
  const [showScoreDisplay, setShowScoreDisplay] = useState(false)
  const [initialCode, setInitialCode] = useState<string>(code) // Track initial code when problem is generated
  const [showCodeAlert, setShowCodeAlert] = useState(false) // Show custom alert dialog
  const { toast } = useToast()
  const chatInterfaceRef = useRef<AIChatInterfaceRef>(null)
  
  // Get cached messages for practice mode if available
  const cachedPracticeMessages = getCachedChat ? getCachedChat("practice", code) : null
  useEffect(() => {
    if (cachedPracticeMessages && cachedPracticeMessages.length > 0 && chatMessages.length === 0) {
      setChatMessages(cachedPracticeMessages)
    }
  }, [cachedPracticeMessages])

  // Use cached problem if available
  useEffect(() => {
    if (cachedProblem && !problem) {
      setProblem(cachedProblem)
      // Set initial code when loading cached problem
      setInitialCode(code)
    }
  }, [cachedProblem, problem, code])

  const generatePractice = async () => {
    if (!coraAccess) {
      onLockedCora?.()
      return
    }
    if (isGenerating || !studentId) return

    setIsGenerating(true)
    try {
      const difficultyGuidance = learningMode === "beginner"
        ? `For BEGINNER level students:
- Create simple, straightforward problems
- Focus on basic concepts (variables, simple loops, conditionals)
- Provide clear examples and step-by-step guidance
- Make problems achievable and confidence-building
- Use simple language and avoid complex algorithms`
        : learningMode === "expert"
        ? `For EXPERT level students:
- Create challenging problems requiring advanced techniques
- Focus on optimization, edge cases, and design patterns
- Test deep understanding and problem-solving skills
- Include complex algorithms and data structures
- Challenge with multiple solution approaches`
        : `For INTERMEDIATE level students:
- Create problems that build on fundamentals
- Focus on algorithmic thinking and logic flow
- Include moderate complexity (nested loops, arrays, functions)
- Balance challenge with achievability
- Test understanding of concepts and their application`

      const practicePrompt = `Generate a practice problem for a ${learningMode} level student based on this ${language} code. 

${difficultyGuidance}

Provide a comprehensive practice problem with:
- Problem statement (clear description appropriate for ${learningMode} level)
- Constraints (input/output limits)
- Sample input/output (with explanations)
- Hints (3-5 helpful hints)
- Solution steps (step-by-step approach)

Format your response as JSON with these exact keys:
{
  "problem": "Problem description here",
  "constraints": "Constraints here",
  "sampleInput": "Sample input here",
  "sampleOutput": "Sample output here",
  "hints": ["hint1", "hint2", "hint3"],
  "steps": ["step1", "step2", "step3"]
}

Student's current code:
\`\`\`${language}
${code}
\`\`\``

      const response = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          message: practicePrompt,
          context: withCodebenchCoraContext({
            topic: "tutor", // Use "tutor" mode for problem generation, NOT "practice" (which is for evaluation)
            codeContext: `Student is learning with this code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
            learningMode: learningMode,
            isProblemGeneration: true // Flag to indicate this is problem generation, not evaluation
          }),
        }),
      })
      
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

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 200)}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      if (data.response) {
        // Try to extract JSON from the response
        let jsonMatch = data.response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0])
            setProblem(parsed)
            // Store the current code as initial code when problem is generated
            setInitialCode(code)
            if (onProblemGenerated) {
              onProblemGenerated(parsed)
            }
          } catch (parseError) {
            // If JSON parsing fails, try to structure the response
            const fallbackProblem = {
              problem: data.response,
              constraints: "",
              sampleInput: "",
              sampleOutput: "",
              hints: [],
              steps: [],
            }
            setProblem(fallbackProblem)
            // Store the current code as initial code when problem is generated
            setInitialCode(code)
            if (onProblemGenerated) {
              onProblemGenerated(fallbackProblem)
            }
          }
        } else {
          // If no JSON found, treat entire response as problem statement
          const fallbackProblem = {
            problem: data.response,
            constraints: "",
            sampleInput: "",
            sampleOutput: "",
            hints: [],
            steps: [],
          }
          setProblem(fallbackProblem)
          // Store the current code as initial code when problem is generated
          setInitialCode(code)
          if (onProblemGenerated) {
            onProblemGenerated(fallbackProblem)
          }
        }
      } else {
        throw new Error("No response received from AI")
      }
    } catch (error) {
      console.error("Error generating practice problem:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate practice problem",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSolutionSubmit = () => {
    if (!problem) {
      toast({
        title: "No Problem",
        description: "Please generate a practice problem first.",
        variant: "destructive",
      })
      return
    }
    
    // CRITICAL: Reset evaluation state before starting new evaluation
    // This ensures we start fresh and don't show old score display
    setEvaluationScore(null)
    setEvaluationFeedback("")
    setShowScoreDisplay(false)
    setChatMessages([])
    
    // Reset evaluation state in AIChatInterface
    if (chatInterfaceRef.current?.resetEvaluationState) {
      chatInterfaceRef.current.resetEvaluationState()
    }
    
    // Clear cached chat to start fresh
    if (setCachedChat) {
      setCachedChat("practice", code, [])
    }
    
    // Check if code has changed from initial code
    // If initialCode is empty or same as current code, code hasn't changed
    const currentCodeTrimmed = code.trim()
    const initialCodeTrimmed = initialCode.trim()
    
    // If initialCode wasn't set (empty), set it now and allow submission
    // This handles the case where problem was loaded but initialCode wasn't set
    if (!initialCodeTrimmed && currentCodeTrimmed.length > 0) {
      setInitialCode(code)
      setShowChat(true)
      return
    }
    
    const codeChanged = currentCodeTrimmed !== initialCodeTrimmed && currentCodeTrimmed.length > 0
    
    if (!codeChanged || currentCodeTrimmed === initialCodeTrimmed) {
      setShowCodeAlert(true)
      return
    }
    
    setShowChat(true)
  }

  const handleStartOver = () => {
    // Reset all evaluation state
    setChatMessages([])
    setEvaluationScore(null)
    setEvaluationFeedback("")
    setShowScoreDisplay(false)
    setShowChat(false)
    
    // Reset evaluation state in AIChatInterface
    if (chatInterfaceRef.current?.resetEvaluationState) {
      chatInterfaceRef.current.resetEvaluationState()
    }
    
    // Clear cached chat if available
    if (setCachedChat && getCacheKey) {
      const cacheKey = getCacheKey("practice", code)
      setCachedChat("practice", code, [])
    }
    
    toast({
      title: "Evaluation Reset",
      description: "You can now start a fresh evaluation.",
    })
  }

  // Track when ScoreDisplay is shown
  useEffect(() => {
    // ScoreDisplay visibility is handled by parent component
  }, [showScoreDisplay, evaluationScore, evaluationFeedback])

  const handleEvaluationComplete = async (score?: number, feedback?: string) => {
    if (score === undefined) {
      console.error("[PracticeGenerator] ❌ Score is undefined - cannot complete evaluation")
      return
    }

    // Save evaluation results
    setEvaluationScore(score)
    setEvaluationFeedback(feedback || "")

    // Show score UI FIRST (before unmounting chat)
    setShowScoreDisplay(true)
    
    // Automatically submit score for instructor approval after a brief delay
    // IMPORTANT: Pass score and feedback directly to avoid stale state issues
    setTimeout(() => {
      handleSubmitScore(score, feedback || "")
    }, 1500) // 1.5 second delay to show the score first
    
    // Don't unmount chat immediately - keep it hidden but mounted to prevent crashes
    // The chat will be hidden by CSS (showChat=false) but component stays mounted
    // This prevents state update errors when chat tries to update after unmounting
    setTimeout(() => {
      // Only hide chat visually, don't clear messages yet (let ScoreDisplay stay visible)
      setShowChat(false)
      // Don't clear messages here - let ScoreDisplay remain visible
    }, 2000) // Wait 2 seconds to ensure submission completes
  }

  const handleSubmitScore = async (scoreOverride?: number, feedbackOverride?: string) => {
    // Use override values if provided (to avoid stale state), otherwise use state
    const finalScore = scoreOverride !== undefined ? scoreOverride : evaluationScore
    const finalFeedback = feedbackOverride !== undefined ? feedbackOverride : evaluationFeedback
    
    if (!code || !studentId || !problem || finalScore === null || finalScore === undefined) {
      console.error("[PracticeGenerator] Missing required data for submission:", {
        code: !!code,
        studentId: !!studentId,
        problem: !!problem,
        finalScore
      })
      toast({
        title: "Submission Error",
        description: "Missing required data. Please try again.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/codebench/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          studentId,
          problem: problem.problem,
          constraints: problem.constraints,
          sampleInput: problem.sampleInput,
          sampleOutput: problem.sampleOutput,
          score: finalScore,
          feedback: finalFeedback,
        }),
      })

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

        const data = await response.json()
        
        if (data.success) {
        const scoreDisplay = finalScore !== null && finalScore !== undefined ? finalScore.toFixed(1) : "0.0"
        const pointsDisplay = data.evaluation?.pointsAwarded?.toFixed(2) || "2.5-5.0"
        toast({
          title: "Score Submitted for Approval",
          description: `Your score of ${scoreDisplay}/10 has been submitted. ${pointsDisplay} practice points pending instructor approval.`,
        })
        // Keep score display visible - don't hide it automatically
        // User can manually close it or it will stay visible
        // Only hide if user explicitly closes the chat or starts a new evaluation
      } else {
        console.error("[PracticeGenerator] ❌ Submission failed:", data.error)
        throw new Error(data.error || "Submission failed")
      }
    } catch (error) {
      console.error("Error submitting practice solution:", error)
      toast({
        title: "Submission Error",
        description: error instanceof Error ? error.message : "Failed to submit practice solution",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // If chat is shown, render the chat interface
  if (showChat && problem) {
    return (
      <div className="h-full flex flex-col bg-slate-900/50">
        <div className="border-b border-slate-700/50 p-3 bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-400" />
            <h3 className="font-semibold text-slate-200">Practice Problem - Submit Solution</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChat(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              View Problem
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
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-full p-1.5"
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
                pointsAwarded={2.5 + (evaluationScore / 10) * 2.5}
                maxPoints={5.0}
                feedback={evaluationFeedback}
                showSubmitButton={false}
                isSubmitting={isSubmitting}
              />
              {isSubmitting && (
                <div className="mt-4 text-center text-slate-400 text-sm">
                  Submitting score for instructor approval...
                </div>
              )}
            </div>
          ) : (
            showChat && !showScoreDisplay && (
              <AIChatInterface
                ref={chatInterfaceRef}
                code={code}
                studentId={studentId}
                language={language}
                mode="practice"
                isEvaluation={true}
                practiceProblem={problem}
                learningMode={learningMode}
                onComplete={handleEvaluationComplete}
                cachedMessages={chatMessages.length > 0 ? chatMessages : (getCachedChat ? getCachedChat("practice", code) || undefined : undefined)}
                onMessagesChange={(messages) => {
                  // Preserve chat messages when switching views
                  setChatMessages(messages)
                  // Also update parent cache if available
                  if (setCachedChat) {
                    setCachedChat("practice", code, messages)
                  }
                }}
                coraAccess={coraAccess}
                onLockedCora={() => onLockedCora?.()}
              />
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-900/50 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-1">Practice Problem Generator</h3>
          <p className="text-sm text-slate-400">Generate coding challenges based on your code</p>
        </div>
        <Button
          onClick={generatePractice}
          disabled={isGenerating}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <BookOpen className="h-4 w-4 mr-2" />
          )}
          <span className="hidden sm:inline">Generate Problem</span>
          <span className="sm:hidden">Generate</span>
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {problem ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-yellow-400 font-semibold mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Problem Statement
              </h3>
              <div className="prose prose-invert max-w-none text-slate-200 bg-slate-800/50 p-4 rounded-lg">
                <ReactMarkdown>{problem.problem}</ReactMarkdown>
              </div>
            </div>

            {problem.constraints && (
              <div>
                <h3 className="text-blue-400 font-semibold mb-2">Constraints</h3>
                <div className="prose prose-invert max-w-none text-slate-200 bg-slate-800/50 p-4 rounded-lg">
                  <ReactMarkdown>{problem.constraints}</ReactMarkdown>
                </div>
              </div>
            )}

            {problem.sampleInput && (
              <div>
                <h3 className="text-emerald-400 font-semibold mb-2">Sample Input</h3>
                <pre className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                  <code className="text-slate-200">{problem.sampleInput}</code>
                </pre>
              </div>
            )}

            {problem.sampleOutput && (
              <div>
                <h3 className="text-purple-400 font-semibold mb-2">Sample Output</h3>
                <pre className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                  <code className="text-slate-200">{problem.sampleOutput}</code>
                </pre>
              </div>
            )}

            {problem.hints.length > 0 && (
              <div>
                <h3 className="text-cyan-400 font-semibold mb-2">Hints</h3>
                <ul className="list-disc list-inside space-y-1 text-slate-300 bg-slate-800/50 p-4 rounded-lg">
                  {problem.hints.map((hint, i) => (
                    <li key={i}>{hint}</li>
                  ))}
                </ul>
              </div>
            )}

            {problem.steps.length > 0 && (
              <div>
                <h3 className="text-indigo-400 font-semibold mb-2">Solution Steps</h3>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 bg-slate-800/50 p-4 rounded-lg">
                  {problem.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Submit Solution Button */}
            <div className="pt-4 border-t border-slate-700/50">
              {chatMessages.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => setShowChat(true)}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                    size="lg"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Continue Evaluation ({(() => {
                      // Count unique question numbers (1, 2, 3) to avoid counting repeats
                      const askedQuestionNumbers = new Set<number>()
                      chatMessages.forEach(m => {
                        if (m.role === "assistant" && !m.content.includes("FINAL_SCORE")) {
                          const match = m.content.trim().match(/^question\s*(\d+)\s+of\s+\d+:/i)
                          if (match) {
                            const num = parseInt(match[1])
                            if (num >= 1 && num <= 3) {
                              askedQuestionNumbers.add(num)
                            }
                          }
                        }
                      })
                      return askedQuestionNumbers.size
                    })()} of 3 questions)
                  </Button>
                  <Button
                    onClick={handleStartOver}
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:text-slate-100"
                    size="lg"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Start Over
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleSolutionSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit Solution for Evaluation
                    </>
                  )}
                </Button>
              )}
              <p className="text-xs text-slate-400 mt-2 text-center">
                Earn 2.5-5.0 practice points after evaluation
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-400 mt-8">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-slate-500" />
            <p>Click "Generate Problem" to create a tailored coding challenge</p>
            <p className="text-xs mt-2 text-slate-500">Practice problems are cached - generate once and work on it!</p>
          </div>
        )}
      </div>

      {/* Custom Alert Dialog for Code Validation */}
      <AlertDialog open={showCodeAlert} onOpenChange={setShowCodeAlert}>
        <AlertDialogContent className="bg-slate-800 dark:bg-slate-900 border-slate-700 dark:border-slate-600 text-slate-100 dark:text-slate-200 w-[calc(100%-2rem)] sm:w-full max-w-md sm:max-w-lg rounded-xl sm:rounded-2xl">
          <AlertDialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-amber-500/20 dark:bg-amber-500/30 rounded-full shrink-0">
                <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-400 dark:text-amber-300" />
              </div>
              <AlertDialogTitle className="text-lg sm:text-xl font-semibold text-slate-100 dark:text-slate-200">
                <span className="sm:hidden">Solution Required</span>
                <span className="hidden sm:inline">Solution Required</span>
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs sm:text-sm text-slate-300 dark:text-slate-400 pt-2 break-words">
              <span className="sm:hidden">Enter your solution code before submitting.</span>
              <span className="hidden sm:inline">Please enter your solution code in the code editor before submitting for evaluation.</span>
              <br className="hidden sm:inline" /><br className="hidden sm:inline" />
              <span className="text-amber-400 dark:text-amber-300 font-medium block sm:inline mt-1 sm:mt-0">
                <span className="sm:hidden">Code hasn't changed from original.</span>
                <span className="hidden sm:inline">The code editor content has not changed from the original code.</span>
              </span>
              <br className="hidden sm:inline" /><br className="hidden sm:inline" />
              <span className="block sm:inline mt-1 sm:mt-0">
                <span className="sm:hidden">Write your solution, then submit again.</span>
                <span className="hidden sm:inline">Write your solution in the code editor on the left, then click "Submit Solution for Evaluation" again.</span>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6">
            <AlertDialogAction
              onClick={() => setShowCodeAlert(false)}
              className="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10 rounded-lg sm:rounded-xl"
            >
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
