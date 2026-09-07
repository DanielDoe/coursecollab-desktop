"use client"


import { studentApiFetch } from "@/lib/auth"
import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  GraduationCap,
  MessageSquare,
  Lightbulb,
  Bug,
  Users,
  Trophy,
  ArrowLeft,
  Plus,
  Search,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Award,
  TrendingUp,
  Clock,
  Send,
  Star,
  Filter,
  SortAsc,
  SortDesc,
  Zap,
  Flame,
  Crown,
  Target,
  Brain,
  Rocket,
  Heart,
  Bookmark,
  Share2,
  Eye,
  ChevronRight,
  Sparkles,
  Activity,
  BarChart3,
  Calendar,
  UserPlus,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  XCircle,
  PlayCircle,
  Code,
  FileText,
  Image,
  Link as LinkIcon,
} from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"
import { useToast } from "@/components/ui/use-toast"

type Thread = {
  id: number
  student_id: number
  title: string
  description: string
  code_snippet?: string
  tags: string[]
  upvotes: number
  downvotes: number
  reply_count: number
  is_anonymous: boolean
  created_at: string
  author_name: string
  author_reputation: number
}

type FeatureRequest = {
  id: number
  student_id: number
  title: string
  description: string
  priority: "low" | "medium" | "high"
  status: "pending" | "under_review" | "approved" | "rejected" | "implemented"
  upvotes: number
  created_at: string
  author_name: string
  author_reputation: number
}

type BugReport = {
  id: number
  student_id: number
  title: string
  description: string
  severity: "low" | "medium" | "high" | "critical"
  status: "open" | "investigating" | "fixing" | "resolved" | "closed"
  upvotes: number
  created_at: string
  author_name: string
  author_reputation: number
}

type TutoringOffer = {
  id: number
  student_id: number
  subject: string
  description: string
  hourly_rate: number
  availability: string
  rating: number
  total_sessions: number
  created_at: string
  author_name: string
  author_reputation: number
}

type LeaderboardEntry = {
  student_id: number
  student_name: string
  points: number
  rank: number
  threads_count: number
  replies_count: number
  upvotes_received: number
  feature_requests_count?: number
  bug_reports_count?: number
}

export default function StudentForumPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const homeLink = useSmartHomeLink()
  const { toast } = useToast()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [threads, setThreads] = useState<Thread[]>([])
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([])
  const [bugReports, setBugReports] = useState<BugReport[]>([])
  const [tutoringOffers, setTutoringOffers] = useState<TutoringOffer[]>([])
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<LeaderboardEntry[]>([])
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<LeaderboardEntry[]>([])

  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("recent")
  const [selectedTag, setSelectedTag] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("all")

  // Dialog states
  const [showNewThread, setShowNewThread] = useState(false)
  const [showNewFeature, setShowNewFeature] = useState(false)
  const [showNewBug, setShowNewBug] = useState(false)
  const [showNewTutoring, setShowNewTutoring] = useState(false)

  // Form states
  const [newThread, setNewThread] = useState({
    title: "",
    description: "",
    codeSnippet: "",
    tags: [] as string[],
    isAnonymous: false,
  })
  const [newFeature, setNewFeature] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
  })
  const [newBug, setNewBug] = useState({
    title: "",
    description: "",
    severity: "medium" as "low" | "medium" | "high" | "critical",
  })
  const [newTutoring, setNewTutoring] = useState({
    subject: "",
    description: "",
    hourlyRate: "",
    availability: "",
  })

  const activeTab = searchParams.get("tab") || "overview"

  useEffect(() => {
    const id = sessionStorage.getItem("studentDatabaseId")
    const name = sessionStorage.getItem("studentName")
    const session = sessionStorage.getItem("studentSection")

    if (!id) {
      router.push("/student/login")
      return
    }

    setStudentId(id)
    setStudentName(name || "")
    if (session) {
      fetchSessionId(session)
    }
    setLoading(false)
  }, [router])

  const fetchSessionId = async (sectionCode: string) => {
    try {
      const response = await studentApiFetch(`/api/student/sessions?section=${sectionCode}`)
      const data = await response.json()
      if (response.ok && data.sessions.length > 0) {
        setSessionId(data.sessions[0].id.toString())
        fetchForumData(data.sessions[0].id.toString())
      }
    } catch (error) {
      console.error("Failed to fetch session:", error)
    }
  }

  const fetchForumData = async (sessionId: string) => {
    try {
      const [threadsRes, featuresRes, bugsRes, tutoringRes, leaderboardRes] = await Promise.all([
        fetch(`/api/forum/threads?sortBy=${sortBy}`),
        fetch(`/api/forum/feature-requests?sortBy=${sortBy}`),
        fetch(`/api/forum/bug-reports?sortBy=${sortBy}`),
        fetch(`/api/forum/tutoring?sortBy=${sortBy}`),
        fetch(`/api/forum/reputation?sessionId=${sessionId}`),
      ])

      if (threadsRes.ok) {
        const threadsData = await threadsRes.json()
        setThreads(threadsData.threads || [])
      }
      if (featuresRes.ok) {
        const featuresData = await featuresRes.json()
        setFeatureRequests(featuresData.requests || [])
      }
      if (bugsRes.ok) {
        const bugsData = await bugsRes.json()
        setBugReports(bugsData.reports || [])
      }
      if (tutoringRes.ok) {
        const tutoringData = await tutoringRes.json()
        setTutoringOffers(tutoringData.offers || [])
      }
      if (leaderboardRes.ok) {
        const leaderboardData = await leaderboardRes.json()
        setWeeklyLeaderboard(leaderboardData.weekly || [])
        setAllTimeLeaderboard(leaderboardData.allTime || [])
      }
    } catch (error) {
      console.error("Failed to fetch forum data:", error)
    }
  }

  const handleCreateThread = async () => {
    if (!studentId || !newThread.title || !newThread.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/forum/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          ...newThread,
        }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "Thread created successfully!" })
        setNewThread({ title: "", description: "", codeSnippet: "", tags: [], isAnonymous: false })
        setShowNewThread(false)
        fetchForumData(sessionId!)
      } else {
        throw new Error("Failed to create thread")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create thread",
        variant: "destructive",
      })
    }
  }

  const handleCreateFeature = async () => {
    if (!studentId || !newFeature.title || !newFeature.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/forum/feature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          ...newFeature,
        }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "Feature request created successfully!" })
        setNewFeature({ title: "", description: "", priority: "medium" })
        setShowNewFeature(false)
        fetchForumData(sessionId!)
      } else {
        throw new Error("Failed to create feature request")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create feature request",
        variant: "destructive",
      })
    }
  }

  const handleCreateBug = async () => {
    if (!studentId || !newBug.title || !newBug.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/forum/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          ...newBug,
        }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "Bug report created successfully!" })
        setNewBug({ title: "", description: "", severity: "medium" })
        setShowNewBug(false)
        fetchForumData(sessionId!)
      } else {
        throw new Error("Failed to create bug report")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create bug report",
        variant: "destructive",
      })
    }
  }

  const handleCreateTutoring = async () => {
    if (!studentId || !newTutoring.subject || !newTutoring.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/forum/tutoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          ...newTutoring,
          hourlyRate: parseFloat(newTutoring.hourlyRate),
        }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "Tutoring offer created successfully!" })
        setNewTutoring({ subject: "", description: "", hourlyRate: "", availability: "" })
        setShowNewTutoring(false)
        fetchForumData(sessionId!)
      } else {
        throw new Error("Failed to create tutoring offer")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create tutoring offer",
        variant: "destructive",
      })
    }
  }

  const handleVote = async (type: "thread" | "feature" | "bug", id: number, voteType: "up" | "down") => {
    if (!studentId) return

    try {
      const response = await fetch("/api/forum/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          type,
          itemId: id,
          voteType,
        }),
      })

      if (response.ok) {
        fetchForumData(sessionId!)
      }
    } catch (error) {
      console.error("Failed to vote:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            <MessageSquare className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading Forum...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 dark:border-gray-800/50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href={homeLink} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">CourseCollab</h1>
            </Link>
            <StudentProfileDropdown />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => router.push(homeLink)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

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
                    <MessageSquare className="h-8 w-8 text-white" />
          </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                      Forum & Collaboration Hub
                    </h1>
                    <p className="text-blue-100 text-lg">
                      Connect, learn, and grow together with your peers
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge className="bg-white/20 text-white border-white/30 px-4 py-2 text-sm">
                    Session {sessionId}
                  </Badge>
                  <Badge className="bg-yellow-400/20 text-yellow-100 border-yellow-300/30 px-4 py-2 text-sm">
                    {threads.length + featureRequests.length + bugReports.length} Active Discussions
                  </Badge>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="w-32 h-32 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <Users className="h-16 w-16 text-white/80" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    placeholder="Search discussions, features, bugs, or tutoring..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-12 text-lg border-2 border-slate-200 dark:border-slate-600 focus:border-indigo-500 rounded-xl bg-white/50 dark:bg-slate-700/50"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40 rounded-xl">
                      <SortAsc className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Most Recent</SelectItem>
                      <SelectItem value="popular">Most Popular</SelectItem>
                      <SelectItem value="trending">Trending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="rounded-xl">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => router.push(`/student/forum?tab=${v}`)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl p-2">
            <TabsTrigger value="overview" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Activity className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="discussions" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <MessageSquare className="h-4 w-4 mr-2" />
              Discussions
            </TabsTrigger>
            <TabsTrigger value="features" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Lightbulb className="h-4 w-4 mr-2" />
              Features
            </TabsTrigger>
            <TabsTrigger value="bugs" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Bug className="h-4 w-4 mr-2" />
              Bugs
            </TabsTrigger>
            <TabsTrigger value="tutoring" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Users className="h-4 w-4 mr-2" />
              Tutoring
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <Trophy className="h-4 w-4 mr-2" />
              Leaderboard
            </TabsTrigger>
            </TabsList>

          {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Quick Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="lg:col-span-2 space-y-6"
              >
                {/* Recent Activity */}
                <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-6">
                    <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                          <Activity className="h-5 w-5 text-white" />
                      </div>
                      <div>
                          <CardTitle className="text-xl font-bold">Recent Activity</CardTitle>
                          <p className="text-slate-600 dark:text-slate-300">Latest discussions and updates</p>
                      </div>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        View All
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {threads.slice(0, 3).map((thread, index) => (
                        <motion.div
                          key={thread.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                          onClick={() => router.push(`/student/forum/thread/${thread.id}`)}
                        >
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center justify-center">
                            <MessageSquare className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-800 dark:text-white truncate">{thread.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {thread.author_name}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {new Date(thread.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-slate-500">
                              <ThumbsUp className="h-4 w-4" />
                              <span className="text-sm">{thread.upvotes}</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-500">
                              <MessageCircle className="h-4 w-4" />
                              <span className="text-sm">{thread.reply_count}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                  <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold">Quick Actions</CardTitle>
                        <p className="text-slate-600 dark:text-slate-300">Start a new discussion or offer help</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <Dialog open={showNewThread} onOpenChange={setShowNewThread}>
                        <DialogTrigger asChild>
                          <Button className="h-20 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl">
                            <div className="text-center">
                              <MessageSquare className="h-6 w-6 mx-auto mb-2" />
                              <span className="text-sm font-semibold">New Discussion</span>
                            </div>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Start New Discussion</DialogTitle>
                            <DialogDescription>
                              Share your thoughts, ask questions, or help others learn
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="title">Title</Label>
                              <Input
                                id="title"
                                value={newThread.title}
                                onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                                placeholder="What's your question or topic?"
                                className="rounded-xl"
                              />
                            </div>
                            <div>
                              <Label htmlFor="description">Description</Label>
                              <Textarea
                                id="description"
                                value={newThread.description}
                                onChange={(e) => setNewThread({ ...newThread, description: e.target.value })}
                                placeholder="Provide details about your question or topic..."
                                className="rounded-xl min-h-[120px]"
                              />
                            </div>
                            <div>
                              <Label htmlFor="codeSnippet">Code Snippet (Optional)</Label>
                              <Textarea
                                id="codeSnippet"
                                value={newThread.codeSnippet}
                                onChange={(e) => setNewThread({ ...newThread, codeSnippet: e.target.value })}
                                placeholder="Paste your code here if relevant..."
                                className="rounded-xl min-h-[100px] font-mono"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="anonymous"
                                checked={newThread.isAnonymous}
                                onChange={(e) => setNewThread({ ...newThread, isAnonymous: e.target.checked })}
                                className="rounded"
                              />
                              <Label htmlFor="anonymous">Post anonymously</Label>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setShowNewThread(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleCreateThread} className="bg-gradient-to-r from-indigo-500 to-purple-600">
                                Create Discussion
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={showNewFeature} onOpenChange={setShowNewFeature}>
                        <DialogTrigger asChild>
                          <Button className="h-20 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white rounded-xl">
                            <div className="text-center">
                              <Lightbulb className="h-6 w-6 mx-auto mb-2" />
                              <span className="text-sm font-semibold">Feature Request</span>
                      </div>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Request New Feature</DialogTitle>
                            <DialogDescription>
                              Suggest improvements or new features for the platform
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                      <div>
                              <Label htmlFor="featureTitle">Title</Label>
                              <Input
                                id="featureTitle"
                                value={newFeature.title}
                                onChange={(e) => setNewFeature({ ...newFeature, title: e.target.value })}
                                placeholder="What feature would you like to see?"
                                className="rounded-xl"
                              />
                      </div>
                            <div>
                              <Label htmlFor="featureDescription">Description</Label>
                              <Textarea
                                id="featureDescription"
                                value={newFeature.description}
                                onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                                placeholder="Describe the feature and why it would be useful..."
                                className="rounded-xl min-h-[120px]"
                              />
                    </div>
                            <div>
                              <Label htmlFor="priority">Priority</Label>
                              <Select value={newFeature.priority} onValueChange={(value: "low" | "medium" | "high") => setNewFeature({ ...newFeature, priority: value })}>
                                <SelectTrigger className="rounded-xl">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setShowNewFeature(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleCreateFeature} className="bg-gradient-to-r from-yellow-500 to-orange-600">
                                Submit Request
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={showNewBug} onOpenChange={setShowNewBug}>
                        <DialogTrigger asChild>
                          <Button className="h-20 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl">
                            <div className="text-center">
                              <Bug className="h-6 w-6 mx-auto mb-2" />
                              <span className="text-sm font-semibold">Report Bug</span>
                      </div>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Report a Bug</DialogTitle>
                            <DialogDescription>
                              Help us improve by reporting issues you've encountered
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                      <div>
                              <Label htmlFor="bugTitle">Title</Label>
                              <Input
                                id="bugTitle"
                                value={newBug.title}
                                onChange={(e) => setNewBug({ ...newBug, title: e.target.value })}
                                placeholder="Brief description of the bug"
                                className="rounded-xl"
                              />
                      </div>
                            <div>
                              <Label htmlFor="bugDescription">Description</Label>
                              <Textarea
                                id="bugDescription"
                                value={newBug.description}
                                onChange={(e) => setNewBug({ ...newBug, description: e.target.value })}
                                placeholder="Describe what happened, steps to reproduce, and expected behavior..."
                                className="rounded-xl min-h-[120px]"
                              />
                    </div>
                            <div>
                              <Label htmlFor="severity">Severity</Label>
                              <Select value={newBug.severity} onValueChange={(value: "low" | "medium" | "high" | "critical") => setNewBug({ ...newBug, severity: value })}>
                                <SelectTrigger className="rounded-xl">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setShowNewBug(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleCreateBug} className="bg-gradient-to-r from-red-500 to-pink-600">
                                Report Bug
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={showNewTutoring} onOpenChange={setShowNewTutoring}>
                        <DialogTrigger asChild>
                          <Button className="h-20 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl">
                            <div className="text-center">
                              <Users className="h-6 w-6 mx-auto mb-2" />
                              <span className="text-sm font-semibold">Offer Tutoring</span>
                            </div>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Offer Tutoring Services</DialogTitle>
                            <DialogDescription>
                              Help fellow students by offering your expertise
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="subject">Subject</Label>
                              <Input
                                id="subject"
                                value={newTutoring.subject}
                                onChange={(e) => setNewTutoring({ ...newTutoring, subject: e.target.value })}
                                placeholder="e.g., C++ Programming, Data Structures"
                                className="rounded-xl"
                              />
                            </div>
                            <div>
                              <Label htmlFor="tutoringDescription">Description</Label>
                              <Textarea
                                id="tutoringDescription"
                                value={newTutoring.description}
                                onChange={(e) => setNewTutoring({ ...newTutoring, description: e.target.value })}
                                placeholder="Describe your expertise and teaching approach..."
                                className="rounded-xl min-h-[120px]"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                                <Input
                                  id="hourlyRate"
                                  type="number"
                                  value={newTutoring.hourlyRate}
                                  onChange={(e) => setNewTutoring({ ...newTutoring, hourlyRate: e.target.value })}
                                  placeholder="25"
                                  className="rounded-xl"
                                />
                              </div>
                              <div>
                                <Label htmlFor="availability">Availability</Label>
                                <Input
                                  id="availability"
                                  value={newTutoring.availability}
                                  onChange={(e) => setNewTutoring({ ...newTutoring, availability: e.target.value })}
                                  placeholder="e.g., Weekdays 6-8 PM"
                                  className="rounded-xl"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setShowNewTutoring(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleCreateTutoring} className="bg-gradient-to-r from-emerald-500 to-teal-600">
                                Offer Tutoring
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
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
                {/* Stats */}
                <Card className="border-0 shadow-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold">Forum Stats</CardTitle>
                        <p className="text-indigo-100 text-sm">Community activity</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-indigo-200" />
                        <span className="text-sm text-indigo-100">Discussions</span>
              </div>
                      <span className="text-2xl font-bold">{threads.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-indigo-200" />
                        <span className="text-sm text-indigo-100">Feature Requests</span>
                      </div>
                      <span className="text-2xl font-bold">{featureRequests.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bug className="h-4 w-4 text-indigo-200" />
                        <span className="text-sm text-indigo-100">Bug Reports</span>
                      </div>
                      <span className="text-2xl font-bold">{bugReports.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-200" />
                        <span className="text-sm text-indigo-100">Tutoring Offers</span>
                      </div>
                      <span className="text-2xl font-bold">{tutoringOffers.length}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Contributors */}
                <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center">
                        <Crown className="h-5 w-5 text-white" />
                      </div>
                    <div>
                        <CardTitle className="text-lg font-bold">Top Contributors</CardTitle>
                        <p className="text-slate-500 text-sm">This week</p>
                    </div>
                  </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {weeklyLeaderboard.slice(0, 5).map((entry, index) => (
                        <div key={entry.student_id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0 ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white" : 
                            index === 1 ? "bg-gradient-to-r from-gray-400 to-gray-500 text-white" :
                            index === 2 ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white" :
                            "bg-gradient-to-r from-slate-400 to-slate-500 text-white"
                          }`}>
                            {index + 1}
                    </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{entry.student_name}</p>
                            <p className="text-xs text-slate-500">{entry.points} points</p>
                  </div>
                          <Badge variant="outline" className="text-xs">
                            {entry.threads_count + entry.replies_count} posts
                    </Badge>
                    </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

                {/* Quick Tips */}
                <Card className="border-0 shadow-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Lightbulb className="h-5 w-5" />
                  </div>
                      <div>
                        <CardTitle className="text-lg font-bold">Forum Tips</CardTitle>
                        <p className="text-emerald-100 text-sm">Maximize your experience</p>
                </div>
                        </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Star className="h-4 w-4 text-emerald-200 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-emerald-100">
                        <strong>Be specific</strong> in your questions and provide context
                      </p>
                        </div>
                    <div className="flex items-start gap-3">
                      <Heart className="h-4 w-4 text-emerald-200 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-emerald-100">
                        <strong>Help others</strong> by answering questions and sharing knowledge
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Award className="h-4 w-4 text-emerald-200 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-emerald-100">
                        <strong>Earn reputation</strong> through quality contributions
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* Discussions Tab */}
          <TabsContent value="discussions" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Discussions</h2>
                  <Dialog open={showNewThread} onOpenChange={setShowNewThread}>
                    <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl">
                        <Plus className="h-4 w-4 mr-2" />
                    New Discussion
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                    <DialogTitle>Start New Discussion</DialogTitle>
                    <DialogDescription>
                      Share your thoughts, ask questions, or help others learn
                    </DialogDescription>
                      </DialogHeader>
                  <div className="space-y-4">
                        <div>
                          <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={newThread.title}
                        onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                        placeholder="What's your question or topic?"
                        className="rounded-xl"
                      />
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                        value={newThread.description}
                        onChange={(e) => setNewThread({ ...newThread, description: e.target.value })}
                        placeholder="Provide details about your question or topic..."
                        className="rounded-xl min-h-[120px]"
                          />
                        </div>
                        <div>
                      <Label htmlFor="codeSnippet">Code Snippet (Optional)</Label>
                          <Textarea
                            id="codeSnippet"
                        value={newThread.codeSnippet}
                        onChange={(e) => setNewThread({ ...newThread, codeSnippet: e.target.value })}
                        placeholder="Paste your code here if relevant..."
                        className="rounded-xl min-h-[100px] font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="anonymous"
                        checked={newThread.isAnonymous}
                        onChange={(e) => setNewThread({ ...newThread, isAnonymous: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="anonymous">Post anonymously</Label>
                        </div>
                        <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowNewThread(false)}>
                            Cancel
                          </Button>
                      <Button onClick={handleCreateThread} className="bg-gradient-to-r from-indigo-500 to-purple-600">
                        Create Discussion
                          </Button>
                        </div>
                  </div>
                    </DialogContent>
                  </Dialog>
              </div>

            <div className="grid gap-6">
              {threads.map((thread, index) => (
                <motion.div
                  key={thread.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 cursor-pointer"
                        onClick={() => router.push(`/student/forum/thread/${thread.id}`)}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white line-clamp-2">
                              {thread.title}
                            </h3>
                            <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleVote("thread", thread.id, "up")
                                }}
                                className="text-slate-500 hover:text-green-600"
                            >
                              <ThumbsUp className="h-4 w-4" />
                                <span className="ml-1">{thread.upvotes}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleVote("thread", thread.id, "down")
                                }}
                                className="text-slate-500 hover:text-red-600"
                            >
                              <ThumbsDown className="h-4 w-4" />
                                <span className="ml-1">{thread.downvotes}</span>
                            </Button>
                          </div>
                            </div>
                          <p className="text-slate-600 dark:text-slate-300 line-clamp-2 mb-3">
                            {thread.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                              <UserPlus className="h-4 w-4" />
                              <span>{thread.is_anonymous ? "Anonymous" : thread.author_name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(thread.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageCircle className="h-4 w-4" />
                              <span>{thread.reply_count} replies</span>
                            </div>
                            {thread.tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span>Tags:</span>
                                {thread.tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {thread.tags.length > 3 && (
                                  <span className="text-xs">+{thread.tags.length - 3} more</span>
                                )}
                              </div>
                            )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                </motion.div>
              ))}
              </div>
            </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Feature Requests</h2>
                <Dialog open={showNewFeature} onOpenChange={setShowNewFeature}>
                  <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white rounded-xl">
                      <Plus className="h-4 w-4 mr-2" />
                    Request Feature
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                    <DialogTitle>Request New Feature</DialogTitle>
                    <DialogDescription>
                      Suggest improvements or new features for the platform
                    </DialogDescription>
                    </DialogHeader>
                  <div className="space-y-4">
                      <div>
                      <Label htmlFor="featureTitle">Title</Label>
                      <Input
                        id="featureTitle"
                        value={newFeature.title}
                        onChange={(e) => setNewFeature({ ...newFeature, title: e.target.value })}
                        placeholder="What feature would you like to see?"
                        className="rounded-xl"
                      />
                      </div>
                      <div>
                      <Label htmlFor="featureDescription">Description</Label>
                        <Textarea
                        id="featureDescription"
                        value={newFeature.description}
                        onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                        placeholder="Describe the feature and why it would be useful..."
                        className="rounded-xl min-h-[120px]"
                        />
                      </div>
                      <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={newFeature.priority} onValueChange={(value: "low" | "medium" | "high") => setNewFeature({ ...newFeature, priority: value })}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowNewFeature(false)}>
                          Cancel
                        </Button>
                      <Button onClick={handleCreateFeature} className="bg-gradient-to-r from-yellow-500 to-orange-600">
                        Submit Request
                        </Button>
                      </div>
                  </div>
                  </DialogContent>
                </Dialog>
              </div>

            <div className="grid gap-6">
              {featureRequests.map((feature, index) => (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                          <Lightbulb className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white line-clamp-2">
                              {feature.title}
                            </h3>
                            <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                                onClick={() => handleVote("feature", feature.id, "up")}
                                className="text-slate-500 hover:text-green-600"
                            >
                              <ThumbsUp className="h-4 w-4" />
                                <span className="ml-1">{feature.upvotes}</span>
                            </Button>
                          </div>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 line-clamp-2 mb-3">
                            {feature.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                              <UserPlus className="h-4 w-4" />
                              <span>{feature.author_name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(feature.created_at).toLocaleDateString()}</span>
                            </div>
                              <Badge
                              variant="outline" 
                              className={`text-xs ${
                                feature.priority === "high" ? "border-red-500 text-red-600" :
                                feature.priority === "medium" ? "border-yellow-500 text-yellow-600" :
                                "border-green-500 text-green-600"
                              }`}
                            >
                              {feature.priority} priority
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                feature.status === "implemented" ? "border-green-500 text-green-600" :
                                feature.status === "approved" ? "border-blue-500 text-blue-600" :
                                feature.status === "under_review" ? "border-yellow-500 text-yellow-600" :
                                feature.status === "rejected" ? "border-red-500 text-red-600" :
                                "border-gray-500 text-gray-600"
                              }`}
                            >
                              {feature.status.replace("_", " ")}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                </motion.div>
              ))}
              </div>
            </TabsContent>

          {/* Bugs Tab */}
          <TabsContent value="bugs" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Bug Reports</h2>
                <Dialog open={showNewBug} onOpenChange={setShowNewBug}>
                  <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl">
                      <Plus className="h-4 w-4 mr-2" />
                      Report Bug
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Report a Bug</DialogTitle>
                    <DialogDescription>
                      Help us improve by reporting issues you've encountered
                    </DialogDescription>
                    </DialogHeader>
                  <div className="space-y-4">
                      <div>
                      <Label htmlFor="bugTitle">Title</Label>
                      <Input
                        id="bugTitle"
                        value={newBug.title}
                        onChange={(e) => setNewBug({ ...newBug, title: e.target.value })}
                        placeholder="Brief description of the bug"
                        className="rounded-xl"
                        />
                      </div>
                      <div>
                      <Label htmlFor="bugDescription">Description</Label>
                        <Textarea
                        id="bugDescription"
                        value={newBug.description}
                        onChange={(e) => setNewBug({ ...newBug, description: e.target.value })}
                        placeholder="Describe what happened, steps to reproduce, and expected behavior..."
                        className="rounded-xl min-h-[120px]"
                        />
                      </div>
                      <div>
                      <Label htmlFor="severity">Severity</Label>
                      <Select value={newBug.severity} onValueChange={(value: "low" | "medium" | "high" | "critical") => setNewBug({ ...newBug, severity: value })}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowNewBug(false)}>
                          Cancel
                        </Button>
                      <Button onClick={handleCreateBug} className="bg-gradient-to-r from-red-500 to-pink-600">
                        Report Bug
                        </Button>
                      </div>
                  </div>
                  </DialogContent>
                </Dialog>
              </div>

            <div className="grid gap-6">
              {bugReports.map((bug, index) => (
                <motion.div
                  key={bug.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-red-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                          <Bug className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white line-clamp-2">
                              {bug.title}
                            </h3>
                            <div className="flex items-center gap-2 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVote("bug", bug.id, "up")}
                                className="text-slate-500 hover:text-green-600"
                              >
                                <ThumbsUp className="h-4 w-4" />
                                <span className="ml-1">{bug.upvotes}</span>
                              </Button>
                            </div>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 line-clamp-2 mb-3">
                            {bug.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                            <div className="flex items-center gap-1">
                              <UserPlus className="h-4 w-4" />
                              <span>{bug.author_name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(bug.created_at).toLocaleDateString()}</span>
                            </div>
                            <Badge
                              variant="outline" 
                              className={`text-xs ${
                                bug.severity === "critical" ? "border-red-600 text-red-700 bg-red-50" :
                                bug.severity === "high" ? "border-orange-500 text-orange-600 bg-orange-50" :
                                bug.severity === "medium" ? "border-yellow-500 text-yellow-600 bg-yellow-50" :
                                "border-green-500 text-green-600 bg-green-50"
                              }`}
                            >
                              {bug.severity} severity
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                bug.status === "resolved" ? "border-green-500 text-green-600" :
                                bug.status === "fixing" ? "border-blue-500 text-blue-600" :
                                bug.status === "investigating" ? "border-yellow-500 text-yellow-600" :
                                bug.status === "closed" ? "border-gray-500 text-gray-600" :
                                "border-red-500 text-red-600"
                              }`}
                            >
                              {bug.status}
                            </Badge>
                          </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                </motion.div>
              ))}
              </div>
            </TabsContent>

          {/* Tutoring Tab */}
          <TabsContent value="tutoring" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Tutoring Offers</h2>
                <Dialog open={showNewTutoring} onOpenChange={setShowNewTutoring}>
                  <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl">
                      <Plus className="h-4 w-4 mr-2" />
                    Offer Tutoring
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                    <DialogTitle>Offer Tutoring Services</DialogTitle>
                    <DialogDescription>
                      Help fellow students by offering your expertise
                    </DialogDescription>
                    </DialogHeader>
                  <div className="space-y-4">
                      <div>
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={newTutoring.subject}
                        onChange={(e) => setNewTutoring({ ...newTutoring, subject: e.target.value })}
                        placeholder="e.g., C++ Programming, Data Structures"
                        className="rounded-xl"
                      />
                      </div>
                      <div>
                      <Label htmlFor="tutoringDescription">Description</Label>
                      <Textarea
                        id="tutoringDescription"
                        value={newTutoring.description}
                        onChange={(e) => setNewTutoring({ ...newTutoring, description: e.target.value })}
                        placeholder="Describe your expertise and teaching approach..."
                        className="rounded-xl min-h-[120px]"
                      />
                      </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                        <Input
                          id="hourlyRate"
                          type="number"
                          value={newTutoring.hourlyRate}
                          onChange={(e) => setNewTutoring({ ...newTutoring, hourlyRate: e.target.value })}
                          placeholder="25"
                          className="rounded-xl"
                        />
                      </div>
                      <div>
                        <Label htmlFor="availability">Availability</Label>
                        <Input
                          id="availability"
                          value={newTutoring.availability}
                          onChange={(e) => setNewTutoring({ ...newTutoring, availability: e.target.value })}
                          placeholder="e.g., Weekdays 6-8 PM"
                          className="rounded-xl"
                        />
                      </div>
                      </div>
                      <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowNewTutoring(false)}>
                          Cancel
                        </Button>
                      <Button onClick={handleCreateTutoring} className="bg-gradient-to-r from-emerald-500 to-teal-600">
                        Offer Tutoring
                        </Button>
                      </div>
                  </div>
                  </DialogContent>
                </Dialog>
              </div>

            <div className="grid gap-6">
              {tutoringOffers.map((offer, index) => (
                <motion.div
                  key={offer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                          <Users className="h-6 w-6 text-white" />
                                </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white line-clamp-2">
                              {offer.subject}
                            </h3>
                            <div className="flex items-center gap-2 ml-4">
                              <div className="flex items-center gap-1 text-slate-500">
                                <Star className="h-4 w-4 text-yellow-500" />
                                <span className="text-sm">{offer.rating.toFixed(1)}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                ${offer.hourly_rate}/hr
                              </Badge>
                            </div>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 line-clamp-2 mb-3">
                            {offer.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                                <div className="flex items-center gap-1">
                              <UserPlus className="h-4 w-4" />
                              <span>{offer.author_name}</span>
                                </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(offer.created_at).toLocaleDateString()}</span>
                              </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{offer.availability}</span>
                              </div>
                            <div className="flex items-center gap-1">
                              <Trophy className="h-4 w-4" />
                              <span>{offer.total_sessions} sessions</span>
                                </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                </motion.div>
              ))}
            </div>
                </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Leaderboard</h2>
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                  Weekly Rankings
                </Badge>
                <Badge variant="outline">
                  All Time
                </Badge>
                              </div>
                                </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Weekly Leaderboard */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-600 flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-white" />
                                </div>
                    <div>
                      <CardTitle className="text-xl font-bold">Weekly Champions</CardTitle>
                      <p className="text-slate-600 dark:text-slate-300">Top contributors this week</p>
                              </div>
                            </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {weeklyLeaderboard.map((entry, index) => (
                      <motion.div
                        key={entry.student_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                          index === 0 ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white" : 
                          index === 1 ? "bg-gradient-to-r from-gray-400 to-gray-500 text-white" :
                          index === 2 ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white" :
                          "bg-gradient-to-r from-slate-400 to-slate-500 text-white"
                        }`}>
                              {index + 1}
                            </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-800 dark:text-white">{entry.student_name}</h4>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                            <span>{entry.points} points</span>
                            <span>{entry.threads_count} threads</span>
                            <span>{entry.replies_count} replies</span>
                              </div>
                            </div>
                        <div className="flex items-center gap-2">
                          {index < 3 && (
                            <Crown className={`h-5 w-5 ${
                              index === 0 ? "text-yellow-500" :
                              index === 1 ? "text-gray-400" :
                              "text-amber-600"
                            }`} />
                          )}
                            </div>
                      </motion.div>
                    ))}
                          </div>
                        </CardContent>
                      </Card>

              {/* All Time Leaderboard */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center">
                      <Award className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold">Hall of Fame</CardTitle>
                      <p className="text-slate-600 dark:text-slate-300">All-time top contributors</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {allTimeLeaderboard.map((entry, index) => (
                      <motion.div
                        key={entry.student_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                          index === 0 ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white" : 
                          index === 1 ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white" :
                          index === 2 ? "bg-gradient-to-r from-indigo-500 to-blue-600 text-white" :
                          "bg-gradient-to-r from-slate-400 to-slate-500 text-white"
                        }`}>
                              {index + 1}
                            </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-800 dark:text-white">{entry.student_name}</h4>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                            <span>{entry.points} points</span>
                            <span>{entry.threads_count} threads</span>
                            <span>{entry.replies_count} replies</span>
                              </div>
                            </div>
                        <div className="flex items-center gap-2">
                          {index < 3 && (
                            <Star className={`h-5 w-5 ${
                              index === 0 ? "text-purple-500" :
                              index === 1 ? "text-blue-500" :
                              "text-indigo-500"
                            }`} />
                          )}
                            </div>
                      </motion.div>
                    ))}
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

