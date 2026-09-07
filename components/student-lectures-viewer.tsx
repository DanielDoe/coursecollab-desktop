"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { canonicalSessionCode } from "@/lib/session-code-aliases"
import { studentSessionBadgeLabel } from "@/lib/course-section-model"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import {
  portalViewOrganizerActiveClass,
  portalViewOrganizerContainerClass,
  portalViewOrganizerInactiveClass,
} from "@/lib/portal-module-themes"

const lecturesTheme = getStudentModuleTheme("lectures")
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { motion, AnimatePresence } from "framer-motion"
// LectureSlidesViewer removed - using week-based route instead
import {
  Star,
  Clock,
  Eye,
  MessageSquare,
  Loader2,
  Sparkles,
  Bell,
  Search,
  TrendingUp,
  Activity,
  FileText,
  ThumbsUp,
  Lightbulb,
  Award,
  BookOpen,
  Users,
  Calendar,
  Zap,
  Target,
  BarChart3,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  Download,
  Share2,
  Heart,
  Bookmark,
  GraduationCap,
  Brain,
  Rocket,
  Flame,
  Crown,
  StarIcon,
  Grid3X3,
  List,
  ArrowLeft,
  CheckCircle,
} from "lucide-react"

interface Lecture {
  id: number
  week: number
  title: string
  session: string
  description: string
  materials_url: string | null
  created_at: string
  status?: "Available" | "Pending" | "Completed"
}

interface Comment {
  id: number
  lecture_id: number
  student_id: number
  comment: string
  created_at: string
  student_name?: string
  likes: number
  lecture_title?: string
  week?: number
  is_current_user?: boolean
}

interface Material {
  id: number
  lecture_id: number
  file_url: string
  title: string
  file_type?: string
  view_count: number
  uploaded_at?: string
  lecture_title?: string
  week?: number
}

interface GlobalEngagement {
  topMaterials: Material[]
  topComments: Comment[]
  stats: {
    total_views: number
    total_comments: number
  }
}

interface ProfessorNote {
  id: number
  week: number
  title: string
  professor_notes: string | null
  lecture_summary: string | null
  last_updated: string
}

export function StudentLecturesViewer() {
  const { toast } = useToast()
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState<string | null>(null)
  const [viewerDatabaseId, setViewerDatabaseId] = useState<string | null>(null)
  const [studentSession, setStudentSession] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const [comments, setComments] = useState<Record<number, Comment[]>>({})
  const [newComment, setNewComment] = useState<Record<number, string>>({})
  const [submittingComment, setSubmittingComment] = useState<number | null>(null)

  const [materials, setMaterials] = useState<Record<number, Material[]>>({})
  const [globalEngagement, setGlobalEngagement] = useState<GlobalEngagement | null>(null)
  const [professorNotes, setProfessorNotes] = useState<ProfessorNote[]>([])
  const [bookmarkedLectures, setBookmarkedLectures] = useState<Set<number>>(new Set())
  const [reminders, setReminders] = useState<Set<number>>(new Set())
  const [expandedLecture, setExpandedLecture] = useState<number | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [viewMode, setViewMode] = useState<"card" | "list">("card")
  const [courseCode, setCourseCode] = useState<string | null>(null)

  useEffect(() => {
    const stored = getStudentData()
    const id = stored?.id ?? sessionStorage.getItem("studentId")
    const databaseId = stored?.databaseId ?? sessionStorage.getItem("studentDatabaseId")
    const rawSession = stored?.section ?? sessionStorage.getItem("studentSection")
    const session = rawSession ? canonicalSessionCode(rawSession) : null

    if (id && session) {
      setStudentId(id)
      setViewerDatabaseId(databaseId)
      setStudentSession(session)
      setCourseCode(stored?.courseCode ?? null)
      if (rawSession && rawSession !== session) {
        sessionStorage.setItem("studentSection", session)
      }
      fetchLectures(session)
      fetchBookmarks()
      fetchReminders()
      fetchGlobalEngagement(session)
      fetchProfessorNotes(session)
    }
  }, [])

  const sessionBadge = studentSessionBadgeLabel(courseCode, studentSession)

  // ----------- FETCH HELPERS -----------
  const fetchLectures = async (session: string) => {
    try {
      const id = sessionStorage.getItem("studentId")
      if (!id) return
      
      console.log("🎓 [Student] Fetching lectures for student:", id)
      const response = await studentApiFetch(`/api/student/lectures?studentId=${id}`)
      const data = await response.json()
      console.log("📚 [Student] Received lectures:", data.lectures?.length || 0)
      if (data.lectures?.length > 0) {
        console.log("🔍 [Student] Sample lecture:", data.lectures[0])
      }
      if (response.ok) setLectures(data.lectures || [])
    } catch (error) {
      console.error("❌ [Student] Error fetching lectures:", error)
      toast({ title: "Error", description: "Failed to load lectures", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const fetchGlobalEngagement = async (session: string) => {
    try {
      const id = sessionStorage.getItem("studentId")
      const qs = new URLSearchParams({ session })
      if (id) qs.set("studentId", id)
      const response = await studentApiFetch(`/api/lectures/engagement/global?${qs}`)
      const data = await response.json()
      if (response.ok) setGlobalEngagement(data)
    } catch (error) {
      console.error("Failed to fetch engagement:", error)
    }
  }

  const fetchComments = async (lectureId: number) => {
    try {
      const viewerQs = viewerDatabaseId ? `&viewerStudentId=${viewerDatabaseId}` : ""
      const response = await studentApiFetch(`/api/lectures/comments?lecture_id=${lectureId}${viewerQs}`)
      const data = await response.json()
      if (response.ok) setComments((prev) => ({ ...prev, [lectureId]: data.comments || [] }))
    } catch (error) {
      console.error("Failed to fetch comments:", error)
    }
  }

  const fetchMaterials = async (lectureId: number) => {
    try {
      const response = await studentApiFetch(`/api/lectures/materials?lectureId=${lectureId}`)
      const data = await response.json()
      if (response.ok) setMaterials((prev) => ({ ...prev, [lectureId]: data || [] }))
    } catch (error) {
      console.error("Failed to fetch materials:", error)
    }
  }

  const fetchBookmarks = async () => {
    if (!studentId) return
    try {
      const response = await studentApiFetch(`/api/lectures/bookmarks?studentId=${studentId}`)
      const data = await response.json()
      if (response.ok) setBookmarkedLectures(new Set(data.map((b: any) => b.lecture_id)))
    } catch (error) {
      console.error("Failed to fetch bookmarks:", error)
    }
  }

  const fetchReminders = async () => {
    if (!studentId) return
    try {
      const response = await studentApiFetch(`/api/lectures/reminders?studentId=${studentId}`)
      const data = await response.json()
      if (response.ok) setReminders(new Set(data.map((r: any) => r.lecture_id)))
    } catch (error) {
      console.error("Failed to fetch reminders:", error)
    }
  }

  const fetchProfessorNotes = async (session: string) => {
    try {
      const response = await studentApiFetch(`/api/lectures/professor-notes?session=${session}`)
      const data = await response.json()
      if (response.ok) setProfessorNotes(data.notes || [])
    } catch (error) {
      console.error("Failed to fetch notes:", error)
    }
  }

  // ----------- ACTIONS -----------
  const toggleBookmark = async (lectureId: number) => {
    if (!studentId) return
    const isBookmarked = bookmarkedLectures.has(lectureId)

    try {
      if (isBookmarked) {
        await studentApiFetch(`/api/lectures/bookmarks?lectureId=${lectureId}&studentId=${studentId}`, { method: "DELETE" })
        setBookmarkedLectures((prev) => {
          const next = new Set(prev)
          next.delete(lectureId)
          return next
        })
        toast({ title: "Bookmark removed" })
      } else {
        await studentApiFetch("/api/lectures/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lectureId, studentId: Number.parseInt(studentId) }),
        })
        setBookmarkedLectures((prev) => new Set(prev).add(lectureId))
        toast({ title: "Lecture bookmarked!" })
      }
    } catch (error) {
      console.error("Failed to toggle bookmark:", error)
    }
  }

  const setReminder = async (lectureId: number) => {
    if (!studentId) return
    const remindAt = new Date()
    remindAt.setDate(remindAt.getDate() + 1)
    try {
      await studentApiFetch("/api/lectures/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId, studentId: Number.parseInt(studentId), remindAt: remindAt.toISOString() }),
      })
      setReminders((prev) => new Set(prev).add(lectureId))
      toast({ title: "Reminder set!" })
    } catch (error) {
      console.error("Failed to set reminder:", error)
    }
  }

  const expandLecture = async (lectureId: number) => {
    if (expandedLecture === lectureId) {
      setExpandedLecture(null)
      return
    }
    setExpandedLecture(lectureId)
    if (!materials[lectureId]) await fetchMaterials(lectureId)
    if (!comments[lectureId]) await fetchComments(lectureId)
  }

  const router = useRouter()
  
  const openSlidesViewer = (lecture: Lecture) => {
    router.push(`/student/dashboard-v2/lectures/${lecture.week}?lectureId=${lecture.id}`)
  }

  const toggleChat = (lectureId: number) => {
    if (expandedLecture === lectureId && showChat) {
      setExpandedLecture(null)
      setShowChat(false)
    } else {
      setExpandedLecture(lectureId)
      setShowChat(true)
      if (!materials[lectureId]) fetchMaterials(lectureId)
      if (!comments[lectureId]) fetchComments(lectureId)
    }
  }

  // ----------- FILTERED DATA -----------
  const sortedLectures = [...lectures].sort((a, b) => a.week - b.week)
  const filteredLectures = sortedLectures.filter((lecture) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      lecture.title.toLowerCase().includes(query) ||
      lecture.description.toLowerCase().includes(query) ||
      `week ${lecture.week}`.includes(query)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      {/* Hero Header */}
      <motion.section
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-r from-purple-600 via-indigo-700 to-purple-900 dark:from-purple-700 dark:via-indigo-800 dark:to-purple-900 text-white shadow-lg p-4 sm:p-5 md:p-6 mb-6 sm:mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4 relative">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold break-words">
                <span className="sm:hidden">Lectures</span>
                <span className="hidden sm:inline">Course Lectures</span>
              </h1>
              <p className="text-xs sm:text-sm text-purple-200 dark:text-purple-300 mt-0.5 sm:mt-1 break-words">
                <span className="sm:hidden">Interactive learning content</span>
                <span className="hidden sm:inline">Master your learning journey with interactive content</span>
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap shrink-0">
              {sessionBadge ? (
                <Badge variant="secondary" className="bg-white/20 dark:bg-white/10 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs shrink-0">
                  <span className="sm:hidden">S{sessionBadge}</span>
                  <span className="hidden sm:inline">Session {sessionBadge}</span>
                </Badge>
              ) : null}
              <Badge variant="secondary" className="bg-white/20 dark:bg-white/10 text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs shrink-0">
                <span className="sm:hidden">{lectures.length}</span>
                <span className="hidden sm:inline">{lectures.length} Lectures Available</span>
              </Badge>
              <Button
                onClick={() => router.push("/student/dashboard")}
                variant="secondary"
                size="sm"
                className="rounded-lg sm:rounded-full bg-white dark:bg-white/90 text-purple-700 dark:text-purple-800 hover:bg-white/90 dark:hover:bg-white font-medium text-xs sm:text-sm h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4 shrink-0"
                title="Back to Dashboard"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 shrink-0" />
                <span className="hidden sm:inline">Back</span>
                <span className="sm:hidden">Back</span>
              </Button>
            </div>
          </div>
        </motion.section>

        <div className="grid lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
          {/* Main Content - Lectures */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            {/* Search and View Controls */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-4 sm:mb-6"
            >
              <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 md:gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <Input
                        placeholder="Search lectures..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 sm:pl-12 h-9 sm:h-10 md:h-12 text-sm sm:text-base md:text-lg border-2 border-slate-200 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-400 rounded-lg sm:rounded-xl bg-white/50 dark:bg-slate-700/50 dark:text-slate-200 dark:placeholder:text-slate-500"
                      />
                    </div>
                    {/* View Organizer */}
                    <div className={portalViewOrganizerContainerClass()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode("card")}
                        className={
                          viewMode === "card"
                            ? portalViewOrganizerActiveClass(lecturesTheme)
                            : portalViewOrganizerInactiveClass()
                        }
                      >
                        <Grid3X3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode("list")}
                        className={
                          viewMode === "list"
                            ? portalViewOrganizerActiveClass(lecturesTheme)
                            : portalViewOrganizerInactiveClass()
                        }
                      >
                        <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Lectures Container - Fixed Height with Scroll */}
            <div className="h-[calc(100vh-280px)] sm:h-[calc(100vh-240px)] md:h-[calc(100vh-200px)] lg:h-[calc(100vh-100px)] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent pr-2 sm:pr-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 p-2 sm:p-3 md:p-4">
              <div className={`space-y-4 ${viewMode === "list" ? "space-y-2" : ""}`}>
                <AnimatePresence>
                  {filteredLectures.map((lecture, index) => (
                    <motion.div
                      key={lecture.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      {viewMode === "card" ? (
                        <ModernLectureCard
                          lecture={lecture}
                          isExpanded={expandedLecture === lecture.id}
                          isBookmarked={bookmarkedLectures.has(lecture.id)}
                          hasReminder={reminders.has(lecture.id)}
                          materials={materials[lecture.id] || []}
                          comments={comments[lecture.id] || []}
                          viewerDatabaseId={viewerDatabaseId}
                          newComment={newComment[lecture.id] || ""}
                          submittingComment={submittingComment === lecture.id}
                          onExpand={expandLecture}
                          onToggleBookmark={toggleBookmark}
                          onSetReminder={setReminder}
                          onOpenSlides={openSlidesViewer}
                          onToggleChat={toggleChat}
                          showChat={showChat && expandedLecture === lecture.id}
                        />
                      ) : (
                        <CompactLectureCard
                          lecture={lecture}
                          isBookmarked={bookmarkedLectures.has(lecture.id)}
                          hasReminder={reminders.has(lecture.id)}
                          onToggleBookmark={toggleBookmark}
                          onSetReminder={setReminder}
                          onOpenSlides={openSlidesViewer}
                          onToggleChat={toggleChat}
                        />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Sidebar - Analytics & Insights - Fixed */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="sticky top-4 space-y-4 sm:space-y-6">
              {/* Engagement Dashboard */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 text-white overflow-hidden rounded-xl sm:rounded-2xl">
                  <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                        <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg font-bold break-words">Engagement</CardTitle>
                        <p className="text-indigo-100 dark:text-indigo-200 text-xs sm:text-sm break-words">
                          <span className="sm:hidden">Stats</span>
                          <span className="hidden sm:inline">Your learning stats</span>
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-200 dark:text-indigo-300 shrink-0" />
                          <span className="text-xs sm:text-sm text-indigo-100 dark:text-indigo-200">
                            <span className="sm:hidden">Views</span>
                            <span className="hidden sm:inline">Total Views</span>
                          </span>
                        </div>
                        <span className="text-xl sm:text-2xl font-bold shrink-0">
                          {globalEngagement?.stats.total_views || 0}
                        </span>
                      </div>
                      <Progress 
                        value={Math.min((globalEngagement?.stats.total_views || 0) / 100 * 100, 100)} 
                        className="h-1.5 sm:h-2 bg-white/20 dark:bg-white/30"
                      />
                    </div>
                    <Separator className="bg-white/20 dark:bg-white/30" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-200 dark:text-indigo-300 shrink-0" />
                        <span className="text-xs sm:text-sm text-indigo-100 dark:text-indigo-200">Comments</span>
                      </div>
                      <span className="text-xl sm:text-2xl font-bold shrink-0">
                        {globalEngagement?.stats.total_comments || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Bookmark className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-200 dark:text-indigo-300 shrink-0" />
                        <span className="text-xs sm:text-sm text-indigo-100 dark:text-indigo-200">Bookmarked</span>
                      </div>
                      <span className="text-xl sm:text-2xl font-bold shrink-0">{bookmarkedLectures.size}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Activity Timeline */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                  <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-green-400 to-blue-500 dark:from-green-500 dark:to-blue-600 flex items-center justify-center shrink-0">
                        <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg font-bold dark:text-slate-100 break-words">
                          <span className="sm:hidden">Activity</span>
                          <span className="hidden sm:inline">Recent Activity</span>
                        </CardTitle>
                        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm break-words">
                          <span className="sm:hidden">Learning journey</span>
                          <span className="hidden sm:inline">Your learning journey</span>
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="space-y-3 sm:space-y-4">
                      {/* Completed Lectures */}
                      <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white break-words">
                            <span className="sm:hidden">Completed</span>
                            <span className="hidden sm:inline">Completed Lectures</span>
                          </p>
                          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 break-words">
                            {lectures.filter(l => l.status === "completed").length} of {lectures.length} <span className="sm:hidden">done</span><span className="hidden sm:inline">finished</span>
                          </p>
                        </div>
                      </div>

                      {/* In Progress */}
                      <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white break-words">In Progress</p>
                          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 break-words">
                            {lectures.filter(l => l.status === "in_progress").length} <span className="sm:hidden">started</span><span className="hidden sm:inline">lectures started</span>
                          </p>
                        </div>
                      </div>

                      {/* Bookmarked */}
                      <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                          <Bookmark className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white break-words">Bookmarked</p>
                          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 break-words">
                            {bookmarkedLectures.size} <span className="sm:hidden">saved</span><span className="hidden sm:inline">saved for later</span>
                          </p>
                        </div>
                      </div>

                      {/* Comments */}
                      <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white break-words">
                            <span className="sm:hidden">Comments</span>
                            <span className="hidden sm:inline">Your Comments</span>
                          </p>
                          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 break-words">
                            {globalEngagement?.stats.total_comments || 0} <span className="sm:hidden">comments</span><span className="hidden sm:inline">contributions</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Professor's Notes */}
              {professorNotes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-amber-400 to-orange-500 dark:from-amber-500 dark:to-orange-600 text-white overflow-hidden rounded-xl sm:rounded-2xl">
                    <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base sm:text-lg font-bold break-words">
                            <span className="sm:hidden">Notes</span>
                            <span className="hidden sm:inline">Professor's Notes</span>
                          </CardTitle>
                          <p className="text-amber-100 dark:text-amber-200 text-xs sm:text-sm break-words">
                            <span className="sm:hidden">Updates</span>
                            <span className="hidden sm:inline">Important updates</span>
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
                      {professorNotes.slice(0, 2).map((note) => (
                        <div key={note.id} className="bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge className="bg-white/20 text-white text-[10px] sm:text-xs shrink-0">Week {note.week}</Badge>
                            <span className="font-semibold text-xs sm:text-sm break-words">{note.title}</span>
                          </div>
                          {note.professor_notes && (
                            <p className="text-xs sm:text-sm text-amber-100 dark:text-amber-200 line-clamp-2 break-words">{note.professor_notes}</p>
                          )}
                          <p className="text-[10px] sm:text-xs text-amber-200 dark:text-amber-300 mt-2">
                            {new Date(note.last_updated).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Top Materials */}
              {globalEngagement && globalEngagement.topMaterials.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.7 }}
                >
                  <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                    <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-red-400 to-pink-500 dark:from-red-500 dark:to-pink-600 flex items-center justify-center shrink-0">
                          <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base sm:text-lg font-bold dark:text-slate-100 break-words">
                            <span className="sm:hidden">Top</span>
                            <span className="hidden sm:inline">Top Materials</span>
                          </CardTitle>
                          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm break-words">
                            <span className="sm:hidden">Most viewed</span>
                            <span className="hidden sm:inline">Most viewed content</span>
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      <div className="space-y-2 sm:space-y-3">
                        {globalEngagement.topMaterials.slice(0, 3).map((material, index) => (
                          <div key={material.id} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg sm:rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 ${
                              index === 0 ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white" : 
                              index === 1 ? "bg-gradient-to-r from-gray-400 to-gray-500 text-white" :
                              "bg-gradient-to-r from-amber-600 to-orange-600 text-white"
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-xs sm:text-sm truncate dark:text-slate-200">{material.title}</p>
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                                <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0 dark:border-slate-600 dark:text-slate-300">Week {material.week}</Badge>
                                <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 shrink-0">{material.view_count} <span className="sm:hidden">views</span><span className="hidden sm:inline">views</span></span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Quick Tips */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-400 to-teal-500 dark:from-emerald-500 dark:to-teal-600 text-white overflow-hidden rounded-xl sm:rounded-2xl">
                  <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                        <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg font-bold break-words">
                          <span className="sm:hidden">Tips</span>
                          <span className="hidden sm:inline">Pro Tips</span>
                        </CardTitle>
                        <p className="text-emerald-100 dark:text-emerald-200 text-xs sm:text-sm break-words">
                          <span className="sm:hidden">Maximize learning</span>
                          <span className="hidden sm:inline">Maximize your learning</span>
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 sm:space-y-3 p-4 sm:p-6 pt-0">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <StarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-200 dark:text-emerald-300 mt-0.5 flex-shrink-0" />
                      <p className="text-xs sm:text-sm text-emerald-100 dark:text-emerald-200 break-words">
                        <strong>Bookmark</strong> key lectures <span className="sm:hidden">for access</span><span className="hidden sm:inline">for quick access</span>
                      </p>
                    </div>
                    <div className="flex items-start gap-2 sm:gap-3">
                      <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-200 dark:text-emerald-300 mt-0.5 flex-shrink-0" />
                      <p className="text-xs sm:text-sm text-emerald-100 dark:text-emerald-200 break-words">
                        <strong>Set reminders</strong> <span className="sm:hidden">to track</span><span className="hidden sm:inline">to stay on track</span>
                      </p>
                    </div>
                    <div className="flex items-start gap-2 sm:gap-3">
                      <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-200 dark:text-emerald-300 mt-0.5 flex-shrink-0" />
                      <p className="text-xs sm:text-sm text-emerald-100 dark:text-emerald-200 break-words">
                        <strong>Engage</strong> with comments <span className="sm:hidden">& discussions</span><span className="hidden sm:inline">and discussions</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
    </>
  )
}

// ---------- Modern Lecture Card ----------
function ModernLectureCard({
  lecture,
  isExpanded,
  isBookmarked,
  hasReminder,
  materials,
  comments,
  viewerDatabaseId,
  newComment,
  submittingComment,
  onExpand,
  onToggleBookmark,
  onSetReminder,
  onOpenSlides,
  onToggleChat,
  showChat,
}: {
  lecture: Lecture
  isExpanded: boolean
  isBookmarked: boolean
  hasReminder: boolean
  materials: Material[]
  comments: Comment[]
  viewerDatabaseId: string | null
  newComment: string
  submittingComment: boolean
  onExpand: (lectureId: number) => void
  onToggleBookmark: (lectureId: number) => void
  onSetReminder: (lectureId: number) => void
  onOpenSlides: (lecture: Lecture) => void
  onToggleChat: (lectureId: number) => void
  showChat: boolean
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden hover:shadow-xl transition-all duration-300 rounded-xl sm:rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 flex items-center justify-center shrink-0">
                  <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 dark:from-yellow-500 dark:to-orange-600 text-white font-bold text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 rounded-md sm:rounded-lg mb-1 shrink-0">
                    Week {lecture.week}
                  </Badge>
                  <CardTitle className="text-base sm:text-lg md:text-xl font-bold text-slate-800 dark:text-white break-words">
                    {lecture.title}
                  </CardTitle>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                  <span className="text-[10px] sm:text-xs">
                    {new Date(lecture.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                  <span className="text-[10px] sm:text-xs">{comments.length} <span className="sm:hidden">cmts</span><span className="hidden sm:inline">comments</span></span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                variant={isBookmarked ? "default" : "outline"}
                size="sm"
                onClick={() => onToggleBookmark(lecture.id)}
                className={`rounded-lg sm:rounded-xl text-xs h-7 sm:h-8 px-2 sm:px-3 ${
                  isBookmarked 
                    ? "bg-gradient-to-r from-yellow-400 to-orange-500 dark:from-yellow-500 dark:to-orange-600 text-white hover:from-yellow-500 hover:to-orange-600" 
                    : "border-slate-300 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400"
                }`}
              >
                <Bookmark className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline ml-1">{isBookmarked ? "Saved" : "Save"}</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onSetReminder(lecture.id)} 
                disabled={hasReminder}
                className="rounded-lg sm:rounded-xl border-slate-300 dark:border-slate-600 hover:border-green-500 dark:hover:border-green-400 text-xs h-7 sm:h-8 px-2 sm:px-3"
              >
                <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline ml-1">{hasReminder ? "Set" : "Remind"}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
            {lecture.description}
          </p>

          {/* Status Badge */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold shrink-0 ${
                  lecture.status === "completed"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : lecture.status === "in_progress"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                }`}
              >
                {lecture.status === "not_started" ? <span><span className="sm:hidden">Not Started</span><span className="hidden sm:inline">📚 Not Started</span></span>
                  : lecture.status === "in_progress" ? <span><span className="sm:hidden">In Progress</span><span className="hidden sm:inline">📖 In Progress</span></span>
                  : lecture.status === "completed" ? <span><span className="sm:hidden">Completed</span><span className="hidden sm:inline">✅ Completed</span></span>
                  : <span><span className="sm:hidden">Available</span><span className="hidden sm:inline">📚 Available</span></span>}
              </span>
              <div className="flex items-center gap-1 sm:gap-1.5 text-slate-500 dark:text-slate-400">
                <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                <span className="text-[10px] sm:text-xs">
                  <span className="sm:hidden">Ready</span>
                  <span className="hidden sm:inline">Ready to view</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              <Button
                onClick={() => onOpenSlides(lecture)}
                size="sm"
                className="bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 hover:from-indigo-600 hover:to-purple-700 dark:hover:from-indigo-700 dark:hover:to-purple-800 text-white rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold h-7 sm:h-8 flex-1 sm:flex-none"
              >
                <PlayCircle className="h-3.5 w-3.5 mr-1 sm:mr-1.5 shrink-0" />
                <span className="sm:hidden">View</span>
                <span className="hidden sm:inline">View Slides</span>
              </Button>
              <Button
                onClick={() => onToggleChat(lecture.id)}
                variant="outline"
                size="sm"
                className={`rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold h-7 sm:h-8 flex-1 sm:flex-none ${
                  showChat 
                    ? "bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-600 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40" 
                    : "border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1 sm:mr-1.5 shrink-0" />
                {showChat ? <span><span className="sm:hidden">Hide</span><span className="hidden sm:inline">Hide Chat</span></span> : "Chat"}
              </Button>
            </div>
          </div>

          {/* Expanded Content */}
          <AnimatePresence>
            {showChat && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-700"
              >
                {/* Materials Section */}
                {materials.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      Lecture Materials
                    </h4>
                    <div className="grid gap-3">
                      {materials.map((material) => (
                        <div key={material.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center justify-center">
                              <FileText className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-white">{material.title}</p>
                              <p className="text-sm text-slate-500">Week {material.week}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {material.view_count} views
                            </Badge>
                            <Button size="sm" variant="outline" className="rounded-lg">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments Section */}
                <div className="space-y-3 sm:space-y-4">
                  <h4 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    <span className="sm:hidden">Discussion ({comments.length})</span>
                    <span className="hidden sm:inline">Discussion ({comments.length})</span>
                  </h4>
                  
                  {/* Add Comment */}
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex gap-2 sm:gap-3">
                      <Input
                        placeholder="Share thoughts..."
                        value={newComment}
                        onChange={(e) => {
                          // Handle comment input
                        }}
                        className="flex-1 rounded-lg sm:rounded-xl border-slate-300 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-slate-700 text-sm sm:text-base h-9 sm:h-10 text-slate-900 dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                      />
                      <Button 
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 hover:from-indigo-600 hover:to-purple-700 dark:hover:from-indigo-700 dark:hover:to-purple-800 rounded-lg sm:rounded-xl h-9 sm:h-10 w-9 sm:w-10 p-0 shrink-0"
                        disabled={submittingComment}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-2 sm:space-y-3">
                    {comments.map((comment) => {
                      const isOwnComment =
                        comment.is_current_user ||
                        (viewerDatabaseId != null && String(comment.student_id) === String(viewerDatabaseId))
                      return (
                      <div key={comment.id} className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg sm:rounded-xl">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500 dark:from-indigo-500 dark:to-purple-600 flex items-center justify-center shrink-0">
                              <span className="text-white text-xs sm:text-sm font-semibold">
                                {isOwnComment ? (comment.student_name?.charAt(0) || "Y") : "?"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-sm sm:text-base truncate ${isOwnComment ? "text-slate-800 dark:text-white" : "text-slate-500 dark:text-slate-400 blur-[6px] select-none"}`}>
                                {isOwnComment ? (comment.student_name || "You") : "Student"}
                              </p>
                              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                                {new Date(comment.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            <Button size="sm" variant="ghost" className="rounded-lg h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm dark:text-slate-300">
                              <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 shrink-0" />
                              {comment.likes}
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 break-words">{comment.comment}</p>
                      </div>
                    )})}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------- Compact Lecture Card (List View) ----------
function CompactLectureCard({
  lecture,
  isBookmarked,
  hasReminder,
  onToggleBookmark,
  onSetReminder,
  onOpenSlides,
  onToggleChat,
}: {
  lecture: Lecture
  isBookmarked: boolean
  hasReminder: boolean
  onToggleBookmark: (lectureId: number) => void
  onSetReminder: (lectureId: number) => void
  onOpenSlides: (lecture: Lecture) => void
  onToggleChat: (lectureId: number) => void
}) {
  return (
    <Card className="border-0 shadow-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:shadow-xl transition-all duration-300 rounded-xl sm:rounded-2xl">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 flex items-center justify-center shrink-0">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 dark:from-yellow-500 dark:to-orange-600 text-white font-bold text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 rounded-md sm:rounded-lg shrink-0">
                  Week {lecture.week}
                </Badge>
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-800 dark:text-white truncate flex-1 min-w-0">
                  {lecture.title}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>{new Date(lecture.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 shrink-0" />
                  <span>0 <span className="sm:hidden">cmts</span><span className="hidden sm:inline">comments</span></span>
                </div>
                <span className="text-green-600 dark:text-green-400 font-medium">Available</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <Button
              variant={isBookmarked ? "default" : "outline"}
              size="sm"
              onClick={() => onToggleBookmark(lecture.id)}
              className={`rounded-lg h-7 sm:h-8 w-7 sm:w-8 p-0 ${
                isBookmarked 
                  ? "bg-gradient-to-r from-yellow-400 to-orange-500 dark:from-yellow-500 dark:to-orange-600 text-white hover:from-yellow-500 hover:to-orange-600" 
                  : "border-slate-300 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400"
              }`}
              title={isBookmarked ? "Remove bookmark" : "Bookmark"}
            >
              <Bookmark className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onSetReminder(lecture.id)} 
              disabled={hasReminder}
              className="rounded-lg border-slate-300 dark:border-slate-600 hover:border-green-500 dark:hover:border-green-400 h-7 sm:h-8 w-7 sm:w-8 p-0"
              title={hasReminder ? "Reminder set" : "Set reminder"}
            >
              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button
              onClick={() => onOpenSlides(lecture)}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 hover:from-indigo-600 hover:to-purple-700 dark:hover:from-indigo-700 dark:hover:to-purple-800 text-white rounded-lg sm:rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold h-7 sm:h-8 flex-1 sm:flex-none"
            >
              <PlayCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
              <span className="sm:hidden">View</span>
              <span className="hidden sm:inline">View Slides</span>
            </Button>
            <Button
              onClick={() => onToggleChat(lecture.id)}
              variant="outline"
              className="rounded-lg sm:rounded-xl border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm font-semibold flex-1 sm:flex-none dark:text-slate-300"
            >
              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
              Chat
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}