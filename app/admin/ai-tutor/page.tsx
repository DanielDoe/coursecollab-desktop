"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  Brain, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MessageSquare,
  BarChart3,
  Eye,
  Filter,
  Search,
  Download,
  RefreshCw,
  Target,
  Zap,
  BookOpen,
  Code,
  Calculator,
  Award,
  Calendar,
  Activity,
  PieChart,
  LineChart
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AdminHeader } from "@/components/admin-header"

interface AIUsageStats {
  totalQuestions: number
  activeStudents: number
  averageResponseTime: number
  satisfactionScore: number
  strugglingStudents: number
  topTopics: { topic: string; questions: number; struggles: number }[]
}

interface StudentStruggle {
  id: string
  studentName: string
  studentId: string
  section: string
  topic: string
  struggleType: 'concept' | 'implementation' | 'debugging' | 'understanding'
  severity: 'low' | 'medium' | 'high' | 'critical'
  questionsAsked: number
  lastActivity: Date
  flaggedAt: Date
  status: 'new' | 'reviewed' | 'resolved'
  description: string
}

interface AIConversation {
  id: string
  studentName: string
  studentId: string
  section: string
  message: string
  response: string
  topic: string
  difficulty: string
  timestamp: Date
  satisfactionScore: number
  struggleIndicators: string[]
}

export default function AdminAITutorPage() {
  const [stats, setStats] = useState<AIUsageStats | null>(null)
  const [struggles, setStruggles] = useState<StudentStruggle[]>([])
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSeverity, setFilterSeverity] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  useEffect(() => {
    fetchAIStats()
    fetchStudentStruggles()
    fetchRecentConversations()
  }, [])

  const fetchAIStats = async () => {
    try {
      const response = await fetch("/api/admin/ai-tutor/stats")
      const data = await response.json()
      if (response.ok) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Failed to fetch AI stats:", error)
    }
  }

  const fetchStudentStruggles = async () => {
    try {
      const response = await fetch("/api/admin/ai-tutor/struggles")
      const data = await response.json()
      if (response.ok) {
        setStruggles(data.struggles)
      }
    } catch (error) {
      console.error("Failed to fetch struggles:", error)
    }
  }

  const fetchRecentConversations = async () => {
    try {
      const response = await fetch("/api/admin/ai-tutor/conversations")
      const data = await response.json()
      if (response.ok) {
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error("Failed to fetch conversations:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white'
      case 'high': return 'bg-orange-500 text-white'
      case 'medium': return 'bg-yellow-500 text-white'
      case 'low': return 'bg-green-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getStruggleTypeIcon = (type: string) => {
    switch (type) {
      case 'concept': return BookOpen
      case 'implementation': return Code
      case 'debugging': return AlertTriangle
      case 'understanding': return Brain
      default: return MessageSquare
    }
  }

  const filteredStruggles = struggles.filter(struggle => {
    const matchesSearch = struggle.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         struggle.topic.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSeverity = filterSeverity === "all" || struggle.severity === filterSeverity
    const matchesStatus = filterStatus === "all" || struggle.status === filterStatus
    return matchesSearch && matchesSeverity && matchesStatus
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
        <AdminHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading AI Tutor monitoring...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
      <AdminHeader />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                AI Tutor Monitoring
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Monitor student AI usage and identify learning struggles
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => fetchAIStats()}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8"
        >
          <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {stats?.totalQuestions || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Questions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {stats?.activeStudents || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Students</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {stats?.strugglingStudents || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Struggling Students</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {stats?.averageResponseTime || 0}s
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {stats?.satisfactionScore || 0}/5
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Satisfaction</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="struggles" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Student Struggles
            </TabsTrigger>
            <TabsTrigger value="conversations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <MessageSquare className="h-4 w-4 mr-2" />
              Conversations
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TrendingUp className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Top Topics */}
              <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    Most Discussed Topics
                  </CardTitle>
                  <CardDescription>
                    Topics students ask about most frequently
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stats?.topTopics.map((topic, index) => (
                    <motion.div
                      key={topic.topic}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                          <BookOpen className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {topic.topic}
                          </p>
                          <p className="text-sm text-gray-500">
                            {topic.questions} questions • {topic.struggles} struggles
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        #{index + 1}
                      </Badge>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-500" />
                    Recent AI Activity
                  </CardTitle>
                  <CardDescription>
                    Latest AI tutor interactions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {conversations.slice(0, 5).map((conversation, index) => (
                    <motion.div
                      key={conversation.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {conversation.studentName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {conversation.message.substring(0, 50)}...
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {conversation.timestamp.toLocaleTimeString()}
                        </p>
                        <Badge 
                          className={conversation.satisfactionScore >= 4 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}
                        >
                          {conversation.satisfactionScore}/5
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Student Struggles Tab */}
          <TabsContent value="struggles" className="space-y-6">
            {/* Filters */}
            <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search students or topics..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severity</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Struggles List */}
            <div className="space-y-4">
              {filteredStruggles.map((struggle, index) => {
                const IconComponent = getStruggleTypeIcon(struggle.struggleType)
                return (
                  <motion.div
                    key={struggle.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                              <IconComponent className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                  {struggle.studentName}
                                </h4>
                                <Badge variant="outline" className="text-xs">
                                  {struggle.studentId}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {struggle.section}
                                </Badge>
                              </div>
                              <p className="text-gray-600 dark:text-gray-400 mb-3">
                                <strong>Topic:</strong> {struggle.topic} • 
                                <strong> Type:</strong> {struggle.struggleType} • 
                                <strong> Questions:</strong> {struggle.questionsAsked}
                              </p>
                              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                                {struggle.description}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Clock className="h-3 w-3" />
                                Last activity: {struggle.lastActivity.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge className={getSeverityColor(struggle.severity)}>
                              {struggle.severity}
                            </Badge>
                            <Badge 
                              variant={struggle.status === 'new' ? 'default' : 'outline'}
                              className={struggle.status === 'new' ? 'bg-blue-500 text-white' : ''}
                            >
                              {struggle.status}
                            </Badge>
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4 mr-2" />
                              Review
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </TabsContent>

          {/* Conversations Tab */}
          <TabsContent value="conversations" className="space-y-6">
            <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                  Recent AI Conversations
                </CardTitle>
                <CardDescription>
                  Monitor student-AI interactions and identify patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {conversations.map((conversation, index) => (
                    <motion.div
                      key={conversation.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                            <Users className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {conversation.studentName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {conversation.studentId} • {conversation.section}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{conversation.topic}</Badge>
                          <Badge variant="outline">{conversation.difficulty}</Badge>
                          <Badge className={conversation.satisfactionScore >= 4 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                            {conversation.satisfactionScore}/5
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Student Question:
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                            {conversation.message}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            AI Response:
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            {conversation.response.substring(0, 200)}...
                          </p>
                        </div>
                        {conversation.struggleIndicators.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                              Struggle Indicators:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {conversation.struggleIndicators.map((indicator, idx) => (
                                <Badge key={idx} className="bg-red-100 text-red-700 text-xs">
                                  {indicator}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-500">
                          {conversation.timestamp.toLocaleString()}
                        </p>
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          View Full Conversation
                        </Button>
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
              <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-blue-500" />
                    Struggle Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <PieChart className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Struggle Analytics</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Detailed breakdown of student struggles by type and severity
                    </p>
                    <Button 
                      size="lg" 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                    >
                      <BarChart3 className="h-5 w-5 mr-2" />
                      View Detailed Analytics
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5 text-green-500" />
                    Usage Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <LineChart className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Usage Trends</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Track AI tutor usage patterns and student engagement over time
                    </p>
                    <Button 
                      size="lg" 
                      className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                    >
                      <TrendingUp className="h-5 w-5 mr-2" />
                      View Trends
                    </Button>
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

