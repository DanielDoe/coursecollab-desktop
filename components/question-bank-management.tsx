"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Edit,
  Trash2,
  Search,
  Filter,
  AlertTriangle,
  Eye,
  CheckSquare,
  Plus,
  FolderOpen,
  Trash,
  Edit2,
  CheckCircle2,
  Loader2,
  Sparkles,
  RotateCcw,
  Brain,
  Bot,
} from "lucide-react"
import Link from "next/link"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QuestionTextRenderer } from "@/components/question-text-renderer"

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

interface Quiz {
  id: number
  title: string
}

export function QuestionBankManagement({ 
  selectedQuizId, 
  userType = "admin",
  quizzes = [],
  onQuizChange
}: { 
  selectedQuizId?: string
  userType?: "admin" | "instructor"
  quizzes?: Quiz[]
  onQuizChange?: (quizId: string) => void
}) {
  const router = useRouter()
  usePreventBack(userType === "admin" ? "/admin/login" : "/instructor/login")
  const { toast } = useToast()
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<BankQuestion[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [topicsList, setTopicsList] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set())
  const [previewQuestion, setPreviewQuestion] = useState<BankQuestion | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<BankQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteTopicDialogOpen, setDeleteTopicDialogOpen] = useState(false)
  const [topicToDelete, setTopicToDelete] = useState<Topic | null>(null)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false)
  const [renameTopicDialogOpen, setRenameTopicDialogOpen] = useState(false)
  const [topicToRename, setTopicToRename] = useState<Topic | null>(null)
  const [newTopicName, setNewTopicName] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [verificationStats, setVerificationStats] = useState<Record<string, { verifiedCount: number; lastVerified: string }>>({})
  const [viewTopicQuestionsDialogOpen, setViewTopicQuestionsDialogOpen] = useState(false)
  const [topicToView, setTopicToView] = useState<Topic | null>(null)
  const [lastImportResult, setLastImportResult] = useState<any>(null)

  const [viewTopicDialogOpen, setViewTopicDialogOpen] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [topicQuestions, setTopicQuestions] = useState<BankQuestion[]>([])
  const [loadingTopicQuestions, setLoadingTopicQuestions] = useState(false)
  const [questionToPreview, setQuestionToPreview] = useState<BankQuestion | null>(null)
  const [questionToEdit, setQuestionToEdit] = useState<BankQuestion | null>(null)
  
  // Deleted items management
  const [deletedQuestions, setDeletedQuestions] = useState<BankQuestion[]>([])
  const [activeTab, setActiveTab] = useState<"active" | "deleted">("active")
  const [selectedDeletedQuestions, setSelectedDeletedQuestions] = useState<Set<number>>(new Set())
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [refreshingCounts, setRefreshingCounts] = useState(false)
  const [questionToDeleteFromTopic, setQuestionToDeleteFromTopic] = useState<BankQuestion | null>(null)
  const [addingToQuiz, setAddingToQuiz] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [topicFilter, setTopicFilter] = useState<string>("all")
  const [showQuizSelector, setShowQuizSelector] = useState(false)
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false)
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>("")
  const [questionsToAdd, setQuestionsToAdd] = useState<Set<number>>(new Set())

  // AI Answer Verification
  const [verifyAnswersDialogOpen, setVerifyAnswersDialogOpen] = useState(false)
  const [topicToVerify, setTopicToVerify] = useState<Topic | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verificationResults, setVerificationResults] = useState<any[]>([])
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)

  useEffect(() => {
    console.log("[v0] QuestionBankManagement mounted")
    // Check for both admin and instructor authentication
    const adminId = sessionStorage.getItem("adminId")
    const instructorId = localStorage.getItem("instructorSession")
    
    console.log("[v0] Admin ID:", adminId, "Instructor ID:", instructorId)
    
    // Allow access if either admin or instructor is logged in
    if (!adminId && !instructorId) {
      console.log("[v0] No admin or instructor ID, redirecting to login")
      router.push(userType === "admin" ? "/admin/login" : "/instructor/login")
      return
    }

    fetchQuestions()
    fetchDeletedQuestions()
    fetchTopics()

    const storedResult = localStorage.getItem("lastImportResult")
    if (storedResult) {
      try {
        const result = JSON.parse(storedResult)
        // Only show if less than 1 hour old
        if (Date.now() - result.timestamp < 3600000) {
          setLastImportResult(result)
        } else {
          localStorage.removeItem("lastImportResult")
        }
      } catch (e) {
        console.error("Failed to parse last import result:", e)
      }
    }

    const handleImportComplete = () => {
      fetchQuestions()
      fetchTopics()
      const storedResult = localStorage.getItem("lastImportResult")
      if (storedResult) {
        try {
          setLastImportResult(JSON.parse(storedResult))
        } catch (e) {
          console.error("Failed to parse last import result:", e)
        }
      }
    }
    window.addEventListener("questionsImported", handleImportComplete)

    return () => {
      window.removeEventListener("questionsImported", handleImportComplete)
    }
  }, [router])

  useEffect(() => {
    applyFilters()
  }, [questions, searchTerm, typeFilter, difficultyFilter, topicFilter])

  const fetchQuestions = async () => {
    console.log("[v0] Fetching questions from question bank")
    try {
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank`)
      console.log("[v0] Question bank API response status:", response.status)
      const data = await response.json()
      console.log("[v0] Question bank data received:", data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch questions")
      }

      setQuestions(data.questions || [])
      setTopics(data.topics || [])
    } catch (error) {
      console.error("[v0] Failed to fetch questions:", error)
      toast({
        title: "Failed to load questions",
        description: error instanceof Error ? error.message : "An error occurred while loading the question bank.",
        variant: "destructive",
      })
      setQuestions([])
      setTopics([])
    } finally {
      setLoading(false)
    }
  }

  const fetchVerificationStats = async () => {
    try {
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/topics/verification-stats`)
      const data = await response.json()
      if (response.ok) {
        setVerificationStats(data.stats || {})
      }
    } catch (error) {
      console.error("[v0] Failed to fetch verification stats:", error)
      // Silently fail - stats are optional
    }
  }

  const fetchTopics = async () => {
    console.log("[v0] Fetching topics list...")
    try {
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/topics`)
      console.log("[v0] Topics API response status:", response.status)
      const data = await response.json()
      console.log("[v0] Topics data received:", data)

      if (!response.ok) {
        console.error("[v0] Topics API returned error:", data)
        throw new Error(data.error || "Failed to fetch topics")
      }

      console.log(`[v0] Successfully loaded ${data.topics?.length || 0} topics`)
      setTopicsList(data.topics || [])
      fetchVerificationStats() // Fetch stats after topics loaded
    } catch (error) {
      console.error("[v0] Failed to fetch topics:", error)
      toast({
        title: "Failed to load topics",
        description: error instanceof Error ? error.message : "An error occurred while loading topics.",
        variant: "destructive",
      })
    }
  }

  const fetchDeletedQuestions = async () => {
    console.log("[v0] Fetching deleted questions...")
    try {
      const headers = getSessionHeaders()
      delete headers["Content-Type"] // GET request doesn't need Content-Type
      
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/deleted`, {
        headers
      })
      console.log("[v0] Deleted questions API response status:", response.status)
      const data = await response.json()
      console.log("[v0] Deleted questions data received:", data)
      console.log("[v0] Number of deleted questions:", data.questions?.length || 0)

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch deleted questions")
      }

      setDeletedQuestions(data.questions || [])
      console.log("[v0] Deleted questions state updated:", data.questions?.length || 0)
    } catch (error) {
      console.error("[v0] Failed to fetch deleted questions:", error)
      toast({
        title: "Failed to load deleted questions",
        description: error instanceof Error ? error.message : "An error occurred while loading deleted questions.",
        variant: "destructive",
      })
      setDeletedQuestions([])
    }
  }

  const refreshAllData = async () => {
    console.log("[v0] Refreshing all data...")
    setRefreshingCounts(true)
    try {
      await Promise.all([
        fetchQuestions(),
        fetchDeletedQuestions(),
        fetchTopics()
      ])
      console.log("[v0] All data refreshed successfully")
    } catch (error) {
      console.error("[v0] Error refreshing data:", error)
    } finally {
      setRefreshingCounts(false)
    }
  }

  // Helper function to get session headers
  const getSessionHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    }
    
    if (userType === "instructor") {
      const instructorSession = localStorage.getItem("instructorSession")
      if (instructorSession) {
        try {
          const session = JSON.parse(instructorSession)
          headers["instructor-session"] = session.session || ""
        } catch (e) {
          console.error("[v0] Failed to parse instructor session:", e)
        }
      }
    } else if (userType === "admin") {
      const adminSession = sessionStorage.getItem("adminSession")
      if (adminSession) {
        headers["admin-session"] = adminSession
      }
    }
    
    return headers
  }

  const applyFilters = () => {
    let filtered = [...questions]

    if (searchTerm) {
      filtered = filtered.filter((q) => q.question_text.toLowerCase().includes(searchTerm.toLowerCase()))
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((q) => q.question_type === typeFilter)
    }

    if (difficultyFilter !== "all") {
      filtered = filtered.filter((q) => q.difficulty === difficultyFilter)
    }

    if (topicFilter !== "all") {
      filtered = filtered.filter((q) => q.topic === topicFilter)
    }

    setFilteredQuestions(filtered)
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
    if (selectedQuestions.size === filteredQuestions.length) {
      setSelectedQuestions(new Set())
    } else {
      setSelectedQuestions(new Set(filteredQuestions.map((q) => q.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedQuestions.size === 0) return

    setDeleting(true)
    try {
      const headers = getSessionHeaders()
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ ids: Array.from(selectedQuestions) }),
      })

      if (response.ok) {
      toast({
        title: "🗑️ Questions Moved to Trash",
        description: `${selectedQuestions.size} question(s) have been moved to trash and can be restored within 24 hours.`,
        action: (
          <button
            onClick={() => {
              // Switch to deleted tab to show the deleted items
              const deletedTab = document.querySelector('[data-value="deleted"]') as HTMLElement;
              if (deletedTab) {
                deletedTab.click();
              }
              fetchDeletedQuestions();
            }}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors duration-200"
          >
            View Trash
          </button>
        ),
        duration: 6000,
      })
      setSelectedQuestions(new Set())
      refreshAllData()
      
      // Switch to deleted tab after a short delay
      setTimeout(() => {
        const deletedTab = document.querySelector('[data-value="deleted"]') as HTMLElement;
        if (deletedTab) {
          deletedTab.click();
        }
      }, 100)
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
      setDeleteDialogOpen(false)
    }
  }

  const handleDeleteClick = (question: BankQuestion) => {
    setQuestionToDelete(question)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!questionToDelete) return

    setDeleting(true)
    try {
      const headers = getSessionHeaders()
      delete headers["Content-Type"] // DELETE request doesn't need Content-Type when no body
      
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/${questionToDelete.id}`, {
        method: "DELETE",
        headers
      })

      if (response.ok) {
      toast({
        title: "🗑️ Question Moved to Trash",
        description: "The question has been moved to trash and can be restored within 24 hours.",
        action: (
          <button
            onClick={() => {
              // Switch to deleted tab to show the deleted items
              const deletedTab = document.querySelector('[data-value="deleted"]') as HTMLElement;
              if (deletedTab) {
                deletedTab.click();
              }
              fetchDeletedQuestions();
            }}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors duration-200"
          >
            View Trash
          </button>
        ),
        duration: 6000,
      })
      refreshAllData()
      
      // Switch to deleted tab after a short delay
      setTimeout(() => {
        const deletedTab = document.querySelector('[data-value="deleted"]') as HTMLElement;
        if (deletedTab) {
          deletedTab.click();
        }
      }, 100)
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

  const handleDeleteTopic = async () => {
    if (!topicToDelete) return

    setDeleting(true)
    try {
      const headers = getSessionHeaders()
      delete headers["Content-Type"] // DELETE request doesn't need Content-Type when no body
      
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/topics/${encodeURIComponent(topicToDelete.name)}`, {
        method: "DELETE",
        headers
      })

      const data = await response.json()

      if (response.ok) {
        // Enhanced toast notification with action button
        toast({
          title: "🗑️ Topic Moved to Trash",
          description: `"${data.topicName}" and ${data.questionsDeleted} question(s) have been moved to trash and can be restored within 24 hours.`,
          action: (
            <button
              onClick={() => {
                // Switch to deleted tab to show the deleted items
                const deletedTab = document.querySelector('[data-value="deleted"]') as HTMLElement;
                if (deletedTab) {
                  deletedTab.click();
                }
                fetchDeletedQuestions();
              }}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors duration-200"
            >
              View Trash
            </button>
          ),
          duration: 8000,
        })
        
        // Refresh data and switch to deleted tab
        refreshAllData()
        
        // Switch to deleted tab after a short delay to allow state updates
        setTimeout(() => {
          const deletedTab = document.querySelector('[data-value="deleted"]') as HTMLElement;
          if (deletedTab) {
            deletedTab.click();
          }
        }, 100)
      } else {
        throw new Error(data.error || "Failed to delete topic")
      }
    } catch (error) {
      console.error("[v0] Failed to delete topic:", error)
      toast({
        title: "Failed to delete topic",
        description: error instanceof Error ? error.message : "An error occurred while deleting the topic.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteTopicDialogOpen(false)
      setTopicToDelete(null)
    }
  }

  const handleRestoreQuestions = async () => {
    if (selectedDeletedQuestions.size === 0) return

    setRestoring(true)
    try {
      const headers = getSessionHeaders()
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/deleted`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ ids: Array.from(selectedDeletedQuestions) }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "✨ Questions Restored Successfully",
          description: `${selectedDeletedQuestions.size} question(s) have been restored and are now available again.`,
          action: (
            <button
              onClick={() => {
                setActiveTab("active")
                fetchQuestions()
              }}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors duration-200"
            >
              View Active
            </button>
          ),
          duration: 6000,
        })
        setSelectedDeletedQuestions(new Set())
        refreshAllData()
      } else {
        throw new Error(data.error || "Failed to restore questions")
      }
    } catch (error) {
      console.error("[v0] Failed to restore questions:", error)
      toast({
        title: "Failed to restore questions",
        description: error instanceof Error ? error.message : "An error occurred while restoring questions.",
        variant: "destructive",
      })
    } finally {
      setRestoring(false)
      setRestoreDialogOpen(false)
    }
  }

  const handlePermanentDeleteQuestions = async () => {
    if (selectedDeletedQuestions.size === 0) return

    setDeleting(true)
    try {
      const headers = getSessionHeaders()
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/deleted`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ ids: Array.from(selectedDeletedQuestions) }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "💥 Questions Permanently Deleted",
          description: `${selectedDeletedQuestions.size} question(s) have been permanently removed from the system and cannot be recovered.`,
          variant: "destructive",
          duration: 5000,
        })
        setSelectedDeletedQuestions(new Set())
        fetchDeletedQuestions()
      } else {
        throw new Error(data.error || "Failed to permanently delete questions")
      }
    } catch (error) {
      console.error("[v0] Failed to permanently delete questions:", error)
      toast({
        title: "Failed to permanently delete questions",
        description: error instanceof Error ? error.message : "An error occurred while permanently deleting questions.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setPermanentDeleteDialogOpen(false)
    }
  }

  const handleVerifyTopicAnswers = async (topic: Topic) => {
    setTopicToVerify(topic)
    setVerifying(true)
    setVerificationResults([])
    setVerifyAnswersDialogOpen(true)

    try {
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/verify-answers`, {
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
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/apply-corrections`, {
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
        fetchQuestions() // Refresh the list
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

  const handleClearAll = async () => {
    setDeleting(true)
    try {
      const headers = getSessionHeaders()
      delete headers["Content-Type"] // DELETE request doesn't need Content-Type when no body
      
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/topics`, {
        method: "DELETE",
        headers
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "All cleared",
          description: "All topics and questions have been removed from the question bank.",
        })
        fetchQuestions()
        fetchTopics()
      } else {
        throw new Error(data.error || "Failed to clear all")
      }
    } catch (error) {
      console.error("[v0] Failed to clear all:", error)
      toast({
        title: "Failed to clear all",
        description: error instanceof Error ? error.message : "An error occurred while clearing the question bank.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setClearAllDialogOpen(false)
    }
  }

  const handleRenameTopic = async () => {
    if (!topicToRename || !newTopicName.trim()) return

    setRenaming(true)
    try {
      const headers = getSessionHeaders()
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/topics/${encodeURIComponent(topicToRename.name)}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: newTopicName.trim() }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Topic renamed",
          description: `Topic renamed to "${newTopicName.trim()}".`,
        })
        fetchQuestions()
        fetchTopics()
      } else {
        throw new Error(data.error || "Failed to rename topic")
      }
    } catch (error) {
      console.error("[v0] Failed to rename topic:", error)
      toast({
        title: "Failed to rename topic",
        description: error instanceof Error ? error.message : "An error occurred while renaming the topic.",
        variant: "destructive",
      })
    } finally {
      setRenaming(false)
      setRenameTopicDialogOpen(false)
      setTopicToRename(null)
      setNewTopicName("")
    }
  }

  const handleOpenTopic = async (topic: Topic) => {
    const basePath = userType === "admin" ? "/admin" : "/instructor"
    router.push(`${basePath}/question-bank/topics/${encodeURIComponent(topic.name)}`)
  }

  const handleDeleteQuestionFromTopic = async (questionId: number) => {
    setDeleting(true)
    try {
      const headers = getSessionHeaders()
      delete headers["Content-Type"] // DELETE request doesn't need Content-Type when no body
      
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/question-bank/${questionId}`, {
        method: "DELETE",
        headers
      })

      if (response.ok) {
        toast({
          title: "Question deleted",
          description: "The question has been removed from the bank.",
        })
        // Refresh the topic questions
        if (selectedTopic) {
          const updatedQuestions = topicQuestions.filter((q) => q.id !== questionId)
          setTopicQuestions(updatedQuestions)
          // Update the topic count
          setSelectedTopic({ ...selectedTopic, question_count: updatedQuestions.length })
        }
        fetchQuestions()
        fetchTopics()
      } else {
        throw new Error("Failed to delete question")
      }
    } catch (error) {
      console.error("Failed to delete question:", error)
      toast({
        title: "Failed to delete question",
        description: "An error occurred while deleting the question.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setQuestionToDeleteFromTopic(null)
    }
  }

  const handleAddToQuiz = async () => {
    if (!selectedQuizId || selectedQuestions.size === 0) return

    setAddingToQuiz(true)
    try {
      const response = await fetch(`${userType === "admin" ? "/api/admin" : "/api/instructor"}/quizzes/${selectedQuizId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: Array.from(selectedQuestions),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Questions added",
          description: `${selectedQuestions.size} question(s) have been added to the quiz.`,
        })
        setSelectedQuestions(new Set())
      } else {
        throw new Error(data.error || "Failed to add questions to quiz")
      }
    } catch (error) {
      console.error("[v0] Failed to add questions to quiz:", error)
      toast({
        title: "Failed to add questions",
        description: error instanceof Error ? error.message : "An error occurred while adding questions to the quiz.",
        variant: "destructive",
      })
    } finally {
      setAddingToQuiz(false)
    }
  }

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      true_false: "True/False",
      mcq: "Multiple Choice",
      select_all: "Select All",
      fill_blank: "Fill in Blank",
      scenario_match: "Scenario Match",
      code_output: "Code Output",
      trace_logic: "Trace Logic",
      trace_output: "Trace Output",
      multi_output: "Multi Output",
      fill_code: "Fill Code",
      code_reorder: "Code Reorder",
      code_problem: "Code Problem",
      code_debug: "Code Debug",
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

  console.log(
    "[v0] QuestionBankManagement render - loading:",
    loading,
    "questions:",
    questions.length,
    "topics:",
    topicsList.length,
  )

  if (loading) {
    console.log("[v0] Showing loading state")
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading question bank...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {lastImportResult && (
        <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <CardTitle className="text-lg">Last Import Result</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLastImportResult(null)
                  localStorage.removeItem("lastImportResult")
                }}
              >
                Dismiss
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Topic:</span> {lastImportResult.topic}
              </p>
              <p className="text-sm">
                <span className="font-medium">Time:</span> {new Date(lastImportResult.timestamp).toLocaleString()}
              </p>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="font-medium">✅ Imported:</span>
                  <span className="text-green-700 dark:text-green-300 font-semibold">{lastImportResult.imported}</span>
                </div>
                {lastImportResult.skipped > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">⏭️ Skipped:</span>
                    <span className="text-yellow-700 dark:text-yellow-300 font-semibold">
                      {lastImportResult.skipped}
                    </span>
                  </div>
                )}
                {lastImportResult.failed > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">❌ Failed:</span>
                    <span className="text-red-700 dark:text-red-300 font-semibold">{lastImportResult.failed}</span>
                  </div>
                )}
              </div>
              {lastImportResult.failed > 0 && lastImportResult.errors && lastImportResult.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="text-sm font-medium cursor-pointer hover:underline">
                    View error details ({lastImportResult.errors.length})
                  </summary>
                  <div className="mt-2 text-xs space-y-1 max-h-40 overflow-y-auto bg-white dark:bg-gray-900 p-2 rounded border">
                    {lastImportResult.errors.map((error: string, i: number) => (
                      <div key={i} className="text-red-600 dark:text-red-400">
                        {i + 1}. {error}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="questions" className="w-full">
        <div className="flex items-center justify-between mb-6">
          <TabsList className="bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm h-12">
            <TabsTrigger 
              value="questions" 
              className="rounded-xl px-6 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Questions
            </TabsTrigger>
            <TabsTrigger 
              value="topics"
              className="rounded-xl px-6 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Topics
            </TabsTrigger>
            <TabsTrigger 
              value="deleted"
              className="rounded-xl px-6 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-600 data-[state=active]:to-red-700 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Deleted Items ({refreshingCounts ? "..." : deletedQuestions.length})
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {quizzes.length > 0 && (
              <Button 
                variant="outline"
                size="sm" 
                onClick={() => setQuickAddModalOpen(true)}
                className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Quick Add to Quiz
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setClearAllDialogOpen(true)}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-xl transition-all"
            >
              <Trash className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>

        <TabsContent value="questions" className="space-y-5">
          {/* Stats Bar */}
          <div className="flex items-center justify-between bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-2xl px-5 py-3 shadow-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                <span className="text-sm font-semibold text-slate-700">{questions.length}</span>
                <span className="text-sm text-slate-500">Total</span>
              </div>
              <div className="w-px h-5 bg-slate-200"></div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-600"></div>
                <span className="text-sm font-semibold text-slate-700">{filteredQuestions.length}</span>
                <span className="text-sm text-slate-500">Showing</span>
              </div>
            </div>
            {selectedQuestions.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="text-sm font-medium text-blue-700">{selectedQuestions.size} selected</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedQuestions(new Set())}
                  className="h-7 px-2 hover:bg-blue-100 text-blue-600"
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          {/* Modern Filter Panel */}
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-200/60 px-6 py-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-800">Filter Questions</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search" className="text-sm font-medium text-slate-700">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="search"
                      placeholder="Search questions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-11 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-blue-200 bg-white"
                    />
                  </div>
                </div>

                {/* Question Type */}
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-sm font-medium text-slate-700">Question Type</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger id="type" className="h-11 border-slate-200 rounded-xl focus:border-blue-500 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="true_false">True/False</SelectItem>
                      <SelectItem value="mcq">Multiple Choice</SelectItem>
                      <SelectItem value="select_all">Select All</SelectItem>
                      <SelectItem value="fill_blank">Fill in Blank</SelectItem>
                      <SelectItem value="scenario_match">Scenario Match</SelectItem>
                      <SelectItem value="code_output">Code Output</SelectItem>
                      <SelectItem value="trace_logic">Trace Logic</SelectItem>
                      <SelectItem value="trace_output">Trace Output</SelectItem>
                      <SelectItem value="multi_output">Multi Output</SelectItem>
                      <SelectItem value="fill_code">Fill Code</SelectItem>
                      <SelectItem value="code_reorder">Code Reorder</SelectItem>
                      <SelectItem value="code_problem">Code Problem</SelectItem>
                      <SelectItem value="code_debug">Code Debug</SelectItem>
                      <SelectItem value="debug_code">Debug Code</SelectItem>
                      <SelectItem value="code_write">Code Write</SelectItem>
                      <SelectItem value="code_explain">Code Explain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Difficulty */}
                <div className="space-y-2">
                  <Label htmlFor="difficulty" className="text-sm font-medium text-slate-700">Difficulty</Label>
                  <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                    <SelectTrigger id="difficulty" className="h-11 border-slate-200 rounded-xl focus:border-blue-500 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Difficulties</SelectItem>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Topic */}
                <div className="space-y-2">
                  <Label htmlFor="topic" className="text-sm font-medium text-slate-700">Topic</Label>
                  <Select value={topicFilter} onValueChange={setTopicFilter}>
                    <SelectTrigger id="topic" className="h-11 border-slate-200 rounded-xl focus:border-blue-500 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Topics</SelectItem>
                      {topics.map((topic) => (
                        <SelectItem key={topic} value={topic}>
                          <span className="truncate block max-w-[200px]" title={topic}>
                            {topic}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {selectedQuestions.size > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl shadow-lg overflow-hidden">
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-600 shadow-sm">
                      <CheckSquare className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{selectedQuestions.size} Questions Selected</p>
                      <p className="text-sm text-slate-600">Choose an action to perform</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSelectedQuestions(new Set())}
                      className="border-slate-300 hover:bg-white rounded-lg"
                    >
                      Clear Selection
                    </Button>
                    {selectedQuizId && (
                      <Button
                        size="sm"
                        onClick={handleAddToQuiz}
                        disabled={addingToQuiz}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-md rounded-lg"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {addingToQuiz ? "Adding..." : "Add to Quiz"}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={deleting}
                      className="bg-red-600 hover:bg-red-700 shadow-md rounded-lg"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {filteredQuestions.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
                <div className="py-20 text-center">
                  <div className="relative inline-block mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mx-auto">
                      <CheckSquare className="h-10 w-10 text-blue-600" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Plus className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">
                    {questions.length === 0 ? "No Questions Yet" : "No Matches Found"}
                  </h3>
                  <p className="text-slate-600 mb-6 max-w-md mx-auto">
                    {questions.length === 0 
                      ? "Start building your question library by adding your first question" 
                      : "Try adjusting your filters to find what you're looking for"}
                  </p>
                  {questions.length === 0 && (
                    <Link href={`${userType === "admin" ? "/admin" : "/instructor"}/question-bank/new`}>
                      <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 h-12 px-6 rounded-xl">
                        <Plus className="h-5 w-5 mr-2" />
                        Add Your First Question
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedQuestions.size === filteredQuestions.length && filteredQuestions.length > 0}
                      onCheckedChange={handleSelectAll}
                      className="rounded-md"
                    />
                    <span className="text-sm font-medium text-slate-700">Select all visible questions</span>
                  </div>
                  <span className="text-sm text-slate-500">{filteredQuestions.length} questions</span>
                </div>

                {filteredQuestions.map((question) => (
                  <Card key={question.id} className="border border-slate-200/60 bg-white/80 backdrop-blur-sm hover:shadow-lg hover:border-blue-200 transition-all duration-200 rounded-xl group">
                    <CardHeader className="pb-4">
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={selectedQuestions.has(question.id)}
                          onCheckedChange={() => handleSelectQuestion(question.id)}
                          className="mt-1.5 rounded-md border-2 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base font-semibold text-slate-800 leading-relaxed mb-3 group-hover:text-blue-700 transition-colors">
                            {question.question_text}
                          </CardTitle>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 rounded-lg px-3 py-1">
                              {getQuestionTypeLabel(question.question_type)}
                            </Badge>
                            <Badge className={`${getDifficultyColor(question.difficulty)} text-white border-0 rounded-lg px-3 py-1`}>
                              {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                            </Badge>
                            {question.topic && (
                              <Badge className="bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1">
                                {question.topic}
                              </Badge>
                            )}
                            {question.hint && (
                              <Badge className="bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-1">
                                Has Hint
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-blue-50">
                            <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Options</p>
                            <p className="text-sm font-semibold text-slate-800">{question.options.length}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-green-50">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Correct</p>
                            <p className="text-sm font-semibold text-slate-800">
                              {typeof question.correct_answer === "string"
                                ? "1"
                                : Array.isArray(question.correct_answer)
                                  ? question.correct_answer.length
                                  : "0"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-purple-50">
                            <CheckSquare className="h-3.5 w-3.5 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Used In</p>
                            <p className="text-sm font-semibold text-slate-800">{question.quiz_usage_count} quizzes</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-slate-50">
                            <Plus className="h-3.5 w-3.5 text-slate-600" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Created</p>
                            <p className="text-sm font-semibold text-slate-800">{new Date(question.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex items-center justify-end border-t border-slate-100 bg-slate-50/50 pt-4 gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setPreviewQuestion(question)}
                        className="border-slate-200 hover:bg-white hover:border-blue-300 hover:text-blue-600 rounded-lg transition-all"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                      <Link href={`${userType === "admin" ? "/admin" : "/instructor"}/question-bank/${question.id}/edit`}>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-slate-200 hover:bg-white hover:border-green-300 hover:text-green-600 rounded-lg transition-all"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDeleteClick(question)}
                        className="border-slate-200 hover:bg-white hover:border-red-300 hover:text-red-600 rounded-lg transition-all"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="topics" className="space-y-5">
          {/* Stats Bar */}
          <div className="bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-xl px-5 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">{topicsList.length}</span>
              <span className="text-sm text-slate-500">Topics</span>
            </div>
          </div>

          <div className="space-y-4">
            {topicsList.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
                <div className="py-20 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-6">
                    <FolderOpen className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">No Topics Yet</h3>
                  <p className="text-slate-600 max-w-md mx-auto">
                    Topics are created automatically when you add or import questions with a topic name
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topicsList.map((topic) => (
                  <Card key={topic.id} className="border border-slate-200/60 bg-white/80 backdrop-blur-sm hover:shadow-lg hover:border-blue-200 transition-all duration-200 rounded-xl group relative overflow-hidden">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm group-hover:shadow-md transition-shadow">
                            <FolderOpen className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base font-semibold text-slate-800 truncate group-hover:text-blue-700 transition-colors">
                                {topic.name}
                              </CardTitle>
                              {verificationStats[topic.name] && (
                                <div className="relative group/badge">
                                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 rounded-full opacity-75 group-hover/badge:opacity-100 blur-sm animate-pulse"></div>
                                  <Badge className="relative bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-help text-xs px-2 py-0.5">
                                    <span className="flex items-center gap-1">
                                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                      AI Verified
                                    </span>
                                  </Badge>
                                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                                    {verificationStats[topic.name].verifiedCount} {verificationStats[topic.name].verifiedCount === 1 ? 'correction' : 'corrections'} verified
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-slate-900"></div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mt-0.5">
                              {topic.question_count} {topic.question_count === 1 ? "question" : "questions"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardFooter className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 pt-4">
                      <div className="flex items-center justify-between w-full text-xs text-slate-500">
                        <span>Created {new Date(topic.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="flex gap-2 w-full flex-wrap">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleOpenTopic(topic)}
                          className="flex-1 border-slate-200 hover:bg-white hover:border-blue-300 hover:text-blue-600 rounded-lg transition-all"
                        >
                          <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                          Open
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerifyTopicAnswers(topic)}
                          className="flex-1 border-slate-200 hover:bg-white hover:border-purple-300 hover:text-purple-600 rounded-lg transition-all"
                          title="Verify answers with AI"
                        >
                          <Brain className="h-3.5 w-3.5 mr-1.5" />
                          AI Verify
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTopicToRename(topic)
                            setNewTopicName(topic.name)
                            setRenameTopicDialogOpen(true)
                          }}
                          className="border-slate-200 hover:bg-white hover:border-green-300 hover:text-green-600 rounded-lg transition-all"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTopicToDelete(topic)
                            setDeleteTopicDialogOpen(true)
                          }}
                          className="border-slate-200 hover:bg-white hover:border-red-300 hover:text-red-600 rounded-lg transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="deleted" className="space-y-5">
          {/* Deleted Items Header */}
          <div className="bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-xl px-5 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-semibold text-slate-700">
                    {deletedQuestions.length} Deleted Questions
                  </span>
                </div>
                {deletedQuestions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedDeletedQuestions.size === deletedQuestions.length && deletedQuestions.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDeletedQuestions(new Set(deletedQuestions.map(q => q.id)))
                        } else {
                          setSelectedDeletedQuestions(new Set())
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-xs text-slate-600">Select All</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedDeletedQuestions.size > 0 && (
                  <>
                    <Button
                      onClick={() => setRestoreDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      className="border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300"
                      disabled={restoring}
                    >
                      {restoring ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-2" />
                      )}
                      Restore ({selectedDeletedQuestions.size})
                    </Button>
                    <Button
                      onClick={() => setPermanentDeleteDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                      disabled={deleting}
                    >
                      {deleting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete Forever ({selectedDeletedQuestions.size})
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {deletedQuestions.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Trash2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">No Deleted Questions</h3>
                <p className="text-slate-500">Deleted questions will appear here and can be restored within 24 hours.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {deletedQuestions.map((question) => (
                <Card key={question.id} className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-red-400">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedDeletedQuestions.has(question.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedDeletedQuestions)
                            if (e.target.checked) {
                              newSelected.add(question.id)
                            } else {
                              newSelected.delete(question.id)
                            }
                            setSelectedDeletedQuestions(newSelected)
                          }}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base font-semibold text-slate-800 leading-relaxed mb-3 group-hover:text-blue-700 transition-colors">
                            {question.question_text}
                          </CardTitle>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 rounded-lg px-3 py-1">
                              {getQuestionTypeLabel(question.question_type)}
                            </Badge>
                            <Badge 
                              className={`${getDifficultyColor(question.difficulty)} text-white border-0 rounded-lg px-3 py-1`}
                            >
                              {question.difficulty}
                            </Badge>
                            {question.topic && (
                              <Badge variant="outline" className="border-slate-200 text-slate-600 rounded-lg px-3 py-1">
                                {question.topic}
                              </Badge>
                            )}
                            <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-lg px-3 py-1">
                              Deleted {question.deleted_at && new Date(question.deleted_at).toLocaleDateString()}
                            </Badge>
                            {question.deleted_by && (
                              <Badge variant="outline" className="border-slate-200 text-slate-600 rounded-lg px-3 py-1">
                                by {question.deleted_by}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewQuestion(question)}
                          className="border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all rounded-lg"
                        >
                          <Eye className="h-4 w-4 mr-1.5" />
                          Preview
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        </Tabs>

      <Dialog open={!!previewQuestion} onOpenChange={() => setPreviewQuestion(null)}>
        <DialogContent className="max-w-3xl bg-gradient-to-br from-white to-slate-50/50 border-slate-200">
          <DialogHeader className="space-y-3 pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">Question Preview</DialogTitle>
                <DialogDescription className="text-slate-600">See how this question appears to students</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {previewQuestion && (
            <div className="space-y-5">
              <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 rounded-2xl">
                <QuestionTextRenderer text={previewQuestion.question_text} className="text-lg font-semibold text-slate-800 mb-6" />
                <div className="space-y-2">
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
                          className={`p-4 rounded-xl border-2 transition-all ${
                            isCorrect 
                              ? "border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 shadow-sm" 
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold ${
                              isCorrect ? "bg-green-600 text-white shadow-sm" : "bg-slate-100 text-slate-600"
                            }`}>
                              {String.fromCharCode(65 + index)}
                            </div>
                            <span className="flex-1 text-slate-700">{option}</span>
                            {isCorrect && (
                              <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 text-white border-0 shadow-sm">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Correct
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4">No options available</p>
                  )}
                </div>
                {previewQuestion.hint && (
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1 rounded bg-amber-500">
                        <AlertTriangle className="h-3.5 w-3.5 text-white" />
                      </div>
                      <p className="text-sm font-semibold text-amber-800">Hint Available</p>
                    </div>
                    <p className="text-sm text-amber-700">{previewQuestion.hint}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="pt-4">
            <Button 
              variant="outline" 
              onClick={() => setPreviewQuestion(null)}
              className="border-slate-200 hover:bg-slate-50 rounded-lg px-6"
            >
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gradient-to-br from-white to-red-50/20 border-red-200">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/25">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <AlertDialogTitle className="text-xl font-bold text-slate-800">Delete Question(s)</AlertDialogTitle>
                <p className="text-sm text-slate-600">This action cannot be undone</p>
              </div>
            </div>
            <AlertDialogDescription className="text-base leading-relaxed">
              {questionToDelete ? (
                <>
                  Are you sure you want to delete this question?
                  <br />
                  <br />
                  This will remove the question from the bank. Quizzes that already use this question will not be
                  affected.
                </>
              ) : (
                <>
                  Are you sure you want to delete {selectedQuestions.size} question(s)?
                  <br />
                  <br />
                  This will remove the questions from the bank. Quizzes that already use these questions will not be
                  affected.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel 
              disabled={deleting}
              className="border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={questionToDelete ? handleDeleteConfirm : handleBulkDelete}
              disabled={deleting}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg shadow-red-500/25 rounded-lg"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTopicDialogOpen} onOpenChange={setDeleteTopicDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">Delete Topic</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base leading-relaxed">
              {topicToDelete && (
                <>
                  Are you sure you want to delete the topic <strong>"{topicToDelete.name}"</strong>?
                  <br />
                  <br />
                  This will permanently delete <strong>{topicToDelete.question_count}</strong>{" "}
                  {topicToDelete.question_count === 1 ? "question" : "questions"} associated with this topic.
                  <br />
                  <br />
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTopic}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Topic"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">Clear All Topics and Questions</AlertDialogTitle>
            </div>
            <div className="space-y-3">
              <AlertDialogDescription className="text-base leading-relaxed">
                Are you sure you want to clear the entire question bank?
              </AlertDialogDescription>
              <div className="text-base text-muted-foreground">
                <p className="mb-2">This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>{topicsList.length}</strong> {topicsList.length === 1 ? "topic" : "topics"}
                  </li>
                  <li>
                    <strong>{questions.length}</strong> {questions.length === 1 ? "question" : "questions"}
                  </li>
                </ul>
                <p className="mt-3">This action cannot be undone.</p>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Clearing..." : "Clear All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={renameTopicDialogOpen} onOpenChange={setRenameTopicDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Topic</DialogTitle>
            <DialogDescription>Enter a new name for the topic "{topicToRename?.name}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-topic-name">New Topic Name</Label>
              <Input
                id="new-topic-name"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Enter new topic name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTopicDialogOpen(false)} disabled={renaming}>
              Cancel
            </Button>
            <Button onClick={handleRenameTopic} disabled={renaming || !newTopicName.trim()}>
              {renaming ? "Renaming..." : "Rename Topic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewTopicDialogOpen} onOpenChange={setViewTopicDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-accent" />
              {selectedTopic?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedTopic?.question_count} {selectedTopic?.question_count === 1 ? "question" : "questions"} in this
              topic
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {loadingTopicQuestions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Loading questions...</span>
              </div>
            ) : topicQuestions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No questions found in this topic.</div>
            ) : (
              topicQuestions.map((question, index) => (
                <Card key={question.id} className="border-2">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
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
                        <span className="font-medium">{question.options.length}</span> option
                        {question.options.length !== 1 ? "s" : ""}
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
                    <Button variant="outline" size="sm" onClick={() => setQuestionToPreview(question)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    <Link href={`/admin/question-bank/${question.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => setQuestionToDeleteFromTopic(question)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTopicDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!questionToPreview} onOpenChange={() => setQuestionToPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl font-semibold">Question Preview</DialogTitle>
            <DialogDescription className="text-base">
              See how this question appears to students
            </DialogDescription>
          </DialogHeader>
          {questionToPreview && (
            <div className="space-y-6">
              <div className="p-6 bg-secondary rounded-lg border">
                <div className="space-y-4">
                  <QuestionTextRenderer text={questionToPreview.question_text} className="text-base font-medium leading-relaxed" />
                  
                  <div className="space-y-3">
                    {questionToPreview.options && questionToPreview.options.length > 0 ? (
                      questionToPreview.options.map((option, index) => {
                        const isCorrect =
                          typeof questionToPreview.correct_answer === "string"
                            ? option === questionToPreview.correct_answer
                            : Array.isArray(questionToPreview.correct_answer)
                              ? questionToPreview.correct_answer.includes(option)
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
                {questionToPreview.hint && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border-2 border-yellow-500 rounded">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">Hint:</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">{questionToPreview.hint}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionToPreview(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!questionToDeleteFromTopic} onOpenChange={() => setQuestionToDeleteFromTopic(null)}>
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
              onClick={() => questionToDeleteFromTopic && handleDeleteQuestionFromTopic(questionToDeleteFromTopic.id)}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Add to Quiz Modal */}
      <Dialog open={quickAddModalOpen} onOpenChange={setQuickAddModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-gradient-to-br from-white to-blue-50/20 border-blue-200 flex flex-col">
          <DialogHeader className="space-y-3 pb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800">Quick Add Questions to Assessment</DialogTitle>
                <DialogDescription className="text-slate-600">Select an assessment and questions to add from the question bank</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            {/* Assessment Selection */}
            <div className="space-y-2 flex-shrink-0">
              <Label htmlFor="assessment-select" className="text-sm font-semibold text-slate-700">Select Assessment</Label>
              <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
                <SelectTrigger id="assessment-select" className="h-11 border-slate-200 rounded-xl focus:border-blue-500 bg-white">
                  <SelectValue placeholder="Choose an assessment..." />
                </SelectTrigger>
                <SelectContent>
                  {quizzes.map((quiz) => (
                    <SelectItem key={quiz.id} value={quiz.id.toString()}>
                      {quiz.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Questions Selection */}
            <div className="flex-1 flex flex-col space-y-3 min-h-0">
              <div className="flex items-center justify-between flex-shrink-0">
                <Label className="text-sm font-semibold text-slate-700">Select Questions to Add</Label>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setQuestionsToAdd(new Set(filteredQuestions.map(q => q.id)))}
                    className="border-slate-200 hover:bg-slate-50 rounded-lg"
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setQuestionsToAdd(new Set())}
                    className="border-slate-200 hover:bg-slate-50 rounded-lg"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50 min-h-0">
                {filteredQuestions.length === 0 ? (
                  <p className="text-center text-slate-500 py-4">No questions available</p>
                ) : (
                  filteredQuestions.map((question, index) => (
                    <div key={question.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                      <Checkbox
                        checked={questionsToAdd.has(question.id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(questionsToAdd)
                          if (checked) {
                            newSet.add(question.id)
                          } else {
                            newSet.delete(question.id)
                          }
                          setQuestionsToAdd(newSet)
                        }}
                        className="mt-1 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <Badge variant="outline">{question.question_type}</Badge>
                          <Badge className={question.difficulty === 'easy' ? 'bg-green-500' : question.difficulty === 'medium' ? 'bg-yellow-500' : 'bg-red-500'}>
                            {question.difficulty}
                          </Badge>
                        </div>
                        <div className="text-sm leading-relaxed break-words">
                          <QuestionTextRenderer text={question.question_text} className="text-sm leading-relaxed" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 gap-2 flex-shrink-0">
            <Button 
              variant="outline" 
              onClick={() => setQuickAddModalOpen(false)}
              className="border-slate-200 hover:bg-slate-50 rounded-lg px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedAssessmentId || questionsToAdd.size === 0) {
                  toast({
                    title: "Selection Required",
                    description: "Please select an assessment and at least one question.",
                    variant: "destructive",
                  })
                  return
                }

                setAddingToQuiz(true)
                try {
                  const promises = Array.from(questionsToAdd).map(questionId => 
                    fetch(`${getApiPrefix()}/quizzes/${selectedAssessmentId}/questions`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ question_id: questionId }),
                    })
                  )

                  const results = await Promise.all(promises)
                  const failed = results.filter(r => !r.ok)

                  if (failed.length === 0) {
                    toast({
                      title: "Questions Added Successfully",
                      description: `${questionsToAdd.size} question(s) have been added to the assessment.`,
                    })
                    setQuickAddModalOpen(false)
                    setSelectedAssessmentId("")
                    setQuestionsToAdd(new Set())
                  } else {
                    throw new Error(`${failed.length} questions failed to add`)
                  }
                } catch (error) {
                  console.error("[v0] Failed to add questions to assessment:", error)
                  toast({
                    title: "Error",
                    description: "Failed to add some questions to the assessment.",
                    variant: "destructive",
                  })
                } finally {
                  setAddingToQuiz(false)
                }
              }}
              disabled={addingToQuiz || !selectedAssessmentId || questionsToAdd.size === 0}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 rounded-lg px-6"
            >
              {addingToQuiz ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding Questions...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add {questionsToAdd.size} Question{questionsToAdd.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Questions Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-green-100">
                <RotateCcw className="h-5 w-5 text-green-600" />
              </div>
              <AlertDialogTitle className="text-lg font-semibold">Restore Questions</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              Are you sure you want to restore {selectedDeletedQuestions.size} question{selectedDeletedQuestions.size !== 1 ? 's' : ''}? 
              They will be moved back to the active question bank and available for use in quizzes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreQuestions}
              disabled={restoring}
              className="bg-green-600 hover:bg-green-700"
            >
              {restoring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore Questions
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Questions Dialog */}
      <AlertDialog open={permanentDeleteDialogOpen} onOpenChange={setPermanentDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-lg font-semibold">Permanently Delete Questions</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              <strong>Warning:</strong> This action cannot be undone. Are you sure you want to permanently delete {selectedDeletedQuestions.size} question{selectedDeletedQuestions.size !== 1 ? 's' : ''}? 
              They will be completely removed from the system and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDeleteQuestions}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Forever
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Answer Verification Dialog */}
      <Dialog open={verifyAnswersDialogOpen} onOpenChange={setVerifyAnswersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              AI Answer Verification
            </DialogTitle>
            <DialogDescription>
              {topicToVerify && `Verifying answers for "${topicToVerify.name}" using ChatGPT`}
            </DialogDescription>
          </DialogHeader>

          {verifying ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
              <p className="text-slate-600">Analyzing questions with AI...</p>
              <p className="text-sm text-slate-500">This may take a moment for large topics</p>
            </div>
          ) : (
            verificationResults.length > 0 && (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <p className="text-sm text-slate-600">
                  Verification complete. Review suggested changes below.
                </p>
              </div>
            )
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyAnswersDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Review AI Suggestions - {topicToVerify?.name}
            </DialogTitle>
            <DialogDescription>
              AI has found {verificationResults.filter(r => r.needsUpdate).length} potential answer corrections. Review and approve changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {verificationResults.filter(r => r.needsUpdate).map((result, index) => (
              <Card key={index} className="border-l-4 border-l-purple-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Question {result.questionOrder}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Question:</p>
                    <p className="text-sm">{result.questionText.substring(0, 150)}...</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400">Current Answer:</p>
                      <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-700">
                        <code className="text-sm">{JSON.stringify(result.currentAnswer)}</code>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400">Suggested Answer:</p>
                      <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-700">
                        <code className="text-sm">{JSON.stringify(result.suggestedAnswer)}</code>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                    <p className="text-xs text-purple-700 dark:text-purple-400 font-semibold mb-1">AI Reasoning:</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{result.reasoning}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setApprovalDialogOpen(false)
                setVerifyAnswersDialogOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveCorrections}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve & Apply Corrections
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
