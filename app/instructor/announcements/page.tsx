"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { 
  Megaphone, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Users, 
  Calendar,
  Clock,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Info,
  AlertCircle,
  Bell,
  Send,
  X,
  Check,
  Target,
  Activity,
  TrendingUp
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow, format } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { getSectionColumnHeading } from "@/lib/instructor-section-presets"
import { useSessionCatalog } from "@/components/session-catalog-provider"

interface Announcement {
  id: number
  title: string
  content: string
  type: "info" | "warning" | "alert" | "exam"
  priority: "low" | "medium" | "high"
  target_session: string
  created_at: string
  expires_at?: string | null
  is_active: boolean
  read_count?: number
}

const announcementTypeConfig = {
  info: { icon: Info, color: "text-blue-600", bgColor: "bg-blue-100", borderColor: "border-blue-500" },
  warning: { icon: AlertTriangle, color: "text-yellow-600", bgColor: "bg-yellow-100", borderColor: "border-yellow-500" },
  alert: { icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-100", borderColor: "border-red-500" },
  exam: { icon: Bell, color: "text-purple-600", bgColor: "bg-purple-100", borderColor: "border-purple-500" },
}

export default function InstructorAnnouncementsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { selectOptions, defaultCode, labelByCode } = useSessionCatalog()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialog, setCreateDialog] = useState(false)
  const [editDialog, setEditDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [sessionFilter, setSessionFilter] = useState("all")

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "info" as "info" | "warning" | "alert" | "exam",
    priority: "medium" as "low" | "medium" | "high",
    target_session: "all",
    expires_at: ""
  })

  useEffect(() => {
    const instructorSession = localStorage.getItem("instructorSession")
    if (!instructorSession) {
      router.push("/instructor/login")
      return
    }
    
    fetchAnnouncements()
  }, [router, sessionFilter])

  const fetchAnnouncements = async () => {
    try {
      const url = sessionFilter === "all" 
        ? "/api/instructor/announcements"
        : `/api/instructor/announcements?session=${sessionFilter}`
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setAnnouncements(data.announcements || [])
      } else {
        setAnnouncements(getMockAnnouncements())
      }
    } catch (error) {
      console.error("Failed to fetch announcements:", error)
      setAnnouncements(getMockAnnouncements())
    } finally {
      setLoading(false)
    }
  }

  const getMockAnnouncements = (): Announcement[] => {
    const sampleSession = defaultCode || "all"
    return [
      {
        id: 1,
        title: "Mid-Semester Exam Schedule Released",
        content: "The mid-semester exam will be held on March 15th, 2024 from 2:00 PM to 4:00 PM in Room 301. The exam will cover topics from Week 1 to Week 7. Please review all lecture materials, practice problems, and previous quizzes. Office hours will be extended this week for additional support. Good luck with your preparation!",
        type: "exam",
        priority: "high",
        target_session: "all",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        expires_at: new Date(Date.now() + 604800000).toISOString(),
        is_active: true,
        read_count: 45
      },
      {
        id: 2,
        title: "New Lecture Materials Available - Week 5",
        content: "Week 5 lecture materials on Pointers and Memory Management are now available in the Lectures section. This is a crucial topic, so please review the materials thoroughly before our next class. Additional practice problems and code examples have been provided.",
        type: "info",
        priority: "medium",
        target_session: sampleSession,
        created_at: new Date(Date.now() - 172800000).toISOString(),
        expires_at: null,
        is_active: true,
        read_count: 32
      },
      {
        id: 3,
        title: "⚠️ Office Hours Change This Week",
        content: "Due to a faculty meeting, this week's office hours have been moved to Thursday 3:00 PM - 5:00 PM instead of the usual Tuesday slot. The location remains the same (Office 205). Please plan your questions and visit accordingly.",
        type: "warning",
        priority: "high",
        target_session: "all",
        created_at: new Date(Date.now() - 259200000).toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        is_active: true,
        read_count: 78
      },
      {
        id: 4,
        title: "🚨 Project Groups Must Be Formed by Friday",
        content: "Reminder: All project groups must be formed by the end of this week (Friday, 11:59 PM). Use the Groups module to create or join a team. Groups should have 3-4 members. If you're having trouble finding teammates, please reach out during office hours or use the discussion forum.",
        type: "alert",
        priority: "high",
        target_session: "all",
        created_at: new Date(Date.now() - 345600000).toISOString(),
        expires_at: new Date(Date.now() + 259200000).toISOString(),
        is_active: true,
        read_count: 62
      }
    ]
  }

  const handleCreate = async () => {
    if (!formData.title || !formData.content) {
      toast({
        title: "❌ Missing Required Fields",
        description: "Please fill in both title and content.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await instructorApiFetch("/api/instructor/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: "✅ Announcement Created Successfully",
          description: `"${formData.title}" has been sent to ${formData.target_session === "all" ? "all students" : `session ${formData.target_session}`}.`,
        })
        setCreateDialog(false)
        resetForm()
        fetchAnnouncements()
      } else {
        throw new Error("Failed to create announcement")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Create Announcement",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUpdate = async () => {
    if (!selectedAnnouncement) return

    try {
      const response = await instructorApiFetch(`/api/instructor/announcements/${selectedAnnouncement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: "✅ Announcement Updated Successfully",
          description: `"${formData.title}" has been updated.`,
        })
        setEditDialog(false)
        resetForm()
        fetchAnnouncements()
      } else {
        throw new Error("Failed to update announcement")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Update Announcement",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedAnnouncement) return

    try {
      const response = await instructorApiFetch(`/api/instructor/announcements/${selectedAnnouncement.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "✅ Announcement Deleted Successfully",
          description: `"${selectedAnnouncement.title}" has been removed.`,
        })
        setDeleteDialog(false)
        setSelectedAnnouncement(null)
        fetchAnnouncements()
      } else {
        throw new Error("Failed to delete announcement")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Delete Announcement",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement)
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      priority: announcement.priority,
      target_session: announcement.target_session,
      expires_at: announcement.expires_at ? format(new Date(announcement.expires_at), "yyyy-MM-dd'T'HH:mm") : ""
    })
    setEditDialog(true)
  }

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      type: "info",
      priority: "medium",
      target_session: "all",
      expires_at: ""
    })
    setSelectedAnnouncement(null)
  }

  const stats = {
    total: announcements.length,
    active: announcements.filter(a => a.is_active).length,
    totalReads: announcements.reduce((sum, a) => sum + (a.read_count || 0), 0),
    highPriority: announcements.filter(a => a.priority === "high").length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-pink-600 mx-auto"></div>
          <p className="mt-4 text-lg text-slate-600">Loading Announcements...</p>
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
              <div className="p-3 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg shadow-pink-500/25">
                <Megaphone className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                  Announcements
                </h1>
                <p className="text-slate-600 text-sm mt-1">
                  Send important updates and messages to your students
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={fetchAnnouncements}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={() => setCreateDialog(true)}
              className="gap-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white"
            >
              <Plus className="h-4 w-4" />
              Create Announcement
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/instructor/notifications")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Notifications
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-pink-500">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-pink-500" />
                Total Announcements
              </CardDescription>
              <CardTitle className="text-3xl text-pink-600">{stats.total}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                Active
              </CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.active}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500" />
                Total Reads
              </CardDescription>
              <CardTitle className="text-3xl text-blue-600">{stats.totalReads}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                High Priority
              </CardDescription>
              <CardTitle className="text-3xl text-red-600">{stats.highPriority}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filter */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Filter Announcements</CardTitle>
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  {selectOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        {/* Announcements List */}
        <div className="space-y-4">
          <AnimatePresence>
            {announcements.map((announcement, index) => {
              const typeConfig = announcementTypeConfig[announcement.type]
              const TypeIcon = typeConfig.icon

              return (
                <motion.div
                  key={announcement.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={`border-l-4 ${typeConfig.borderColor}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`p-3 rounded-lg ${typeConfig.bgColor}`}>
                            <TypeIcon className={`h-6 w-6 ${typeConfig.color}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-semibold text-gray-900">
                                {announcement.title}
                              </h3>
                              <Badge
                                variant="outline"
                                className={
                                  announcement.priority === "high"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : announcement.priority === "medium"
                                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                    : "bg-gray-50 text-gray-700 border-gray-200"
                                }
                              >
                                {announcement.priority.toUpperCase()} PRIORITY
                              </Badge>
                              <Badge variant="outline">
                                {announcement.type.toUpperCase()}
                              </Badge>
                              {!announcement.is_active && (
                                <Badge variant="outline" className="bg-gray-100">
                                  INACTIVE
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                              <div className="flex items-center gap-1">
                                <Target className="h-4 w-4" />
                                <span>
                                  {announcement.target_session === "all"
                                    ? "All Sessions"
                                    : getSectionColumnHeading(announcement.target_session, labelByCode)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                              </div>
                              <div className="flex items-center gap-1">
                                <Eye className="h-4 w-4" />
                                {announcement.read_count || 0} reads
                              </div>
                            </div>
                            <p className="text-gray-700 leading-relaxed">
                              {announcement.content}
                            </p>
                            {announcement.expires_at && (
                              <div className="mt-3 flex items-center gap-2 text-sm text-orange-600">
                                <Calendar className="h-4 w-4" />
                                Expires: {format(new Date(announcement.expires_at), "PPP 'at' p")}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(announcement)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAnnouncement(announcement)
                              setDeleteDialog(true)
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={createDialog || editDialog} onOpenChange={(open) => {
          if (!open) {
            setCreateDialog(false)
            setEditDialog(false)
            resetForm()
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-pink-500" />
                {editDialog ? "Edit Announcement" : "Create New Announcement"}
              </DialogTitle>
              <DialogDescription>
                {editDialog ? "Update your announcement details" : "Send an important message to your students"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter announcement title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter announcement content"
                  rows={6}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="exam">Exam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value: any) => setFormData({ ...formData, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="target_session">Target Session</Label>
                  <Select value={formData.target_session} onValueChange={(value) => setFormData({ ...formData, target_session: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sessions</SelectItem>
                      {selectOptions.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expires_at">Expiration Date (Optional)</Label>
                  <Input
                    id="expires_at"
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialog(false)
                  setEditDialog(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={editDialog ? handleUpdate : handleCreate}
                className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700"
              >
                <Send className="h-4 w-4 mr-2" />
                {editDialog ? "Update" : "Send"} Announcement
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Delete Announcement
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{selectedAnnouncement?.title}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
