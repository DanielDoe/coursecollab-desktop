"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Target, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Star,
  BookOpen,
  Code,
  Brain,
  Zap,
  Award,
  Calendar,
  Users,
  MessageSquare,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  Minus,
  ArrowLeft
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { StudentHeader } from "@/components/student-header"
import { useRouter } from "next/navigation"

interface AnalyticsData {
  overallProgress: number
  weeklyActivity: number[]
  topicMastery: {
    topic: string
    mastery: number
    questionsAsked: number
    accuracy: number
  }[]
  learningStreak: number
  totalQuestions: number
  averageResponseTime: number
  satisfactionScore: number
  studyTime: {
    daily: number
    weekly: number
    monthly: number
  }
  performanceMetrics: {
    quizzes: { attempted: number; average: number }
    homeworks: { completed: number; average: number }
    exams: { attempted: number; average: number }
  }
  aiInsights: {
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
  }
}

export default function AITutorAnalyticsPage() {
  const router = useRouter()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  const fetchAnalyticsData = async () => {
    try {
      const response = await fetch("/api/ai-tutor/analytics")
      const data = await response.json()
      if (response.ok) {
        setAnalyticsData(data.analytics)
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getProgressColor = (value: number) => {
    if (value >= 80) return "text-green-600"
    if (value >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getProgressBgColor = (value: number) => {
    if (value >= 80) return "bg-green-500"
    if (value >= 60) return "bg-yellow-500"
    return "bg-red-500"
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
        <StudentHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--cc-accent)] mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your learning analytics...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
      <StudentHeader />
      
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 sm:mb-8 relative"
        >
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 dark:from-indigo-600 dark:to-purple-600 flex items-center justify-center shrink-0">
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 break-words">
                <span className="sm:hidden">Analytics</span>
                <span className="hidden sm:inline">Learning Analytics</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 break-words">
                <span className="sm:hidden">Track progress</span>
                <span className="hidden sm:inline">Track your progress and optimize your learning journey</span>
              </p>
            </div>
          </div>
          
          {/* Back Button - Floating to the right on mobile, full button on desktop */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/student/ai-tutor")}
            className="absolute top-0 right-0 sm:relative sm:top-auto sm:right-auto ml-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4 shrink-0 dark:border-slate-600 dark:text-slate-300"
            title="Back to AI Tutor"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 shrink-0" />
            <span className="hidden sm:inline">Back to AI Tutor</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </motion.div>

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8"
        >
          <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl sm:rounded-2xl">
            <CardContent className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 dark:from-green-600 dark:to-emerald-600 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {analyticsData?.overallProgress || 0}%
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    <span className="sm:hidden">Progress</span>
                    <span className="hidden sm:inline">Overall Progress</span>
                  </p>
                </div>
              </div>
              <Progress 
                value={analyticsData?.overallProgress || 0} 
                className="mt-2 sm:mt-3 h-1.5 sm:h-2"
              />
            </CardContent>
          </Card>

          <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl sm:rounded-2xl">
            <CardContent className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 dark:from-blue-600 dark:to-cyan-600 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {analyticsData?.totalQuestions || 0}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    <span className="sm:hidden">Questions</span>
                    <span className="hidden sm:inline">Questions Asked</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl sm:rounded-2xl">
            <CardContent className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-orange-500 to-red-500 dark:from-orange-600 dark:to-red-600 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {analyticsData?.learningStreak || 0}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Day Streak</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl sm:rounded-2xl">
            <CardContent className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 dark:from-purple-600 dark:to-pink-600 flex items-center justify-center shrink-0">
                  <Star className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {analyticsData?.satisfactionScore || 0}/5
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Satisfaction</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-lg sm:rounded-xl p-1 h-auto">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:text-white text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-4 rounded-md sm:rounded-lg">
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
              <span className="sm:hidden">Overview</span>
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="topics" className="data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:text-white text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-4 rounded-md sm:rounded-lg">
              <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
              Topics
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:text-white text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-4 rounded-md sm:rounded-lg">
              <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
              <span className="sm:hidden">Perf</span>
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:text-white text-xs sm:text-sm h-9 sm:h-10 px-2 sm:px-4 rounded-md sm:rounded-lg">
              <Brain className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
              <span className="sm:hidden">Insights</span>
              <span className="hidden sm:inline">AI Insights</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Weekly Activity */}
              <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl sm:rounded-2xl">
                <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg dark:text-gray-100">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400 shrink-0" />
                    <span className="sm:hidden">Weekly</span>
                    <span className="hidden sm:inline">Weekly Activity</span>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm dark:text-gray-400">
                    <span className="sm:hidden">Activity over past 7 days</span>
                    <span className="hidden sm:inline">Your learning activity over the past 7 days</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="space-y-3 sm:space-y-4">
                    {analyticsData?.weeklyActivity.map((activity, index) => (
                      <div key={index} className="flex items-center gap-2 sm:gap-3">
                        <div className="w-12 sm:w-16 text-xs sm:text-sm text-gray-600 dark:text-gray-400 shrink-0">
                          Day {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Progress value={activity} className="h-1.5 sm:h-2" />
                        </div>
                        <div className="w-10 sm:w-12 text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 shrink-0">
                          {activity}%
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Study Time */}
              <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-xl sm:rounded-2xl">
                <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg dark:text-gray-100">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 dark:text-green-400 shrink-0" />
                    Study Time
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm dark:text-gray-400">
                    <span className="sm:hidden">Time with AI Tutor</span>
                    <span className="hidden sm:inline">Time spent learning with AI Tutor</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 space-y-2 sm:space-y-3 md:space-y-4">
                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-500 dark:bg-blue-600 flex items-center justify-center shrink-0">
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <span className="font-medium text-sm sm:text-base dark:text-gray-200">Today</span>
                    </div>
                    <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                      {analyticsData?.studyTime.daily || 0}h
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-green-500 dark:bg-green-600 flex items-center justify-center shrink-0">
                        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <span className="font-medium text-sm sm:text-base dark:text-gray-200">This Week</span>
                    </div>
                    <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                      {analyticsData?.studyTime.weekly || 0}h
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-purple-500 dark:bg-purple-600 flex items-center justify-center shrink-0">
                        <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                      </div>
                      <span className="font-medium text-sm sm:text-base dark:text-gray-200">This Month</span>
                    </div>
                    <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                      {analyticsData?.studyTime.monthly || 0}h
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Topics Tab */}
          <TabsContent value="topics" className="space-y-6">
            <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-500" />
                  Topic Mastery
                </CardTitle>
                <CardDescription>
                  Your progress across different programming topics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analyticsData?.topicMastery.map((topic, index) => (
                  <motion.div
                    key={topic.topic}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Card className="border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                            {topic.topic}
                          </h4>
                          <Badge className={getProgressBgColor(topic.mastery)}>
                            {topic.mastery}%
                          </Badge>
                        </div>
                        <Progress value={topic.mastery} className="mb-3" />
                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                          <span>{topic.questionsAsked} questions asked</span>
                          <span>{topic.accuracy}% accuracy</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5 text-blue-500" />
                    Quizzes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      {analyticsData?.performanceMetrics.quizzes.average || 0}%
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Average Score
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span>{analyticsData?.performanceMetrics.quizzes.attempted || 0} attempted</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-green-500" />
                    Homeworks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      {analyticsData?.performanceMetrics.homeworks.average || 0}%
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Average Score
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span>{analyticsData?.performanceMetrics.homeworks.completed || 0} completed</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-purple-500" />
                    Exams
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      {analyticsData?.performanceMetrics.exams.average || 0}%
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Average Score
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span>{analyticsData?.performanceMetrics.exams.attempted || 0} attempted</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Strengths */}
              <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Your Strengths
                  </CardTitle>
                  <CardDescription>
                    Areas where you excel
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analyticsData?.aiInsights.strengths.map((strength, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20"
                    >
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{strength}</span>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>

              {/* Weaknesses */}
              <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    Areas to Improve
                  </CardTitle>
                  <CardDescription>
                    Focus areas for better performance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analyticsData?.aiInsights.weaknesses.map((weakness, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20"
                    >
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{weakness}</span>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-blue-500" />
                    AI Recommendations
                  </CardTitle>
                  <CardDescription>
                    Personalized learning suggestions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analyticsData?.aiInsights.recommendations.map((recommendation, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20"
                    >
                      <Lightbulb className="h-5 w-5 text-blue-500" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{recommendation}</span>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
