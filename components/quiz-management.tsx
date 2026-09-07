"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { useToast } from "@/components/ui/use-toast"
import {
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Eye,
  Bookmark,
  BookmarkCheck,
  Copy,
  RefreshCw,
  CheckCircle2,
  Gift,
  FileText,
  Save,
  MessageSquare,
  Download,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { useSessionCatalog } from "@/components/session-catalog-provider"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { usePersistedState, useScrollRestoration } from "@/hooks/use-persisted-state"
import { ImportExportDialog } from "@/components/import-export-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreateQuizFromBank } from "@/components/create-quiz-from-bank"
import { AdminQuizIssues } from "@/components/admin-quiz-issues" // Import AdminQuizIssues component

interface Quiz {
  id: number
  title: string
  description: string
  is_active: boolean
  is_saved: boolean
  time_per_question: number
  question_count: number
  session_access: {
    P01: boolean
    P02: boolean
    P05: boolean
  }
}

interface Session {
  id: number
  code: string
  description: string
}

interface QuizManagementProps {
  assessmentType?: "quiz" | "mid_semester" | "final"
}

export function QuizManagement({ assessmentType = "quiz" }: QuizManagementProps) {
  const router = useRouter()
  const pathname = usePathname()
  usePreventBack("/admin/login")
  const { toast } = useToast()
  const { selectOptions } = useSessionCatalog()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [savedQuizzes, setSavedQuizzes] = useState<Quiz[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [savingQuizId, setSavingQuizId] = useState<number | null>(null)
  const [cloningQuizId, setCloningQuizId] = useState<number | null>(null)
  const [reEvaluating, setReEvaluating] = useState(false)
  const [reEvalScope, setReEvalScope] = useState<"quiz" | "session">("quiz")
  const [selectedQuizId, setSelectedQuizId] = useState<string>("")
  const [selectedSessionCode, setSelectedSessionCode] = useState<string>("")
  const [reEvalResults, setReEvalResults] = useState<any>(null)
  const [bonusPointsDialogOpen, setBonusPointsDialogOpen] = useState(false)
  const [grantingBonus, setGrantingBonus] = useState(false)
  const [bonusPreview, setBonusPreview] = useState<any>(null)
  const [bonusResults, setBonusResults] = useState<any>(null)
  const [bonusQuizId, setBonusQuizId] = useState<string>("")
  const [bonusSection, setBonusSection] = useState<string>("")

  // Use persisted state to remember which tab was active
  const [activeTab, setActiveTab] = usePersistedState(`admin-quiz-tab-${assessmentType}`, "create-from-bank")
  
  // Restore scroll position when returning to this page
  useScrollRestoration(`admin-quiz-${assessmentType}`)

  useEffect(() => {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      router.push("/admin/login")
      return
    }

    fetchData()
  }, [router, assessmentType]) // Added assessmentType to dependency array

  const fetchData = async () => {
    try {
      const [quizzesRes, savedQuizzesRes, sessionsRes] = await Promise.all([
        fetch(`/api/admin/quizzes?assessment_type=${assessmentType}`),
        fetch(`/api/admin/quizzes?saved=true&assessment_type=${assessmentType}`),
        fetch("/api/admin/sessions"),
      ])

      const quizzesData = await quizzesRes.json()
      const savedQuizzesData = await savedQuizzesRes.json()
      const sessionsData = await sessionsRes.json()

      setQuizzes(quizzesData.quizzes || [])
      setSavedQuizzes(savedQuizzesData.quizzes || [])
      setSessions(sessionsData.sessions || [])
    } catch (error) {
      console.error("Failed to fetch data:", error)
      setQuizzes([])
      setSavedQuizzes([])
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (quizId: number, sessionCode: string, currentStatus: boolean) => {
    const toggleKey = `${quizId}-${sessionCode}`
    if (togglingKey !== null) return

    setTogglingKey(toggleKey)
    const newStatus = !currentStatus

    // Optimistic update
    setQuizzes((prevQuizzes) =>
      prevQuizzes.map((quiz) =>
        quiz.id === quizId
          ? {
              ...quiz,
              session_access: {
                ...quiz.session_access,
                [sessionCode]: newStatus,
              },
            }
          : quiz,
      ),
    )

    try {
      const response = await fetch(`/api/admin/quizzes/${quizId}/toggle-session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_code: sessionCode, is_active: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to toggle quiz")
      }

      toast({
        title: newStatus ? "Quiz activated" : "Quiz deactivated",
        description: newStatus
          ? `The quiz is now visible to ${sessionCode} students.`
          : `The quiz is now hidden from ${sessionCode} students.`,
      })
    } catch (error) {
      console.error("Failed to toggle quiz status:", error)

      // Revert on error
      setQuizzes((prevQuizzes) =>
        prevQuizzes.map((quiz) =>
          quiz.id === quizId
            ? {
                ...quiz,
                session_access: {
                  ...quiz.session_access,
                  [sessionCode]: currentStatus,
                },
              }
            : quiz,
        ),
      )

      toast({
        title: "Failed to update quiz",
        description: "An error occurred while updating the quiz status.",
        variant: "destructive",
      })
    } finally {
      setTogglingKey(null)
    }
  }

  const handleToggleSaved = async (quizId: number, currentStatus: boolean) => {
    if (savingQuizId !== null) return

    setSavingQuizId(quizId)
    const newStatus = !currentStatus

    try {
      const response = await fetch(`/api/admin/quizzes/${quizId}/save`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_saved: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update quiz")
      }

      toast({
        title: newStatus ? "Quiz saved" : "Quiz unsaved",
        description: newStatus
          ? "This quiz has been saved as a template for future reuse."
          : "This quiz has been removed from saved templates.",
      })

      // Refresh data
      fetchData()
    } catch (error) {
      console.error("Failed to toggle saved status:", error)
      toast({
        title: "Failed to update quiz",
        description: "An error occurred while updating the quiz.",
        variant: "destructive",
      })
    } finally {
      setSavingQuizId(null)
    }
  }

  const handleCloneQuiz = async (quizId: number, quizTitle: string) => {
    if (cloningQuizId !== null) return

    setCloningQuizId(quizId)

    try {
      const response = await fetch(`/api/admin/quizzes/${quizId}/clone`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to clone quiz")
      }

      const data = await response.json()

      toast({
        title: "Quiz cloned successfully",
        description: `A copy of "${quizTitle}" has been created. You can now edit it.`,
      })

      // Redirect to edit the new quiz
      router.push(`/admin/quizzes/${data.quizId}/edit`)
    } catch (error) {
      console.error("Failed to clone quiz:", error)
      toast({
        title: "Failed to clone quiz",
        description: "An error occurred while cloning the quiz.",
        variant: "destructive",
      })
    } finally {
      setCloningQuizId(null)
    }
  }

  const handleDeleteClick = (quiz: Quiz) => {
    setQuizToDelete(quiz)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!quizToDelete) return

    setDeleting(true)

    try {
      const response = await fetch(`/api/admin/quizzes/${quizToDelete.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: `🗑️ ${assessmentType === "mid_semester" ? "Exam" : "Quiz"} Moved to Trash`,
          description: `"${quizToDelete.title}" has been moved to trash and can be restored within 24 hours.`,
          action: (
            <button
              onClick={() => {
                // Navigate to deleted items (if available in admin)
                window.location.href = "/admin/deleted-items"
              }}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors duration-200"
            >
              View Trash
            </button>
          ),
          duration: 8000,
        })
        fetchData()
      } else {
        toast({
          title: "Failed to delete quiz",
          description: "An error occurred while deleting the quiz. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to delete quiz:", error)
      toast({
        title: "Failed to delete quiz",
        description: "An error occurred while deleting the quiz. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setQuizToDelete(null)
    }
  }

  const handleReEvaluate = async () => {
    if (reEvalScope === "quiz" && !selectedQuizId) {
      toast({
        title: "Selection required",
        description: "Please select a quiz to re-evaluate.",
        variant: "destructive",
      })
      return
    }

    if (reEvalScope === "session" && (!selectedSessionCode || !selectedQuizId)) {
      toast({
        title: "Selection required",
        description: "Please select both a session and a quiz to re-evaluate.",
        variant: "destructive",
      })
      return
    }

    setReEvaluating(true)
    setReEvalResults(null)

    try {
      const params = new URLSearchParams()
      params.append("quizId", selectedQuizId)
      if (selectedSessionCode && selectedSessionCode !== "all") {
        params.append("sessionCode", selectedSessionCode)
      }

      const response = await fetch(`/api/admin/re-evaluate-quizzes?${params.toString()}`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to re-evaluate")
      }

      const data = await response.json()
      setReEvalResults(data)

      const hasIssues = data.studentsWithIssues && data.studentsWithIssues.length > 0

      toast({
        title: "Re-evaluation complete",
        description: hasIssues
          ? `Processed ${data.attemptsProcessed} attempts. ${data.answersChanged} answers corrected. ${data.studentsWithIssues.length} students have unanswered questions.`
          : `Successfully re-evaluated ${data.attemptsProcessed} attempts. ${data.answersChanged} answers were corrected.`,
        variant: hasIssues ? "default" : "default",
      })
    } catch (error) {
      console.error("Failed to re-evaluate:", error)
      toast({
        title: "Re-evaluation failed",
        description: "An error occurred while re-evaluating quiz attempts.",
        variant: "destructive",
      })
    } finally {
      setReEvaluating(false)
    }
  }

  const handleBonusPreview = async () => {
    try {
      const params = new URLSearchParams()
      if (bonusQuizId) params.append("quizId", bonusQuizId)
      if (bonusSection && bonusSection !== "all") params.append("section", bonusSection)

      const response = await fetch(`/api/admin/bonus-points?${params.toString()}`)
      const data = await response.json()
      setBonusPreview(data.preview)
    } catch (error) {
      console.error("Failed to preview bonus points:", error)
      toast({
        title: "Preview failed",
        description: "Could not load preview data.",
        variant: "destructive",
      })
    }
  }

  const handleGrantBonus = async () => {
    setGrantingBonus(true)
    setBonusResults(null)

    try {
      const response = await fetch("/api/admin/bonus-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: bonusQuizId || null,
          section: bonusSection && bonusSection !== "all" ? bonusSection : null,
          confirm: true,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to grant bonus points")
      }

      const data = await response.json()
      setBonusResults(data)

      toast({
        title: "Bonus points granted!",
        description: `Successfully granted bonus points to ${data.affectedStudents} students for ${data.affectedAnswers} unanswered questions.`,
      })

      setBonusPointsDialogOpen(false)
    } catch (error) {
      console.error("Failed to grant bonus points:", error)
      toast({
        title: "Operation failed",
        description: "An error occurred while granting bonus points.",
        variant: "destructive",
      })
    } finally {
      setGrantingBonus(false)
    }
  }

  const handleExportQuiz = async (quizId: number, format: "json" | "csv") => {
    try {
      const apiPath = assessmentType === "mid_semester" || assessmentType === "final"
        ? `/api/admin/mid-semesters/export?exam_id=${quizId}&format=${format}`
        : `/api/admin/quizzes/export?quiz_id=${quizId}&format=${format}`
      
      const response = await fetch(apiPath)
      
      if (!response.ok) {
        throw new Error("Failed to export")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      
      // Get filename from Content-Disposition header or create default
      const contentDisposition = response.headers.get("Content-Disposition")
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const assessmentLabel = assessmentType === "mid_semester" ? "Mid-Semester Exam" : assessmentType === "final" ? "Final Exam" : assessmentType === "homework" ? "Homework" : "Quiz"
      const filename = filenameMatch ? filenameMatch[1] : `${assessmentLabel.toLowerCase().replace(/\s+/g, '-')}-${quizId}.${format}`
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export Successful",
        description: `${assessmentLabel} exported as ${format.toUpperCase()}`,
      })
    } catch (error) {
      console.error("Failed to export:", error)
      const assessmentLabel = assessmentType === "mid_semester" ? "Mid-Semester Exam" : assessmentType === "final" ? "Final Exam" : assessmentType === "homework" ? "Homework" : "Quiz"
      toast({
        title: "Export Failed",
        description: `Failed to export ${assessmentLabel.toLowerCase()}. Please try again.`,
        variant: "destructive",
      })
    }
  }

  const getAssessmentPath = () => {
    const pathParts = pathname.split("/")
    const assessmentIndex = pathParts.findIndex((part) => part === "admin") + 1
    return pathParts[assessmentIndex] || "quiz"
  }

  const assessmentPath = getAssessmentPath()

  const renderQuizCard = (quiz: Quiz, isSavedTab = false) => (
    <Card key={quiz.id} className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{quiz.title}</CardTitle>
              {quiz.is_saved && (
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Saved
                </Badge>
              )}
            </div>
            <CardDescription className="mt-2">{quiz.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
          <div>
            <span className="font-medium">{quiz.question_count}</span> questions
          </div>
          <div>
            <span className="font-medium">{quiz.time_per_question}s</span> per question
          </div>
        </div>
        <div className="space-y-3 pt-3 border-t">
          <p className="text-sm font-medium text-foreground">Session Access</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectOptions.map(({ value: sessionCode, label }) => {
              const toggleKey = `${quiz.id}-${sessionCode}`
              const isActive = quiz.session_access?.[sessionCode as keyof typeof quiz.session_access] || false
              const isToggling = togglingKey === toggleKey

              return (
                <div key={sessionCode} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    <Badge variant={isActive ? "default" : "outline"} className={isActive ? "bg-success" : ""}>
                      {label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => handleToggleActive(quiz.id, sessionCode, isActive)}
                      disabled={isToggling}
                    />
                    <span className="text-xs text-muted-foreground">{isActive ? "Active" : "Inactive"}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleToggleSaved(quiz.id, quiz.is_saved)}
          disabled={savingQuizId === quiz.id}
        >
          {quiz.is_saved ? (
            <>
              <BookmarkCheck className="h-4 w-4 mr-2" />
              Saved
            </>
          ) : (
            <>
              <Bookmark className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </Button>
        <div className="flex items-center gap-2">
          {isSavedTab && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCloneQuiz(quiz.id, quiz.title)}
              disabled={cloningQuizId === quiz.id}
            >
              <Copy className="h-4 w-4 mr-2" />
              {cloningQuizId === quiz.id ? "Cloning..." : "Reuse"}
            </Button>
          )}
          <Link href={`/admin/${assessmentPath}/${quiz.id}/preview`}>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </Link>
          <Link href={`/admin/quizzes/${quiz.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExportQuiz(quiz.id, "json")}>
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportQuiz(quiz.id, "csv")}>
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => handleDeleteClick(quiz)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </CardFooter>
    </Card>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">
          Loading {assessmentType === "mid_semester" ? "exams" : "quizzes"}...
        </div>
      </div>
    )
  }

  const title = assessmentType === "mid_semester" ? "Mid-Semester Exam Management" : "Quiz Management"
  const description =
    assessmentType === "mid_semester"
      ? "Create, schedule, and manage mid-semester examinations"
      : "Create, edit, and manage quizzes per session"
  const emptyMessage = assessmentType === "mid_semester" ? "No exams created yet." : "No quizzes created yet."
  const createButtonText = assessmentType === "mid_semester" ? "Create Your First Exam" : "Create Your First Quiz"

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <ImportExportDialog quizzes={quizzes} onImportSuccess={fetchData} />
          <Link href="/admin/dashboard">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Vertical Tab Navigation */}
        <Card className="h-fit sticky top-4 border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {assessmentType === "mid_semester" ? "Exam Management" : "Quiz Management"}
            </CardTitle>
            <CardDescription>Select a module to manage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant={activeTab === "create-from-bank" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("create-from-bank")}
            >
              <Plus className="h-4 w-4" />
              Create from Bank
            </Button>
            <Button
              variant={activeTab === "quizzes" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("quizzes")}
            >
              <FileText className="h-4 w-4" />
              {assessmentType === "mid_semester" ? "Exams" : "Quizzes"} ({quizzes.length})
            </Button>
            <Button
              variant={activeTab === "saved" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("saved")}
            >
              <Save className="h-4 w-4" />
              Saved ({savedQuizzes.length})
            </Button>
            <Button
              variant={activeTab === "issues" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("issues")}
            >
              <MessageSquare className="h-4 w-4" />
              Issues & Comments
            </Button>
            <Button
              variant={activeTab === "reevaluate" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("reevaluate")}
            >
              <RefreshCw className="h-4 w-4" />
              Re-evaluate
            </Button>
            <Button
              variant={activeTab === "bonus" ? "default" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab("bonus")}
            >
              <Gift className="h-4 w-4" />
              Bonus Points
            </Button>
          </CardContent>
        </Card>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "create-from-bank" && (
            <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Create {assessmentType === "mid_semester" ? "Exam" : "Quiz"} from Question Bank</CardTitle>
                <CardDescription>
                  Select questions from the question bank to create a new{" "}
                  {assessmentType === "mid_semester" ? "exam" : "quiz"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreateQuizFromBank
                  assessmentType={assessmentType}
                  onSuccess={() => {
                    setActiveTab("quizzes")
                    fetchData()
                  }}
                />
              </CardContent>
            </Card>
          )}

          {activeTab === "quizzes" && (
            <div className="space-y-4">
              {quizzes.length === 0 ? (
                <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm">
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">{emptyMessage}</p>
                    <Button onClick={() => setActiveTab("create-from-bank")} className="bg-accent hover:bg-accent/90">
                      <Plus className="h-4 w-4 mr-2" />
                      {createButtonText}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                quizzes.map((quiz) => renderQuizCard(quiz, false))
              )}
            </div>
          )}

          {activeTab === "saved" && (
            <div className="space-y-4">
              {savedQuizzes.length === 0 ? (
                <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm">
                  <CardContent className="py-12 text-center">
                    <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-2">
                      No saved {assessmentType === "mid_semester" ? "exams" : "quizzes"} yet.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Save {assessmentType === "mid_semester" ? "exams" : "quizzes"} from the "
                      {assessmentType === "mid_semester" ? "Exams" : "Quizzes"}" tab to reuse them in the future.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                savedQuizzes.map((quiz) => renderQuizCard(quiz, true))
              )}
            </div>
          )}

          {activeTab === "issues" && <AdminQuizIssues assessmentType={assessmentType} />}

          {activeTab === "reevaluate" && (
            <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Re-evaluate Quiz Attempts
                </CardTitle>
                <CardDescription>
                  Fix and re-grade existing quiz attempts with corrected evaluation logic. Select a quiz and optionally
                  filter by session.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border-2 border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4">
                  <div className="space-y-2">
                    <p className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      What Re-evaluation Can Fix:
                    </p>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-6 list-disc">
                      <li>Incorrect grading due to evaluation logic errors</li>
                      <li>
                        Wrong <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">is_correct</code> values in
                        the database
                      </li>
                      <li>Miscalculated scores and percentages</li>
                      <li>All questions that have saved answers</li>
                    </ul>

                    <p className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2 mt-4">
                      <AlertTriangle className="h-4 w-4" />
                      What Re-evaluation Cannot Fix:
                    </p>
                    <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1 ml-6 list-disc">
                      <li>
                        Questions with <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">null</code> answers
                        (never saved to database)
                      </li>
                      <li>Lost data from timer expiration or submission failures</li>
                      <li>Answers that were never recorded in the first place</li>
                    </ul>

                    <p className="text-xs text-muted-foreground mt-3 italic">
                      💡 For questions with null answers, use the manual answer entry feature in each student's report
                      if you have their answers on record (e.g., from PDFs or screenshots).
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Re-evaluation Scope</label>
                    <Select
                      value={reEvalScope}
                      onValueChange={(value: "quiz" | "session") => {
                        setReEvalScope(value)
                        setSelectedQuizId("")
                        setSelectedSessionCode("")
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quiz">Specific Quiz (All Sessions or Filtered)</SelectItem>
                        <SelectItem value="session">Session Quiz (Specific Quiz for Session)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {reEvalScope === "quiz" && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Select Quiz *</label>
                        <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a quiz..." />
                          </SelectTrigger>
                          <SelectContent>
                            {quizzes.map((quiz) => (
                              <SelectItem key={quiz.id} value={quiz.id.toString()}>
                                {quiz.title} ({quiz.question_count} questions)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Filter by Session (Optional)</label>
                        <Select value={selectedSessionCode} onValueChange={setSelectedSessionCode}>
                          <SelectTrigger>
                            <SelectValue placeholder="All sessions (leave empty for all)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sessions</SelectItem>
                            {sessions.map((session) => (
                              <SelectItem key={session.id} value={session.code}>
                                {session.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {reEvalScope === "session" && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Select Session *</label>
                        <Select value={selectedSessionCode} onValueChange={setSelectedSessionCode}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a session..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sessions.map((session) => (
                              <SelectItem key={session.id} value={session.code}>
                                {session.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Select Quiz for This Session *</label>
                        <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a quiz..." />
                          </SelectTrigger>
                          <SelectContent>
                            {quizzes.map((quiz) => (
                              <SelectItem key={quiz.id} value={quiz.id.toString()}>
                                {quiz.title} ({quiz.question_count} questions)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>

                {reEvalResults && (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-success/10 border-success/20 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                        <div className="space-y-2 flex-1">
                          <p className="font-medium text-success">Re-evaluation Complete</p>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>✓ Attempts processed: {reEvalResults.attemptsProcessed}</p>
                            <p>✓ Answers evaluated: {reEvalResults.answersUpdated}</p>
                            <p>✓ Answers corrected: {reEvalResults.answersChanged}</p>
                            <p>✓ Correct answers: {reEvalResults.correctAnswers}</p>
                            <p>✓ Incorrect answers: {reEvalResults.incorrectAnswers}</p>
                            {reEvalResults.skippedQuestions > 0 && (
                              <p className="text-amber-600">⚠ Unanswered questions: {reEvalResults.skippedQuestions}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {reEvalResults.studentsWithIssues && reEvalResults.studentsWithIssues.length > 0 && (
                      <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                          <div className="space-y-2 flex-1">
                            <p className="font-medium text-amber-900 dark:text-amber-100">
                              Students with Unanswered Questions
                            </p>
                            <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                              The following students have questions that were not answered (likely due to timer
                              expiration or submission failures). These questions are marked as incorrect.
                            </p>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {reEvalResults.studentsWithIssues.map((issue: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 rounded bg-white dark:bg-gray-900 border"
                                >
                                  <div>
                                    <p className="font-medium text-sm">{issue.studentName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {issue.nullCount} unanswered question{issue.nullCount > 1 ? "s" : ""}
                                    </p>
                                  </div>
                                  <Link href={`/admin/results/${issue.attemptId}`}>
                                    <Button variant="outline" size="sm">
                                      <Eye className="h-3 w-3 mr-1" />
                                      Review
                                    </Button>
                                  </Link>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
                              💡 Tip: Use the manual answer entry feature in the student's report to input their correct
                              answers if you have them on record.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {reEvalResults.sampleCorrections && reEvalResults.sampleCorrections.length > 0 && (
                      <details className="rounded-lg border p-4">
                        <summary className="cursor-pointer font-medium text-sm">
                          View Sample Corrections ({reEvalResults.sampleCorrections.length} shown)
                        </summary>
                        <div className="mt-3 space-y-2 text-sm">
                          {reEvalResults.sampleCorrections.map((correction: any, idx: number) => (
                            <div key={idx} className="p-2 rounded bg-muted/50">
                              <p className="font-medium">{correction.studentName}</p>
                              <p className="text-xs text-muted-foreground">
                                Q: {correction.question}... | Selected: {correction.selected}
                              </p>
                              <p className="text-xs">
                                <span className={correction.wasCorrect ? "text-success" : "text-destructive"}>
                                  Was: {correction.wasCorrect ? "Correct" : "Incorrect"}
                                </span>
                                {" → "}
                                <span className={correction.nowCorrect ? "text-success" : "text-destructive"}>
                                  Now: {correction.nowCorrect ? "Correct" : "Incorrect"}
                                </span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> This will re-grade all completed quiz attempts for the selected scope using
                    the corrected evaluation logic. Student scores will be REPLACED (not added) with the new correct
                    scores.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleReEvaluate}
                  disabled={reEvaluating || !selectedQuizId || (reEvalScope === "session" && !selectedSessionCode)}
                  className="w-full"
                >
                  {reEvaluating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Re-evaluating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Re-evaluate Quiz Attempts
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}

          {activeTab === "bonus" && (
            <Card className="border border-border/50 shadow-sm bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Grant Bonus Points (One-Time Operation)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2.5 text-sm text-amber-900 dark:text-amber-100">
                  <p>
                    Grant bonus points to students for unanswered questions caused by system issues (timer expiration,
                    submission failures, auto-skip bugs).
                  </p>
                  <p>
                    This operation will find all questions with{" "}
                    <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">null</code> answers (questions that were
                    never saved due to system bugs) and mark them as correct, granting bonus points to affected students.
                  </p>
                  <p className="font-medium">
                    ⚠️ This is a ONE-TIME operation. Use it only to compensate for past system issues. The system is now
                    fixed and will properly save all answers going forward.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Filter by Quiz (Optional)</label>
                    <Select
                      value={bonusQuizId}
                      onValueChange={(value) => {
                        setBonusQuizId(value)
                        setBonusPreview(null)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All quizzes (leave empty for all)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Quizzes</SelectItem>
                        {quizzes.map((quiz) => (
                          <SelectItem key={quiz.id} value={quiz.id.toString()}>
                            {quiz.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Filter by Section (Optional)</label>
                    <Select
                      value={bonusSection}
                      onValueChange={(value) => {
                        setBonusSection(value)
                        setBonusPreview(null)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All sections (leave empty for all)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        {sessions.map((session) => (
                          <SelectItem key={session.id} value={session.code}>
                            {session.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button onClick={handleBonusPreview} variant="outline" className="w-full bg-transparent">
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Impact
                  </Button>

                  {bonusPreview && (
                    <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 p-4">
                      <p className="font-medium text-blue-900 dark:text-blue-100 mb-3">Preview Results:</p>
                      <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                        <p>
                          • <strong>{bonusPreview.affected_students}</strong> students will receive bonus points
                        </p>
                        <p>
                          • <strong>{bonusPreview.affected_answers}</strong> unanswered questions will be marked as
                          correct
                        </p>
                        <p>
                          • <strong>{bonusPreview.affected_quizzes}</strong> quiz(zes) affected
                        </p>
                        <p>
                          • <strong>{bonusPreview.affected_attempts}</strong> quiz attempt(s) will have scores updated
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {bonusResults && (
                  <div className="rounded-lg border bg-success/10 border-success/20 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
                      <div className="space-y-2 flex-1">
                        <p className="font-medium text-success">Bonus Points Granted Successfully!</p>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>✓ Students affected: {bonusResults.affectedStudents}</p>
                          <p>✓ Questions marked correct: {bonusResults.affectedAnswers}</p>
                        </div>
                        {bonusResults.summary && bonusResults.summary.length > 0 && (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-sm font-medium">
                              View Student Summary ({bonusResults.summary.length} students)
                            </summary>
                            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                              {bonusResults.summary.map((student: any, idx: number) => (
                                <div key={idx} className="text-xs p-2 rounded bg-white dark:bg-gray-900 border">
                                  <p className="font-medium">
                                    {student.studentName} ({student.studentId})
                                  </p>
                                  <p className="text-muted-foreground">
                                    {student.section} • {student.quizTitle} • +{student.bonusPoints} bonus point
                                    {student.bonusPoints > 1 ? "s" : ""}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>How it works:</strong> This operation finds all quiz answers where{" "}
                    <code className="bg-muted px-1 rounded">selected_answer IS NULL</code> (questions that were never
                    saved due to timer expiration, submission failures, or auto-skip bugs) and marks them as correct
                    (is_correct = true), then recalculates student scores. This is a one-time compensation for past
                    system issues.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => setBonusPointsDialogOpen(true)}
                  disabled={!bonusPreview || grantingBonus}
                  className="w-full bg-accent hover:bg-accent/90"
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Grant Bonus Points
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">Delete Quiz</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">{quizToDelete?.title}</span>
              ?
              <br />
              <br />
              This will permanently delete all associated questions and student attempts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Quiz"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bonusPointsDialogOpen} onOpenChange={setBonusPointsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                <Gift className="h-5 w-5 text-accent" />
              </div>
              <AlertDialogTitle className="text-xl">Confirm Bonus Points</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base leading-relaxed">
              You are about to grant bonus points to{" "}
              <span className="font-semibold text-foreground">{bonusPreview?.affected_students} students</span> for{" "}
              <span className="font-semibold text-foreground">
                {bonusPreview?.affected_answers} unanswered questions
              </span>
              .
              <br />
              <br />
              All questions with null answers will be marked as correct and student scores will be recalculated. This
              operation cannot be undone.
              <br />
              <br />
              <strong>Are you sure you want to proceed?</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={grantingBonus}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGrantBonus}
              disabled={grantingBonus}
              className="bg-accent hover:bg-accent/90"
            >
              {grantingBonus ? "Granting..." : "Yes, Grant Bonus Points"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
