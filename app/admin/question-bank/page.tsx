"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Search,
  Filter,
  Download,
  Upload,
  BookOpen,
  Tag,
  Copy,
  Eye,
  Star,
  StarOff,
  MoreHorizontal,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  BarChart3,
  Settings,
  Target,
  Zap,
  Brain,
  GraduationCap,
  Bookmark,
  BookmarkCheck,
  RefreshCw,
  Archive,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Database,
  Layers,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  Code,
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { usePreventBack } from "@/hooks/use-prevent-back"

interface Question {
  id: number
  question_text: string
  question_type: string
  options: string[]
  correct_answer: string
  explanation: string
  difficulty: string
  topic: string
  points: number
  tags: string[]
  created_at: string
  updated_at: string
  usage_count: number
  is_favorite: boolean
  is_archived: boolean
  created_by: string
  last_used: string | null
}

interface QuestionStats {
  total_questions: number
  by_difficulty: Record<string, number>
  by_topic: Record<string, number>
  by_type: Record<string, number>
  most_used: Question[]
  recently_added: Question[]
}

export default function AdminQuestionBankPage() {
  const router = useRouter()
  const { toast } = useToast()
  usePreventBack("/admin/login")

  const [questions, setQuestions] = useState<Question[]>([])
  const [stats, setStats] = useState<QuestionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDifficulty, setSelectedDifficulty] = useState("all")
  const [selectedTopic, setSelectedTopic] = useState("all")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [sortBy, setSortBy] = useState("created_at")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState("all")

  const difficulties = ["Easy", "Medium", "Hard"]
  const topics = ["Programming", "Data Structures", "Algorithms", "Web Development", "Database", "System Design"]
  const questionTypes = ["multiple_choice", "true_false", "short_answer", "essay", "code"]
  const allTags = ["fundamental", "advanced", "practical", "theoretical", "interview", "exam"]

  useEffect(() => {
    fetchQuestions()
    fetchStats()
  }, [selectedDifficulty, selectedTopic, selectedType, selectedTags, sortBy, sortOrder])

  const fetchQuestions = async () => {
    try {
      const adminId = sessionStorage.getItem("adminId")
      if (!adminId) {
        router.push("/admin/login")
        return
      }

      const params = new URLSearchParams({
        adminId,
        ...(selectedDifficulty !== "all" && { difficulty: selectedDifficulty }),
        ...(selectedTopic !== "all" && { topic: selectedTopic }),
        ...(selectedType !== "all" && { type: selectedType }),
        ...(selectedTags.length > 0 && { tags: selectedTags.join(",") }),
        sortBy,
        sortOrder,
      })

      const response = await fetch(`/api/admin/question-bank?${params}`)
      if (response.ok) {
        const data = await response.json()
        setQuestions(data.questions || [])
      } else {
        throw new Error("Failed to fetch questions")
      }
    } catch (error) {
      console.error("Error fetching questions:", error)
      toast({
        title: "Error",
        description: "Failed to load questions",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/question-bank/stats")
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }

  const filteredQuestions = questions.filter(question =>
    question.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    question.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
    question.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "multiple_choice": return Target
      case "true_false": return CheckCircle
      case "short_answer": return FileText
      case "essay": return BookOpen
      case "code": return Code
      default: return FileText
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "multiple_choice": return "blue"
      case "true_false": return "green"
      case "short_answer": return "orange"
      case "essay": return "purple"
      case "code": return "red"
      default: return "gray"
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "green"
      case "Medium": return "yellow"
      case "Hard": return "red"
      default: return "gray"
    }
  }

  const handleBulkAction = async (action: string) => {
    if (selectedQuestions.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select questions to perform bulk actions",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/admin/question-bank/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: selectedQuestions,
          action,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Bulk ${action} completed successfully`,
        })
        setSelectedQuestions([])
        fetchQuestions()
      } else {
        throw new Error(`Failed to ${action} questions`)
      }
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} questions`,
        variant: "destructive",
      })
    }
  }

  const handleImportExport = async (action: string) => {
    try {
      if (action === "export") {
        const response = await fetch("/api/admin/question-bank/export")
        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `questions-export-${new Date().toISOString().split('T')[0]}.json`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      } else if (action === "import") {
        // Handle file import
        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".json,.csv"
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) {
            const formData = new FormData()
            formData.append("file", file)
            
            const response = await fetch("/api/admin/question-bank/import", {
              method: "POST",
              body: formData,
            })

            if (response.ok) {
              toast({
                title: "Success",
                description: "Questions imported successfully",
              })
              fetchQuestions()
            } else {
              throw new Error("Failed to import questions")
            }
          }
        }
        input.click()
      }
    } catch (error) {
      console.error(`Error with ${action}:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} questions`,
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            <BookOpen className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading Question Bank...</p>
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
                  Question Bank
                </h1>
                <p className="text-slate-600 dark:text-slate-300">
                  Manage reusable questions with advanced filtering and analytics
                </p>
          </div>
          </div>
          <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push("/admin/question-bank/create")}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl"
                onClick={() => handleImportExport("import")}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl"
                onClick={() => handleImportExport("export")}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        {stats && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total_questions}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Total Questions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">
                      {Object.values(stats.by_difficulty).reduce((a, b) => a + b, 0)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">By Difficulty</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                    <Layers className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">
                      {Object.keys(stats.by_topic).length}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Topics</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">
                      {stats.most_used.length}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Most Used</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters and Search */}
        <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    placeholder="Search questions, topics, or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-12 text-lg border-2 border-slate-200 dark:border-slate-600 focus:border-indigo-500 rounded-xl bg-white/50 dark:bg-slate-700/50"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                  <SelectTrigger className="w-32 rounded-xl">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {difficulties.map((diff) => (
                      <SelectItem key={diff} value={diff}>
                        {diff}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                  <SelectTrigger className="w-40 rounded-xl">
                    <SelectValue placeholder="Topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Topics</SelectItem>
                    {topics.map((topic) => (
                      <SelectItem key={topic} value={topic}>
                        {topic}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-40 rounded-xl">
                    <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {questionTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="rounded-xl"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="rounded-xl"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Tag Filters */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tags:</span>
                {allTags.map((tag) => (
                  <Button
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedTags(prev => 
                        prev.includes(tag) 
                          ? prev.filter(t => t !== tag)
                          : [...prev, tag]
                      )
                    }}
                    className="rounded-xl text-xs"
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedQuestions.length > 0 && (
          <Card className="border-0 shadow-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">
                    {selectedQuestions.length} question{selectedQuestions.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBulkAction("archive")}
                    className="text-white hover:bg-white/20"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    Archive
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBulkAction("favorite")}
                    className="text-white hover:bg-white/20"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Favorite
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBulkAction("delete")}
                    className="text-white hover:bg-white/20"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Questions Grid/List */}
        {filteredQuestions.length > 0 ? (
          <div className={`grid gap-6 ${viewMode === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
            <AnimatePresence>
              {filteredQuestions.map((question, index) => {
                const TypeIcon = getTypeIcon(question.question_type)
                const typeColor = getTypeColor(question.question_type)
                const difficultyColor = getDifficultyColor(question.difficulty)
                
                return (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <Card className={`border-0 shadow-xl backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-2xl cursor-pointer bg-gradient-to-br from-${typeColor}-500/5 to-transparent border-2 border-${typeColor}-500/30`}>
                      <CardHeader className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox
                              checked={selectedQuestions.includes(question.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedQuestions(prev => [...prev, question.id])
                                } else {
                                  setSelectedQuestions(prev => prev.filter(id => id !== question.id))
                                }
                              }}
                              className="mt-1"
                            />
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-r from-${typeColor}-500 to-${typeColor}-600 flex items-center justify-center`}>
                              <TypeIcon className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg font-bold text-slate-800 dark:text-white line-clamp-2">
                                {question.question_text}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs border-${difficultyColor}-500 text-${difficultyColor}-600`}
                                >
                                  {question.difficulty}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {question.topic}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {question.points} pts
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {question.is_favorite && (
                              <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            )}
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 pt-0">
                        <div className="space-y-4">
                          {/* Tags */}
                          {question.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {question.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="space-y-1">
                              <p className="text-lg font-bold text-slate-800 dark:text-white">
                                {question.usage_count}
                              </p>
                              <p className="text-xs text-slate-500">Uses</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-lg font-bold text-slate-800 dark:text-white">
                                {question.question_type.replace("_", " ")}
                              </p>
                              <p className="text-xs text-slate-500">Type</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-lg font-bold text-slate-800 dark:text-white">
                                {new Date(question.created_at).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-slate-500">Created</p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 rounded-xl"
                              onClick={() => router.push(`/admin/question-bank/${question.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 rounded-xl"
                              onClick={() => router.push(`/admin/question-bank/${question.id}/preview`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-xl"
                              onClick={() => router.push(`/admin/quizzes/create?from=${question.id}`)}
                            >
                              <Copy className="h-4 w-4" />
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
                <BookOpen className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                No Questions Found
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                {searchQuery ? "No questions match your search criteria." : "Get started by adding your first question."}
              </p>
              <Button
                onClick={() => router.push("/admin/question-bank/create")}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Question
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}