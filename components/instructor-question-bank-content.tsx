"use client"

import { useState, useEffect, useMemo, Fragment, useCallback, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useFacultyQuestionBankQuery } from "@/hooks/data/use-faculty-question-bank-query"
import { ModuleListSkeleton, StaleRefreshHint } from "@/components/data/module-list-skeleton"
import {
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
  Brain,
  Bot,
  ImageIcon,
  ChevronRight,
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
import { QuestionBankPreviewPanel } from "@/components/question-bank-preview-panel"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyIntegratedToolbar, facultyToolbarFilterButtonClass, facultyToolbarSelectTriggerClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { ImportExportDialog } from "@/components/import-export-dialog"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"
import { difficultyBadgeClass } from "@/lib/question-bank-ui"
import { TopicBankCard } from "@/components/question-bank/topic-bank-card"
import { QuestionTypeBankCard } from "@/components/question-bank/question-type-bank-card"
import { formatQuestionTypeLabel } from "@/lib/question-bank-preview"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  AM_EMPTY,
  AM_TILE,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/assessments/assessment-management-surface-classes"
import {
  hasActiveQuestionMedia,
  isPublicMediaUrl,
  parseQuestionMedia,
} from "@/lib/question-media"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { INSTRUCTOR_V2_QUESTION_BANK_PATH } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import {
  buildQuestionBankListUrl,
  parseQuestionBankSearchParams,
  questionBankUiSnapshot,
  type QuestionBankMenu,
} from "@/lib/question-bank-navigation-state"
import { QuestionBankCreateTopicSheet } from "@/components/question-bank/question-bank-create-topic-sheet"
import { QuestionBankAddTypeSheet } from "@/components/question-bank/question-bank-add-type-sheet"

function instructorFetch(url: string, init?: RequestInit) {
  const scope = getInstructorScopeHeaders() as Record<string, string>
  const base =
    init?.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : ((init?.headers as Record<string, string> | undefined) ?? {})
  return fetch(url, { ...init, headers: { ...scope, ...base } })
}

const QB_MODULE_ID = "question-bank"

const QUESTIONS_PAGE_SIZE = 10

const QB_SELECT_TRIGGER = facultyToolbarSelectTriggerClass()

interface BankQuestion {
  id: number
  question_text: string
  question_type: string
  difficulty: string
  topic: string | null
  hint: string | null
  explanation?: string | null
  sample_answer?: string | null
  evaluation_mode?: string | null
  question_media?: unknown
  subquestions?: unknown
  option_count: number
  quiz_usage_count: number
  options: unknown
  correct_answer: unknown
  created_at: string
}

interface Topic {
  id: number
  name: string
  description: string | null
  question_count: number
  created_at: string
}

const QB_MENU_ITEMS = [
  { id: "all" as const, label: "All Questions", icon: Database },
  { id: "topics" as const, label: "Topics", icon: FolderOpen },
  { id: "types" as const, label: "Question Types", icon: Filter },
  { id: "deleted" as const, label: "Deleted Items", icon: Trash2 },
]

export function InstructorQuestionBankContent({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast()
  const chrome = facultyEmbedChrome(QB_MODULE_ID)
  const fp = chrome.p
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlUi = useMemo(() => parseQuestionBankSearchParams(searchParams), [searchParams])
  const isV2QuestionBank =
    embedded ||
    (pathname?.includes("/instructor/dashboard-v2") === true &&
      pathname?.includes("question-bank") === true)
  const bankBase = isV2QuestionBank ? INSTRUCTOR_V2_QUESTION_BANK_PATH : "/instructor/question-bank"

  const [activeMenu, setActiveMenu] = useState<QuestionBankMenu | string>(urlUi.menu)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(urlUi.topic)
  const [selectedType, setSelectedType] = useState<string | null>(urlUi.type)
  const bankQuery = useFacultyQuestionBankQuery()
  const [questions, setQuestions] = useState<BankQuestion[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [deletedQuestions, setDeletedQuestions] = useState<BankQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState(urlUi.search)
  const [typeFilter, setTypeFilter] = useState<string>(urlUi.typeFilter)
  const [difficultyFilter, setDifficultyFilter] = useState<string>(urlUi.difficultyFilter)
  const [viewMode, setViewMode] = useState<"grid" | "list">(urlUi.viewMode)
  const [topicBrowseFilter, setTopicBrowseFilter] = useState<"all" | "nonempty" | "empty">("all")
  const [typeBrowseSort, setTypeBrowseSort] = useState<"count-desc" | "count-asc" | "name">("count-desc")
  const [questionsPage, setQuestionsPage] = useState(urlUi.page)
  const [allQuestionsForTypes, setAllQuestionsForTypes] = useState<BankQuestion[]>([])
  const syncingToUrlRef = useRef(false)

  const buildListUrl = useCallback(
    (overrides: Partial<ReturnType<typeof questionBankUiSnapshot>> = {}) =>
      buildQuestionBankListUrl(
        bankBase,
        questionBankUiSnapshot({
          menu: (overrides.menu ?? activeMenu) as QuestionBankMenu,
          topic: overrides.topic !== undefined ? overrides.topic : selectedTopic,
          type: overrides.type !== undefined ? overrides.type : selectedType,
          page: overrides.page ?? questionsPage,
          search: overrides.search ?? searchTerm,
          typeFilter: overrides.typeFilter ?? typeFilter,
          difficultyFilter: overrides.difficultyFilter ?? difficultyFilter,
          viewMode: overrides.viewMode ?? viewMode,
        }),
      ),
    [
      bankBase,
      activeMenu,
      selectedTopic,
      selectedType,
      questionsPage,
      searchTerm,
      typeFilter,
      difficultyFilter,
      viewMode,
    ],
  )

  const questionEditHref = (id: number) => {
    const returnTo = buildListUrl()
    return `${bankBase}/${id}/edit?returnTo=${encodeURIComponent(returnTo)}`
  }

  const newQuestionHref = useCallback(() => {
    const params = new URLSearchParams()
    if (selectedTopic) params.set("topic", selectedTopic)
    if (selectedType) params.set("type", selectedType)
    const q = params.toString()
    return `${bankBase}/new${q ? `?${q}` : ""}`
  }, [bankBase, selectedTopic, selectedType])

  const questionTypes = Array.from(new Set(allQuestionsForTypes.map((q) => q.question_type))).sort()
  const questionTypesWithCounts = questionTypes
    .map((type) => ({
      name: type,
      count: allQuestionsForTypes.filter((q) => q.question_type === type).length,
    }))
    .sort((a, b) => b.count - a.count)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [questionToDelete, setQuestionToDelete] = useState<BankQuestion | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [previewQuestion, setPreviewQuestion] = useState<BankQuestion | null>(null)

  const [verifyAnswersDialogOpen, setVerifyAnswersDialogOpen] = useState(false)
  const [topicToVerify, setTopicToVerify] = useState<Topic | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verificationResults, setVerificationResults] = useState<any[]>([])
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [verificationStats, setVerificationStats] = useState<
    Record<string, { verifiedCount: number; lastVerified: string }>
  >({})

  const [editTopicDialogOpen, setEditTopicDialogOpen] = useState(false)
  const [topicToEdit, setTopicToEdit] = useState<Topic | null>(null)
  const [newTopicName, setNewTopicName] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [createTopicOpen, setCreateTopicOpen] = useState(false)
  const [addTypeOpen, setAddTypeOpen] = useState(false)

  const openPreview = async (question: BankQuestion) => {
    if (!(question as { _partial?: boolean })._partial) {
      setPreviewQuestion(question)
      return
    }
    try {
      const response = await instructorFetch(`/api/instructor/question-bank/${question.id}`)
      const data = await response.json()
      setPreviewQuestion((data.question as BankQuestion) || question)
    } catch {
      setPreviewQuestion(question)
    }
  }

  useEffect(() => {
    if (bankQuery.questions.length > 0) {
      setAllQuestionsForTypes(bankQuery.questions as BankQuestion[])
      if (activeMenu === "all" && !selectedTopic && !selectedType) {
        setQuestions(bankQuery.questions as BankQuestion[])
      }
      setLoading(false)
    }
    if (bankQuery.topics.length > 0) {
      setTopics(bankQuery.topics as Topic[])
    }
    if (activeMenu === "deleted" && bankQuery.deleted.length > 0) {
      setDeletedQuestions(bankQuery.deleted as BankQuestion[])
    }
  }, [bankQuery.questions, bankQuery.topics, bankQuery.deleted, activeMenu, selectedTopic, selectedType])

  const fetchData = async () => {
    if (questions.length === 0) setLoading(true)
    try {
      await Promise.all([fetchAllQuestions(), fetchTopics(), fetchDeletedQuestions()])
    } finally {
      setLoading(false)
    }
  }

  const fetchAllQuestions = async () => {
    try {
      if (questions.length === 0) setLoading(true)
      const response = await instructorFetch("/api/instructor/question-bank")
      const data = await response.json()
      if (response.ok) {
        const fetchedQuestions = data.questions || []
        setQuestions(fetchedQuestions)
        setAllQuestionsForTypes(fetchedQuestions)
      } else {
        toast({ title: "Failed to load questions", description: data.error, variant: "destructive" })
        setQuestions([])
        setAllQuestionsForTypes([])
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load questions", variant: "destructive" })
      setQuestions([])
      setAllQuestionsForTypes([])
    } finally {
      setLoading(false)
    }
  }

  const fetchQuestionsForTopic = async (topicName: string) => {
    try {
      const response = await instructorFetch(`/api/instructor/question-bank?topic=${encodeURIComponent(topicName)}`)
      const data = await response.json()
      if (response.ok) setQuestions(data.questions || [])
      else toast({ title: "Failed to load questions", description: data.error, variant: "destructive" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to load questions for this topic", variant: "destructive" })
    }
  }

  const fetchQuestionsForType = async (questionType: string) => {
    try {
      const response = await instructorFetch(`/api/instructor/question-bank?type=${encodeURIComponent(questionType)}`)
      const data = await response.json()
      if (response.ok) setQuestions(data.questions || [])
      else toast({ title: "Failed to load questions", description: data.error, variant: "destructive" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to load questions for this type", variant: "destructive" })
    }
  }

  const fetchTopics = async () => {
    try {
      const response = await instructorFetch("/api/instructor/question-bank/topics")
      const data = await response.json()
      if (response.ok) {
        setTopics(data.topics || [])
        fetchVerificationStats()
      }
    } catch (error) {
      console.error("Failed to fetch topics:", error)
    }
  }

  const fetchVerificationStats = async () => {
    try {
      const response = await instructorFetch("/api/instructor/question-bank/topics/verification-stats")
      const data = await response.json()
      if (response.ok) setVerificationStats(data.stats || {})
    } catch (error) {
      // Silently fail
    }
  }

  const getInstructorHeaders = () => {
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
    return headers
  }

  const fetchDeletedQuestions = async () => {
    try {
      const response = await instructorFetch("/api/instructor/question-bank/deleted")
      const data = await response.json()
      if (response.ok) setDeletedQuestions(data.questions || [])
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
    if (allQuestionsForTypes.length === 0) {
      setLoadingTypes(true)
      try {
        const response = await instructorFetch("/api/instructor/question-bank")
        const data = await response.json()
        if (response.ok) setAllQuestionsForTypes(data.questions || [])
        else setAllQuestionsForTypes([])
      } catch (error) {
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
      const response = await instructorFetch(`/api/instructor/question-bank/${questionToDelete.id}`, {
        method: "DELETE",
      })
      if (response.ok) {
        toast({ title: "Question moved to trash", description: "You can restore it later.", duration: 6000 })
        fetchData()
      } else throw new Error("Failed to delete")
    } catch (error) {
      toast({ title: "Failed to delete question", variant: "destructive" })
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
      const response = await instructorFetch("/api/instructor/question-bank/deleted", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedQuestions) }),
      })
      if (response.ok) {
        toast({ title: "Questions restored", description: `${selectedQuestions.size} question(s) restored.` })
        setSelectedQuestions(new Set())
        fetchData()
      } else throw new Error("Failed to restore")
    } catch (error) {
      toast({ title: "Failed to restore", variant: "destructive" })
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
      const response = await instructorFetch("/api/instructor/question-bank/verify-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicName: topic.name }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        setVerificationResults(data.results || [])
        const suggestedChanges = data.results.filter((r: any) => r.needsUpdate)
        if (suggestedChanges.length === 0) {
          toast({ title: "All answers verified", description: "No corrections needed.", duration: 6000 })
          setVerifyAnswersDialogOpen(false)
        } else setApprovalDialogOpen(true)
      } else throw new Error(data.error || "Verification failed")
    } catch (error) {
      toast({ title: "Verification failed", description: error instanceof Error ? error.message : "Failed", variant: "destructive" })
      setVerifyAnswersDialogOpen(false)
    } finally {
      setVerifying(false)
    }
  }

  const handleApproveCorrections = async () => {
    if (!topicToVerify) return
    const correctionsToApply = verificationResults.filter((r: any) => r.needsUpdate)
    try {
      const response = await instructorFetch("/api/instructor/question-bank/apply-corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corrections: correctionsToApply }),
      })
      const data = await response.json()
      if (response.ok && data.success) {
        toast({ title: "Corrections applied", description: `${data.updated || 0} question(s) updated.`, duration: 6000 })
        setApprovalDialogOpen(false)
        setVerifyAnswersDialogOpen(false)
        fetchAllQuestions()
        fetchTopics()
        fetchVerificationStats()
      } else throw new Error(data.error || "Failed to apply")
    } catch (error) {
      toast({ title: "Update failed", variant: "destructive" })
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
      const response = await instructorFetch(
        `/api/instructor/question-bank/topics/${encodeURIComponent(topicToEdit.name)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newTopicName.trim() }),
        }
      )
      const data = await response.json()
      if (response.ok && data.success) {
        toast({ title: "Topic renamed", description: `${data.questionsUpdated || 0} question(s) updated.` })
        setEditTopicDialogOpen(false)
        setTopicToEdit(null)
        setNewTopicName("")
        fetchTopics()
        if (selectedTopic === topicToEdit.name) {
          setSelectedTopic(newTopicName.trim())
          fetchQuestionsForTopic(newTopicName.trim())
        }
      } else throw new Error(data.error || "Failed to rename")
    } catch (error) {
      toast({ title: "Rename failed", variant: "destructive" })
    } finally {
      setRenaming(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (selectedQuestions.size === 0) return
    setDeleting(true)
    try {
      const response = await instructorFetch("/api/instructor/question-bank/deleted", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedQuestions) }),
      })
      if (response.ok) {
        toast({ title: "Questions permanently deleted", variant: "destructive" })
        setSelectedQuestions(new Set())
        fetchDeletedQuestions()
      } else throw new Error("Failed to delete")
    } catch (error) {
      toast({ title: "Failed to delete", variant: "destructive" })
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
    return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const getQuestionTypeCount = (type: string) =>
    allQuestionsForTypes.filter((q) => q.question_type === type).length

  const bankStats = useMemo(
    () => ({
      total: questions.length,
      topics: topics.length,
      types: questionTypes.length,
      deleted: deletedQuestions.length,
    }),
    [questions.length, topics.length, questionTypes.length, deletedQuestions.length],
  )

  useEffect(() => {
    fetchData()
    const onScope = () => {
      setActiveMenu("all")
      setSelectedTopic(null)
      setSelectedType(null)
      setSelectedQuestions(new Set())
      setSearchTerm("")
      setTypeFilter("all")
      setDifficultyFilter("all")
      setQuestionsPage(1)
      router.replace(bankBase, { scroll: false })
      fetchData()
    }
    window.addEventListener("instructor-course-scope-changed", onScope)
    return () => window.removeEventListener("instructor-course-scope-changed", onScope)
  }, [bankBase, router])

  useEffect(() => {
    const nextUrl = buildListUrl()
    const nextSearch = nextUrl.includes("?") ? nextUrl.split("?")[1]! : ""
    const currentSearch = searchParams.toString()
    if (nextSearch !== currentSearch) {
      syncingToUrlRef.current = true
      router.replace(nextUrl, { scroll: false })
    }
  }, [buildListUrl, router, searchParams])

  useEffect(() => {
    if (syncingToUrlRef.current) {
      syncingToUrlRef.current = false
      return
    }
    setActiveMenu(urlUi.menu)
    setSelectedTopic(urlUi.topic)
    setSelectedType(urlUi.type)
    setQuestionsPage(urlUi.page)
    setSearchTerm(urlUi.search)
    setTypeFilter(urlUi.typeFilter)
    setDifficultyFilter(urlUi.difficultyFilter)
    setViewMode(urlUi.viewMode)
  }, [urlUi])

  useEffect(() => {
    if (activeMenu === "all" && !selectedTopic && !selectedType) fetchAllQuestions()
    else if (activeMenu === "topics" && !selectedTopic) fetchTopics()
    else if (activeMenu === "types" && !selectedType && allQuestionsForTypes.length === 0) {
      setLoadingTypes(true)
      instructorFetch("/api/instructor/question-bank")
        .then((r) => r.json())
        .then((data) => {
          if (data.questions) setAllQuestionsForTypes(data.questions)
        })
        .finally(() => setLoadingTypes(false))
    } else if (activeMenu === "deleted") fetchDeletedQuestions()
  }, [activeMenu, selectedTopic, selectedType])

  useEffect(() => {
    if (activeMenu === "topics" && selectedTopic) fetchQuestionsForTopic(selectedTopic)
  }, [selectedTopic])

  useEffect(() => {
    if (activeMenu === "types" && selectedType) fetchQuestionsForType(selectedType)
  }, [selectedType])

  const filteredQuestions = (activeMenu === "deleted" ? deletedQuestions : questions).filter((q) => {
    if (activeMenu === "topics" && selectedTopic && q.topic !== selectedTopic) return false
    if (activeMenu === "types" && selectedType && q.question_type !== selectedType) return false
    if (searchTerm && !q.question_text.toLowerCase().includes(searchTerm.toLowerCase())) return false
    if (activeMenu !== "types" && typeFilter !== "all" && q.question_type !== typeFilter) return false
    if (difficultyFilter !== "all" && q.difficulty !== difficultyFilter) return false
    return true
  })

  const totalQuestionsPages = Math.max(1, Math.ceil(filteredQuestions.length / QUESTIONS_PAGE_SIZE))
  const safeQuestionsPage = Math.min(Math.max(1, questionsPage), totalQuestionsPages)
  const paginatedQuestions = useMemo(() => {
    const start = (safeQuestionsPage - 1) * QUESTIONS_PAGE_SIZE
    return filteredQuestions.slice(start, start + QUESTIONS_PAGE_SIZE)
  }, [filteredQuestions, safeQuestionsPage])

  useEffect(() => {
    setQuestionsPage(1)
  }, [searchTerm, typeFilter, difficultyFilter, activeMenu, selectedTopic, selectedType, topicBrowseFilter])

  const showTopicBrowse = activeMenu === "topics" && !selectedTopic
  const showTypesBrowse = activeMenu === "types" && !selectedType
  const showQuestionFilters =
    activeMenu === "all" ||
    activeMenu === "deleted" ||
    Boolean(selectedTopic) ||
    Boolean(selectedType)
  const showTopicViewToggle = showTopicBrowse
  const showKpiHub = activeMenu !== "deleted" && !selectedTopic && !selectedType
  const showBrowseSearch = showTopicBrowse || showTypesBrowse

  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase())) return false
      if (topicBrowseFilter === "nonempty" && t.question_count <= 0) return false
      if (topicBrowseFilter === "empty" && t.question_count > 0) return false
      return true
    })
  }, [topics, searchTerm, topicBrowseFilter])

  const filteredTypesBrowse = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const list = questionTypes.filter((type) => {
      if (!term) return true
      const label = getQuestionTypeLabel(type).toLowerCase()
      return label.includes(term) || type.toLowerCase().includes(term)
    })
    return [...list].sort((a, b) => {
      if (typeBrowseSort === "name") {
        return getQuestionTypeLabel(a).localeCompare(getQuestionTypeLabel(b))
      }
      const ca = getQuestionTypeCount(a)
      const cb = getQuestionTypeCount(b)
      return typeBrowseSort === "count-asc" ? ca - cb : cb - ca
    })
  }, [questionTypes, searchTerm, typeBrowseSort, allQuestionsForTypes])

  if (loading && questions.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="w-full text-left">
          <ModuleListSkeleton rows={8} />
          <p className={cn("mt-4 text-sm", PORTAL_TEXT_MUTED)}>Loading question bank…</p>
        </div>
      </div>
    )
  }

  const toolbarTrailing = (
    <>
      <ImportExportDialog
        userType="instructor"
        triggerClassName={facultyToolbarFilterButtonClass()}
        triggerSize="sm"
      />
      {showTopicBrowse ? (
        <Button
          type="button"
          size="sm"
          className={cn("h-9 shrink-0 gap-1.5", fp.cta)}
          onClick={() => setCreateTopicOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Add topic</span>
        </Button>
      ) : showTypesBrowse ? (
        <Button
          type="button"
          size="sm"
          className={cn("h-9 shrink-0 gap-1.5", fp.cta)}
          onClick={() => setAddTypeOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Add type</span>
        </Button>
      ) : activeMenu !== "deleted" ? (
        <Button asChild size="sm" className={cn("h-9 shrink-0 gap-1.5", fp.cta)}>
          <Link href={newQuestionHref()}>
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Add question</span>
          </Link>
        </Button>
      ) : null}
    </>
  )

  const toolbarSearchPlaceholder = showTopicBrowse
    ? "Search topics…"
    : showTypesBrowse
      ? "Search types…"
      : "Search questions…"

  const toolbarMeta = (() => {
    if (selectedTopic || selectedType) {
      const count = filteredQuestions.length
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedTopic(null)
              setSelectedType(null)
            }}
            className="inline-flex items-center gap-1 text-xs text-[var(--cc-accent)] hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to {activeMenu === "topics" ? "topics" : "types"}
          </button>
          <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {selectedTopic ?? getQuestionTypeLabel(selectedType!)}
            {" · "}
            {count} question{count === 1 ? "" : "s"}
          </span>
        </div>
      )
    }
    if (activeMenu === "deleted") {
      return (
        <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          {bankStats.deleted} in trash
          {filteredQuestions.length !== bankStats.deleted
            ? ` · ${filteredQuestions.length} shown`
            : ""}
        </span>
      )
    }
    if (showTopicBrowse) {
      return (
        <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          {filteredTopics.length === topics.length
            ? `${filteredTopics.length} ${filteredTopics.length === 1 ? "topic" : "topics"}`
            : `${filteredTopics.length} of ${topics.length} topics`}
        </span>
      )
    }
    if (showTypesBrowse) {
      return (
        <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          {filteredTypesBrowse.length === questionTypes.length
            ? `${filteredTypesBrowse.length} ${filteredTypesBrowse.length === 1 ? "type" : "types"}`
            : `${filteredTypesBrowse.length} of ${questionTypes.length} types`}
        </span>
      )
    }
    const count = filteredQuestions.length
    return (
      <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
        {count === questions.length
          ? `${count} question${count === 1 ? "" : "s"}`
          : `${count} of ${questions.length} shown`}
      </span>
    )
  })()

  const navigateBankMenu = (menu: QuestionBankMenu) => {
    if (menu === "topics") handleTopicsMenuClick()
    else if (menu === "types") handleTypesMenuClick()
    else if (menu === "deleted") {
      setActiveMenu("deleted")
      setSelectedTopic(null)
      setSelectedType(null)
      fetchDeletedQuestions()
    } else {
      setActiveMenu("all")
      setSelectedTopic(null)
      setSelectedType(null)
      fetchAllQuestions()
    }
  }

  const sidebar = (
    <FacultyModuleSideMenu
      moduleId="question-bank"
      title="Question Bank"
      activeId={String(activeMenu)}
      onSelect={(id) => {
        if (id === "all") {
          setActiveMenu("all")
          setSelectedTopic(null)
          setSelectedType(null)
          fetchAllQuestions()
        } else if (id === "topics") handleTopicsMenuClick()
        else if (id === "types") handleTypesMenuClick()
        else if (id === "deleted") {
          setActiveMenu("deleted")
          setSelectedTopic(null)
          setSelectedType(null)
          fetchDeletedQuestions()
        }
      }}
      items={QB_MENU_ITEMS.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        tone: item.id === "deleted" ? ("destructive" as const) : undefined,
      }))}
    />
  )

  const mainContent = (
    <div className="min-w-0 flex-1 space-y-3 overflow-x-hidden">
      <FacultyIntegratedToolbar
        moduleId={QB_MODULE_ID}
        search={showBrowseSearch || showQuestionFilters ? searchTerm : undefined}
        onSearchChange={showBrowseSearch || showQuestionFilters ? setSearchTerm : undefined}
        onSearchClear={
          showBrowseSearch || showQuestionFilters ? () => setSearchTerm("") : undefined
        }
        searchPlaceholder={toolbarSearchPlaceholder}
        filters={
          showTopicBrowse ? (
            <Select value={topicBrowseFilter} onValueChange={(v) => setTopicBrowseFilter(v as typeof topicBrowseFilter)}>
              <SelectTrigger className={QB_SELECT_TRIGGER}>
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All topics</SelectItem>
                <SelectItem value="nonempty">Has questions</SelectItem>
                <SelectItem value="empty">Empty</SelectItem>
              </SelectContent>
            </Select>
          ) : showTypesBrowse ? (
            <Select value={typeBrowseSort} onValueChange={(v) => setTypeBrowseSort(v as typeof typeBrowseSort)}>
              <SelectTrigger className={QB_SELECT_TRIGGER}>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count-desc">Most questions</SelectItem>
                <SelectItem value="count-asc">Fewest questions</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
              </SelectContent>
            </Select>
          ) : showQuestionFilters ? (
            <>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className={QB_SELECT_TRIGGER}>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {questionTypesWithCounts.map((type) => (
                    <SelectItem key={type.name} value={type.name}>
                      {getQuestionTypeLabel(type.name)} ({type.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger className={QB_SELECT_TRIGGER}>
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All difficulties</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </>
          ) : undefined
        }
        viewMode={showTopicViewToggle ? viewMode : undefined}
        onViewModeChange={showTopicViewToggle ? setViewMode : undefined}
        meta={toolbarMeta}
        trailing={toolbarTrailing}
      />

      {showKpiHub ? (
        <div className={cn(AM_TILE, "overflow-hidden p-0")}>
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-200/70 dark:divide-white/[0.08] sm:grid-cols-4 sm:divide-y-0">
            {[
              { label: "Questions", value: bankStats.total, menu: "all" as const, icon: Database },
              { label: "Topics", value: bankStats.topics, menu: "topics" as const, icon: FolderOpen },
              { label: "Types", value: bankStats.types, menu: "types" as const, icon: Filter },
              { label: "Deleted", value: bankStats.deleted, menu: "deleted" as const, icon: Trash2 },
            ].map(({ label, value, menu, icon: Icon }) => (
              <button
                key={menu}
                type="button"
                onClick={() => navigateBankMenu(menu)}
                className={cn(
                  "flex flex-col gap-1 px-4 py-3 text-left transition-colors sm:py-4",
                  activeMenu === menu
                    ? "bg-[var(--cc-accent-soft)]/55"
                    : "hover:bg-[var(--cc-accent-soft)]/45",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-[var(--cc-accent)]" />
                  <p className={cn("text-[11px] font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                    {label}
                  </p>
                </div>
                <p className={cn("text-xl font-semibold tabular-nums sm:text-2xl", PORTAL_TEXT)}>{value}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Deleted actions bar */}
      {activeMenu === "deleted" && selectedQuestions.size > 0 && (
        <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-3">
            <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">{selectedQuestions.size} question(s) selected</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setRestoreDialogOpen(true)} disabled={restoring}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setPermanentDeleteDialogOpen(true)} disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content areas */}
      {activeMenu === "topics" && !selectedTopic ? (
        <div className="space-y-3">
          {topics.length === 0 ? (
            <div className={AM_EMPTY}>
              <FolderOpen className="mx-auto mb-2 h-8 w-8 opacity-40 text-[var(--cc-text-muted)]" />
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No topics yet</p>
            </div>
          ) : filteredTopics.length === 0 ? (
            <div className={AM_EMPTY}>
              <Search className="mx-auto mb-2 h-8 w-8 opacity-40 text-[var(--cc-text-muted)]" />
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No topics match your search</p>
            </div>
          ) : (
            <div
              className={cn(
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
                  : "flex flex-col gap-2",
              )}
            >
              {filteredTopics.map((topic) => (
                <TopicBankCard
                  key={topic.id}
                  topic={topic}
                  viewMode={viewMode}
                  verifiedCount={verificationStats[topic.name]?.verifiedCount}
                  onView={() => handleTopicClick(topic.name)}
                  onVerify={() => handleVerifyTopicAnswers(topic)}
                  onEdit={() => handleEditTopic(topic)}
                />
              ))}
            </div>
          )}
        </div>
      ) : activeMenu === "types" && !selectedType ? (
        <div className="space-y-3">
          {loadingTypes ? (
            <div className={cn(AM_EMPTY, "py-10")}>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--cc-accent)]" />
              <p className={cn("mt-2 text-sm", PORTAL_TEXT_MUTED)}>Loading…</p>
            </div>
          ) : questionTypes.length === 0 ? (
            <div className={AM_EMPTY}>
              <Filter className="mx-auto mb-2 h-8 w-8 opacity-40 text-[var(--cc-text-muted)]" />
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No question types yet</p>
            </div>
          ) : filteredTypesBrowse.length === 0 ? (
            <div className={AM_EMPTY}>
              <Search className="mx-auto mb-2 h-8 w-8 opacity-40 text-[var(--cc-text-muted)]" />
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No types match your search</p>
            </div>
          ) : (
            <div className="grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2">
              {filteredTypesBrowse.map((type) => (
                <QuestionTypeBankCard
                  key={type}
                  typeId={type}
                  label={getQuestionTypeLabel(type)}
                  count={getQuestionTypeCount(type)}
                  onView={() => handleTypeClick(type)}
                />
              ))}
            </div>
          )}
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className={AM_EMPTY}>
          <AlertCircle className="mx-auto mb-3 h-10 w-10 opacity-40 text-[var(--cc-text-muted)]" />
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              {activeMenu === "deleted"
                ? "No deleted questions"
                : activeMenu === "topics" && selectedTopic
                  ? `No questions in "${selectedTopic}"`
                  : activeMenu === "types" && selectedType
                    ? `No questions of type "${getQuestionTypeLabel(selectedType)}"`
                    : "No questions found"}
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-2 sm:space-y-3">
            {paginatedQuestions.map((question, index) => {
              const media = parseQuestionMedia(question.question_media)
              const hasMedia = hasActiveQuestionMedia(media)
              const thumbUrl =
                hasMedia && media.media_url && isPublicMediaUrl(media.media_url.trim())
                  ? media.media_url.trim()
                  : null
              const listIndex = (safeQuestionsPage - 1) * QUESTIONS_PAGE_SIZE + index + 1

              return (
                <article
                  key={question.id}
                  className={cn(
                    AM_TILE,
                    "group overflow-hidden transition-colors hover:border-[var(--cc-accent)]/30 hover:bg-[var(--cc-accent-soft)]/45",
                  )}
                >
                  <div className="flex flex-col sm:flex-row gap-0 sm:gap-4 p-3 sm:p-4">
                    {thumbUrl && media.media_type !== "pdf" ? (
                      <div className="shrink-0 w-full sm:w-28 h-28 sm:h-24 rounded-lg border border-slate-200/80 dark:border-slate-600 overflow-hidden bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbUrl}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : hasMedia ? (
                      <div className="shrink-0 w-full sm:w-28 h-16 sm:h-24 rounded-lg border border-dashed border-[var(--cc-accent)]/30 bg-[var(--sidebar-accent)]/30 flex flex-col items-center justify-center gap-1 text-[var(--cc-accent)]">
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-[10px] font-medium uppercase tracking-wide">
                          {media.media_type === "pdf" ? "PDF" : "Media"}
                        </span>
                      </div>
                    ) : null}

                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">#{listIndex}</span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          {formatQuestionTypeLabel(question.question_type)}
                        </span>
                        <span className={difficultyBadgeClass(question.difficulty)}>
                          {question.difficulty}
                        </span>
                        {question.topic ? (
                          <Badge variant="outline" className="text-[10px] h-5 font-normal truncate max-w-[10rem]">
                            {question.topic}
                          </Badge>
                        ) : null}
                        {hasMedia ? (
                          <Badge
                            variant="secondary"
                            className="h-5 gap-0.5 bg-[var(--sidebar-accent)]/50 text-[10px] text-[var(--cc-accent-dark)]"
                          >
                            <ImageIcon className="h-3 w-3" />
                            Diagram
                          </Badge>
                        ) : null}
                      </div>

                      <QuestionTextRenderer
                        text={question.question_text}
                        className="text-sm leading-relaxed text-slate-800 dark:text-slate-100 line-clamp-2 sm:line-clamp-3"
                      />

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 border-t border-slate-100 dark:border-white/[0.06] mt-auto">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          ID {question.id} · {question.quiz_usage_count}{" "}
                          {question.quiz_usage_count === 1 ? "quiz" : "quizzes"} ·{" "}
                          {new Date(question.created_at).toLocaleDateString()}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeMenu === "deleted" && (
                            <Checkbox
                              checked={selectedQuestions.has(question.id)}
                              onCheckedChange={() => {
                                const next = new Set(selectedQuestions)
                                if (next.has(question.id)) next.delete(question.id)
                                else next.add(question.id)
                                setSelectedQuestions(next)
                              }}
                              className="shrink-0 mr-1"
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-slate-600 dark:text-slate-300"
                            onClick={() => void openPreview(question)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Preview
                          </Button>
                          {activeMenu !== "deleted" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-[var(--cc-accent)]"
                                onClick={() => router.push(questionEditHref(question.id))}
                              >
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                Edit
                                <ChevronRight className="h-3 w-3 ml-0.5 opacity-60" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                                onClick={() => handleDeleteQuestion(question)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          {totalQuestionsPages > 1 ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 sm:pt-4 border-t border-slate-200/80 dark:border-white/[0.08]">
              <p className="text-xs text-slate-500 dark:text-slate-400 order-2 sm:order-1 text-center sm:text-left">
                Showing {(safeQuestionsPage - 1) * QUESTIONS_PAGE_SIZE + 1}–{Math.min(safeQuestionsPage * QUESTIONS_PAGE_SIZE, filteredQuestions.length)} of {filteredQuestions.length}
              </p>
              <Pagination className="w-full sm:w-auto justify-center sm:justify-end order-1 sm:order-2">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setQuestionsPage((p) => Math.max(1, p - 1))
                      }}
                      className={safeQuestionsPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalQuestionsPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalQuestionsPages <= 7) return true
                      if (p === 1 || p === totalQuestionsPages) return true
                      if (Math.abs(p - safeQuestionsPage) <= 1) return true
                      return false
                    })
                    .map((page, idx, arr) => (
                      <Fragment key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              setQuestionsPage(page)
                            }}
                            isActive={safeQuestionsPage === page}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      </Fragment>
                    ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        setQuestionsPage((p) => Math.min(totalQuestionsPages, p + 1))
                      }}
                      className={safeQuestionsPage >= totalQuestionsPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )

  const layout = (
    <FacultyModuleSplitLayout menu={sidebar}>{mainContent}</FacultyModuleSplitLayout>
  )

  return (
    <>
      <StaleRefreshHint visible={bankQuery.refreshFailed} onRetry={() => bankQuery.refetchAll()} />
      {embedded ? layout : <div className="min-h-screen bg-slate-50 dark:bg-slate-950"><div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 max-w-full overflow-x-hidden">{layout}</div></div>}
      {/* Preview Dialog */}
      <Dialog open={!!previewQuestion} onOpenChange={() => setPreviewQuestion(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-200/80 dark:border-white/[0.08] shrink-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 pr-8">
              <DialogTitle className="text-lg">Question preview</DialogTitle>
              {previewQuestion ? (
                <>
                  <span className={difficultyBadgeClass(previewQuestion.difficulty)}>
                    {previewQuestion.difficulty}
                  </span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {formatQuestionTypeLabel(previewQuestion.question_type)}
                  </Badge>
                </>
              ) : null}
            </div>
            <DialogDescription className="text-left">
              How students will see this item — stem, diagram, choices, and hints.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            {previewQuestion ? <QuestionBankPreviewPanel question={previewQuestion} /> : null}
          </div>
          <DialogFooter className="px-5 py-4 border-t border-slate-200/80 dark:border-white/[0.08] gap-2 shrink-0 sm:justify-between">
            <Button variant="outline" size="sm" className="h-9" onClick={() => setPreviewQuestion(null)}>
              Close
            </Button>
            {previewQuestion && activeMenu !== "deleted" ? (
              <Button
                size="sm"
                className={cn("h-9", fp.cta)}
                onClick={() => {
                  router.push(questionEditHref(previewQuestion.id))
                  setPreviewQuestion(null)
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit question
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
            <AlertDialogDescription>This will move the question to trash. You can restore it later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Questions?</AlertDialogTitle>
            <AlertDialogDescription>Restore {selectedQuestions.size} question(s)?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreQuestions} disabled={restoring}>{restoring ? "Restoring..." : "Restore"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={permanentDeleteDialogOpen} onOpenChange={setPermanentDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">Delete Permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={verifyAnswersDialogOpen} onOpenChange={setVerifyAnswersDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              {verifying ? `Verifying "${topicToVerify?.name}"` : `Review - ${topicToVerify?.name}`}
            </DialogTitle>
            <DialogDescription>
              {verifying ? "AI is analyzing..." : "Review suggested corrections."}
            </DialogDescription>
          </DialogHeader>
          {verifying ? (
            <div className="py-12 text-center">
              <Bot className="h-12 w-12 text-purple-600 animate-pulse mx-auto" />
              <p className="mt-4 text-slate-600 dark:text-slate-400">Verifying with AI...</p>
            </div>
          ) : verificationResults.filter((r: any) => r.needsUpdate).length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {verificationResults.filter((r: any) => r.needsUpdate).map((result, i) => (
                <Card key={result.questionId} className="border-amber-200 dark:border-amber-800">
                  <CardHeader>
                    <CardTitle className="text-sm">Question #{result.questionOrder || i + 1}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><strong>Current:</strong> {Array.isArray(result.currentAnswer) ? result.currentAnswer.join(", ") : String(result.currentAnswer)}</div>
                    <div><strong>Suggested:</strong> {Array.isArray(result.suggestedAnswer) ? result.suggestedAnswer.join(", ") : String(result.suggestedAnswer)}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <p className="mt-4 text-slate-600 dark:text-slate-400">No corrections needed</p>
            </div>
          )}
          <DialogFooter>
            {!verifying && verificationResults.filter((r: any) => r.needsUpdate).length > 0 && (
              <Button onClick={() => setApprovalDialogOpen(true)}>Review & Approve</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply AI Corrections?</DialogTitle>
            <DialogDescription>Update {verificationResults.filter((r: any) => r.needsUpdate).length} question(s).</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleApproveCorrections}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editTopicDialogOpen} onOpenChange={setEditTopicDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Topic</DialogTitle>
            <DialogDescription>Rename the topic. All questions will be updated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Current</label>
              <div className="p-3 mt-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10">{topicToEdit?.name}</div>
            </div>
            <div>
              <label className="text-sm font-medium">New name</label>
              <Input value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} placeholder="Enter new name" className="mt-1" disabled={renaming} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditTopicDialogOpen(false); setTopicToEdit(null); setNewTopicName("") }} disabled={renaming}>Cancel</Button>
            <Button onClick={handleRenameTopic} disabled={renaming || !newTopicName.trim() || newTopicName.trim() === topicToEdit?.name}>
              {renaming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Renaming...</> : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuestionBankCreateTopicSheet
        open={createTopicOpen}
        onOpenChange={setCreateTopicOpen}
        bankBase={bankBase}
        existingTopics={topics.map((t) => t.name)}
        allQuestions={allQuestionsForTypes.length > 0 ? allQuestionsForTypes : questions}
        onTopicCreated={() => {
          void fetchTopics()
          void fetchAllQuestions()
        }}
      />

      <QuestionBankAddTypeSheet
        open={addTypeOpen}
        onOpenChange={setAddTypeOpen}
        bankBase={bankBase}
        onTypeSaved={() => {
          void handleTypesMenuClick()
        }}
      />
    </>
  )
}
