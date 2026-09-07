"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
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
  BookOpen,
  FolderOpen,
  Plus,
  ArrowLeft,
  Search,
  Filter,
  Trash2,
  Edit,
  Eye,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
  LayoutGrid,
  List,
  Brain,
  Bot,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { QuestionTextRenderer } from "@/components/question-text-renderer"
import { ImportExportDialog } from "@/components/import-export-dialog"

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

interface Topic {
  id: number
  name: string
  description: string | null
  question_count: number
  created_at: string
}

export default function InstructorQuestionBankPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [activeMenu, setActiveMenu] = useState<"all" | "topics" | "types" | "deleted" | string>("all")
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [deletedQuestions, setDeletedQuestions] = useState<BankQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [allQuestionsForTypes, setAllQuestionsForTypes] = useState<BankQuestion[]>([])
  
  // Get unique question types from all questions
  const questionTypes = Array.from(new Set(allQuestionsForTypes.map(q => q.question_type))).sort()
  
  // Get question types with counts for the filter dropdown
  const questionTypesWithCounts = questionTypes.map(type => ({
    name: type,
    count: allQuestionsForTypes.filter(q => q.question_type === type).length
  })).sort((a, b) => b.count - a.count) // Sort by count descending
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<BankQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [previewQuestion, setPreviewQuestion] = useState<BankQuestion | null>(null)
  
  // AI Verification
  const [verifyAnswersDialogOpen, setVerifyAnswersDialogOpen] = useState(false)
  const [topicToVerify, setTopicToVerify] = useState<Topic | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verificationResults, setVerificationResults] = useState<any[]>([])
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [verificationStats, setVerificationStats] = useState<Record<string, { verifiedCount: number; lastVerified: string }>>({})
  
  // Edit Topic Modal
  const [editTopicDialogOpen, setEditTopicDialogOpen] = useState(false)
  const [topicToEdit, setTopicToEdit] = useState<Topic | null>(null)
  const [newTopicName, setNewTopicName] = useState("")
  const [renaming, setRenaming] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (activeMenu === "all" && !selectedTopic && !selectedType) {
      fetchAllQuestions()
    } else if (activeMenu === "topics" && !selectedTopic) {
      fetchTopics()
    } else if (activeMenu === "types" && !selectedType) {
      // Types are derived from questions, so fetch all questions first
      handleTypesMenuClick()
    } else if (activeMenu === "deleted") {
      fetchDeletedQuestions()
    }
  }, [activeMenu, selectedTopic, selectedType])

  // When a topic is selected from the topics view, fetch its questions
  useEffect(() => {
    if (activeMenu === "topics" && selectedTopic) {
      fetchQuestionsForTopic(selectedTopic)
    }
  }, [selectedTopic])

  // When a type is selected from the types view, fetch its questions
  useEffect(() => {
    if (activeMenu === "types" && selectedType) {
      fetchQuestionsForType(selectedType)
    }
  }, [selectedType])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchAllQuestions(),
        fetchTopics(),
        fetchDeletedQuestions()
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchAllQuestions = async () => {
    try {
      setLoading(true)
      console.log("[Question Bank] Fetching all questions...")
      const response = await instructorApiFetch("/api/instructor/question-bank")
      const data = await response.json()
      console.log("[Question Bank] Response:", { 
        ok: response.ok, 
        questionCount: data.questions?.length || 0,
        hasError: !!data.error 
      })
      
        if (response.ok) {
        const fetchedQuestions = data.questions || []
        console.log("[Question Bank] Setting questions:", fetchedQuestions.length)
        setQuestions(fetchedQuestions)
        // Also store for question types calculation
        setAllQuestionsForTypes(fetchedQuestions)
        
        if (fetchedQuestions.length === 0) {
          console.warn("[Question Bank] No questions returned from API")
        }
      } else {
        console.error("[Question Bank] Failed to fetch questions:", data.error)
        toast({
          title: "Failed to load questions",
          description: data.error || "An error occurred",
          variant: "destructive",
        })
        setQuestions([])
        setAllQuestionsForTypes([])
      }
    } catch (error) {
      console.error("[Question Bank] Failed to fetch questions:", error)
      toast({
        title: "Error",
        description: "Failed to load questions",
        variant: "destructive",
      })
      setQuestions([])
      setAllQuestionsForTypes([])
    } finally {
      setLoading(false)
    }
  }

  const fetchQuestionsForTopic = async (topicName: string) => {
    try {
      const response = await instructorApiFetch(`/api/instructor/question-bank?topic=${encodeURIComponent(topicName)}`)
          const data = await response.json()
      if (response.ok) {
        setQuestions(data.questions || [])
      } else {
        toast({
          title: "Failed to load questions",
          description: data.error || "An error occurred",
          variant: "destructive",
        })
        }
      } catch (error) {
      console.error("Failed to fetch topic questions:", error)
      toast({
        title: "Error",
        description: "Failed to load questions for this topic",
        variant: "destructive",
      })
    }
  }

  const fetchQuestionsForType = async (questionType: string) => {
    try {
      const response = await instructorApiFetch(`/api/instructor/question-bank?type=${encodeURIComponent(questionType)}`)
      const data = await response.json()
      if (response.ok) {
        setQuestions(data.questions || [])
      } else {
        toast({
          title: "Failed to load questions",
          description: data.error || "An error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to fetch type questions:", error)
      toast({
        title: "Error",
        description: "Failed to load questions for this type",
        variant: "destructive",
      })
    }
  }

  const fetchTopics = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/question-bank/topics")
      const data = await response.json()
      if (response.ok) {
        setTopics(data.topics || [])
        fetchVerificationStats() // Fetch stats after topics loaded
      }
    } catch (error) {
      console.error("Failed to fetch topics:", error)
    }
  }

  const fetchVerificationStats = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/question-bank/topics/verification-stats")
      const data = await response.json()
      if (response.ok) {
        setVerificationStats(data.stats || {})
      }
    } catch (error) {
      console.error("Failed to fetch verification stats:", error)
      // Silently fail - stats are optional
    }
  }

  const fetchDeletedQuestions = async () => {
    try {
      const instructorSession = localStorage.getItem("instructorSession")
      const headers: Record<string, string> = {}
      if (instructorSession) {
        try {
          const session = JSON.parse(instructorSession)
          headers["instructor-session"] = session.session || ""
        } catch (e) {
          console.error("Failed to parse instructor session:", e)
        }
      }

      const response = await instructorApiFetch("/api/instructor/question-bank/deleted", { headers })
      const data = await response.json()
      if (response.ok) {
        setDeletedQuestions(data.questions || [])
      }
    } catch (error) {
      console.error("Failed to fetch deleted questions:", error)
    }
  }

  const handleTopicsMenuClick = () => {
    setActiveMenu("topics")
    setSelectedTopic(null)
    setSelectedType(null)
    fetchTopics()
  }

  const handleTypesMenuClick = async () => {
    setActiveMenu("types")
    setSelectedTopic(null)
    setSelectedType(null)
    // Use local loading state instead of global to avoid hiding side menu
    // Only fetch if we don't have questions yet
    if (allQuestionsForTypes.length === 0) {
      setLoadingTypes(true)
      // Fetch all questions to calculate types
      try {
        const response = await instructorApiFetch("/api/instructor/question-bank")
        const data = await response.json()
        if (response.ok) {
          const fetchedQuestions = data.questions || []
          setAllQuestionsForTypes(fetchedQuestions)
        } else {
          console.error("Failed to fetch questions for types:", data.error)
          toast({
            title: "Failed to load question types",
            description: data.error || "An error occurred",
            variant: "destructive",
          })
          setAllQuestionsForTypes([])
        }
      } catch (error) {
        console.error("Failed to fetch questions for types:", error)
        toast({
          title: "Error",
          description: "Failed to load question types",
          variant: "destructive",
        })
        setAllQuestionsForTypes([])
      } finally {
        setLoadingTypes(false)
      }
    }
  }

  const handleTopicClick = (topicName: string) => {
    setSelectedTopic(topicName)
    fetchQuestionsForTopic(topicName)
  }

  const handleTypeClick = (questionType: string) => {
    setSelectedType(questionType)
    fetchQuestionsForType(questionType)
  }

  const handleDeleteQuestion = async (question: BankQuestion) => {
    setQuestionToDelete(question)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!questionToDelete) return

    setDeleting(true)
    try {
      const instructorSession = localStorage.getItem("instructorSession")
      const headers: Record<string, string> = {}
      if (instructorSession) {
        try {
          const session = JSON.parse(instructorSession)
          headers["instructor-session"] = session.session || ""
        } catch (e) {
          console.error("Failed to parse instructor session:", e)
        }
      }

      const response = await instructorApiFetch(`/api/instructor/question-bank/${questionToDelete.id}`, {
        method: "DELETE",
        headers
      })

      if (response.ok) {
        toast({
          title: "🗑️ Question Moved to Trash",
          description: "The question has been moved to trash and can be restored.",
          duration: 6000,
        })
        fetchData()
      } else {
        throw new Error("Failed to delete question")
      }
    } catch (error) {
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

  const handleRestoreQuestions = async () => {
    if (selectedQuestions.size === 0) return

    setRestoring(true)
    try {
      const instructorSession = localStorage.getItem("instructorSession")
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      }
      if (instructorSession) {
        try {
          const session = JSON.parse(instructorSession)
          headers["instructor-session"] = session.session || ""
        } catch (e) {
          console.error("Failed to parse instructor session:", e)
        }
      }

      const response = await instructorApiFetch("/api/instructor/question-bank/deleted", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ ids: Array.from(selectedQuestions) }),
      })

        if (response.ok) {
        toast({
          title: "✨ Questions Restored",
          description: `${selectedQuestions.size} question(s) have been restored.`,
        })
        setSelectedQuestions(new Set())
        fetchData()
      } else {
        throw new Error("Failed to restore questions")
      }
    } catch (error) {
      toast({
        title: "Failed to restore questions",
        description: "An error occurred while restoring questions.",
        variant: "destructive",
      })
    } finally {
      setRestoring(false)
      setRestoreDialogOpen(false)
    }
  }

  const handleVerifyTopicAnswers = async (topic: Topic) => {
    setTopicToVerify(topic)
    setVerifying(true)
    setVerificationResults([])
    setVerifyAnswersDialogOpen(true)

    try {
      const response = await instructorApiFetch("/api/instructor/question-bank/verify-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicName: topic.name })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setVerificationResults(data.results || [])
        
        const suggestedChanges = data.results.filter((r: any) => r.needsUpdate)
        
        if (suggestedChanges.length === 0) {
          const skippedCount = data.results.filter((r: any) => r.skipped).length
          toast({
            title: "✅ All Answers Verified",
            description: `Topic: "${topic.name}"
📊 Results:
  • ✅ All Correct: ${data.results.length - skippedCount} question(s)
  • ⚠️ Skipped: ${skippedCount} question(s) (code/fill-blank types)
  
No corrections needed!`,
            duration: 6000,
          })
          setVerifyAnswersDialogOpen(false)
        } else {
          // Show approval dialog
          setApprovalDialogOpen(true)
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
      setVerifyAnswersDialogOpen(false)
    } finally {
      setVerifying(false)
    }
  }

  const handleApproveCorrections = async () => {
    if (!topicToVerify) return

    const correctionsToApply = verificationResults.filter(r => r.needsUpdate)
    const totalVerified = verificationResults.length
    const noChangesNeeded = verificationResults.filter(r => !r.needsUpdate && !r.skipped).length
    const skipped = verificationResults.filter(r => r.skipped).length

    try {
      const response = await instructorApiFetch("/api/instructor/question-bank/apply-corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corrections: correctionsToApply })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const successCount = data.updated || 0
        const errorCount = data.errors || 0
        
        toast({
          title: "✅ AI Verification Complete",
          description: `Topic: "${topicToVerify.name}"
📊 Results:
  • ✅ Corrected: ${successCount} question(s)
  • ✓ Already Correct: ${noChangesNeeded} question(s)
  • ⚠️ Skipped: ${skipped} question(s)
  • ❌ Failed: ${errorCount} question(s)
  
Total Analyzed: ${totalVerified} questions`,
          duration: 8000,
        })
        setApprovalDialogOpen(false)
        setVerifyAnswersDialogOpen(false)
        fetchAllQuestions() // Refresh the list
        fetchTopics()
        fetchVerificationStats() // Refresh AI verified badges
      } else {
        throw new Error(data.error || "Failed to apply corrections")
      }
    } catch (error) {
      console.error("Failed to apply corrections:", error)
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to apply corrections",
        variant: "destructive"
      })
    }
  }

  const handleEditTopic = (topic: Topic) => {
    setTopicToEdit(topic)
    setNewTopicName(topic.name)
    setEditTopicDialogOpen(true)
  }

  const handleRenameTopic = async () => {
    if (!topicToEdit || !newTopicName.trim()) return

    if (newTopicName.trim() === topicToEdit.name) {
      setEditTopicDialogOpen(false)
      return
    }

    setRenaming(true)
    try {
      const response = await fetch(
        `/api/instructor/question-bank/topics/${encodeURIComponent(topicToEdit.name)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newTopicName.trim() }),
        }
      )

          const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "✅ Topic Renamed",
          description: `Topic renamed from "${topicToEdit.name}" to "${newTopicName.trim()}". ${data.questionsUpdated || 0} question(s) updated.`,
          duration: 5000,
        })
        setEditTopicDialogOpen(false)
        setTopicToEdit(null)
        setNewTopicName("")
        fetchTopics() // Refresh topics list
        // If we're currently viewing this topic, update the selected topic
        if (selectedTopic === topicToEdit.name) {
          setSelectedTopic(newTopicName.trim())
          fetchQuestionsForTopic(newTopicName.trim())
        }
      } else {
        throw new Error(data.error || "Failed to rename topic")
        }
      } catch (error) {
      console.error("Failed to rename topic:", error)
      toast({
        title: "Rename Failed",
        description: error instanceof Error ? error.message : "Failed to rename topic",
        variant: "destructive",
      })
    } finally {
      setRenaming(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (selectedQuestions.size === 0) return

    setDeleting(true)
    try {
      const instructorSession = localStorage.getItem("instructorSession")
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      }
      if (instructorSession) {
        try {
          const session = JSON.parse(instructorSession)
          headers["instructor-session"] = session.session || ""
        } catch (e) {
          console.error("Failed to parse instructor session:", e)
        }
      }

      const response = await instructorApiFetch("/api/instructor/question-bank/deleted", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ ids: Array.from(selectedQuestions) }),
      })

      if (response.ok) {
        toast({
          title: "💥 Questions Permanently Deleted",
          description: `${selectedQuestions.size} question(s) have been permanently removed.`,
          variant: "destructive",
        })
        setSelectedQuestions(new Set())
        fetchDeletedQuestions()
      } else {
        throw new Error("Failed to permanently delete questions")
      }
    } catch (error) {
      toast({
        title: "Failed to delete questions",
        description: "An error occurred while deleting questions.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setPermanentDeleteDialogOpen(false)
    }
  }

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      true_false: "True/False",
      mcq: "Multiple Choice",
      select_all: "Select All",
      fill_blank: "Fill in Blank",
      code_problem: "Code Problem",
      trace_output: "Trace Output",
      debug_code: "Debug Code",
      code_write: "Code Write",
      code_explain: "Code Explain",
      code_output: "Code Output",
      code_debug: "Code Debug",
      fill_code: "Fill Code",
      trace_logic: "Trace Logic",
      scenario_match: "Scenario Match",
      multi_output: "Multi Output",
      code_reorder: "Code Reorder",
    }
    return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
  }

  const getQuestionTypeCount = (type: string) => {
    return allQuestionsForTypes.filter(q => q.question_type === type).length
  }

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: "bg-green-500",
      medium: "bg-yellow-500",
      hard: "bg-red-500",
    }
    return colors[difficulty] || "bg-gray-500"
  }

  // Only apply search and filters when not in a specific menu view
  const filteredQuestions = (activeMenu === "deleted" ? deletedQuestions : questions).filter((q) => {
    // When viewing a specific topic or type, don't apply those filters
    if (activeMenu === "topics" && selectedTopic && q.topic !== selectedTopic) return false
    if (activeMenu === "types" && selectedType && q.question_type !== selectedType) return false
    
    // Apply search and other filters
    if (searchTerm && !q.question_text.toLowerCase().includes(searchTerm.toLowerCase())) return false
    if (activeMenu !== "types" && typeFilter !== "all" && q.question_type !== typeFilter) return false
    if (difficultyFilter !== "all" && q.difficulty !== difficultyFilter) return false
    return true
  })

  if (loading) {
  return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
              <BookOpen className="h-7 w-7 text-white" />
              </div>
              <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Question Bank
                </h1>
              <p className="text-slate-600 text-sm mt-1">
                Manage your question library
              </p>
              </div>
            </div>
          <div className="flex gap-3">
              <Link href="/instructor/dashboard">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
                </Button>
              </Link>
              <ImportExportDialog userType="instructor" />
              <Link href="/instructor/question-bank/new">
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 gap-2">
                <Plus className="h-4 w-4" />
                  Add Question
                </Button>
              </Link>
            </div>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Side Menu */}
          <Card className="lg:col-span-1 border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-sm h-fit rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-slate-800">Question Bank Menu</CardTitle>
              <CardDescription className="text-slate-600">Select a module</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant={activeMenu === "all" ? "default" : "ghost"}
                className={`w-full justify-start gap-2 h-12 rounded-xl ${
                  activeMenu === "all"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                }`}
                onClick={() => {
                  setActiveMenu("all")
                  setSelectedTopic(null)
                  setSelectedType(null)
                  fetchAllQuestions()
                }}
              >
                <Database className="h-4 w-4" />
                All Questions
              </Button>

              <Button
                variant={activeMenu === "topics" ? "default" : "ghost"}
                className={`w-full justify-start gap-2 h-12 rounded-xl ${
                  activeMenu === "topics"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                }`}
                onClick={handleTopicsMenuClick}
              >
                <FolderOpen className="h-4 w-4" />
                Topics
              </Button>

              <Button
                variant={activeMenu === "types" ? "default" : "ghost"}
                className={`w-full justify-start gap-2 h-12 rounded-xl ${
                  activeMenu === "types"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                }`}
                onClick={handleTypesMenuClick}
              >
                <Filter className="h-4 w-4" />
                Question Types
              </Button>

              <div className="pt-2 border-t border-slate-200">
                <Button
                  variant={activeMenu === "deleted" ? "default" : "ghost"}
                  className={`w-full justify-start gap-2 h-12 rounded-xl ${
                    activeMenu === "deleted"
                      ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                  }`}
                  onClick={() => {
                    setActiveMenu("deleted")
                    setSelectedTopic(null)
                    setSelectedType(null)
                    fetchDeletedQuestions()
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Deleted Items
                </Button>
        </div>
            </CardContent>
          </Card>

      {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search questions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
      </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Question Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {questionTypesWithCounts.map((type) => (
                        <SelectItem key={type.name} value={type.name}>
                          {getQuestionTypeLabel(type.name)} ({type.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Difficulties</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
    </div>
              </CardContent>
            </Card>

            {/* Questions List */}
            {activeMenu === "deleted" && selectedQuestions.size > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-amber-800">
                      {selectedQuestions.size} question(s) selected
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRestoreDialogOpen(true)}
                        disabled={restoring}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restore
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setPermanentDeleteDialogOpen(true)}
                        disabled={deleting}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Permanently
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Render based on active menu */}
            {activeMenu === "topics" && !selectedTopic ? (
              // Show topics list
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Topics</CardTitle>
                        <CardDescription>Select a topic to view its questions</CardDescription>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                        <Button
                          variant={viewMode === "grid" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("grid")}
                          className="h-8 w-8 p-0"
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === "list" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("list")}
                          className="h-8 w-8 p-0"
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                {topics.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600">No topics available</p>
                    </CardContent>
                  </Card>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {topics.map((topic) => (
                      <Card
                        key={topic.id}
                        className="group relative overflow-hidden border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1"
                      >
                        {/* Decorative gradient overlay */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl -z-0" />
                        
                        <CardHeader className="pb-3 relative z-10">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 flex-shrink-0">
                                <FolderOpen className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {topic.name}
                                </CardTitle>
                                {topic.description && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                    {topic.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0 space-y-4 relative z-10">
                          {/* Question Count Badge */}
                          <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/50">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Questions</span>
                            <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-base font-bold px-3 py-1 shadow-md">
                              {topic.question_count}
                            </Badge>
                          </div>

                          {/* AI Verification Status */}
                          {verificationStats[topic.name] && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50">
                              <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                                {verificationStats[topic.name].verifiedCount} {verificationStats[topic.name].verifiedCount === 1 ? 'correction' : 'corrections'} verified
                              </span>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 min-w-[100px] border-slate-300 dark:border-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:border-blue-700 dark:hover:text-blue-400 transition-all"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleTopicClick(topic.name)
                              }}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              <span className="text-xs font-medium">View</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 min-w-[100px] border-purple-300 dark:border-purple-600 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-600 dark:hover:bg-purple-950/30 dark:hover:border-purple-700 dark:hover:text-purple-400 transition-all"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleVerifyTopicAnswers(topic)
                              }}
                              title="Verify answers with AI"
                            >
                              <Brain className="h-3.5 w-3.5 mr-1.5" />
                              <span className="text-xs font-medium">AI Verify</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 min-w-[100px] border-slate-300 dark:border-slate-600 hover:bg-green-50 hover:border-green-300 hover:text-green-600 dark:hover:bg-green-950/30 dark:hover:border-green-700 dark:hover:text-green-400 transition-all"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditTopic(topic)
                              }}
                            >
                              <Edit className="h-3.5 w-3.5 mr-1.5" />
                              <span className="text-xs font-medium">Edit</span>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topics.map((topic) => (
                      <Card
                        key={topic.id}
                        className="group border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300"
                      >
                        <CardContent className="pt-6 pb-6">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 flex-shrink-0">
                                <FolderOpen className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {topic.name}
                                </h3>
                                {topic.description && (
                                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                                    {topic.description}
                                  </p>
                                )}
                                {verificationStats[topic.name] && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <Brain className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                    <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                                      {verificationStats[topic.name].verifiedCount} {verificationStats[topic.name].verifiedCount === 1 ? 'correction' : 'corrections'} verified
                                    </span>
                                  </div>
                                )}
                              </div>
                              <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-base font-bold px-4 py-1.5 shadow-md flex-shrink-0">
                                {topic.question_count} {topic.question_count === 1 ? 'question' : 'questions'}
                              </Badge>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-300 dark:border-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:border-blue-700 dark:hover:text-blue-400 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTopicClick(topic.name)
                                }}
                              >
                                <Eye className="h-3.5 w-3.5 mr-1.5" />
                                <span className="text-xs font-medium">View</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-purple-300 dark:border-purple-600 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-600 dark:hover:bg-purple-950/30 dark:hover:border-purple-700 dark:hover:text-purple-400 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleVerifyTopicAnswers(topic)
                                }}
                                title="Verify answers with AI"
                              >
                                <Brain className="h-3.5 w-3.5 mr-1.5" />
                                <span className="text-xs font-medium">AI Verify</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-300 dark:border-slate-600 hover:bg-green-50 hover:border-green-300 hover:text-green-600 dark:hover:bg-green-950/30 dark:hover:border-green-700 dark:hover:text-green-400 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditTopic(topic)
                                }}
                              >
                                <Edit className="h-3.5 w-3.5 mr-1.5" />
                                <span className="text-xs font-medium">Edit</span>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : activeMenu === "types" && !selectedType ? (
              // Show question types list
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Question Types</CardTitle>
                        <CardDescription>Select a question type to view its questions</CardDescription>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                        <Button
                          variant={viewMode === "grid" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("grid")}
                          className="h-8 w-8 p-0"
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === "list" ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setViewMode("list")}
                          className="h-8 w-8 p-0"
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                {loadingTypes ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Loader2 className="h-12 w-12 text-blue-600 mx-auto mb-3 animate-spin" />
                      <p className="text-slate-600">Loading question types...</p>
                    </CardContent>
                  </Card>
                ) : questionTypes.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-600">No question types available</p>
                      <p className="text-sm text-slate-500 mt-2">
                        {allQuestionsForTypes.length === 0 
                          ? "No questions found in the database" 
                          : "Questions found but no types detected"}
                      </p>
                    </CardContent>
                  </Card>
                ) : viewMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {questionTypes.map((type) => (
                      <Card
                        key={type}
                        className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-blue-300"
                        onClick={() => handleTypeClick(type)}
                      >
                        <CardHeader>
                          <div className="flex items-center gap-2 mb-2">
                            <Filter className="h-5 w-5 text-blue-600" />
                            <CardTitle className="text-lg">{getQuestionTypeLabel(type)}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-slate-600">Questions</span>
                              <Badge variant="outline" className="text-base font-semibold">
                                {getQuestionTypeCount(type)}
                              </Badge>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleTypeClick(type)
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Questions
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {questionTypes.map((type) => (
                      <Card
                        key={type}
                        className="cursor-pointer hover:shadow-md transition-all border-2 hover:border-blue-300"
                        onClick={() => handleTypeClick(type)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <Filter className="h-5 w-5 text-blue-600" />
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg">{getQuestionTypeLabel(type)}</h3>
                                <p className="text-sm text-slate-500 mt-1">Type: {type}</p>
                              </div>
                              <Badge variant="outline" className="text-base font-semibold">
                                {getQuestionTypeCount(type)} questions
                              </Badge>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="ml-4"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleTypeClick(type)
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : filteredQuestions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600">
                    {activeMenu === "deleted"
                      ? "No deleted questions found"
                      : activeMenu === "topics" && selectedTopic
                      ? `No questions found in topic "${selectedTopic}"`
                      : activeMenu === "types" && selectedType
                      ? `No questions found of type "${getQuestionTypeLabel(selectedType)}"`
                      : "No questions found"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Show back button if viewing a specific topic or type */}
                {(selectedTopic || selectedType) && (
                  <Card>
                    <CardContent className="pt-6">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (selectedTopic) {
                            setSelectedTopic(null)
                          }
                          if (selectedType) {
                            setSelectedType(null)
                          }
                        }}
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to {activeMenu === "topics" ? "Topics" : "Question Types"}
                      </Button>
                      {selectedTopic && (
                        <p className="mt-2 text-sm text-slate-600">
                          Showing questions for topic: <strong>{selectedTopic}</strong>
                        </p>
                      )}
                      {selectedType && (
                        <p className="mt-2 text-sm text-slate-600">
                          Showing questions of type: <strong>{getQuestionTypeLabel(selectedType)}</strong>
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
                {filteredQuestions.map((question, index) => (
                  <Card key={question.id} className="border-2">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">#{index + 1}</Badge>
                            <Badge variant="outline">{getQuestionTypeLabel(question.question_type)}</Badge>
                            <Badge className={getDifficultyColor(question.difficulty)}>
                              {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                            </Badge>
                            {question.topic && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                {question.topic}
                              </Badge>
                            )}
                          </div>
                          <QuestionTextRenderer text={question.question_text} className="text-base leading-relaxed" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span>Used in {question.quiz_usage_count} quiz(es)</span>
                          <span>
                            Created {new Date(question.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {activeMenu === "deleted" && (
                            <Checkbox
                              checked={selectedQuestions.has(question.id)}
                              onCheckedChange={() => {
                                const newSelected = new Set(selectedQuestions)
                                if (newSelected.has(question.id)) {
                                  newSelected.delete(question.id)
                                } else {
                                  newSelected.add(question.id)
                                }
                                setSelectedQuestions(newSelected)
                              }}
                            />
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewQuestion(question)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                          {activeMenu !== "deleted" && (
                            <>
                              <Link href={`/instructor/question-bank/${question.id}/edit`}>
                                <Button variant="outline" size="sm">
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteQuestion(question)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the question to trash. You can restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Questions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore {selectedQuestions.size} question(s) and make them available again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreQuestions} disabled={restoring}>
              {restoring ? "Restoring..." : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Dialog */}
      <AlertDialog open={permanentDeleteDialogOpen} onOpenChange={setPermanentDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Questions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedQuestions.size} question(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Verification Dialog */}
      <Dialog open={verifyAnswersDialogOpen} onOpenChange={setVerifyAnswersDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              {verifying 
                ? `Verifying answers for "${topicToVerify?.name}" using ChatGPT`
                : `Review AI Suggestions - ${topicToVerify?.name}`
              }
            </DialogTitle>
            <DialogDescription>
              {verifying 
                ? "AI is analyzing questions and verifying answers. This may take a moment..."
                : "Review the AI's suggested corrections before applying them."
              }
            </DialogDescription>
          </DialogHeader>

          {verifying ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Bot className="h-12 w-12 text-purple-600 animate-pulse mb-4" />
              <p className="text-slate-600">Verifying answers with AI...</p>
              <p className="text-sm text-slate-500 mt-2">This may take a few moments</p>
            </div>
          ) : verificationResults.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>AI has found {verificationResults.filter(r => r.needsUpdate).length} potential answer corrections.</strong> Review and approve changes.
                </p>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {verificationResults.filter(r => r.needsUpdate).map((result, index) => (
                  <Card key={result.questionId} className="border-amber-200">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Question #{result.questionOrder || index + 1}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {getQuestionTypeLabel(result.questionType)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700 mb-2">Question:</p>
                        <QuestionTextRenderer text={result.questionText} className="text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-1">Current Answer:</p>
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            {Array.isArray(result.currentAnswer) 
                              ? result.currentAnswer.join(", ") 
                              : String(result.currentAnswer)}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-1">Suggested Answer:</p>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            {Array.isArray(result.suggestedAnswer) 
                              ? result.suggestedAnswer.join(", ") 
                              : String(result.suggestedAnswer)}
                          </Badge>
                        </div>
                      </div>
                      {result.reasoning && (
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-1">AI Reasoning:</p>
                          <p className="text-xs text-slate-500">{result.reasoning}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <p className="text-slate-600">No corrections needed. All answers are correct!</p>
            </div>
          )}

          <DialogFooter>
            {!verifying && verificationResults.length > 0 && (
              <>
                <Button variant="outline" onClick={() => setVerifyAnswersDialogOpen(false)}>
                  Cancel
                </Button>
                {verificationResults.filter(r => r.needsUpdate).length > 0 && (
                  <Button onClick={() => setApprovalDialogOpen(true)}>
                    Review & Approve Changes
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply AI Corrections?</DialogTitle>
            <DialogDescription>
              This will update {verificationResults.filter(r => r.needsUpdate).length} question(s) with the AI's suggested corrections.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApproveCorrections}>
              Apply Corrections
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Topic Dialog */}
      <Dialog open={editTopicDialogOpen} onOpenChange={setEditTopicDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-green-600" />
              Edit Topic
            </DialogTitle>
            <DialogDescription>
              Rename the topic. This will update all questions in this topic.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Current Topic Name
              </label>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {topicToEdit?.name}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="newTopicName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                New Topic Name
              </label>
              <Input
                id="newTopicName"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Enter new topic name"
                className="w-full"
                disabled={renaming}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !renaming && newTopicName.trim()) {
                    handleRenameTopic()
                  }
                }}
              />
              {topicToEdit && (
                <p className="text-xs text-slate-500">
                  {topicToEdit.question_count} question(s) will be updated
                </p>
              )}
            </div>
      </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditTopicDialogOpen(false)
                setTopicToEdit(null)
                setNewTopicName("")
              }}
              disabled={renaming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameTopic}
              disabled={renaming || !newTopicName.trim() || newTopicName.trim() === topicToEdit?.name}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {renaming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Renaming...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Rename Topic
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
