"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Brain,
  Target,
  Users,
  BarChart3,
  Settings,
  Plus,
  Edit,
  Trash2,
  Eye,
  Play,
  Pause,
  RefreshCw,
  Calendar,
  Clock,
  Star,
  TrendingUp,
  Activity,
  Award,
  Zap,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Filter,
  Search,
  Download,
  Upload,
  MoreHorizontal,
  Layers,
  Database,
  Server,
  Cpu,
  HardDrive,
  Globe,
  Lock,
  Unlock,
  Bell,
  MessageSquare,
  FileText,
  GraduationCap,
  Bookmark,
  BookmarkCheck,
  Archive,
  Copy,
  XCircle,
  CheckCircle2,
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { usePreventBack } from "@/hooks/use-prevent-back"

interface PracticeConfig {
  id: number
  topic: string
  difficulty: string
  daily_limit: number
  is_active: boolean
  created_at: string
  updated_at: string
  question_count: number
  student_count: number
  completion_rate: number
  average_score: number
}

interface PracticeStats {
  total_topics: number
  active_topics: number
  total_questions: number
  total_students: number
  daily_attempts: number
  weekly_attempts: number
  average_completion_rate: number
  top_performers: Array<{
    student_name: string
    score: number
    attempts: number
  }>
  topic_performance: Array<{
    topic: string
    completion_rate: number
    average_score: number
    attempts: number
  }>
}

interface LeaderboardEntry {
  id: number
  student_name: string
  student_number: string
  total_score: number
  total_attempts: number
  average_score: number
  rank: number
  streak: number
  badges: string[]
  last_activity: string
}

export default function AdminPracticeHubPage() {
  const router = useRouter()
  const { toast } = useToast()
  usePreventBack("/admin/login")

  const [configs, setConfigs] = useState<PracticeConfig[]>([])
  const [stats, setStats] = useState<PracticeStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDifficulty, setSelectedDifficulty] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")

  const difficulties = ["Easy", "Medium", "Hard"]
  const topics = ["Programming", "Data Structures", "Algorithms", "Web Development", "Database", "System Design"]

  useEffect(() => {
    fetchData()
  }, [selectedDifficulty, selectedStatus])

  const fetchData = async () => {
    try {
      const adminId = sessionStorage.getItem("adminId")
      if (!adminId) {
        router.push("/admin/login")
        return
      }

      const [configsResponse, statsResponse, leaderboardResponse] = await Promise.all([
        fetch(`/api/admin/practice-hub/configs?adminId=${adminId}&difficulty=${selectedDifficulty}&status=${selectedStatus}`),
        fetch("/api/admin/practice-hub/stats"),
        fetch("/api/admin/practice-hub/leaderboard")
      ])

      if (configsResponse.ok) {
        const configsData = await configsResponse.json()
        setConfigs(configsData.configs || [])
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
      }

      if (leaderboardResponse.ok) {
        const leaderboardData = await leaderboardResponse.json()
        setLeaderboard(leaderboardData.leaderboard || [])
      }
    } catch (error) {
      console.error("Error fetching practice hub data:", error)
      toast({
        title: "Error",
        description: "Failed to load practice hub data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredConfigs = configs.filter(config =>
    config.topic.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy": return "green"
      case "Medium": return "yellow"
      case "Hard": return "red"
      default: return "gray"
    }
  }

  const handleToggleActive = async (configId: number, isActive: boolean) => {
    try {
      const response = await fetch("/api/admin/practice-hub/configs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configId,
          is_active: !isActive
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Practice topic ${!isActive ? 'activated' : 'deactivated'}`,
        })
        fetchData()
      } else {
        throw new Error("Failed to update practice config")
      }
    } catch (error) {
      console.error("Error updating practice config:", error)
      toast({
        title: "Error",
        description: "Failed to update practice configuration",
        variant: "destructive",
      })
    }
  }

  const handleResetLeaderboard = async () => {
    try {
      const response = await fetch("/api/admin/practice-hub/leaderboard/reset", {
        method: "POST",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Leaderboard reset successfully",
        })
        fetchData()
      } else {
        throw new Error("Failed to reset leaderboard")
      }
    } catch (error) {
      console.error("Error resetting leaderboard:", error)
      toast({
        title: "Error",
        description: "Failed to reset leaderboard",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            <Brain className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading Practice Hub...</p>
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
                  Practice Hub Management
                </h1>
                <p className="text-slate-600 dark:text-slate-300">
                  Configure practice topics, monitor performance, and manage leaderboards
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push("/admin/practice-hub/create")}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Topic
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl"
                onClick={() => router.push("/admin/practice-hub/analytics")}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
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
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total_topics}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Total Topics</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total_students}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Active Students</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                    <Target className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total_questions}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Practice Questions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.average_completion_rate}%</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Avg Completion</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl p-2">
            <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="configs" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Settings className="h-4 w-4 mr-2" />
              Configurations
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Award className="h-4 w-4 mr-2" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Activity className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Daily Activity */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Daily Activity</CardTitle>
                      <CardDescription>Practice attempts and engagement</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Today's Attempts</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{stats?.daily_attempts || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">This Week</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{stats?.weekly_attempts || 0}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Engagement Rate</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">{stats?.average_completion_rate || 0}%</span>
                      </div>
                      <Progress value={stats?.average_completion_rate || 0} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Performers */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                      <Star className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Top Performers</CardTitle>
                      <CardDescription>Students with highest scores</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {stats?.top_performers.slice(0, 5).map((performer, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                          index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                          index === 2 ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                          'bg-gradient-to-r from-blue-400 to-indigo-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800 dark:text-white truncate">
                            {performer.student_name}
                          </p>
                          <p className="text-xs text-slate-500">{performer.attempts} attempts</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm text-slate-800 dark:text-white">{performer.score}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Topic Performance */}
            {stats?.topic_performance && (
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                      <Layers className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Topic Performance</CardTitle>
                      <CardDescription>Performance metrics by topic</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {stats.topic_performance.map((topic, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 dark:text-white">{topic.topic}</span>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-600 dark:text-slate-300">{topic.attempts} attempts</span>
                            <span className="font-semibold text-slate-800 dark:text-white">{topic.average_score}% avg</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Completion Rate</span>
                            <span className="text-slate-600">{topic.completion_rate}%</span>
                          </div>
                          <Progress value={topic.completion_rate} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Configurations Tab */}
          <TabsContent value="configs" className="space-y-6">
            {/* Filters */}
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        placeholder="Search topics..."
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

                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="w-32 rounded-xl">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Practice Configurations */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredConfigs.map((config, index) => (
                  <motion.div
                    key={config.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <Card className="border-0 shadow-xl backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-2xl">
                      <CardHeader className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                              <Brain className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg font-bold text-slate-800 dark:text-white truncate">
                                {config.topic}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs border-${getDifficultyColor(config.difficulty)}-500 text-${getDifficultyColor(config.difficulty)}-600`}
                                >
                                  {config.difficulty}
                                </Badge>
                                <Badge variant={config.is_active ? "default" : "secondary"} className="text-xs">
                                  {config.is_active ? "Active" : "Inactive"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Switch
                            checked={config.is_active}
                            onCheckedChange={() => handleToggleActive(config.id, config.is_active)}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 pt-0">
                        <div className="space-y-4">
                          {/* Stats */}
                          <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="space-y-1">
                              <p className="text-2xl font-bold text-slate-800 dark:text-white">{config.question_count}</p>
                              <p className="text-xs text-slate-500">Questions</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-2xl font-bold text-slate-800 dark:text-white">{config.daily_limit}</p>
                              <p className="text-xs text-slate-500">Daily Limit</p>
                            </div>
                          </div>

                          {/* Performance */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-600 dark:text-slate-300">Completion Rate</span>
                              <span className="font-semibold text-slate-800 dark:text-white">{config.completion_rate}%</span>
                            </div>
                            <Progress value={config.completion_rate} className="h-2" />
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-300">Average Score</span>
                            <span className="font-semibold text-slate-800 dark:text-white">{config.average_score}%</span>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 rounded-xl"
                              onClick={() => router.push(`/admin/practice-hub/${config.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 rounded-xl"
                              onClick={() => router.push(`/admin/practice-hub/${config.id}/analytics`)}
                            >
                              <BarChart3 className="h-4 w-4 mr-2" />
                              Analytics
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-600 flex items-center justify-center">
                      <Award className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold">Practice Leaderboard</CardTitle>
                      <CardDescription>Top performing students in practice sessions</CardDescription>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleResetLeaderboard}
                    className="rounded-xl"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset Leaderboard
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {leaderboard.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                        index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-500' :
                        index === 2 ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                        'bg-gradient-to-r from-blue-400 to-indigo-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-800 dark:text-white">{entry.student_name}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{entry.student_number}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {entry.badges.map((badge, badgeIndex) => (
                            <Badge key={badgeIndex} variant="secondary" className="text-xs">
                              {badge}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-800 dark:text-white">{entry.total_score}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">points</p>
                        <p className="text-xs text-slate-500">{entry.total_attempts} attempts</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Performance Trends</CardTitle>
                      <CardDescription>Weekly performance metrics</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">This Week</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{stats?.weekly_attempts || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Last Week</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{Math.floor((stats?.weekly_attempts || 0) * 0.85)}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Growth Rate</span>
                        <span className="text-sm font-semibold text-green-600">+15%</span>
                      </div>
                      <Progress value={75} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Student Engagement</CardTitle>
                      <CardDescription>Active participation metrics</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Active Students</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{stats?.total_students || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Daily Active</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{Math.floor((stats?.total_students || 0) * 0.6)}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Engagement Rate</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">{stats?.average_completion_rate || 0}%</span>
                      </div>
                      <Progress value={stats?.average_completion_rate || 0} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}