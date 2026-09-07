"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TouchFriendlySelect } from "@/components/ui/touch-friendly-select"
import { Label } from "@/components/ui/label"
import { Loader2, Flag } from "lucide-react"

interface Quiz {
  id: number
  title: string
}

export function ReportIssueModal({
  onClose,
  onSubmitted,
  assessmentType = "quiz",
}: {
  onClose: () => void
  onSubmitted: () => void
  assessmentType?: string
}) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [quizId, setQuizId] = useState("")
  const [quizTitle, setQuizTitle] = useState("")
  const [questionNumber, setQuestionNumber] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchQuizzes()
  }, [assessmentType])

  const fetchQuizzes = async () => {
    try {
      const studentId = sessionStorage.getItem("studentId")
      // Filter quizzes by assessment type
      const res = await studentApiFetch(`/api/student/quizzes?studentId=${studentId}&type=${assessmentType}`)
      const data = await res.json()
      setQuizzes(data.quizzes || [])
      console.log(`[ReportIssueModal] Fetched ${data.quizzes?.length || 0} ${assessmentType} quizzes`)
    } catch (error) {
      console.error("[v0] Failed to fetch quizzes:", error)
    }
  }

  const handleSubmit = async () => {
    if (!quizId || !description.trim()) return
    setLoading(true)
    try {
      const reporterName = sessionStorage.getItem("studentName") || "Anonymous"
      const reporterId = sessionStorage.getItem("studentId") || ""

      console.log(`[ReportIssueModal] Submitting issue for ${assessmentType}`)

      await studentApiFetch("/api/student/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: Number.parseInt(quizId),
          quizTitle,
          questionNumber: questionNumber ? Number.parseInt(questionNumber) : null,
          description,
          reporterName,
          reporterId,
          assessmentType, // Pass assessment type to API
        }),
      })

      onSubmitted()
      onClose()
    } catch (error) {
      console.error("[v0] Failed to submit issue:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto bg-gradient-to-br from-background/80 to-muted/40 dark:from-slate-800/95 dark:to-slate-900/95 backdrop-blur-md border border-border/40 dark:border-slate-700/60 shadow-xl rounded-xl sm:rounded-2xl w-[calc(100%-2rem)] sm:w-full">
        <DialogHeader className="pb-2 sm:pb-3 border-b border-border/20 dark:border-slate-700/60 px-4 sm:px-6 pt-4 sm:pt-6">
          <DialogTitle className="text-lg sm:text-xl font-semibold flex items-center gap-2 dark:text-slate-200">
            <Flag className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 dark:text-amber-400 shrink-0" />
            <span>
              <span className="sm:hidden">Report Issue</span>
              <span className="hidden sm:inline">Report a Concern</span>
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400">
            <span className="sm:hidden">Submit an issue</span>
            <span className="hidden sm:inline">Submit an issue related to a quiz question or description.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-5 py-3 sm:py-4 px-4 sm:px-6">
          {/* Quiz Select */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="quiz" className="text-xs sm:text-sm dark:text-slate-300">
              <span className="sm:hidden">Quiz</span>
              <span className="hidden sm:inline">Select Quiz</span>
            </Label>
            <TouchFriendlySelect
              value={quizId}
              onValueChange={(v) => {
                setQuizId(v)
                const quiz = quizzes.find((q) => q.id === Number.parseInt(v))
                setQuizTitle(quiz?.title || "")
              }}
              options={quizzes.map((quiz) => ({
                value: quiz.id.toString(),
                label: quiz.title,
              }))}
              placeholder="Choose a quiz..."
              id="quiz"
              triggerClassName="bg-background/60 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 h-9 sm:h-10 text-sm sm:text-base rounded-lg sm:rounded-xl w-full"
              contentClassName="dark:bg-slate-800 dark:border-slate-700"
            />
          </div>

          {/* Question Number */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="question" className="text-xs sm:text-sm dark:text-slate-300">
              <span className="sm:hidden">Question # (Optional)</span>
              <span className="hidden sm:inline">Question Number (optional)</span>
            </Label>
            <Input
              id="question"
              type="number"
              placeholder="e.g., 5"
              value={questionNumber}
              onChange={(e) => setQuestionNumber(e.target.value)}
              className="bg-background/60 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 h-9 sm:h-10 text-sm sm:text-base rounded-lg sm:rounded-xl"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="description" className="text-xs sm:text-sm dark:text-slate-300">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your concern clearly..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="bg-background/60 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 backdrop-blur-sm text-sm sm:text-base rounded-lg sm:rounded-xl"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading} className="rounded-lg sm:rounded-full w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10 dark:border-slate-700 dark:text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !quizId || !description.trim()}
              className="rounded-lg sm:rounded-full bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600 hover:opacity-90 text-white w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                  <span className="hidden sm:inline">Submitting...</span>
                  <span className="sm:hidden">Submitting</span>
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
