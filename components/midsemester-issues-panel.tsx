"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  MessageSquare,
  Plus,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  FileWarning,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { MidSemesterReportIssueModal } from "./midsemester-report-issue-modal"
import { MidSemesterIssueDetailModal } from "./midsemester-issue-detail-modal"

interface Issue {
  id: number
  exam_id: number
  exam_title: string
  question_number: number | null
  description: string
  status: "open" | "closed"
  reporter_name: string
  reporter_id: string
  created_at: string
  comment_count: number
}

export function MidSemesterIssuesPanel() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [selectedTab, setSelectedTab] = useState<"open" | "closed">("open")
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [studentId, setStudentId] = useState("")
  const [examId, setExamId] = useState<number | null>(null)
  const [closedCount, setClosedCount] = useState(0)

  useEffect(() => {
    const id = sessionStorage.getItem("studentId")
    if (id) {
      setStudentId(id)
      // Get exam ID from URL or state - for now we'll fetch from API
      fetchExamId(id)
    }
  }, [selectedTab])

  const fetchExamId = async (studentId: string) => {
    try {
      const response = await studentApiFetch(`/api/student/mid-semesters?studentId=${studentId}`)
      const data = await response.json()
      if (data.midSemesters && data.midSemesters.length > 0) {
        setExamId(data.midSemesters[0].id)
        fetchIssues(data.midSemesters[0].id, studentId)
        fetchClosedCount(data.midSemesters[0].id, studentId)
      }
    } catch (error) {
      // Failed to fetch exam ID
    }
  }

  const fetchIssues = async (examId: number, studentId: string) => {
    try {
      const res = await fetch(`/api/midsemester/issues?examId=${examId}&status=${selectedTab}&studentId=${studentId}`)
      const data = await res.json()
      setIssues(data.issues || [])
    } catch (error) {
      // Failed to fetch issues
    }
  }

  const fetchClosedCount = async (examId: number, studentId: string) => {
    try {
      const res = await fetch(`/api/midsemester/issues?examId=${examId}&status=closed&studentId=${studentId}`)
      const data = await res.json()
      setClosedCount(data.issues?.length || 0)
    } catch (error) {
      // Failed to fetch closed count
    }
  }

  const handleIssueSubmitted = () => {
    if (studentId && examId) {
      fetchIssues(examId, studentId)
    }
  }

  return (
    <>
      <Card className="h-full border border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-br from-slate-50/95 to-white/90 dark:from-slate-800/50 dark:to-slate-900/50 backdrop-blur-md shadow-xl hover:shadow-2xl transition-all duration-300 rounded-xl sm:rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-200/40 dark:border-slate-700/60 bg-gradient-to-r from-slate-100/80 via-blue-50/60 to-emerald-50/60 dark:from-slate-800/80 dark:via-blue-900/30 dark:to-emerald-900/30 px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 min-w-0 flex-1 truncate">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">Issues</span>
                <span className="hidden sm:inline">Exam Issues & Comments</span>
              </span>
            </CardTitle>
            <Button
              size="sm"
              onClick={() => setShowReportModal(true)}
              className="gap-1.5 rounded-xl sm:rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-700 dark:to-indigo-700 dark:hover:from-blue-800 dark:hover:to-indigo-800 text-white shadow-lg text-xs sm:text-sm px-3 sm:px-4 h-9 min-h-[44px] w-full sm:w-auto shrink-0 touch-manipulation"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Report
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4">
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as "open" | "closed")}>
            {/* --- Tabs Header --- */}
            <TabsList className="grid grid-cols-2 w-full mb-3 sm:mb-4 rounded-full bg-slate-100/80 dark:bg-slate-700/80 p-0.5 sm:p-1 h-11 sm:h-10 min-h-[44px] touch-manipulation">
              <TabsTrigger
                value="open"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=inactive]:text-slate-700 data-[state=inactive]:dark:text-slate-300 rounded-full text-xs sm:text-sm transition-all px-3 sm:px-4 py-2 min-h-[40px] touch-manipulation"
              >
                <span className="sm:hidden">Open</span>
                <span className="hidden sm:inline">Open Issues</span>
              </TabsTrigger>
              <TabsTrigger
                value="closed"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-500 data-[state=active]:text-white data-[state=inactive]:text-slate-700 data-[state=inactive]:dark:text-slate-300 rounded-full text-xs sm:text-sm transition-all flex items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 min-h-[40px] touch-manipulation"
              >
                Closed
                {closedCount > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-0.5 sm:ml-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full p-0 flex items-center justify-center bg-green-600 dark:bg-green-700 text-white text-[10px] sm:text-xs"
                  >
                    {closedCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* --- OPEN ISSUES --- */}
            <TabsContent
              value="open"
              className="space-y-2 sm:space-y-3 max-h-[400px] sm:max-h-[500px] md:max-h-[580px] overflow-y-auto scrollbar-thin scrollbar-thumb-amber-500/50 dark:scrollbar-thumb-amber-500/70 scrollbar-track-transparent pr-1"
            >
              {issues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center text-muted-foreground dark:text-slate-400">
                  <div className="p-3 sm:p-4 bg-slate-100/80 dark:bg-slate-700/80 rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
                    <FileWarning className="h-6 w-6 sm:h-8 sm:w-8 opacity-50 dark:text-slate-500" />
                  </div>
                  <p className="text-xs sm:text-sm">No open issues</p>
                  <p className="text-[10px] sm:text-xs opacity-75 mt-1 px-2">
                    <span className="sm:hidden">All running smoothly!</span>
                    <span className="hidden sm:inline">All exams seem to be running smoothly!</span>
                  </p>
                </div>
              ) : (
                issues.map((issue) => (
                  <Card
                    key={issue.id}
                    className="p-2.5 sm:p-3 border-l-4 border-amber-400/70 dark:border-amber-500/70 hover:border-amber-500/90 dark:hover:border-amber-400/90 hover:shadow-lg transition-all bg-gradient-to-r from-amber-50/60 to-orange-50/40 dark:from-amber-900/20 dark:to-orange-900/20 cursor-pointer rounded-lg sm:rounded-xl border border-amber-200/50 dark:border-amber-700/50"
                    onClick={() => setSelectedIssue(issue)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">
                          {issue.exam_title}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 line-clamp-2 sm:line-clamp-3 mt-1 break-words">
                          {issue.question_number ? `Q${issue.question_number}: ` : ""}
                          {issue.description}
                        </p>
                        <div className="flex flex-col sm:flex-row justify-between gap-1 sm:gap-0 mt-2 text-[10px] sm:text-xs text-slate-500 dark:text-slate-500">
                          <span className="truncate">by {issue.reporter_name}</span>
                          <span className="shrink-0">
                            {new Date(issue.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-amber-700 dark:text-amber-400 border-amber-300/50 dark:border-amber-700/50 shrink-0 rounded-full bg-amber-100/60 dark:bg-amber-900/30 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5"
                      >
                        <MessageSquare className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" /> {issue.comment_count}
                      </Badge>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* --- CLOSED ISSUES --- */}
            <TabsContent
              value="closed"
              className="space-y-2 sm:space-y-3 max-h-[400px] sm:max-h-[500px] md:max-h-[580px] overflow-y-auto scrollbar-thin scrollbar-thumb-green-500/40 dark:scrollbar-thumb-green-500/60 scrollbar-track-transparent pr-1"
            >
              {issues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center text-muted-foreground dark:text-slate-400">
                  <div className="p-3 sm:p-4 bg-slate-100/80 dark:bg-slate-700/80 rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
                    <FolderOpen className="h-6 w-6 sm:h-8 sm:w-8 opacity-50 dark:text-slate-500" />
                  </div>
                  <p className="text-xs sm:text-sm">No closed issues</p>
                  <p className="text-[10px] sm:text-xs opacity-75 mt-1">
                    <span className="sm:hidden">No resolved reports</span>
                    <span className="hidden sm:inline">No resolved reports yet.</span>
                  </p>
                </div>
              ) : (
                issues.map((issue) => (
                  <Card
                    key={issue.id}
                    className="p-2.5 sm:p-3 border-l-4 border-emerald-400/70 dark:border-emerald-500/70 bg-gradient-to-r from-emerald-50/60 to-green-50/40 dark:from-emerald-900/20 dark:to-green-900/20 hover:shadow-lg transition-all cursor-pointer rounded-lg sm:rounded-xl border border-emerald-200/50 dark:border-emerald-700/50"
                    onClick={() => setSelectedIssue(issue)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">
                          {issue.exam_title}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 line-clamp-2 sm:line-clamp-3 mt-1 break-words">
                          {issue.question_number ? `Q${issue.question_number}: ` : ""}
                          {issue.description}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-500 mt-2">
                          <span className="sm:hidden">Resolved {new Date(issue.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                          <span className="hidden sm:inline">
                            Resolved on{" "}
                            {new Date(issue.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </p>
                      </div>
                      <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modals */}
      {showReportModal && (
        <MidSemesterReportIssueModal onClose={() => setShowReportModal(false)} onSubmitted={handleIssueSubmitted} />
      )}

      {selectedIssue && (
        <MidSemesterIssueDetailModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onUpdated={handleIssueSubmitted}
        />
      )}
    </>
  )
}
