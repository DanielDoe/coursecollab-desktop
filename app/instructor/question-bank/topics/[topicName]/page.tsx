"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Edit, Trash2, Eye, AlertTriangle, CheckSquare, Loader2, FolderOpen, Brain, History, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { Checkbox } from "@/components/ui/checkbox"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface BankQuestion {
  id: number
  question_text: string
  question_type: string
  difficulty: string
  topic: string | null
  hint: string | null
  option_count: number
  quiz_usage_count: number
  options: string[]
  correct_answer: string | string[]
  created_at: string
}

export default function TopicQuestionsPage({ params }: { params: Promise<{ topicName: string }> }) {
  const router = useRouter()
  const { topicName: encodedTopicName } = use(params)
  const topicName = decodeURIComponent(encodedTopicName)
  usePreventBack("/instructor/login")
  const { toast } = useToast()

  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set())
  const [previewQuestion, setPreviewQuestion] = useState<BankQuestion | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<BankQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verificationResults, setVerificationResults] = useState<any[]>([])
  const [verificationHistory, setVerificationHistory] = useState<any[]>([])
  const [showVerificationDialog, setShowVerificationDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    const instructorId = localStorage.getItem("instructorSession")
    if (!instructorId) {
      router.push("/instructor/login")
      return
    }

    fetchQuestions()
  }, [router, topicName])

  const fetchQuestions = async () => {
    setLoading(true)
    try {
      const response = await instructorApiFetch(`/api/instructor/question-bank?topic=${encodeURIComponent(topicName)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch questions")
      }

      setQuestions(data.questions || [])
    } catch (error) {
      console.error("[v0] Failed to fetch questions:", error)
      toast({
        title: "Failed to load questions",
        description: error instanceof Error ? error.message : "An error occurred while loading questions.",
        variant: "destructive",
      })
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }

  const handleSelectQuestion = (id: number) => {
    const newSelected = new Set(selectedQuestions)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedQuestions(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedQuestions.size === questions.length) {
      setSelectedQuestions(new Set())
    } else {
      setSelectedQuestions(new Set(questions.map((q) => q.id)))
    }
  }

  const handleClearAll = () => {
    setSelectedQuestions(new Set())
  }

  const handleDeleteQuestion = async () => {
    if (!questionToDelete) return

    setDeleting(true)
    try {
      const response = await instructorApiFetch(`/api/instructor/question-bank/${questionToDelete.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Question deleted",
          description: "The question has been removed from the bank.",
        })
        fetchQuestions()
      } else {
        throw new Error("Failed to delete question")
      }
    } catch (error) {
      console.error("[v0] Failed to delete question:", error)
      toast({
        title: "Failed to delete question",
        description: "An error occurred while deleting the question.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setQuestionToDelete(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedQuestions.size === 0) return

    setDeleting(true)
    try {
      const response = await instructorApiFetch("/api/instructor/question-bank", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedQuestions) }),
      })

      if (response.ok) {
        toast({
          title: "Questions deleted",
          description: `${selectedQuestions.size} question(s) have been removed.`,
        })
        setSelectedQuestions(new Set())
        fetchQuestions()
      } else {
        throw new Error("Failed to delete questions")
      }
    } catch (error) {
      console.error("[v0] Failed to delete questions:", error)
      toast({
        title: "Failed to delete questions",
        description: "An error occurred while deleting questions.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleVerifyTopic = async () => {
    setVerifying(true)
    setVerificationResults([])
    setShowVerificationDialog(true)

    try {
      const response = await instructorApiFetch("/api/instructor/question-bank/verify-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicName })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setVerificationResults(data.results || [])
        
        const suggestedChanges = data.results.filter((r: any) => r.needsUpdate)
        const skippedCount = data.results.filter((r: any) => r.skipped).length
        
        if (suggestedChanges.length === 0) {
          toast({
            title: "✅ All Answers Verified",
            description: `Topic: "${topicName}"\n📊 Results:\n  • ✅ All Correct: ${data.results.length - skippedCount} question(s)\n  • ⚠️ Skipped: ${skippedCount} question(s)\n\nNo corrections needed!`,
            duration: 6000,
          })
          setShowVerificationDialog(false)
        }
      } else {
        throw new Error(data.error || "AI verification failed")
      }
    } catch (error) {
      console.error("Failed to verify answers:", error)
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Failed to verify answers with AI",
        variant: "destructive"
      })
      setShowVerificationDialog(false)
    } finally {
      setVerifying(false)
    }
  }

  const handleApproveCorrections = async () => {
    const correctionsToApply = verificationResults.filter(r => r.needsUpdate)
    
    try {
      const response = await instructorApiFetch("/api/instructor/question-bank/apply-corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corrections: correctionsToApply })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "✅ Corrections Applied",
          description: `Successfully updated ${data.updated || 0} question(s)`,
        })
        setShowVerificationDialog(false)
        fetchQuestions()
        fetchVerificationHistory() // Refresh history
      } else {
        throw new Error(data.error || "Failed to apply corrections")
      }
    } catch (error) {
      console.error("Failed to apply corrections:", error)
      toast({
        title: "Failed to Apply Corrections",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      })
    }
  }

  const fetchVerificationHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await instructorApiFetch(`/api/instructor/question-bank/verification-history?topic=${encodeURIComponent(topicName)}`)
      const data = await response.json()

      if (response.ok) {
        setVerificationHistory(data.history || [])
      }
    } catch (error) {
      console.error("Failed to fetch verification history:", error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleShowHistory = () => {
    setShowHistoryDialog(true)
    fetchVerificationHistory()
  }

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      mcq: "Multiple Choice",
      true_false: "True/False",
      select_all: "Select All",
      fill_blank: "Fill in the Blank",
      code_problem: "Code Problem",
      trace_output: "Trace Output",
      debug_code: "Debug Code",
      code_write: "Code Write",
      code_explain: "Code Explain",
    }
    return labels[type] || type
  }

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: "bg-green-500",
      medium: "bg-yellow-500",
      hard: "bg-red-500",
    }
    return colors[difficulty] || "bg-gray-500"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Modern Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                <FolderOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  {topicName}
                </h1>
                <p className="text-sm text-slate-600">Topic Questions</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerifyTopic}
                disabled={verifying || questions.length === 0}
                className="border-purple-200 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600 transition-all rounded-lg"
              >
                <Brain className="h-4 w-4 mr-2" />
                {verifying ? "Verifying..." : "AI Verify Topic"}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleShowHistory}
                className="border-blue-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all rounded-lg"
              >
                <History className="h-4 w-4 mr-2" />
                View History
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => router.push("/instructor/question-bank")}
                className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all rounded-lg"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">
                {questions.length} {questions.length === 1 ? "question" : "questions"} in this topic
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/60 backdrop-blur-sm rounded-2xl border border-slate-200/60">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              </div>
              <p className="mt-4 text-slate-600 font-medium">Loading questions...</p>
            </div>
          ) : (
            <>
              <div className="bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSelectAll} 
                      disabled={questions.length === 0}
                      className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-all"
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Select All
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleClearAll} 
                      disabled={selectedQuestions.size === 0}
                      className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-all"
                    >
                      Clear All
                    </Button>
                  </div>
                  {selectedQuestions.size > 0 && (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={handleBulkDelete} 
                      disabled={deleting}
                      className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/25 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected ({selectedQuestions.size})
                    </Button>
                  )}
                </div>
              </div>

              {questions.length === 0 ? (
                <div className="bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm">
                  <div className="py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
                      <FolderOpen className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium">No questions found in this topic.</p>
                    <p className="text-sm text-slate-500 mt-1">Add questions to get started</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <Card key={question.id} className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur-sm rounded-xl">
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedQuestions.has(question.id)}
                            onCheckedChange={() => handleSelectQuestion(question.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">#{index + 1}</Badge>
                              <Badge variant="outline">{getQuestionTypeLabel(question.question_type)}</Badge>
                              <Badge className={getDifficultyColor(question.difficulty)}>
                                {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                              </Badge>
                              {question.hint && (
                                <Badge variant="outline" className="text-yellow-600">
                                  Has Hint
                                </Badge>
                              )}
                            </div>
                            <QuestionTextRenderer text={question.question_text} className="text-base leading-relaxed" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">{question.option_count || 0}</span> option
                            {question.option_count !== 1 ? "s" : ""}
                          </div>
                          <div>
                            Correct:{" "}
                            <span className="font-medium text-green-600">
                              {typeof question.correct_answer === "string"
                                ? question.correct_answer
                                : Array.isArray(question.correct_answer)
                                  ? `${question.correct_answer.length} answer${question.correct_answer.length !== 1 ? "s" : ""}`
                                  : "N/A"}
                            </span>
                          </div>
                          <div>
                            Used in <span className="font-medium">{question.quiz_usage_count}</span> quiz(zes)
                          </div>
                          <div>Created {new Date(question.created_at).toLocaleDateString()}</div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex items-center justify-end border-t border-slate-100 pt-4 gap-2 bg-slate-50/50">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setPreviewQuestion(question)}
                          className="border-slate-200 hover:bg-white hover:border-blue-300 hover:text-blue-600 transition-all rounded-lg"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <Link href={`/instructor/question-bank/${question.id}/edit`}>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="border-slate-200 hover:bg-white hover:border-green-300 hover:text-green-600 transition-all rounded-lg"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setQuestionToDelete(question)
                            setDeleteDialogOpen(true)
                          }}
                          className="border-slate-200 hover:bg-white hover:border-red-300 hover:text-red-600 transition-all rounded-lg"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Dialog open={!!previewQuestion} onOpenChange={() => setPreviewQuestion(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-semibold">Question Preview</DialogTitle>
            <DialogDescription className="text-base">
              See how this question appears to students
            </DialogDescription>
          </DialogHeader>
          {previewQuestion && (
            <div className="space-y-6">
              <div className="p-6 bg-secondary rounded-lg border">
                <div className="space-y-4">
                  <QuestionTextRenderer text={previewQuestion.question_text} className="text-base font-medium leading-relaxed" />
                  
                  <div className="space-y-3">
                    {previewQuestion.options && previewQuestion.options.length > 0 ? (
                      previewQuestion.options.map((option, index) => {
                        const isCorrect =
                          typeof previewQuestion.correct_answer === "string"
                            ? option === previewQuestion.correct_answer
                            : Array.isArray(previewQuestion.correct_answer)
                              ? previewQuestion.correct_answer.includes(option)
                              : false

                        return (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border-2 transition-colors ${
                              isCorrect 
                                ? "border-green-500 bg-green-50 dark:bg-green-950/30" 
                                : "border-border bg-background hover:bg-muted/50"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="font-semibold text-muted-foreground mt-0.5">
                                {String.fromCharCode(65 + index)}.
                              </span>
                              <div className="flex-1">
                                <span className="text-sm leading-relaxed">{option}</span>
                              </div>
                              {isCorrect && (
                                <Badge className="bg-green-500 hover:bg-green-600 text-white ml-2 flex-shrink-0">
                                  Correct
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">No options available for this question type</p>
                      </div>
                    )}
                  </div>
                </div>
                {previewQuestion.hint && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border-2 border-yellow-500 rounded">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">Hint:</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">{previewQuestion.hint}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewQuestion(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">Delete Question</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base leading-relaxed">
              Are you sure you want to delete this question?
              <br />
              <br />
              This will remove the question from the bank. Quizzes that already use this question will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuestion}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Verification Dialog */}
      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              AI Answer Verification
            </DialogTitle>
            <DialogDescription>
              Topic: <span className="font-semibold">{topicName}</span>
            </DialogDescription>
          </DialogHeader>

          {verifying ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-purple-600 mb-4" />
              <p className="text-slate-600">Analyzing questions with AI...</p>
              <p className="text-sm text-slate-500 mt-2">This may take 10-60 seconds</p>
            </div>
          ) : (
            <div className="space-y-4">
              {verificationResults.filter(r => r.needsUpdate).length > 0 ? (
                <>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-yellow-800">
                      ⚠️ {verificationResults.filter(r => r.needsUpdate).length} question(s) need correction
                    </p>
                  </div>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {verificationResults.filter(r => r.needsUpdate).map((result, index) => (
                      <div key={index} className="border border-slate-200 rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Q{result.questionId}</Badge>
                              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">
                                {result.questionType}
                              </Badge>
                              <Badge className={result.confidence === 'high' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                                {result.confidence} confidence
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600">{result.questionText}</p>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                              <div className="bg-red-50 border border-red-200 rounded p-3">
                                <p className="text-xs font-medium text-red-700 mb-1">Current Answer</p>
                                <p className="text-sm text-red-900 font-mono">
                                  {JSON.stringify(result.currentAnswer)}
                                </p>
                              </div>
                              <div className="bg-green-50 border border-green-200 rounded p-3">
                                <p className="text-xs font-medium text-green-700 mb-1">Suggested Answer</p>
                                <p className="text-sm text-green-900 font-mono">
                                  {JSON.stringify(result.suggestedAnswer)}
                                </p>
                              </div>
                            </div>
                            {result.reasoning && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
                                <p className="text-xs font-medium text-blue-700 mb-1">AI Reasoning</p>
                                <p className="text-sm text-blue-900">{result.reasoning}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-slate-700">All answers look good!</p>
                  <p className="text-sm text-slate-500">No corrections needed</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerificationDialog(false)}>
              Cancel
            </Button>
            {verificationResults.filter(r => r.needsUpdate).length > 0 && (
              <Button
                onClick={handleApproveCorrections}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve & Apply Corrections
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              AI Verification History
            </DialogTitle>
            <DialogDescription>
              Topic: <span className="font-semibold">{topicName}</span>
            </DialogDescription>
          </DialogHeader>

          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
              <p className="text-slate-600">Loading history...</p>
            </div>
          ) : verificationHistory.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-lg font-semibold text-slate-700">No verification history yet</p>
              <p className="text-sm text-slate-500">Run AI Verify to start tracking changes</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {verificationHistory.map((record, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Q{record.question_id}</Badge>
                        <Badge className="bg-blue-100 text-blue-700">
                          {record.question_type}
                        </Badge>
                        <Badge className={record.ai_confidence === 'high' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                          {record.ai_confidence} confidence
                        </Badge>
                        <Badge className="bg-emerald-100 text-emerald-700">
                          {record.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="bg-slate-50 border border-slate-200 rounded p-3">
                          <p className="text-xs font-medium text-slate-600 mb-1">Old Answer</p>
                          <p className="text-sm text-slate-900 font-mono">
                            {JSON.stringify(record.old_answer)}
                          </p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <p className="text-xs font-medium text-green-700 mb-1">New Answer</p>
                          <p className="text-sm text-green-900 font-mono">
                            {JSON.stringify(record.new_answer)}
                          </p>
                        </div>
                      </div>
                      {record.ai_reasoning && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-3">
                          <p className="text-xs font-medium text-blue-700 mb-1">Reasoning</p>
                          <p className="text-sm text-blue-900">{record.ai_reasoning}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-500 pt-2">
                        <span>Verified by: <span className="font-medium text-slate-700">{record.verified_by}</span></span>
                        <span>Date: <span className="font-medium text-slate-700">{new Date(record.created_at).toLocaleString()}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

