"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  Users, 
  BookOpen, 
  FileText, 
  MessageSquare,
  AlertCircle,
  TrendingUp,
  Trash2,
  Eye,
  EyeOff,
  Filter,
  Search,
  Calendar,
  ArrowLeft,
  Megaphone,
  Plus,
  RefreshCw
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  InstructorNotificationDetailDialog,
  type InstructorNotificationDetail,
} from "@/components/instructor/InstructorNotificationDetailDialog"
import { fallbackNotificationSummary } from "@/lib/notification-ai-summary-shared"
import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { FacultyNotificationsHub } from "@/components/instructor/notifications/FacultyNotificationsHub"

interface Notification extends InstructorNotificationDetail {}

const notificationIcons: Record<string, { icon: any; color: string; bgColor: string }> = {
  quiz_submission: { icon: CheckCircle2, color: "text-blue-600", bgColor: "bg-blue-100" },
  student_question: { icon: MessageSquare, color: "text-purple-600", bgColor: "bg-purple-100" },
  low_completion: { icon: TrendingUp, color: "text-orange-600", bgColor: "bg-orange-100" },
  deadline_reminder: { icon: Clock, color: "text-rose-600", bgColor: "bg-rose-100" },
  analytics: { icon: TrendingUp, color: "text-emerald-600", bgColor: "bg-emerald-100" },
  student_registration: { icon: Users, color: "text-cyan-600", bgColor: "bg-cyan-100" },
  lecture: { icon: BookOpen, color: "text-indigo-600", bgColor: "bg-indigo-100" },
  project: { icon: FileText, color: "text-amber-600", bgColor: "bg-amber-100" },
  group: { icon: Users, color: "text-teal-600", bgColor: "bg-teal-100" },
  exam: { icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-100" },
  homework: { icon: FileText, color: "text-violet-600", bgColor: "bg-violet-100" },
  announcement: { icon: Megaphone, color: "text-pink-600", bgColor: "bg-pink-100" },
  default: { icon: Bell, color: "text-gray-600", bgColor: "bg-gray-100" },
}

const cardBase = "border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.02] rounded-xl shadow-sm"

export function InstructorNotificationsContent({ embedInDashboard }: { embedInDashboard?: boolean } = {}) {
  if (embedInDashboard) {
    return <FacultyNotificationsHub />
  }

  const fp = getFacultyModuleTheme("notifications").page

  const router = useRouter()
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all") // all, unread, read
  const [typeFilter, setTypeFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    // Check authentication
    const instructorSession = localStorage.getItem("instructorSession")
    if (!instructorSession) {
      router.push("/instructor/login")
      return
    }
    
    fetchNotifications()
  }, [router])

  const fetchNotifications = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/notifications?limit=100")
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      } else {
        // Use mock data if API fails
        setNotifications(getMockNotifications())
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
      setNotifications(getMockNotifications())
    } finally {
      setLoading(false)
    }
  }

  const getMockNotifications = (): Notification[] => {
    return [
      {
        id: 1,
        type: "quiz_submission",
        title: "New Quiz Submissions",
        message: "15 students have submitted Quiz 3: Control Structures",
        link: "/instructor/results",
        is_read: false,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        source_type: "quiz",
        source_id: "3"
      },
      {
        id: 2,
        type: "student_question",
        title: "Student Question on Lecture 5",
        message: "John Doe asked: Could you explain the difference between pointers and references?",
        link: "/instructor/lectures",
        is_read: false,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        source_type: "lecture",
        source_id: "5",
        source_name: "John Doe"
      },
      {
        id: 3,
        type: "low_completion",
        title: "Low Assignment Completion Alert",
        message: "Only 60% of students in ELEG1301P01 completed Homework 2. Consider sending a reminder.",
        link: "/instructor/homework",
        is_read: false,
        created_at: new Date(Date.now() - 10800000).toISOString(),
        source_type: "homework",
        source_id: "2"
      },
      {
        id: 4,
        type: "deadline_reminder",
        title: "Upcoming Deadline",
        message: "Mid-semester exam is due in 2 days. 12 students haven't started yet.",
        link: "/instructor/mid-semester-exams",
        is_read: true,
        created_at: new Date(Date.now() - 14400000).toISOString(),
        read_at: new Date(Date.now() - 3600000).toISOString(),
        source_type: "exam",
        source_id: "1"
      },
      {
        id: 5,
        type: "analytics",
        title: "Weekly Analytics Ready",
        message: "Your weekly performance report is now available. Average quiz score: 78%.",
        link: "/instructor/analytics",
        is_read: true,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        read_at: new Date(Date.now() - 3600000).toISOString(),
        source_type: "system",
        source_id: null
      },
      {
        id: 6,
        type: "group",
        title: "New Group Formation",
        message: "Team Alpha has been created with 4 members for the final project.",
        link: "/instructor/groups",
        is_read: true,
        created_at: new Date(Date.now() - 172800000).toISOString(),
        read_at: new Date(Date.now() - 86400000).toISOString(),
        source_type: "group",
        source_id: "15"
      }
    ]
  }

  const markAsRead = async (id: number) => {
    try {
      await instructorApiFetch("/api/instructor/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: id }),
      })

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      )
    } catch (error) {
      // Silent fail - update UI anyway
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      )
    }
  }

  const markAllAsRead = async () => {
    try {
      await instructorApiFetch("/api/instructor/notifications/mark-all-read", {
        method: "POST",
      })

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      )

      toast({
        title: "✅ All Notifications Marked as Read",
        description: "You're all caught up!",
      })
    } catch (error) {
      toast({
        title: "❌ Failed to Mark All as Read",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  const deleteNotification = async (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    
    toast({
      title: "🗑️ Notification Deleted",
      description: "The notification has been removed.",
    })
  }

  async function openNotificationDetail(notif: Notification) {
    if (!notif.is_read) {
      await markAsRead(notif.id)
    }
    setSelectedNotification({ ...notif, is_read: true })
    setDetailOpen(true)
  }

  function handleOpenRelated(notif: Notification) {
    setDetailOpen(false)
    if (notif.link) router.push(notif.link)
  }

  function previewSummary(notif: Notification): string {
    if (notif.ai_summary?.trim()) return notif.ai_summary.trim()
    return fallbackNotificationSummary({
      title: notif.title,
      message: notif.message,
      type: notif.type,
    })
  }

  // Filter notifications
  const filteredNotifications = notifications.filter((notif) => {
    const matchesReadFilter =
      filter === "all" ||
      (filter === "unread" && !notif.is_read) ||
      (filter === "read" && notif.is_read)

    const matchesTypeFilter =
      typeFilter === "all" || notif.type === typeFilter

    const matchesSearch =
      searchTerm === "" ||
      notif.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.message.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesReadFilter && matchesTypeFilter && matchesSearch
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedInDashboard ? "min-h-[300px]" : "min-h-screen bg-slate-50"}`}>
        <div className="text-center">
          <div className={`w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto ${embedInDashboard ? "border-teal-500 dark:border-teal-400" : "border-blue-600"}`} />
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading notifications...</p>
        </div>
      </div>
    )
  }

  const dashboardHref = embedInDashboard ? "/instructor/dashboard-v2" : "/instructor/dashboard"
  const announcementsHref = embedInDashboard ? "/instructor/dashboard-v2/communication/announcements" : "/instructor/announcements-v2"

  return (
    <div className={embedInDashboard ? "space-y-4" : "min-h-screen bg-slate-50"}>
      <div className={embedInDashboard ? "space-y-4" : "container mx-auto px-6 py-8"}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          {!embedInDashboard && (
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                  <Bell className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Notification Center</h1>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Stay updated with student activities</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 ml-auto">
            <Button variant="outline" onClick={fetchNotifications} className={`h-9 gap-2 rounded-lg ${embedInDashboard ? "border-slate-200 dark:border-white/10 hover:bg-teal-50 dark:hover:bg-teal-500/10" : ""}`}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href={announcementsHref}>
              <Button className={`h-9 gap-2 rounded-lg ${embedInDashboard ? fp.cta : fp.cta}`}>
                <Megaphone className="h-4 w-4" />
                Announcements
              </Button>
            </Link>
            {!embedInDashboard && (
              <Button variant="outline" onClick={() => router.push(dashboardHref)} className="h-9 gap-2 rounded-lg">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card className={embedInDashboard ? cardBase : "border-l-4 border-l-blue-500"}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className={`flex items-center gap-1.5 text-xs ${embedInDashboard ? "text-slate-500 dark:text-slate-400" : ""}`}>
                <Bell className="h-4 w-4 text-blue-500" />
                Total
              </CardDescription>
              <CardTitle className={`text-2xl ${embedInDashboard ? "text-slate-800 dark:text-slate-200" : "text-blue-600"}`}>{notifications.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={embedInDashboard ? cardBase : "border-l-4 border-l-orange-500"}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                Unread
              </CardDescription>
              <CardTitle className={`text-2xl ${embedInDashboard ? "text-slate-800 dark:text-slate-200" : "text-orange-600"}`}>{unreadCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={embedInDashboard ? cardBase : "border-l-4 border-l-green-500"}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Read
              </CardDescription>
              <CardTitle className={`text-2xl ${embedInDashboard ? "text-slate-800 dark:text-slate-200" : "text-green-600"}`}>{notifications.length - unreadCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={embedInDashboard ? cardBase : "border-l-4 border-l-purple-500"}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardDescription className="flex items-center gap-1.5 text-xs">
                <Calendar className="h-4 w-4 text-purple-500" />
                Today
              </CardDescription>
              <CardTitle className={`text-2xl ${embedInDashboard ? "text-slate-800 dark:text-slate-200" : "text-purple-600"}`}>
                {notifications.filter((n) => {
                  const today = new Date()
                  const nDate = new Date(n.created_at)
                  return nDate.toDateString() === today.toDateString()
                }).length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className={embedInDashboard ? cardBase : "mb-6"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-blue-500" />
                Filters & Actions
              </CardTitle>
              {unreadCount > 0 && (
                <Button
                  onClick={markAllAsRead}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark All as Read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Notifications</SelectItem>
                  <SelectItem value="unread">Unread Only</SelectItem>
                  <SelectItem value="read">Read Only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="quiz_submission">Quiz Submissions</SelectItem>
                  <SelectItem value="student_question">Student Questions</SelectItem>
                  <SelectItem value="low_completion">Low Completion</SelectItem>
                  <SelectItem value="deadline_reminder">Deadlines</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                  <SelectItem value="announcement">Announcements</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className={embedInDashboard ? cardBase : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              All Notifications ({filteredNotifications.length})
            </CardTitle>
            <CardDescription>
              Tap a notification to read the AI summary and full message. Use Open Related Screen to jump to the linked module.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
                  <Bell className="h-10 w-10 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2 text-lg">No Notifications Found</h4>
                <p className="text-sm text-gray-600 text-center max-w-md">
                  {searchTerm || typeFilter !== "all" || filter !== "all"
                    ? "Try adjusting your filters to see more notifications."
                    : "You're all caught up! New notifications will appear here."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredNotifications.map((notif, index) => {
                    const iconConfig = notificationIcons[notif.type] || notificationIcons.default
                    const IconComponent = iconConfig.icon

                    return (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            !notif.is_read
                              ? embedInDashboard ? "border-l-4 border-l-teal-500 bg-teal-50/30 dark:bg-teal-500/5" : "border-l-4 border-l-blue-500 bg-blue-50/30"
                              : "hover:bg-slate-50 dark:hover:bg-white/5"
                          }`}
                          onClick={() => void openNotificationDetail(notif)}
                        >
                          <CardContent className="p-5">
                            <div className="flex gap-4">
                              <div className={`p-3 rounded-lg flex-shrink-0 h-fit ${iconConfig.bgColor}`}>
                                <IconComponent className={`h-5 w-5 ${iconConfig.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div>
                                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                      {notif.title}
                                      {!notif.is_read && (
                                        <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                                      )}
                                    </h4>
                                    {notif.source_name && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        From: {notif.source_name}
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {notif.type.replace(/_/g, " ")}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-700 mb-1 line-clamp-2">{previewSummary(notif)}</p>
                                <p className="text-xs text-gray-500 mb-3 line-clamp-1">{notif.message}</p>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <Clock className="h-3 w-3" />
                                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {!notif.is_read && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          void markAsRead(notif.id)
                                        }}
                                        className={`gap-2 ${embedInDashboard ? "text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-500/10" : "text-blue-600 hover:text-blue-700 hover:bg-blue-50"}`}
                                      >
                                        <Eye className="h-4 w-4" />
                                        Mark Read
                                      </Button>
                                    )}
                                    {notif.link && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          handleOpenRelated(notif)
                                        }}
                                      >
                                        Open Related
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        deleteNotification(notif.id)
                                      }}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <InstructorNotificationDetailDialog
        notification={selectedNotification}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onOpenRelated={handleOpenRelated}
        embedInDashboard={embedInDashboard}
      />
    </div>
  )
}

export default function InstructorNotificationsPage() {
  return <InstructorNotificationsContent />
}