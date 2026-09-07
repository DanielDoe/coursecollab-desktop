"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ClipboardList,
  BarChart3,
  Users,
  Calendar,
  UsersRound,
  FolderKanban,
  BookOpen,
  FileText,
  GraduationCap,
  Brain,
  Presentation,
  Pin,
  Clock,
  Search,
  X,
  GripVertical,
  TrendingUp,
  Activity,
  AlertCircle,
  CheckCircle,
  Zap,
  Shield,
  Target,
  Rocket,
  Star,
  Award,
  Crown,
  Flame,
  Heart,
  Eye,
  MessageSquare,
  Bell,
  Settings,
  Database,
  Server,
  Cpu,
  HardDrive,
  Wifi,
  Globe,
  Lock,
  Unlock,
  RefreshCw,
  Download,
  Upload,
  Filter,
  MoreHorizontal,
  User,
  Plus,
  HelpCircle,
  DollarSign,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"

interface DashboardStats {
  totalQuizzes: number
  activeQuizzes: number
  totalStudents: number
  totalAttempts: number
  pendingIssues: number
  systemHealth: number
  activeUsers: number
  upcomingAssessments: number
}

interface Module {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
  borderColor: string
  bgGradient: string
  isFavorite: boolean
  displayOrder: number
  usageCount: number
  lastAccessed: string | null
}

interface RecentActivity {
  id: string
  type: "submission" | "comment" | "notification" | "issue"
  title: string
  description: string
  timestamp: string
  user: string
  status: "pending" | "completed" | "resolved"
}

interface SystemHealth {
  uptime: string
  databaseStatus: "healthy" | "warning" | "error"
  apiLatency: number
  memoryUsage: number
  diskUsage: number
  activeConnections: number
}

export function AdminDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [adminUsername, setAdminUsername] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("overview")

  const allModules: Omit<Module, "isFavorite" | "displayOrder" | "usageCount" | "lastAccessed">[] = [
    {
      id: "manage-quizzes",
      title: "Manage Quizzes",
      description: "Create, edit, and delete quizzes",
      icon: ClipboardList,
      href: "/admin/quizzes",
      color: "pink-500",
      borderColor: "border-2 border-pink-500/30",
      bgGradient: "bg-gradient-to-br from-pink-500/5 to-transparent",
    },
    {
      id: "question-bank",
      title: "Question Bank",
      description: "Manage reusable questions",
      icon: BookOpen,
      href: "/admin/question-bank",
      color: "purple-500",
      borderColor: "border-2 border-purple-500/30",
      bgGradient: "bg-gradient-to-br from-purple-500/5 to-transparent",
    },
    {
      id: "practice-hub",
      title: "Practice Hub Management",
      description: "Control practice topics and view analytics",
      icon: Brain,
      href: "/admin/practice-hub-management",
      color: "orange-500",
      borderColor: "border-2 border-orange-500/30",
      bgGradient: "bg-gradient-to-br from-orange-500/5 to-transparent",
    },
    {
      id: "manage-students",
      title: "Manage Students",
      description: "Add, edit, and delete students",
      icon: Users,
      href: "/admin/students",
      color: "rose-500",
      borderColor: "border-2 border-rose-500/30",
      bgGradient: "bg-gradient-to-br from-rose-500/5 to-transparent",
    },
    {
      id: "view-results",
      title: "View Results",
      description: "See student performance and export data",
      icon: BarChart3,
      href: "/admin/results",
      color: "cyan-500",
      borderColor: "border-2 border-cyan-500/30",
      bgGradient: "bg-gradient-to-br from-cyan-500/5 to-transparent",
    },
    {
      id: "ai-evaluation",
      title: "AI Evaluation System",
      description: "Configure AI grading and monitor performance",
      icon: Brain,
      href: "/admin/ai-evaluation",
      color: "violet-500",
      borderColor: "border-2 border-violet-500/30",
      bgGradient: "bg-gradient-to-br from-violet-500/5 to-transparent",
    },
    {
      id: "sessions",
      title: "Manage Sessions",
      description: "Create and manage course sections",
      icon: Calendar,
      href: "/admin/sessions",
      color: "teal-500",
      borderColor: "border-2 border-teal-500/30",
      bgGradient: "bg-gradient-to-br from-teal-500/5 to-transparent",
    },
    {
      id: "groups",
      title: "Manage Groups",
      description: "View and manage student groups",
      icon: UsersRound,
      href: "/admin/groups",
      color: "blue-500",
      borderColor: "border-2 border-blue-500/30",
      bgGradient: "bg-gradient-to-br from-blue-500/5 to-transparent",
    },
    {
      id: "projects",
      title: "Manage Projects",
      description: "View and manage group projects",
      icon: FolderKanban,
      href: "/admin/projects",
      color: "indigo-500",
      borderColor: "border-2 border-indigo-500/30",
      bgGradient: "bg-gradient-to-br from-indigo-500/5 to-transparent",
    },
    {
      id: "homeworks",
      title: "Manage Homeworks",
      description: "Create and manage homework assignments",
      icon: BookOpen,
      href: "/admin/homeworks",
      color: "emerald-500",
      borderColor: "border-2 border-emerald-500/30",
      bgGradient: "bg-gradient-to-br from-emerald-500/5 to-transparent",
    },
    {
      id: "mid-semester-exams",
      title: "Manage Mid-Semester Exams",
      description: "Create and manage mid-semester exams",
      icon: FileText,
      href: "/admin/mid-semester-exams",
      color: "amber-500",
      borderColor: "border-2 border-amber-500/30",
      bgGradient: "bg-gradient-to-br from-amber-500/5 to-transparent",
    },
    {
      id: "final-exams",
      title: "Manage Final Exams",
      description: "Create and manage final exams",
      icon: GraduationCap,
      href: "/admin/final-exams",
      color: "red-500",
      borderColor: "border-2 border-red-500/30",
      bgGradient: "bg-gradient-to-br from-red-500/5 to-transparent",
    },
    {
      id: "ai-tutor",
      title: "Manage AI Tutor",
      description: "Monitor and configure AI tutor settings",
      icon: Brain,
      href: "/admin/ai-tutor",
      color: "purple-500",
      borderColor: "border-2 border-purple-500/30",
      bgGradient: "bg-gradient-to-br from-purple-500/5 to-transparent",
    },
    {
      id: "lectures",
      title: "Manage Lectures",
      description: "Create and manage lecture content",
      icon: Presentation,
      href: "/admin/lectures",
      color: "green-500",
      borderColor: "border-2 border-green-500/30",
      bgGradient: "bg-gradient-to-br from-green-500/5 to-transparent",
    },
    {
      id: "notifications",
      title: "Manage Notifications",
      description: "Send and manage system notifications",
      icon: Bell,
      href: "/admin/notifications",
      color: "yellow-500",
      borderColor: "border-2 border-yellow-500/30",
      bgGradient: "bg-gradient-to-br from-yellow-500/5 to-transparent",
    },
    {
      id: "financials",
      title: "Financial Management",
      description: "Manage memberships, donations, and track income",
      icon: DollarSign,
      href: "/admin/financials",
      color: "emerald-500",
      borderColor: "border-2 border-emerald-500/30",
      bgGradient: "bg-gradient-to-br from-emerald-500/5 to-transparent",
    },
    {
      id: "settings",
      title: "System Settings",
      description: "Configure system-wide settings",
      icon: Settings,
      href: "/admin/settings",
      color: "gray-500",
      borderColor: "border-2 border-gray-500/30",
      bgGradient: "bg-gradient-to-br from-gray-500/5 to-transparent",
    },
    {
      id: "memberships",
      title: "Manage Memberships",
      description: "Manage student membership tiers",
      icon: Crown,
      href: "/admin/memberships",
      color: "gold-500",
      borderColor: "border-2 border-yellow-500/30",
      bgGradient: "bg-gradient-to-br from-yellow-500/5 to-transparent",
    },
    {
      id: "analytics",
      title: "Analytics Dashboard",
      description: "View comprehensive system analytics",
      icon: BarChart3,
      href: "/admin/analytics",
      color: "indigo-500",
      borderColor: "border-2 border-indigo-500/30",
      bgGradient: "bg-gradient-to-br from-indigo-500/5 to-transparent",
    },
    {
      id: "reports",
      title: "Generate Reports",
      description: "Create and export system reports",
      icon: FileText,
      href: "/admin/reports",
      color: "blue-500",
      borderColor: "border-2 border-blue-500/30",
      bgGradient: "bg-gradient-to-br from-blue-500/5 to-transparent",
    },
    {
      id: "system-monitor",
      title: "System Monitor",
      description: "Monitor system health and performance",
      icon: Server,
      href: "/admin/system-monitor",
      color: "green-500",
      borderColor: "border-2 border-green-500/30",
      bgGradient: "bg-gradient-to-br from-green-500/5 to-transparent",
    },
    {
      id: "profile",
      title: "Admin Profile",
      description: "Manage your admin profile",
      icon: User,
      href: "/admin/profile",
      color: "purple-500",
      borderColor: "border-2 border-purple-500/30",
      bgGradient: "bg-gradient-to-br from-purple-500/5 to-transparent",
    },
    {
      id: "logs",
      title: "System Logs",
      description: "View system logs and audit trail",
      icon: FileText,
      href: "/admin/logs",
      color: "gray-500",
      borderColor: "border-2 border-gray-500/30",
      bgGradient: "bg-gradient-to-br from-gray-500/5 to-transparent",
    },
    {
      id: "help-center",
      title: "Help Center",
      description: "Access admin documentation and support",
      icon: HelpCircle,
      href: "/admin/help-center",
      color: "blue-500",
      borderColor: "border-2 border-blue-500/30",
      bgGradient: "bg-gradient-to-br from-blue-500/5 to-transparent",
    },
  ]

  const [modules, setModules] = useState<Module[]>([])

  useEffect(() => {
    const adminId = sessionStorage.getItem("adminId")
    const username = sessionStorage.getItem("adminUsername")

    if (!adminId) {
      router.push("/admin/login")
      return
    }

    setAdminUsername(username || "Admin")
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const adminId = sessionStorage.getItem("adminId")
      
      // Fetch dashboard stats
      const statsResponse = await fetch(`/api/admin/dashboard/stats?adminId=${adminId}`)
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
      }

      // Fetch system health
      const healthResponse = await fetch("/api/admin/system-health")
      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        setSystemHealth(healthData.health)
      }

      // Fetch recent activity
      const activityResponse = await fetch(`/api/admin/recent-activity?adminId=${adminId}`)
      if (activityResponse.ok) {
        const activityData = await activityResponse.json()
        setRecentActivity(activityData.activities)
      }

      // Initialize modules with default data
      const initializedModules = allModules.map((module, index) => ({
          ...module,
          isFavorite: false,
          displayOrder: index,
        usageCount: Math.floor(Math.random() * 100),
        lastAccessed: Math.random() > 0.5 ? new Date().toISOString() : null,
      }))
      setModules(initializedModules)

      } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredModules = modules.filter(module =>
    module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    module.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getHealthColor = (status: string) => {
    switch (status) {
      case "healthy": return "text-green-600"
      case "warning": return "text-yellow-600"
      case "error": return "text-red-600"
      default: return "text-gray-600"
    }
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy": return <CheckCircle className="h-4 w-4 text-green-600" />
      case "warning": return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case "error": return <X className="h-4 w-4 text-red-600" />
      default: return <AlertCircle className="h-4 w-4 text-gray-600" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            <Shield className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading Admin Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white mb-8"
      >
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Shield className="h-8 w-8 text-white" />
                </div>
      <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                    Admin Control Center
                  </h1>
                  <p className="text-blue-100 text-lg">
                    Welcome back, {adminUsername}! Manage your CourseCollab platform
                  </p>
      </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge className="bg-white/20 text-white border-white/30 px-4 py-2 text-sm">
                  <Activity className="h-4 w-4 mr-2" />
                  System Online
                </Badge>
                <Badge className="bg-yellow-400/20 text-yellow-100 border-yellow-300/30 px-4 py-2 text-sm">
                  <Users className="h-4 w-4 mr-2" />
                  {stats?.activeUsers || 0} Active Users
                </Badge>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="w-32 h-32 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Rocket className="h-16 w-16 text-white/80" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl p-2">
          <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="modules" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
            <Settings className="h-4 w-4 mr-2" />
            Modules
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
            <Activity className="h-4 w-4 mr-2" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="system" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
            <Server className="h-4 w-4 mr-2" />
            System
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="lg:col-span-2 space-y-6"
            >
              {/* Key Metrics */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                        <ClipboardList className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats?.totalQuizzes || 0}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Total Quizzes</p>
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
                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats?.totalStudents || 0}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Total Students</p>
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
                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats?.totalAttempts || 0}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Total Attempts</p>
                      </div>
                    </div>
          </CardContent>
        </Card>

                <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats?.pendingIssues || 0}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Pending Issues</p>
                      </div>
                    </div>
          </CardContent>
        </Card>
      </div>

              {/* System Health */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                      <Server className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold">System Health</CardTitle>
                      <CardDescription>Real-time system monitoring</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Database Status</span>
        <div className="flex items-center gap-2">
                          {getHealthIcon(systemHealth?.databaseStatus || "healthy")}
                          <span className={`text-sm font-semibold ${getHealthColor(systemHealth?.databaseStatus || "healthy")}`}>
                            {systemHealth?.databaseStatus || "healthy"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">API Latency</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">
                          {systemHealth?.apiLatency || 0}ms
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Memory Usage</span>
                        <div className="flex items-center gap-2">
                          <Progress value={systemHealth?.memoryUsage || 0} className="w-20 h-2" />
                          <span className="text-sm font-semibold text-slate-800 dark:text-white">
                            {systemHealth?.memoryUsage || 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Disk Usage</span>
                        <div className="flex items-center gap-2">
                          <Progress value={systemHealth?.diskUsage || 0} className="w-20 h-2" />
                          <span className="text-sm font-semibold text-slate-800 dark:text-white">
                            {systemHealth?.diskUsage || 0}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Active Connections</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">
                          {systemHealth?.activeConnections || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Uptime</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-white">
                          {systemHealth?.uptime || "99.9%"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Sidebar */}
              <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="space-y-6"
            >
              {/* Quick Actions */}
              <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
                      <p className="text-indigo-100 text-sm">Common admin tasks</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-white/20"
                    onClick={() => router.push("/admin/quizzes")}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Quiz
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-white hover:bg-white/20"
                    onClick={() => router.push("/admin/students")}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Add Student
            </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-white hover:bg-white/20"
                    onClick={() => router.push("/admin/notifications")}
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Send Notification
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-white hover:bg-white/20"
                    onClick={() => router.push("/admin/reports")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </CardContent>
              </Card>

              {/* Upcoming Assessments */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-white" />
        </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Upcoming Assessments</CardTitle>
                      <p className="text-slate-500 text-sm">Next scheduled items</p>
      </div>
                  </div>
                </CardHeader>
                <CardContent>
        <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center justify-center">
                        <ClipboardList className="h-4 w-4 text-white" />
          </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800 dark:text-white">Mid-Term Exam</p>
                        <p className="text-xs text-slate-500">Due in 3 days</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800 dark:text-white">Homework Assignment</p>
                        <p className="text-xs text-slate-500">Due in 5 days</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 flex items-center justify-center">
                        <GraduationCap className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800 dark:text-white">Final Exam</p>
                        <p className="text-xs text-slate-500">Due in 2 weeks</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* Modules Tab */}
        <TabsContent value="modules" className="space-y-6">
          {/* Search */}
          <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    placeholder="Search modules..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-12 text-lg border-2 border-slate-200 dark:border-slate-600 focus:border-indigo-500 rounded-xl bg-white/50 dark:bg-slate-700/50"
                  />
                </div>
                <Button variant="outline" className="rounded-xl">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Modules Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {filteredModules.map((module, index) => (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card
                    className={`border-0 shadow-xl backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-2xl cursor-pointer ${module.bgGradient} ${module.borderColor}`}
                    onClick={() => router.push(module.href)}
                  >
                    <CardHeader className="p-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-r from-${module.color} flex items-center justify-center`}>
                          <module.icon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg font-bold text-slate-800 dark:text-white truncate">
                            {module.title}
                          </CardTitle>
                          <CardDescription className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                            {module.description}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                      <div className="flex items-center justify-between text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>{module.usageCount} views</span>
                        </div>
                        {module.lastAccessed && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{new Date(module.lastAccessed).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
                </div>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-white" />
          </div>
                <div>
                  <CardTitle className="text-xl font-bold">Recent Activity</CardTitle>
                  <CardDescription>Latest system activities and events</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        activity.type === "submission" ? "bg-gradient-to-r from-green-500 to-emerald-600" :
                        activity.type === "comment" ? "bg-gradient-to-r from-blue-500 to-cyan-600" :
                        activity.type === "notification" ? "bg-gradient-to-r from-purple-500 to-indigo-600" :
                        "bg-gradient-to-r from-red-500 to-pink-600"
                      }`}>
                        {activity.type === "submission" ? <CheckCircle className="h-5 w-5 text-white" /> :
                         activity.type === "comment" ? <MessageSquare className="h-5 w-5 text-white" /> :
                         activity.type === "notification" ? <Bell className="h-5 w-5 text-white" /> :
                         <AlertCircle className="h-5 w-5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-800 dark:text-white">{activity.title}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">{activity.user}</span>
                          <span className="text-xs text-slate-500">•</span>
                          <span className="text-xs text-slate-500">{new Date(activity.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          activity.status === "completed" ? "border-green-500 text-green-600" :
                          activity.status === "resolved" ? "border-blue-500 text-blue-600" :
                          "border-yellow-500 text-yellow-600"
                        }`}
                      >
                        {activity.status}
                      </Badge>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Activity className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
                      No recent activity
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400">
                      System activity will appear here as students interact with the platform
                    </p>
        </div>
      )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* System Status */}
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                    <Server className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">System Status</CardTitle>
                    <CardDescription>Real-time system monitoring</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
          <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Database</span>
            <div className="flex items-center gap-2">
                      {getHealthIcon(systemHealth?.databaseStatus || "healthy")}
                      <span className="text-sm font-semibold text-green-600">Online</span>
            </div>
          </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">API Server</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-600">Online</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">File Storage</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-600">Online</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Email Service</span>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-600">Online</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 p-6">
                      <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                        </div>
                  <div>
                    <CardTitle className="text-lg font-bold">Performance Metrics</CardTitle>
                    <CardDescription>System performance indicators</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">CPU Usage</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">45%</span>
                </div>
                    <Progress value={45} className="h-2" />
          </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Memory Usage</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">{systemHealth?.memoryUsage || 0}%</span>
        </div>
                    <Progress value={systemHealth?.memoryUsage || 0} className="h-2" />
            </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Disk Usage</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">{systemHealth?.diskUsage || 0}%</span>
      </div>
                    <Progress value={systemHealth?.diskUsage || 0} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Network I/O</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">2.3 MB/s</span>
                    </div>
                    <Progress value={23} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}