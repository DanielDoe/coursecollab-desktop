"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateMidSemesterFromBank } from "@/components/create-mid-semester-from-bank"
import { InstructorQuizIssues } from "@/components/instructor-quiz-issues"
import { useToast } from "@/hooks/use-toast"
import { FileText, Plus, Save, RefreshCw, Gift, BarChart3, Trash2, Download, MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface MidSemester {
  id: number
  title: string
  description: string
  total_questions: number
  time_per_question: number
  is_public: boolean
  available_from: string
  available_until: string
  created_at: string
  is_saved: boolean
  retake_enabled: boolean
}

interface ExamAttempt {
  id: number
  student_name: string
  student_email: string
  score: number
  total_questions: number
  completed_at: string
}

export function MidSemesterManagement() {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("create-from-bank")
  const [midSemesters, setMidSemesters] = useState<MidSemester[]>([])
  const [savedMidSemesters, setSavedMidSemesters] = useState<MidSemester[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [examToDelete, setExamToDelete] = useState<number | null>(null)
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false)
  const [selectedExamForBonus, setSelectedExamForBonus] = useState<number | null>(null)
  const [bonusPoints, setBonusPoints] = useState("")
  const [examAttempts, setExamAttempts] = useState<ExamAttempt[]>([])
  const [selectedExamForResults, setSelectedExamForResults] = useState<number | null>(null)

  useEffect(() => {
    fetchMidSemesters()
    fetchSavedMidSemesters()
  }, [])

  const fetchMidSemesters = async () => {
    try {
      const response = await fetch("/api/admin/mid-semesters")
      if (response.ok) {
        const data = await response.json()
        setMidSemesters(data || [])
      }
    } catch (error) {
      console.error("Failed to fetch mid-semesters:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSavedMidSemesters = async () => {
    try {
      const response = await fetch("/api/admin/mid-semesters?saved=true")
      if (response.ok) {
        const data = await response.json()
        setSavedMidSemesters(data || [])
      }
    } catch (error) {
      console.error("Failed to fetch saved mid-semesters:", error)
    }
  }

  const handleEditExam = (examId: number) => {
    router.push(`/admin/mid-semesters/edit/${examId}`)
  }

  const handleExportExam = async (examId: number, format: "json" | "csv") => {
    try {
      const response = await fetch(`/api/admin/mid-semesters/export?exam_id=${examId}&format=${format}`)
      
      if (!response.ok) {
        throw new Error("Failed to export exam")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      
      // Get filename from Content-Disposition header or create default
      const contentDisposition = response.headers.get("Content-Disposition")
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `mid-semester-exam-${examId}.${format}`
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export Successful",
        description: `Exam exported as ${format.toUpperCase()}`,
      })
    } catch (error) {
      console.error("Failed to export exam:", error)
      toast({
        title: "Export Failed",
        description: "Failed to export exam. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleViewResults = async (examId: number) => {
    try {
      const response = await fetch(`/api/admin/mid-semesters/${examId}/results`)
      if (response.ok) {
        const data = await response.json()
        setExamAttempts(data.attempts || [])
        setSelectedExamForResults(examId)
        setActiveTab("results")
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch exam results",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to fetch results:", error)
      toast({
        title: "Error",
        description: "Failed to fetch exam results",
        variant: "destructive",
      })
    }
  }

  const handlePreviewExam = (examId: number) => {
    router.push(`/admin/mid-semesters/preview/${examId}`)
  }

  const handleUseTemplate = async (examId: number) => {
    try {
      const response = await fetch(`/api/admin/mid-semesters/${examId}/duplicate`, {
        method: "POST",
      })
      if (response.ok) {
        toast({
          title: "Success",
          description: "Exam template duplicated successfully",
        })
        fetchMidSemesters()
        setActiveTab("exams")
      } else {
        toast({
          title: "Error",
          description: "Failed to duplicate exam template",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to duplicate template:", error)
      toast({
        title: "Error",
        description: "Failed to duplicate exam template",
        variant: "destructive",
      })
    }
  }

  const handleDeleteExam = async () => {
    if (!examToDelete) return

    try {
      const response = await fetch(`/api/admin/mid-semesters/${examToDelete}`, {
        method: "DELETE",
      })
      if (response.ok) {
        toast({
          title: "Success",
          description: "Exam deleted successfully",
        })
        fetchSavedMidSemesters()
        setDeleteDialogOpen(false)
        setExamToDelete(null)
      } else {
        toast({
          title: "Error",
          description: "Failed to delete exam",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to delete exam:", error)
      toast({
        title: "Error",
        description: "Failed to delete exam",
        variant: "destructive",
      })
    }
  }

  const handleReEvaluate = async (examId: number) => {
    try {
      const response = await fetch(`/api/admin/mid-semesters/${examId}/re-evaluate`, {
        method: "POST",
      })
      if (response.ok) {
        toast({
          title: "Success",
          description: "Exam scores re-evaluated successfully",
        })
        fetchMidSemesters()
      } else {
        toast({
          title: "Error",
          description: "Failed to re-evaluate exam scores",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to re-evaluate:", error)
      toast({
        title: "Error",
        description: "Failed to re-evaluate exam scores",
        variant: "destructive",
      })
    }
  }

  const handleApplyBonusPoints = async () => {
    if (!selectedExamForBonus || !bonusPoints) return

    try {
      const response = await fetch(`/api/admin/mid-semesters/${selectedExamForBonus}/bonus`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bonusPoints: Number.parseFloat(bonusPoints) }),
      })
      if (response.ok) {
        toast({
          title: "Success",
          description: "Bonus points applied successfully",
        })
        setBonusDialogOpen(false)
        setSelectedExamForBonus(null)
        setBonusPoints("")
      } else {
        toast({
          title: "Error",
          description: "Failed to apply bonus points",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to apply bonus points:", error)
      toast({
        title: "Error",
        description: "Failed to apply bonus points",
        variant: "destructive",
      })
    }
  }

  const handleToggleSaved = async (examId: number, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/mid-semesters/${examId}/save`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_saved: !currentStatus }),
      })

      if (response.ok) {
        toast({
          title: currentStatus ? "Exam unsaved" : "Exam saved",
          description: currentStatus ? "Exam removed from saved templates" : "Exam saved as template for future use",
        })
        fetchMidSemesters()
        fetchSavedMidSemesters()
      } else {
        toast({
          title: "Error",
          description: "Failed to update exam",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to toggle saved status:", error)
      toast({
        title: "Error",
        description: "Failed to update exam",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words">
              <span className="sm:hidden">Mid-Semester</span>
              <span className="hidden sm:inline">Mid-Semester Exam Management</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 break-words">
              <span className="sm:hidden">Manage exams</span>
              <span className="hidden sm:inline">Create, schedule, and manage mid-semester examinations</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Content with Vertical Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 sm:gap-6">
        {/* Vertical Tab Navigation */}
        <Card className="h-fit lg:sticky lg:top-4 border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm rounded-xl sm:rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg break-words">Exam Management</CardTitle>
            <CardDescription className="text-xs sm:text-sm break-words">Select a module to manage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 sm:space-y-2 p-4 sm:p-6 pt-0">
            <Button
              variant={activeTab === "create-from-bank" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
              onClick={() => setActiveTab("create-from-bank")}
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Create</span>
              <span className="hidden sm:inline">Create from Bank</span>
            </Button>
            <Button
              variant={activeTab === "exams" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
              onClick={() => setActiveTab("exams")}
            >
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Exams</span>
              <span className="hidden sm:inline">Mid-Semester Exams</span>
            </Button>
            <Button
              variant={activeTab === "saved" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
              onClick={() => setActiveTab("saved")}
            >
              <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Saved</span>
              <span className="hidden sm:inline">Saved Exams</span>
            </Button>
            <Button
              variant={activeTab === "re-evaluate" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
              onClick={() => setActiveTab("re-evaluate")}
            >
              <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Re-evaluate</span>
              <span className="hidden sm:inline">Re-evaluate Scores</span>
            </Button>
            <Button
              variant={activeTab === "bonus-points" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
              onClick={() => setActiveTab("bonus-points")}
            >
              <Gift className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Bonus</span>
              <span className="hidden sm:inline">Bonus Points</span>
            </Button>
            <Button
              variant={activeTab === "analytics" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
              onClick={() => setActiveTab("analytics")}
            >
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Analytics</span>
              <span className="hidden sm:inline">Analytics</span>
            </Button>
            <Button
              variant={activeTab === "issues" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
              onClick={() => setActiveTab("issues")}
            >
              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="sm:hidden">Issues</span>
              <span className="hidden sm:inline">Issues & Comments</span>
            </Button>
          </CardContent>
        </Card>

        {/* Tab Content */}
        <div className="space-y-4 sm:space-y-6">
          {activeTab === "create-from-bank" && (
            <CreateMidSemesterFromBank
              onSuccess={() => {
                setActiveTab("exams")
                fetchMidSemesters()
              }}
            />
          )}

          {activeTab === "exams" && (
            <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm rounded-xl sm:rounded-2xl overflow-hidden">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-lg md:text-xl break-words">Mid-Semester Exams</CardTitle>
                    <CardDescription className="text-xs sm:text-sm break-words mt-0.5 sm:mt-1">View and manage all mid-semester examinations</CardDescription>
                  </div>
                  <Button onClick={() => setActiveTab("create-from-bank")} size="sm" className="gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto shrink-0 min-h-[44px] sm:min-h-0">
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="sm:hidden">Create</span>
                    <span className="hidden sm:inline">Create New Exam</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {loading ? (
                  <div className="text-center py-8 sm:py-12 text-xs sm:text-sm text-muted-foreground">
                    <span className="sm:hidden">Loading...</span>
                    <span className="hidden sm:inline">Loading exams...</span>
                  </div>
                ) : midSemesters.length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                    <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 break-words">
                      <span className="sm:hidden">No exams yet</span>
                      <span className="hidden sm:inline">No mid-semester exams created yet</span>
                    </p>
                    <Button onClick={() => setActiveTab("create-from-bank")} size="sm" className="gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0">
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      <span className="sm:hidden">Create</span>
                      <span className="hidden sm:inline">Create Your First Exam</span>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {midSemesters.map((exam) => (
                      <Card key={exam.id} className="border border-border/50 rounded-xl sm:rounded-2xl overflow-hidden">
                        <CardHeader className="p-4 sm:p-6">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
                            <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                              <CardTitle className="text-base sm:text-lg break-words">{exam.title}</CardTitle>
                              <CardDescription className="text-xs sm:text-sm break-words">{exam.description}</CardDescription>
                            </div>
                            <Badge variant={exam.is_public ? "default" : "secondary"} className="text-xs sm:text-sm shrink-0 w-fit">
                              {exam.is_public ? "Public" : "Private"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
                            <div>
                              <p className="text-muted-foreground break-words">Questions</p>
                              <p className="font-semibold break-words">{exam.total_questions}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground break-words">Time/Question</p>
                              <p className="font-semibold break-words">{exam.time_per_question}s</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground break-words">Available From</p>
                              <p className="font-semibold break-words">
                                {exam.available_from ? new Date(exam.available_from).toLocaleDateString() : "Not set"}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground break-words">Available Until</p>
                              <p className="font-semibold break-words">
                                {exam.available_until ? new Date(exam.available_until).toLocaleDateString() : "Not set"}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-3 sm:mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleSaved(exam.id, exam.is_saved)}
                              className="text-xs sm:text-sm h-9 sm:h-8 min-h-[44px] sm:min-h-0 rounded-lg sm:rounded-xl"
                            >
                              {exam.is_saved ? "Unsave" : "Save"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleEditExam(exam.id)} className="text-xs sm:text-sm h-9 sm:h-8 min-h-[44px] sm:min-h-0 rounded-lg sm:rounded-xl">
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleViewResults(exam.id)} className="text-xs sm:text-sm h-9 sm:h-8 min-h-[44px] sm:min-h-0 rounded-lg sm:rounded-xl">
                              <span className="sm:hidden">Results</span>
                              <span className="hidden sm:inline">View Results</span>
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handlePreviewExam(exam.id)} className="text-xs sm:text-sm h-9 sm:h-8 min-h-[44px] sm:min-h-0 rounded-lg sm:rounded-xl">
                              Preview
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="text-xs sm:text-sm h-9 sm:h-8 min-h-[44px] sm:min-h-0 rounded-lg sm:rounded-xl">
                                  <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                                  <span className="sm:hidden">Export</span>
                                  <span className="hidden sm:inline">Export</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleExportExam(exam.id, "json")}>
                                  Export as JSON
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportExam(exam.id, "csv")}>
                                  Export as CSV
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive bg-transparent text-xs sm:text-sm h-9 sm:h-8 min-h-[44px] sm:min-h-0 rounded-lg sm:rounded-xl"
                              onClick={() => {
                                setExamToDelete(exam.id)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "saved" && (
            <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm rounded-xl sm:rounded-2xl overflow-hidden">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-base sm:text-lg md:text-xl break-words">Saved Mid-Semester Exams</CardTitle>
                <CardDescription className="text-xs sm:text-sm break-words mt-0.5 sm:mt-1">Reuse previously created exams for future semesters</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {savedMidSemesters.length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <Save className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                    <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 break-words">
                      <span className="sm:hidden">No saved exams</span>
                      <span className="hidden sm:inline">No saved exams available</span>
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">
                      <span className="sm:hidden">Save exams for reuse</span>
                      <span className="hidden sm:inline">Save exams from the "Mid-Semester Exams" tab for future reuse</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {savedMidSemesters.map((exam) => (
                      <Card key={exam.id} className="border border-border/50 rounded-xl sm:rounded-2xl overflow-hidden">
                        <CardHeader className="p-4 sm:p-6">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
                            <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                              <CardTitle className="text-base sm:text-lg break-words">{exam.title}</CardTitle>
                              <CardDescription className="text-xs sm:text-sm break-words">{exam.description}</CardDescription>
                            </div>
                            <Badge variant="secondary" className="text-xs sm:text-sm shrink-0 w-fit">Saved Template</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-0">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleUseTemplate(exam.id)} className="text-xs sm:text-sm h-9 sm:h-8 min-h-[44px] sm:min-h-0 rounded-lg sm:rounded-xl">
                              <span className="sm:hidden">Use</span>
                              <span className="hidden sm:inline">Use Template</span>
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleEditExam(exam.id)} className="text-xs sm:text-sm h-9 sm:h-8 min-h-[44px] sm:min-h-0 rounded-lg sm:rounded-xl">
                              Edit
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="text-xs sm:text-sm h-9 sm:h-8 min-h-[44px] sm:min-h-0 rounded-lg sm:rounded-xl">
                                  <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                                  <span className="sm:hidden">Export</span>
                                  <span className="hidden sm:inline">Export</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleExportExam(exam.id, "json")}>
                                  Export as JSON
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportExam(exam.id, "csv")}>
                                  Export as CSV
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive bg-transparent text-xs sm:text-sm h-9 sm:h-8 min-h-[44px] sm:min-h-0 rounded-lg sm:rounded-xl"
                              onClick={() => {
                                setExamToDelete(exam.id)
                                setDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "re-evaluate" && (
            <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm rounded-xl sm:rounded-2xl overflow-hidden">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-lg md:text-xl break-words">Re-evaluate Exam Scores</CardTitle>
                    <CardDescription className="text-xs sm:text-sm break-words mt-0.5 sm:mt-1">Recalculate scores for mid-semester exams after corrections</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {midSemesters.length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <RefreshCw className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                    <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 break-words">
                      <span className="sm:hidden">No exams available</span>
                      <span className="hidden sm:inline">No exams available for re-evaluation</span>
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground break-words">
                      <span className="sm:hidden">Create exams to enable re-evaluation</span>
                      <span className="hidden sm:inline">Create and administer exams to enable score re-evaluation</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {midSemesters.map((exam) => (
                      <Card key={exam.id} className="border border-border/50">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-lg">{exam.title}</CardTitle>
                              <CardDescription>{exam.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">
                            Re-evaluate all student scores for this exam based on updated answer keys or grading
                            criteria.
                          </p>
                          <Button onClick={() => handleReEvaluate(exam.id)} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Re-evaluate Scores
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "bonus-points" && (
            <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Bonus Points Management</CardTitle>
                    <CardDescription>Award bonus points to students for mid-semester exams</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {midSemesters.length === 0 ? (
                  <div className="text-center py-12">
                    <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No exams available for bonus points</p>
                    <p className="text-sm text-muted-foreground">
                      Create and administer exams to enable bonus point allocation
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {midSemesters.map((exam) => (
                      <Card key={exam.id} className="border border-border/50">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-lg">{exam.title}</CardTitle>
                              <CardDescription>{exam.description}</CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">
                            Add bonus points to all students who completed this exam.
                          </p>
                          <Button
                            onClick={() => {
                              setSelectedExamForBonus(exam.id)
                              setBonusDialogOpen(true)
                            }}
                            className="gap-2"
                          >
                            <Gift className="h-4 w-4" />
                            Apply Bonus Points
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "results" && selectedExamForResults && (
            <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Exam Results</CardTitle>
                    <CardDescription>View detailed results for this exam</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setActiveTab("exams")}>
                    Back to Exams
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {examAttempts.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No attempts recorded for this exam yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 font-semibold">Student Name</th>
                            <th className="text-left p-3 font-semibold">Email</th>
                            <th className="text-left p-3 font-semibold">Grade</th>
                            <th className="text-left p-3 font-semibold">Completed At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {examAttempts.map((attempt) => (
                            <tr key={attempt.id} className="border-t">
                              <td className="p-3">{attempt.student_name}</td>
                              <td className="p-3">{attempt.student_email}</td>
                              <td className="p-3 font-semibold">{((attempt.score / attempt.total_questions) * 100).toFixed(1)}%</td>
                              <td className="p-3">{new Date(attempt.completed_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "analytics" && (
            <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm rounded-xl sm:rounded-2xl overflow-hidden">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-lg md:text-xl break-words">Exam Analytics</CardTitle>
                    <CardDescription className="text-xs sm:text-sm break-words mt-0.5 sm:mt-1">View comprehensive statistics and performance metrics</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Total Exams</CardDescription>
                      <CardTitle className="text-3xl">{midSemesters.length}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Active Exams</CardDescription>
                      <CardTitle className="text-3xl">{midSemesters.filter((e) => e.is_public).length}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardDescription>Total Attempts</CardDescription>
                      <CardTitle className="text-3xl">0</CardTitle>
                    </CardHeader>
                  </Card>
                </div>
                <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Detailed analytics will appear here once exams are administered
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "issues" && (
            <div className="space-y-4 sm:space-y-6">
              <InstructorQuizIssues assessmentType="mid_semester" />
            </div>
          )}
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Exam</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this exam? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteExam}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bonusDialogOpen} onOpenChange={setBonusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Bonus Points</DialogTitle>
            <DialogDescription>
              Enter the number of bonus points to add to all students for this exam.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bonus-points">Bonus Points</Label>
              <Input
                id="bonus-points"
                type="number"
                placeholder="Enter bonus points"
                value={bonusPoints}
                onChange={(e) => setBonusPoints(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBonusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyBonusPoints}>Apply Bonus Points</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
