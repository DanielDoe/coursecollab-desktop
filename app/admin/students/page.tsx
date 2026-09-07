"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Users,
  UserPlus,
  Search,
  Filter,
  Download,
  Upload,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  MapPin,
  GraduationCap,
  BookOpen,
  BarChart3,
  Target,
  Award,
  Star,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  TrendingUp,
  Shield,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  MessageSquare,
  Bell,
  Settings,
  Database,
  FileText,
  Archive,
  RefreshCw,
  Plus,
  Minus,
  Copy,
  ExternalLink,
  Globe,
  Mail as MailIcon,
  Phone as PhoneIcon,
  Calendar as CalendarIcon,
  MapPin as MapPinIcon,
  GraduationCap as GraduationCapIcon,
  BookOpen as BookOpenIcon,
  BarChart3 as BarChart3Icon,
  Target as TargetIcon,
  Award as AwardIcon,
  Star as StarIcon,
  AlertCircle as AlertCircleIcon,
  CheckCircle as CheckCircleIcon,
  Clock as ClockIcon,
  Activity as ActivityIcon,
  TrendingUp as TrendingUpIcon,
  Shield as ShieldIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,
  UserCheck as UserCheckIcon,
  UserX as UserXIcon,
  MessageSquare as MessageSquareIcon,
  Bell as BellIcon,
  Settings as SettingsIcon,
  Database as DatabaseIcon,
  FileText as FileTextIcon,
  Archive as ArchiveIcon,
  RefreshCw as RefreshCwIcon,
  Plus as PlusIcon,
  Minus as MinusIcon,
  Copy as CopyIcon,
  ExternalLink as ExternalLinkIcon,
  Globe as GlobeIcon,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/use-toast"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { useSessionCatalog } from "@/components/session-catalog-provider"
import { initialsFromName } from "@/lib/initials-from-name"

interface Student {
  id: number
  full_name: string
  email: string
  student_number: string
  phone?: string
  address?: string
  date_of_birth?: string
  enrollment_date: string
  session_code: string
  is_active: boolean
  membership_tier: string
  last_login?: string
  total_attempts: number
  average_score: number
  completion_rate: number
  total_points: number
  badges: string[]
  notes?: string
  created_at: string
  updated_at: string
}

interface StudentStats {
  total_students: number
  active_students: number
  new_enrollments: number
  average_performance: number
  top_performers: Array<{
    student_name: string
    score: number
    attempts: number
  }>
  membership_distribution: Record<string, number>
  session_distribution: Record<string, number>
  recent_activity: Array<{
    student_name: string
    action: string
    timestamp: string
  }>
}

interface PasswordResetRequest {
  id: number
  student_id: number
  student_name: string
  student_email: string
  requested_at: string
  status: "pending" | "approved" | "rejected"
  admin_notes?: string
}

export default function AdminStudentsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { codes } = useSessionCatalog()
  usePreventBack("/admin/login")

  const [students, setStudents] = useState<Student[]>([])
  const [stats, setStats] = useState<StudentStats | null>(null)
  const [passwordRequests, setPasswordRequests] = useState<PasswordResetRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSession, setSelectedSession] = useState("all")
  const [selectedMembership, setSelectedMembership] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])

  const sessions = codes
  const membershipTiers = ["Scholar", "Explorer", "Trailblazer"]

  useEffect(() => {
    fetchData()
  }, [selectedSession, selectedMembership, selectedStatus])

  const fetchData = async () => {
    try {
      const adminId = sessionStorage.getItem("adminId")
      if (!adminId) {
        router.push("/admin/login")
        return
      }

      const [studentsResponse, statsResponse, requestsResponse] = await Promise.all([
        fetch(`/api/admin/students?adminId=${adminId}&session=${selectedSession}&membership=${selectedMembership}&status=${selectedStatus}`),
        fetch("/api/admin/students/stats"),
        fetch("/api/admin/students/password-requests")
      ])

      if (studentsResponse.ok) {
        const studentsData = await studentsResponse.json()
        setStudents(studentsData.students || [])
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
      }

      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json()
        setPasswordRequests(requestsData.requests || [])
      }
    } catch (error) {
      console.error("Error fetching student data:", error)
      toast({
        title: "Error",
        description: "Failed to load student data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredStudents = students.filter(student =>
    student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.student_number.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getMembershipColor = (tier: string) => {
    switch (tier) {
      case "Scholar": return "gray"
      case "Explorer": return "blue"
      case "Trailblazer": return "purple"
      default: return "gray"
    }
  }

  const getMembershipIcon = (tier: string) => {
    switch (tier) {
      case "Scholar": return AwardIcon
      case "Explorer": return StarIcon
      case "Trailblazer": return CrownIcon
      default: return AwardIcon
    }
  }

  const handleToggleActive = async (studentId: number, isActive: boolean) => {
    try {
      const response = await fetch("/api/admin/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          is_active: !isActive
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Student ${!isActive ? 'activated' : 'deactivated'}`,
        })
        fetchData()
      } else {
        throw new Error("Failed to update student status")
      }
    } catch (error) {
      console.error("Error updating student status:", error)
      toast({
        title: "Error",
        description: "Failed to update student status",
        variant: "destructive",
      })
    }
  }

  const handlePasswordRequest = async (requestId: number, action: "approve" | "reject", notes?: string) => {
    try {
      const response = await fetch("/api/admin/students/password-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          action,
          notes
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Password request ${action}d`,
        })
        fetchData()
      } else {
        throw new Error(`Failed to ${action} password request`)
      }
    } catch (error) {
      console.error(`Error ${action}ing password request:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} password request`,
        variant: "destructive",
      })
    }
  }

  const handleBulkAction = async (action: string) => {
    if (selectedStudents.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select students to perform bulk actions",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/admin/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudents,
          action,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Bulk ${action} completed successfully`,
        })
        setSelectedStudents([])
        fetchData()
      } else {
        throw new Error(`Failed to ${action} students`)
      }
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} students`,
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            <Users className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading Students...</p>
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
                  Student Management
                </h1>
                <p className="text-slate-600 dark:text-slate-300">
                  Manage student accounts, monitor performance, and handle requests
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push("/admin/students/create")}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Student
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl"
                onClick={() => router.push("/admin/students/import")}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button 
                variant="outline" 
                className="rounded-xl"
                onClick={() => router.push("/admin/students/export")}
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
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total_students}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Total Students</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                    <UserCheckIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.active_students}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Active Students</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                    <TrendingUpIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.new_enrollments}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">New This Month</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center">
                    <BarChart3Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.average_performance}%</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Avg Performance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl p-2">
            <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <BarChart3Icon className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="students" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Users className="h-4 w-4 mr-2" />
              Students
            </TabsTrigger>
            <TabsTrigger value="requests" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <BellIcon className="h-4 w-4 mr-2" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <ActivityIcon className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <SettingsIcon className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Top Performers */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                      <StarIcon className="h-5 w-5 text-white" />
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

              {/* Recent Activity */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center">
                      <ActivityIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
                      <CardDescription>Latest student actions</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {stats?.recent_activity.slice(0, 5).map((activity, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 flex items-center justify-center">
                          <ActivityIcon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800 dark:text-white truncate">
                            {activity.student_name}
                          </p>
                          <p className="text-xs text-slate-500">{activity.action}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">
                            {new Date(activity.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Membership Distribution */}
            {stats?.membership_distribution && (
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                      <AwardIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Membership Distribution</CardTitle>
                      <CardDescription>Student membership tier breakdown</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-3 gap-4">
                    {Object.entries(stats.membership_distribution).map(([tier, count]) => {
                      const percentage = (count / stats.total_students) * 100
                      const color = getMembershipColor(tier)
                      const Icon = getMembershipIcon(tier)
                      
                      return (
                        <div key={tier} className="text-center space-y-2">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-r from-${color}-500 to-${color}-600 flex items-center justify-center mx-auto`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <p className="text-2xl font-bold text-slate-800 dark:text-white">{count}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{tier}</p>
                          <Progress value={percentage} className="h-2" />
                          <p className="text-xs text-slate-500">{percentage.toFixed(1)}%</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-6">
            {/* Filters */}
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <Input
                        placeholder="Search students by name, email, or student number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-12 text-lg border-2 border-slate-200 dark:border-slate-600 focus:border-indigo-500 rounded-xl bg-white/50 dark:bg-slate-700/50"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Select value={selectedSession} onValueChange={setSelectedSession}>
                      <SelectTrigger className="w-32 rounded-xl">
                        <SelectValue placeholder="Session" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sessions</SelectItem>
                        {sessions.map((session) => (
                          <SelectItem key={session} value={session}>
                            {session}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedMembership} onValueChange={setSelectedMembership}>
                      <SelectTrigger className="w-32 rounded-xl">
                        <SelectValue placeholder="Tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tiers</SelectItem>
                        {membershipTiers.map((tier) => (
                          <SelectItem key={tier} value={tier}>
                            {tier}
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

            {/* Bulk Actions */}
            {selectedStudents.length > 0 && (
              <Card className="border-0 shadow-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircleIcon className="h-5 w-5" />
                      <span className="font-semibold">
                        {selectedStudents.length} student{selectedStudents.length > 1 ? 's' : ''} selected
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBulkAction("activate")}
                        className="text-white hover:bg-white/20"
                      >
                        <UserCheckIcon className="h-4 w-4 mr-2" />
                        Activate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBulkAction("deactivate")}
                        className="text-white hover:bg-white/20"
                      >
                        <UserXIcon className="h-4 w-4 mr-2" />
                        Deactivate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleBulkAction("export")}
                        className="text-white hover:bg-white/20"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Students Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredStudents.map((student, index) => {
                  const MembershipIcon = getMembershipIcon(student.membership_tier)
                  const membershipColor = getMembershipColor(student.membership_tier)
                  
                  return (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card className="border-0 shadow-xl backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-2xl">
                        <CardHeader className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-12 h-12">
                                <AvatarImage src={`/api/avatar/${student.id}`} />
                                <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                                  {initialsFromName(student.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white truncate">
                                  {student.full_name}
                                </CardTitle>
                                <CardDescription className="text-sm text-slate-600 dark:text-slate-300 truncate">
                                  {student.student_number}
                                </CardDescription>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs border-${membershipColor}-500 text-${membershipColor}-600`}
                                  >
                                    <MembershipIcon className="h-3 w-3 mr-1" />
                                    {student.membership_tier}
                                  </Badge>
                                  <Badge variant={student.is_active ? "default" : "secondary"} className="text-xs">
                                    {student.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={student.is_active}
                                onCheckedChange={() => handleToggleActive(student.id, student.is_active)}
                              />
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-6 pt-0">
                          <div className="space-y-4">
                            {/* Contact Info */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <MailIcon className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-600 dark:text-slate-300 truncate">{student.email}</span>
                              </div>
                              {student.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <PhoneIcon className="h-4 w-4 text-slate-400" />
                                  <span className="text-slate-600 dark:text-slate-300">{student.phone}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-sm">
                                <CalendarIcon className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-600 dark:text-slate-300">{student.session_code}</span>
                              </div>
                            </div>

                            {/* Performance Stats */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div className="space-y-1">
                                <p className="text-lg font-bold text-slate-800 dark:text-white">{student.total_attempts}</p>
                                <p className="text-xs text-slate-500">Attempts</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-lg font-bold text-slate-800 dark:text-white">{student.average_score}%</p>
                                <p className="text-xs text-slate-500">Avg Score</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-lg font-bold text-slate-800 dark:text-white">{student.total_points}</p>
                                <p className="text-xs text-slate-500">Points</p>
                              </div>
                            </div>

                            {/* Completion Rate */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-300">Completion Rate</span>
                                <span className="font-semibold text-slate-800 dark:text-white">{student.completion_rate}%</span>
                              </div>
                              <Progress value={student.completion_rate} className="h-2" />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 rounded-xl"
                                onClick={() => router.push(`/admin/students/${student.id}/edit`)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 rounded-xl"
                                onClick={() => router.push(`/admin/students/${student.id}/profile`)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-xl"
                                onClick={() => router.push(`/admin/students/${student.id}/analytics`)}
                              >
                                <BarChart3Icon className="h-4 w-4" />
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
          </TabsContent>

          {/* Password Requests Tab */}
          <TabsContent value="requests" className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-600 flex items-center justify-center">
                    <BellIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Password Reset Requests</CardTitle>
                    <CardDescription>Manage student password reset requests</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {passwordRequests.length > 0 ? (
                    passwordRequests.map((request, index) => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 flex items-center justify-center">
                          <LockIcon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-800 dark:text-white">{request.student_name}</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{request.student_email}</p>
                          <p className="text-xs text-slate-500">
                            Requested: {new Date(request.requested_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              request.status === "pending" ? "border-yellow-500 text-yellow-600" :
                              request.status === "approved" ? "border-green-500 text-green-600" :
                              "border-red-500 text-red-600"
                            }`}
                          >
                            {request.status}
                          </Badge>
                          {request.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handlePasswordRequest(request.id, "approve")}
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircleIcon className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePasswordRequest(request.id, "reject")}
                                className="border-red-500 text-red-600 hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <BellIcon className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
                        No pending requests
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400">
                        All password reset requests have been processed
                      </p>
                    </div>
                  )}
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
                      <TrendingUpIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">Performance Trends</CardTitle>
                      <CardDescription>Student performance over time</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">This Month</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{stats?.average_performance || 0}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Last Month</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{Math.floor((stats?.average_performance || 0) * 0.92)}%</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Growth Rate</span>
                        <span className="text-sm font-semibold text-green-600">+8%</span>
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
                      <CardTitle className="text-lg font-bold">Enrollment Trends</CardTitle>
                      <CardDescription>Student enrollment patterns</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">This Month</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{stats?.new_enrollments || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Last Month</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-white">{Math.floor((stats?.new_enrollments || 0) * 0.85)}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Growth Rate</span>
                        <span className="text-sm font-semibold text-green-600">+15%</span>
                      </div>
                      <Progress value={85} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-gray-500/10 to-slate-500/10 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-gray-500 to-slate-600 flex items-center justify-center">
                    <SettingsIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Student Management Settings</CardTitle>
                    <CardDescription>Configure student management preferences</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-white">Auto-approve password resets</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Automatically approve password reset requests</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-white">Email notifications</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Send email notifications for student actions</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-white">Performance tracking</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Track detailed student performance metrics</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}