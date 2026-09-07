"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Search,
  Filter,
  Settings,
  BarChart3,
  Users,
  Target,
  Clock,
  Star,
  Award,
  Crown,
  TrendingUp,
  Activity,
  Zap,
  Shield,
  Brain,
  BookOpen,
  ClipboardList,
  Calendar,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
  Eye,
  Edit,
  MoreHorizontal,
  Plus,
  Minus,
  RotateCcw,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { usePreventBack } from "@/hooks/use-prevent-back"

interface PracticeConfig {
  id: number
  daily_question_limit: number
  difficulty_distribution: {
    easy: number
    medium: number
    hard: number
  }
  topic_weights: {
    [topic: string]: number
  }
  is_active: boolean
  streak_rewards: boolean
  leaderboard_reset_schedule: string
  created_at: string
  updated_at: string
}

interface PracticeStats {
  total_questions_answered: number
  active_students: number
  average_score: number
  completion_rate: number
  streak_leaderboard: {
    student_name: string
    streak_days: number
    total_questions: number
  }[]
  topic_performance: {
    topic: string
    questions_answered: number
    average_score: number
    difficulty_breakdown: {
      easy: number
      medium: number
      hard: number
    }
  }[]
  daily_activity: {
    date: string
    questions_answered: number
    active_students: number
  }[]
}

interface LeaderboardEntry {
  rank: number
  student_name: string
  total_questions: number
  correct_answers: number
  accuracy: number
  streak_days: number
  points: number
  membership_tier: string
}

export default function InstructorPracticeHubManagementPage() {
  const router = useRouter()
  const { toast } = useToast()
  usePreventBack("/instructor/login")

  const [config, setConfig] = useState<PracticeConfig | null>(null)
  const [stats, setStats] = useState<PracticeStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  const topics = [
    "Programming Fundamentals",
    "Data Structures",
    "Algorithms",
    "Web Development",
    "Database Design",
    "Software Engineering",
    "Computer Networks",
    "Operating Systems",
    "Machine Learning",
    "Cybersecurity",
  ]

  const difficulties = [
    { value: "easy", label: "Easy", color: "green" },
    { value: "medium", label: "Medium", color: "yellow" },
    { value: "hard", label: "Hard", color: "red" },
  ]

  useEffect(() => {
    fetchConfig()
    fetchStats()
    fetchLeaderboard()
  }, [])

  const fetchConfig = async () => {
    try {
      const instructorId = sessionStorage.getItem("instructorId")
      if (!instructorId) {
        router.push("/instructor/login")
        return
      }

      const response = await instructorApiFetch(`/api/instructor/practice-hub/configs?instructorId=${instructorId}`)
      if (response.ok) {
        const data = await response.json()
        setConfig(data.config)
      } else {
        // Create default config if none exists
        const defaultConfig: PracticeConfig = {
          id: 1,
          daily_question_limit: 10,
          difficulty_distribution: { easy: 40, medium: 40, hard: 20 },
          topic_weights: topics.reduce((acc, topic) => ({ ...acc, [topic]: 10 }), {}),
          is_active: true,
          streak_rewards: true,
          leaderboard_reset_schedule: "weekly",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setConfig(defaultConfig)
      }
    } catch (error) {
      console.error("Error fetching config:", error)
    }
  }

  const fetchStats = async () => {
    try {
      const instructorId = sessionStorage.getItem("instructorId")
      if (!instructorId) return

      const response = await instructorApiFetch(`/api/instructor/practice-hub/stats?instructorId=${instructorId}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }

  const fetchLeaderboard = async () => {
    try {
      const instructorId = sessionStorage.getItem("instructorId")
      if (!instructorId) return

      const response = await instructorApiFetch(`/api/instructor/practice-hub/leaderboard?instructorId=${instructorId}`)
      if (response.ok) {
        const data = await response.json()
        setLeaderboard(data.leaderboard || [])
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = async (updates: Partial<PracticeConfig>) => {
    try {
      const instructorId = sessionStorage.getItem("instructorId")
      if (!instructorId) return

      const response = await instructorApiFetch("/api/instructor/practice-hub/configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructorId, ...updates }),
      })

      if (response.ok) {
        setConfig(prev => prev ? { ...prev, ...updates } : null)
        toast({
          title: "Success",
          description: "Practice hub configuration updated",
        })
      } else {
        throw new Error("Failed to update config")
      }
    } catch (error) {
      console.error("Error updating config:", error)
      toast({
        title: "Error",
        description: "Failed to update configuration",
        variant: "destructive",
      })
    }
  }

  const resetLeaderboard = async () => {
    try {
      const instructorId = sessionStorage.getItem("instructorId")
      if (!instructorId) return

      const response = await instructorApiFetch("/api/instructor/practice-hub/leaderboard/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructorId }),
      })

      if (response.ok) {
        fetchLeaderboard()
        toast({
          title: "Success",
          description: "Leaderboard has been reset",
        })
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

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "Scholar": return Award
      case "Explorer": return Star
      case "Trailblazer": return Crown
      default: return Award
    }
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Scholar": return "gray"
      case "Explorer": return "blue"
      case "Trailblazer": return "purple"
      default: return "gray"
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
              <Link href="/instructor/dashboard">
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
                  Configure practice settings and monitor student progress
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="rounded-xl">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
              <Button variant="outline" className="rounded-xl">
                <BarChart3 className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl p-2">
            <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="config" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <TrendingUp className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Crown className="h-4 w-4 mr-2" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800 dark:text-white">
                        {stats?.total_questions_answered || 0}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Questions Answered</p>
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
                      <p className="text-2xl font-bold text-slate-800 dark:text-white">
                        {stats?.active_students || 0}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Active Students</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                      <Award className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800 dark:text-white">
                        {stats?.average_score || 0}%
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Average Score</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800 dark:text-white">
                        {stats?.completion_rate || 0}%
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Completion Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Practice Status */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Practice Status</CardTitle>
                      <CardDescription>Current practice hub configuration</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Practice Hub</span>
                      <div className="flex items-center gap-2">
                        {config?.is_active ? (
                          <Badge className="bg-green-100 text-green-600">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-500 text-red-600">Inactive</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Daily Limit</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">
                        {config?.daily_question_limit || 0} questions
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Streak Rewards</span>
                      <div className="flex items-center gap-2">
                        {config?.streak_rewards ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Reset Schedule</span>
                      <Badge variant="outline" className="text-xs">
                        {config?.leaderboard_reset_schedule || "weekly"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Top Streaks</CardTitle>
                      <CardDescription>Students with longest streaks</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {stats?.streak_leaderboard?.slice(0, 5).map((student, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-400 to-red-500 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800 dark:text-white">{student.student_name}</p>
                          <p className="text-xs text-slate-500">{student.total_questions} questions</p>
                        </div>
                        <Badge className="bg-orange-100 text-orange-600">{student.streak_days} days</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="config" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* General Settings */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Settings className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">General Settings</CardTitle>
                      <CardDescription>Basic practice hub configuration</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Daily Question Limit
                    </label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[config?.daily_question_limit || 10]}
                        onValueChange={([value]) => updateConfig({ daily_question_limit: value })}
                        max={50}
                        min={1}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm font-semibold text-slate-800 dark:text-white min-w-[3rem]">
                        {config?.daily_question_limit || 10}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Leaderboard Reset Schedule
                    </label>
                    <Select
                      value={config?.leaderboard_reset_schedule || "weekly"}
                      onValueChange={(value) => updateConfig({ leaderboard_reset_schedule: value })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Practice Hub Active
                      </label>
                      <p className="text-xs text-slate-500">Enable/disable practice hub</p>
                    </div>
                    <Switch
                      checked={config?.is_active || false}
                      onCheckedChange={(checked) => updateConfig({ is_active: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        Streak Rewards
                      </label>
                      <p className="text-xs text-slate-500">Enable streak-based rewards</p>
                    </div>
                    <Switch
                      checked={config?.streak_rewards || false}
                      onCheckedChange={(checked) => updateConfig({ streak_rewards: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Difficulty Distribution */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Difficulty Distribution</CardTitle>
                      <CardDescription>Percentage of questions by difficulty</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {difficulties.map((diff) => (
                    <div key={diff.value} className="space-y-2">
                      <div className="flex justify-between">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          {diff.label}
                        </label>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">
                          {config?.difficulty_distribution?.[diff.value as keyof typeof config.difficulty_distribution] || 0}%
                        </span>
                      </div>
                      <Slider
                        value={[config?.difficulty_distribution?.[diff.value as keyof typeof config.difficulty_distribution] || 0]}
                        onValueChange={([value]) => {
                          const newDistribution = {
                            easy: 0,
                            medium: 0,
                            hard: 0,
                            ...config?.difficulty_distribution,
                          }
                          newDistribution[diff.value as keyof typeof newDistribution] = value
                          updateConfig({ difficulty_distribution: newDistribution })
                        }}
                        max={100}
                        min={0}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Topic Weights */}
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">Topic Weights</CardTitle>
                    <CardDescription>Relative importance of each topic</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {topics.map((topic) => (
                    <div key={topic} className="space-y-2">
                      <div className="flex justify-between">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          {topic}
                        </label>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">
                          {config?.topic_weights?.[topic] || 0}%
                        </span>
                      </div>
                      <Slider
                        value={[config?.topic_weights?.[topic] || 0]}
                        onValueChange={([value]) => {
                          const newWeights = { ...config?.topic_weights }
                          newWeights[topic] = value
                          updateConfig({ topic_weights: newWeights })
                        }}
                        max={100}
                        min={0}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Topic Performance */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Topic Performance</CardTitle>
                      <CardDescription>Student performance by topic</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {stats?.topic_performance?.map((topic, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-slate-600 dark:text-slate-300">{topic.topic}</span>
                          <span className="font-semibold text-slate-800 dark:text-white">{topic.average_score}%</span>
                        </div>
                        <Progress value={topic.average_score} className="h-2" />
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{topic.questions_answered} questions</span>
                          <span>E: {topic.difficulty_breakdown.easy} M: {topic.difficulty_breakdown.medium} H: {topic.difficulty_breakdown.hard}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Daily Activity */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Daily Activity</CardTitle>
                      <CardDescription>Recent practice activity</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {stats?.daily_activity?.slice(-7).map((day, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-cyan-500 flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800 dark:text-white">
                            {new Date(day.date).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-slate-500">{day.active_students} active students</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-600">{day.questions_answered} questions</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Practice Leaderboard</h2>
              <Button
                onClick={resetLeaderboard}
                variant="outline"
                className="rounded-xl"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Leaderboard
              </Button>
            </div>

            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {leaderboard.map((entry, index) => {
                    const TierIcon = getTierIcon(entry.membership_tier)
                    const tierColor = getTierColor(entry.membership_tier)
                    
                    return (
                      <div key={index} className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">{entry.rank}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-800 dark:text-white">{entry.student_name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <div className={`w-6 h-6 rounded-lg bg-gradient-to-r from-${tierColor}-500 to-${tierColor}-600 flex items-center justify-center`}>
                              <TierIcon className="h-3 w-3 text-white" />
                            </div>
                            <Badge variant="outline" className="text-xs">{entry.membership_tier}</Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <p className="text-lg font-bold text-slate-800 dark:text-white">{entry.total_questions}</p>
                            <p className="text-xs text-slate-500">Questions</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-slate-800 dark:text-white">{entry.accuracy}%</p>
                            <p className="text-xs text-slate-500">Accuracy</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-slate-800 dark:text-white">{entry.streak_days}</p>
                            <p className="text-xs text-slate-500">Streak</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-slate-800 dark:text-white">{entry.points}</p>
                            <p className="text-xs text-slate-500">Points</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

