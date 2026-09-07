"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2, Flag } from "lucide-react"

interface MidSemester {
  id: number
  title: string
}

export function MidSemesterReportIssueModal({
  onClose,
  onSubmitted,
}: {
  onClose: () => void
  onSubmitted: () => void
}) {
  const [exams, setExams] = useState<MidSemester[]>([])
  const [examId, setExamId] = useState("")
  const [examTitle, setExamTitle] = useState("")
  const [questionNumber, setQuestionNumber] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchExams()
  }, [])

  const fetchExams = async () => {
    try {
      const studentId = sessionStorage.getItem("studentId")
      const res = await studentApiFetch(`/api/student/mid-semesters?studentId=${studentId}`)
      const data = await res.json()
      setExams(data.midSemesters || [])
    } catch (error) {
      console.error("[v0] Failed to fetch exams:", error)
    }
  }

  const handleSubmit = async () => {
    if (!examId || !description.trim()) return
    setLoading(true)
    try {
      const reporterName = sessionStorage.getItem("studentName") || "Anonymous"
      const reporterId = sessionStorage.getItem("studentId") || ""

      await fetch("/api/midsemester/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: Number.parseInt(examId),
          examTitle,
          questionNumber: questionNumber ? Number.parseInt(questionNumber) : null,
          description,
          reporterName,
          reporterId,
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
      <DialogContent className="max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-50/95 to-white/90 dark:from-slate-800/95 dark:to-slate-900/95 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 shadow-xl rounded-xl sm:rounded-2xl w-[calc(100%-2rem)] sm:w-full">
        <DialogHeader className="pb-2 sm:pb-3 border-b border-slate-200/40 dark:border-slate-700/60 px-4 sm:px-6 pt-4 sm:pt-6">
          <DialogTitle className="text-lg sm:text-xl font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <Flag className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 dark:text-amber-400 shrink-0" />
            <span>
              <span className="sm:hidden">Report Issue</span>
              <span className="hidden sm:inline">Report a Concern</span>
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <span className="sm:hidden">Submit an issue</span>
            <span className="hidden sm:inline">Submit an issue related to an exam question or description.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-5 py-3 sm:py-4 px-4 sm:px-6">
          {/* Exam Select */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="exam" className="text-xs sm:text-sm dark:text-slate-300">
              <span className="sm:hidden">Exam</span>
              <span className="hidden sm:inline">Select Exam</span>
            </Label>
            <Select
              value={examId}
              onValueChange={(v) => {
                setExamId(v)
                const exam = exams.find((e) => e.id === Number.parseInt(v))
                setExamTitle(exam?.title || "")
              }}
            >
              <SelectTrigger id="exam" className="bg-background/60 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 backdrop-blur-sm h-9 sm:h-10 text-sm sm:text-base rounded-lg sm:rounded-xl">
                <SelectValue placeholder="Choose an exam..." />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id.toString()} className="dark:text-slate-200 text-sm sm:text-base">
                    {exam.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              disabled={loading || !examId || !description.trim()}
              className="rounded-lg sm:rounded-full bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600 hover:from-amber-600 hover:to-orange-600 dark:hover:from-amber-700 dark:hover:to-orange-700 text-white shadow-lg w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10"
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
