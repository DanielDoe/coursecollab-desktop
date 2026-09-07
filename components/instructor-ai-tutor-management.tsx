"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  Brain, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Settings, 
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle,
  Target,
  Award,
  Zap,
  Star,
  Activity,
  Eye,
  Search,
  Filter,
  Download,
  RefreshCw,
  Bot,
  Code,
  BookOpen,
  Lightbulb,
  FileText,
  Calendar,
  User,
  MessageCircle,
  Shield,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Send,
  Copy,
  Share2,
  ExternalLink,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Edit,
  Plus,
  Minus,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Wand2,
  Crown,
  Trophy,
  Gamepad2,
  Terminal,
  Monitor,
  Server,
  Database,
  Cpu,
  HardDrive,
  PieChart,
  LineChart,
  BarChart,
  TrendingDown,
  Info,
  AlertTriangle,
  Bug,
  Phone,
  Video,
  Mail,
  FileX,
  UserCheck,
  Calendar as CalendarIcon,
  FileSearch,
  Layers,
  Shuffle,
  RotateCcw,
  RefreshCcw,
  Target as TargetIcon
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { useSessionCatalog } from "@/components/session-catalog-provider"
import { motion, AnimatePresence } from "framer-motion"
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts"

interface AIUsageStats {
  totalQuestions: number
  activeStudents: number
  averageResponseTime: number
  satisfactionScore: number
  strugglingStudents: number
  weeklyGrowth: number
  topTopics: Array<{
    topic: string
    questions: number
    struggles: number
  }>
}

interface StudentActivity {
  id: number
  name: string
  studentId: string
  section: string
  lastActive: string
  questionsAsked: number
  satisfactionScore: number
  weakTopics: string[]
  strugglingAreas: string[]
  progressTrend: "up" | "down" | "stable"
}

interface AIConversation {
  id: number
  studentName: string
  studentId: string
  section?: string
  message: string
  response: string
  topic: string
  difficulty: string
  timestamp: string
  satisfactionScore: number
  struggleIndicators: string[]
}

interface AIStruggle {
  id: number
  studentName: string
  studentId: string
  topic: string
  severity: "low" | "medium" | "high" | "critical"
  status: "new" | "reviewed" | "resolved" | "escalated"
  description: string
  lastUpdated: string
  conversationCount: number
}

interface AISettings {
  enableAITutor: boolean
  allowCodeDebugging: boolean
  allowPracticeGeneration: boolean
  maxResponseLength: number
  responseStyle: "helpful" | "concise" | "encouraging"
  aiModel: "auto" | "standard" | "reasoning"
  enableHints: boolean
  enableStepByStep: boolean
  enableCodeExamples: boolean
}

const MOCK_STUDENT_ACTIVITY: StudentActivity[] = [
  {
    id: 1,
    name: "John Doe",
    studentId: "STU001",
    section: "ELEG1301P01",
    lastActive: "2 hours ago",
    questionsAsked: 15,
    satisfactionScore: 4.2,
    weakTopics: ["Arrays", "Pointers"],
    strugglingAreas: ["Memory Management"],
    progressTrend: "up"
  },
  {
    id: 2,
    name: "Jane Smith",
    studentId: "STU002",
    section: "P02",
    lastActive: "5 hours ago",
    questionsAsked: 23,
    satisfactionScore: 4.8,
    weakTopics: ["Loops", "Functions"],
    strugglingAreas: ["Algorithm Complexity"],
    progressTrend: "stable"
  },
  {
    id: 3,
    name: "Bob Johnson",
    studentId: "STU003",
    section: "P05",
    lastActive: "1 day ago",
    questionsAsked: 8,
    satisfactionScore: 3.1,
    weakTopics: ["Classes", "Inheritance"],
    strugglingAreas: ["OOP Concepts", "Polymorphism"],
    progressTrend: "down"
  },
  {
    id: 4,
    name: "Alice Williams",
    studentId: "STU004",
    section: "ELEG1301P01",
    lastActive: "3 hours ago",
    questionsAsked: 31,
    satisfactionScore: 4.6,
    weakTopics: ["Recursion", "Data Structures"],
    strugglingAreas: ["Tree Traversal"],
    progressTrend: "up"
  }
]

const MOCK_CONVERSATIONS: AIConversation[] = [
  {
    id: 1,
    studentName: "John Doe",
    studentId: "STU001",
    message: "I don't understand how pointers work in C++. Can you explain with examples?",
    response: "Pointers in C++ are variables that store memory addresses...",
    topic: "Pointers",
    difficulty: "Intermediate",
    timestamp: "2024-01-15T10:30:00Z",
    satisfactionScore: 4,
    struggleIndicators: ["confusion", "understanding"]
  },
  {
    id: 2,
    studentName: "Jane Smith",
    studentId: "STU002",
    message: "Help me debug this code that's causing a segmentation fault",
    response: "Looking at your code, the issue appears to be...",
    topic: "Debugging",
    difficulty: "Advanced",
    timestamp: "2024-01-15T09:15:00Z",
    satisfactionScore: 5,
    struggleIndicators: ["debugging", "technical_issues"]
  }
]

const MOCK_STRUGGLES: AIStruggle[] = [
  {
    id: 1,
    studentName: "Bob Johnson",
    studentId: "STU003",
    topic: "OOP Concepts",
    severity: "high",
    status: "new",
    description: "Student struggling with inheritance and polymorphism concepts",
    lastUpdated: "2024-01-15T08:45:00Z",
    conversationCount: 5
  },
  {
    id: 2,
    studentName: "Alice Williams",
    studentId: "STU004",
    topic: "Data Structures",
    severity: "medium",
    status: "reviewed",
    description: "Difficulty understanding tree traversal algorithms",
    lastUpdated: "2024-01-14T16:20:00Z",
    conversationCount: 3
  }
]

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#84CC16", "#F97316"]

export function InstructorAITutorManagement() {
  const { selectOptions } = useSessionCatalog()
  const router = useRouter()
  const { toast } = useToast()
  
  // State management
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AIUsageStats | null>(null)
  const [studentActivity, setStudentActivity] = useState<StudentActivity[]>([])
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [struggles, setStruggles] = useState<AIStruggle[]>([])
  const [settings, setSettings] = useState<AISettings>({
    enableAITutor: true,
    allowCodeDebugging: true,
    allowPracticeGeneration: true,
    maxResponseLength: 500,
    responseStyle: "helpful",
    aiModel: "auto",
    enableHints: true,
    enableStepByStep: true,
    enableCodeExamples: true
  })

  // UI State
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedStudent, setSelectedStudent] = useState<StudentActivity | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<AIConversation | null>(null)
  const [selectedStruggle, setSelectedStruggle] = useState<AIStruggle | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSection, setFilterSection] = useState("all")
  const [filterSeverity, setFilterSeverity] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

  // Authentication check
  useEffect(() => {
    const instructorSession = localStorage.getItem("instructorSession")
    if (!instructorSession) {
      router.push("/instructor/login")
      return
    }
    
    fetchData()
  }, [router])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch AI stats
      const statsResponse = await instructorApiFetch("/api/instructor/ai-tutor/stats")
      const statsData = await statsResponse.json()
      if (statsResponse.ok) {
        setStats(statsData.stats)
      } else {
        // Use mock data if API fails
        setStats({
          totalQuestions: 1247,
          activeStudents: 89,
          averageResponseTime: 1.8,
          satisfactionScore: 4.3,
          strugglingStudents: 12,
          weeklyGrowth: 15.2,
          topTopics: [
            { topic: "Arrays", questions: 156, struggles: 23 },
            { topic: "Pointers", questions: 134, struggles: 31 },
            { topic: "Classes", questions: 98, struggles: 18 },
            { topic: "Functions", questions: 87, struggles: 12 },
            { topic: "Loops", questions: 76, struggles: 8 }
          ]
        })
      }

      // Fetch student activity
      const activityResponse = await instructorApiFetch("/api/instructor/ai-tutor/activity")
      const activityData = await activityResponse.json()
      if (activityResponse.ok) {
        setStudentActivity(activityData.activity)
      } else {
        setStudentActivity(MOCK_STUDENT_ACTIVITY)
      }

      // Fetch conversations
      const conversationsResponse = await instructorApiFetch("/api/instructor/ai-tutor/conversations")
      const conversationsData = await conversationsResponse.json()
      if (conversationsResponse.ok) {
        setConversations(conversationsData.conversations)
      } else {
        setConversations(MOCK_CONVERSATIONS)
      }

      // Fetch struggles
      const strugglesResponse = await instructorApiFetch("/api/instructor/ai-tutor/struggles")
      const strugglesData = await strugglesResponse.json()
      if (strugglesResponse.ok) {
        setStruggles(strugglesData.struggles)
      } else {
        setStruggles(MOCK_STRUGGLES)
      }

    } catch (error) {
      console.error("Failed to fetch AI tutor data:", error)
      toast({
        title: "❌ Failed to Load AI Tutor Data",
        description: "Could not retrieve AI tutor information. Using mock data for demonstration.",
        variant: "destructive",
      })
      
      // Set mock data as fallback
      setStats({
        totalQuestions: 1247,
        activeStudents: 89,
        averageResponseTime: 1.8,
        satisfactionScore: 4.3,
        strugglingStudents: 12,
        weeklyGrowth: 15.2,
        topTopics: [
          { topic: "Arrays", questions: 156, struggles: 23 },
          { topic: "Pointers", questions: 134, struggles: 31 },
          { topic: "Classes", questions: 98, struggles: 18 },
          { topic: "Functions", questions: 87, struggles: 12 },
          { topic: "Loops", questions: 76, struggles: 8 }
        ]
      })
      setStudentActivity(MOCK_STUDENT_ACTIVITY)
      setConversations(MOCK_CONVERSATIONS)
      setStruggles(MOCK_STRUGGLES)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/ai-tutor/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        toast({
          title: "✅ AI Tutor Settings Saved",
          description: "AI tutor configuration has been updated successfully. Changes will take effect immediately.",
        })
      } else {
        throw new Error("Failed to save settings")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Save Settings",
        description: "Could not update AI tutor settings. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateStruggleStatus = async (struggleId: number, newStatus: string) => {
    try {
      const response = await instructorApiFetch(`/api/instructor/ai-tutor/struggles/${struggleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        toast({
          title: "✅ Status Updated",
          description: `Struggle status has been updated to ${newStatus}.`,
        })
        fetchData() // Refresh data
      } else {
        throw new Error("Failed to update status")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Update Status",
        description: "Could not update struggle status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500"
      case "high": return "bg-orange-500"
      case "medium": return "bg-yellow-500"
      case "low": return "bg-green-500"
      default: return "bg-gray-500"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-500"
      case "reviewed": return "bg-purple-500"
      case "resolved": return "bg-green-500"
      case "escalated": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  const getProgressTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUp className="h-4 w-4 text-green-500" />
      case "down": return <TrendingDown className="h-4 w-4 text-red-500" />
      case "stable": return <Minus className="h-4 w-4 text-gray-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const filteredStudentActivity = studentActivity.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.studentId.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSection = filterSection === "all" || student.section === filterSection
    return matchesSearch && matchesSection
  })

  const filteredStruggles = struggles.filter(struggle => {
    const matchesSeverity = filterSeverity === "all" || struggle.severity === filterSeverity
    const matchesStatus = filterStatus === "all" || struggle.status === filterStatus
    return matchesSeverity && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-slate-600">Loading AI Tutor Management...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
                <Brain className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  AI Tutor Management
                </h1>
                <p className="text-slate-600 text-sm mt-1">
                  Monitor student interactions, analyze performance, and configure AI settings
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={fetchData}
              className="gap-2 bg-white border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push("/instructor/dashboard")}
              className="gap-2 bg-white border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  Total Questions
                </CardDescription>
                <CardTitle className="text-3xl text-blue-600">{stats.totalQuestions.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">+{stats.weeklyGrowth}% this week</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-500" />
                  Active Students
                </CardDescription>
                <CardTitle className="text-3xl text-green-600">{stats.activeStudents}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">Using AI Tutor this week</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  Avg Response Time
                </CardDescription>
                <CardTitle className="text-3xl text-purple-600">{stats.averageResponseTime}s</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">Average across all sessions</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-orange-500" />
                  Satisfaction Score
                </CardDescription>
                <CardTitle className="text-3xl text-orange-600">{stats.satisfactionScore}/5.0</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">Student feedback rating</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-sm rounded-xl">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="students" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg">
              <Users className="h-4 w-4 mr-2" />
              Students
            </TabsTrigger>
            <TabsTrigger value="conversations" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg">
              <MessageSquare className="h-4 w-4 mr-2" />
              Conversations
            </TabsTrigger>
            <TabsTrigger value="struggles" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg">
              <AlertCircle className="h-4 w-4 mr-2" />
              Struggles
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Topics Chart */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-500" />
                    Top Topics by Questions
                  </CardTitle>
                  <CardDescription>Most discussed topics with students</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsBarChart data={stats?.topTopics || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="topic" />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="questions" fill="#8B5CF6" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Struggles Overview */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    Student Struggles
                  </CardTitle>
                  <CardDescription>Current areas where students need help</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {struggles.slice(0, 5).map((struggle) => (
                      <div key={struggle.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getSeverityColor(struggle.severity)}`} />
                          <div>
                            <p className="font-medium text-slate-900">{struggle.studentName}</p>
                            <p className="text-sm text-slate-600">{struggle.topic}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`${getStatusColor(struggle.status)} text-white border-0`}>
                          {struggle.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest AI tutor interactions and updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {conversations.slice(0, 5).map((conversation) => (
                    <div key={conversation.id} className="flex items-center space-x-3 p-3 rounded-lg bg-slate-50">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {conversation.studentName} asked about {conversation.topic}
                        </p>
                        <p className="text-xs text-slate-600">
                          {new Date(conversation.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium">{conversation.satisfactionScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      Student Activity
                    </CardTitle>
                    <CardDescription>Monitor individual student AI tutor usage and progress</CardDescription>
                  </div>
                  <div className="flex gap-3">
                    <Input
                      placeholder="Search students..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64"
                    />
                    <Select value={filterSection} onValueChange={setFilterSection}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        {selectOptions.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Questions Asked</TableHead>
                      <TableHead>Satisfaction</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudentActivity.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          <div>
                            <p>{student.name}</p>
                            <p className="text-sm text-slate-500">{student.studentId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{student.section}</Badge>
                        </TableCell>
                        <TableCell>{student.lastActive}</TableCell>
                        <TableCell>{student.questionsAsked}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span>{student.satisfactionScore}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getProgressTrendIcon(student.progressTrend)}
                            <span className="text-sm capitalize">{student.progressTrend}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedStudent(student)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversations Tab */}
          <TabsContent value="conversations" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                  Recent Conversations
                </CardTitle>
                <CardDescription>Review student-AI interactions and responses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {conversations.map((conversation) => (
                    <div key={conversation.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <User className="h-5 w-5 text-blue-500" />
                          <div>
                            <p className="font-medium text-slate-900">{conversation.studentName}</p>
                            <p className="text-sm text-slate-600">{conversation.studentId} • {conversation.section}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-purple-600 border-purple-200">
                            {conversation.difficulty}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-medium">{conversation.satisfactionScore}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-sm font-medium text-blue-900 mb-1">Student Question:</p>
                          <p className="text-sm text-blue-800">{conversation.message}</p>
                        </div>
                        
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-sm font-medium text-green-900 mb-1">AI Response:</p>
                          <p className="text-sm text-green-800 line-clamp-3">{conversation.response}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-blue-600 border-blue-200">
                            {conversation.topic}
                          </Badge>
                          {conversation.struggleIndicators.map((indicator, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {indicator}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {new Date(conversation.timestamp).toLocaleString()}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedConversation(conversation)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Struggles Tab */}
          <TabsContent value="struggles" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      Student Struggles
                    </CardTitle>
                    <CardDescription>Monitor and manage students who need additional support</CardDescription>
                  </div>
                  <div className="flex gap-3">
                    <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="reviewed">Reviewed</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="escalated">Escalated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredStruggles.map((struggle) => (
                    <div key={struggle.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getSeverityColor(struggle.severity)}`} />
                          <div>
                            <p className="font-medium text-slate-900">{struggle.studentName}</p>
                            <p className="text-sm text-slate-600">{struggle.studentId}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`${getSeverityColor(struggle.severity)} text-white border-0`}>
                            {struggle.severity}
                          </Badge>
                          <Badge variant="outline" className={`${getStatusColor(struggle.status)} text-white border-0`}>
                            {struggle.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm text-slate-700">{struggle.description}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-purple-600 border-purple-200">
                            {struggle.topic}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {struggle.conversationCount} conversations
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-slate-500">
                          Last updated: {new Date(struggle.lastUpdated).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-2">
                          <Select
                            value={struggle.status}
                            onValueChange={(value) => handleUpdateStruggleStatus(struggle.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="reviewed">Reviewed</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="escalated">Escalated</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedStruggle(struggle)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-blue-500" />
                  AI Tutor Configuration
                </CardTitle>
                <CardDescription>Configure AI tutor behavior and response settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enable-tutor" className="text-base font-medium">
                        Enable AI Tutor
                      </Label>
                      <p className="text-sm text-slate-600">Allow students to access the AI Tutor module</p>
                    </div>
                    <Switch
                      id="enable-tutor"
                      checked={settings.enableAITutor}
                      onCheckedChange={(checked) => setSettings({...settings, enableAITutor: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="code-debugging" className="text-base font-medium">
                        Allow Code Debugging Help
                      </Label>
                      <p className="text-sm text-slate-600">Let students paste code and get debugging assistance</p>
                    </div>
                    <Switch
                      id="code-debugging"
                      checked={settings.allowCodeDebugging}
                      onCheckedChange={(checked) => setSettings({...settings, allowCodeDebugging: checked})}
                      disabled={!settings.enableAITutor}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="practice-generation" className="text-base font-medium">
                        Allow Practice Generation
                      </Label>
                      <p className="text-sm text-slate-600">Enable AI to generate practice problems for students</p>
                    </div>
                    <Switch
                      id="practice-generation"
                      checked={settings.allowPracticeGeneration}
                      onCheckedChange={(checked) => setSettings({...settings, allowPracticeGeneration: checked})}
                      disabled={!settings.enableAITutor}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai-model">Cora routing</Label>
                    <Select
                      value={settings.aiModel === "standard" || settings.aiModel === "reasoning" ? settings.aiModel : "auto"}
                      onValueChange={(value) =>
                        setSettings({ ...settings, aiModel: value as AISettings["aiModel"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Smart routing</SelectItem>
                        <SelectItem value="standard">Everyday Cora</SelectItem>
                        <SelectItem value="reasoning">Allow Advanced Reasoning</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="response-style">Response Style</Label>
                    <Select
                      value={settings.responseStyle}
                      onValueChange={(value: "helpful" | "concise" | "encouraging") => setSettings({...settings, responseStyle: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="helpful">Helpful & Detailed</SelectItem>
                        <SelectItem value="concise">Concise & Direct</SelectItem>
                        <SelectItem value="encouraging">Encouraging & Supportive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-response-length">Max Response Length</Label>
                    <Input
                      id="max-response-length"
                      type="number"
                      value={settings.maxResponseLength}
                      onChange={(e) => setSettings({...settings, maxResponseLength: parseInt(e.target.value)})}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enable-hints" className="text-base font-medium">
                        Enable Hints Before Full Answers
                      </Label>
                      <p className="text-sm text-slate-600">Provide hints to guide students before giving complete solutions</p>
                    </div>
                    <Switch
                      id="enable-hints"
                      checked={settings.enableHints}
                      onCheckedChange={(checked) => setSettings({...settings, enableHints: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enable-step-by-step" className="text-base font-medium">
                        Enable Step-by-Step Explanations
                      </Label>
                      <p className="text-sm text-slate-600">Break down complex solutions into manageable steps</p>
                    </div>
                    <Switch
                      id="enable-step-by-step"
                      checked={settings.enableStepByStep}
                      onCheckedChange={(checked) => setSettings({...settings, enableStepByStep: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enable-code-examples" className="text-base font-medium">
                        Enable Code Examples
                      </Label>
                      <p className="text-sm text-slate-600">Include practical code examples in responses</p>
                    </div>
                    <Switch
                      id="enable-code-examples"
                      checked={settings.enableCodeExamples}
                      onCheckedChange={(checked) => setSettings({...settings, enableCodeExamples: checked})}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button onClick={handleSaveSettings} className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700">
                    <Settings className="h-4 w-4 mr-2" />
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Student Details Dialog */}
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-500" />
                Student Details: {selectedStudent?.name}
              </DialogTitle>
              <DialogDescription>
                Comprehensive view of student's AI tutor interactions and progress
              </DialogDescription>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{selectedStudent.questionsAsked}</div>
                      <div className="text-sm text-slate-600">Questions Asked</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{selectedStudent.satisfactionScore}</div>
                      <div className="text-sm text-slate-600">Satisfaction Score</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">{selectedStudent.weakTopics.length}</div>
                      <div className="text-sm text-slate-600">Weak Topics</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">{selectedStudent.strugglingAreas.length}</div>
                      <div className="text-sm text-slate-600">Struggling Areas</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Weak Topics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedStudent.weakTopics.map((topic, index) => (
                          <Badge key={index} variant="outline" className="text-orange-600 border-orange-200">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Struggling Areas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedStudent.strugglingAreas.map((area, index) => (
                          <Badge key={index} variant="outline" className="text-red-600 border-red-200">
                            {area}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Conversation Details Dialog */}
        <Dialog open={!!selectedConversation} onOpenChange={() => setSelectedConversation(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-green-500" />
                Conversation Details
              </DialogTitle>
              <DialogDescription>
                Full conversation between {selectedConversation?.studentName} and AI Tutor
              </DialogDescription>
            </DialogHeader>
            {selectedConversation && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedConversation.studentName}</p>
                    <p className="text-sm text-slate-600">{selectedConversation.studentId} • {selectedConversation.section}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-purple-600 border-purple-200">
                      {selectedConversation.difficulty}
                    </Badge>
                    <Badge variant="outline" className="text-blue-600 border-blue-200">
                      {selectedConversation.topic}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium">{selectedConversation.satisfactionScore}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="font-medium text-blue-900 mb-2">Student Question:</p>
                    <p className="text-blue-800">{selectedConversation.message}</p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="font-medium text-green-900 mb-2">AI Response:</p>
                    <p className="text-green-800 whitespace-pre-wrap">{selectedConversation.response}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    {selectedConversation.struggleIndicators.map((indicator, index) => (
                      <Badge key={index} variant="secondary">
                        {indicator}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-sm text-slate-500">
                    {new Date(selectedConversation.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Struggle Details Dialog */}
        <Dialog open={!!selectedStruggle} onOpenChange={() => setSelectedStruggle(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Struggle Details
              </DialogTitle>
              <DialogDescription>
                Detailed information about {selectedStruggle?.studentName}'s learning difficulty
              </DialogDescription>
            </DialogHeader>
            {selectedStruggle && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-lg">{selectedStruggle.studentName}</p>
                    <p className="text-slate-600">{selectedStruggle.studentId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`${getSeverityColor(selectedStruggle.severity)} text-white border-0`}>
                      {selectedStruggle.severity}
                    </Badge>
                    <Badge variant="outline" className={`${getStatusColor(selectedStruggle.status)} text-white border-0`}>
                      {selectedStruggle.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-slate-900 mb-1">Topic:</p>
                    <Badge variant="outline" className="text-purple-600 border-purple-200">
                      {selectedStruggle.topic}
                    </Badge>
                  </div>

                  <div>
                    <p className="font-medium text-slate-900 mb-1">Description:</p>
                    <p className="text-slate-700">{selectedStruggle.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium text-slate-900 mb-1">Conversations:</p>
                      <p className="text-slate-600">{selectedStruggle.conversationCount}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 mb-1">Last Updated:</p>
                      <p className="text-slate-600">{new Date(selectedStruggle.lastUpdated).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Select
                    value={selectedStruggle.status}
                    onValueChange={(value) => handleUpdateStruggleStatus(selectedStruggle.id, value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="escalated">Escalated</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => setSelectedStruggle(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
