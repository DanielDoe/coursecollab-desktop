"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  Users,
  Clock,
  Brain,
  MessageSquare,
  Flame,
  BarChart3,
  RefreshCw,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Eye,
  Target,
  Zap
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts"
import { InstructorAIInsights } from "./instructor-ai-insights"
import { DashboardKpiCard } from "@/components/dashboard-v2/DashboardKpiCard"
import { cn } from "@/lib/utils"
import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

interface InstructorAIMonitoringDashboardProps {
  instructorId?: string
  embedInDashboard?: boolean
}

export function InstructorAIMonitoringDashboard({
  instructorId,
  embedInDashboard = false,
}: InstructorAIMonitoringDashboardProps) {
  const fp = getFacultyModuleTheme("ai-monitoring").page
  const cardBase = PORTAL_CARD

  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30000) // 30 seconds
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Data states
  const [activity, setActivity] = useState<any[]>([])
  const [activityStats, setActivityStats] = useState<any>(null)
  const [hotTopics, setHotTopics] = useState<any[]>([])
  const [struggles, setStruggles] = useState<any[]>([])
  const [struggleStats, setStruggleStats] = useState<any>(null)
  const [engagement, setEngagement] = useState<any>(null)
  const [peakUsage, setPeakUsage] = useState<any>(null)
  const [difficultyScores, setDifficultyScores] = useState<any[]>([])
  const [difficultySummary, setDifficultySummary] = useState<any>(null)
  
  const [loading, setLoading] = useState(true)
  const [expandedActivity, setExpandedActivity] = useState<number[]>([])

  // Time range filters
  const [activityMinutes, setActivityMinutes] = useState(60)
  const [topicHours, setTopicHours] = useState(24)
  const [struggleHours, setStruggleHours] = useState(6)
  const [engagementDays, setEngagementDays] = useState(7)
  const [usageDays, setUsageDays] = useState(7)
  const [difficultyDays, setDifficultyDays] = useState(14)

  useEffect(() => {
    fetchAllData()
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchAllData()
      }, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, activityMinutes, topicHours, struggleHours, engagementDays, usageDays, difficultyDays])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchActivity(),
        fetchHotTopics(),
        fetchStruggles(),
        fetchEngagement(),
        fetchPeakUsage(),
        fetchDifficultyScores()
      ])
      setLastRefresh(new Date())
    } catch (error) {
      console.error("Failed to fetch monitoring data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchActivity = async () => {
    try {
      const response = await instructorApiFetch(`/api/instructor/ai-monitoring/activity?limit=50&minutes=${activityMinutes}`)
      const data = await response.json()
      if (data.success) {
        setActivity(data.activity)
        setActivityStats(data.stats)
      }
    } catch (error) {
      console.error("Failed to fetch activity:", error)
    }
  }

  const fetchHotTopics = async () => {
    try {
      const response = await instructorApiFetch(`/api/instructor/ai-monitoring/hot-topics?hours=${topicHours}`)
      const data = await response.json()
      if (data.success) {
        setHotTopics(data.hotTopics)
      }
    } catch (error) {
      console.error("Failed to fetch hot topics:", error)
    }
  }

  const fetchStruggles = async () => {
    try {
      const response = await instructorApiFetch(`/api/instructor/ai-monitoring/struggle-alerts?hours=${struggleHours}&threshold=3`)
      const data = await response.json()
      if (data.success) {
        setStruggles(data.struggles)
        setStruggleStats(data)
      }
    } catch (error) {
      console.error("Failed to fetch struggles:", error)
    }
  }

  const fetchEngagement = async () => {
    try {
      const response = await instructorApiFetch(`/api/instructor/ai-monitoring/engagement?days=${engagementDays}`)
      const data = await response.json()
      if (data.success) {
        setEngagement(data)
      }
    } catch (error) {
      console.error("Failed to fetch engagement:", error)
    }
  }

  const fetchPeakUsage = async () => {
    try {
      const response = await instructorApiFetch(`/api/instructor/ai-monitoring/peak-usage?days=${usageDays}`)
      const data = await response.json()
      if (data.success) {
        setPeakUsage(data)
      }
    } catch (error) {
      console.error("Failed to fetch peak usage:", error)
    }
  }

  const fetchDifficultyScores = async () => {
    try {
      const response = await instructorApiFetch(`/api/instructor/ai-monitoring/difficulty-score?days=${difficultyDays}`)
      const data = await response.json()
      if (data.success) {
        setDifficultyScores(data.topicDifficulty)
        setDifficultySummary(data.summary)
      }
    } catch (error) {
      console.error("Failed to fetch difficulty scores:", error)
    }
  }

  const toggleActivityExpand = (id: number) => {
    setExpandedActivity(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive"
      case "high": return "destructive"
      case "medium": return "default"
      default: return "secondary"
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "rising": return <TrendingUp className="w-4 h-4 text-red-500" />
      case "falling": return <TrendingUp className="w-4 h-4 text-green-500 rotate-180" />
      case "new": return <Zap className="w-4 h-4 text-yellow-500" />
      default: return <Activity className="w-4 h-4 text-gray-500" />
    }
  }

  const getDifficultyColor = (category: string) => {
    switch (category) {
      case "very_hard": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
      case "hard": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
      case "moderate": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
      case "medium": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
      default: return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
    }
  }

  if (loading && !activity.length) {
    return (
      <div className={`flex items-center justify-center ${embedInDashboard ? "min-h-[280px]" : "min-h-[60vh]"}`}>
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading AI monitoring…</p>
        </div>
      </div>
    )
  }

  const cardClass = embedInDashboard
    ? "border-slate-200/60 bg-white/80 shadow-sm backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03]"
    : ""

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!embedInDashboard ? (
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
              <Brain className="h-7 w-7 text-violet-600" />
              AI Tutor Monitoring Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Real-time insights into student AI learning patterns
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Real-time insights into student AI learning patterns
          </p>
        )}
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <Button variant="outline" size="sm" onClick={() => setAutoRefresh(!autoRefresh)} className="rounded-lg">
            {autoRefresh ? (
              <>
                <Bell className="mr-2 h-4 w-4" />
                Auto-refresh ON
              </>
            ) : (
              <>
                <BellOff className="mr-2 h-4 w-4" />
                Auto-refresh OFF
              </>
            )}
          </Button>
          <Button onClick={fetchAllData} size="sm" disabled={loading} className="rounded-lg">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      {embedInDashboard ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <DashboardKpiCard
            label="Active students"
            value={activityStats?.active_students || 0}
            sub={`Last ${activityMinutes} min`}
            icon={Users}
            iconBg="bg-sky-500/10"
            iconColor="text-sky-600 dark:text-sky-400"
          />
          <DashboardKpiCard
            label="Questions asked"
            value={activityStats?.total_questions || 0}
            sub={`Last ${activityMinutes} min`}
            icon={MessageSquare}
            iconBg="bg-violet-500/10"
            iconColor="text-violet-600 dark:text-violet-400"
          />
          <DashboardKpiCard
            label="Struggle alerts"
            value={struggleStats?.criticalCount || 0}
            sub="Critical issues"
            icon={AlertTriangle}
            iconBg="bg-rose-500/10"
            iconColor="text-rose-600 dark:text-rose-400"
          />
          <DashboardKpiCard
            label="Engagement rate"
            value={`${engagement?.engagementRate || 0}%`}
            sub={`${engagement?.activeUsers || 0} of ${engagement?.totalStudents || 0} students`}
            icon={Target}
            iconBg="bg-emerald-500/10"
            iconColor={fp.iconText}
          />
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        <Card className="border-2 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Students</p>
                <p className="text-3xl font-bold text-blue-600">{activityStats?.active_students || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Last {activityMinutes} min</p>
              </div>
              <Users className="w-12 h-12 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 dark:border-purple-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Questions Asked</p>
                <p className="text-3xl font-bold text-purple-600">{activityStats?.total_questions || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Last {activityMinutes} min</p>
              </div>
              <MessageSquare className="w-12 h-12 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-200 dark:border-red-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Struggle Alerts</p>
                <p className="text-3xl font-bold text-red-600">{struggleStats?.criticalCount || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Critical issues</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 dark:border-green-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Engagement Rate</p>
                <p className="text-3xl font-bold text-green-600">{engagement?.engagementRate || 0}%</p>
                <p className="text-xs text-gray-500 mt-1">{engagement?.activeUsers || 0} of {engagement?.totalStudents || 0} students</p>
              </div>
              <Target className="w-12 h-12 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={cn(
          "grid w-full",
          embedInDashboard ? "grid-cols-3 sm:grid-cols-6 h-auto gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-white/[0.04]" : "grid-cols-7"
        )}>
          <TabsTrigger value="overview" className={embedInDashboard ? "rounded-lg text-xs sm:text-sm" : ""}>Overview</TabsTrigger>
          <TabsTrigger value="activity" className={embedInDashboard ? "rounded-lg text-xs sm:text-sm" : ""}>Live Activity</TabsTrigger>
          <TabsTrigger value="hot-topics" className={embedInDashboard ? "rounded-lg text-xs sm:text-sm" : ""}>Hot Topics</TabsTrigger>
          <TabsTrigger value="struggles" className={embedInDashboard ? "rounded-lg text-xs sm:text-sm" : ""}>Struggles</TabsTrigger>
          <TabsTrigger value="engagement" className={embedInDashboard ? "rounded-lg text-xs sm:text-sm" : ""}>Engagement</TabsTrigger>
          <TabsTrigger value="analytics" className={embedInDashboard ? "rounded-lg text-xs sm:text-sm" : ""}>Analytics</TabsTrigger>
          {!embedInDashboard && <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Hot Topics Preview */}
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-600" />
                  Hot Topics Right Now
                </CardTitle>
                <CardDescription>Topics confusing students most</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {hotTopics.slice(0, 5).map((topic, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-orange-600">{topic.topic}</Badge>
                          {getTrendIcon(topic.trend)}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {topic.question_count} questions • {topic.student_count} students
                        </p>
                      </div>
                      {topic.trend === "rising" && (
                        <Badge variant="destructive">Trending ↑</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Difficulty Scores Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Topic Difficulty
                </CardTitle>
                <CardDescription>Auto-calculated from student interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {difficultyScores.slice(0, 5).map((topic, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{topic.topic}</span>
                        <Badge className={getDifficultyColor(topic.category)}>
                          {topic.category.replace('_', ' ')}
                        </Badge>
                      </div>
                      <Progress value={parseFloat(topic.difficulty_score)} className="h-2" />
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Score: {topic.difficulty_score}/100 • {topic.unique_students} students struggling
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Peak Usage Times */}
          {peakUsage?.hourlyUsage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Peak Usage Times
                </CardTitle>
                <CardDescription>When students need help most</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={peakUsage.hourlyUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="hour" 
                      tickFormatter={(value) => `${value}:00`}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => `${value}:00`}
                      formatter={(value: any) => [value, "Questions"]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="question_count" 
                      stroke="#8b5cf6" 
                      fill="#a78bfa" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                
                {peakUsage.peakHour && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      🔥 Peak Hour: {peakUsage.peakHour.hourFormatted} ({peakUsage.peakHour.questionCount} questions)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Live Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Real-Time Student Questions</h3>
            <Select value={activityMinutes.toString()} onValueChange={(v) => setActivityMinutes(parseInt(v))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Last 15 minutes</SelectItem>
                <SelectItem value="30">Last 30 minutes</SelectItem>
                <SelectItem value="60">Last hour</SelectItem>
                <SelectItem value="120">Last 2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {activity.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-purple-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{item.student_name}</Badge>
                          <Badge className="bg-purple-600">{item.topic || "General"}</Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(item.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Q: {item.message}
                        </p>
                        
                        {expandedActivity.includes(item.id) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800"
                          >
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              <strong>AI Response:</strong> {item.response}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              Response time: {(item.response_time / 1000).toFixed(2)}s
                            </p>
                          </motion.div>
                        )}
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActivityExpand(item.id)}
                      >
                        {expandedActivity.includes(item.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {activity.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No recent activity in the selected time range
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Hot Topics Tab */}
        <TabsContent value="hot-topics" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Trending Confusion Points</h3>
            <Select value={topicHours.toString()} onValueChange={(v) => setTopicHours(parseInt(v))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Last 6 hours</SelectItem>
                <SelectItem value="12">Last 12 hours</SelectItem>
                <SelectItem value="24">Last 24 hours</SelectItem>
                <SelectItem value="48">Last 2 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {hotTopics.map((topic, idx) => (
              <Card key={idx} className="border-2 border-orange-200 dark:border-orange-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Flame className="w-5 h-5 text-orange-600" />
                      {topic.topic}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(topic.trend)}
                      {topic.trendPercentage !== 0 && (
                        <Badge variant={topic.trend === "rising" ? "destructive" : "secondary"}>
                          {topic.trendPercentage > 0 ? "+" : ""}{topic.trendPercentage}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Questions</p>
                      <p className="text-2xl font-bold text-purple-600">{topic.question_count}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Students</p>
                      <p className="text-2xl font-bold text-blue-600">{topic.student_count}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Students asking:</p>
                    <div className="flex flex-wrap gap-1">
                      {topic.students?.slice(0, 5).map((student: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {student}
                        </Badge>
                      ))}
                      {topic.students?.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{topic.students.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Last asked: {new Date(topic.last_asked).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {hotTopics.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Flame className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No trending topics in the selected time range
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Struggles Tab */}
        <TabsContent value="struggles" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Students Needing Help</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Repeated questions indicate confusion
              </p>
            </div>
            <div className="flex items-center gap-3">
              {struggleStats && (
                <div className="flex gap-2">
                  <Badge variant="destructive">
                    {struggleStats.criticalCount} Critical
                  </Badge>
                  <Badge variant="secondary">
                    {struggleStats.highCount} High
                  </Badge>
                </div>
              )}
              <Select value={struggleHours.toString()} onValueChange={(v) => setStruggleHours(parseInt(v))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Last 3 hours</SelectItem>
                  <SelectItem value="6">Last 6 hours</SelectItem>
                  <SelectItem value="12">Last 12 hours</SelectItem>
                  <SelectItem value="24">Last 24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {struggles.map((struggle, idx) => (
              <Card 
                key={idx} 
                className={`border-l-4 ${
                  struggle.severity === "critical" ? "border-l-red-500" :
                  struggle.severity === "high" ? "border-l-orange-500" :
                  "border-l-yellow-500"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{struggle.student_name}</Badge>
                        <Badge variant="outline">{struggle.section}</Badge>
                        <Badge className="bg-purple-600">{struggle.topic}</Badge>
                        <Badge variant={getSeverityColor(struggle.severity)}>
                          {struggle.severity.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Questions</p>
                          <p className="text-xl font-bold text-red-600">{struggle.question_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Time Span</p>
                          <p className="text-xl font-bold">{Math.round(struggle.time_span_minutes)} min</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Rate</p>
                          <p className="text-xl font-bold">{struggle.questionsPerHour}/hr</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Recent questions:</p>
                        {struggle.messages?.slice(0, 2).map((msg: string, i: number) => (
                          <p key={i} className="text-sm text-gray-700 dark:text-gray-300 italic">
                            "{msg.substring(0, 100)}{msg.length > 100 ? '...' : ''}"
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className="text-xs text-gray-500">
                      Last asked: {new Date(struggle.last_asked).toLocaleString()}
                    </span>
                    <Button size="sm" variant="outline">
                      <Eye className="w-3 h-3 mr-1" />
                      View Full History
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {struggles.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No struggle alerts in the selected time range
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Students are doing great! 🎉
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Student AI Engagement</h3>
            <Select value={engagementDays.toString()} onValueChange={(v) => setEngagementDays(parseInt(v))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {engagement && (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Engagement Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "High (10+ questions)", value: engagement.engagementLevels.high, color: "#10b981" },
                            { name: "Medium (5-9 questions)", value: engagement.engagementLevels.medium, color: "#3b82f6" },
                            { name: "Low (1-4 questions)", value: engagement.engagementLevels.low, color: "#f59e0b" },
                            { name: "None", value: engagement.engagementLevels.none, color: "#ef4444" }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }: { name?: string; percent?: number }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: "High (10+ questions)", value: engagement.engagementLevels.high, color: "#10b981" },
                            { name: "Medium (5-9 questions)", value: engagement.engagementLevels.medium, color: "#3b82f6" },
                            { name: "Low (1-4 questions)", value: engagement.engagementLevels.low, color: "#f59e0b" },
                            { name: "None", value: engagement.engagementLevels.none, color: "#ef4444" }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Engagement Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Overall Engagement Rate</p>
                      <p className="text-3xl font-bold text-green-600">{engagement.engagementRate}%</p>
                      <Progress value={engagement.engagementRate} className="mt-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Active Users</p>
                        <p className="text-2xl font-bold text-blue-600">{engagement.activeUsers}</p>
                      </div>
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Inactive Users</p>
                        <p className="text-2xl font-bold text-red-600">{engagement.inactiveUsers}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Active Students</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Questions</TableHead>
                          <TableHead>Active Days</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {engagement.activeUsersList?.slice(0, 10).map((student: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{student.full_name}</p>
                                <p className="text-xs text-gray-500">{student.section}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-purple-600">{student.question_count}</Badge>
                            </TableCell>
                            <TableCell>{student.active_days}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Inactive Students</CardTitle>
                    <CardDescription>Students who haven't used AI recently</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {engagement.inactiveUsersList?.slice(0, 15).map((student: any, idx: number) => (
                          <div 
                            key={idx}
                            className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{student.full_name}</p>
                                <p className="text-xs text-gray-500">{student.section}</p>
                              </div>
                              {student.last_active ? (
                                <span className="text-xs text-gray-500">
                                  Last: {new Date(student.last_active).toLocaleDateString()}
                                </span>
                              ) : (
                                <Badge variant="outline">Never used</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Topic Difficulty & Analytics</h3>
            <Select value={difficultyDays.toString()} onValueChange={(v) => setDifficultyDays(parseInt(v))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {difficultySummary && (
            <Card>
              <CardHeader>
                <CardTitle>Difficulty Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-3">
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border-2 border-red-200 dark:border-red-800">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Very Hard</p>
                    <p className="text-2xl font-bold text-red-600">{difficultySummary.veryHard}</p>
                  </div>
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border-2 border-orange-200 dark:border-orange-800">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Hard</p>
                    <p className="text-2xl font-bold text-orange-600">{difficultySummary.hard}</p>
                  </div>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border-2 border-yellow-200 dark:border-yellow-800">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Moderate</p>
                    <p className="text-2xl font-bold text-yellow-600">{difficultySummary.moderate}</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Medium</p>
                    <p className="text-2xl font-bold text-blue-600">{difficultySummary.medium}</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border-2 border-green-200 dark:border-green-800">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Easy</p>
                    <p className="text-2xl font-bold text-green-600">{difficultySummary.easy}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Topic Difficulty Breakdown</CardTitle>
              <CardDescription>
                Auto-calculated based on questions asked, students struggling, and response times
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Avg Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {difficultyScores.map((topic, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{topic.topic}</TableCell>
                      <TableCell>
                        <Badge className={getDifficultyColor(topic.category)}>
                          {topic.category.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={parseFloat(topic.difficulty_score)} className="w-20" />
                          <span className="text-sm font-bold">{topic.difficulty_score}</span>
                        </div>
                      </TableCell>
                      <TableCell>{topic.total_questions}</TableCell>
                      <TableCell>{topic.unique_students}</TableCell>
                      <TableCell>{topic.avg_response_seconds}s</TableCell>
                      <TableCell>
                        {topic.needsAttention && (
                          <Badge variant="destructive">Needs Attention</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="ai-insights">
          <InstructorAIInsights instructorId={instructorId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

