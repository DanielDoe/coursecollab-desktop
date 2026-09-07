"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  Presentation, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  MessageSquare, 
  Upload, 
  Download,
  FileText,
  Image,
  Video,
  Calendar,
  Clock,
  Users,
  Star,
  Bookmark,
  Heart,
  ThumbsUp,
  Search,
  Filter,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Maximize2,
  Share2,
  Settings,
  MoreHorizontal,
  Grid3X3,
  List,
  BarChart3,
  TrendingUp,
  Activity,
  Target,
  Award,
  Zap,
  Sparkles,
  Crown,
  Flame,
  Rocket,
  Brain,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  Info,
  ExternalLink,
  Copy,
  RefreshCw,
  Save,
  X,
  Check,
  Minus,
  PlusCircle,
  FileUp,
  FolderOpen,
  Link,
  Code,
  Type,
  Palette,
  Layout,
  Layers,
  Sliders,
  Wand2,
  MousePointer,
  Crop,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Move,
  Square,
  Circle,
  Triangle,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List as ListIcon,
  Quote,
  Link2,
  Image as ImageIcon,
  Table,
  Columns,
  Rows,
  Hash,
  AtSign,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { getSectionColumnHeading } from "@/lib/instructor-section-presets"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useSessionCatalog } from "@/components/session-catalog-provider"
import { motion, AnimatePresence } from "framer-motion"
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Lecture {
  id: number
  week: number
  title: string
  session: string
  description: string
  materials_url?: string
  created_at: string
  updated_at?: string
  status?: "draft" | "published" | "archived"
  slide_count?: number
  comment_count?: number
  view_count?: number
  engagement_score?: number
}

interface Slide {
  id: number
  lecture_id: number
  slide_type: "pdf" | "ppt" | "html" | "image"
  title: string
  content?: string
  file_url?: string
  slide_order: number
  is_active: boolean
  created_at: string
  updated_at?: string
}

interface Comment {
  id: number
  lecture_id: number
  student_id: number
  student_name: string
  student_section: string
  content: string
  created_at: string
  is_resolved: boolean
  instructor_reply?: string
  instructor_reply_date?: string
}

interface Material {
  id: number
  lecture_id: number
  title: string
  file_type: string
  file_url: string
  created_at: string
}

interface LectureStats {
  total_lectures: number
  total_slides: number
  total_comments: number
  total_views: number
  avg_engagement: number
  weekly_activity: Array<{
    week: number
    lectures: number
    views: number
    comments: number
  }>
}

/** Offline demo data only; live session codes come from the DB catalog */
const MOCK_LECTURE_SESSION = "A"

// Mock data for demonstration
const MOCK_LECTURES: Lecture[] = [
  {
    id: 1,
    week: 1,
    title: "Introduction to Programming Concepts",
    session: MOCK_LECTURE_SESSION,
    description: "Overview of programming fundamentals, algorithms, and problem-solving techniques.",
    materials_url: "/materials/week1-intro.pdf",
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
    status: "published",
    slide_count: 25,
    comment_count: 12,
    view_count: 156,
    engagement_score: 4.2
  },
  {
    id: 2,
    week: 1,
    title: "Variables and Data Types",
    session: MOCK_LECTURE_SESSION,
    description: "Understanding different data types and variable declarations in programming.",
    materials_url: "/materials/week1-variables.pdf",
    created_at: "2024-01-16T10:00:00Z",
    updated_at: "2024-01-16T10:00:00Z",
    status: "published",
    slide_count: 18,
    comment_count: 8,
    view_count: 134,
    engagement_score: 3.8
  },
  {
    id: 3,
    week: 2,
    title: "Control Structures",
    session: MOCK_LECTURE_SESSION,
    description: "Conditional statements, loops, and program flow control.",
    materials_url: "/materials/week2-control.pdf",
    created_at: "2024-01-22T10:00:00Z",
    updated_at: "2024-01-22T10:00:00Z",
    status: "published",
    slide_count: 32,
    comment_count: 15,
    view_count: 189,
    engagement_score: 4.5
  },
  {
    id: 4,
    week: 2,
    title: "Functions and Modularity",
    session: MOCK_LECTURE_SESSION,
    description: "Creating and using functions for code organization and reusability.",
    materials_url: "/materials/week2-functions.pdf",
    created_at: "2024-01-23T10:00:00Z",
    updated_at: "2024-01-23T10:00:00Z",
    status: "draft",
    slide_count: 28,
    comment_count: 5,
    view_count: 67,
    engagement_score: 3.2
  },
  {
    id: 5,
    week: 3,
    title: "Arrays and Data Structures",
    session: MOCK_LECTURE_SESSION,
    description: "Introduction to arrays, lists, and basic data structure concepts.",
    materials_url: "/materials/week3-arrays.pdf",
    created_at: "2024-01-29T10:00:00Z",
    updated_at: "2024-01-29T10:00:00Z",
    status: "published",
    slide_count: 35,
    comment_count: 22,
    view_count: 201,
    engagement_score: 4.7
  }
]

const MOCK_SLIDES: Slide[] = [
  {
    id: 1,
    lecture_id: 1,
    slide_type: "pdf",
    title: "Welcome to Programming",
    slide_order: 1,
    is_active: true,
    created_at: "2024-01-15T10:00:00Z"
  },
  {
    id: 2,
    lecture_id: 1,
    slide_type: "html",
    title: "Programming Concepts Overview",
    content: "<h1>Programming Fundamentals</h1><p>Key concepts we'll cover...</p>",
    slide_order: 2,
    is_active: true,
    created_at: "2024-01-15T10:05:00Z"
  }
]

const MOCK_COMMENTS: Comment[] = [
  {
    id: 1,
    lecture_id: 1,
    student_id: 101,
    student_name: "John Doe",
    student_section: MOCK_LECTURE_SESSION,
    content: "Could you explain the difference between compiled and interpreted languages?",
    created_at: "2024-01-15T14:30:00Z",
    is_resolved: false
  },
  {
    id: 2,
    lecture_id: 1,
    student_id: 102,
    student_name: "Jane Smith",
    student_section: MOCK_LECTURE_SESSION,
    content: "Great explanation! This really helped me understand the basics.",
    created_at: "2024-01-15T15:45:00Z",
    is_resolved: true,
    instructor_reply: "Thank you! I'm glad it was helpful.",
    instructor_reply_date: "2024-01-15T16:00:00Z"
  }
]

export function InstructorLectureManagement() {
  const router = useRouter()
  const { toast } = useToast()
  const { selectOptions, accessRows, defaultCode, labelByCode } = useSessionCatalog()

  // State management
  const [loading, setLoading] = useState(true)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [slides, setSlides] = useState<Slide[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [stats, setStats] = useState<LectureStats | null>(null)

  // UI State
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null)
  const [selectedSlide, setSelectedSlide] = useState<Slide | null>(null)
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  
  // Dialog states
  const [createLectureDialog, setCreateLectureDialog] = useState(false)
  const [editLectureDialog, setEditLectureDialog] = useState(false)
  const [deleteLectureDialog, setDeleteLectureDialog] = useState(false)
  const [slidesDialog, setSlidesDialog] = useState(false)
  const [commentsDialog, setCommentsDialog] = useState(false)
  const [uploadDialog, setUploadDialog] = useState(false)
  const [previewDialog, setPreviewDialog] = useState(false)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [sessionFilter, setSessionFilter] = useState("all")
  const [weekFilter, setWeekFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  // Form data
  const [lectureForm, setLectureForm] = useState({
    week: "",
    title: "",
    session: "",
    description: "",
    materials_url: ""
  })

  const [slideForm, setSlideForm] = useState({
    title: "",
    slide_type: "html" as "pdf" | "ppt" | "html" | "image",
    content: "",
    file: null as File | null
  })

  const [commentReply, setCommentReply] = useState("")

  useEffect(() => {
    if (!defaultCode) return
    setLectureForm((f) => (f.session === "" ? { ...f, session: defaultCode } : f))
  }, [defaultCode])

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
      const auth = buildInstructorAuthorizedApiHeaders()
      // Fetch lectures
      const lecturesResponse = await instructorApiFetch("/api/instructor/lectures", { headers: auth })
      const lecturesData = await lecturesResponse.json()
      if (lecturesResponse.ok) {
        setLectures(lecturesData.lectures)
      } else {
        // Use mock data if API fails
        setLectures(MOCK_LECTURES)
      }

      // Fetch slides
      const slidesResponse = await instructorApiFetch("/api/instructor/lecture-slides", { headers: auth })
      const slidesData = await slidesResponse.json()
      if (slidesResponse.ok) {
        setSlides(slidesData.slides)
      } else {
        setSlides(MOCK_SLIDES)
      }

      // Fetch comments
      const commentsResponse = await instructorApiFetch("/api/instructor/lecture-comments", { headers: auth })
      const commentsData = await commentsResponse.json()
      if (commentsResponse.ok) {
        setComments(commentsData.comments)
      } else {
        setComments(MOCK_COMMENTS)
      }

      // Fetch stats
      const statsResponse = await instructorApiFetch("/api/instructor/lecture-stats", { headers: auth })
      const statsData = await statsResponse.json()
      if (statsResponse.ok) {
        setStats(statsData.stats)
      } else {
        // Mock stats
        setStats({
          total_lectures: MOCK_LECTURES.length,
          total_slides: MOCK_SLIDES.length,
          total_comments: MOCK_COMMENTS.length,
          total_views: MOCK_LECTURES.reduce((sum, l) => sum + (l.view_count || 0), 0),
          avg_engagement: MOCK_LECTURES.reduce((sum, l) => sum + (l.engagement_score || 0), 0) / MOCK_LECTURES.length,
          weekly_activity: [
            { week: 1, lectures: 2, views: 290, comments: 20 },
            { week: 2, lectures: 2, views: 256, comments: 17 },
            { week: 3, lectures: 1, views: 201, comments: 22 }
          ]
        })
      }

    } catch (error) {
      console.error("Failed to fetch lecture data:", error)
      toast({
        title: "❌ Failed to Load Lecture Data",
        description: "Could not retrieve lecture information. Using mock data for demonstration.",
        variant: "destructive",
      })
      
      // Set mock data as fallback
      setLectures(MOCK_LECTURES)
      setSlides(MOCK_SLIDES)
      setComments(MOCK_COMMENTS)
      setStats({
        total_lectures: MOCK_LECTURES.length,
        total_slides: MOCK_SLIDES.length,
        total_comments: MOCK_COMMENTS.length,
        total_views: MOCK_LECTURES.reduce((sum, l) => sum + (l.view_count || 0), 0),
        avg_engagement: MOCK_LECTURES.reduce((sum, l) => sum + (l.engagement_score || 0), 0) / MOCK_LECTURES.length,
        weekly_activity: [
          { week: 1, lectures: 2, views: 290, comments: 20 },
          { week: 2, lectures: 2, views: 256, comments: 17 },
          { week: 3, lectures: 1, views: 201, comments: 22 }
        ]
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLecture = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/lectures", {
        method: "POST",
        headers: {
          ...buildInstructorAuthorizedApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(lectureForm)
      })

      if (response.ok) {
        toast({
          title: "✅ Lecture Created Successfully",
          description: `${lectureForm.title} has been created and is ready for content upload.`,
        })
        setCreateLectureDialog(false)
        resetLectureForm()
        fetchData()
      } else {
        throw new Error("Failed to create lecture")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Create Lecture",
        description: "Could not create lecture. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateLecture = async () => {
    if (!selectedLecture) return

    try {
      const response = await instructorApiFetch(`/api/instructor/lectures/${selectedLecture.id}`, {
        method: "PATCH",
        headers: {
          ...buildInstructorAuthorizedApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(lectureForm)
      })

      if (response.ok) {
        toast({
          title: "✅ Lecture Updated Successfully",
          description: `${lectureForm.title} has been updated with new information.`,
        })
        setEditLectureDialog(false)
        resetLectureForm()
        fetchData()
      } else {
        throw new Error("Failed to update lecture")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Update Lecture",
        description: "Could not update lecture. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteLecture = async () => {
    if (!selectedLecture) return

    try {
      const response = await instructorApiFetch(`/api/instructor/lectures/${selectedLecture.id}`, {
        method: "DELETE",
        headers: buildInstructorAuthorizedApiHeaders(),
      })

      if (response.ok) {
        toast({
          title: "✅ Lecture Deleted Successfully",
          description: `${selectedLecture.title} has been removed from the system.`,
        })
        setDeleteLectureDialog(false)
        fetchData()
      } else {
        throw new Error("Failed to delete lecture")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Delete Lecture",
        description: "Could not delete lecture. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleUploadSlide = async () => {
    if (!selectedLecture) return

    try {
      const formData = new FormData()
      formData.append("lecture_id", selectedLecture.id.toString())
      formData.append("title", slideForm.title)
      formData.append("slide_type", slideForm.slide_type)
      formData.append("content", slideForm.content)
      if (slideForm.file) {
        formData.append("file", slideForm.file)
      }

      const response = await instructorApiFetch("/api/instructor/lecture-slides", {
        method: "POST",
        headers: buildInstructorAuthorizedApiHeaders(),
        body: formData
      })

      if (response.ok) {
        toast({
          title: "✅ Slide Uploaded Successfully",
          description: `${slideForm.title} has been added to the lecture.`,
        })
        setUploadDialog(false)
        resetSlideForm()
        fetchData()
      } else {
        throw new Error("Failed to upload slide")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Upload Slide",
        description: "Could not upload slide. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleReplyToComment = async () => {
    if (!selectedComment || !commentReply.trim()) return

    try {
      const response = await instructorApiFetch(`/api/instructor/lecture-comments/${selectedComment.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: commentReply })
      })

      if (response.ok) {
        toast({
          title: "✅ Reply Posted Successfully",
          description: "Your reply has been posted and the student will be notified.",
        })
        setCommentsDialog(false)
        setCommentReply("")
        fetchData()
      } else {
        throw new Error("Failed to post reply")
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Post Reply",
        description: "Could not post reply. Please try again.",
        variant: "destructive",
      })
    }
  }

  const resetLectureForm = () => {
    setLectureForm({
      week: "",
      title: "",
      session: defaultCode,
      description: "",
      materials_url: ""
    })
  }

  const resetSlideForm = () => {
    setSlideForm({
      title: "",
      slide_type: "html",
      content: "",
      file: null
    })
  }

  const openEditDialog = (lecture: Lecture) => {
    setSelectedLecture(lecture)
    setLectureForm({
      week: lecture.week.toString(),
      title: lecture.title,
      session: lecture.session,
      description: lecture.description,
      materials_url: lecture.materials_url || ""
    })
    setEditLectureDialog(true)
  }

  const openSlidesDialog = (lecture: Lecture) => {
    setSelectedLecture(lecture)
    setSlidesDialog(true)
  }

  const openCommentsDialog = (lecture: Lecture) => {
    setSelectedLecture(lecture)
    setCommentsDialog(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-green-500"
      case "draft": return "bg-yellow-500"
      case "archived": return "bg-gray-500"
      default: return "bg-gray-500"
    }
  }

  const getSessionColor = (session: string) =>
    accessRows.find((r) => r.code === session)?.dotClass ?? "bg-gray-500"

  // Filter lectures
  const filteredLectures = lectures.filter(lecture => {
    const matchesSearch = lecture.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lecture.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSession = sessionFilter === "all" || lecture.session === sessionFilter
    const matchesWeek = weekFilter === "all" || lecture.week.toString() === weekFilter
    const matchesStatus = statusFilter === "all" || lecture.status === statusFilter
    return matchesSearch && matchesSession && matchesWeek && matchesStatus
  })

  const lectureComments = comments.filter(comment => 
    selectedLecture && comment.lecture_id === selectedLecture.id
  )

  const lectureSlides = slides.filter(slide => 
    selectedLecture && slide.lecture_id === selectedLecture.id
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-slate-600">Loading Lecture Management...</p>
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
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                <Presentation className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Lecture Management
                </h1>
                <p className="text-slate-600 text-sm mt-1">
                  Create, manage, and analyze lecture content with student engagement insights
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
              onClick={() => setCreateLectureDialog(true)}
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Create Lecture
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Presentation className="h-4 w-4 text-blue-500" />
                  Total Lectures
                </CardDescription>
                <CardTitle className="text-3xl text-blue-600">{stats.total_lectures}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">Across all sessions</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-500" />
                  Total Slides
                </CardDescription>
                <CardTitle className="text-3xl text-green-600">{stats.total_slides}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">Interactive content</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-500" />
                  Comments
                </CardDescription>
                <CardTitle className="text-3xl text-purple-600">{stats.total_comments}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">Student interactions</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-orange-500" />
                  Total Views
                </CardDescription>
                <CardTitle className="text-3xl text-orange-600">{stats.total_views.toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">Student engagement</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-indigo-500" />
                  Avg Engagement
                </CardDescription>
                <CardTitle className="text-3xl text-indigo-600">{stats.avg_engagement.toFixed(1)}/5.0</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-slate-600">Student satisfaction</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-sm rounded-xl">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="lectures" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg">
              <Presentation className="h-4 w-4 mr-2" />
              Lectures
            </TabsTrigger>
            <TabsTrigger value="slides" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg">
              <FileText className="h-4 w-4 mr-2" />
              Slides
            </TabsTrigger>
            <TabsTrigger value="comments" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg">
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weekly Activity Chart */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Weekly Activity
                  </CardTitle>
                  <CardDescription>Lecture views and student engagement by week</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats?.weekly_activity.map((week) => (
                      <div key={week.week} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-blue-600 border-blue-200">
                            Week {week.week}
                          </Badge>
                          <div>
                            <p className="font-medium text-slate-900">{week.lectures} lectures</p>
                            <p className="text-sm text-slate-600">{week.comments} comments</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-slate-900">{week.views} views</p>
                          <div className="w-24 bg-slate-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${Math.min((week.views / 300) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Comments */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                    Recent Comments
                  </CardTitle>
                  <CardDescription>Latest student feedback and questions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {comments.slice(0, 5).map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                          {comment.student_name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-slate-900">{comment.student_name}</p>
                            <Badge variant="outline" className="text-xs">
                              {comment.student_section}
                            </Badge>
                            {comment.is_resolved ? (
                              <Badge className="bg-green-500 text-white text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resolved
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-500 text-white text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 line-clamp-2">{comment.content}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(comment.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Lectures Tab */}
          <TabsContent value="lectures" className="space-y-6">
            {/* Filters */}
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Presentation className="h-5 w-5 text-blue-500" />
                      Lecture Management
                    </CardTitle>
                    <CardDescription>Create, edit, and manage your lecture content</CardDescription>
                  </div>
                  <div className="flex gap-3">
                    <Input
                      placeholder="Search lectures..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64"
                    />
                    <Select value={sessionFilter} onValueChange={setSessionFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Session" />
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
                    <Select value={weekFilter} onValueChange={setWeekFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Week" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Weeks</SelectItem>
                        {Array.from({ length: 16 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            Week {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLectures.map((lecture) => (
                      <Card key={lecture.id} className="hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-blue-600 border-blue-200">
                                  Week {lecture.week}
                                </Badge>
                                <Badge variant="outline" className={`${getSessionColor(lecture.session)} text-white border-0`}>
                                  {getSectionColumnHeading(lecture.session, labelByCode)}
                                </Badge>
                                <Badge variant="outline" className={`${getStatusColor(lecture.status || "draft")} text-white border-0`}>
                                  {lecture.status || "draft"}
                                </Badge>
                              </div>
                              <CardTitle className="text-lg line-clamp-2">{lecture.title}</CardTitle>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-slate-600 line-clamp-3">{lecture.description}</p>
                          
                          <div className="flex items-center justify-between text-sm text-slate-500">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <FileText className="h-4 w-4" />
                                <span>{lecture.slide_count || 0}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageSquare className="h-4 w-4" />
                                <span>{lecture.comment_count || 0}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Eye className="h-4 w-4" />
                                <span>{lecture.view_count || 0}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500" />
                              <span>{lecture.engagement_score?.toFixed(1) || "0.0"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openSlidesDialog(lecture)}
                              className="flex-1"
                            >
                              <Upload className="h-4 w-4 mr-1" />
                              Slides
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCommentsDialog(lecture)}
                              className="flex-1"
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Comments
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(lecture)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedLecture(lecture)
                                setDeleteLectureDialog(true)
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <UITable>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Week</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Session</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Slides</TableHead>
                        <TableHead>Comments</TableHead>
                        <TableHead>Views</TableHead>
                        <TableHead>Engagement</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLectures.map((lecture) => (
                        <TableRow key={lecture.id}>
                          <TableCell>
                            <Badge variant="outline" className="text-blue-600 border-blue-200">
                              Week {lecture.week}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{lecture.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${getSessionColor(lecture.session)} text-white border-0`}>
                              {getSectionColumnHeading(lecture.session, labelByCode)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${getStatusColor(lecture.status || "draft")} text-white border-0`}>
                              {lecture.status || "draft"}
                            </Badge>
                          </TableCell>
                          <TableCell>{lecture.slide_count || 0}</TableCell>
                          <TableCell>{lecture.comment_count || 0}</TableCell>
                          <TableCell>{lecture.view_count || 0}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500" />
                              <span>{lecture.engagement_score?.toFixed(1) || "0.0"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openSlidesDialog(lecture)}
                              >
                                <Upload className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openCommentsDialog(lecture)}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(lecture)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedLecture(lecture)
                                  setDeleteLectureDialog(true)
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </UITable>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Slides Tab */}
          <TabsContent value="slides" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-500" />
                  Slide Management
                </CardTitle>
                <CardDescription>Upload and manage lecture slides and interactive content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {slides.map((slide) => (
                    <div key={slide.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-100">
                          {slide.slide_type === "pdf" && <FileText className="h-5 w-5 text-red-500" />}
                          {slide.slide_type === "ppt" && <Presentation className="h-5 w-5 text-orange-500" />}
                          {slide.slide_type === "html" && <Code className="h-5 w-5 text-blue-500" />}
                          {slide.slide_type === "image" && <Image className="h-5 w-5 text-green-500" />}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{slide.title}</p>
                          <p className="text-sm text-slate-600">
                            Lecture {slide.lecture_id} • {slide.slide_type.toUpperCase()} • Order {slide.slide_order}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={slide.is_active ? "default" : "secondary"}>
                          {slide.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                  Student Comments & Feedback
                </CardTitle>
                <CardDescription>Review and respond to student questions and feedback</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                            {comment.student_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{comment.student_name}</p>
                            <p className="text-sm text-slate-600">{comment.student_section} • Lecture {comment.lecture_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {comment.is_resolved ? (
                            <Badge className="bg-green-500 text-white">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolved
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-500 text-white">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedComment(comment)
                              setCommentsDialog(true)
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Reply
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-slate-700 mb-3">{comment.content}</p>
                      
                      {comment.instructor_reply && (
                        <div className="bg-blue-50 rounded-lg p-3 mt-3">
                          <p className="text-sm font-medium text-blue-900 mb-1">Your Reply:</p>
                          <p className="text-sm text-blue-800">{comment.instructor_reply}</p>
                          <p className="text-xs text-blue-600 mt-1">
                            {comment.instructor_reply_date && new Date(comment.instructor_reply_date).toLocaleString()}
                          </p>
                        </div>
                      )}
                      
                      <p className="text-xs text-slate-500">
                        {new Date(comment.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Lecture Dialog */}
        <Dialog open={createLectureDialog} onOpenChange={setCreateLectureDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-500" />
                Create New Lecture
              </DialogTitle>
              <DialogDescription>
                Create a new lecture with title, description, and session details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="week">Week</Label>
                  <Select value={lectureForm.week} onValueChange={(value) => setLectureForm({...lectureForm, week: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select week" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 16 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          Week {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session">Session</Label>
                  <Select value={lectureForm.session} onValueChange={(value) => setLectureForm({...lectureForm, session: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectOptions.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Lecture Title</Label>
                <Input
                  id="title"
                  value={lectureForm.title}
                  onChange={(e) => setLectureForm({...lectureForm, title: e.target.value})}
                  placeholder="Enter lecture title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={lectureForm.description}
                  onChange={(e) => setLectureForm({...lectureForm, description: e.target.value})}
                  placeholder="Enter lecture description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="materials_url">Materials URL (Optional)</Label>
                <Input
                  id="materials_url"
                  value={lectureForm.materials_url}
                  onChange={(e) => setLectureForm({...lectureForm, materials_url: e.target.value})}
                  placeholder="https://example.com/materials"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCreateLectureDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateLecture} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <Plus className="h-4 w-4 mr-2" />
                Create Lecture
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Lecture Dialog */}
        <Dialog open={editLectureDialog} onOpenChange={setEditLectureDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-500" />
                Edit Lecture
              </DialogTitle>
              <DialogDescription>
                Update lecture information and settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-week">Week</Label>
                  <Select value={lectureForm.week} onValueChange={(value) => setLectureForm({...lectureForm, week: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select week" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 16 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          Week {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-session">Session</Label>
                  <Select value={lectureForm.session} onValueChange={(value) => setLectureForm({...lectureForm, session: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectOptions.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-title">Lecture Title</Label>
                <Input
                  id="edit-title"
                  value={lectureForm.title}
                  onChange={(e) => setLectureForm({...lectureForm, title: e.target.value})}
                  placeholder="Enter lecture title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={lectureForm.description}
                  onChange={(e) => setLectureForm({...lectureForm, description: e.target.value})}
                  placeholder="Enter lecture description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-materials_url">Materials URL (Optional)</Label>
                <Input
                  id="edit-materials_url"
                  value={lectureForm.materials_url}
                  onChange={(e) => setLectureForm({...lectureForm, materials_url: e.target.value})}
                  placeholder="https://example.com/materials"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditLectureDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateLecture} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <Save className="h-4 w-4 mr-2" />
                Update Lecture
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Lecture Dialog */}
        <Dialog open={deleteLectureDialog} onOpenChange={setDeleteLectureDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                Delete Lecture
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{selectedLecture?.title}"? This action cannot be undone and will remove all associated slides and comments.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteLectureDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleDeleteLecture} variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Lecture
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Slides Management Dialog */}
        <Dialog open={slidesDialog} onOpenChange={setSlidesDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-500" />
                Manage Slides - {selectedLecture?.title}
              </DialogTitle>
              <DialogDescription>
                Upload and manage slides for this lecture. Support for PDF, PPT, HTML, and images.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Upload New Slide */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Upload New Slide</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="slide-title">Slide Title</Label>
                      <Input
                        id="slide-title"
                        value={slideForm.title}
                        onChange={(e) => setSlideForm({...slideForm, title: e.target.value})}
                        placeholder="Enter slide title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slide-type">Slide Type</Label>
                      <Select value={slideForm.slide_type} onValueChange={(value: "pdf" | "ppt" | "html" | "image") => setSlideForm({...slideForm, slide_type: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="html">HTML/CSS</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="ppt">PowerPoint</SelectItem>
                          <SelectItem value="image">Image</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {slideForm.slide_type === "html" && (
                    <div className="space-y-2">
                      <Label htmlFor="slide-content">HTML Content</Label>
                      <Textarea
                        id="slide-content"
                        value={slideForm.content}
                        onChange={(e) => setSlideForm({...slideForm, content: e.target.value})}
                        placeholder="Enter HTML content..."
                        rows={8}
                      />
                    </div>
                  )}
                  
                  {slideForm.slide_type !== "html" && (
                    <div className="space-y-2">
                      <Label htmlFor="slide-file">Upload File</Label>
                      <Input
                        id="slide-file"
                        type="file"
                        accept={slideForm.slide_type === "pdf" ? ".pdf" : slideForm.slide_type === "ppt" ? ".ppt,.pptx" : ".jpg,.jpeg,.png,.gif"}
                        onChange={(e) => setSlideForm({...slideForm, file: e.target.files?.[0] || null})}
                      />
                    </div>
                  )}
                  
                  <Button onClick={handleUploadSlide} className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Slide
                  </Button>
                </CardContent>
              </Card>

              {/* Existing Slides */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Existing Slides</h3>
                <div className="space-y-3">
                  {lectureSlides.map((slide) => (
                    <div key={slide.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-100">
                          {slide.slide_type === "pdf" && <FileText className="h-5 w-5 text-red-500" />}
                          {slide.slide_type === "ppt" && <Presentation className="h-5 w-5 text-orange-500" />}
                          {slide.slide_type === "html" && <Code className="h-5 w-5 text-blue-500" />}
                          {slide.slide_type === "image" && <Image className="h-5 w-5 text-green-500" />}
                        </div>
                        <div>
                          <p className="font-medium">{slide.title}</p>
                          <p className="text-sm text-slate-600">Order: {slide.slide_order}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={slide.is_active ? "default" : "secondary"}>
                          {slide.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Comments Management Dialog */}
        <Dialog open={commentsDialog} onOpenChange={setCommentsDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-500" />
                Comments - {selectedLecture?.title}
              </DialogTitle>
              <DialogDescription>
                Review and respond to student comments and questions
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {lectureComments.map((comment) => (
                <div key={comment.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                        {comment.student_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{comment.student_name}</p>
                        <p className="text-sm text-slate-600">{comment.student_section}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {comment.is_resolved ? (
                        <Badge className="bg-green-500 text-white">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Resolved
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-500 text-white">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedComment(comment)
                          setCommentReply("")
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Reply
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-slate-700 mb-3">{comment.content}</p>
                  
                  {comment.instructor_reply && (
                    <div className="bg-blue-50 rounded-lg p-3 mt-3">
                      <p className="text-sm font-medium text-blue-900 mb-1">Your Reply:</p>
                      <p className="text-sm text-blue-800">{comment.instructor_reply}</p>
                      <p className="text-xs text-blue-600 mt-1">
                        {comment.instructor_reply_date && new Date(comment.instructor_reply_date).toLocaleString()}
                      </p>
                    </div>
                  )}
                  
                  <p className="text-xs text-slate-500">
                    {new Date(comment.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Reply to Comment Dialog */}
        <Dialog open={!!selectedComment} onOpenChange={() => setSelectedComment(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-500" />
                Reply to {selectedComment?.student_name}
              </DialogTitle>
              <DialogDescription>
                Respond to the student's comment or question
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="font-medium text-slate-900 mb-2">Student Comment:</p>
                <p className="text-slate-700">{selectedComment?.content}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reply">Your Reply</Label>
                <Textarea
                  id="reply"
                  value={commentReply}
                  onChange={(e) => setCommentReply(e.target.value)}
                  placeholder="Type your reply here..."
                  rows={4}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedComment(null)}>
                Cancel
              </Button>
              <Button onClick={handleReplyToComment} className="bg-gradient-to-r from-purple-600 to-indigo-600">
                <MessageSquare className="h-4 w-4 mr-2" />
                Post Reply
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
