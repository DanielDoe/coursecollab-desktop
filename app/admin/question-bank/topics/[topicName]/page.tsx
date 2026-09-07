"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
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
import { ArrowLeft, Edit, Trash2, Eye, AlertTriangle, CheckSquare, Loader2, FolderOpen } from "lucide-react"
import Link from "next/link"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { Checkbox } from "@/components/ui/checkbox"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { AdminHeader } from "@/components/admin-header"

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

export default function TopicQuestionsPage() {
  const router = useRouter()
  const params = useParams()
  const topicName = decodeURIComponent(params.topicName as string)
  usePreventBack("/admin/login")
  const { toast } = useToast()

  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set())
  const [previewQuestion, setPreviewQuestion] = useState<BankQuestion | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<BankQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      router.push("/admin/login")
      return
    }

    fetchQuestions()
  }, [router, topicName])

  const fetchQuestions = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/question-bank?topic=${encodeURIComponent(topicName)}`)
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
      const response = await fetch(`/api/admin/question-bank/${questionToDelete.id}`, {
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
      const response = await fetch("/api/admin/question-bank", {
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
    <div className="min-h-screen bg-secondary">
      <AdminHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => router.push("/admin/question-bank")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Question Bank
              </Button>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-6 w-6 text-accent" />
                <h1 className="text-3xl font-bold">{topicName}</h1>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading questions...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {questions.length} {questions.length === 1 ? "question" : "questions"} in this topic
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll} disabled={questions.length === 0}>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearAll} disabled={selectedQuestions.size === 0}>
                    Clear All
                  </Button>
                  {selectedQuestions.size > 0 && (
                    <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={deleting}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected ({selectedQuestions.size})
                    </Button>
                  )}
                </div>
              </div>

              {questions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No questions found in this topic.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <Card key={question.id} className="border-2">
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
                      <CardFooter className="flex items-center justify-end border-t pt-4 gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPreviewQuestion(question)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <Link href={`/admin/question-bank/${question.id}/edit`}>
                          <Button variant="outline" size="sm">
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
    </div>
  )
}
