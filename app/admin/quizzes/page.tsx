"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
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
  Search,
  Filter,
  Download,
  Upload,
  Calendar,
  Clock,
  Users,
  BarChart3,
  Settings,
  MoreHorizontal,
  Play,
  Pause,
  Archive,
  Star,
  Target,
  Zap,
  Shield,
  Brain,
  GraduationCap,
  BookOpen,
  ClipboardList,
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { usePreventBack } from "@/hooks/use-prevent-back"

interface Quiz {
  id: number
  title: string
  description: string
  assessment_type: string
  is_active: boolean
  is_saved: boolean
  time_per_question: number
  question_count: number
  created_at: string
  available_from: string
  available_until: string
  retake_limit: number
  difficulty: string
  topic: string
  session_access: {
    P01: boolean
    P02: boolean
    P05: boolean
  }
  stats?: {
    total_attempts: number
    average_score: number
    completion_rate: number
  }
}

interface Session {
  id: number
  code: string
  description: string
}

export default function AdminQuizzesPage() {
  const router = useRouter()
  const { toast } = useToast()
  usePreventBack("/admin/login")

  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSession, setSelectedSession] = useState("all")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [activeTab, setActiveTab] = useState("all")

  const assessmentTypes = [
    { value: "quiz", label: "Quizzes", icon: ClipboardList, color: "blue" },
    { value: "homework", label: "Homeworks", icon: BookOpen, color: "green" },
    { value: "mid_semester", label: "Mid-Semester", icon: FileText, color: "orange" },
    { value: "finals", label: "Final Exams", icon: GraduationCap, color: "red" },
    { value: "practice", label: "Practice", icon: Brain, color: "purple" },
    { value: "playground", label: "Playground", icon: Zap, color: "yellow" },
  ]

  useEffect(() => {
    fetchQuizzes()
    fetchSessions()
  }, [selectedSession, selectedType, selectedStatus])

  const fetchQuizzes = async () => {
    try {
      const adminId = sessionStorage.getItem("adminId")
      if (!adminId) {
        router.push("/admin/login")
        return
      }

      const params = new URLSearchParams({
        adminId,
        ...(selectedSession !== "all" && { session: selectedSession }),
        ...(selectedType !== "all" && { type: selectedType }),
        ...(selectedStatus !== "all" && { status: selectedStatus }),
      })

      const response = await fetch(`/api/admin/quizzes?${params}`)
      if (response.ok) {
        const data = await response.json()
        setQuizzes(data.quizzes || [])
      } else {
        throw new Error("Failed to fetch quizzes")
      }
    } catch (error) {
      console.error("Error fetching quizzes:", error)
      toast({
        title: "Error",
        description: "Failed to load quizzes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/admin/sessions")
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch (error) {
      console.error("Error fetching sessions:", error)
    }
  }

  const filteredQuizzes = quizzes.filter(quiz =>
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.topic.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getTypeIcon = (type: string) => {
    const typeConfig = assessmentTypes.find(t => t.value === type)
    return typeConfig?.icon || ClipboardList
  }

  const getTypeColor = (type: string) => {
    const typeConfig = assessmentTypes.find(t => t.value === type)
    return typeConfig?.color || "blue"
  }

  const getStatusBadge = (quiz: Quiz) => {
    const now = new Date()
    const availableFrom = new Date(quiz.available_from)
    const availableUntil = new Date(quiz.available_until)

    if (!quiz.is_active) {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-600">Inactive</Badge>
    }

    if (now < availableFrom) {
      return <Badge variant="outline" className="border-blue-500 text-blue-600">Scheduled</Badge>
    }

    if (now > availableUntil) {
      return <Badge variant="outline" className="border-red-500 text-red-600">Expired</Badge>
    }

    return <Badge variant="default" className="bg-green-100 text-green-600">Active</Badge>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            <ClipboardList className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading Quizzes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-white/20 dark:border-gray-800/50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Quiz Management
                </h1>
                <p className="text-slate-600 dark:text-slate-300">
                  Create, manage, and monitor all assessments
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push("/admin/quizzes/create")}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Quiz
              </Button>
              <Button variant="outline" className="rounded-xl">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Assessment Type Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl p-2">
            <TabsTrigger value="all" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Target className="h-4 w-4 mr-2" />
              All
            </TabsTrigger>
            {assessmentTypes.map((type) => (
              <TabsTrigger 
                key={type.value} 
                value={type.value}
                className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
              >
                <type.icon className="h-4 w-4 mr-2" />
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Filters */}
          <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input
                      placeholder="Search quizzes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 h-12 text-lg border-2 border-slate-200 dark:border-slate-600 focus:border-indigo-500 rounded-xl bg-white/50 dark:bg-slate-700/50"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Select value={selectedSession} onValueChange={setSelectedSession}>
                    <SelectTrigger className="w-40 rounded-xl">
                      <SelectValue placeholder="Session" />
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
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-40 rounded-xl">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="rounded-xl">
                    <Filter className="h-4 w-4 mr-2" />
                    More Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quizzes Grid/List */}
          <TabsContent value={activeTab} className="space-y-6">
            {filteredQuizzes.length > 0 ? (
              <div className={`grid gap-6 ${viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
                <AnimatePresence>
                  {filteredQuizzes.map((quiz, index) => {
                    const TypeIcon = getTypeIcon(quiz.assessment_type)
                    const typeColor = getTypeColor(quiz.assessment_type)
                    
                    return (
                      <motion.div
                        key={quiz.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        exit={{ opacity: 0, y: -20 }}
                      >
                        <Card className={`border-0 shadow-xl backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-2xl cursor-pointer bg-gradient-to-br from-${typeColor}-500/5 to-transparent border-2 border-${typeColor}-500/30`}>
                          <CardHeader className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r from-${typeColor}-500 to-${typeColor}-600 flex items-center justify-center`}>
                                  <TypeIcon className="h-6 w-6 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-lg font-bold text-slate-800 dark:text-white truncate">
                                    {quiz.title}
                                  </CardTitle>
                                  <CardDescription className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                                    {quiz.description}
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(quiz)}
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-6 pt-0">
                            <div className="space-y-4">
                              {/* Quiz Stats */}
                              <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="space-y-1">
                                  <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {quiz.question_count}
                                  </p>
                                  <p className="text-xs text-slate-500">Questions</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {quiz.stats?.total_attempts || 0}
                                  </p>
                                  <p className="text-xs text-slate-500">Attempts</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {quiz.stats?.average_score || 0}%
                                  </p>
                                  <p className="text-xs text-slate-500">Avg Score</p>
                                </div>
                              </div>

                              {/* Session Access */}
                              <div className="space-y-2">
                                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Session Access:</p>
                                <div className="flex gap-2">
                                  {Object.entries(quiz.session_access).map(([session, hasAccess]) => (
                                    <Badge 
                                      key={session}
                                      variant={hasAccess ? "default" : "outline"}
                                      className={hasAccess ? "bg-green-100 text-green-600" : "border-gray-300 text-gray-500"}
                                    >
                                      {session}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="flex-1 rounded-xl"
                                  onClick={() => router.push(`/admin/quizzes/${quiz.id}/edit`)}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="flex-1 rounded-xl"
                                  onClick={() => router.push(`/admin/quizzes/${quiz.id}/preview`)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Preview
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="rounded-xl"
                                  onClick={() => router.push(`/admin/quizzes/${quiz.id}/analytics`)}
                                >
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardContent className="p-12 text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
                    <ClipboardList className="h-12 w-12 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                    No Quizzes Found
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 mb-6">
                    {searchQuery ? "No quizzes match your search criteria." : "Get started by creating your first quiz."}
                  </p>
                  <Button
                    onClick={() => router.push("/admin/quizzes/create")}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Quiz
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}